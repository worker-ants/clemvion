# Rationale 연속성 검토 — AI Timezone Context (spec/4-nodes/3-ai/)

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/4-nodes/3-ai/0-common.md §11`, `1-ai-agent.md`, `2-text-classifier.md`, `3-information-extractor.md` (2026-05-18 system-context PR 변경분)

---

### 발견사항

- **[INFO]** 기각 대안 (A) — opt-in 기본값 — 의 Rationale 기재 방식이 충분함
  - target 위치: `spec/4-nodes/3-ai/0-common.md §Rationale "시스템 컨텍스트 자동 주입" 대안 (A)`
  - 과거 결정 출처: 동일 Rationale 신설 항 (본 PR 최초 도입이므로 선행 상충 Rationale 없음)
  - 상세: 대안 (A) opt-in 기각 이유가 "토큰 비용 미미 + 자동 보호 기대" 로 명시되어 있다. 단, "Anthropic / OpenAI 의 default system prompt 컨벤션"이라는 근거가 사실 확인 대상이다 — Anthropic/OpenAI 는 실제로 default system prompt 에 현재 시각을 자동 제공하는 경우가 있으나, 모든 API tier/모든 모델에 해당하지는 않는다. 향후 이 근거가 변경되더라도 "토큰 비용 미미 + 회귀 차단" 독립 근거가 있어 결정 자체에는 영향 없음.
  - 제안: Rationale 기재는 충분. "Anthropic/OpenAI default system prompt" 주석에 "일부 API tier/assistant product 에 한정" 문구를 부기하면 오독 방지에 유용.

- **[INFO]** `includeSystemContext` default `true` 적용 시 기존 워크플로우 동작 변화 — Rationale 문서화 충분, 구현 보호책 명시 필요
  - target 위치: `0-common.md §11.1` "기존 row 해석 정책" 박스
  - 과거 결정 출처: 없음 (신설 기능). 그러나 `conversationHistory` 제거 Rationale (`1-ai-agent.md §12.2`) 에서 "schema `.passthrough()` 로 legacy 필드가 silently 통과하므로 별도 마이그레이션 불필요" 원칙 선례가 있다.
  - 상세: 기존 row 에 `includeSystemContext` 필드가 부재하면 backend 가 default `true` 로 해석한다. 이는 기존 워크플로우 LLM 호출에 ~30 토큰의 prefix 가 새로 붙는 **opt-out 필요 breaking-adjacent 변경**이다. `conversationHistory` 제거 (§12.2) 는 "noop field 제거"였으나 본 변경은 "noop → active behavior" 방향 전환이다. Rationale 이 DB 마이그레이션 미실시와 opt-out 정책을 명시적으로 기재한 것은 올바르다. 구현 시 backend schema 의 default 로직이 실제로 `includeSystemContext: true` fallback 을 적용하는지 테스트 코드로 보장할 필요가 있다 (spec 만으로는 구현 갭 발견 불가).
  - 제안: Rationale "기존 워크플로 점진 적용" 항에 단위 테스트 보호책 (config 부재 시 default true 동작)을 구현 요구사항으로 명시 추가 권장. spec 단계에서는 INFO 수준.

- **[INFO]** `systemContextSections` 빈 배열 `[]` ≡ `includeSystemContext: false` 의 동등성 — Rationale 에 미기재
  - target 위치: `0-common.md §11.1` "빈 배열 (`[]`) 은 `includeSystemContext: false` 와 동일" 설명 한 줄
  - 과거 결정 출처: 없음 (신설 기능이므로 기각 선례 없음)
  - 상세: 두 설정이 동등하다고 선언하고 있으나 — `includeSystemContext: false` 는 명시적 opt-out, `systemContextSections: []` 는 "섹션 목록 비어있음" 이라는 다른 의미 경로다. 구현에서 두 경로를 동일하게 처리해야 하고, `output.config` echo 정책(§11.7 — default 값과 일치하면 생략)에서 빈 배열이 어떻게 취급되는지 모호하다. `[]` 가 default 값인 `['time', 'timezone']` 과 달라 echo 에 포함되어야 하는지, 아니면 실질적으로 `includeSystemContext: false` 와 동등하니 별도 처리인지 명확하지 않다.
  - 제안: Rationale 또는 §11.7 에 "빈 배열 echo 정책" 한 줄 추가. 구현자가 spec 을 보고 바로 판단 가능하도록.

- **[INFO]** `$now` UTC frozen 값의 timezone 변환 경로 — 기존 실행 엔진 Rationale 과 교차 확인
  - target 위치: `0-common.md §11.2` 섹션 표 "time" 행 "UTC `$now` → §11.3 timezone 으로 변환"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §6.2` "$now 는 UTC ISO8601" (target 내 참조로만 확인)
  - 상세: `$now` 는 execution 단위 frozen UTC 값이고, prefix 에는 워크스페이스 timezone 으로 변환된 ISO 가 출력된다. 이 변환이 LLM 에게 "현재 시각이 워크스페이스 기준으로 몇 시인지"를 알려주는 핵심 의도다. 변환 로직이 backend AI node handler 내부에 있어야 하는지, 별도 `SystemContextService`/helper 에 있어야 하는지가 spec 에 명시되지 않는다 — 세 노드 모두 동일 로직을 공유해야 하므로 구현 위치가 중요하다.
  - 제안: §11.3 에 "구현 위치: AI 공통 helper (3 노드 모두 동일 경로 사용)" 한 줄 추가하면 구현 drift 방지.

---

### 요약

이번 target 변경 (`spec/4-nodes/3-ai/` 의 §11 System Context Prefix 신설) 은 기존 Rationale 에서 명시적으로 기각된 대안을 재도입하거나 합의된 invariant 를 위반하지 않는다. 신설 기능이므로 충돌할 선행 Rationale 자체가 없고, 대안 비교 (A~D) 와 결정 근거, Cafe24 cross-channel 정합, 기존 워크플로우 점진 적용 정책이 Rationale 에 모두 기재되어 있다. 발견된 사항은 모두 INFO 등급으로, Rationale 의 일부 모호한 표현 (빈 배열 echo 정책, `$now` 변환 구현 위치 미명시) 과 "Anthropic/OpenAI default system prompt" 근거의 정밀화 제안이다. 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·시스템 invariant 우회에 해당하는 항목은 없다.

### 위험도

NONE
