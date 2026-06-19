# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (scope: `spec/4-nodes/3-ai/`)
검토 대상: `spec/4-nodes/3-ai/0-common.md`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md`
기준 Rationale: 동일 spec 내 `## Rationale` / `## 12. Rationale` / `## 9. Rationale` + cross-spec Rationale 발췌

---

## 발견사항

명시적 차단 발견사항 없음. 주요 Rationale 항목별 확인 결과를 아래에 기술한다.

---

#### 확인 1: `summaryModel`/`extractionModel` 필드 도입 (§12.12 번복 결정)

- target 위치: `1-ai-agent.md §1` config 표 (`summaryModel`, `extractionModel` optional 필드)
- 과거 결정 출처: `1-ai-agent.md §12.12` — v1 에서 "요약·추출 전용 LLM 모델 필드"를 scope-freeze 이유로 기각
- 상세: §12.12 가 이 번복을 명시하고 근거 3가지를 구체적으로 기술한다 — (1) 비용 절감, (2) 품질 요구 분리의 정당성, (3) fallback 체인으로 하위호환 100% 유지. 의도된 번복이며 새 Rationale 동반.
- 판정: 충돌 없음.

---

#### 확인 2: `conversationHistory`/`historyCount` 제거 (§12.2)

- target 위치: `1-ai-agent.md §1` — 두 필드 부재, `contextScope`/`contextScopeN` 대체
- 과거 결정 출처: `1-ai-agent.md §12.2` — deadweight 필드 제거 및 대체 경로 명시
- 상세: 옛 필드가 handler 코드에서 한 번도 읽히지 않는 deadweight 였음을 §12.2 가 기술. DB legacy row 는 `.passthrough()` 로 silently 통과. 번복 근거와 대체 경로 완비.
- 판정: 충돌 없음.

---

#### 확인 3: `render_form` 활성 form 의 timeline 인라인 표현 통합 (§12.5)

- target 위치: `1-ai-agent.md §6.1.d.ii`, `§6.2 step 2.c.bypass`, `§7.10`
- 과거 결정 출처: `1-ai-agent.md §12.5` — 활성 form 이 "별도 stack surface" 이던 옛 표현 명시적 폐기
- 상세: §12.5 는 3가지 회귀 문제를 나열하고 "옛 표현은 폐기 (§12.5 Rationale)" 를 명기한다. 현재 spec 은 `presentations[]` 기반 inline 렌더로 일관되게 기술.
- 판정: 충돌 없음.

---

#### 확인 4: D6 결정 (waiting/resumed 출력 경로 단일화)

- target 위치: `1-ai-agent.md §7.4` `output.result.messages/message/turnCount`, `3-information-extractor.md §5.4`
- 과거 결정 출처: `1-ai-agent.md §7.5` D6 주석 — "옛 top-level `output.messages`/`.message`/`.turnCount` 폐기, `output.result.*` 단일 경로"
- 상세: D6 가 제거한 것은 top-level direct 필드(`output.messages`)이다. `output.result.message` (result wrapper 내부) 는 D6 이후 유지된 별도 필드로 ai-agent §7.4 와 IE §5.4 모두에서 "WS 페이로드 구성 편의용" 명시와 함께 보존. `output.maxTurns` 는 output 에 없고 `config.maxTurns` 로만 노출(Principle 1.1).
- 판정: 충돌 없음.

---

#### 확인 5: IE `memoryStrategy` 에 `summary_buffer` 값 부재 (§9.1)

- target 위치: `3-information-extractor.md §1` config 표 `memoryStrategy` = `manual` / `persistent` 2값
- 과거 결정 출처: `3-information-extractor.md §9.1` — 추출 노드에 working-memory 압축이 무의미함을 명시, `summary_buffer` 의도적 제외
- 상세: `0-common.md §10` 도 `information_extractor` 는 `manual`/`persistent` 2값 이라고 명시하여 cross-spec 정합.
- 판정: Rationale 과 spec 일치. 충돌 없음.

---

#### 확인 6: `tool_call_not_implemented` gap (미구현 Planned)

- target 위치: `1-ai-agent.md §6.1 단계 3.a`
- 과거 결정 출처: `1-ai-agent.md §12.4` `tool_*` 슬롯 재작성 대기 결정; `§1`/`§4` `⚠ 재작성 예정 (현재 제거됨)` 경고 블록
- 상세: §6.1 단계 3.a 에 현행 가짜 성공 stub 동작과 `tool_call_not_implemented` 미구현 상태가 명시됨. 기각된 대안의 재도입이 아니라 재설계 유보 상태의 투명한 문서화.
- 판정: 충돌 없음. 구현자에게 알려진 갭.

---

#### 확인 7: `memoryStrategy` 별도 필드 (`contextScope` enum 확장 대안 기각)

- target 위치: `0-common.md §10` `contextScope` / `memoryStrategy` 독립 필드 정의
- 과거 결정 출처: `1-ai-agent.md §12.9` — `contextScope` 에 `auto` 를 추가하는 대안 명시적 기각
- 상세: 기각 근거로 (1) 두 축 의미 혼재, (2) 하위호환 복잡화, (3) `visibleWhen` 단순화 3항목 기술. 현재 spec 은 `contextScope` 에 `auto` 값 없음.
- 판정: 기각된 대안 재도입 없음. 충돌 없음.

---

#### 확인 8: 알려진 결함 W-1 (`config.schema` vs `outputSchema` 명칭 불일치)

- target 위치: `3-information-extractor.md §5.1`/`§5.4` 출력 표 등 ~15곳의 `config.schema` 표기
- 과거 결정 출처: `3-information-extractor.md §9.3` W-1 주석 — CONVENTIONS Principle 7(config echo 는 원본 필드명) 충돌을 자기 인식된 기술 부채로 명문화, rename 을 후속 작업으로 이연
- 상세: Rationale 위반이 아니라 자기 인식된 기술 부채의 이연 결정이다. 구현자는 이 불일치를 인지하고 구현해야 하며 현재 상태를 fix 하는 것은 이 impl 의 scope 밖임이 명시됨.
- 판정: Rationale 연속성 범주(기각된 대안 재도입 / invariant 우회)에 해당하지 않음. INFO 수준.

- **[INFO]** W-1 config.schema/outputSchema 명칭 불일치 이연
  - target 위치: `spec/4-nodes/3-ai/3-information-extractor.md §5.1, §5.4, §5.5` 등 ~15곳
  - 과거 결정 출처: `3-information-extractor.md §9.3 W-1` (CONVENTIONS Principle 7 충돌 명시)
  - 상세: config echo 원본 필드명 원칙(Principle 7) 과 실제 echo 필드명(`config.schema`) 이 불일치한다는 사실이 §9.3 W-1 에 명시됨. 이연 결정도 함께 기록되어 있으나, 이 불일치는 구현 시 다운스트림 expression 접근 경로(`$node["X"].config.schema`)를 결정할 때 혼란을 줄 수 있다.
  - 제안: 구현자가 `config.schema` 를 expression 접근 경로로 사용 시, W-1 이연 결정을 인지하고 `outputSchema` 와 구분하여 처리할 것. 이 이연 fix 자체는 현 impl scope 밖이므로 후속 plan 으로 유지.

---

## 요약

`spec/4-nodes/3-ai/` 4개 파일을 기존 Rationale(`1-ai-agent.md §12.*`, `3-information-extractor.md §9.*`, `0-common.md ## Rationale`) 및 cross-spec Rationale 발췌와 대조한 결과, 명시적으로 기각된 대안의 재도입, 합의 원칙 위반, 또는 무근거 번복이 발견되지 않았다. 주요 번복 결정(`summaryModel`/`extractionModel` 도입, `conversationHistory` 제거, `render_form` timeline 통합)은 모두 해당 Rationale 절에서 이유와 함께 명문화되어 있다. `tool_*` 재작성 유보 및 IE `config.schema` W-1 이연은 각각 경고 블록과 알려진 결함 주석으로 구현자에게 명시되어 있다. INFO 1건(W-1 이연 인지 권고) 외 구현 착수를 Rationale 연속성 관점에서 차단할 요소는 없다.

## 위험도

NONE
