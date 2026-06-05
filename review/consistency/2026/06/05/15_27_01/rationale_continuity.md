# Rationale 연속성 검토 결과

검토 대상: `spec/5-system/` 전역 + 관련 spec (`spec/conventions/conversation-thread.md`, `spec/4-nodes/3-ai/1-ai-agent.md` 등 plan 에서 언급된 참조 문서)
검토 기준: `spec/5-system/4-execution-engine.md ## Rationale` + `spec/conventions/conversation-thread.md ## Rationale` + `spec/0-overview.md ## Rationale` + 관련 spec 발췌

---

## 발견사항

### [INFO] "신규 컬럼 없음" 원칙 번복 — 번복 Rationale 명시적으로 기재됨 (정합)

- **target 위치**: `spec/5-system/4-execution-engine.md §6.2` ("waiting_for_input 진입 시" 저장 행), `spec/conventions/conversation-thread.md §8.4`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §6.2` 옛 문구 ("별도 `_continuationCheckpoint` 컬럼은 신설하지 않는다"), `spec/conventions/conversation-thread.md §4` 옛 문구 ("신규 DB 컬럼 없음" 전제)
- **상세**: 기존 Rationale 은 conversationThread 재구성을 "신규 DB 컬럼 없음"을 전제로 per-node SoT(`NodeExecution.outputData`) 에서 재구성한다는 입장이었다. 본 branch 에서 `Execution.conversation_thread jsonb`(V084), `Execution.user_variables jsonb`(V085) 두 신규 컬럼을 추가하며 이 전제를 번복했다.
- **평가**: 번복 Rationale 이 `spec/conventions/conversation-thread.md §8.4`에 명시적으로 기재되어 있다("**'신규 컬럼 없음' 원칙과의 정합**": 기존 원칙은 실행 이력 재구성 목적에서 충분하다는 판단이었고, durable in-flight resume 요구를 다루지 않았다. 본 컬럼은 미충족 요구를 위한 별도 매체이므로 원칙의 번복이 아니라 **적용 범위 분리**다). user_variables에 대해서도 `§6.2` 저장전략 표 및 plan A3 항목이 동일 맥락으로 설명한다.
- **제안**: 현재 상태로 정합. 추가 조치 불필요.

---

### [INFO] "항상 BullMQ enqueue — sticky fast-path 제거" 원칙과 PR-B2 완료 전 AI 잠정 fast-path 잔존의 과도기

- **target 위치**: `spec/5-system/4-execution-engine.md §7.4` Worker 동작 행 ("park 시 코루틴을 즉시 해제하므로 in-process resolver(`pendingContinuations`)가 존재하지 않는다 — worker-side fast-path 는 제거됐고 재개 경로는 slow-path 로 일원화된다") + 같은 절 말미 ("in-process 코루틴이 살아있으면(멀티턴 AI 잠정 경로) `rejectPending` 경로로 처리")
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md ## Rationale "Durable Continuation & Graceful Shutdown"` — "**Sticky fast-path 제거 — '항상 publish' 원칙 보존**": 초기 검토안의 "publisher 가 자기 인스턴스에 key 가 있으면 BullMQ 우회하고 직접 resolve" 하는 sticky fast-path 를 제거; "항상 BullMQ enqueue" 로 통일한다. 같은 절 "park 즉시 해제 + slow-path 일원화 (Phase B)" — B1·B2 분리 불가 원칙, `pendingContinuations` 제거는 PR-B2 완료 시점임을 명시.
- **상세**: PR-B1 완료 후 과도기에 멀티턴 AI 는 `pendingContinuations` Map + in-memory fast-path 가 잠정 잔존한다고 §7.4 Worker 동작 행에 이미 명시돼 있으나, §7.4 상단 "라우팅 원칙" 행은 여전히 "`pendingContinuations` 에 키가 있어도 마찬가지"라고 쓰여 있다 — PR-B1 과도기에서 멀티턴 AI 는 이 원칙을 완전히 따르지 않는 상태.
- **평가**: §Rationale "park 즉시 해제 + slow-path 일원화"에 "**단계적 롤아웃 (B1→B2)**" 항목이 추가되어 과도기 잔존을 명시하고, "`pendingContinuations` Map 제거"가 PR-B2 완료 시점임을 구체적으로 기술하고 있다. 즉 Rationale 이 과도기 불일치를 의도적으로 허용·설명하고 있어 "무근거 번복"은 아니다. 다만 §7.4 라우팅 원칙 행이 현재(PR-B1 완료, PR-B2 미완료) 시점에 AI 경로에서 완전 유효하지 않다는 점에서 독자 혼란 여지가 있다.
- **제안**: 현 상태 허용 가능. 단 §7.4 "라우팅 원칙" 행에 짧은 노트("※ PR-B2 완료 전 과도기: 멀티턴 AI 는 §Rationale 단계적 롤아웃 참조 — pendingContinuations 잔존") 를 추가하면 독자 혼란이 해소된다. 필수는 아님.

---

### [INFO] `_resumeCheckpoint` 영속 — "WARN #6 미영속" 원칙의 명시적 번복 확인

- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` 보존 예외 + `## Rationale "Multi-turn 재시작 재개 — _resumeCheckpoint 보존 (옛 'WARN #6 미영속' 번복)"`
- **과거 결정 출처**: 같은 Rationale 절 — "도입 초기 결정(코드 주석 'WARN #6')은 multi-turn AI 의 `_resumeState` 를 보안상 DB 에 영속하지 않고 in-memory 만 유지했다"
- **상세**: 과거 Rationale 이 `_resumeState` 전체를 미영속하기로 결정했으나, `_resumeCheckpoint`(credential-strip 부분집합)를 신설해 평문 영속한다.
- **평가**: Rationale 에 "번복 대상 결정"이 명시되고, 번복 근거(운영 결함 — 인스턴스 재시작 시 다중채널 대화 영구 재개 불가), 채택안의 보안 위험 재평가(`_resumeState` 는 raw secret 이 아닌 참조 ID 만 담음), 기각 대안(암호화)까지 완비. 정합.
- **제안**: 현재 상태로 정합.

---

### [INFO] `information_extractor` 멀티턴 checkpoint 확장 — "ai_agent 한정" 원칙 번복

- **target 위치**: `spec/5-system/4-execution-engine.md §1.3` ("**`ai_agent` · `information_extractor` 멀티턴 노드**"), `## Rationale "Multi-turn 재시작 재개…" — "ai_agent + information_extractor 지원 (초기 ai_agent 한정에서 확장)"`
- **과거 결정 출처**: 같은 Rationale 절 초기 단락 — "초기 도입은 재구성기·allow-list 를 `ai_agent` shape 에 맞춰 `ai_agent` 한정으로 출하하고 일반화를 후속 작업으로 남겼다"
- **상세**: "ai_agent 한정" 원칙이 점진 확장으로 번복되었다.
- **평가**: Rationale 내에 "본 확장은 그 후속을 실현한다"는 명시와 확장 근거(엔진 dispatch polymorphic, config 재유도 generic, IE 고유 state credential-free·소형)가 있다. 정합.
- **제안**: 현재 상태로 정합.

---

### [INFO] D3 fresh-config-per-turn — "frozen-per-conversation rawConfig" 원칙 변경

- **target 위치**: `spec/5-system/4-execution-engine.md §6.2` ("fresh-config-per-turn 수용"), `## Rationale "park 즉시 해제 + slow-path 일원화" — D3 항목`
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md §6.2` 저장전략 + `spec/5-system/4-execution-engine.md ## Rationale "Engine Raw Config Exposure"` — "Multi-turn resume 은 `state.rawConfig` frozen snapshot 사용"(§6.3 표)
- **상세**: 기존 multi-turn resume 모델은 `state.rawConfig` frozen snapshot (첫 turn 고정)을 사용한다고 정의했으나, Phase B(매 turn rehydration + `buildRetryReentryState` 재유도) 에서는 park 중 워크플로 편집이 다음 turn 부터 반영되는 fresh-config-per-turn 으로 변경되었다.
- **평가**: Rationale "park 즉시 해제 + slow-path 일원화" D3 항목이 "기각 대안('checkpoint 에 rawConfig 영속해 per-conversation frozen 유지')은 구현 복잡도를 더하고, fresh 재유도가 더 직관적이라 미채택 — replay reproducibility 의 turn 단위 약화는 수용된 trade-off" 로 명시적으로 기록하고 있다. §6.3 표도 "Multi-turn resume = `state.rawConfig` frozen snapshot 사용" 이었으나 현재 spec 의 동일 표에는 해당 설명이 갱신되어 있을 것으로 보인다. 단, `spec/5-system/4-execution-engine.md §6.3` 의 "Multi-turn resume" 행(line ~746)에 여전히 "`state.rawConfig` frozen snapshot 사용"이 남아 있어 D3 결정과 미정합 가능성이 있다.
- **제안**: `§6.3` Multi-turn resume 행을 확인하여 "frozen snapshot" 표현이 잔류하는지 점검하고, 잔류 시 "D3 결정(Phase B): fresh-per-turn 재유도로 전환 — §Rationale 참조" 를 추가한다.

---

### [INFO] `waiting_for_input → failed` 전이 추가 — Rationale 정합

- **target 위치**: `spec/5-system/4-execution-engine.md §1.1` 전이표
- **과거 결정 출처**: 같은 Rationale 절 "`waiting_for_input → failed` 전이 추가" — "옛 정책은 `waiting_for_input` 종료를 `running` 또는 `cancelled` 로만 정의했다"
- **상세**: 옛 정책 번복.
- **평가**: 번복 근거(AI multi-turn LLM throw 시 NodeExecution 영구 잔류 + Execution 만 FAILED 되는 모순), 채택 안의 원자성 정합(`WFI→failed` 단일 트랜잭션), 기각 대안(`WFI→running→failed` 두 단계) 이 모두 Rationale 에 명시. 정합.

---

### [INFO] `per-node task queue` 기각 — 번복 없음, Rationale 정합

- **target 위치**: `spec/5-system/4-execution-engine.md ## Rationale "per-node task queue → execution-level intake 큐"`
- **과거 결정 출처**: `spec/0-overview.md ## Rationale "실행 엔진: Redis 큐 + 분산 워커 풀"` — "per-node task queue 를 채택하지 않은 근거는 실행엔진 §Rationale"으로 cross-link
- **상세**: per-node task queue 기각이 overview Rationale 과 실행엔진 Rationale 두 곳에서 일치하여 cross-reference 가 정합함.
- **평가**: 정합. 추가 조치 불필요.

---

### [WARNING] §6.3 "Multi-turn resume" 행 — frozen-rawConfig 표현 잔류 여부

- **target 위치**: `spec/5-system/4-execution-engine.md §6.3` 표의 "Multi-turn resume" 행
- **과거 결정 출처**: 해당 행 원문 — "Multi-turn resume 은 `state.rawConfig` frozen snapshot 사용"
- **상세**: §6.3 현재 spec 을 확인하면(`spec/5-system/4-execution-engine.md` line 746): `| **Multi-turn resume** | 같은 실행의 다음 turn 진행 — state.rawConfig frozen snapshot 사용 |`. 이 서술은 D3(Phase B: fresh-per-turn 재유도) 결정과 정면으로 충돌할 가능성이 있다. PR-B2 완료 전 과도기라 "frozen"이 AI path 에만 잠정 적용되는 것이라면 허용이지만, spec 서술이 변경 없이 "frozen snapshot" 을 단언하면 독자가 Phase B 의 D3 결정을 인지하지 못할 수 있다.
- **제안**: `§6.3` Multi-turn resume 행에 "(Phase B 완료 후: fresh-per-turn, D3 — §Rationale 참조)" 노트를 추가하거나, Rationale D3 섹션에서 §6.3 을 명시적으로 cross-link 한다. 행 서술 자체는 PR-B2 완료 후 갱신 의무.

---

## 요약

`exec-park-durable-resume` branch 의 `spec/5-system/` 대상 변경은 Rationale 연속성 관점에서 전반적으로 양호하다. 주요 번복 사항 — "신규 컬럼 없음" 원칙, "WARN #6 미영속" 원칙, "ai_agent 한정" 서술, "항상 publish" 원칙의 worker-side 확장 — 은 모두 `## Rationale` 에 번복 배경·근거·기각 대안을 갖추고 있어 Rationale-continuity 조건을 만족한다. CRITICAL 또는 HIGH 위험 이슈는 발견되지 않았다. 한 가지 주의할 점은 `§6.3` "Multi-turn resume — frozen snapshot" 표현이 D3(fresh-per-turn) 결정과 잠재적으로 충돌하는데, PR-B2 완료 전 과도기라 의도적이라면 문제없으나 spec 서술이 갱신되지 않으면 미래 독자에게 혼란을 줄 수 있다. 이를 WARNING 으로 분류하고 PR-B2 완료 시 동기 갱신을 권고한다.

---

## 위험도

LOW

STATUS: OK
