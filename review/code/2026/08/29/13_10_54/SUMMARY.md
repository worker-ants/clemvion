# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. 프로덕션 로직 변경은 0건이며, 실 변경은 §6.3.1(에러 래핑 보안 정책) C2 캐너리 강화 테스트 3건 추가 + `secret-resolver.service.ts` 주석 보강 + plan 문서 갱신뿐. 남은 지적은 전부 INFO 수준의 문서/헬퍼 중복이며 대부분 이미 plan 백로그에 추적 중. `maintainability`·`documentation` 두 reviewer 가 이 잔존 중복을 근거로 LOW 를 선택해 전체 위험도를 LOW 로 집계했다.

forced(router_safety) 화이트리스트 7개(`documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`) 전원의 결과가 정상 확보되었다 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성/테스트/문서화 | `captureThrown`(sync)/`captureRejected`(async) 캡처 헬퍼가 저장소의 기존 `__test-utils__` 공유 헬퍼 관례를 따르지 않고 두 spec 파일에 각각 독립 정의됨 (JSDoc 도 거의 동일 문장 복제) | `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts:20-34`, `codebase/backend/src/nodes/data/code/code.handler.spec.ts:9-24` | 조치 불요 — `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 "근거 서술 중복 정리 묶음" 항목으로 이미 추적 중. 다음에 이 자리를 만질 때 공용 `__test-utils__` 로 이관 권장 |
| 2 | 문서화/유지보수성 | "enumerable own key 를 축으로 쓰는 이유" 설명이 3곳(두 backend spec + 신규 `error-shape.spec.ts`)에 거의 동일 문장으로 중복됨. `code.handler.spec.ts` 는 참조만 해 중복을 피하는 선례가 있는데 신규 패키지 파일은 전문을 다시 씀 | `expression-resolver.service.spec.ts:178-181`, `code.handler.spec.ts:245-246`(참조만), `error-shape.spec.ts:19-22` | 조치 불요 — 같은 plan §2 항목이 세 곳을 명시적으로 포괄해 추적 중. 정리 시 `spec/5-system/3-error-handling.md` §6.3.1 Rationale 로 승격 후 전방 참조만 남기는 방향 권장 |
| 3 | 문서화 | `secret-resolver.service.ts:93` 의 "형제 3곳" 서술이 실제로는 4곳(`expression-resolver.service.ts`/`.spec.ts`, `code.handler.ts`/`.spec.ts`)임 | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:93` | 조치 불요 — plan §2 에 developer SKILL §수렴 예외 근거와 함께 미체크(`[ ]`) 상태로 정확히 등재돼 있음 |
| 4 | 유지보수성 | `it.each` fixture 튜플이 위치 기반 `string[]` 이라 두 번째·세 번째 칼럼(표현식/기대코드)이 뒤바뀌어도 TypeScript 가 컴파일 타임에 못 잡음 (런타임은 `cause.name`+`shape.code` 이중 판별로 안전함을 뮤테이션 M7/M8 로 실측 확인됨) | `expression-resolver.service.spec.ts:199-207` | 우선순위 낮음 — `%s` 대신 `$className` named substitution + 객체 리터럴 배열로 전환 권장 |
| 5 | 유지보수성 | `secret-resolver.service.ts::resolve()` catch 블록의 실행 코드는 2줄(`logger.error`+`throw`)뿐인데 판정 근거 주석이 약 24줄로 실행 코드보다 훨씬 김 | `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:81-108` | 조치 불요(정책 결정, 여러 라운드 검토됨) — §6.3.1 Rationale 승격 작업 시 함께 축약 권장 |
| 6 | 테스트 | `it.each` 의 `position === undefined || Number.isInteger(position)` disjunction — vacuous 아님을 소스 대조로 확인(syntax 만 정수 분기, 나머지 3종은 undefined 분기 실행). 다만 어느 fixture 가 어느 분기를 타는지 주석 없음 | `expression-resolver.service.spec.ts:226` | 조치 불요(현재 vacuous 아님 확인됨) — 향후 fixture 편집 시 분기 설명 주석 추가 권장 |
| 7 | 테스트 | `error-shape.spec.ts` 의 "1:1" 단언은 이름 매핑만 확인하고 `ErrorCode` 값의 상호 유일성(두 클래스가 같은 코드로 오매핑되는 경우)은 별도로 검사하지 않음 — 단, `it.each` 의 정확값 단언이 실질적으로 이를 커버해 위험 낮음 | `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts:73-77` | 조치 불요 |
| 8 | 보안 | C2 캐너리(3곳)가 "enumerable own key" 축만 고정 — 향후 `cause` 에 **non-enumerable** 속성으로 민감정보가 실리면 이 캐너리들이 잡지 못하는 사각지대 존재 | `expression-resolver.service.spec.ts:199-229`, `code.handler.spec.ts:252-260`, `error-shape.spec.ts:79-92` | 조치 불요 — plan §2 "`cause` 비노출 불변식의 계측 지점" 후속 항목으로 이미 추적 중. 계측 추가 시 `Object.getOwnPropertyNames` 축 병행 권장 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 프로덕션 로직 변경 없음. 에러 래핑 보안 정책(§6.3.1) 강제 캐너리 강화. non-enumerable 사각지대는 이미 plan 추적 중(INFO) |
| requirement | NONE | 이전 라운드가 지적한 커버리지 갭(4개 오류 주장 vs 3개 코드화 등)이 `it.each` 확장 + 전수 캐너리로 실측 해소됨(138/10 GREEN 직접 확인) |
| scope | NONE | 이번 라운드 실질 변경은 커밋 1건(`0718302bc`, 3개 파일)뿐이며 직전 라운드 지적사항에 정확히 대응. 스코프 이탈 없음 |
| side_effect | NONE | 캡처 헬퍼·신규 테스트는 순수 함수/읽기 전용. 전역 상태·env·시그니처·공개 API 변경 없음 |
| maintainability | LOW | 캡처 헬퍼 중복, enumerable 축 설명 3중 중복, `it.each` 정적 타입 안전성, `secret-resolver` 주석 비율 — 전부 INFO, 대부분 plan 추적 중 |
| testing | NONE | 이전 라운드 지적 커버리지 갭 전부 해소 확인(독립 뮤테이션 M13: `EXPECTED_CODE` 표 항목 제거 → RED 재현). 남은 것은 INFO뿐 |
| documentation | LOW | "실측 개수 서술 drift" 패턴(4라운드 반복)이 최종 상태에서 전부 해소 확인. 남은 3개 INFO(형제 3곳→4곳, enumerable 축 3중 중복, 캡처 헬퍼 JSDoc 중복)는 이미 plan §2 에 명시 추적 중 |

## 발견 없는 에이전트

security, requirement, scope, side_effect, testing (Critical/Warning 없음; INFO 는 위 표에 통합)

## 권장 조치사항

1. (낮은 우선순위, 급하지 않음) `plan/in-progress/deps-peer-gating-and-eslint10.md` §2 "근거 서술 중복 정리 묶음" 처리 시 — 캡처 헬퍼(`captureThrown`/`captureRejected`)를 공용 `__test-utils__` 로 이관하고, enumerable 축 설명을 `spec/5-system/3-error-handling.md` §6.3.1 Rationale 로 승격해 세 test 파일이 전방 참조만 남기도록 정리.
2. (낮은 우선순위) `secret-resolver.service.ts:93` "형제 3곳" → "형제 4곳" 정정 (`code.handler.ts`/`.spec.ts` 포함).
3. (낮은 우선순위) `error-shape.spec.ts` `it.each` fixture 를 named substitution(`$className`) + 객체 리터럴로 전환해 컬럼 순서 실수를 구조적으로 예방.
4. (선택) `cause` 비노출 불변식 계측 지점 추가 시 `Object.getOwnPropertyNames` 축도 함께 검사해 non-enumerable 사각지대를 닫는다 (plan §2 후속 항목).

이번 라운드에서 즉시 처리해야 할 Critical/Warning 은 없다 — 위 조치는 전부 다음 편집 라운드로 미뤄도 안전한 INFO 수준이며 대부분 이미 plan 에 등재되어 있다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명, 전원 router_safety 강제 포함)
  - **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` — forced 전원 결과 확보됨 (누락 없음)
  - **제외**: 7명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(테스트/주석/문서 전용)와 무관 |
  | architecture | router 판단상 이번 diff 와 무관 |
  | dependency | router 판단상 이번 diff 와 무관 |
  | database | router 판단상 이번 diff 와 무관 |
  | concurrency | router 판단상 이번 diff 와 무관 |
  | api_contract | router 판단상 이번 diff 와 무관 |
  | user_guide_sync | router 판단상 이번 diff 와 무관 |
