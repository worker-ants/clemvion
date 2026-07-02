### 발견사항

- **[WARNING]** `data-flow/3-execution.md §1.4` 시퀀스 다이어그램이 target 의 side-effect 점검 대상에서 누락
  - target 위치: "side-effect 점검 대상" 섹션 (target 문서 L101–106) — 점검 대상으로 `§7.5.1`, `§7.5 Rehydration 실패 케이스 표`, `conversation-thread.md`/`6-websocket-protocol.md`, `1-data-model.md §3` 만 나열
  - 충돌 대상: `spec/data-flow/3-execution.md` §1.4 "폼·버튼 인터랙션으로 재개" mermaid 시퀀스 다이어그램 (L142–172)
  - 상세: `data-flow/3-execution.md §1.4` 는 `4-execution-engine.md §7.5` 와 **동일한 rehydration 흐름을 별도로 도식화**한 병행 문서다. 현재 이 다이어그램은 재검증/claim 단계 없이 `Eng->>Eng: rehydrateAndResume → driveResumeAwaited(...)` 로 바로 진행하고, `waiting_for_input → running` UPDATE 를 **최종 커밋 단계**(L165: `Eng->>PG: UPDATE execution SET status='running' + UPDATE node_execution SET status='completed'`)에 배치한다. target 이 개정하는 `§7.5` 다이어그램(변경 2)은 원자 claim(`UPDATE ... WHERE status='waiting_for_input' RETURNING`)을 rehydration **진입 직전**(gate) 단계로 삽입하는데, 이는 `data-flow/3-execution.md` 의 "running 전이는 후단에서 발생" 이라는 현재 서술과 어긋나게 된다 — 두 문서가 같은 물리적 이벤트(“언제 `running` 전이가 커밋되는가”)를 다르게 기술하는 상태로 남는다. `data-flow/` 트리는 "도메인별 흐름·schema 매핑" 전용 영역(`spec/0-overview.md §8` 문서맵)으로, `4-execution-engine.md` 의 latest-only 사실을 그대로 반영해야 하는 파생 문서다.
  - 제안: `data-flow/3-execution.md §1.4` 시퀀스 다이어그램에도 원자 claim 단계(`API/Bus/Proc 이 재개 진입 시 claim UPDATE, affected=0 → ack-and-discard`)를 반영하고, `waiting_for_input → running` 전이가 **claim 시점에** 발생함을 명시하도록 target 의 "구체 변경" 목록에 변경 항목을 추가하거나, 최소한 side-effect 점검 대상에 `data-flow/3-execution.md §1.4` 를 등재해 developer/후속 planner 가 drift 를 인지하게 한다.

- **[INFO]** 추적 plan (`06-concurrency.md`) 의 C-2 체크박스가 아직 "결정 대기" 로 남아 있음
  - target 위치: target 문서 서두 "추적 plan: `plan/in-progress/refactor/06-concurrency.md` C-2 (사용자 승인 Option A, 2026-07-02)"
  - 충돌 대상: `plan/in-progress/refactor/06-concurrency.md` L40 `- [ ] 결정 대기 (사용자) — ...`
  - 상세: target 은 "사용자 승인(2026-07-02)" 를 이미 기정사실로 서술하지만, 추적 plan 파일의 체크박스·상태 텍스트는 여전히 "결정 대기" 상태로 남아있다. 내용 자체는 완전히 정합(옵션 A 선택, 근거 동일)하므로 CRITICAL/WARNING 은 아니나, plan 문서가 최신 결정을 반영하지 못한 채로 남으면 이 spec draft 를 읽는 제3자가 상태를 오인할 수 있다.
  - 제안: spec 반영과 함께(또는 직후) `06-concurrency.md` C-2 항목을 "[x] 구현 대기 — Option A 채택(2026-07-02)" 등으로 갱신 권고. (plan 갱신은 project-planner 소관이며 developer 트랙 착수 전 정리하면 충분.)

- **[INFO]** `1-data-model.md §3` 파샬 인덱스(V095)가 이미 원자 claim UPDATE 패턴을 anticipate — target 이 이를 명시적으로 인용하지 않음
  - target 위치: side-effect 점검 대상 "1-data-model.md §3" 행 (L106)
  - 충돌 대상: `spec/1-data-model.md` L840 `NodeExecution | (execution_id, status) WHERE status IN ('waiting_for_input','running') | ... rehydration resolveWaitingNodeExecutionId + running 조회/UPDATE 핫 경로 ... V095`
  - 상세: 충돌은 아니며 오히려 target 설계를 강화하는 근거다 — 이 partial index 의 코멘트가 "running 조회/UPDATE 핫 경로" 를 이미 명시하고 있어 원자 claim UPDATE(`WHERE id=$1 AND status='waiting_for_input'`)가 이 인덱스를 그대로 활용할 수 있음을 시사한다. target 의 서술("enum 값 불변 — 새 컬럼·enum 없음")은 정확하지만, 이 인덱스가 claim 패턴을 위해 이미 준비돼 있다는 점을 명시하면 구현 착수 시(developer) 별도 인덱스 신설 여부를 재검토하는 수고를 덜 수 있다.
  - 제안: side-effect 점검 대상 문구에 "V095 partial index 가 이 UPDATE 핫 경로를 이미 커버 — 신규 인덱스 불요" 1줄 추가 권고 (선택 사항, 비차단).

### 요약

target 이 인용하는 `4-execution-engine.md` §7.5/§7.4/§1.1/§1.2/§1.3 의 현재 텍스트·라인 번호(L75/L77/L81/L876/L925/L970-974)는 실제 spec 파일과 완전히 일치하며, `1-data-model.md` 의 `NodeExecution.status` enum·V095 partial index 도 target 의 "enum 불변" 주장과 정합한다. `6-websocket-protocol.md` 의 ack `resumed`/`queued` 의미(“enqueue 수락” — 이미 재개 성공과 분리된 always-enqueue 모델)도 target 의 "WS ack 계약 무영향" 주장을 뒷받침한다. `06-concurrency.md` C-2 항목과도 배경·옵션·Rationale 이 1:1로 대응해 rationale-continuity 위반이 없다. 유일한 실질 갭은 `data-flow/3-execution.md §1.4` 의 병행 시퀀스 다이어그램이 target 의 side-effect 점검 목록에서 누락된 점으로, 두 문서가 "waiting_for_input → running 전이 시점"을 다르게 묘사하게 될 위험이 있다 — CRITICAL 급 모순은 아니지만(별도 문서, 실행 불가 상태를 유발하지 않음) 명시적으로 반영하지 않으면 drift 로 남는다. 그 외 plan 체크박스 미동기화는 경미한 INFO.

### 위험도
LOW
