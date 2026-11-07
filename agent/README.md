# Practice planner

Separate service intended for Maritime deployment. No Maritime deployment has been performed in this checkout.

The agent calls Gemini with `get_stats` and `get_practice_words` tools, bounded to four turns and a seven-second request deadline. Tools use the request's anonymous id and known letters; model-provided ids cannot change them. The app validates the resulting lesson, focus and words and falls back locally on timeout, invalid output, or missing configuration. It only chooses among the next lesson and completed reviews; it cannot unlock lessons or change recognition thresholds.

Run from this directory with Node 24+:

```sh
npm install
# Supply these through your shell or hosting secret manager:
# AGENT_TOKEN, GEMINI_API_KEY, APP_URL (public HTTPS app origin)
# Optional GEMINI_MODEL and PORT (default 8080)
npm start
```

`Dockerfile` builds the standalone service. Configure the same `AGENT_TOKEN` as the app's `MARITIME_AGENT_TOKEN`, and set `MARITIME_AGENT_URL` to the service's `/plan` URL. `/health` is public; POST `/plan` requires the bearer token. Keep APP_URL operator-controlled. Agent receives UUID, lesson ids, letter sets and aggregate stats, never profile names, emails or camera frames.

[NEEDS: verify Maritime's current deployment procedure, deploy service, capture agent URL and planner demo clip].
