# 부작용(Side Effect) 리뷰 결과

## 리뷰 범위

핵심 코드 변경 6개 파일(`git diff origin/main...HEAD -- codebase` 로 직접 대조):
`common/utils/update-returning-rows.ts`(신규) · `.spec.ts`(신규) ·
`modules/auth/auth-oauth.service.ts` · `.spec.ts` ·
`modules/execution-engine/execution-engine.service.ts` · `.spec.ts` ·
`modules/knowledge-base/knowledge-base.service.ts` · `.spec.ts` ·
`common/utils/assert-row-array.spec.ts`(구조 가드 갱신) ·
plan 문서 3건. 그 외 `review/code/**`·`review/consistency/**` 다수는 이전 라운드가 이미
남긴 리뷰 산출물이며 이번 diff 의 런타임 코드가 아니라 별도 부작용 분석 대상이 아니다.

## 발견사항

- **[INFO]** KB CAS 락이 이번 diff 로 처음 실제로 "거절" 동작을 하기 시작한다 — 배포
  시점에 과거 버그(같은 튜플 문제)로 인해 이미 `reembed_status`/`reextract_status =
  'in_progress'` 로 걸려 있는 KB 행이 있다면, 그 KB 에 대한 재추출/재임베딩 요청은
  이 diff 배포 직후부터 즉시 409 로 거절된다.
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` —
    `reEmbedAll`(재임베딩 CAS 락, `updateReturningRows(acquired, 'KB re-embed CAS 락, kb ${id}').length === 0` 분기),
    `reExtractAll`(재추출 CAS 락, 동형) (해당 hunk 는 프롬프트 diff 가 생략돼 게이트 번호
    없음 — 함수명으로 특정. `Read` 로 직접 대조함: `reEmbedAll` L708-765, `reExtractAll` L327-350 부근)
  - 상세: 수정 전에는 `acquired.length === 0`(튜플이라 항상 2)가 절대 참이 안 돼 CAS 락이
    한 번도 거절하지 않았다 — 즉 이미 `in_progress` 인 KB 에도 새 요청이 (버그 덕에) 계속
    통과했다. 이번 수정으로 그 관용(意図치 않은 escape hatch)이 사라지고 CAS 락이 설계대로
    엄격해진다. `reEmbedAll` 의 "빈 KB 즉시 idle 복귀" 분기도 같은 튜플 버그로 한 번도
    타지 않아, 문서 0건인 KB 가 재임베딩을 시도하면 `reembed_status` 가 `in_progress` 로
    좌초된 채 남을 수 있었다(코드 주석이 자인). 다행히 자체 복구 경로가 있다 —
    ① `document-embedding.processor.ts` 의 `maybeFinalizeKbBatch` 는 `NOT EXISTS (... IN
    (pending,processing))` 조건이라 문서 0건 KB 에는 즉시 참이 되어 job 이 완료/실패하는
    즉시 idle 로 되돌린다(직접 확인), ② 실제 문서가 있는 채로 좌초된 경우는
    `stuck-document-recovery.service.ts` 가 앱 **재부팅 시점**에 10분 이상 `processing`
    문서를 회수해 재큐잉한다. 다만 이 ② 는 부팅 트리거라, 앱을 재기동하지 않는 한 이미
    좌초된 KB 는 이번 diff 배포 이후 CAS 락에 의해 계속 409 로 막힌다(과거엔 이 상태에서도
    버그 덕에 재시도가 통과했다).
  - 제안: 배포 전에 `reembed_status`/`reextract_status = 'in_progress'` 인 행이 실제로
    남아 있는지 1회 조회하고, 남아 있다면 배포 직후 앱 재기동(또는 수동 idle 복구)을
    plan 의 "배포 후 관측" 체크리스트에 명시적으로 추가하는 것을 권장한다(현재 plan
    항목 (d) "KB 재추출/재임베딩 동시 요청이 처음으로 409 거부" 는 진짜 동시 요청만
    가정하고 있고, 이 "이미 좌초된 행" 케이스는 별도로 적혀 있지 않다).

- **[INFO]** `updateExecutionStatus` 의 반환값 `persisted` 가 이번 diff 로 처음 실제
  신호가 되며, 이 함수는 호출부가 11곳이다(시그니처 자체는 안 바뀜, 반환값의 실질 의미만
  바뀜).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8512`
    (`const updated: unknown = await this.executionRepository.query(`), `:8549-8553`
    (`updateReturningRows` 로 `persisted` 계산), `:8555`(`if (enteringRunning && persisted)`)
  - 상세: 수정 전엔 `updated.length > 0` 이 튜플이라 항상 참이었다 — 즉 `updateExecutionStatus`
    는 사실상 언제나 `true` 를 반환하는 함수였다. `grep -n "updateExecutionStatus("` 로
    확인한 11개 호출부(645, 2268, 2366, 2443, 2533, 3474, 4213, 4338, 4661, 4785, 4848행)
    전부가 이번 diff 이후 처음으로 `false` 를 실제로 받을 수 있다. 그중
    `retry-turn.service.ts` 경로는 `retry-turn.service.spec.ts:101` 이
    `jest.fn().mockResolvedValue(true)` 로 boundary 를 고정해 왔다는 사실이
    `plan/in-progress/retry-turn-terminal-guard.md` 에 이미 소급 정정 배너 + 미완료
    재검증 항목으로 등재돼 있어 별도 조치 불필요 — 교차 확인만 남긴다.
  - 제안: 없음(이미 plan 에 추적 중). 다른 8개 호출부(위 grep 라인)도 `persisted=false`
    를 실제로 다루는지 재검증 시 함께 확인 권장.

- **[INFO]** admission 경로의 `EXECUTION_STARTED` emit·`recordRunningSegmentStart` 호출이
  이번 diff 로 처음 실제 실행되기 시작한다(이벤트/콜백 관점).
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2913-2954`
    (`admitted` 계산 — `updateReturningRows<{ id: string }>(rows, ...).length === 1`),
    `:2954`(`if (admitted) {` 이하 `recordRunningSegmentStart`·`eventEmitter.emitExecution` 블록,
    diff 범위 밖이라 게이트 없음)
  - 상세: 수정 전엔 `rows.length === 1` 이 튜플이라 항상 거짓 → `admitted` 는 상수 `false`였고
    `if (admitted)` 블록 전체가 프로덕션에서 한 번도 실행되지 않았다(사문화). 이번 수정으로
    admission 이 정상 성공하면 그 블록이 처음으로 라이브가 되어 `EXECUTION_STARTED` 이벤트가
    이 경로에서 새로 발행되고 `recordRunningSegmentStart` 가 새로 호출된다. 이 이벤트를
    구독하는 외부 소비자(웹훅·알림)가 있다면 배포 직후 이벤트 발생 패턴·타이밍이 달라질 수
    있다.
  - 제안: 없음 — 이미 plan(`update-returning-tuple-shape.md` "배포 후 관측 (c)")에
    등재돼 있고 이번 수정의 의도된 결과다.

- **[INFO]** `updateReturningRows(result, detail)` 의 `detail` 인자는 선택이 아니라
  필수(타입에 `?` 없음)로 확정돼 있고, 실제 8개 호출부(execution-engine 2 · knowledge-base
  5 · auth-oauth 1) 전부 문자열을 채워 넘긴다 — 직접 grep 대조로 확인, 시그니처와 사용이
  어긋나는 곳 없음.
  - 위치: `codebase/backend/src/common/utils/update-returning-rows.ts` 함수 시그니처
    (`detail: string,` — 물음표 없음)
  - 상세/제안: 없음(문제 아님, 확인 목적의 기록).

- **[정보 없음]** 전역 변수 도입·환경 변수 읽기/쓰기·네트워크 호출·파일시스템 쓰기(런타임
  코드 경로)·기존 공개 함수 시그니처(파라미터/반환 타입) 파괴적 변경은 발견되지 않았다.
  `updateReturningRows` 는 순수 함수(부작용 없음, 예외만 던짐)이고, `common/utils/*.spec.ts`
  의 신규 구조적 가드는 `readFileSync` 로 **읽기만** 하며 파일을 쓰지 않는다. `.query()`
  호출부의 제네릭을 `unknown` 으로 바꾼 것은 컴파일 타임 타입 변경일 뿐 런타임 동작에
  영향이 없다(별도로 `rows`/`updated` 변수가 이후 재사용되는지 각 호출부를 직접 열어
  대조했고, 전부 `updateReturningRows` 호출 지점에서 즉시 소비되고 끝난다).

## 요약

핵심 변경(`updateReturningRows` 헬퍼 도입 + 8개 소비 지점 치환)은 새로운 전역 상태·환경
변수·네트워크·파일 부작용을 들여오지 않는 순수한 correctness 수정이다. 다만 이 수정이
"고치는" 대상 자체가 지금까지 **사문화돼 있던 방어·이벤트 로직**(KB CAS 락, admission
게이트, `updateExecutionStatus` 의 `persisted` 신호, `EXECUTION_STARTED`/
`recordRunningSegmentStart`)이라, 배포 시점에 그 로직들이 일제히 "처음으로 살아난다"는
의미의 행동 변화가 있다 — 이는 이 PR 이 의도한 결과이며 plan
(`plan/in-progress/update-returning-tuple-shape.md`)의 "배포 후 관측" 항목에 대부분
이미 명시돼 있다. 유일하게 plan 목록에 명시적으로 없는 각도는 "배포 시점에 이미
버그로 좌초된 KB 행이 있다면 이번 수정 직후 그 행에 대한 요청이 (기존엔 버그 덕에
통과하던 것이) 즉시 409 로 막히고, 앱 재부팅 전까지는 자동 복구되지 않을 수 있다"는
케이스다(자체 복구 경로가 대부분 커버하지만 완전하지는 않음). CRITICAL/WARNING 급
부작용은 발견되지 않았다.

## 위험도

LOW
