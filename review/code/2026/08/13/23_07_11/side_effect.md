# 부작용(Side Effect) 리뷰 결과

## 개요

이번 diff(누적: `8332d9a20`~`443dd91a6`)는 TypeORM 0.3.31+pg 가 `UPDATE`/`DELETE ... RETURNING`
에서 `[rows, rowCount]` 튜플을 돌려주는 실측 사실을 반영해, 이를 행 배열로 오인해 온 8개 지점
(execution-engine 2·knowledge-base 5·auth-oauth 1)을 신규 순수 함수 `updateReturningRows()`
로 통일 수정한다. 신규 헬퍼 자체는 전역 상태·env·네트워크·파일시스템 접근이 없는 순수 변환이고,
공개 함수 시그니처 변경도 없다. 이 라운드는 이전 두 라운드(`20_36_35`, `22_45_24`)의 side_effect
리뷰가 이미 지적한 항목(이벤트 발생 패턴 변화, 진단 메시지 컨텍스트 축소)이 실제로 조치됐는지
소스에서 직접 재검증했고, 그 과정에서 **리뷰 세션과 무관한 별도 프로세스가 공유 워크트리를
일시적으로 뮤테이션한 정황**을 관측했다.

## 발견사항

- **[WARNING]** 리뷰 도중 공유 워크트리에서 `updateExecutionStatus` 의 수정 핵심 라인이 일시적으로
  구버전(버그 재현) 상태로 관측됐다 — 이후 자체 복구됨, 커밋 diff 자체의 결함은 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `updateExecutionStatus` 함수, 커밋된 diff 기준 게이트 8549~8553 (`const persisted = updateReturningRows<{ id: string }>(updated, ...).length > 0;`)
  - 상세: 리뷰 중 `git status`/`git diff` 로 작업 트리를 직접 확인한 시점에, 이 파일이 unstaged
    수정 상태였고 그 diff 내용이 정확히 `22_45_24/RESOLUTION.md` 의 CRITICAL 1 절이 기록한
    **"가드는 남기고 의미만 되돌리는" 뮤턴트**(`const persisted = (updated as { id: string }[]).length > 0;`)
    와 문자 그대로 일치했다. 이 뮤턴트가 살아있는 동안엔 `updated` 가 `[rows, rowCount]` 튜플이므로
    `.length` 가 항상 2 → `persisted` 가 **항상 `true`** — 이 diff 전체가 고치려던 CRITICAL 버그가
    작업 트리에서 그대로 재현된 상태였다. 수십 초 뒤 재확인하니 `git status` 가 다시 clean 이었고
    커밋된 `updateReturningRows(...)` 형태로 돌아와 있었다 — 어떤 프로세스가 뮤테이션 테스트(혹은
    동일 세션의 다른 fan-out reviewer/스크립트)를 이 지점에 걸었다가 원복한 것으로 보인다. 이는
    이번 리뷰가 판정할 "diff" 자체의 결함이 아니라 **공유 worktree 환경의 동시 접근 위험**이다
    (사용자 메모: "병렬 리뷰어가 저장소를 뮤테이션해 서로를 오염시킨다" 와 동일 계열 — 이번엔
    관찰자가 유령을 쫓은 게 아니라 실제로 짧은 창에서 진짜 뮤턴트를 목격했다).
  - 제안: 코드 조치 불요(현재 상태는 clean, `git status --porcelain` 확인 완료 — 첨부 로그 없음이나
    본 리뷰 시점 재확인 결과 tracked 파일 변경 0건). 다만 이 세션과 동시에 같은 워크트리에 뮤테이션
    테스트/다른 sub-agent 가 접근하고 있었을 가능성이 있으므로, 이 diff 를 최종 커밋/push 하기
    직전에 `git status`/`git diff` 로 tracked 파일이 committed 상태와 정확히 일치하는지(즉 의도치
    않은 잔여 뮤턴트가 없는지) 한 번 더 확인할 것을 권고한다.

- **[INFO]** (기존 지적 재확인, 여전히 유효·의도됨) 이 diff 는 "지금까지 항상 한쪽으로만 평가되던
  분기"를 처음으로 실제로 갈리게 만든다 — 배포 시점 이벤트/응답 패턴 변화
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 게이트
    2946~2951(admission `return (updateReturningRows...).length === 1`), 게이트 8549~8553
    (`updateExecutionStatus` 의 `persisted`) / `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts`
    (CAS 락 두 곳) / `codebase/backend/src/modules/auth/auth-oauth.service.ts` 게이트 145~151
  - 상세: 수정 전엔 admission 게이트·`updateExecutionStatus` 의 `persisted`·KB CAS 락·OAuth state
    검증이 튜플의 `.length`(항상 2)를 보고 있어 각각 "영원히 거짓/참"이었다. 이번 수정으로 네
    분기가 프로덕션에서 **처음으로** 실제 DB 매치 여부를 반영해 갈린다 — `EXECUTION_STARTED` emit
    타이밍 변화, KB 동시 재추출/재임베딩이 처음으로 409 를 받음, 소셜 로그인이 처음으로 정상
    동작. 함수 시그니처는 그대로이나 호출자가 관측하는 **동작**(에러 발생 여부·이벤트 발생 여부)이
    배포 시점에 처음 달라진다는 점에서 부작용 리뷰 관점의 핵심 항목이다. 이미 plan 문서
    (`plan/in-progress/update-returning-tuple-shape.md`)와 RESOLUTION 두 건에 근거·e2e 재측정
    (4191ms→2242ms)이 기록돼 있다.
  - 제안: 조치 불요(의도된 결과, 이미 배포 후 관측 계획이 plan 에 등재됨) — 이전 두 라운드의 동일
    지적과 결론 동일.

- **[INFO]** `finalizeCancelledExecution` 은 여전히 `updateExecutionStatus` 의 반환값(`persisted`)을
  검사하지 않고 `emitCancellationEvent` 를 무조건 호출한다 — 이 diff 가 만든 새 코드는 아니지만
  이 fix 로 그 갭이 처음 실질화됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `finalizeCancelledExecution` (이번 diff hunk 밖 — 미변경 코드, 함수 JSDoc 이 "emit 은 반환값과
    무관하게 항상 발행한다" 라고 명시적으로 설계 의도를 밝히고 있음)
  - 상세: 형제 함수들(`failFirstSegmentSetup`, `finalizeFailedExecution`, 여러 `COMPLETED` 지점)은
    `persisted`/`completed` 를 검사해 이벤트를 게이팅하는데, `finalizeCancelledExecution` 만
    무조건 발행한다. 수정 전엔 `persisted` 가 버그로 항상 `true` 였으므로 이 누락이 무해했지만,
    이제 `persisted` 가 실제 의미를 갖게 되면서 동시 cancel 경합 시 CANCELLED 경로에 한해 종결
    이벤트 중복 발사 가능성이 이론상 열려 있다. 소스의 JSDoc(게이트 4770~4772 인근)이 "WAITING
    경로만 다른 지점이 emit 하므로 이 헬퍼가 유일한 알림 지점인 경우가 있어 항상 발행한다" 고
    설명하며 의도적 설계임을 밝히고 있고, plan 문서 후속 ②(`updateExecutionStatus` 트랜잭션화)가
    이 계열을 이 PR 뒤로 명시적으로 defer 해 두었다.
  - 제안: 이번 PR 범위 조치 불요(계획적 defer 재확인). 이전 라운드 지적과 동일 결론.

- **[INFO]** `auth-oauth.service.ts` 호출부만 `detail` 진단 인자를 넘기지 않는다 — KB 5곳은 이미
  이전 라운드(WARNING 3)에서 보강됐다
  - 위치: `codebase/backend/src/modules/auth/auth-oauth.service.ts` 게이트 145~151
    (`updateReturningRows<AuthOAuthState>(await this.dataSource.query(...))` — 두 번째 인자 없음)
  - 상세: `updateReturningRows` 의 선택적 `detail` 파라미터는 "배열이 아닐 때 로그만으로 지점을
    특정" 하기 위한 것(JSDoc). `execution-engine.service.ts` 2곳과 `knowledge-base.service.ts`
    5곳은 모두 `detail` 을 채웠지만(직접 grep 대조 확인) `auth-oauth.service.ts` 는 비어 있다.
    OAuth state 소비 실패는 그 자체로 드문 극단 상황(비배열 응답)이라 실질적 영향은 낮지만,
    일관성 관점에서 누락이다.
  - 제안: 필수는 아님 — 여력이 되면 `state` 앞 몇 글자 등으로 `detail` 을 채우는 것을 고려.

- **[INFO]** 신규/변경 코드에 새 전역 변수·env 읽기/쓰기·네트워크 호출 없음 — 확인
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts`(전체, 순수 함수),
    `codebase/backend/src/common/utils/update-returning-rows.spec.ts`(전체, `readFileSync` 읽기
    전용만 사용)
  - 상세: 신규 헬퍼는 부작용 없는 순수 변환이다. 구조적 가드 테스트의 `readFileSync` 호출들은
    전부 실제 존재하는 프로덕션 소스를 읽기 전용으로만 사용하며(쓰기·생성·삭제 없음), `process.env`
    접근·`fetch`/HTTP 호출도 diff 전체에서 발견되지 않았다.
  - 제안: 해당 없음.

- **[INFO]** 공개 시그니처 변경 없음 — `admitExecutionOrDefer`·`updateExecutionStatus`·
  `reExtractAll`·`reEmbedAll`·`retryFailedDocuments`·`handleCallback` 파라미터/반환 타입 불변
  - 위치: 각 함수 정의부(파일 5·7·9), 내부 지역 변수 타입만 `unknown` 으로 완화됨(게이트 2916,
    8511 등)
  - 상세: 바뀐 것은 함수 **내부** raw query 결과의 타입 주석뿐이며 호출자 계약은 그대로다.
  - 제안: 해당 없음.

## 요약

코드 자체가 도입하는 고전적 의미의 부작용(새 전역 변수, env 읽기/쓰기, 의도치 않은 네트워크 호출,
공개 시그니처 파괴, 쓰기성 파일시스템 접근)은 없다. 이 diff 의 본질적 부작용은 "4개월간 항상 한쪽
으로만 평가되던 분기(admission 게이트, `updateExecutionStatus` 종결-이벤트 가드, KB CAS 락, OAuth
state 검증)를 처음으로 실제로 갈리게 만드는" 것이며, 이는 의도된 버그 수정의 정상적 귀결이자 이전
두 라운드가 이미 상세히 문서화·검증한 사실이다. 이번 라운드에서 새로 확인한 것은 **리뷰 도중 공유
워크트리가 짧은 창에서 이 PR 이 고친 CRITICAL 버그를 정확히 재현하는 뮤턴트 상태로 관측됐다가
자체 복구된 사실**이다 — 코드 결함이 아니라 동시 접근 환경 위험 신호이므로, 최종 push 직전
`git status`/`git diff` 로 tracked 파일이 committed 상태와 정확히 일치하는지 한 번 더 확인할
것을 권고한다. 그 외 나머지 항목(사문화됐던 이벤트 분기 되살아남, `finalizeCancelledExecution`
의 defer 된 갭, auth-oauth 의 `detail` 누락)은 전부 INFO 수준으로 조치 불요이거나 이미 plan에
등재돼 있다.

## 위험도

MEDIUM
