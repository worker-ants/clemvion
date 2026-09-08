# 아키텍처(Architecture) 코드 리뷰

## 발견사항

- **[WARNING]** 형제 repo-guard 간 "감싸는 메서드/함수 이름을 찾는" AST 워커가 중복 구현되고 의미까지 갈라졌다 (응집도/DRY)
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:45`(`enclosingMethodName`) vs `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:195`(`enclosingName`)
  - 상세: 두 함수 모두 "이 노드를 감싸는 가장 가까운 메서드/함수 이름을 찾는다"는 동일한 책임을 각자 손으로 재구현한다. 그런데 fallback 규칙이 서로 다르게 갈라져 있다 — `user-entity-exposure-guard.ts` 의 `enclosingName` 은 메서드/함수/getter 가 없으면 **아무 변수 선언 이름으로나** fallback 하는 반면(`ts.isVariableDeclaration(cur) && ts.isIdentifier(cur.name)` 만 확인, 초기자가 함수인지는 보지 않음), 새로 추가된 `endpoint-path-conflict-wrap-guard.ts` 의 `enclosingMethodName` 은 변수/프로퍼티 선언을 **초기자가 화살표/함수 표현식일 때만** 이름으로 인정하고 그렇지 않으면 `<top-level>` 로 떨어진다. 새 가드 자신의 JSDoc(43번째 줄 주변)이 "첫 판이 `VariableDeclaration` 을 무조건 받아들여 저장소의 두 정답 사이트가 메서드 이름이 아니라 `saved` 로 키가 잡혔다"고 정확히 이 실패 사례를 설명하고 있다 — 즉 이번에 새로 고친 바로 그 결함 클래스가 형제 가드(`user-entity-exposure-guard.ts`)에는 **그대로 남아 있다.** 이 저장소는 이미 `codebase/backend/src/common/__test-utils__/source-scan.ts` 헤더에 "세 번째 가드가 생겨도 여기만 고치면 되도록 계산을 여기로 모은다"는 원칙을 명시하고 실제로 주석 스트리핑 로직을 그렇게 공유하고 있는데(그 파일이 인용하는 `00_54_01` testing WARNING 1 이 정확히 "한쪽만 하드닝하면 나머지에 같은 결함 클래스가 남는다"는 사례다), 이번 PR 은 그 원칙을 "감싸는 이름 찾기"라는 두 번째 반복 로직에는 적용하지 않았다.
  - 제안: `enclosingMethodName`/`enclosingName` 을 `source-scan.ts` 로 승격해 단일 구현으로 합친다. 이번 PR 이 이미 검증한 "초기자가 함수/화살표일 때만 변수 이름을 인정한다"는 더 안전한 규칙을 채택하면, 향후 세 번째 가드가 생겨도 이 자리만 고치면 된다. 최소한 지금 당장은 두 함수가 서로 다른 규칙을 쓰고 있다는 사실을 어느 한쪽 JSDoc 에서 교차 참조해 둘 것.

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명은 증상(이름 충돌)만 닫고, 근본 아키텍처 갭(백엔드/프런트엔드 사이 컴파일 타임 검증 없는 wire 계약)은 그대로 남는다
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts:70`(`export type WorkflowVersionDetailProjection`), `codebase/frontend/src/lib/api/workflows.ts`(동명 손-미러 `WorkflowVersionDetail`)
  - 상세: 두 선언은 여전히 형태가 다른 채(백엔드는 `creator` 3필드 고정+`createdAt: Date`, 프런트는 옵셔널/nullable+`createdAt: string`) 손으로 동기화해야 하는 독립 정의로 남는다. 이번 diff 는 이름을 갈라 grep 오판(한 세션 내 3라운드 연속 재발)만 막았을 뿐, 두 레이어가 공유 타입 패키지나 계약 검증 없이 "이름이 같으면 grep 이 같은 자리로 보여준다"는 취약한 결합 방식에 계속 의존한다는 사실 자체는 바뀌지 않는다. 다만 이는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 이미 스코프 밖으로 명시 결정한 사항이라 이번 diff 의 새로운 결함은 아니다.
  - 제안: 조치 불요(이미 인지·문서화·의도적 유예). 다음에 BE/FE wire 계약을 실제로 합칠 때 이번 결정 근거를 참조점으로 쓸 것.

- **[INFO]** 신규 가드의 리포지토리 식별이 정확한 프로퍼티 매칭이 아니라 부분 문자열 포함이다
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts:162`(`receiver.getText(sf).includes(TRIGGER_REPOSITORY)`)
  - 상세: `this.triggerRepository.save(...)` 뿐 아니라 예컨대 `this.someTriggerRepositoryWrapper.save(...)` 같은 receiver 텍스트에도 매치된다. `isPropertyAccessNamed()`(정확 이름 비교, 72번째 줄)를 `save` 판정에는 쓰면서 정작 리포지토리 판정에는 느슨한 `includes` 를 쓰는 비대칭이다. 다만 이 가드는 결과를 알려진 목록과 배열 동등성(`toEqual`)으로 단언하므로, 오탐이 생기면 새 항목이 목록에 없어 테스트가 실패해 사람이 검토하게 된다 — fail-safe 방향의 부정확함이라 즉각적 위험은 낮다.
  - 제안: 급하지 않음. `isPropertyAccessNamed(receiver, TRIGGER_REPOSITORY)` 형태로 좁히면 `save` 판정과 동일한 정확도 규율이 된다.

## 긍정적 관찰 (참고)

- `http-exception.filter.ts` 가 로컬 `isUniqueViolation`(`err instanceof QueryFailedError` 선요구)을 걷어내고 `common/db/pg-error.ts` 의 `isPostgresUniqueViolation` 을 쓰도록 바뀐 것은 SRP/DIP 관점에서 견고한 개선이다 — 전역 예외 필터가 더 이상 TypeORM 의 구체 클래스(`QueryFailedError`)에 의존하지 않고 구조적 타입(duck typing)만으로 판정하며, "postgres 에러 해석"이라는 단일 책임이 한 모듈로 수렴했다. `integration-oauth.service.ts` 의 손-작성 constraint 추출을 `pgErrorConstraint()` 로 교체한 것도 같은 방향의 SoT 재사용이다.
- `workspaces.service.ts` 의 `listMembers` 를 JS 단 매핑에서 DB `select` 투영으로 옮긴 것은 "어떤 컬럼이 안전한가"라는 결정을 올바른 레이어(데이터 접근 계층)로 재배치한 것이다 — 이미 `workflow-versions.service.ts.findOne` 이 세운 선례와 일관되며, 방어를 검출(런타임 매핑 감사)에서 강제(쿼리 레벨 차단)로 승격했다.
- 신규 `endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/`fixture.ts` 3분할 구조는 순수 스캔 로직과 소비 spec 을 분리하는 형제 가드(`user-entity-exposure-guard.ts`, `swagger-dto-contract-guard.ts`)의 관례를 그대로 따르고, `common/__test-utils__/source-scan.ts` 의 `collectTsFiles`/`toPosixRelative` 를 재사용해(자체 재구현하지 않고) 모듈 경계를 지켰다. `production-build-devdep.spec.ts` 의 `it.each` 파라미터화도 반복되던 테스트 블록의 중복을 줄이는 방향이다.
- 순환 의존성은 관찰되지 않았다 — `common/db/pg-error.ts` 는 독립 모듈이고, `filters`·`integrations`·`workspaces` 어느 쪽도 서로를 역참조하지 않는다.

## 요약

이번 diff 는 대부분 harness/테스트/문서 변경이며, 아키텍처에 실질적으로 영향을 주는 부분은 (1) postgres 에러 판정을 `pg-error.ts` SoT 로 통합한 것, (2) `listMembers` 의 방어를 DB 레이어로 승격한 것, (3) `WorkflowVersionDetail` 개명, (4) 신규 AST 정적 가드 세 갈래다. 앞의 두 개는 SRP/DIP/레이어 책임 배치 관점에서 명확한 개선이고, 순환 의존성이나 레이어 위반은 발견되지 않았다. 유일하게 구조적으로 지적할 만한 것은 신규 `endpoint-path-conflict-wrap-guard.ts` 가 형제 가드 `user-entity-exposure-guard.ts` 와 "감싸는 메서드 이름 찾기"라는 동일 책임을 각자 손으로 재구현하면서 fallback 규칙까지 갈라졌다는 점이다 — 저장소가 이미 이런 재발을 막기 위한 공유 유틸(`source-scan.ts`) 원칙을 세워 두었음에도 이번엔 적용되지 않았다. 타입 개명은 근본 갭(BE/FE 공유 wire 타입 부재)을 남긴 채 증상만 닫지만 이는 의도적으로 유예된 결정이라 새로운 결함은 아니다. Critical 급 발견사항은 없다.

## 위험도

LOW
