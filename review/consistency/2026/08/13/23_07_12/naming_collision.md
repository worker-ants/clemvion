# 신규 식별자 충돌 검토

## 검토 범위 확인

`--impl-done` 모드, target scope=`spec/5-system/`, diff-base=`origin/main`.

`git diff origin/main...HEAD --name-only`(워킹트리 절대경로 기준) 을 직접 실행한 결과,
이번 diff 는 **`spec/` 하위 파일을 단 한 건도 변경하지 않는다**:

```
codebase/backend/src/common/utils/assert-row-array.spec.ts
codebase/backend/src/common/utils/update-returning-rows.spec.ts   (신규)
codebase/backend/src/common/utils/update-returning-rows.ts        (신규)
codebase/backend/src/modules/auth/auth-oauth.service.spec.ts
codebase/backend/src/modules/auth/auth-oauth.service.ts
codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts
codebase/backend/src/modules/execution-engine/execution-engine.service.ts
codebase/backend/src/modules/knowledge-base/knowledge-base.service.spec.ts
codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts
plan/in-progress/ie-resume-turn-boundary-cancel.md
plan/in-progress/update-returning-tuple-shape.md
review/code/**, review/consistency/** (이전 리뷰 세션 산출물 — 노이즈)
```

즉 이번 변경은 `UPDATE`/`DELETE ... RETURNING` 이 TypeORM 0.3.31 + pg 조합에서
`[rows, rowCount]` 튜플로 오는 것을 몰라 `admitExecutionOrDefer`(execution-engine),
`updateExecutionStatus`(execution-engine), KB CAS 락/재큐/reset(knowledge-base),
소셜 로그인 state 소비(auth-oauth) 총 8개 지점이 잘못 소비하던 **순수 코드 레벨 버그
수정**이다. 대상 plan 의 `spec_impact: none` 도 이를 뒷받침한다
(`plan/in-progress/update-returning-tuple-shape.md:8`).

`spec/5-system/` 자체에는 신규·변경된 요구사항 ID, 엔티티/DTO/인터페이스명, API
endpoint, 이벤트/메시지명, ENV var·config key, 신규 spec 파일 경로 중 어느 것도
없다 — 따라서 본 checker 의 6개 점검 관점이 대상으로 삼을 "target 이 새로 도입한
식별자" 자체가 이번 diff 에 존재하지 않는다.

## 참고로 확인한 신규 코드 식별자 (spec 범위 밖 — 참고용)

diff 가 도입하는 유일한 신규 식별자는 코드 레벨 유틸 함수
`updateReturningRows`(`codebase/backend/src/common/utils/update-returning-rows.ts`)다.
`spec/`, `plan/in-progress/`, `spec/conventions/` 전체를 대상으로
`grep -rn "updateReturningRows\|update-returning-rows"` 를 실행했을 때 매치되는
곳은 `plan/in-progress/update-returning-tuple-shape.md`(이 작업 자신의 plan) 뿐이며,
기존 문서 어디에도 동일/유사 이름이 다른 의미로 쓰이고 있지 않다. 같은 디렉터리의
기존 자매 헬퍼 `assert-row-array.ts` 와도 이름·역할이 겹치지 않고(코드 주석이
"SELECT → `assertRowArray`, UPDATE/DELETE → `updateReturningRows`" 로 분담을 명시),
파일 경로 컨벤션(`common/utils/<verb-noun>.ts`)도 기존과 일관된다. 이는 spec 문서가
아닌 코드 내부 유틸이라 본 checker 의 등급 기준(요구사항 ID/엔티티/endpoint/이벤트/
ENV/spec 파일 경로) 어디에도 해당하지 않으므로 findings 로 등재하지 않는다.

### 발견사항

없음.

### 요약

이번 diff 는 `spec/5-system/` 을 전혀 변경하지 않는 순수 백엔드 버그 수정(TypeORM
`UPDATE/DELETE RETURNING` 튜플 오소비 8곳 교정)이며, 신규 요구사항 ID·엔티티/타입명·
API endpoint·이벤트명·ENV/설정키·spec 파일 경로 어느 것도 새로 도입하지 않는다.
유일한 신규 식별자인 코드 유틸 함수 `updateReturningRows` 도 spec 코퍼스 전역에
동일/유사 이름의 선행 사용이 없어 충돌 소지가 없다. 신규 식별자 충돌 관점에서는
검토 대상 자체가 부재하다.

### 위험도

NONE
