# Ordkort – Chilean Spanish self-hosted edition

## Deployment
Use the existing Cloudflare Worker and D1 binding. Deploy only after the pull request's tests pass. Do not recreate the existing database or clear browser storage: they hold vocabulary caches and encrypted sync data, or your local study history.

## Everyday settings
Choose Chinese as the native language and Spanish as the target language. AI-generated words, phrases and examples prefer Chilean usage. Existing cards are not rewritten. Dictionaries and explicit word lists still take precedence over generated preferences.

Settings → Voice:
- Recordings and site voice: original Wiktionary and Workers AI behavior.
- Device voice: original system voice selection.
- Chilean Spanish preferred: es-CL device speech when available, then Latin American Spanish, then other Spanish.
- Chilean cloud voice: optional Azure Catalina or Lorenzo. If unconfigured or unavailable, use device speech. Text is sent to Azure only in this mode when the server is configured.
Device speech rate applies to synthesized device speech, not existing recordings or Azure audio.

Successfully downloaded site/cloud audio is cached on each device for offline replay (up to 256 entries, each up to 256 KiB; older entries may be evicted). It survives app updates but can be removed by browser storage management, and does not sync. New audio may require an internet connection.

## Optional Azure configuration (not required)
When an Azure Speech resource is available, select the Free F0 pricing tier if eligible. In the existing Worker settings, add AZURE_SPEECH_KEY as an encrypted secret and AZURE_SPEECH_REGION as the resource region. Never commit credentials or share screenshots containing them. The local code limits new Azure requests to 12,000 characters/day and 350,000/month in UTC; these are conservative local limits, not a guarantee of the provider's billing terms. Failed requests may count locally. Other uses of the same Azure resource are not counted here. Check the actual Azure tier and billing settings independently.

## Cost and storage
The checked-in defaults disable the paid LLM fallback (PAID_DAILY_TOKENS=0), and set daily D1 write budgets to 10 MB per key and 20 MB site-wide. These are write budgets, not total storage caps. Large imports/sync transfers can hit the daily limits. Monitor actual D1 usage and adjust the deployment settings if necessary. Existing Cloudflare dashboard overrides and provider subscriptions must be checked separately. No Azure account is needed for any non-Azure feature.

## Acceptance checklist
- Confirm Cloudflare deployed the latest main commit and the existing database is bound.
- Verify access protection and existing study records.
- Generate new A1 vocabulary for a Chilean everyday topic and check natural local usage.
- Select Chilean device voice and inspect its actual locale. Test listening and speech rate.
- Play a site audio item online, reload, go offline, and replay it.
- Test encrypted device sync if used.
- Only after optional Azure configuration: test both voices and verify Azure usage and fallback.

Run `npm ci` then `npm test` with Node.js 22. CI mocks the Azure provider; passing tests do not verify real-provider availability or speech quality.
