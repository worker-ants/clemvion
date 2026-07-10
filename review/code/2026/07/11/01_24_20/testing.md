# 테스트(Testing) 리뷰 — 재검토 (fresh re-review, commit `6e08fe425`)

대상: `variables.__*` 예약 네임스페이스 3계층 강제 PR (`d8ce7693f` 본체 + `6e08fe425` resolution fix).
직전 라운드(`review/code/2026/07/11/00_59_29/testing.md`)가 지적한 유일한 WARNING —
"`importWorkflow` 의 L0 게이트에 테스트가 전무하다" — 에 대해 이번 커밋이 추가한 2건의 신규 테스트를
집중 검증하고, 그 위에 diff 전체의 테스트 변경을 다시 훑었다.

## 검증 방법

정적 리딩에 그치지 않고 실제로 실행/변이(mutation)해 확인했다:

1. `ImportNodeDto` (`codebase/backend/src/modules/workflows/dto/import-workflow.dto.ts`) 정의를 직접
   읽어 **`id` 필드가 없음**을 확인 — "import 노드는 id 가 없어 label 로 폴백한다"는 테스트 전제가
   실제 타입과 일치하는지 소스에서 직접 검증.
2. `workflows.service.spec.ts` 상단 모듈 설정을 확인 — `service` 는 `Test.createTestingModule` 로 만든
   **진짜 `WorkflowsService` 인스턴스**이고 (`jest.mock` 호출 0건, 파일 전체 grep 확인), 목(mock) 대상은
   Repository/DataSource/`WorkflowVersionsService`/`NodeComponentRegistry`/`ModelConfigService`/
   `WorkspacesService` 뿐이다. `importWorkflow`/`validateReservedVariableNames` 자체는 어디서도 스텁되지
   않는다 — over-mocking 으로 인한 vacuous-pass 가능성 없음.
3. `importWorkflow` 소스(`workflows.service.ts:269-277`)를 확인 — `validateReservedVariableNames(dto.nodes)`
   가 `modelConfigService.findDefault` 호출·`dataSource.transaction` 진입보다 **먼저** 실행되므로, 신규
   테스트가 실패 케이스에서 그 이후 목(`mockTransactionManager` 등)에 의존하지 않아도 되는 것이 코드
   구조상 타당함을 확인.
4. **실제 jest 실행**: `pnpm`/root `jest` 로 대상 스펙만 필터 실행 →
   `Test Suites: 1 passed, Tests: 52 skipped, 7 passed, 59 total`(신규 2건 포함) — 그린 확인.
5. **Mutation #1** — `importWorkflow` 에서 `this.validateReservedVariableNames(dto.nodes);` 호출 라인을
   주석 처리 후 동일 필터로 재실행 → **정확히 신규 2건만 실패**(`Received promise resolved instead of
   rejected`, 나머지 5건은 그대로 통과). 원복 후 `git diff` 로 무변경 확인.
6. **Mutation #2 (label-fallback 전용)** — `validateReservedVariableNames` 의
   `const nodeRef = node.id ?? node.label ?? '';` 를 `node.id ?? ''` 로 좁혀 label 폴백만 제거하고 재실행 →
   **`falls back to the node label...` 테스트만 실패**하고, `offenders[0].node` 가 기대값 `"MyVarsNode"`
   대신 정확히 `""` 로 나온 diff 를 출력 — "이 테스트가 `node.id ?? node.label` 브랜치를 실제로 증명한다"는
   요청 검증 항목을 코드 레벨로 확정. 같은 필터 안의 첫 번째 reject 테스트는 이 변이에 영향받지 않고
   그대로 통과 — 두 테스트가 서로 다른 관심사(게이트 존재 여부 vs offender 식별자 소스)를 배타적으로
   검증하고 있음도 확인. 원복 후 `git diff` 무변경 확인.
7. **회귀 확인** — `workflows.service.spec.ts` + `reserved-variable-name.util.spec.ts` + 두 handler/schema
   spec 전부 재실행 → `6 suites / 188 tests` 전부 통과 (직전 라운드 186 + 신규 2 = 188, 정합).
   `git status --porcelain` 로 작업 트리에 잔여 변경 없음 확인.

## 신규 테스트 2건 상세 검증 결과

### (a) `rejects an imported variable node with a reserved "__" name` (`workflows.service.spec.ts:1184-1212`)

- 실제 `importWorkflow()` 를 호출하고 `rejects.toMatchObject({ response: expect.objectContaining({ code:
  'RESERVED_VARIABLE_NAME' }) })` 로 단언. `BadRequestException({ code, message, details })` 생성 시
  NestJS `HttpException.createBody` 가 객체 인자를 그대로 `this.response` 에 보존함을 확인했으므로(문자열/
  숫자/boolean 이 아닌 커스텀 객체는 그대로 pass-through), 이 단언 패턴은 실제 런타임 형태와 정확히 일치—
  같은 파일의 기존 `INVALID_TRIGGER_PARAMETERS` 케이스와 동일 관례.
- **확인됨**: 이 테스트는 실제로 `importWorkflow` 를 exercise 하며, mutation #1 로 게이트 제거 시 정확히
  이 테스트가 깨짐을 재현.

### (b) `falls back to the node label in import offender details (no id yet)` (`:1215-1255`)

- `variable_modification` 노드(`label: 'MyVarsNode'`, `id` 없음)로 `importWorkflow` 호출 →
  `details.offenders` 가 정확히 `[{ node: 'MyVarsNode', field: 'modifications[0].variable', name:
  '__dryRun' }]` 하나임을 (부분 매칭이 아닌 배열 전체 리터럴로) 단언.
- `ImportNodeDto` 에 `id` 필드가 없다는 것을 타입 정의에서 직접 확인했고, 같은 describe 블록의 다른
  기존 테스트(`remaps containerIndex to the new node UUID` 등)도 `id` 없이 `label` 만 준다는 것으로
  이 전제가 이미 이 파일의 관행과 일치함을 재확인.
- **확인됨 (mutation #2)**: label 폴백 자체를 제거하는 변이에서 이 테스트만 단독으로, 그것도 정확히
  `node` 필드 값(`"MyVarsNode"` → `""`)에서 실패 — "label 폴백을 증명한다"는 주장이 vacuous 하지 않고
  실제로 그 분기를 죽였을 때만 깨짐을 코드로 재현했다.
- 트리거 노드가 `id` 없이 `manual_trigger` 타입이라 검사 대상(`variable_declaration`/
  `variable_modification`)이 아니므로 offender 집계에 영향 없음 — 배열 길이 1 로 정확히 수렴하는 이유도
  코드로 확인.

두 테스트 모두 describe 레벨 `beforeEach`(`mockTransactionManager.*` 재설정)에 의존하지만, 게이트가
트랜잭션 진입 전에 throw 하므로 이 목들은 애초에 호출되지 않는다 — 목 의존이 우연히 정합할 뿐 실질적
결합은 없다. 테스트 간 상태 공유·순서 의존 없음(단독 `-t` 필터 실행으로 확인).

## 발견사항

- **[INFO]** 여러 노드에 걸친 offender 집계(cross-node aggregation)가 `importWorkflow` 경로에서도
  여전히 테스트되지 않음 — 직전 라운드 INFO 그대로 잔존
  - 위치: `workflows.service.ts` `validateReservedVariableNames` 의 `for (const node of nodes)` 루프
    (공유 `offenders` 배열) / `workflows.service.spec.ts` — `saveCanvas` 쪽엔 같은 노드 내부
    인덱스 집계 테스트(`:123-142`)가 있으나, `variable_declaration` + `variable_modification` 이 **같은
    그래프**에서 동시에 위반하는 케이스, 그리고 `importWorkflow` 경로에서의 다중 offender 케이스는
    saveCanvas·importWorkflow 어느 쪽에도 없다.
  - 상세: 로직이 단순 루프라 실패 위험은 낮고, 이번 resolution 커밋도 이 항목을 다루겠다고 약속한 적이
    없다(RESOLUTION.md W4 는 정확히 "importWorkflow reject + label 폴백"만 범위로 명시) — regression
    은 아니다. 다만 실사용자 워크플로는 두 로직 노드를 함께 두는 경우가 흔하므로 언급해 둔다.
  - 제안: `varNodeDto`/import DTO 헬퍼를 확장해 두 노드 타입이 동시에 위반하는 케이스 1건 추가(낮은
    우선순위, 선택).

- **[INFO]** L1 가드가 `handler.validate()` 를 통해서도 발동함을 별도로 고정하는 테스트는 여전히 없음
  - 위치: `*.schema.spec.ts` 는 순수함수 `validateVariable*Config()` 를 직접 호출하는 테스트만 있고,
    `*.handler.spec.ts` 의 `describe('validate', …)` 블록에는 reserved 케이스가 없다.
  - 상세: 배선(`validateConfig: validateVariableDeclarationConfig`)은 같은 파일의 기존 비-reserved
    `validate` 테스트가 이미 간접 exercise 하므로 위험은 낮음 — 직전 라운드와 동일 평가 유지.
  - 제안: 우선순위 낮음(중복 커버리지에 가까움), 시간이 되면 1줄 보강 권고.

- **[INFO]** 신규 2건은 `importWorkflow` 의 `label` 폴백만 커버 — `saveCanvas` 대칭에서 기대할 수 있는
  "정상 노드 + 예약 노드 혼합" 케이스(즉 `variables[0]` 정상 / `variables[1]` 예약, offender 가 인덱스로
  정확히 잡히는지)는 import 경로에서 재확인되지 않음
  - 상세: 이는 `saveCanvas` 쪽 `should report the offending node and field in the error details` 테스트
    (`:123-142`)가 이미 같은 공유 함수(`validateReservedVariableNames`)의 인덱스 로직을 커버하므로 실질
    커버리지 갭은 아니다 — `importWorkflow` 신규 2건은 "L0 게이트가 이 경로에서도 켜져 있다"는 존재
    증명과 "이 경로에서 `nodeRef` 소스가 다르다(label)"는 두 가지 고유 관심사만 목표로 좁힌 설계로,
    범위를 적절히 좁힌 것으로 판단(과잉이 아님). Critical/Warning 아님, 참고용 기록.

## 확인됨 (문제 없음)

- 두 신규 테스트는 실제 `WorkflowsService.importWorkflow()` 를 실행하며, 어떤 내부 메서드도 스텁되지
  않는다 — mock 은 저장소 경계(Repository/DataSource/외부 서비스)에만 있고 테스트 대상 로직에는 없다.
- `.rejects.toMatchObject({ response: expect.objectContaining({ code, details }) })` 패턴은 NestJS
  `HttpException` 내부 동작(커스텀 객체 인자를 `this.response` 에 그대로 보존)과 실측으로 대조해
  정확함을 확인했고, 같은 파일 기존 관례(트리거 파라미터 에러)와 일관된다.
- `ImportNodeDto` 에 `id` 필드가 실제로 없음을 타입 정의에서 직접 확인 — "id 없어 label 폴백" 주석/
  테스트 전제가 허구가 아니라 실제 타입 계약과 일치한다.
- Mutation 재현(#1: 게이트 제거, #2: 폴백 제거) 둘 다 각 테스트가 정확히 대응하는 실패로 반응 —
  vacuous test 아님을 코드 레벨로 확정.
- 전체 관련 스펙(6 suites / 188 tests) 재실행 그린 — resolution 커밋이 회귀를 만들지 않았음을 직접
  확인. 작업 트리도 원복 후 clean.
- 테스트 격리: describe-레벨 `beforeEach` 는 게이트 통과 이후에만 의미 있는 목이라 신규 실패-경로
  테스트와 우연한 결합만 있을 뿐 실질 의존이 없고, `-t` 필터 단독 실행으로 순서·상태 공유 문제 없음을
  확인.
- 가독성: 두 테스트 모두 "왜 이 케이스가 존재하는가"(legacy-data escape 부재, id 부재로 인한 label
  폴백)를 설명하는 한국어 인라인 주석을 갖고 있어 의도가 명확하다.

## 요약

직전 라운드가 지적한 유일한 WARNING — `importWorkflow` L0 게이트 무테스트 — 은 이번 `6e08fe425` 커밋이
추가한 2건으로 정확히 해소됐다. 정적 검토에 그치지 않고 (1) 실제 jest 실행으로 그린 확인, (2) L0 게이트
호출 자체를 제거하는 mutation 으로 신규 2건만 정확히 깨지는 것 확인, (3) `node.id ?? node.label` 폴백만
좁혀 제거하는 2차 mutation 으로 label-fallback 테스트가 정확히 그 브랜치(`node` 필드 값)에서만 깨지는
것을 확인해, "이 테스트들이 진짜로 대상 로직을 증명하는가"라는 요청 항목을 코드 레벨 증거로 확정했다.
over-mocking 은 없다 — 테스트 대상(`WorkflowsService.importWorkflow`/`validateReservedVariableNames`)는
전혀 스텁되지 않고 저장소 경계만 mock 되어 있어 실제 프로덕션 로직을 그대로 통과시킨다. 남은 갭은 모두
INFO 수준(cross-node 다중 offender 집계 미검증, `handler.validate()` 를 통한 L1 재확인 부재)으로, 이번
resolution 커밋이 다루기로 약속한 범위 밖이며 로직 단순성상 위험도 낮다 — 회귀 아님. 전체 관련 스펙
188개 재실행 결과 그린이며 작업 트리도 변경 없이 원복됨을 직접 확인했다.

## 위험도

LOW

STATUS: DONE
