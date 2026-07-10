# 문서화(Documentation) Review — `variables.__*` 예약 prefix 3계층 강제

## 발견사항

- **[WARNING]** `execution-context.md` 원칙 5 — 도입부 문장이 이번 PR 이 rename 한 절 제목을 가리키는 stale forward-reference
  - 위치: `spec/conventions/execution-context.md:65`
  - 상세: "이 `__*` 는 **예약 prefix 네임스페이스**로 취급한다 — 사용자 변수는 `__` 를 쓰지 않는 것을 규약으로 한다(단, 아래 **"강제 갭"** 참조)." 이 줄은 이번 diff 의 편집 범위(`@@ -67,7 +67,11 @@`, 즉 67행부터) 밖이라 그대로 남았다. 그러나 이번 PR 이 정확히 그 "강제 갭 (잔여 리스크)" 절 제목을 **"강제 (3계층)"** + **"강제 범위 밖 (잔여 리스크)"** 로 rename 했다(`:70`, `:74`). `grep "강제 갭"` 결과 파일 전체에서 65행이 유일한 occurrence — 즉 "아래 '강제 갭' 참조" 가 더 이상 어떤 절 제목과도 일치하지 않는 dangling 텍스트 포인터가 됐다. 더 근본적으로, 이 문장 자체가 여전히 "예약은 규약(convention)일 뿐" 이라는 톤으로 읽혀 바로 아래 `:70` 에서 선언하는 "강제(3계층)" 사실과 어색하게 병존한다.
  - 제안: 65행을 "...규약으로 하며, 아래 **"강제 (3계층)"** 절이 이를 강제한다." 정도로 문구와 참조 라벨을 함께 갱신.

- **[WARNING]** 두 노드 spec 의 §5 preamble(§6 아님)이 이번 PR 이 고친 것과 같은 종류의 stale 서술을 남김 — "config 검증 실패는 pre-flight throw" 단정이 이제 부정확
  - 위치: `spec/4-nodes/1-logic/4-variable-declaration.md:95`, `spec/4-nodes/1-logic/5-variable-modification.md:101`
  - 상세: 이번 PR 의 핵심 문서 수정은 정확히 이 클래스의 문장 — "runtime 에러 포트를 갖지 않는다 / 모든 검증 실패는 pre-flight" — 를 §6 도입부에서 "대부분... 단 하나의 예외가 런타임"으로 고치는 것이었다(요청 컨텍스트가 명시한 대상). 그런데 같은 파일의 §5(출력 구조) preamble 은 손대지 않아 여전히 절대적 문구로 남았다: variable-declaration.md `"...§5.1 단일 케이스로 구성된다 (분기 / 에러 포트 없음 — config 검증 실패는 §6 pre-flight throw)."`, variable-modification.md `"...(별도 분기·에러 케이스 없음 — config 검증 실패는 §1 / §4 의 pre-flight throw)."` 두 문장 모두 이제 §6 바로 아래에 신설된 L2(`handler.execute`, 런타임 throw) 행과 모순된다 — "에러 포트 없음" 결론 자체는 여전히 맞지만(L2 도 별도 에러 포트를 만들지 않고 노드 실패로 이어지므로), 괄호 안의 근거("pre-flight throw")가 더 이상 전체를 대표하지 못한다. 같은 파일 안에서 §5 는 "전부 pre-flight" 라 하고 §6 은 "예외 있음"이라 하는 내부 불일치가 생겼다.
  - 제안: 두 줄의 괄호를 "config 검증 실패(pre-flight, 대부분) 또는 예약 이름 런타임 throw(§6 L2) — 어느 쪽도 별도 에러 포트로 분기하지 않는다" 식으로 §6 과 정렬.

- **[WARNING]** `plan/in-progress/node-output-redesign/{variable-declaration,variable-modification}.md` 의 코드 라인 인용이 이번 diff 로 stale 화됐으나 갱신되지 않음
  - 위치: `plan/in-progress/node-output-redesign/variable-declaration.md:89,111`, `plan/in-progress/node-output-redesign/variable-modification.md:102,103,131`
  - 상세: 두 문서는 "6차 갱신(2026-06-25)"에서 정확한 파일:라인 인용을 보증한 상태였다(예: `variable-declaration.schema.ts:117-128`→`warningRules`, `variable-modification.schema.ts:162-173`→`warningRules`, handler.ts `:24-34`→`validate()`). 이번 PR 이 두 schema.ts 의 `validateConfig` 루프에 `else if` 분기를 추가하고(각 3~5줄), 두 handler.ts 에 import 4줄 + `async` 전환 + 루프 내 가드 블록을 추가하면서 뒤따르는 모든 라인 번호가 밀렸다 — 실측 확인: `variable-declaration.schema.ts` 의 `warningRules` 는 이제 125행(문서 인용 117), `executionMetadata.kind` 는 118행(문서 인용 110); `variable-modification.schema.ts` 의 `warningRules` 는 170행(문서 인용 162); `variable-declaration.handler.ts` 의 `validate()` 는 28-38행(문서 인용 24-34). 이 두 plan 문서는 이번 PR 의 diff(파일 목록 1-23)에 포함되지 않아 그대로 stale 상태로 커밋된다. 이 저장소 자체의 사전 consistency-check 산출물(`review/consistency/2026/07/11/00_03_30/plan-coherence.md` — 이번 diff 의 파일 18)이 이미 동일 문제를 WARNING(W5)으로 지적했으나("코드 삽입으로 밀린다... 갱신 계획 필요"), 최종 diff 에는 반영되지 않았다.
  - 제안: 두 서브 문서에 "N차 갱신" 블록을 추가해 새 라인 번호(schema.ts 예약-이름 분기 위치 포함)로 정정하거나, 최소한 새 `else if` 분기의 존재와 하위 라인 이동을 한 줄로 명시.

- **[INFO]** 프론트엔드 유저 가이드(FieldTable)에 신규 `__` 제약이 문서화되지 않음 — "검토했음" 기록도 없음
  - 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx` (frontmatter `code:` 에 두 `*.schema.ts` 가 이미 등재됨)
  - 상세: `PROJECT.md` 의 `node-schema-change` 매트릭스 + `.claude/config/doc-sync-matrix.json` 의 glob(`codebase/backend/src/nodes/**`)이 이번 변경 대상 파일에 기계적으로 매치된다. 실제로 `logic.mdx` 의 FieldTable 은 `name`/`variable` 필드에 대해 신규 `__` 예약 prefix 제약을 전혀 언급하지 않는다. carousel `button.id` 의 `__item_` 선례도 동일하게 유저 가이드에 미문서화라 "저수준 예약 prefix 는 유저 가이드 비문서화 관행" 이라는 결론 자체는 기존 practice 와 정합적이나, 이번 PR 의 spec/CHANGELOG 어디에도 "매트릭스 검토 완료 — 갱신 불요(carousel 선례와 동일 관행)" 라는 한 줄 기록이 없다(grep 0건: `execution-context.md`/양쪽 노드 spec/`CHANGELOG.md` 전체). 이 저장소의 사전 consistency-check(파일 15, convention-compliance.md)가 정확히 이 점을 WARNING 으로 제안했지만("검토했다는 사실을 명시해야 한다") 최종 산출물에 반영되지 않았다.
  - 제안: `execution-context.md` 원칙 5 Rationale 또는 두 노드 spec `## Rationale` 에 "user-guide FieldTable 갱신 불요 — carousel `__item_` 선례와 동일하게 저수준 예약 prefix 는 비문서화" 한 줄 추가.

- **[INFO]** 소소한 문구 반복 오류 — "§variable-declaration §6" (§ 기호 중복, 파일명 앞에 § 사용)
  - 위치: `CHANGELOG.md:39`, `spec/conventions/execution-context.md:110`
  - 상세: 두 곳 모두 동일한 문구("이는 §variable-declaration §6 이 의도적으로 채택한...")를 쓴다. `§` 는 통상 숫자 섹션 앞에만 붙는데 여기서는 문서명("variable-declaration") 앞에도 붙어 있어 "§variable-declaration.md §6" 또는 그냥 "variable-declaration §6" 의도로 보이는 오타/서식 실수다. 기술적 정확성에는 영향 없으나 두 파일에 동일하게 반복돼 원본 카피가 그대로 전파된 흔적.
  - 제안: "variable-declaration.md §6" 또는 "§variable-declaration.md#6" 식으로 정정.

- **[INFO]** `isReservedVariableName` — 같은 파일의 형제 함수들과 달리 자체 JSDoc 한 줄이 없음
  - 위치: `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts` (export function `isReservedVariableName`)
  - 상세: 같은 파일의 `RESERVED_VARIABLE_PREFIX`/`RESERVED_VARIABLE_NAME_CODE`/`reservedVariableNameError`/`reservedVariableNameRuntimeError` 는 각각 최소 한 줄 JSDoc 을 보유하는데, 이 모듈의 가장 자주 소비되는 predicate(3개 소비처: `workflows.service.ts`, 두 `*.schema.ts`, 두 `*.handler.ts`)만 독자적 doc 이 없다. 모듈 상단 docblock 이 전체 설계를 설명하므로 이해에 지장은 없다.
  - 제안: `/** __ prefix 검사. `name` 이 string 이 아니면 false — 필수 여부는 별도 name-required 체크가 담당. */` 같은 한 줄 추가(선택).

- **[INFO]** `spec/conventions/execution-context.md` frontmatter `code:` 가 원칙 5 의 코드 SoT 로 본문에서 직접 링크하는 신규 공유 파일을 열거하지 않음
  - 위치: `spec/conventions/execution-context.md:4-7` (frontmatter) vs `:73` ("코드 SoT: [`reserved-variable-name.util.ts`](../../codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts)")
  - 상세: `spec-impl-evidence.md` §3 규약상 `status: implemented` 는 "code: ≥1 매치"만 요구하므로 빌드 가드(`spec-code-paths.test.ts`)는 기존 3개 경로(`node-handler.interface.ts` 등)만으로 통과하며 이 갭은 **non-blocking** 이다. 다만 본문이 명시적으로 "코드 SoT" 라 지칭하는 파일이 frontmatter 목록에는 없어, `code:` 목록만 보고 구현 위치를 추적하려는 독자에게는 완결성이 떨어진다.
  - 제안: frontmatter `code:` 배열에 `codebase/backend/src/nodes/logic/_shared/reserved-variable-name.util.ts` 한 줄 추가(선택, CI 비강제).

## 확인됨 (문제 없음)

- CHANGELOG "Breaking changes" 항목은 이 저장소의 기존 관례(`### Breaking changes` 서브섹션 + "영향받는 워크플로"/"조치" 서술, 예: `$helpers.base64` 케이스)와 형식이 일치하며, SoT 백링크(`execution-context.md` 원칙 5 · `3-error-handling.md §1.3` · 두 노드 spec `§6`)도 실제로 해당 절과 정확히 대응함을 직접 확인했다.
- `spec/5-system/3-error-handling.md` 의 신규 `RESERVED_VARIABLE_NAME` 행은 §1.3(유효성 검증 에러) 표에 정확히 위치하며, `INVALID_NODE_CONFIG:` prefix 관례(코드: `execution-engine.service.ts:5292`)와 실제로 일치한다.
- 두 노드 spec §6 표의 신규 두 행(L0+L1 결합 행, L2 행)과 `⚠ 예약 이름 3계층 강제` 콜아웃은 실제 구현(`workflows.service.ts` 의 `validateReservedVariableNames`, 두 schema.ts 의 `else if` 분기, 두 handler.ts 의 루프 내 throw)과 정확히 대응한다.
- 모든 `[execution-context 원칙 5](../../conventions/execution-context.md)` / `[execution-context 원칙 5](../conventions/execution-context.md)` 상대 경로는 각 문서 위치 기준으로 실제 파일에 정확히 resolve 된다(직접 계산·확인 완료). `reserved-variable-name.util.ts` 로의 `../../codebase/...` 링크도 기존 헤더 링크 패턴(`node-handler.interface.ts` 등)과 일치하며 실제 신규 파일을 정확히 가리킨다.
- `reserved-variable-name.util.ts` 모듈 docblock 은 3계층 설계·원칙4/5 스코프 구분·SoT 백링크를 모두 정확하고 상세하게 서술하며, 코드 구현과 100% 일치한다.
- `variable-declaration.handler.ts`/`variable-modification.handler.ts` 의 `async` 필수 사유 인라인 주석(동기 throw 가 `.catch()` 미체결 호출부에서 유실될 수 있다는 설명)은 기술적으로 정확하다.
- `workflows.service.ts` 의 `skipLegacyDataGates` rename + 갱신된 JSDoc("Currently guards the Manual Trigger parameter schema and the reserved `__` variable-name rule")은 `restoreVersion`/`importWorkflow` 의 실제 분기(легacy-data escape vs 항상 검증)와 정확히 일치한다. `validateReservedVariableNames` 의 `node.id ?? node.label` fallback 주석도 `ImportNodeDto` 에 `id` 필드가 없음을 직접 확인해 정확함을 검증했다.
- 각 테스트 파일의 L0/L1/L2 라벨 인라인 주석은 spec 문서·코드 주석과 용어가 일관되게 사용되어 추적성이 좋다.

## 요약

이번 PR 의 핵심 문서 임무 — 두 노드 spec §6 도입부의 "runtime 에러 포트 없음 / 모든 검증 실패는 pre-flight" 를 L2 런타임 throw 신설에 맞춰 정정하는 것 — 는 정확히 수행됐고, CHANGELOG·error-handling §1.3·execution-context 원칙 5·코드 인라인 주석까지 SoT 참조가 촘촘하고 실제 구현과 고도로 일치한다. 다만 같은 파일들 안에서 새 결함이 발견된다: (1) execution-context.md 가 스스로 rename 한 절 제목("강제 갭"→"강제(3계층)")을 앞선 문장의 forward-reference 는 여전히 옛 이름으로 가리키는 dangling 참조, (2) 두 노드 spec 의 §5 preamble 이 정확히 §6 에서 고친 것과 같은 종류의 "전부 pre-flight" 단정을 §5 에는 남겨 같은 파일 안에서 §5/§6 이 서로 모순, (3) 이 PR 의 라인 삽입으로 스스로 stale 화시킨 `plan/in-progress/node-output-redesign/` 서브 문서 2개(자기 저장소의 사전 consistency-check 가 이미 WARNING 으로 지적했던 사안)를 갱신하지 않고 커밋. 셋 다 사용자에게 위험을 주는 오정보는 아니지만("에러 포트 없음" 결론 자체는 맞음, 참조 대상도 여전히 유추 가능), "문서 갱신 시 정정 범위가 좁아 인접 서술이 stale 로 남는" 이번 PR 스스로가 고치려던 것과 동일한 클래스의 결함이라는 점에서 지적할 가치가 있다. 나머지는 INFO 급 문구·완결성 개선 여지.

## 위험도

MEDIUM

STATUS: DONE
