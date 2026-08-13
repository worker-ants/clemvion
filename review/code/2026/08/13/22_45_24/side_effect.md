# 부작용(Side Effect) 리뷰 결과

## 개요

이번 diff 의 핵심은 TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE ... RETURNING` 에 대해 `[rows, rowCount]`
튜플을 돌려주는데 7곳(뒤에 auth-oauth 1곳 추가로 8곳)이 이를 행 배열로 오인해 `.length`/`[0]`/`.map`
을 직접 쓰던 결함을, 신규 순수 함수 `updateReturningRows()`(`codebase/backend/src/common/utils/update-returning-rows.ts`)
로 통일 수정한 것이다. 신규 함수 자체는 전역 상태·환경 변수·네트워크 호출이 없는 순수 변환이라
그 자체로는 부작용이 없다. 이 리뷰의 핵심은 **이 correctness fix 가 "지금까지 항상 같은 값만 내던
분기"를 실제로 갈리게 만든다**는 점 — 즉 코드 형태는 조용한 diff 지만, 배포 시점에는 이벤트 발생
패턴·외부 응답(409)이 프로덕션에서 처음으로 갈라지는 행동 변화가 뒤따른다.

## 발견사항

- **[WARNING]** 이벤트/콜백 발생이 "항상 한 방향"에서 "실제로 갈리는" 상태로 처음 바뀐다 — 배포 직후 이벤트 발생 패턴이 변한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — admission 판정 `return` 블록(게이트 2946~2951, `updateReturningRows<{ id: string }>(rows, ...).length === 1`) 및 `updateExecutionStatus` 의 `persisted` 계산(게이트 8549~8553). 이 값을 소비하는 호출부: `failFirstSegmentSetup`(`if (!persisted) { … return; }`, 실제 파일 기준 약 2366~2374행)·`finalizeFailedExecution`(약 4848~4859행, `EXECUTION_FAILED`/`execution_failed` 알림 전체를 게이팅)·여러 `COMPLETED` 종결 지점(약 2366/2533/3474/4661행, `if (completed) { emitExecution(EXECUTION_COMPLETED …) }`).
  - 상세: 수정 전에는 `rows.length === 1`(admission)과 `updated.length > 0`(`updateExecutionStatus`)이 튜플의 `.length`(항상 2)를 보고 있어서, admission 은 **영원히 실패**, `updateExecutionStatus`else 분기의 `persisted` 는 **영원히 true** 였다. 그 결과 `if (admitted) { recordRunningSegmentStart(...); EXECUTION_STARTED emit }` 블록과, "동시 cancel 이 이미 terminal 로 선점했으면 종결 이벤트를 내지 마라"는 위 호출부들의 `if (persisted/completed)` 가드가 **한 번도 실제로 갈린 적이 없었다**. 이번 수정으로 두 값이 실제 DB 매치 여부를 정확히 반영하게 되어, 이 가드들이 프로덕션에서 처음으로 실제 분기한다 — admission 정상 경로가 살아나(2s 지연 소멸, `EXECUTION_STARTED` emit 타이밍 변화) 크래시 복구(rehydration) 우회가 사라지고, 동시 cancel/종결 경합 시 `EXECUTION_FAILED`/`EXECUTION_COMPLETED`/종결 metrics 가 조건부로 스킵되는 경우가 처음 관측된다. 이 자체는 이 PR 이 의도한 정확한 결과이며, plan 문서(`plan/in-progress/update-returning-tuple-shape.md`)와 e2e 재측정(4191ms→2242ms)으로 뒷받침된다.
  - 제안: 조치 불요(의도된 결과) — 다만 RESOLUTION.md WARNING 8 이 이미 "관측 항목"으로 넘겼듯, 배포 직후 `EXECUTION_STARTED`/`EXECUTION_COMPLETED`/`EXECUTION_FAILED` emit 빈도·타이밍과 §8 active-running 타임아웃 baseline 을 모니터링할 것을 재확인 권고.

- **[WARNING]** CAS 락이 외부에 보이는 응답을 처음으로 바꾼다 — 동시 요청이 조용히 통과하던 것이 이제 409 로 거절된다
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:345`(`reExtractAll`, `if (updateReturningRows(acquired).length === 0)`), `:718`(`reEmbedAll`, 동일 패턴)
  - 상세: 수정 전 `acquired.length === 0` 은 튜플의 `.length`(항상 2)를 보고 있어 CAS 락이 **한 번도 거절하지 못했다** — 동시에 들어온 재추출/재임베딩 요청이 둘 다 통과했다. 이번 수정으로 두 번째 이후 동시 요청은 처음으로 `ConflictException(409, KB_REEXTRACT_IN_PROGRESS/KB_REEMBED_IN_PROGRESS)` 를 실제로 받게 된다. 함수 시그니처(파라미터·반환 타입)는 그대로지만, **호출자 입장에서 관측 가능한 응답(에러 발생 여부)이 배포 시점에 처음으로 달라지는** 인터페이스 동작 변화다.
  - 제안: 조치 불요(버그 수정 자체가 목적) — 다만 이 엔드포인트를 짧은 간격으로 재시도/폴링하는 프론트엔드·자동화 클라이언트가 있다면 배포 노트에 "동시 재추출/재임베딩 요청이 이제 409 로 거절될 수 있다"는 점을 공유할 가치가 있다(database.md 리뷰도 동일 지점을 지적).

- **[INFO]** `persisted` 게이팅 패턴이 형제 종결 헬퍼 중 한 곳(`finalizeCancelledExecution`)에는 적용되지 않은 채 남아 있다 — 이번 diff 범위 밖이지만, 이 fix 가 그 갭을 처음으로 실질화한다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `finalizeCancelledExecution`(실제 파일 기준 약 4777~4791행, 이번 diff 의 hunk 밖 — 미변경 코드)의 `await this.updateExecutionStatus(savedExecution, ExecutionStatus.CANCELLED);` 바로 다음 줄 `await this.emitCancellationEvent(...)`
  - 상세: 이번에 고친 `updateExecutionStatus` 의 반환값(`persisted`)을 실제로 검사해 이벤트를 게이팅하는 형제 함수들(`failFirstSegmentSetup`, `finalizeFailedExecution`, 여러 `COMPLETED` 지점)과 달리, `finalizeCancelledExecution` 은 반환값을 버리고 `emitCancellationEvent` 를 무조건 호출한다. 수정 전에는 `persisted` 가 항상 `true` 인 버그였으므로 이 누락된 체크가 실질적으로 아무 차이를 만들지 않았다. 이번 수정으로 `persisted` 가 실제 DB 매치 여부를 반영하게 된 지금, 동시 cancel 경합(예: 다른 경로가 먼저 terminal 로 옮긴 뒤 이 경로가 뒤늦게 CANCELLED 전이를 시도)이 발생하면 `updateExecutionStatus` 는 0행 매칭(`persisted=false`)을 정확히 반환하지만 `finalizeCancelledExecution` 은 그 값을 무시하고 `emitCancellationEvent` 를 그대로 발사한다 — 형제 함수들이 막아 온 "종결 이벤트 중복 발사" 클래스가 CANCELLED 경로에는 여전히 열려 있다는 뜻이다. 다만 이는 이번 diff 가 만든 새 코드가 아니라 **기존 코드의 사각지대가 이 fix 로 인해 처음 실질적으로 관측 가능해지는** 경우이며, plan 문서 후속 섹션의 "②(`updateExecutionStatus` 트랜잭션화)"가 명시적으로 이 계열을 이 PR 뒤로 미루기로 결정해 두었다.
  - 제안: 이 PR 범위에서 조치할 필요는 없음(계획적으로 후속 ②로 defer 됨을 재확인) — 다만 후속 ② 착수 시 `finalizeCancelledExecution` 도 `persisted` 게이팅 대상에 포함시킬 것을 명시적으로 스코프에 넣을 것을 권고한다(현재 plan 문서는 "`updateExecutionStatus` 트랜잭션화"라고만 적혀 있어 이 구체적 호출부 누락이 암묵적임).

- **[INFO]** `auth-oauth.service.ts` `handleCallback` — 상시 실패하던 실제 로그인 경로가 이번에 처음으로 정상 동작한다
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts:146~151`(`const consumed = updateReturningRows<AuthOAuthState>(await this.dataSource.query(...))`)
  - 상세: 수정 전에는 `consumed.length === 0` 이 영원히 거짓, `consumed[0]`(행 배열)의 `.provider` 가 영원히 `undefined` 라 **모든 정상 Google/GitHub 콜백이 `OAUTH_STATE_MISMATCH` 로 실패**했다(요구사항 리뷰가 별도 CRITICAL 로 지적한 지점과 동일 — 여기서는 부작용 관점으로만 기록). 부작용 관점에서 특기할 점: state 만료·재사용 거절(replay 방지) 로직도 이 fix 전에는 사실상 "항상 거절"이라는 다른 이유로 우연히 통과됐던 것이 아니라 **모든 콜백이 무조건 실패**해 이 로직 자체가 한 번도 실행 결과로 나타난 적이 없다. 이번 수정으로 정상 콜백 성공과 만료/재사용 거절 로직이 프로덕션에서 처음으로 동시에 살아난다. 신규 export·시그니처 변경은 없다(내부 로직 치환뿐).
  - 제안: 조치 불요(의도된 결과, requirement 리뷰가 CRITICAL 로 별도 추적 중).

- **[INFO]** `assertRowArray` 제거 지점에서 실패 시 진단 메시지 컨텍스트가 범용 메시지로 축소된다 (기능적 부작용 아님)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 게이트 2946~2951 인근(admission), 게이트 8549~8553 인근(`updateExecutionStatus`)
  - 상세: 제거된 `assertRowArray(rows, "admission UPDATE ... execution ${executionId} ...")` 류의 호출부-특화 메시지 대신, `updateReturningRows` 는 `UPDATE/DELETE RETURNING 결과가 배열이 아님 (typeof=${typeof result})` 라는 범용 메시지만 던진다(단, 두 호출부 모두 새 `detail` 파라미터로 실행 컨텍스트를 넘기고 있어 완전히 사라지지는 않았다 — `admission UPDATE, execution ${executionId} — 트랜잭션을 롤백한다`, `updateExecutionStatus, execution ${execution.id} → ${newStatus}`). throw 자체(=fail-loud, 트랜잭션 롤백 흐름)는 보존된다.
  - 제안: 조치 불요 — `detail` 파라미터로 이미 대부분 완화됐다.

- **[INFO]** 파일시스템·환경 변수·네트워크 호출 신규 부작용 없음 — 확인
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts`(전체), `codebase/backend/src/common/utils/update-returning-rows.spec.ts`(전체)
  - 상세: 신규 헬퍼는 순수 함수(전역 변수 접근·I/O 없음)다. 신규 spec 파일의 구조적 회귀 가드는 `readFileSync` 로 프로덕션 소스 6개 파일(`execution-engine.service.ts`, `knowledge-base.service.ts`, `auth-oauth.service.ts`, `stuck-document-recovery.service.ts`, `agent-memory-admin.service.ts`)을 읽지만 전부 읽기 전용이며 쓰기/생성/삭제가 없다. `process.env` 읽기·쓰기, `fetch`/HTTP 클라이언트 호출도 diff 전체에서 발견되지 않았다.
  - 제안: 해당 없음.

- **[INFO]** 기존 공개 함수 시그니처 변경 없음, 내부 타입 애너테이션만 `unknown` 으로 완화됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 게이트 2916(`m.query(...)` 제네릭 제거) / 8512(`const updated: unknown = ...`), `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` 게이트 336/711/728(`: unknown` 도입)
  - 상세: `admitExecutionOrDefer`·`updateExecutionStatus`·`reExtractAll`·`reEmbedAll`·`retryFailedDocuments` 의 외부 시그니처(파라미터·반환 타입)는 변경되지 않았다. 바뀐 것은 함수 **내부** 지역 변수의 타입 주석뿐이라 호출자에게 영향이 없다. 다만 `knowledge-base.service.ts:530`(embedding 재큐 지점)은 이번에 `unknown` 으로 정리되지 않고 여전히 `.query<{ id: string }[]>(...)` 로 남아 있다 — 실제 사용은 즉시 `updateReturningRows<{ id: string }>(rows)` 로 감싸져 있어(541행) 런타임 안전성엔 영향이 없음을 직접 대조 확인했다(documentation 리뷰가 이 지점을 문서 일관성 WARNING 으로 이미 지적).
  - 제안: 조치 불요(기능적 위험 없음, 문서 일관성은 다른 관점에서 이미 다룸).

## 요약

이번 diff 는 새 전역 변수·환경 변수 읽기/쓰기·의도치 않은 네트워크 호출·공개 시그니처 파괴를 도입하지 않는다. 신규 헬퍼(`updateReturningRows`)는 순수 함수이고, 새 테스트의 파일시스템 접근은 읽기 전용이다. 이 리뷰 관점에서 가장 중요한 사실은, 이 diff 가 "조용해 보이는" 코드 치환이지만 **그동안 한 방향으로만 평가되던 조건 분기(admission 게이트, KB CAS 락, 종결 이벤트 게이팅, OAuth state 검증)를 처음으로 실제로 갈리게 만드는 correctness fix** 라는 점이다 — 그 결과 배포 시점에 이벤트 발생 패턴(`EXECUTION_STARTED`/`EXECUTION_COMPLETED`/`EXECUTION_FAILED`)과 외부 응답(KB 409)이 프로덕션에서 처음으로 실측된다. 이는 의도된 버그 수정의 정상적 귀결이며 plan 문서·e2e 재측정으로 근거가 뒷받침되지만, "부작용" 관점에서는 명시적으로 짚어둘 가치가 있다. 추가로, 이번에 정확해진 `persisted` 게이팅 패턴이 형제 헬퍼 `finalizeCancelledExecution` 에는 아직 적용되지 않아, 동시 cancel 경합 시 종결 이벤트 중복 발사 클래스가 CANCELLED 경로에 한해 여전히 열려 있다는 점을 새로 확인했다 — 다만 이는 이 diff 의 파일 범위 밖 코드이고 plan 의 후속 ②로 이미 defer 대상임을 확인했다.

## 위험도

MEDIUM
