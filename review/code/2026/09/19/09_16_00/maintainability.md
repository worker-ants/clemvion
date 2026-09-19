# 유지보수성(Maintainability) 리뷰

## 리뷰 범위에 대한 메모

이번 변경분에서 실질 코드는 엔티티 데코레이터 정정 6개 파일(`edge.entity.ts` · `integration-expiry-dispatch.entity.ts` ·
`node-execution.entity.ts` · `node.entity.ts` · `workflow-assistant-session.entity.ts` · `workspace.entity.ts`)과
e2e 가드 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 뿐이다. `plan/**`·`review/**`·`spec/**`
파일들은 계획·리뷰 산출물·스펙 문서로, "함수 길이·중첩·매직 넘버" 등 코드 유지보수성 관점이 적용되지 않아 이번
리뷰에서 제외했다(직전 라운드 `review/code/2026/09/19/08_54_39/maintainability.md` 와 같은 스코핑).

이 세션은 직전 라운드(08:54:39)의 WARNING 2건에 대한 fix 커밋(`6e18aa4d8`)을 반영한 재검토다. 실제로 두 건 다
해소를 확인했다:

- **W1(판정 골격 3중 반복)** → `reportMatch()` 헬퍼(현재 `entity-schema-declarations.e2e-spec.ts:101-114`)로
  통합되어 인덱스(332행)·유니크(347행)·CHECK(382행) 세 곳이 모두 이 함수를 호출한다. 판정 규칙이 바뀌어도 한
  곳만 고치면 된다.
- **W2(라벨 조립 인라인 삼항 중첩, 최대 240자)** → `describeDbIndex`/`describeIndexDecl`/`describeForeignKeyDecl`/
  `describeDbForeignKey`(55-95행) 순수 포맷 헬퍼로 분리되어, 현재 파일 전체에서 100자를 넘는 줄은 대부분
  JSDoc·SQL 리터럴·테스트 타이틀 문자열이고 조건부 접미사를 인라인 삼항으로 겹쳐 쌓은 표현식은 남아 있지 않다.

## 발견사항

- **[INFO]** 엔티티 6개 파일 — 데코레이터 정정이 일관된 패턴을 따른다
  - 위치: `codebase/backend/src/modules/edges/entities/edge.entity.ts:21`,
    `codebase/backend/src/modules/nodes/entities/node.entity.ts:24-27`,
    `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts:21-24`,
    `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:23-33`,
    `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:38-40`,
    `codebase/backend/src/modules/integrations/entities/integration-expiry-dispatch.entity.ts:17`
  - 상세: 여섯 곳 모두 "왜 이 이름·컬럼·조건인가"를 데코레이터 바로 위 주석에 남기고, 자동 이름이 붙는
    `@Unique`/`@Index` 는 이름을 생략한 이유를 명시했다. 제거된 `@Index('IDX_node_workflow_label', …)` 처럼
    더 이상 쓰지 않는 `Index` import 도 함께 정리되어(`node.entity.ts` import 목록) 죽은 import 가 남지 않았다.
    새로 지적할 결함 없음.

- **[INFO]** `@Index`·`@Unique` 판정을 한 `it` 블록에 담아 최대 5단계 중첩이 남아 있다 (직전 라운드에서 이미
  INFO 로 확인·비긴급 처리된 항목, 이번 fix 대상은 아니었다)
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:299-359`
    (`it('@Index · @Unique · unique: true — …')`)
  - 상세: `inRolledBackTx` 콜백 → `for (meta)` → `for (idx)` → `if (idx.where)` → `if (!normalized.ok)` 로
    5단계 중첩이며, 같은 `it` 안에서 인덱스 검사(306-339행)와 유니크 검사(340-354행) 두 책임을 함께 처리한다.
    `reportMatch` 추출로 판정 로직 자체의 중복은 사라졌지만, 이 구조적 중첩·이중 책임은 이번 커밋 범위 밖이라
    그대로다. 실패 시 라벨이 충분히 상세해 진단은 가능하므로 급하지 않다는 직전 판단은 유효하다.
  - 제안: (선택) 인덱스/유니크를 별도 `it` 로 쪼개면 실패 귀인이 테스트 이름 수준에서 바로 드러나고 중첩도
    한 단계 얕아진다. 지금 당장 손댈 필요는 없다.

- **[INFO]** `reportMatch` 헬퍼가 5개의 위치 인자를 받는다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:101-114` (정의),
    호출부 `:332`, `:347`, `:382`
  - 상세: `reportMatch(problems, label, matches, givenName, missing)` 순서로 호출부 3곳이 모두 인자 순서를
    맞춰야 한다. 지금은 호출부가 3곳뿐이고 각 호출이 짧아 실수 위험이 낮지만, 인자가 하나 더 늘면(예: 조건부
    허용 목록 추가) 순서 혼동 여지가 생긴다.
  - 제안: 필수는 아니나 인자가 늘어날 계획이 있다면 `{ label, matches, givenName, missing }` 객체 인자로
    바꾸는 편이 안전하다.

## 요약

이번 라운드는 직전 유지보수성 리뷰의 WARNING 2건(판정 골격 3중 반복, 인라인 삼항 중첩으로 인한 초장문 라벨)을
헬퍼 추출(`reportMatch`, `describe*` 포맷 함수군)로 실제 해소했음을 확인했다. 엔티티 6개 파일은 각 정정의
근거를 주석으로 바로 옆에 남겨 가독성·네이밍·일관성 모두 양호하고 새로 지적할 결함이 없다. 남은 것은 인덱스·
유니크 판정을 한 테스트에 담아 최대 5단계 중첩이 발생하는 구조적 특성뿐인데, 이는 직전 라운드에서 이미
"급하지 않음"으로 확인된 INFO 항목이라 이번 fix 범위에서 다루지 않은 것이 합리적이다. 문서류(`plan/**`·
`review/**`·`spec/**`)는 코드 유지보수성 관점 밖이라 평가에서 제외했다.

## 위험도
NONE
