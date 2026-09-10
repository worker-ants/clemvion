# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 — `impl-chat-channel-patch-token`

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑
(147~169행) 을 SSOT 로 적재. 변경 file 목록은 orchestrator payload (파일 1~15, backend
DTO/controller/service/e2e + frontend `02-nodes/triggers.{mdx,en.mdx}` + `06-integrations-and-config/{discord,slack,telegram}.{mdx,en.mdx}`) 를 기준으로 `git diff origin/main...HEAD --stat` 으로 재확인. 파일 16 이후는 `plan/`·`review/` 산출물이라 매트릭스 trigger 대상 아님(코드/문서 변경 아님).

## 매칭된 trigger

| trigger | 매칭 근거 | 상태 |
|---|---|---|
| **backend-api-change** (`change_type: 백엔드 API 추가·변경`) | `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`(신규 `ChatChannelUpdateConfigDto`) · `update-trigger.dto.ts` · `triggers.controller.ts` 가 glob `**/*.controller.ts`, `**/dto/**` 에 매칭 | **동반 갱신 완료** — 아래 상세 |

나머지 20개 trigger(새 노드 추가·노드 schema 변경·신규 UI 문자열·신규 위젯 chrome 문자열·통합 신규-제공자·신규 섹션 디렉토리·신규 BullMQ 큐·신규 warning/error code·cross-cutting enum·backend zod ui.label·handler output field·인증 흐름·AuthConfig enum·표현식 언어·실행/디버깅 흐름·env/runtime·spec 대규모 변경·GUI 흐름절·spec 결함)은 이번 changeset 에 매칭되는 파일이 없다:

- `codebase/backend/src/nodes/**` 변경 없음 → 새 노드/schema trigger 미해당
- `codebase/frontend/src/**/*.tsx` 변경 없음 → 신규 UI 문자열 trigger 미해당 (이번 diff 는 backend DTO/controller/service + docs `.mdx` 뿐, TSX 파일 없음)
- `codebase/channel-web-chat/**` 변경 없음
- `spec/**` 변경 없음 (`git diff origin/main...HEAD --stat -- spec/` 결과 0건) → `spec-major-change` 미해당
- `codebase/backend/src/modules/auth/**` 변경 없음
- `codebase/packages/expression-engine/**` 변경 없음

## 동반 갱신 상세 확인 — backend-api-change

이번 PR 은 `chatChannel` PATCH 가 사용자 비밀(`botToken`/`inboundSigningPlaintext`)을 받지 않도록
막는 신규 DTO(`ChatChannelUpdateConfigDto`, D-1)와 컨트롤러 Swagger 서술 변경이다. 매트릭스
target (a)(b) 를 같은 changeset 안에서 확인:

- **(a) controller·DTO 의 swagger jsdoc** — `chat-channel-config.dto.ts`(`ChatChannelUpdateConfigDto` 의 `@ApiPropertyOptional({ description, writeOnly: true })` 2건) + `triggers.controller.ts`(`@ApiBadRequestResponse` 설명에 chatChannel 400 사유 3가지 반영) 둘 다 같은 diff 안에 있음 — 이행됨.
- **(b) API 노출 변경 → user-guide 페이지** — 아래 8개 파일이 같은 PR(브랜치, 아직 미머지) 안에서 갱신됨:
  - `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `.en.mdx` — "Bot Token 회전(single-path)" 절에 `chatChannel` 최초 설정 제약(생성 시에만) + `provider` 변경 차단 + `botToken`/`botTokenRef` 필드명·`details.field` 값 정정을 ko/en 양쪽 동일 구조로 추가
  - `codebase/frontend/src/content/docs/06-integrations-and-config/{discord,slack}.{mdx,en.mdx}` — "Changing the bot token or public/signing key" 신규 절 ko/en 대칭 추가 (`botToken`/`inboundSigningPlaintext` PATCH 차단 + `Callout` 동일)
  - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.{mdx,en.mdx}` — 기존 "Bot Token 회전" 문장을 `botTokenRef`→`botToken` 실제 필드명으로 정정 (telegram 은 `inboundSigningPlaintext` 를 안 쓰므로 별도 절 미추가 — DTO JSDoc 의 "telegram 의 server-issued 값은 setupChannel() 이 자동 재발급" 설명과 일치, 누락 아님)

ko/en 파일 쌍 8개 전부 동일한 구조·조건·`details.field` 값으로 대칭 작성됨 (parity 육안 대조 완료).

## Build-time 가드 실행 확인

이번 diff 가 건드린 `02-nodes/triggers.mdx`·`06-integrations-and-config/*.mdx` 는
`userguide-gui-flow-section` trigger 후보이기도 하다 — 신규 절이 `<ImplAnchor kind="ui-entry">`
없이 추가됐는지 직접 실행해 확인했다.

```
cd codebase/frontend && npx vitest run src/lib/docs/__tests__/impl-anchor-existence.test.ts \
  src/lib/docs/__tests__/integrations-coverage.test.ts src/lib/docs/__tests__/triggers-coverage.test.ts
# Test Files  3 passed (3) / Tests  268 passed (268)
```

**GREEN.** 이번에 추가된 절(`## 6.5 Changing the bot token or public key` 등, `### Rotating the
bot token (single-path)`)은 `findGuiFlowSections()` 의 두 신호(heading bareword `GUI` / 본문
bold `GUI`) 어느 쪽도 갖지 않는 "API 제약 안내" 절이라 `integrations-coverage`/`triggers-coverage`
가 `<ImplAnchor kind="ui-entry">` 를 요구하지 않는다 — GUI 흐름 절이 아니므로 이 trigger 는
해당 없음(가드 통과가 그 판단을 뒷받침).

추가로 frontend 전체 테스트(`npx vitest run` — 파일 필터 미작동으로 전체 스위트 실행됨)도
`Test Files 289 passed (289)` / `Tests 6378 passed | 1 skipped (6379)` — i18n/dict/locale 가드를
포함해 회귀 없음.

## i18n / dict / backend-labels 점검

- **신규 TSX 문자열**: 이번 diff 에 `.tsx` 파일이 없어 `new-ui-string` trigger 자체가 미해당.
  다만 `chatChannel` PATCH 편집 UI(`codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx`)를 확인한 결과, edit 모드가 원래부터 `{provider, uiMapping, rateLimitPerMinute, languageLocale, languageHints?}` 만 보내고 `botToken`/`inboundSigningPlaintext` 는 애초에 실지 않음(파일 285행 주석 "edit 모드: uiMapping / rateLimitPerMinute / languageHints 만 편집 (provider/botToken 은 별 경로)"). 이번 backend 변경이 frontend UI 동작을 바꾸지 않으므로 `dict/{ko,en}/triggers.ts` 동반 갱신 대상이 아님 — 실측으로 확인.
- **신규 warningCode/errorCode**: DTO 의 `@IsEmpty()` 검증 메시지("botToken 은 PATCH 로 바꿀 수 없어요...")는 class-validator 커스텀 `message` 로 **DTO 안에 한국어 리터럴로 직접 작성**돼 있고, `backend-labels.ts` 의 `WARNING_KO`/`ERROR_KO` 매핑 경로를 타지 않는 기존 관례(이 저장소의 class-validator 메시지는 항상 한국어 직접 작성, `ErrorCode` enum 신규 값도 아님)를 그대로 따름. `codebase/backend/src/nodes/core/error-codes.ts` 변경 없음, `warningRules` 변경 없음 → `new-warning-code`/`new-error-code` trigger 미해당, `backend-labels.ts` 미변경은 갭 아님.

## 확인된 것 — 위반 없음

- ko/en MDX 8파일 parity 대칭 (내용·구조·`details.field` 값 동일)
- swagger jsdoc(controller+DTO) ↔ user-guide 본문 서술 정합 (400 사유 3가지 vs guide 서술 일치)
- `<ImplAnchor>` 가드 3종 268건 GREEN — GUI 흐름절 오분류 없음
- frontend 전체 스위트 6378건 GREEN — i18n/locale/dict 가드 포함 회귀 없음
- `spec/**` 무변경 → 그 축의 동반 갱신 의무 자체가 이번 changeset 범위 밖 (별도 트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 로 planner 후속 등재돼 있음 — 이 reviewer 의 trigger 범위(frontend docs/i18n)와는 무관)

## 요약

매트릭스 21개 trigger 중 이번 changeset 에 매칭되는 것은 **backend-api-change 1건**(controller+DTO
변경)뿐이며, 그 target (a) swagger jsdoc, (b) user-guide MDX 8파일(ko/en 4쌍)이 **같은 PR 안에서
이미 동반 갱신 완료**돼 있다. `<ImplAnchor>`/i18n/docs 관련 build-time 가드(268+6378건)를 직접
실행해 GREEN 을 확인했고, 신규 TSX·신규 노드·신규 provider·신규 warning/error code·신규 섹션
디렉토리 등 나머지 20개 trigger 는 매칭 파일 자체가 없어 미해당이다. 누락 0건.

## 위험도

NONE
