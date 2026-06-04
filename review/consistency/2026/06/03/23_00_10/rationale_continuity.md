# Rationale 연속성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
Target: `spec/4-nodes/3-ai/` (diff-base: `origin/main`)
검토 일시: 2026-06-03

---

## 발견사항

### [INFO] conversation-thread v1/v2 경계 번복 — 새 Rationale 명시적으로 작성됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.10
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.1 v1/v2 경계표 ("char 기반 cap, 신규 DB 컬럼 없음 → v1"), `spec/conventions/conversation-thread.md` §7 v2 로드맵 ("Token-aware cap", "DB 컬럼 신설" 항목)
- **상세**: `summary_buffer` / `persistent` 전략 도입이 외형상 v2 로 유보했던 "token-aware cap" 과 "DB 영속"을 v1 노드에 끌어들이는 것처럼 보인다. 그러나 target 은 §12.10 에서 이 번복을 명시적으로 처리했다: (1) 이번 구현은 token-budget 근사(`memoryTokenBudget`)이고 provider tokenizer-exact 방식은 v3 로 잔존, (2) DB 영속은 `Execution.conversation_thread jsonb` 컬럼이 아니라 별도 테이블 `agent_memory`이므로 "v1 신규 DB 컬럼 없음" 조항과 모순 없음을 논거로 제시했다. `conversation-thread.md` §7 v2 로드맵 항목도 "부분 실현"·"v3 잔존" 분리 표기로 갱신됐다.
- **제안**: 번복 처리가 충분히 명문화됐으나, §12.1 의 v1/v2 경계표 자체는 여전히 옛 텍스트("char 기반 cap")를 유지한다. 해당 표의 v1 행에 "v1.5 이후: `memoryStrategy` 비-manual 시 char-cap 대신 `memoryTokenBudget` token-budget 으로 대체" 같은 부연 또는 §12.10 교차참조를 추가하면 더 정합적이다. 차단 이슈는 아님.

---

### [INFO] `contextScope` enum에 `auto` 추가 거부 — 새 Rationale 명시됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.9
- **과거 결정 출처**: 이 기각 결정 자체가 이번 target에서 처음 명시됨 (이전 Rationale에 해당 항목 없음)
- **상세**: `contextScope` enum에 `auto` 값을 추가하는 설계 대안을 명시적으로 검토하고 기각한 뒤 §12.9에 근거(`contextScope`는 "범위 축", `memoryStrategy`는 "관리 축" 의미 분리)를 기술했다. 과거 spec에 이 기각 결정이 없었으므로 기각된 대안의 "재도입"에 해당하지 않는다. 신규 결정 + Rationale 동반 작성으로 절차를 준수했다.
- **제안**: 없음. 적절하게 처리됨.

---

### [INFO] `memoryStrategy: 'manual'` 하에서 char-cap과 token-budget의 상호 배타 명시 위치

- **target 위치**: `spec/conventions/conversation-thread.md` §5.3 하단 추가 블록
- **과거 결정 출처**: `spec/conventions/conversation-thread.md` §5.3 "Cap (v1 — char 기반)" — char-cap 이 단일 메커니즘으로 기술됨
- **상세**: target은 §5.3에 "`memoryStrategy: 'manual'` 한정, 자동 전략은 token-budget 으로 대체, 두 메커니즘 상호 배타" 를 추가했다. char-cap을 폐기한 것이 아니라 `manual` 모드에 한정했으므로 §5.3 의 기존 규약을 직접 번복하지는 않는다. 다만 §5.3 헤더 자체가 "(v1 — char 기반)" 이어서, token-budget 모드가 같은 v1 노드에 존재함을 헤더만 보고는 알기 어렵다.
- **제안**: §5.3 헤더를 "Cap — char 기반 (manual 모드 한정)" 또는 동등한 표기로 조정하거나, 본문 첫 줄에 "본 cap 은 `memoryStrategy: 'manual'` (기본) 모드에만 적용된다" 를 명시하면 Rationale 연속성이 더 명확해진다. 차단 이슈 아님.

---

### [INFO] `요약 LLM 콜은 노드 model/llmConfigId 재사용` — 별도 모델 필드 없음 결정의 Rationale 부재

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 단계 1.5 (`summary_buffer`/`persistent` 분기)
- **과거 결정 출처**: 해당 결정은 이번 target에서 처음 등장 (이전 spec에 관련 항목 없음)
- **상세**: 요약 LLM 콜에 별도 모델 선택 필드를 두지 않고 노드의 `model`/`llmConfigId`를 재사용한다는 결정이 §6.1 본문에 단 한 줄("별도 모델 필드 없음")로만 기술된다. 이 결정은 사용자에게 비용 영향이 있는 trade-off(요약에 비싼 모델이 쓰일 수 있음)인데 Rationale에 별도 항목이 없다. §12.10 및 §12.11은 요약 블록 배치 위치에 대한 근거는 다루지만 왜 별도 모델 필드를 두지 않는지는 다루지 않는다.
- **제안**: §12.10 또는 §12.11에 "요약 LLM 콜 모델 선택 — 별도 필드 없음" 소항을 추가하고, 재사용 이유(사용자 설정 단순화, 모델 drift 방지, 사용자가 이미 인지한 모델로 일관성 유지)와 기각된 대안(별도 `summaryModel` 필드)을 기술하면 이후 변경 시 기준이 된다.

---

## 요약

이번 target (`spec/4-nodes/3-ai/` — `memoryStrategy`/`summary_buffer`/`persistent` 도입)은 과거 spec에서 명시적으로 기각된 대안을 이유 없이 재도입하거나 합의된 invariant를 직접 위반하는 사례가 없다. v1/v2 경계의 부분 번복(token-aware cap, DB 영속)은 §12.10에서 명시적 Rationale과 함께 처리됐고, `contextScope` enum 확장 대안은 §12.9에서 신규 기각 결정으로 문서화됐으며, `conversation-thread.md` v2 로드맵도 "부분 실현/v3 잔존" 분리로 갱신됐다. 다만 §12.1 v1/v2 경계표 본문, §5.3 헤더 정합, 요약 LLM 모델 재사용 결정의 Rationale 부재 등 세 지점에서 정합 보완 여지가 있다. 전체 위험도는 낮음(LOW)으로 평가한다.

---

## 위험도

LOW
