# 동시성(Concurrency) 코드 리뷰

## 컨텍스트

이번 changeset 은 `ie-resume-turn-boundary-cancel.md`/`retry-turn-terminal-guard.md` C-4 처분 코드
(파일 1~11) 와, 그 코드에 대한 **직전 두 리뷰 라운드**(`review/code/2026/09/01/17_55_50`,
`18_13_45`)의 산출물 26개 파일을 새 파일로 함께 커밋한 것이다. 두 라운드 모두 자체 `concurrency.md`
가 이미 이 코드를 검토해 위험도 **LOW**(신규 CRITICAL/WARNING 없음)로 판정했다. 본 라운드는 그
판정을 독립적으로 재검증하는 세 번째 패스다 — 소스를 직접 `Read`/`grep` 로 열어 대조했다(저장소
쓰기 없음, `git status --short` 로 확인 불필요할 만큼 읽기 전용 조사만 수행).

## 발견사항

- **[INFO]** `assertLinkedTransitionApplied` 의 신규 catch 로그 문구가 "짝 row 가 non-terminal 로
  잔류할 수 있다"고 단정하지만, 그 catch 는 `markNodeCancelled` 내부의 **두 단계**(DB `save` 실패 /
  `emitNode` 실패)를 구분하지 않는다 — 후자만 실패한 경우 실제로는 row 가 이미 CANCELLED(terminal)
  로 커밋된 뒤라 로그 문구가 부정확해진다
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-436`
    (신규 `try { await this.driver.markNodeCancelled(...) } catch (err) { this.logger.error(...) }`),
    대조 대상 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4834-4863`
    (`markNodeCancelled` 구현 — `await this.nodeExecutionRepository.save(nodeExecution);` 후
    `await this.eventEmitter.emitNode(...)` 를 순차 await, 트랜잭션으로 묶여 있지 않음)
  - 상세: `markNodeCancelled` 는 원자적 단일 연산이 아니라 `save()` → `emitNode()` 두 개의 순차
    await 다(둘 다 실패 가능하고 이번 diff 가 새로 만든 것도 아니다 — plan 6차 라운드 INFO#2 가 이미
    "비원자 save 로 인한 크래시 창"으로 등재해 둔 기존 갭). 이번 diff 가 추가한 catch 는 이 두 단계
    중 **어느 쪽이 실패했는지 구분하지 않고** 동일한 문구("짝 NodeExecution ${nodeExec.id} 가
    non-terminal 로 잔류할 수 있다")를 남긴다. 그런데 `save()` 가 성공하고 `emitNode()` 만
    실패하는 경우(예: WS 브로드캐스트 인프라 장애) DB 행은 이미 CANCELLED(terminal)로 커밋돼
    있어 "non-terminal 로 잔류"라는 진단이 틀린다 — 다음 사람이 이 로그를 보고 "짝 row 가
    RUNNING 에 걸려 있을 것"이라 가정해 stalled-job recovery 를 찾아보지만, 실제로는 그냥
    이벤트 하나가 유실된 것뿐이다. 기능적 정합성(취소 분류 유지)에는 영향이 없고 순수 관측/진단
    정확도 문제라 WARNING 이 아닌 INFO 로 남긴다. 이 세부(save-vs-emit 실패 분기)는 앞선 두
    라운드의 concurrency/database 리뷰가 지적한 "DB 예외와 비-DB 예외를 구분하지 않는다"는
    관찰보다 한 단계 더 구체적이다.
  - 제안: 급하지 않음. 필요하면 `save()`/`emitNode()` 를 별도 try 로 나눠 "행 마킹 실패"와 "이벤트
    발행 실패"를 구분된 로그 문구로 남기는 것을 고려할 수 있다 — 지금은 두 실패 모두 "관측만 하고
    분류는 유지"라는 동일 처방이 적용되므로 기능적으로 급하지 않다.

- **[INFO]** `markNodeCancelled` 실패 흡수가 BullMQ 재시도를 통한 자가 치유 경로를 닫는다 —
  기존 두 라운드가 이미 지적·plan 이 수용한 트레이드오프, 신규 아님
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-436`
  - 상세: 마킹이 실패해도 `assertLinkedTransitionApplied` 는 항상 `ExecutionCancelledError` 로
    종결하므로(코드 직접 확인 — catch 안에 재-throw 없음, catch 블록을 빠져나오면 무조건 아래
    `throw new ExecutionCancelledError(...)` 로 진행), 상위 BullMQ worker 는 이를 "정상 취소
    종결"로 처리해 job 재시도가 발생하지 않는다. `plan/in-progress/ie-resume-turn-boundary-cancel.md`
    C-4 처분과 `#1259` 감사 로깅 실패의 판단 축을 그대로 따른 것으로 명시돼 있고, 두 선행 라운드
    concurrency 리뷰가 이미 동일 항목을 INFO 로 기록했다. 재확인만 하고 새로 카운트하지 않는다.
  - 제안: 조치 불요(문서화된 의도). 배포 후 잔류 non-terminal 짝 row 를 stalled-job recovery
    백스톱이 실제로 커버하는지 관측 권장(선행 라운드와 동일 제안).

- **[INFO]** `executeSync` timeout catch 의 `persisted` 반환값 소비는 순수 관측성 추가로, 기존
  guarded CAS UPDATE(`updateExecutionStatus`)의 원자성·락 로직을 바꾸지 않는다 — 직접 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4305-4330`
  - 상세: 이 블록 이후 `throw err;`(동일 catch, diff 밖)는 `persisted` 값과 무관하게 항상
    실행되므로 제어 흐름 분기는 추가되지 않았다. `updateExecutionStatus` 자체는 `TERMINAL_STATUSES`
    가드 + DB 조건부 UPDATE 로 이미 원자적 choke point 였고, 이번 diff 는 그 반환값(`false` =
    동시 cancel 이 이미 선점)을 형제 경로(`failFirstSegmentSetup`)와 동일하게 `logger.warn` 으로
    노출할 뿐이다. 새 레이스나 원자성 위반 없음.
  - 제안: 조치 불요.

- **[INFO]** `retry-turn.service.ts` 의 `prepareSuccessTermination`/`finalizeGuarded` 는 취소
  (CANCELLED) 경로와 성공(COMPLETED/FAILED) 경로에서 `error` 컬럼 처방이 의도적으로 비대칭이며,
  두 경로 모두 소스에서 직접 확인 — 원자성·ABA 회피 로직 자체는 이 diff 로 변경되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:583-709`
    (`finalizeGuarded` — CANCELLED 분기는 SET 절에서 `error` 를 제외하고 `COALESCE(finished_at,
    :new)` 로 DB 값을 재평가·되쓰기, COMPLETED/FAILED 분기는 무조건 새 값 SET), `:749-754`
    (`prepareSuccessTermination`, 신규 헬퍼 — `execution.error = null` 명시 대입), 호출부 `:781`
    (`completeRetryExecution`)·`:957` 근방(`resumeGraphAfterRetry` 자연 종결)
  - 상세: SELECT~UPDATE 사이 창을 앱 레벨 `??` 병합이 아니라 SQL `COALESCE` 로 DB 가 최종
    판정자가 되도록 하는 설계(4차 라운드부터 유지)는 이번 diff 로 변경되지 않았고, 두 성공
    종결 호출부(자연 종결·defensive fallback) 모두 `prepareSuccessTermination` 을 거쳐 동일하게
    `error=null` 을 세팅함을 직접 대조했다. guarded UPDATE 가 `affected=0`(동시 cancel 선점)이면
    `finalizeGuarded`/`driver.updateExecutionStatus` 양쪽 다 저장·emit 을 모두 skip 하므로,
    in-memory 에서 `error=null` 로 미리 mutate 해 둔 것이 DB 에 반영되지 않은 채 버려지는 것은
    안전하다(그 `execution` 객체는 함수 종료 후 더 참조되지 않음, 기존 `finishedAt`/`durationMs`
    선세팅과 동일한 리스크 등급).
  - 제안: 조치 불요.

- **[INFO]** `retryLastTurn` 의 원자 consume(`jsonb_exists` CAS 가드 + JSONB `-` 키 제거,
  동일 `dataSource.transaction` 안에서 spawn 과 결합)은 이번 diff 로 로직이 바뀌지 않았고,
  신규 테스트로 최초로 SQL 형태 자체가 고정됐다 — 소스(`:213-244`) 직접 확인
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:213-244`, 신규 테스트
    `retry-turn.service.spec.ts` "원자 consume 이 jsonb_exists 가드와 JSONB 키 제거로 구성된다"
  - 상세: 트랜잭션 안에서 원자 UPDATE(`affected` 로 동시 retry 차단)와 `manager.create`/저장이
    같은 매니저로 묶여 부분 커밋 위험이 없다. 이번 diff 는 mock query-builder 가 `set`/`andWhere`
    인자를 실제로 포착하도록 고쳐 `jsonb_exists` 가드 제거 뮤턴트가 RED 로 떨어짐을 새로
    확인했을 뿐(plan 이 "가드를 지워도 46개 테스트 전부 GREEN 이었다"고 실측한 회귀 감지력 갭을
    닫은 것) — SQL·트랜잭션 구조 자체의 변경은 없다.
  - 제안: 조치 불요. 실 Postgres 상의 `jsonb_exists`/`-` 연산자 유효성은 unit(mock 경계) 레벨에서
    원리적으로 검증 불가하며, plan 에 이미 e2e 인프라 필요 사유로 유예 등재돼 있다.

## 요약

이번 changeset(코드 5건 + 관련 spec 3건 + 엔티티 타입 정정 1건, 그리고 그 위에 직전 두 리뷰
라운드 산출물 26개 신규 파일 커밋)을 세 번째로 독립 검토한 결과, 기존 동시성 방어 기전 —
`FOR UPDATE` 짝 전이 잠금, guarded status-CAS `updateExecutionStatus`/`finalizeGuarded`,
`jsonb_exists` 원자 consume 가드, CANCELLED 분기의 `COALESCE` 기반 ABA 회피 — 는 모두 그대로
보존되며 이번 diff 가 새로 도입한 락/뮤텍스/원자성 위반이나 경쟁 조건은 발견되지 않았다.
`assertLinkedTransitionApplied`(취소 마킹 실패 흡수)와 `executeSync` timeout(반환값 로깅)의
두 실질 변경은 각각 "분류 정확성 우선"(문서화·수용된 트레이드오프)과 "순수 관측성 추가"(제어
흐름 불변)로, `retry-turn.service.ts` 의 헬퍼 추출·`error` null 처리는 순수 리팩터 + 데이터
정합성 개선이다. 새로 확인한 것은 하나뿐이다 — `markNodeCancelled` catch 의 진단 로그가
save 실패와 emit 실패를 구분하지 않아 emit-only 실패 시 "non-terminal 잔류" 문구가 부정확해질
수 있다는 것(INFO, 기능 영향 없음). 두 선행 라운드가 이미 짚은 항목들(BullMQ 자가 치유 경로 차단,
catch 범위가 DB/비-DB 예외를 구분하지 않음)은 재확인만 했고 새 카운트로 잡지 않았다.
CRITICAL/WARNING 급 동시성 결함은 이번 라운드에서도 발견하지 못했다.

## 위험도

LOW
