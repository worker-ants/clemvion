# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** `updateExecutionStatus` 부작용(이벤트 emit) 변경의 "영향 있음" 소급 caveat 목록이 실제 소비 지점과 어긋난다 — `executeSync` timeout 항목은 반환값을 소비하지 않고(즉 이 수정으로 행동이 전혀 바뀌지 않음), 실제로 반환값을 소비해 `EXECUTION_COMPLETED` emit 여부를 가르는 4개 지점(`driveResumeAwaited`·`driveCallStackResume`·`driveStuckRedrive`·`runExecution`)이 목록에서 빠졌다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `executeSync` 의 timeout catch 블록(약 4209행, `await this.updateExecutionStatus(reloaded, ExecutionStatus.FAILED);` — 반환값 미할당, `try/catch` 는 throw 만 잡음) / 실제 소비 지점: `driveResumeAwaited`(약 2366~2376행 `const completed = ... if (completed) { emitExecution(EXECUTION_COMPLETED) }`), `driveCallStackResume`(약 2533~2542행, 동일 패턴), `driveStuckRedrive`(약 3470~3480행, 동일 패턴), `runExecution`(약 4657~4669행, 동일 패턴). caveat 원문은 `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:619` 와 `plan/in-progress/update-returning-tuple-shape.md:229-233`(동일 문구가 두 파일에 중복) 두 곳에 있다.
  - 상세: 이 PR 은 `updateExecutionStatus` 의 else 분기(`persisted`)가 `UPDATE … RETURNING` 튜플 버그로 인해 "항상 true" 였던 결함을 고친다 — 이제 진짜로 0/1 을 가른다. 그 결과 이 반환값을 소비해 `if (completed/persisted) { emit }` 로 분기하는 모든 호출부가 "이제 처음으로 emit-skip 분기가 탈 수 있다" 는 동일한 side effect 를 겪는다. caveat 표는 이 blast radius 를 "행 라벨이 아니라 소비 경로 단위로" 정밀하게 적자는 목적으로 두 plan 문서에 동일하게 등재됐는데(`update-returning-tuple-shape.md` §후속 [planner 위임] 5번째 항목 → `spec-update-node-cancellation-shutdown-classification.md` §추가 위임 표로 재수록), 실제 코드를 대조하면 4개 예시 중 `executeSync timeout` 은 반환값을 아예 안 읽어(이 else 분기 수정의 영향을 전혀 받지 않음) "영향 없음" 쪽에 더 가깝고, 반대로 진짜 영향권인 `driveResumeAwaited`/`driveCallStackResume`/`driveStuckRedrive`/`runExecution` 4곳은 목록에 없다. 이 caveat 는 앞으로 `spec/conventions/node-cancellation.md` §2.4 에 planner 가 그대로 옮겨 적을 예정인 문구라, 지금 정정하지 않으면 "검증됨/영향없음" 판정이 부정확한 채로 spec 에 소급 반영될 위험이 있다(같은 세션이 이미 한 번 "caveat 을 행 라벨 단위로 걸면 반대 방향 drift 를 만든다" 고 자체 지적하고서, 그 정정판 목록 자체에 다른 종류의 부정확함을 남긴 셈).
  - 제안: 두 plan 문서의 "영향 있음" 목록에서 `executeSync` timeout 을 빼거나 "영향 없음"(반환값 미소비) 쪽으로 옮기고, `driveResumeAwaited`·`driveCallStackResume`·`driveStuckRedrive`·`runExecution` 4곳을 "영향 있음"에 추가한다. spec 반영 전에 이 정정이 선행돼야 한다.

- **[INFO]** `updateReturningRows` 도입으로 `admitExecutionOrDefer`/`updateExecutionStatus`(else 분기) 의 실제 런타임 판정이 "항상 성공/항상 반영"에서 "실제 행 매치 여부"로 바뀌면서, 이전에는 사실상 죽어 있던 이벤트·메트릭 경로(`EXECUTION_STARTED` emit, `recordRunningSegmentStart`, admission 동시성 cap 실제 거부, KB CAS 락 실제 409, 빈 KB 즉시 idle 복귀)가 배포 후 처음으로 라이브된다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`(`admitExecutionOrDefer` 약 2913~2962행, `updateExecutionStatus` 약 8399~8556행) / `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`(CAS 락 두 곳 약 346행·729행, 빈 KB 즉시 idle 복귀 약 751행)
  - 상세: 순수 side-effect 관점에서는 "이벤트/콜백 발동 조건 변경"에 해당하는 실질적 변경이지만, 이미 `plan/in-progress/update-returning-tuple-shape.md` §후속 "배포 후 관측" 항목(a)~(e)에 정확히 이 다섯 가지(admission 지연 소멸·cap 첫 발동·`EXECUTION_STARTED` emit 패턴 변화·KB 409 첫 발생·소셜 로그인 회복)로 명시 등재돼 있고, (a)는 e2e 로 실측(4191→2242ms)까지 확인돼 있다. 은폐된 부작용이 아니라 disclose 된 의도적 수정이므로 별도 조치는 불필요 — 위 WARNING(caveat 목록 정확도)과 구분하기 위해 확인 기록으로만 남긴다.
  - 제안: 조치 불요. 배포 시 plan 의 "관측" 체크리스트를 그대로 따를 것.

- **[INFO]** 신규 헬퍼 `updateReturningRows`(`codebase/backend/src/common/utils/update-returning-rows.ts`)와 신규 구조적 회귀 가드 테스트(`update-returning-rows.spec.ts`)는 순수 함수·읽기 전용 `readFileSync` 뿐이라 전역 상태·환경변수·네트워크·파일시스템 쓰기 부작용이 없다. `auth-oauth-callback.e2e-spec.ts` 신규 e2e 는 `isOAuthStubModeAllowed()` 로 게이팅되는 stub 코드 경로만 태워 실제 Google/GitHub 외부 API 호출은 발생하지 않는다(`auth-oauth.service.ts` `exchangeCodeForToken`/`fetchProfile` 의 기존 stub 분기 재사용, 이 PR 이 새로 추가한 코드 아님).
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts`, `codebase/backend/test/auth-oauth-callback.e2e-spec.ts`
  - 상세: 확인만 — 새로운 외부 I/O 표면 없음.
  - 제안: 없음.

## 요약

이 diff 의 핵심은 `UPDATE/DELETE … RETURNING` 이 TypeORM+pg 에서 `[rows, rowCount]` 튜플을 돌려준다는 실제 shape 을 8개 소비 지점(auth-oauth 1·execution-engine 2·knowledge-base 5)에서 통일된 헬퍼(`updateReturningRows`)로 바로잡는 것이다. 헬퍼 자체와 신규 테스트는 순수하며 새 부작용 표면(전역 변수·env·파일시스템·네트워크)을 만들지 않는다. 다만 이 수정은 지금까지 조용히 죽어 있던 여러 이벤트/콜백 경로(`EXECUTION_STARTED` emit, admission cap 거부, KB CAS 락 409, 소셜 로그인 성공)를 처음으로 활성화하는 실질적 런타임 부작용을 동반하며, 이는 이미 plan 문서에 "배포 후 관측" 항목으로 상세히 disclose 돼 있어 은폐된 문제는 아니다. 다만 그 부작용의 정확한 범위를 기술하는 caveat 목록(두 plan 문서에 중복 등재, 향후 `spec/conventions/node-cancellation.md` §2.4 에 소급 반영 예정)이 실제 코드와 대조했을 때 부정확하다 — 반환값을 전혀 소비하지 않는 `executeSync` timeout 을 "영향 있음"으로 잘못 분류했고, 실제로 반환값을 소비해 이벤트 emit 여부를 가르는 4개 지점(`driveResumeAwaited`·`driveCallStackResume`·`driveStuckRedrive`·`runExecution`)이 빠져 있다. spec 반영 전 정정이 필요하다.

## 위험도

LOW
