# 테스트(Testing) 리뷰

## 검증 방법

`git diff origin/main...HEAD --stat`로 실제 코드 diff 범위(8개 codebase 파일)를 먼저 확정하고,
프롬프트가 예산 초과로 생략한 3개 파일(`chat-channel.dispatcher.spec.ts`,
`execution-engine.service.spec.ts`, `execution-engine.service.ts`)은 `git diff origin/main...HEAD --
<path>`로 직접 열어 대조했다. 이 changeset 은 이미 4라운드(`14_01_46`→`17_15_21`→`18_00_11`→
`18_19_33`→`18_38_10`)의 코드 리뷰를 거쳤고, 그 다음 유일한 실질 변경은 최신 커밋
`ef4ff8d5d`(comment 정정 + `chat-channel.dispatcher.spec.ts` naming/dedup 리팩터) 하나뿐임을
`git log`로 확인했다. 과거 라운드의 주장(테스트 통과 수, typecheck ratchet, 정적 카운트 회귀
가드 수치)을 그대로 신뢰하지 않고 직접 재현했다:

- `pnpm --filter backend`가 아니라 `npx jest`로 관련 4개 스펙(`execution-engine.service.spec.ts`,
  `executions.service.spec.ts`, `executions-rerun.service.spec.ts`,
  `assert-row-array.spec.ts`)을 직접 실행 → **497 passed**(RESOLUTION.md 의 자기보고 수치와 일치).
- `chat-channel.dispatcher.spec.ts` 단독 실행 → **38 passed**(리팩터 후 회귀 없음 재확인).
- `python3 scripts/check-backend-typecheck-ratchet.py` 직접 실행 → **199건/38파일, baseline 과
  일치**(자기보고 수치와 일치).
- `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` 를 직접 열어
  `EXECUTION_RUN_QUEUE_DEFAULT_OPTS.attempts: 1`을 확인 — 이번 라운드에서 고친 주석
  ("재배달 없음, DLQ 모니터가 관측")이 실제 큐 설정과 일치함을 검증했다(이전 주석의 "BullMQ
  재배달로 자가 치유" 서술이 실제로 틀렸었다는 `consistency 18_50_06` 의 지적이 맞다).
- `recoverOrphanPendingExecutions`(§8 orphan pending backstop)를 직접 읽어, 새 주석이 언급하는
  "회수는 앱 재기동의 orphan-pending backstop 몫" 주장이 실제 구현(`queuedAt` 기준 cause-agnostic
  스캔)과 부합함을 확인했다.
- `chat-channel.dispatcher.spec.ts`에 `buildDispatcherForNull`/`makeDispatcherHarness` 잔존
  참조가 없음을 grep 으로 확인 — 리네이밍이 깨끗하다.
- `executions-rerun.service.spec.ts`의 신규 `execRepo.query = jest.fn(...)` 오버라이드가 최상위
  `beforeEach`(63행)에서 매 테스트 `execRepo`를 재생성하므로 다른 테스트로 누수되지 않음을 확인.

## 발견사항

CRITICAL/WARNING 급 발견 없음. 이번 라운드의 실질 diff(`ef4ff8d5d`)는 프로덕션 코드 변경이
`execution-engine.service.ts`의 **주석 정정**(런타임 로직 변경 없음)과
`chat-channel.dispatcher.spec.ts`의 **테스트 전용 리팩터**(헬퍼 리네이밍 + 캐스트 4곳 →
`callHandle()` 1곳 통합, pass-through 래퍼 제거)뿐이다. 테스트 로직·assertion·mock 배선은
바뀌지 않았고, 실행 결과(497/38 passed)도 직전 라운드와 동일해 회귀는 없다.

- **[INFO]** `admitExecutionOrDefer` throw 이후의 최종 회수 경로(§8 orphan pending backstop)를
  가리키는 주석이 이번 라운드에서 더 구체화됐지만(`admission throw → pending 좌초 →
  orphan-pending backstop 회수`), 이 두 지점을 잇는 통합 테스트는 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`의
    `runExecutionFromQueue` 내부, `admission = await this.admitExecutionOrDefer(...)` 를 감싼
    `try/catch` 블록 바로 위 주석(`orphan-pending backstop 몫이다.`로 끝나는 문단).
  - 상세: `admitExecutionOrDefer`가 `assertRowArray` 가드로 throw → 트랜잭션 롤백 → execution
    은 `pending`에 남는다는 것과, `recoverOrphanPendingExecutions`가 `queuedAt` 기준으로 오래된
    `pending` 행을 재기동 스캔에서 회수한다는 것은 각각 별도로 테스트돼 있다
    (`execution-engine.service.spec.ts`의 admission-throw 테스트, 그리고 §8 orphan pending
    backstop describe 블록). 하지만 "admission throw로 좌초한 execution이 실제로 그 스캔
    조건(`status=PENDING AND queuedAt < now - timeout`)을 만족해 회수된다"를 end-to-end 로
    잇는 테스트는 없다 — 다만 `recoverOrphanPendingExecutions` 자체가 원인(cap 초과 재큐
    소실 vs admission 가드 throw)을 구분하지 않는 범용 스캔이라, 새 코드가 그 계약을 깨는
    변경은 아니다.
  - 제안: 조치 불요로 판단(주석 문구만 바뀐 라운드라 새 프로덕션 로직이 없고, 백스톱은
    cause-agnostic 설계라 기존 §8 테스트가 이미 이 케이스를 구조적으로 커버한다). 다만 향후
    admission-throw 경로에 전용 통합 테스트를 추가한다면 두 지점을 명시적으로 연결하는 가치는
    있다.

## 회귀 테스트 유효성 재확인

- `it('admission 이 throw → routing release 후 그대로 재전파 + runExecution 미호출')`
  (`execution-engine.service.spec.ts`)의 주석에 있던 "삼키면 BullMQ 가 job 을 성공으로 보고
  재배달하지 않는다"는 서술은, 프로덕션 코드 주석이 "재배달은 애초에 없다(attempts:1)"로
  정정된 것과 **모순되지 않는다** — 두 주석 모두 "swallow 하면 job 이 success 로 잡혀
  `removeOnComplete`로 사라진다"는 동일한 실패 모드를 가리키고 있어, 이번 프로덕션 주석
  정정이 테스트 쪽 assertion 이나 그 근거를 stale 하게 만들지 않았다.
- 커밋 메시지가 주장하는 `isSubFilterNull` 삼항 반전 뮤테이션(2개 테스트 실패, 양방향 유지)은
  이번 세션에서 재실행하지 않았지만, 리팩터 후 `chat-channel.dispatcher.spec.ts` 38 passed 를
  직접 재확인했고 로그 레벨 분기 테스트 2건(`debug`/`warn` 양방향 단언)이 리팩터 전후로 구조
  변경 없이 그대로 남아 있어(단지 헬퍼 호출부만 `callHandle()`로 치환) 판별력이 유지된다고
  판단한다.

## 요약

이번 라운드(`19_08_48`)에서 실제로 검토 대상이 되는 변경분은 5라운드째 이어진 리뷰 체인의
마지막 커밋(`ef4ff8d5d`) 하나로, `execution-engine.service.ts`의 잘못된 근거 주석("BullMQ
재배달로 자가 치유")을 실제 큐 설정(`attempts:1`, 재배달 없음)에 맞게 정정하고,
`chat-channel.dispatcher.spec.ts`의 헬퍼 네이밍 통일 + 4곳 반복 캐스트를 `callHandle()` 헬퍼로
통합하는 순수 테스트 리팩터다. 두 변경 모두 프로덕션 로직·테스트 assertion 을 바꾸지 않았고,
관련 4개 스펙(497 tests)과 `chat-channel.dispatcher.spec.ts`(38 tests) 를 직접 실행해 전부
통과함을 확인했으며, typecheck ratchet(199/38)도 baseline 과 일치한다. 정정된 주석이 언급하는
"orphan-pending backstop" 연결 지점에 대해 전용 통합 테스트가 없다는 점을 INFO 로 기록했지만,
그 백스톱 자체가 원인 불문 범용 스캔으로 설계돼 있어 이번 diff 가 새로 연 커버리지 갭은 아니다.
5라운드에 걸쳐 동작→구조→문서로 수렴해 온 이 changeset 은 테스트 관점에서 추가로 열 CRITICAL/
WARNING 이 없다.

## 위험도

NONE
