# 유지보수성(Maintainability) 리뷰

## 검토 범위

실제 코드 변경은 6개 TS 파일이다 — 신규 repo-guard 쌍(`trigger-secret-columns-guard.ts` +
`trigger-secret-columns.spec.ts`), 기존 `trigger-workflow-ref.spec.ts` 의 주석 표기 정리(원문자
→아라비아 숫자, 자기수정 이력 문단 축약), 그리고 `chat-channel-trigger-create.e2e-spec.ts` ·
`schedule-trigger.e2e-spec.ts` · `trigger-workflow-ref.e2e-spec.ts` 세 e2e 파일의 소규모 추가
(주석 정정 + 기존 헬퍼 `expectTriggerWorkflowRef` 호출 3곳 삽입). 신규 코드는 이미 4라운드
(`fix(guards): 라운드 1~4`)의 자체 리뷰·수정을 거친 상태다. `plan/**`·`review/**` 나머지
파일들은 코드가 아니라 계획·리뷰 산출물이라 함수 길이·중첩·순환 복잡도 같은 코드 메트릭이
적용되지 않으며, 표·인용문 구조가 기존 저장소 관례를 그대로 따르고 있어 별도 지적사항 없음.

## 발견사항

- **[INFO]** `as`/`satisfies`/괄호 unwrap 루프가 형제 guard 와 거의 동일한 형태로 두 번째
  독립 구현됐다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns-guard.ts:68` (`const unwrap = (e: ts.Expression): ts.Expression => { ... }`)
    vs `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:208` (`function unwrap(expr: ts.Expression): ts.Expression { ... }`)
  - 상세: 두 guard 모두 `ts.isAsExpression` / `ts.isSatisfiesExpression` 을 벗기는 루프를 자체
    구현하고 있다. 차이는 `trigger-secret-columns-guard.ts` 가 괄호(`ts.isParenthesizedExpression`)까지
    벗기는 반면 `user-entity-exposure-guard.ts` 는 "괄호는 prettier 가 지워 fixture 로 관측 불가능"
    이라는 근거로 **의도적으로** 괄호 분기를 뺐다는 점이다(같은 파일 190~206행 JSDoc). 즉 두
    구현이 다른 이유는 실제 요구사항 차이(정본 파일은 prettier 정규화가 걸리지만, 새 guard 의
    괄호 테스트는 tmp 디렉터리에 직접 write 한 문자열이라 prettier 를 안 거친다)에서 비롯된
    합리적 발산이라 지금 당장 강제 통합할 근거는 약하다. 다만 세 번째 guard 가 같은 패턴을
    또 필요로 하면 두 벌의 서로 다른 근거를 다시 조사해야 하므로, 저장소가 이미 `common/__test-utils__/source-scan.ts` 같은 guard 공용 유틸 디렉터리를 갖고 있다는 점에서 `unwrapExpressionWrappers(expr, { includeParens })` 형태로 뽑아 두면 다음 guard 가 이 조사를 반복하지 않는다.
  - 제안: 지금 통합을 강제하지 말고(2건 규칙-of-3 미달, 저장소가 이미 "발산 축이 있으면 조기
    통합을 미룬다"는 선례를 갖고 있음 — `project_reaper_engine_dry_refactor_920`), 세 번째
    guard 가 같은 unwrap 을 요구하는 시점에 공용 유틸로 승격을 검토하도록 트래커에 짧게
    메모해 둘 가치는 있다. 차단 사유 아님.

- **[INFO]** 신규 spec 파일의 서술 밀도 — 어서션 코드 대비 서사적 주석(과거 리뷰 라운드 ID·
  뮤테이션 실측 인용)의 비중이 크다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/trigger-secret-columns.spec.ts` 전역(특히
    59~63행의 vacuity 경고 주석, 96~115행의 "분기↔대조군 대응표" JSDoc).
  - 상세: `/ai-review` 세션 ID(`review/code/2026/09/14/11_27_40` 등)를 코드 주석에 직접 인용하는
    패턴은, 이 저장소의 review 프로세스를 모르는 미래 독자에게는 맥락 없는 참조로 읽힐 수 있다.
    다만 이는 이 파일 하나의 새로운 스타일이 아니라 `trigger-workflow-ref.spec.ts` 를 포함해
    이미 저장소 전반에 확립된 관례(과거 회귀를 주석으로 고정해 재발을 막는 방식)이므로 이번
    변경이 일관성을 깨는 것은 아니다. 결함으로 등재하지 않음 — 참고용 관찰.
  - 제안: 없음(기존 관례 준수).

- **[INFO]** 나머지 코드 파일(3~6번)은 이전 라운드 리뷰에서 이미 검토된 형태와 동일하며
  (원문자→숫자 통일은 가독성 개선, e2e 3곳의 `expectTriggerWorkflowRef({ present: true, expectedWorkflowId })` 반복 호출은 같은 파일의 `assertMatchesContract` 반복 패턴과 일관), 이번 라운드에서
  새로 도입된 유지보수성 문제는 없다.

## 요약

핵심 신규 코드(`trigger-secret-columns-guard.ts`/`.spec.ts`)는 저장소의 기존 AST 기반
repo-guard 관례(`redis-fail-open-catalog-guard.ts`, `user-entity-exposure-guard.ts` 등)와
구조·네이밍·JSDoc 스타일이 잘 정렬되어 있고, 함수 길이·중첩 깊이·순환 복잡도 모두 낮아
개별 파일 단위로는 문제가 없다. 유일한 관찰 사항은 `as`/`satisfies`/괄호 unwrap 로직이
`user-entity-exposure-guard.ts` 와 거의 동일한 형태로 두 번째 독립 구현됐다는 점인데, 두
구현이 다른 이유(괄호 처리 여부)가 문서화된 실제 제약 차이에서 나온 것이라 지금 통합을
요구할 정도는 아니다(INFO). 이미 4라운드에 걸쳐 vacuity·분기-대조군 누락 등 테스트 품질
문제가 스스로 발견·수정된 상태라, 이번 라운드에서 새로 지적할 CRITICAL/WARNING 은 없다.

## 위험도

NONE
