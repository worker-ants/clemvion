# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

- SSOT: `.claude/config/doc-sync-matrix.json` (`rows[]` 21행) Read 완료.
- 보조: `PROJECT.md` §변경 유형 → 갱신 위치 매핑 표 + §자주 누락되는 항목 Read 완료.
- 변경 파일 목록: 이 리뷰의 changeset 은 `origin/main...HEAD` 누적 diff(59개 파일 — `codebase/**` 22개, `plan/**` 3개, `review/**` 33개(리뷰/컨시스턴시 산출물), `spec/conventions/**` 1개)이며, 이전 리뷰 라운드(`13_41_55`)의 산출물·그 라운드가 지적한 WARNING 을 실제로 고친 후속 fix 커밋들이 함께 포함돼 있다. 즉 이번 라운드는 **이전 라운드가 낸 지적이 실제로 해소됐는지 검증**하는 성격이 강하다.

## 매칭된 trigger

| 변경 파일 | 매칭 trigger (matrix id) |
|---|---|
| `codebase/backend/src/modules/triggers/triggers.controller.ts` (`@ApiBadGatewayResponse` 추가) | `backend-api-change` (`*.controller.ts` glob) |
| `codebase/backend/src/modules/chat-channel/providers/{slack,discord,telegram}/*.adapter.ts` + `chat-channel/types.ts` + `chat-channel-input-rules.ts` | `integration-provider-change` (semantic — 400/502 분류 원인 재정의) |
| `codebase/frontend/src/lib/i18n/backend-labels.ts` (`ERROR_KO.BOT_TOKEN_INVALID` 문구 변경) | 위 두 trigger 가 요구하는 co-update 대상 자체 |
| `spec/conventions/chat-channel-adapter.md` (frontmatter `pending_plans` + §1.1.2 콜아웃) | `spec-major-change` (`spec/conventions/**` glob) |

`codebase/backend/src/nodes/**`(new-node/node-schema-change), `*.tsx`(new-ui-string), `content/docs/<NN>-*/` 신규 디렉토리(new-userguide-section-dir), `auth/**`(auth-session-flow-change), `expression-engine/**`, `nodes/core/error-codes.ts`(new-error-code), warningRules(new-warning-code) 는 이번 changeset 에 없음 — 해당 trigger 는 매칭 안 됨.

## 발견사항

- **[INFO]** (검증 완료, 조치 불요) 이전 라운드(`13_41_55/user_guide_sync.md`)가 낸 WARNING — "Slack·Discord provider 유저가이드가 400/502 분류를 반영하지 않아 Telegram 형제 절과 비대칭" — 이 이번 changeset 안에서 해소됐다.
  - 확인한 동반 갱신 파일: `codebase/frontend/src/content/docs/06-integrations-and-config/discord.mdx` (§6.5, "에러: 자격 증명 거부(...) → 400 `BOT_TOKEN_INVALID`, 그 밖(...) → 502 `CHAT_CHANNEL_SETUP_FAILED`" 신설), `discord.en.mdx` (동일 영문), `slack.mdx`(§5.5, 동일 패턴), `slack.en.mdx`(동일 영문) — ko/en 4파일 전부 커밋 `15504662d` 로 동일 turn 에 추가됨.
  - 상세: 매트릭스 `integration-provider-change` 의 target(`docs/06-integrations-and-config/<provider>.{mdx,en.mdx}`)이 실제로 채워졌다. `Read` 로 4파일 모두 직접 열어 문구를 대조했고, Telegram §6 의 기존 서술("에러: 400 `BOT_TOKEN_INVALID`, 404 `TRIGGER_NOT_FOUND`, 502 `CHAT_CHANNEL_SETUP_FAILED` 등")과 같은 성격의 정보(400/502 분기 + 각 코드의 의미)를 담고 있어 형제 페이지 간 비대칭이 해소됐다. i18n 관점에서도 ko/en 쌍이 같은 커밋에 함께 들어가 parity 위반 없음.
  - 이 항목은 CRITICAL/WARNING 이 아니라 **정상 확인 기록**이다 — 다음 리뷰 라운드가 같은 파일을 다시 "누락"으로 오탐하지 않도록 남긴다.

- **[INFO]** Telegram vs Discord/Slack 문서의 상세도 비대칭 (경미, 조치 선택)
  - 변경 파일: 위와 동일한 4개 mdx (discord/slack ko+en), 비교 대상은 이번 changeset 에 포함되지 않은 `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx`/`.en.mdx` (기존 문구, 미변경)
  - 매트릭스 항목: `integration-provider-change` — "docs mdx + dict 키" (target 자체는 충족됐으나 표현 수준 차이)
  - 상세: 이번에 신설된 Discord/Slack 문구는 "자격 증명 거부"의 provider-specific 판별 조건(Discord: bot token 무효 또는 `verify_key` 불일치, Slack: bot token 무효)까지 괄호로 설명하는 반면, Telegram §6 은 "에러: 400 `BOT_TOKEN_INVALID`, 404 `TRIGGER_NOT_FOUND`, 502 `CHAT_CHANNEL_SETUP_FAILED` 등" 으로 코드만 나열하고 분류 기준은 설명하지 않는다. 사용자 안내 관점에서 셋 다 필요한 정보(무엇이 400 이고 무엇이 502 인지)는 담고 있어 **누락은 아니지만**, 세 provider 문서의 서술 깊이가 통일돼 있지 않다.
  - 제안: 급하지 않음 — 다음에 Telegram 페이지를 만질 일이 생기면 같은 수준(자격 증명 거부 판별 조건 한 줄)으로 맞추는 것을 고려. 이번 PR 을 막을 사유 아님.

- **[INFO]** `backend-labels.ts` co-update 및 spec SoT 정정 — 정상 확인
  - `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 `ERROR_KO.BOT_TOKEN_INVALID` 가 "제공자 인증 401/403" → "봇 토큰이 제공자에게 거부됐어요"로 같은 changeset 안에서 갱신됐다 — 코드가 transport(401/403) 기준에서 원인(자격 증명 거부) 기준으로 재분류된 것과 정확히 정합. `ERROR_KO`는 KO-only 매핑(영문은 backend 원문 SoT)이라 i18n parity 이슈 없음.
  - `spec/conventions/chat-channel-adapter.md` frontmatter `pending_plans` 주석이 "§1.1.2 code 선언 계약은 미구현" → "구현됐다(2026-09-12, 3종 전부)"로 정정됐고, 남은 401/403 fallback 제거 판정은 별도 후속 plan 항목으로 명시적으로 계속 추적된다. `status: partial` 은 나머지 미구현 plan(3개) 때문에 정확히 유지됨 — frontmatter 정합 갱신 요건 충족.
  - `CHANGELOG.md` 에 breaking change 공지(400→502 전환, `details.reason` 제거, 메시지 문구 변경)가 표·콜아웃 형태로 상세히 기록됨 — 매트릭스 필수 항목은 아니지만 저장소 관례(PROJECT.md 밖, 하지만 이 저장소 CHANGELOG 관례) 를 따른 것으로 확인.

## 비대상으로 확인한 항목 (오탐 방지)

- `codebase/backend/src/nodes/**` 변경 없음 → new-node/node-schema-change 불발.
- `*.tsx` 변경 없음 → new-ui-string 불발 (프런트엔드 UI 컴포넌트는 이번 PR 에서 손대지 않음, `chat-channel-card.tsx` 의 generic 토스트도 무변경).
- `codebase/backend/src/modules/auth/**` 변경 없음 → auth-session-flow-change 불발.
- `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음 → new-error-code 불발 (`BOT_TOKEN_INVALID`/`CHAT_CHANNEL_SETUP_FAILED` 는 기존 등록 코드의 HTTP status 재분류일 뿐, 신규 코드 값 추가 아님).
- `content/docs/<NN>-*/` 신규 디렉토리 없음 → new-userguide-section-dir(locale.ts 등록) 불발.
- `codebase/packages/expression-engine/**` 변경 없음 → expression-language-change 불발.
- `review/**`, `plan/**` (in-progress/complete 이동, RESOLUTION.md 등) 는 매트릭스 target 이 아닌 프로세스 산출물 — 무관.

## 요약

매트릭스 21행 중 `backend-api-change`(controller glob) · `integration-provider-change`(semantic) · `spec-major-change`(spec/conventions glob) 3행이 매칭됐다. 이전 라운드가 지적한 WARNING(Slack/Discord 유저가이드 06-integrations-and-config 페이지의 400/502 분류 미반영)은 이번 changeset 안에서 ko/en 4파일 전부 동일 turn 에 해소됐음을 `Read` 로 직접 대조 확인했다. `backend-labels.ts` ERROR_KO 매핑과 spec frontmatter 정정도 함께 정합. CRITICAL/WARNING 신규 발견 0건 — 남은 것은 Telegram 대비 서술 깊이 비대칭이라는 경미한 INFO 1건뿐이며 병합을 막을 사유가 아니다.

## 위험도

NONE
