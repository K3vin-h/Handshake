import { writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { lessonEmailHtml, recapEmailHtml } from './lib/email-template.mjs';
const node=(name,type,parameters,typeVersion=1,extra={})=>({id:name.replaceAll(' ','-'),name,type:`n8n-nodes-base.${type}`,typeVersion,position:[0,0],parameters,...extra});
const sql=(name,query,parameters)=>node(name,'postgres',{operation:'executeQuery',query,options:{queryReplacement:parameters}},2.6);
const condition=(name,expression)=>node(name,'if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:'send',leftValue:expression,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},2.2);
const respond=(name,status='200',body='={{ {ok:true} }}')=>node(name,'respondToWebhook',{respondWith:'json',responseBody:body,options:{responseCode:status}},1.4);
const mail=(name,subject,text,html)=>node(name,'emailSend',{fromEmail:'={{ $vars.HANDSHAKE_FROM_EMAIL }}',toEmail:'={{ $json.result.email }}',subject,emailFormat:'both',text,html,options:{appendAttribution:false}},2.1,{onError:'continueErrorOutput'});
const workflow=(name,nodes,edges)=>{
 const connections={};
 for(const [from,to,output=0] of edges){connections[from]??={main:[]};while(connections[from].main.length<=output)connections[from].main.push([]);connections[from].main[output].push({node:to,type:'main',index:0});}
 nodes.forEach((n,i)=>n.position=[(i%6)*240,Math.floor(i/6)*240]);
 return {name,active:false,nodes,connections,settings:{executionOrder:'v1',timezone:'UTC',saveDataErrorExecution:'none',saveDataSuccessExecution:'none',saveManualExecutions:false,saveExecutionProgress:false,executionTimeout:60},pinData:{}};
};
export function lessonWorkflow(){return workflow('Handshake lesson complete',[
 node('Lesson webhook','webhook',{httpMethod:'POST',path:'handshake-lesson-complete',authentication:'headerAuth',responseMode:'responseNode',options:{}},2),
 sql('Claim lesson','select handshake.lesson_claim($1::jsonb) as result','={{ [JSON.stringify($json.body)] }}'),
 condition('Lesson eligible','={{ $json.result.send === true }}'),
 sql('Recheck lesson','select handshake.lesson_recheck($1,$2::uuid) as result',"={{ [$('Claim lesson').item.json.result.learnerId, $('Claim lesson').item.json.result.lease] }}"),
 condition('Contact still subscribed','={{ $json.result.send === true }}'),
 // Kept for tests/export shape; not connected — we do practice reminders, not “lesson finished” pings.
 mail(
  'Send lesson',
  '={{ $("Claim lesson").item.json.result.title + " — practice reminder" }}',
  '={{ $("Claim lesson").item.json.result.title + " — practice reminder.\\n\\nSpell your name practice reminder placeholder.\\n\\nOpt out: " + $vars.HANDSHAKE_LINK_ORIGIN + "/webhook/handshake-unsubscribe?token=" + encodeURIComponent($json.result.unsubscribeToken) }}',
  lessonEmailHtml(),
 ),
 sql('Skip notify','select handshake.lesson_finish($1,$2::uuid,false)',"={{ [$('Claim lesson').item.json.result.learnerId, $('Claim lesson').item.json.result.lease] }}"),
 sql('Lesson sent','select handshake.lesson_finish($1,$2::uuid,true)',"={{ [$('Claim lesson').item.json.result.learnerId, $('Claim lesson').item.json.result.lease] }}"),
 sql('Lesson failed','select handshake.lesson_finish($1,$2::uuid,false)',"={{ [$('Claim lesson').item.json.result.learnerId, $('Claim lesson').item.json.result.lease] }}"),
 respond('Lesson response',200),
 respond('Claim response','={{ $json.result.status }}','={{ {ok:$json.result.status < 400} }}'),
 respond('SMTP failure',503,'={{ {ok:false,reason:"delivery_failed"} }}'),
 ],[['Lesson webhook','Claim lesson'],['Claim lesson','Lesson eligible'],['Lesson eligible','Recheck lesson'],['Lesson eligible','Claim response',1],['Recheck lesson','Contact still subscribed'],['Contact still subscribed','Skip notify'],['Contact still subscribed','Lesson response',1],['Skip notify','Lesson response'],['Send lesson','Lesson sent'],['Send lesson','Lesson failed',1],['Lesson sent','Lesson response'],['Lesson failed','SMTP failure']]);}
export function recapWorkflow(){return workflow('Handshake weekly operator-only recap',[
 node('Monday UTC','scheduleTrigger',{rule:{interval:[{field:'cronExpression',expression:'0 17 * * 1'}]}},1.2),
 node('Manual operator test','manualTrigger',{},1,{disabled:true}),
 sql('Claim recaps','select handshake.recap_claim($1) as result','={{ [$vars.HANDSHAKE_RECAP_TEST_EMAIL || ""] }}'),
 node('Fetch stats','httpRequest',{url:'={{ $vars.HANDSHAKE_APP_ORIGIN + "/api/stats/" + encodeURIComponent($json.result.learnerId) }}',options:{timeout:10000,response:{response:{responseFormat:'json'}}}},4.2),
 sql('Weighted stats','select handshake.recap_stats($1::jsonb) as result','={{ [JSON.stringify($json)] }}'),
 sql('Recheck recap','select handshake.recap_recheck($1,$2::uuid,$3) as result',"={{ [$('Claim recaps').item.json.result.learnerId, $('Claim recaps').item.json.result.lease, $vars.HANDSHAKE_RECAP_TEST_EMAIL || ''] }}"),
 condition('Learner still subscribed','={{ $json.result.send === true }}'),
 mail(
  'Send recap',
  'Ready for another ASL session?',
  '={{ "Ready for another ASL session?\\n\\nA little practice goes a long way. Your last 14 days: " + $("Weighted stats").item.json.result.attempts + " attempts. " + ($("Weighted stats").item.json.result.share === null ? "No attempts recorded yet." : "Reference match share: " + $("Weighted stats").item.json.result.share + "%.") + "\\n\\nOpen Handshake and pick up where you left off.\\n\\nOpt out of all practice emails: " + $vars.HANDSHAKE_LINK_ORIGIN + "/webhook/handshake-learner-unsubscribe?token=" + encodeURIComponent($json.result.unsubscribeToken) }}',
  recapEmailHtml(),
 ),
 sql('Recap sent','select handshake.recap_finish($1,$2::uuid,true)',"={{ [$('Claim recaps').item.json.result.learnerId, $('Claim recaps').item.json.result.lease] }}"),
 sql('Recap failed','select handshake.recap_finish($1,$2::uuid,false)',"={{ [$('Claim recaps').item.json.result.learnerId, $('Claim recaps').item.json.result.lease] }}"),
 node('Report recap SMTP failure','stopAndError',{errorType:'errorMessage',errorMessage:'Recap delivery failed; lease released, delivery unconfirmed.'}),
 ],[['Monday UTC','Claim recaps'],['Manual operator test','Claim recaps'],['Claim recaps','Fetch stats'],['Fetch stats','Weighted stats'],['Weighted stats','Recheck recap'],['Recheck recap','Learner still subscribed'],['Learner still subscribed','Send recap'],['Send recap','Recap sent'],['Send recap','Recap failed',1],['Recap failed','Report recap SMTP failure']]);}
if(import.meta.url===pathToFileURL(process.argv[1]??'').href){for(const [file,value] of [['lesson-complete.json',lessonWorkflow()],['weekly-recap.json',recapWorkflow()]])await writeFile(new URL(file,import.meta.url),JSON.stringify(value,null,2)+'\n');}
