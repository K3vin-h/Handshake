# Handshake — Devpost draft

Draft only. Replace `[NEEDS: ...]` with verified evidence; omit unsupported claims before submitting. Track-specific checklist: [devpost-tracks.md](devpost-tracks.md).

## Tagline

Learn ASL fingerspelling, starting with the people you want to talk to.

## Inspiration

[NEEDS: real interview quote, attribution/permission, context and source in docs/notes.md].

We are exploring how short, personal practice can help hearing learners begin fingerspelling for a Deaf friend, relative or coworker. [NEEDS: validated problem statement grounded in those conversations].

## What it does

Handshake starts with your name and introduces alphabet handshapes. Webcam landmarks provide immediate reference-based feedback; Gemini rewords measured feedback into coaching cues. Practice order can adapt while lesson unlocks and recognition thresholds remain consistent.

Scope: static fingerspelling in Units 1–2. J/Z and letters without recorded validation are reference-only. This prototype does not assess full ASL, facial grammar, conversation fluency or fingerspelling comprehension.

[NEEDS: exact live-letter list and human gate results from docs/test-log.md].

Optional sponsor features: aggregate attempt stats, an agent-assisted practice plan with local fallback, and consent-gated emails. [NEEDS: specify which integrations were actually demonstrated; remove the rest].

## How we built it

React, TypeScript and Vite; browser MediaPipe hand landmarks; recorded handshape references and recognizer; Express proxy for Gemini coaching and practice words. MediaPipe measures hands; Gemini coaches and never judges signs. Responses from cache are labeled cached.

[NEEDS: confirm which recognizer/model actually ran].

[NEEDS: verified Tiger Data, Maritime, n8n, Vultr/domain, Databricks and Entire usage, linked artifacts from devpost-tracks.md].

## Challenges we ran into

[NEEDS: one real recognition challenge, the attempted fix and measured result].

[NEEDS: one real integration or design challenge and what shipped].

## Accomplishments we're proud of

[NEEDS: demonstrated end-to-end path, supported by demo footage].

[NEEDS: real user feedback; quote remains a placeholder until sourced].

## What we learned

[NEEDS: specific lesson from actual user testing or implementation; no invented outcomes].

## What's next

Validate references with ASL-fluent and Deaf reviewers, expand only letters that meet the recorded gate, and evaluate whether learners find the practice useful. [NEEDS: team-confirmed priorities].

## Accessibility

The sponsor stats chart includes a text table, and notification status is announced politely. [NEEDS: verified keyboard flow, contrast, text scaling, reduced-motion behavior, detection announcements, left-handed support, matching Figma URL]. Do not describe untested accessibility requirements as completed.

## Privacy and limitations

Use the privacy note in [devpost-tracks.md](devpost-tracks.md), updated to the final enabled features. Names/emails go only to n8n after explicit consent; opted-in lesson titles can also contain names. Anonymous UUIDs are not authentication, and someone holding an id could trigger emails to its saved contact. [NEEDS: confirm final snapshot setting and disclose Google photo transfer if enabled].

References match our recordings unless reviewed by an ASL-fluent person. [NEEDS: reviewer and verification record, or retain that limitation]. No measured learning improvement or community endorsement is claimed.

## Links and submission assets

- Demo: [NEEDS: final public HTTPS URL]
- Repository: [NEEDS: public submission repo/branch]
- Video: [NEEDS: final demo video]
- Figma: [NEEDS: matching design file]
- Sponsor evidence: [devpost-tracks.md](devpost-tracks.md)
- Built with: [NEEDS: final list of tools actually used]
- Team contributions: [NEEDS: names and actual contributions]
