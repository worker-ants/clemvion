# User Guide Sync 리뷰

## 매트릭스 적재
- SSOT: `.claude/config/doc-sync-matrix.json` (rows 21개) Read 완료.
- 보조: `plan/in-progress/chat-channel-rules-cleanup.md` Read — 본 변경은 `#1319`/`#1320`/`#1324` 가 남긴
  **developer 축 잔여 정리** (프론트-요약: `chat-channel-input-rules.{ts,spec.ts}` 구조 정리, stale 주석
  정정, `rotateBotToken` swagger 응답 문서화 잔여) 이며 `spec_impact: none` 으로 명시돼 있다.

## 변경 파일 식별
`git status --short` / `git diff --name-only HEAD` 는 클린(이미 5개 커밋으로 반영됨,
`f978f8d77`~`d8ad68b25`). prompt 의 변경 file 목록(코드 14개)은 전부 다음 두 디렉터리에 국한된다:

- `codebase/backend/src/modules/triggers/**` — `chat-channel-input-rules.{ts,spec.ts}`,
  `chat-channel-rejection-messages.const.ts`, `dto/chat-channel-config.dto.ts`,
  `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` (신규), `dto/trigger-dto-validation.spec.ts`,
  `triggers.controller.ts`, `triggers.service.{ts,spec.ts}`
- `codebase/backend/src/repo-guards/__tests__/**` — DTO 클래스명 충돌 가드 신규 (harness/tooling, 프로덕션
  기능 아님)

`codebase/frontend/**`, `codebase/backend/src/nodes/**`, `codebase/backend/src/modules/auth/**`,
`codebase/packages/expression-engine/**`, `codebase/frontend/src/content/docs/**` — 이번 changeset 에
**전혀 포함되지 않음**.

## trigger 매칭

| 매트릭스 행 | glob/semantic | 매칭 여부 |
|---|---|---|
| new-node / node-schema-change | `codebase/backend/src/nodes/**` | 불일치 — 변경 경로는 `modules/triggers/**` 이지 `nodes/**` 아님 |
| new-ui-string / new-widget-chrome-string | `*.tsx` | 불일치 — tsx 변경 0건 |
| new-userguide-section-dir | `content/docs/*/` | 불일치 — docs 디렉터리 변경 0건 |
| **backend-api-change** | `*.controller.ts` / `dto/**` (semantic) | **매칭** — `triggers.controller.ts` + 신규 `dto/responses/chat-channel-rotate-bot-token-response.dto.ts` |
| integration-provider-change | semantic (provider 신규/변경) | 불일치로 판단 — 아래 상세 |
| auth-session-flow-change | `modules/auth/**` | 불일치 — `modules/triggers/**` 는 별도 (봇 토큰/서명 검증이지 앱 자체 인증/세션 아님) |
| expression-language-change / run-debug-flow-change / spec-major-change | — | 불일치 |
| new-warning-code / new-error-code | warningRules / error-codes.ts | 불일치 — 변경 없음 |

### backend-api-change — 매칭됐으나 target 충족 확인됨

- **target 1 "controller·DTO 의 swagger jsdoc"**: 같은 changeset 안에서 이미 충족됨 —
  `triggers.controller.ts` 에 `@ApiUnauthorizedResponse` · `@ApiNotFoundResponse` ·
  `@ApiOkWrappedResponse(ChatChannelRotateBotTokenDto)` 추가, 신규 response DTO 파일이 각 필드에
  JSDoc(공개 OpenAPI `description` 대상)을 달았다. 이 자체가 이 PR 의 목적이었다(plan 표
  "swagger 404/200 — 유효").
- **target 2 "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지" (조건부)**: 실측 결과
  이 PR 은 **wire 응답 형태를 바꾸지 않는다** — `botIdentity` 의 `teamId`(Slack)·`publicKey`(Discord)는
  이전부터 `{ ...mergedChannel.botIdentity }` 스프레드로 이미 응답에 실려 있었고(선행 라운드
  `review/code/2026/09/12/16_17_57/api_contract.md` WARNING), 이번 변경은 그 사실을 **타입/스웨거
  선언에 반영**한 것뿐이다. 사용자 가이드 3곳(`06-integrations-and-config/{telegram,slack,discord}.mdx`)은
  이미 rotate 응답을 `{ data: { triggerId, rotatedAt, chatChannelHealth, botIdentity } }` 로 문서화하고
  있고(`telegram.mdx:129` 등), 이 서술은 여전히 정확하다(하위 필드를 나열하며 축소 서술한 것이 아니므로
  stale 아님). → **동반 갱신 누락 아님.**

### integration-provider-change — 불일치로 판단한 근거

Telegram/Slack/Discord 는 신규 provider 가 아니며(기존 `06-integrations-and-config/*.mdx` 3종 존재),
이번 변경이 provider 별 동작(설정 필드·요구사항·에러 매핑)을 바꾸지 않는다. `chat-channel-config.dto.ts`
· `chat-channel-rejection-messages.const.ts` 변경은 **주석 텍스트만** 새 모듈명(`chat-channel-input-rules`)을
가리키도록 정정한 것으로 사용자 대면 동작·문서 서술과 무관.

## 발견사항

- **[INFO]** backend 가 provider 별 `botIdentity` 부가 필드(Slack `teamId`, Discord `publicKey`)를
  이번 PR 로 공식 계약화했는데, **frontend 소비 계층은 여전히 그 필드를 모른다**
  — 이 changeset 밖의 사전 존재 gap이며 매트릭스 trigger 를 직접 미스한 사례는 아니다(정보 제공 목적).
  - 관련 파일(변경 안 됨, 실측 확인): `codebase/frontend/src/lib/api/triggers.ts:40`
    (`botIdentity?: { botId?: number; username?: string }` — `teamId`/`publicKey` 없음),
    `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:483-503`
    (username/botId 만 렌더링), `codebase/frontend/src/lib/i18n/dict/{ko,en}/triggers.ts`
    (`botIdentity`/`botIdentityUsername`/`botIdentityBotId` 키만 존재, teamId/publicKey 라벨 없음
    — 단 ko/en 양쪽 다 동일하게 없으므로 parity 위반은 아님).
  - 매트릭스 항목: 엄밀히는 어떤 행도 이 자리를 직접 지목하지 않는다(트리거 코드는
    `modules/triggers/**` 라 `new-node`/`node-schema-change`(`nodes/**` 전용)에는 안 걸리고,
    `backend-api-change` 의 "user-guide 페이지" target 은 위에서 본 대로 wire 포맷 불변이라 충족).
  - 상세: 이 PR 의 서사(`triggers.service.spec.ts` 새 테스트 JSDoc — "선언이 실제 반환보다 좁았다"는
    결함을 되풀이하지 않기 위해 열 줄을 썼다는 취지)를 그대로 한 계층 앞으로 밀면, 사용자는
    Slack/Discord 봇 토큰 회전 후에도 `teamId`/`publicKey` 를 UI 에서 확인할 방법이 없다 — 백엔드가
    "실제로 돌아온다"를 보장해도 화면에 없으면 사용자에게는 존재하지 않는 값이다.
  - 제안: 이번 changeset 을 막을 사유는 아니다(범위 밖 pre-existing gap). 후속 항목으로
    `plan/in-progress/spec-draft-nullable-notation-followups.md` 트래커에 "frontend `botIdentity` 부가
    필드(teamId/publicKey) 표시 + `dict/{ko,en}/triggers.ts` 라벨 추가" 를 등재할 것을 권장.

## 요약
매트릭스 21개 행 중 glob 으로 확정 불일치(nodes/**, tsx, content/docs/*, auth/**, expression-engine/**,
error-codes.ts 등) 다수, semantic 행 중 `backend-api-change` 1건이 매칭됐으나 두 target(swagger jsdoc,
user-guide 영향)이 이번 changeset 안에서 이미 충족되거나 조건 불성립(wire 포맷 불변)으로 확인돼 실제
동반 갱신 누락은 **0건**이다. 다만 이 PR 이 formalize 한 provider 별 `botIdentity` 필드가 frontend
UI·dict 에는 여전히 반영돼 있지 않다는 인접 gap 을 INFO 로 1건 남긴다(이 changeset 이 만든 gap 아님,
후속 트래커 등재 권고).

## 위험도
LOW
