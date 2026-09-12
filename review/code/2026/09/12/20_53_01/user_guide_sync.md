# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` (rows 21개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 보조 적재 완료.

## 변경 파일 (17개, prompt 기준)

- `CHANGELOG.md`
- `codebase/backend/src/modules/auth/auth.controller.ts`
- `codebase/backend/src/modules/triggers/triggers.controller.spec.ts`
- `codebase/backend/src/modules/triggers/triggers.controller.ts`
- `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` (신규)
- `codebase/frontend/src/content/docs/02-nodes/triggers.{mdx,en.mdx}`
- `codebase/frontend/src/content/docs/06-integrations-and-config/{mcp-servers,telegram}.{mdx,en.mdx}`
- `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`
- `codebase/frontend/src/lib/i18n/backend-labels.ts`
- `plan/in-progress/spec-draft-nullable-notation-followups.md`, `plan/in-progress/trigger-uuid-and-guide-error-codes.md` (plan, SoT 아님— 참고용)

## trigger 매칭 요약

| 매트릭스 행 (id) | 매칭 파일 | 판정 |
|---|---|---|
| `backend-api-change` (`*.controller.ts`, semantic) | `auth.controller.ts`, `triggers.controller.ts` | **부분 누락 — 아래 발견사항 참조** |
| `auth-session-flow-change` (`backend/src/modules/auth/**`, semantic) | `auth.controller.ts` | 해당 없음(아래 근거) |
| `new-node` / `node-schema-change` (`backend/src/nodes/**`) | 매칭 파일 없음 | 해당 없음 |
| `new-warning-code` / `new-error-code` | 신규 코드 없음(`VALIDATION_ERROR` 는 기존 enum 재사용) | 해당 없음 |
| `spec-defect-found` (semantic) | `spec/5-system/15-chat-channel.md §5.4`, `swagger.md §5-4` 갭을 developer 가 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 위임으로 정확히 등재 | **준수** (참고, 발견사항 아님) |
| 나머지 15개 행 (`new-ui-string`, `integration-provider-change`, `new-userguide-section-dir`, `expression-language-change`, `run-debug-flow-change` 등) | 매칭 없음 | 해당 없음 |

## 발견사항

- **[WARNING]** `rotateBotToken` 에 신규로 노출된 `400 VALIDATION_ERROR`(malformed `:id`) 가 user-guide MDX 에 반영되지 않음
  - 변경 파일 (trigger): `codebase/backend/src/modules/triggers/triggers.controller.ts` — `@Param('id', ParseUUIDPipe) triggerId: string` 추가(라인 291) + `@ApiBadRequestResponse` 설명에 `VALIDATION_ERROR (:id 가 UUID 형식이 아님 — ParseUUIDPipe)` 를 새로 삽입(라인 272)
  - 매트릭스 항목: `backend-api-change` — targets: `"controller·DTO 의 swagger jsdoc"`(✅ 반영됨) + `"API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"`(❌ 미반영)
  - 누락된 동반 갱신:
    - `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` 의 Callout (라인 463 부근, 이번 diff 에서 바로 옆 문장을 편집했음에도 400 케이스는 추가 안 함)
    - `codebase/frontend/src/content/docs/02-nodes/triggers.en.mdx` 동일 Callout (라인 450 부근)
    - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` §6 "에러:" 목록 (라인 130 — 이번 diff 가 바로 이 줄을 편집해 `TRIGGER_NOT_FOUND→RESOURCE_NOT_FOUND` 로 고쳤음)
    - `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.en.mdx` §6 "Errors:" 목록 (라인 117, 동일)
  - 상세: 이 PR 은 `rotateBotToken` 의 `:id` 가 UUID 형식이 아닐 때 종전 `500 INTERNAL_ERROR`(마스킹) 대신 새로 관측 가능한 `400 VALIDATION_ERROR` 분기를 만든다(CHANGELOG.md 에도 "Behavior change" 로 명시). CHANGELOG·컨트롤러 swagger 는 갱신됐지만, 바로 이 엔드포인트를 설명하는 두 user-guide 페이지(`triggers.mdx`/`.en.mdx` 의 Chat Channel 에러코드 Callout, `telegram.mdx`/`.en.mdx` §6 rotate curl 예시의 "Errors:" 목록)에는 이 신규 400 케이스가 반영되지 않았다. 특히 telegram.mdx §6 "에러:" 줄과 triggers.mdx Callout 은 **이번 diff 가 바로 그 줄을 다른 이유(404 코드 오귀속 정정)로 편집**했으므로, 같은 편집 세션에서 조건이 하나 더 늘었다는 사실을 놓친 것으로 보인다. API 를 직접 호출하는 자동화/CI 사용자가 트리거 id 를 잘못 넘겼을 때 문서에 없는 에러 코드를 받게 된다.
  - 참고: 관련 spec 표 갭(`spec/5-system/15-chat-channel.md §5.4`)은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 developer 가 이미 planner 위임 항목으로 정확히 등재했다(자기-반증형 소정정 조건 1 미충족을 근거로 직접 수정하지 않음 — 타당한 판단). 그러나 **`content/docs/**` 는 `codebase/frontend/**` 하위라 developer 쓰기 권한 범위 안**이고, spec 표와 달리 이쪽은 별도로 등재되지 않았다.
  - 제안: `triggers.mdx`/`.en.mdx` Callout 에 방금 추가한 404 문장과 같은 패턴으로 "`:id` 가 UUID 형식이 아니면 400 `VALIDATION_ERROR` 가 떨어져요" 한 문장 추가. `telegram.mdx`/`.en.mdx` §6 "에러:"/"Errors:" 목록에도 `400 VALIDATION_ERROR (:id 가 UUID 형식이 아님)` 항목 추가. spec 표 항목과 별도로, 이 4개 MDX 는 developer 권한 안이므로 이번 PR 안에서 바로 닫을 수 있다.

- **[INFO]** `auth.controller.ts` 는 `auth-session-flow-change` trigger glob(`codebase/backend/src/modules/auth/**`)에 경로상 매칭되지만, 실제 diff 는 `switchWorkspace` 의 `@ApiParam` 에 `format: 'uuid'` 를 추가하는 **순수 문서(swagger) 주석 보강**뿐이다(diff 자체 주석: "런타임 축은 이미 있었다 — 순수 문서 보강"). 인증·권한·세션 **흐름**의 실질 변경이 없으므로 `07-workspace-and-team/` 페이지·e2e 동반 갱신 대상이 아니다 — 오탐 방지 차원에서 명시.

## 요약

매트릭스 21개 행 중 `backend-api-change` 1건이 매칭되었고, 그중 swagger jsdoc 축은 반영됐으나 user-guide MDX 축(2쌍 파일, 총 4개)이 이번 PR 이 새로 만든 `400 VALIDATION_ERROR` 분기를 반영하지 못해 WARNING 1건으로 판정한다. 나머지 매칭(`auth-session-flow-change`)은 문서 주석뿐이라 해당 없음(INFO 로 명시), `spec-defect-found` 성격의 두 스펙 갭(`15-chat-channel.md §5.4`, `swagger.md §5-4`)은 developer 가 이미 planner 위임 항목으로 올바르게 등재했다. i18n parity(ko/en dict), 신규 섹션 디렉토리 locale 등록, 신규 warningCode/errorCode → ko 매핑 누락에 해당하는 CRITICAL 항목은 없다(이 PR 은 기존 `VALIDATION_ERROR` enum 을 재사용했을 뿐 신규 코드를 발행하지 않았고, `rotateBotToken` 실패 UI 는 애초에 에러 코드를 읽지 않고 고정 문구를 표시하므로 이 변경으로 인한 신규 영문 노출도 없다).

## 위험도

LOW
