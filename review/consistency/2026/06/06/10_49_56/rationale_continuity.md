### 발견사항

- **[INFO]** PR-B2 분할(B2a/B2b)로 인한 "B1·B2 분리 불가" 원칙 표현 완화 — 실질 위반 아님
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale "park 즉시 해제 + slow-path 일원화" → 단계적 롤아웃 항, 구현 메모 `4.x`
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "B1·B2 분리 불가" ("코루틴 해제(B1)는 park 시 `await` 제거를 요구하고, 그러면 코루틴을 깨울 in-memory resolve 가 사라져 '모든 재개 = rehydration'(B2)이 강제된다 — 한 덩어리 변경이다.")
  - 상세: 기존 Rationale 는 B2를 단일 PR로 정의했다. target 은 이를 B2a(top-level 멀티턴 AI)와 B2b(중첩 D6 + full B3)로 분할했다. "B1·B2 분리 불가" 원칙 자체는 target 내 동일 Rationale에 유지되며, target 이 "park-site 단위로 'release+slow-path 를 함께' — B1·B2 분리 불가 원칙 유지"라고 명시한다. B2a는 top-level AI에 한해 원칙을 완전히 이행하고, B2b는 중첩 D6라는 추가 scope 때문에 분리됐음이 Rationale에 명시됐다.
  - 제안: 보완이 필요하다면 "B1·B2 분리 불가는 park-site scope 단위 적용 — B2a가 top-level scope, B2b가 중첩 scope를 각각 담당"임을 Rationale에 1줄 명문화하면 충분. 현재도 독자가 이해할 수 있는 수준이라 필수는 아님.

- **[INFO]** `_continuationCheckpoint` 기각 결정과 `resume_call_stack` 신규 컬럼의 관계 — 명시적 구분 존재
  - target 위치: `spec/5-system/4-execution-engine.md` §6.2 표 `waiting_for_input 진입 시` 행(e), §Rationale exec-park D6; `spec/1-data-model.md` `resume_call_stack` 필드
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "Multi-turn 재시작 재개" → "별도 `_continuationCheckpoint` 컬럼 신설 기각: 기존 SoT 인 `NodeExecution.outputData` (JSONB) 에 키로 보존해 DB 스키마 변경·마이그레이션을 회피"
  - 상세: target 은 `resume_call_stack jsonb`(V087) 신규 컬럼을 도입했다. 이는 DB 스키마 변경으로, `_continuationCheckpoint` 기각의 핵심 근거("DB 스키마 변경·마이그레이션 회피")와 외관상 충돌해 보인다. 그러나 target 은 §6.2 와 §Rationale exec-park D6 양쪽에서 "`resume_call_stack` 은 continuation 운반이 아니라 park 시점의 중첩 실행 위상(호출 체인) 영속 — 직교한 목적이라 그 기각의 번복이 아니다"라고 명시적으로 구분한다. `_continuationCheckpoint` 기각 이유("continuation은 BullMQ 큐가 durable 운반하므로 불요")가 `resume_call_stack`에는 해당하지 않음을 논증하고 있다.
  - 제안: 현 설명으로 충분하다. 추가로 `spec/1-data-model.md` `resume_call_stack` 필드 설명에 기각과의 구분("continuation 운반이 아닌 호출 체인 위상 영속 — `_continuationCheckpoint` 기각과 별범주")을 한 줄 inline 보완하면 독자의 의문을 선제 해소할 수 있다(현재 실행엔진 spec cross-link만 존재).

- **[INFO]** `per-node task queue` 기각 결정과 exec-park D6의 관계 — 명시적 구분 존재
  - target 위치: `spec/5-system/4-execution-engine.md` §Rationale exec-park D6 "per-node task queue 기각과 다른 범주" 항
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "per-node task queue → execution-level intake 큐" ("개별 노드를 워커로 분산하려면 노드마다 전체 ExecutionContext를 직렬화/rehydration 해야 하고… 엔진 재작성급·고위험")
  - 상세: exec-park D6는 중첩 sub-workflow 호출 체인을 DB 에 영속(`resume_call_stack`)해 재귀 재진입하는 설계다. "노드 단위 직렬화"로 오독될 여지가 있으나, target Rationale은 "exec-park D6는 park 지점(waiting node)에서만 직렬화하는 'waiting 후 재개'의 중첩 확장이며, dispatch loop in-process 전제(한 세그먼트 = 한 프로세스가 call stack을 재귀 in-process 구동)를 유지한다"고 명확히 구분한다.
  - 제안: 현 구분 서술로 충분. 변경 불필요.

### 요약

target(`spec/5-system/4-execution-engine.md` + `spec/1-data-model.md`)의 변경은 exec-park D6(중첩 sub-workflow call stack 영속)와 PR-B2a(top-level 멀티턴 AI park-release) 완료를 반영하는 spec 업데이트다. 기존 Rationale에서 명시적으로 기각된 세 가지 결정(`_continuationCheckpoint` 신설 기각, `per-node task queue` 기각, `B1·B2 분리 불가` 원칙)과의 충돌 여부를 분석한 결과, target 은 각각에 대해 "다른 범주임" 또는 "원칙을 준수함"을 Rationale 내에 직접 명문화하고 있다. 새로운 `resume_call_stack` 컬럼 도입은 DB 스키마 변경을 수반하지만, 기각된 `_continuationCheckpoint`와 목적(continuation 운반 vs. 호출 체인 위상 영속)이 직교함을 논증했으며 새 Rationale(exec-park D6)도 함께 작성됐다. PR-B2의 B2a/B2b 분할은 "B1·B2 분리 불가" 표현을 외관상 완화하지만, 분리 불가 원칙은 park-site scope 단위로 각각 이행되고 있어 합의된 invariant의 실질 위반은 없다. INFO 등급 보완 제안 2건이 있으나 모두 선택적이다.

### 위험도

LOW
