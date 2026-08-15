# Requirement Review — `finalizeStalledExhausted` 트랜잭션 원자화

## 대상

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeStalledExhausted`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 관련 테스트 3건
- `CHANGELOG.md`, `plan/in-progress/eia-stalled-atomicity.md`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
- `spec/5-system/4-execution-engine.md` §7.1

## 배경 확인

`review/code/2026/08/15/16_04_38/` (직전 라운드) 과 `review/consistency/2026/08/15/15_54_20/` 산출물을
직접 읽고, 그 라운드가 지적한 WARNING 4건 + INFO 처분이 이번 diff 에 실제로 반영됐는지 코드/spec 을
직접 열어 대조했다.

| 직전 라운드 지적 | 처분 주장 (RESOLUTION.md) | 이번 diff 에서 확인 |
|---|---|---|
| W1 testing: NodeExecution cascade UPDATE 의 WHERE 가드(`execution_id`, `status=:running`) 미검증 | 추가 완료 | `execution-engine.service.spec.ts:4971-4976` 에 `nodeQb.where`/`nodeQb.andWhere` 단언 실존 확인 |
| W4 maintainability: 신규 첫 테스트가 `installStalledTx` 헬퍼 미재사용 | 헬퍼 호출로 교체 | `execution-engine.service.spec.ts:4914-4915` 가 `installStalledTx(1)` 사용 확인 |
| W2 documentation: CHANGELOG 누락 | 항목 추가 | `CHANGELOG.md:3-15` 신규 섹션 확인, "수신자 영향 없음" 명시 |
| W3 documentation: JSDoc 미갱신 | `cancelParkedExecution` 형식으로 문단 추가 | `execution-engine.service.ts:3325-3329` JSDoc 문단 확인 |
| consistency W1: `node-cancellation.md` §6 표에 스코프 밖 함수(취소 아님) 오기재 | `4-execution-engine.md §7.1` 로 이전 | `git diff origin/main -- spec/conventions/node-cancellation.md` 가 **빈 diff** — 애초에 잘못된 문서에 등재되지 않았고 `spec/5-system/4-execution-engine.md:851` 에 §7.1 본문으로 정확히 반영됨. `eia-stalled-atomicity.md` 체크리스트에도 이 impl-prep 판정과 조치가 기록됨 |
| consistency INFO#2: plan 본문↔체크리스트 지연 | "자매 트래커 동시 갱신" 항목 `[x]` 동기화 | `plan/in-progress/eia-stalled-atomicity.md:71` 확인 — `[x]`. 나머지 3항목(`/ai-review`·`--impl-done`·push)은 아직 미수행이라 `[ ]` 유지가 정확 |

직전 라운드에서 지적된 항목은 전부 실제로 반영돼 있고, 위조·누락된 주장은 없었다.

## 독자 점검 결과

1. **기능 완전성**: `dataSource.transaction`으로 Execution UPDATE + NodeExecution cascade UPDATE 를
   묶고, 커밋 이후 `finalizeRehydrationCleanup`·`emitExecution` 을 best-effort 로 실행하는 구조가
   자매 `cancelParkedExecution`(`:1023-1089`)· `markWebChatIdleTimeout`(`:1152-1226`) 과 라인 단위로
   동형이다. 의도한 "부분 커밋 방지" 목적을 완전히 달성.
2. **엣지 케이스**: `affected===0`(이미 terminal) 시 콜백 내부에서 조기 `return` → `finalized` 가
   `false` 로 남아 cascade UPDATE·로그·emit 모두 스킵. 원래(트랜잭션 도입 전) 동작과 동일 — 회귀 없음.
   실제 `nodeQb.execute` 미호출까지 테스트로 확인됨(`execution-engine.service.spec.ts:5028-5029`).
3. **TODO/FIXME**: 없음.
4. **의도-구현 괴리**: JSDoc(`execution-engine.service.ts:3325-3329`)이 "자매와 동형"이라고 주장하는
   범위(트랜잭션 구조)는 실제로 정확히 일치한다. 함수 레벨 `try/catch` 유무 차이는 JSDoc 이 애초에
   그 부분을 "동형"이라 주장하지 않으므로 과대 주장 아님(아래 INFO 참고).
5. **에러 시나리오**: 함수 자체는 함수 레벨 `try/catch` 없이 트랜잭션 예외를 그대로 전파한다(자매
   두 함수와 다른 지점) — 그러나 diff 로 도입된 변화가 아니라 원래부터 그랬다(diff 이전 unified diff
   에서도 try 블록 없이 시작). 유일 호출부 `execution-run.processor.ts:88` (`onFailed`)가
   `.catch()` 로 예외를 흡수하므로 최종 동작은 자매와 동등 — CRITICAL 아님, 직전 라운드에서도 INFO
   로 이미 dispositioned(무조치 결정, 근거 有).
6. **데이터 유효성**: 외부 입력은 `executionId` (caller 인 BullMQ job payload 에서 옴, 이 diff 범위
   밖) 뿐이고 SQL 은 전부 파라미터 바인딩 — 인젝션 표면 없음.
7. **비즈니스 로직**: "stalled 재배달 attempts 소진 → `WORKER_HEARTBEAT_TIMEOUT` FAILED" 규칙,
   `status='running'` 조건부 UPDATE 로 이미 terminal 인 setup-throw 경로와 자연 분기하는 로직
   그대로 보존됨(diff 는 원자성만 바꿨고 조건/값은 무변경).
8. **반환값**: `Promise<void>` — 모든 경로(트랜잭션 예외 전파/no-op 조기 return/정상 완료)에서
   일관되게 resolve 하거나 reject. 누락된 경로 없음.
9. **spec fidelity**: `spec/5-system/4-execution-engine.md:851`(§7.1 mid-operation stalled 트리거
   서술)에 "이 마감은 단일 트랜잭션이다(2026-08-15)" 문단이 **같은 diff 안에서** 추가돼 구현과
   spec 이 동시에 갱신됐다 — SPEC-DRIFT 아님(코드만 먼저 바뀌고 spec 이 안 따라온 상황이 아니라
   같은 커밋 세트에서 양쪽이 함께 반영됨). 문구("Execution 을 FAILED 로 쓰는 UPDATE 와 자식 RUNNING
   NodeExecution cascade UPDATE 가 dataSource.transaction 으로 묶인다")가 구현과 line-level 로
   일치. `attempts 소진` 행(§862, 표)은 이번 diff 대상이 아니고 값(에러 코드 `WORKER_HEARTBEAT_TIMEOUT`)
   도 변경되지 않았으므로 갱신 불필요 — 실제로 diff 에 포함 안 됨, 일관성 확인.

## 검증

- `npx jest execution-engine.service.spec.ts -t "finalizeStalledExhausted"` → **3 passed** (직전
  라운드가 기록한 판별력 주장과 일치: 트랜잭션 제거 뮤턴트 3/3 RED, `affected=0` 조기 return 제거
  RED).
- `npx tsc --noEmit` 전체 프로젝트 스캔 결과 이 diff 의 신규 라인(`execution-engine.service.spec.ts`
  4877-5033, `execution-engine.service.ts` 3340-3420) 범위에는 **신규 타입 에러 없음** — 보고된
  기존 타입 에러(`:302`, `:2711-2714`, `:4590` 등)는 전부 diff 밖 pre-existing 라인.

## 발견사항

- **[INFO]** 함수 레벨 `try/catch` 비대칭 — `finalizeStalledExhausted` 는 자매
  `cancelParkedExecution`/`markWebChatIdleTimeout` 과 달리 함수 자체에 `try/catch` 가 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (함수
    `finalizeStalledExhausted`, 3340행 시작 — 게이트 3340 확인)
  - 상세: 트랜잭션 내부에서 예외가 나면 `finalizeStalledExhausted(executionId)` 가 반환하는
    Promise 가 reject 된다. 유일 호출부 `execution-run.processor.ts:88` 의
    `.catch((err_) => this.logger.error(...))` 가 이를 흡수하므로 최종 동작(로그만 남기고
    진행)은 자매 함수와 동등하다. diff 이전부터 존재하던 비대칭이며 이번 PR 이 새로 만든 것이
    아니다. 직전 코드 리뷰(`16_04_38`)와 consistency-check(`15_54_20`)에서 이미 검토돼
    "조치 불요(근거: 최종 동작 동등)" 로 명시적으로 dispositioned 됐다.
  - 제안: 조치 불요. 완전 대칭을 원하면 별도 유지보수 항목으로 트래커에 등재 가능(선택, 이번
    diff 범위 밖).

## 요약

`finalizeStalledExhausted` 의 Execution+NodeExecution 2-UPDATE 를 `dataSource.transaction` 으로
묶어, 부분 커밋 시 자식 NodeExecution 이 영구 RUNNING 으로 잔류하던 결함을 자매 함수와 동형인
패턴으로 수정했다. affected=0 no-op 분기, 커밋 후 best-effort emit/cleanup 순서, 에러 코드/메시지
값 모두 원래 로직을 그대로 보존하며 트랜잭션 경계만 바뀌었다 — 회귀 없음. 직전 리뷰 라운드
(`16_04_38` code review, `15_54_20` consistency check)가 지적한 WARNING 4건 + 관련 INFO 는 이번
diff 에서 전부 실제로 반영된 것을 코드/spec 을 직접 열어 확인했다(위조·누락 없음). spec
(`4-execution-engine.md §7.1`)도 같은 diff 안에서 갱신돼 구현과 line-level 로 일치하며, 신규
테스트 3건이 실제로 GREEN 이고 tsc 에 새 타입 에러를 유발하지 않음을 직접 실행해 확인했다.
CRITICAL/WARNING 급 발견사항 없음 — 잔여 INFO 1건(함수 레벨 try/catch 비대칭)은 이미
dispositioned 된 pre-existing 사항으로 재확인 차 기록.

## 위험도

NONE
