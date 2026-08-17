# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 이 PR 이 새로 넓힌 `inputData`/`outputData` 값-패턴 마스킹이, diff 범위 밖의 기존 프런트엔드 소비자(Re-run 모달 기본 상태, 에디터 "히스토리에서 불러오기")로 하여금 마스킹된 `***` 값을 실제 재실행 요청 바디에 그대로 담아 전송하게 만드는 **조용한 기능 회귀**를 낳는다. forced 화이트리스트(7명) 전원 결과 확보됨 — 강제 항목 미이행은 없다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Side Effect | 마스킹된 `inputData`/`outputData`를 "표시"가 아니라 "재실행 입력"으로 재사용하는 기존 프런트엔드 소비자(Re-run 모달 기본상태, 에디터 히스토리 불러오기)가 `***` 마스킹 값을 그대로 새 실행 요청에 제출 — 자동화가 실제로 다른(잘못된) 데이터로 재실행되는 기능적 회귀. `useOriginalInput` 초기값이 `false`(=편집 모드)라 모달을 열고 아무것도 안 건드려도 마스킹값이 제출됨. 이 회귀를 잡는 테스트도 없음(`rerun-modal.test.tsx` fixture 가 백엔드 마스킹 경로를 우회) | 백엔드(마스킹 신설): `codebase/backend/src/modules/executions/executions.service.ts:994-995,1058-1059,684,688`. 프런트(재사용 지점, diff 밖): `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/[executionId]/page.tsx:471`, `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx:466-471`, `codebase/frontend/src/components/executions/rerun-modal.tsx:177-180,279-286`(`useOriginalInput` 기본 `false`), `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:127-134`(`handleLoadFromHistory`) | (a) `useOriginalInput` 프런트 기본값을 `true`로 바꿔 백엔드 기본값과 대칭시키거나, (b) `inputOverride` 제출 전 마스크 마커(`***`/`[REDACTED]`) 잔존 시 제출 차단+경고, (c) 재실행 프리필 전용 비-마스킹 API(원본 소유자 전용) 분리. 최소한 `plan/in-progress/eia-fanout-and-internal-data-masking.md` 에 잔여 갭으로 등재해 이연 여부를 명시적으로 결정해야 함 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | Side Effect | WS 대기(waiting) 노드의 "버튼 재개" 경로에도 같은 구조의 위험이 있을 수 있음(확신도는 CRITICAL 항목보다 낮음 — 버튼 값이 자격증명 패턴에 걸릴 가능성이 상대적으로 낮음) | `codebase/backend/src/modules/websocket/websocket.service.ts`(`maskWireEnvelope`) → `codebase/frontend/src/components/editor/run-results/result-detail.tsx:1167`(`parseButtonConfig`) → `codebase/frontend/src/lib/stores/execution-store.ts:826`(`resumeFromButtons`) | CRITICAL 항목과 같은 근본원인(마스킹된 응답을 "표시"가 아닌 "재입력"으로 재사용하는 소비자 존재 여부) 기준으로 대기-재개 경로 전체 점검 권장 |
| 3 | Testing | `emitExecutionEvent` 값-마스킹 신규 테스트 2건이 형제(`emitNodeEvent`) 테스트와 달리 양성 단언(`toContain('***')`)을 빼먹어, "정상 마스킹"과 "필드 소실/undefined 회귀"를 구분 못함(부정 단언만으로는 둘 다 GREEN) | `codebase/backend/src/modules/websocket/websocket.service.spec.ts:1014-1021,1023-1032`(대조: `:989-1012` ①·②) | ①·②와 동형으로 `expect(...).toContain('***')` 한 줄씩 추가 |
| 4 | Testing | `BackgroundRunsService` 의 `inputData`/`outputData` 마스킹 신규 테스트에 `[REDACTED]` 마커 보존 캐너리가 없음 — 자매 표면(`ExecutionsService`)·유닛 테스트(`redact-stored-error.spec.ts`)에는 있음. 향후 이 호출부가 다른 마스킹 함수로 바뀌는 회귀를 못 잡음 | `codebase/backend/src/modules/executions/background-runs/background-runs.service.spec.ts:223-262`(대조: `executions.service.spec.ts` ⑥, `redact-stored-error.spec.ts` 캐너리) | `makeBodyNodeExec({ inputData: { headers: { authorization: '[REDACTED]', ... } } })` 형태 테스트 1건 추가(기존 fixture 재사용, 저비용) |
| 5 | Maintainability | 방금 승격한 `VALUE_MASK_MARKER` 상수(`'***'`)가 자기 파일의 write-site 두 곳(및 `redactSecrets`)에서 쓰이지 않고 하드코딩 `'***'` 리터럴이 잔존 — 이 PR이 `KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`에 대해 막으려던 "마커 불일치로 재마스킹 회귀"가 가장 많이 쓰이는 마커 하나에서는 여전히 열려 있음 | `codebase/backend/src/shared/utils/sanitize-error-message.ts:226`(depth 초과 분기), `:258`(credential-key 분기), `:71`(`redactSecrets`) — 정의는 `:118` | 세 지점을 `VALUE_MASK_MARKER` 로 교체. 캐너리 테스트도 리터럴 대신 상수 import 로 단언하면 향후 값 변경에도 정합성 유지 |
| 6 | Maintainability | 신설 `maskIfPresent` 헬퍼의 타입 시그니처가 실제 null 가능성을 숨김 — 파라미터/반환 타입 모두 `Record<string, unknown>`(non-null)이지만 본문은 실제로 `null` 을 받아 `null` 을 그대로 반환함. 이 파일이 다른 곳에서 반복 강조하는 "타입으로 null 가능성을 숨기지 않는다" 원칙과 반대 방향 | `codebase/backend/src/modules/executions/executions.service.ts:72-77` | 시그니처를 `Record<string, unknown> \| null` 로 명시하거나, 의도적으로 좁힌 이유를 JSDoc 에 남김 |
| 7 | Documentation / API 계약 | `NodeExecutionSummaryDto`(Swagger, `GET /api/executions/:id` 의 `nodeExecutions[]`)에 `inputData` 필드 선언 자체가 없음 — 이번 diff 가 같은 클래스의 형제 필드(`outputData`/`error`)에 마스킹 캐비엇을 추가하면서 나란히 있는 `inputData`만 빠뜨려, 런타임 응답(마스킹된 `inputData` 포함)과 공개 OpenAPI 계약이 어긋남. (requirement reviewer는 이 갭 자체가 이전 라운드부터 있던 선존 갭이라고 확인·INFO 로 재기록했으나, 이번 diff가 바로 이 클래스를 편집하며 형제 필드만 고쳐 한계비용이 낮은 채로 남아 있어 documentation reviewer는 WARNING 으로 판단 — 두 관점 모두 반영) | `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts:135-197`(`NodeExecutionSummaryDto`; `outputData`:182, `error`:196, `inputData` 없음) | `outputData`와 동형으로 `inputData` 필드 + 마스킹 캐비엇 JSDoc 추가(한계비용 낮음, 이 PR 안에서 닫기를 권장) |
| 8 | User Guide Sync | 백엔드 API 응답 마스킹 신설(§R17, `inputData`/`outputData` 값-패턴 마스킹)이 사용자가 화면(Run Results 드로어/전용 실행 내역 페이지)에서 실제로 보는 Input/Output JSON 값(`***`로 치환)에 직접 영향을 주는데, 이를 서술하는 유저 가이드가 갱신되지 않음 — 사용자가 정상 자격증명이 마스킹된 것을 버그(데이터 유실)로 오인할 수 있음 | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:71-72`, `run-results.en.mdx:60-61` (doc-sync-matrix `backend-api-change` row target (b) 미충족) | Input/Output 행 description 에 "자격증명으로 판별된 값은 `***`로 마스킹되어 표시될 수 있어요(DB 원문과 다를 수 있음)" 캐비엇 추가. plan 체크리스트(§B/§D)에도 등재 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 9 | Security | `llmCalls` `preserveKeys` 예외가 트리 depth 무관하게 동명 키 전체에 적용 — 워크플로 데이터에 우연히 `llmCalls` 라는 이름의 키가 있으면 그 하위 트리가 WS wire 채널에서 값-마스킹을 건너뜀. 단 fanout(외부)에서는 `stripExternalOnlyFields`가 이 필드를 통째로 제거하고, wire 수신 인구는 이 diff 이전에도 전체 payload 를 원문으로 받고 있었으므로 새로 여는 노출 표면 아님(순노출 감소 방향) | `codebase/backend/src/shared/utils/sanitize-error-message.ts:248`, `websocket.service.ts:79,387` | 조치 불요(설계 트레이드오프). 원한다면 `preserveKeys` 매칭을 depth===0(wire envelope 최상위)로 한정 — 우선순위 낮음 |
| 10 | Security | `execution:<id>` WS 채널 구독 인가가 role 을 검사하지 않아 수신 인구가 `GET /api/executions/:id` 와 동일(워크스페이스 멤버 전원, viewer 포함) — 기존 인가 모델의 재확인이며 이 diff 범위 밖 | `websocket.service.ts:372`, `execution-channel-authorizer.ts` | 없음 — 범위 밖, 참고용 기록 |
| 11 | Security | `SECRET_LEAK_PATTERNS` 에 bare `token=` 키워드가 없어 `token=sk-live-...` 형태가 값-마스킹을 통과할 수 있음 — 선존 패턴 자산, 이번 diff 결함 아님 | `sanitize-error-message.ts:37` | 없음 — 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재됨, 확장은 blast radius 커서 별도 라운드 권장 |
| 12 | Performance | WS emit 이 3-패스 마스킹 체인이 됐고 신규 값-패턴 패스(`deepRedactSecretsPreserving`)는 캐시를 의도적으로 미적용 — 다만 이 호출부는 매 emit 마다 top-level 객체 identity 가 새로워(seq/timestamp 재스프레드) 어차피 캐시가 히트할 수 없는 구조라 실질 비용 미미. 팀이 A/B 벤치마크(N=3000, +0.0142ms/emit)로 실측·수용 결정을 문서화했으나, 그 벤치마크는 "서로 다른 payload" 축이고 `SANITIZE_CACHE` 가 겨냥하는 "동일 top-level 객체 반복 재emit(ForEach)" 캐시-히트 우세 시나리오는 별도 미측정 | `websocket.service.ts:253-417`, `sanitize-error-message.ts:158-209` | 조치 불요. 프로덕션에서 대규모 ForEach fanout 지연이 관측되면 반복 payload identity 축으로 별도 벤치마크 권장 |
| 13 | Scope | 47개 변경 파일 중 25개가 `review/code/**`·`review/consistency/**` 산출물 — 저장소 표준 강제 워크플로(`/ai-review`+fix, `/consistency-check`)의 정규 산출물이며 scope 이탈 아님 | `review/code/2026/08/16/23_08_19/*`, `review/consistency/2026/08/16/{22_22_36,23_10_41}/*` | 조치 불요. PR 본문에 "코드 변경 13파일, 나머지는 표준 루프 산출물" 한 줄 명시 권장(비필수) |
| 14 | Scope | plan lifecycle 이동(`git mv`, 내용 변형 없음) + `nodeName`→`nodeLabel` spec drift 정정(이전 검토자가 "함께 정정" 명시적 권장)이 같은 커밋에 곁들여짐 | `plan/complete/eia-internal-rest-error-masking.md`, `spec/5-system/6-websocket-protocol.md` §4.1 | 조치 불요 — 둘 다 사유 명시됨 |
| 15 | Maintainability | `redactStoredErrorForResponse`/`redactStoredDataForResponse` 본문이 파라미터명만 다르고 동일 + "3필드 redact-and-assign" 3줄 블록이 3곳 반복 — 직전 라운드에서 이미 지적, `RESOLUTION.md` 가 "호출 여부 개별성을 지키기 위한 의도적 미조치"로 재확인 | `redact-stored-error.ts:28-35,66-71`, `executions.service.ts`, `background-runs.service.ts` | 없음(재확인된 기존 결정 유지) |
| 16 | Testing | `BackgroundRunsService` 의 `inputData`/`outputData` 에 "정상 데이터 무손상 + null 그대로 통과" 조합 테스트가 없음(`error` 필드에는 있는 대칭 테스트가 재현 안 됨) — 실질 위험은 낮음(공유 유틸 유닛테스트가 이미 보장) | `background-runs.service.spec.ts:269-` | 필수 아님, WARNING #4 조치 시 같은 자리에 곁들이면 저비용으로 대칭 확보 |
| 17 | Documentation | `CHANGELOG.md` 의 `12-webhook §5.3` 링크에 앵커 없음(같은 절을 가리키는 spec 본문 인용은 앵커-포함으로 통일됐으나 CHANGELOG는 기존에도 앵커 없는 관행) | `CHANGELOG.md` | 없음 — 국소 스타일 불일치, 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO 5건뿐 — 전부 기존 인가모델/선존 패턴 자산 또는 의도된 트레이드오프, 이 diff가 새로 연 노출 표면 없음(순노출 감소 방향) |
| performance | LOW | 3-패스 마스킹 체인, 캐시 미공유이나 실측상 실질 비용 미미. 반복 payload 캐시-히트 축은 미측정(INFO) |
| requirement | NONE | 직전 라운드 WARNING 8건 전부 코드/spec/테스트 대조로 재검증·반영 확인. 181 테스트 직접 실행 PASS |
| scope | LOW | 47개 중 기능코드 13개, 나머지는 표준 review-fix-consistency 산출물 — scope 이탈 없음 |
| side_effect | **CRITICAL** | 마스킹된 `inputData`가 재실행 입력으로 되먹임되는 기능 회귀(diff 밖 프런트 소비자) |
| maintainability | LOW | `VALUE_MASK_MARKER` 상수 부분 미적용 + `maskIfPresent` 타입 시그니처가 null 가능성 숨김 |
| testing | MEDIUM | 신규 테스트 비대칭 2건(양성 단언 누락, 마커 보존 캐너리 부재) — 직전 라운드 WARNING 2건은 잘 해소 |
| documentation | LOW | `NodeExecutionSummaryDto`에 `inputData` 필드 선언 누락 — 그 외 직전 라운드 지적 전부 반영 확인 |
| user_guide_sync | LOW | `run-results.mdx`/`.en.mdx` 에 마스킹 캐비엇 미반영 |

## 발견 없는 에이전트

없음 — 실행된 9명 전원 최소 INFO 이상 보고. (security/requirement 는 CRITICAL·WARNING 없이 NONE 위험도로 수렴)

## 권장 조치사항

1. **[최우선/CRITICAL]** Re-run 모달·에디터 히스토리 불러오기의 "마스킹된 값이 재실행 입력으로 되먹임"되는 회귀를 수정 — `useOriginalInput` 프런트 기본값 변경 또는 제출 전 마스크 마커 검사/차단. plan 에 잔여 갭으로 명시 등재.
2. WS 대기-재개(버튼) 경로에 같은 위험이 있는지 점검(WARNING #2).
3. `NodeExecutionSummaryDto` 에 `inputData` 필드 + 마스킹 캐비엇 추가(WARNING #7, 저비용).
4. `run-results.mdx`/`run-results.en.mdx` 에 마스킹 캐비엇 한 줄 추가(WARNING #8).
5. `VALUE_MASK_MARKER` 상수를 write-site 3곳(`sanitize-error-message.ts:226,258,71`)에 실제 적용(WARNING #5).
6. `maskIfPresent` 헬퍼 타입 시그니처에 `| null` 명시 또는 의도 주석 추가(WARNING #6).
7. `websocket.service.spec.ts` 의 `emitExecutionEvent` 마스킹 테스트 2건에 양성 단언(`toContain('***')`) 추가, `background-runs.service.spec.ts` 에 `[REDACTED]` 마커 보존 캐너리 1건 추가(WARNING #3·#4).

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(forced 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | architecture | 라우터 판단(세부 사유 미제공 — 이번 라운드 prompt 에 개별 skip reason 없음) |
  | dependency | 라우터 판단(세부 사유 미제공) |
  | database | 라우터 판단(세부 사유 미제공) |
  | concurrency | 라우터 판단(세부 사유 미제공) |
  | api_contract | 라우터 판단(세부 사유 미제공) |