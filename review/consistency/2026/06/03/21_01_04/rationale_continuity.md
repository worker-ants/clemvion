# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/ai-context-memory-auto.md`
검토 모드: spec draft 검토 (--spec)
검토 일시: 2026-06-03

---

## 발견사항

- **[WARNING]** Token-aware cap 을 v2 로드맵으로 유보했으나 target 이 동일 개념을 v1 으로 실현하면서 spec Rationale 번복 근거 부재
  - target 위치: §1.1 "트리거 — 턴 수 → 토큰 예산" + §2 `memoryTokenBudget` 필드
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §7 v2 로드맵` — "**Token-aware cap**: 현재 char-based cap (§5.3) 을 provider tokenizer 기반으로 — 모델별 정확한 토큰 budget 고려." + `spec/4-nodes/3-ai/1-ai-agent.md §12.1` v1/v2 경계 "v1: 단일 thread, char 기반 cap"
  - 상세: conversation-thread.md §7 는 "Token-aware cap" 을 명시적으로 v2 로드맵 항목으로 분류했고, ai-agent.md §12.1 은 v1 경계를 "char 기반 cap" 으로 확정했다. target §1.1 은 스스로 "기존 conversation-thread.md §7 v2 로드맵의 'Token-aware cap' 항목과 정합 — 이 작업이 그 로드맵을 실현한다"고 진술하며 §2 에서 `memoryTokenBudget`(기본 8000) 을 신규 v1 필드로 도입한다. v2 유보 결정의 번복이 의도된 것이라면 spec Rationale 에 번복 근거가 함께 기술되어야 한다. 현재는 번복 근거가 plan 문서에만 존재하고 spec 에는 없다.
  - 제안: Phase A spec 개정 시 `conversation-thread.md §7` 의 "Token-aware cap" 항목을 "본 작업(ai-context-memory-auto)에서 `memoryStrategy: summary_buffer` 로 실현됨 (provider tokenizer 가 아닌 사용자 지정 `memoryTokenBudget` 형태)" 으로 갱신하고, `1-ai-agent.md §12` Rationale 에 "왜 v2 유보를 번복해 v1 에 포함하는가" 를 신규 항으로 작성한다.

- **[WARNING]** `contextScope` enum 에 `auto` 를 끼워 넣는 대안의 기각 근거가 plan 문서에만 존재하고 spec Rationale 에 기록 계획이 없음
  - target 위치: §2 "스키마 확장 형태 결정 — 별도 `memoryStrategy` 필드" 전체
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §1` config 표 (`contextScope: none/thread/lastN`), `spec/conventions/conversation-thread.md §5.1` contextScope 주입 매핑표
  - 상세: target §2 는 "`contextScope` enum 에 `auto` 값을 추가하는 대신 별도 `memoryStrategy` 필드를 1급으로 도입한다"는 결정과 이유를 상세히 서술하나, 이 내용은 plan 문서 안에서만 존재한다. Phase A 계획(§3)에 spec 갱신 목록이 나열되어 있지만 해당 결정 근거를 `1-ai-agent.md §12 Rationale` 에 기록하는 항목이 없다. spec Rationale 없이 구현이 진행되면 미래 독자가 이 설계 분기점의 근거를 추적할 수 없고, 이후 변경 시 같은 논의가 반복될 위험이 있다.
  - 제안: Phase A spec 개정 시 `1-ai-agent.md §12` 에 "§12.N `memoryStrategy` 를 별도 필드로 도입한 이유 — contextScope enum 확장 기각 근거" 신규 Rationale 항을 작성한다.

- **[WARNING]** 요약 블록을 "system_text 안정 프리픽스에 배치"한다는 결정이 기존 ordering SoT(`0-common.md §11.4`)를 암묵적으로 변경할 수 있으며 Rationale 이 부재함
  - target 위치: §2 `summary_buffer` 설명 — "요약 블록은 항상 system_text 안정 프리픽스에 배치"
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §5.2` 주석 — "systemPrompt build ordering 의 단일 SoT 는 [공통 §11.4]" + `spec/4-nodes/3-ai/0-common.md §11.4` "주입 위치 및 ordering"
  - 상세: conversation-thread.md §5.2 는 "systemPrompt build ordering 의 단일 SoT 는 §11.4 — 본 절은 thread injection 단계만 다루며 ordering 재정의는 §11.4 만 참조" 라고 못 박았다. target 은 요약 블록을 "system_text 안정 프리픽스"에 배치한다고 단언하나, 이것이 §11.4 ordering (System Context Prefix → 사용자 systemPrompt → KB/condition suffix → thread injection) 의 어느 단계에 삽입되는지 명시하지 않는다. 실현 시 §11.4 의 ordering 을 암묵적으로 변경하거나 새 단계를 추가하게 되며 이에 대한 Rationale 이 부재하다.
  - 제안: Phase A spec 개정 시 `0-common.md §11.4` ordering 표를 요약 블록 단계와 함께 갱신하고(`memoryStrategy ≠ manual` 시 요약 블록이 어느 위치에 삽입되는지), `1-ai-agent.md §12` Rationale 에 "요약 블록 배치 위치 — 기존 ordering SoT 와의 관계" 항을 추가한다.

- **[INFO]** persistent 비동기 추출이 `scheduleBackgroundBody` invariant(turns 배열 snapshot 격리)를 준수해야 함이 plan 에 명시되지 않음
  - target 위치: §1.6 "추출 시점 — 비동기(background, 기존 `scheduleBackgroundBody` 계열 패턴)"
  - 과거 결정 출처: `spec/conventions/conversation-thread.md §3.2` — "scheduleBackgroundBody 가 enqueue 시점에 thread 의 turns 배열까지 함께 복사한 snapshot 을 만든다"
  - 상세: conversation-thread.md §3.2 는 background enqueue 시 turns shallow copy(새 array 인스턴스)를 만들어 메인 thread 오염을 차단한다는 invariant 를 명시한다. persistent 추출이 "scheduleBackgroundBody 계열 패턴"을 따른다면 이 invariant 도 준수해야 하지만, Phase D 구현 계획이나 신규 spec 문서(agent-memory.md) 계획에 이 사항이 언급되지 않았다.
  - 제안: Phase D 구현 계획 또는 신규 `agent-memory.md` §추출 파이프라인 절에 "scheduleBackgroundBody 의 turns snapshot 격리 invariant 준수 — 추출 enqueue 시 turns 배열 shallow copy 필수" 를 명시하고 conversation-thread.md §3.2 를 cross-link 한다.

- **[INFO]** 스코프 키 설계(`memoryKey ?? execution_id`)의 근거가 신규 spec Rationale 에 기록될지 여부가 Phase A 계획에 명시되지 않음
  - target 위치: §1.4 "메모리 스코프 키 (사용자 결정)"
  - 과거 결정 출처: (기존 Rationale 에 유사 결정 없음 — 신규 설계)
  - 상세: "최종사용자 식별자 부재(웹채팅 v1 익명)" 라는 근거는 향후 웹채팅 v2 에서 사용자 식별이 도입되면 `memoryKey` 정책 변경의 중요한 선례가 된다. 이 근거가 신규 spec 문서에 Rationale 로 기록되지 않으면 나중에 정책 변경 시 근거 추적이 불가능해진다.
  - 제안: Phase A 에서 신규 `agent-memory.md` 작성 시 §Rationale 에 "스코프 키 설계 — workspace_id + memoryKey fallback to execution_id" 항을 Mem0/Zep `user_id` 패턴 + 현재 익명 제약 근거와 함께 기술한다.

---

## 요약

target 문서(`ai-context-memory-auto.md`)는 전반적으로 기존 spec 원칙(하위호환 유지, workspace_id 격리, KB 인프라 재사용, scheduleBackgroundBody 패턴, ragTopK/ragThreshold 기본값 정합)을 의식하고 있으며 기각된 대안을 이유 없이 채택하는 CRITICAL 수준의 위반은 없다. 그러나 세 개의 WARNING 이 있다. (1) `conversation-thread.md §7` 에 v2 유보로 분류된 "Token-aware cap" 을 이 작업이 v1 으로 실현한다고 자체 진술하면서 spec Rationale 의 v1/v2 경계 번복 근거가 plan 문서에만 존재한다. (2) 신규 `memoryStrategy` 필드 도입 이유(contextScope enum 확장 기각)가 plan 에만 서술되고 spec Rationale 에 기록 계획이 없다. (3) 요약 블록의 system_text 프리픽스 배치가 기존 ordering SoT(`0-common.md §11.4`) 와의 관계를 명시하지 않아 암묵적 ordering 변경이 Rationale 없이 일어날 수 있다. Phase A spec 개정 시 `conversation-thread.md §7`·`§12.1`, `1-ai-agent.md §12`, `0-common.md §11.4` 의 관련 Rationale 항목을 함께 갱신하면 세 WARNING 이 해소된다.

---

## 위험도

MEDIUM
