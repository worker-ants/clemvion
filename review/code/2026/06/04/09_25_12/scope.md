# 변경 범위(Scope) 리뷰

## 발견사항

### 요약
변경 의도: `execute()` 의 fire-and-forget in-process 실행을 BullMQ `execution-run` 큐 기반 work-stealing 으로 전환 (PR1 — exec-intake-queue).

---

- **[INFO]** `.env.example` 의 `EXECUTION_RUN_WORKER_CONCURRENCY` 항목 삽입 위치
  - 위치: `codebase/backend/.env.example` L35–40
  - 상세: `CONTINUATION_WORKER_CONCURRENCY` 아래, `PARALLEL_ENGINE` 앞에 배치. 주석 언어가 한국어 + 영어 혼합이나, 이는 파일 내 기존 스타일과 일치한다. 의도에 부합.
  - 제안: 없음.

- **[INFO]** `execution-engine.module.ts` — 임포트 순서
  - 위치: L27–28, L67–70, L82–83
  - 상세: `EXECUTION_RUN_QUEUE` / `ExecutionRunProcessor` 임포트가 `CONTINUATION_EXECUTION_QUEUE` 보다 앞에 삽입됐다. 파일 내 큐 등록 순서(BACKGROUND → CONTINUATION → EXECUTION_RUN)와 providers 순서가 연속적으로 유지된다. 범위 이탈 없음.
  - 제안: 없음.

- **[INFO]** `execution-engine.service.spec.ts` — `lastSaved` 추적 로직 + 테스트 재구성
  - 위치: L180–200 (beforeEach 내 `lastSaved`), L1728–1904 (describe 재구성)
  - 상세: `describe('runExecution — chat-channel routing context registration')` 를 `describe('execute() — execution-run intake 큐 발행 (PR1)')` 과 `describe('runExecutionFromQueue — worker 진입점 + routing context 재등록')` 으로 재분리했다. 이는 `execute()` 의 의미 변경(step 3 routing 등록이 worker 로 이동)에 따른 필수 테스트 계약 변경이며, 기존 테스트를 삭제한 것이 아니라 올바른 진입점(`runExecutionFromQueue`)으로 재지정한 것이다. `chatChannel.conversationKey 가 빈 문자열이면 chatChannel 등록 제외` 테스트 1건이 `row 가 PENDING 이 아니면 ack-discard` 로 교체됐는데, 이는 스펙 §4.1 의 idempotency guard 검증이 추가된 새 행동을 반영한 변경으로 범위에 부합한다.
  - 제안: 없음.

- **[INFO]** 신규 파일 3종 (`execution-run.queue.ts`, `execution-run.processor.ts`, `execution-run.processor.spec.ts`, `execution-run.queue.spec.ts`)
  - 위치: `codebase/backend/src/modules/execution-engine/queues/`
  - 상세: PR1 범위(`plan/in-progress/exec-intake-queue-impl.md`)에 명시된 신규 파일 목록과 정확히 일치. 범위 이탈 없음.
  - 제안: 없음.

- **[INFO]** `plan/in-progress/exec-intake-queue-impl.md` — frontmatter 갱신 + PR1 상태 업데이트
  - 위치: L1–3, L10–20, L162–165
  - 상세: `worktree` 및 `owner` 갱신, `consistency-check` 결과 기록, PR1 항목 `[ ]` → `[~]` 전환. plan 파일 갱신은 developer SKILL 의 정상 의무이며 범위 내.
  - 제안: 없음.

- **[INFO]** `review/consistency/2026/06/04/08_46_26/SUMMARY.md` — 신규 리뷰 산출물
  - 위치: `review/consistency/` 하위
  - 상세: `--impl-prep` consistency check 산출물. 보관 위치와 생성 주체(developer SKILL §impl-prep 의무)가 규약에 부합. 범위 내.
  - 제안: 없음.

---

## 범위 외 변경 없음

분석 결과 8개 관점 중 어느 항목에서도 의도 이상 변경이 확인되지 않았다.

1. `execute()` step 3(routing 등록) + step 4(fire-and-forget) 의 제거는 `runExecutionFromQueue()` 신설로 이전된 논리이며 제거된 코드와 대응이 명확하다.
2. `execution-engine.service.ts` 의 기존 로직(graph traversal, node dispatch, continuation, shutdown) 은 일체 건드리지 않았다.
3. 테스트 파일에서 `chatChannel.conversationKey` 경계값 테스트 1건이 삭제됐으나, 해당 케이스는 이제 `runExecutionFromQueue` 단계에서 `extractChatChannelFromInput` 이 동일하게 처리하므로 커버리지 손실이 아니다. 신규 ack-discard 경로(PENDING 이 아닐 때) 테스트로 대체됐다.
4. 불필요한 공백·포맷팅·임포트 정리는 관측되지 않았다.
5. 설정 파일 변경은 `.env.example` 에 신규 env 1개 추가뿐이다.

## 요약

이번 변경은 PR1 범위(`exec-intake-queue-impl.md`)에 명시된 파일 집합과 정확히 일치하며, 요청되지 않은 리팩토링·기능 확장·무관 파일 수정·포맷팅 변경은 발견되지 않았다. 기존 `execute()` 의 step 3/4 논리를 새 worker 진입점(`runExecutionFromQueue`)으로 이동한 것은 PR1 의도 그 자체이며, 테스트 재구성도 해당 의미 변경에 필수적인 조정이다. 

## 위험도

NONE
