# Onboarding

Phase 13 adds the first-launch setup path for WenForge Studio. The goal is to get a writer into the working studio quickly while keeping privacy defaults conservative.

## First Launch Flow

The first-launch panel appears until the local onboarding flag is completed.

1. **Language**: defaults to Simplified Chinese (`zh-Hans`) for app setup and creative output expectations.
2. **Project**: use an existing selected project or create a starter project.
3. **Provider**: choose local mock mode or open Settings to configure an encrypted provider credential.
4. **Quality**: choose `economy`, `balanced`, or `premium`; `balanced` remains the default.
5. **Privacy**: keep full prompt logging, full response logging, manuscript logging, and full recent-chapter inclusion off.
6. **Book**: create a demo book or a blank book shell.

## Persistence

Phase 13 stores the onboarding completion flag in renderer local storage and writes privacy choices through the existing typed `privacy.update` bridge. Provider keys still go through the main-process credential flow and are never returned to the renderer.

Future work can move the onboarding completion flag into a dedicated main-process setting once first-run import/open file picker flows are added.

## Mock Mode

Mock mode is offered as a first-class onboarding option so the app can be explored without provider credentials. It does not require API keys and does not change the credential storage model.

## Safety Defaults

Onboarding reinforces these default settings:

- `storeFullPrompts: false`
- `storeFullResponses: false`
- `storeManuscriptsInLogs: false`
- `allowSendingFullRecentChapters: false`

No decrypted secret or encrypted credential payload is displayed during onboarding.
