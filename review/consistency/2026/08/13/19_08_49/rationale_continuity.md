# Rationale 연속성 Review

## 검토 범위 메모

target 프롬프트가 지정한 `spec/5-system/` 범위에는 이번 diff(`origin/main...HEAD`)로 인한 spec
문서 변경이 **없다** (`git diff origin/main...HEAD --stat -- spec/` 공집합 — 직전 라운드
`18_50_06` 과 동일 관찰). 프롬프트에 첨부된 "관련 Rationale 발췌" 번들(cafe24 통합·discord/
slack/telegram 트리거 채널·workflow-editor 실행 히스토리·observability·chat-channel
data-flow 등)은 실제 diff 가 손댄 파일과 겹치지 않아 해당 영역에서는 연속성 충돌이 원천적으로
발생할 수 없다 (diff 는 `codebase/backend/src/modules/execution-engine/`,
`codebase/backend/src/modules/executions/`, `codebase/backend/src/common/utils/
assert-row-array.ts`(신규), `codebase/backend/src/modules/chat-channel/*.spec.ts`(테스트만),
`plan/in-progress/**` 로 한정).

실제 코드 변경은 raw SQL(`EntityManager.query()`) 결과가 배열이 아닐 때 조용히 잘못된 값으로
degrade 하던 4개 지점을 `assertRowArray()` 헬퍼로 통일해 명시적으로 실패시키는 방어적 하드닝과,
그 중 admission-throw 재전파 catch 블록의 주석 정정이다. 따라서 본 검토는 이 diff 가
`spec/5-system/4-execution-engine.md`·`13-replay-rerun.md`·`14-external-interaction-api.md`
의 기존 Rationale·invariant 와 충돌하는지를 기준으로 수행했다.

## 직전 라운드(`18_50_06`) WARNING 의 처리 상태 — 확인 완료

`18_50_06` rationale_continuity 가 지적한 WARNING 1건 — admission-throw 재전파 catch 의 주석이
"BullMQ 재배달 시 재등록되므로 대개 자가 치유" 라고 적어, `execution-run` 큐의 `attempts:1`
설계(명시적 throw 는 재시도 없이 즉시 failed) 및 [§9.3 BullMQ 큐 목록](../../spec/5-system/4-execution-engine.md#93-bullmq-큐-목록)·[§Rationale "PR4 — BullMQ stalled 자동 재배달"](../../spec/5-system/4-execution-engine.md#rationale)과
모순되는 오서술이었다는 지적 — 은 커밋 `ef4ff8d5d`(`fix(engine): throw 의 근거가 틀렸다 —
attempts:1 이라 재배달은 없다`)로 **완전히 정정됨을 코드에서 직접 확인**했다
(`codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3671-3695`).

현재 HEAD 의 주석은 다음을 정확히 기술한다: (a) `execution-run` 큐 `attempts:1` → 명시적 throw
는 재배달되지 않고 job 이 즉시 `failed`; (b) 재배달은 `maxStalledCount`(워커 크래시 전용)의
별개 카운터; (c) 트랜잭션 롤백으로 execution 은 `pending` 에 남고 회수는 앱 재기동의
orphan-pending backstop(§Rationale "orphan pending backstop — recoverStuckExecutions
재사용") 몫; (d) 이전 오서술("자가 치유")과 정정 경위를 코드 주석 자체에 명시. 이는 근거를
사실에 맞춰 바꾼 것이지 코드 동작(throw 유지)이나 spec 의 기존 결정을 번복한 것이 아니므로
"결정의 무근거 번복"에 해당하지 않는다 — 오히려 이 리뷰 유형이 요구하는 "번복 시 새
Rationale 동반" 원칙을 사후 이행한 사례다.

## 나머지 3개 `assertRowArray` 지점 — Rationale 정합 확인

- **`lockNonTerminalExecutionRow`**(execution-engine.service.ts:8211 부근) — 트랜잭션 매니저
  내부 `FOR UPDATE` 조회. throw 시 롤백. §PR2b "동시성 cap admission gate" 의 TOCTOU 원자성
  원칙과 정합 — 판정을 바꾸지 않고 진단만 강화.
- **`updateExecutionStatus` else 분기**(execution-engine.service.ts:8502-8540) — 애플리케이션
  트랜잭션 밖의 단발 guarded UPDATE. throw 는 이미 커밋된 UPDATE 를 되돌리지 못하지만, [EIA
  §9.3 EIA-RL-04](../../spec/5-system/14-external-interaction-api.md#93-트랜잭션과-발송-순서-eia-rl-04)
  "commit 후에만 emit" 원칙을 **위반하지 않는다** — 가드는 emit 을 commit 이전으로 당기지
  않고, 오직 "emit 여부(=persisted)" 판정의 정확성만 조용한 오판(false negative → 종결 이벤트
  영구 유실)에서 명시적 실패로 바꾼다. 이 잔여 갭(트랜잭션 밖이라 롤백은 못 함)은
  `plan/in-progress/backend-lint-gate-broken-on-main.md` 의 "`updateExecutionStatus` else
  분기 트랜잭션화" 항목으로 **의식적으로 열어둔 채 추적**되고 있어 은폐된 상태가 아니다.
- **`computeChainDepth`**(executions.service.ts:317-332) — [RR-PL-05 "chain 깊이 32
  제한은 애플리케이션 레벨에서 enforce"](../../spec/5-system/13-replay-rerun.md#rr-pl-05--chain-추적-모델-e3)
  원칙을 강화. 종전엔 `rows[0]?.depth ?? 1` 이 non-array 응답 시 depth 1 로 조용히 접혀 32
  제한을 **우회**할 수 있는 fail-open 이었다 — 이번 가드는 그 우회 경로를 차단해 documented
  invariant 를 오히려 더 정확히 enforce 한다. 기각된 대안의 재도입이 아니다.

## 배제한 우려 — 재검토 결과 문제 없음

admission catch 의 재전파(swallow 하지 않고 throw)가 같은 함수의 자매 catch(`runExecution`
호출부, "삼켜서 이중 실행 방지")와 반대 전략을 쓰는 것은 그 자체로는 모순이 아니다 — 코드
주석이 "admission 단계는 아직 노드가 미실행이라 이중 실행 위험이 없다"는 구분 근거를 명시적으로
적어 뒀고(`18_50_06` RESOLUTION 이 요구한 바로 그 정정), 이는 두 분기 모두 자기 컨텍스트에
맞는 원칙(비멱등 노드 이중 실행 방지 vs 유실의 관측 가능성 확보)을 일관되게 따르는 것이지
근거 없는 자의적 분기가 아니다.

## 요약

이번 라운드 diff 는 `spec/5-system/` 자체를 변경하지 않는 순수 코드 하드닝이며, 직전 라운드가
지적한 유일한 Rationale 연속성 WARNING(admission-throw 재전파의 "BullMQ 재배달로 자가 치유"
오서술)은 커밋 `ef4ff8d5d` 로 사실에 맞는 근거로 완전히 정정되어 HEAD 에 반영돼 있다. 나머지
3개 `assertRowArray` 가드 지점 모두 기존 spec Rationale(TOCTOU admission gate·RR-PL-05 chain
깊이 제한·EIA-RL-04 commit-then-emit)과 충돌 없이 오히려 각 지점의 fail-open 결함을 메우는
방향이며, 트랜잭션 경계 밖이라 남은 잔여 갭(`updateExecutionStatus` else 분기 미-트랜잭션화)은
plan 문서에 의식적으로 추적 등재돼 은폐되지 않았다. 프롬프트에 첨부된 cafe24/채널
provider/observability 등 대규모 Rationale 번들은 이번 diff 의 실제 변경 파일과 교집합이 없어
검토 대상 밖이다. 신규 CRITICAL/WARNING 발견사항 없음.

## 위험도

NONE
