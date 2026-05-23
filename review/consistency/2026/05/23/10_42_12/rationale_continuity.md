# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-presentation-normalize-button-ids.md`
검토 모드: spec draft 검토 (--spec)
검토 기준 Rationale 출처: `spec/4-nodes/6-presentation/0-common.md §Rationale`, `spec/4-nodes/3-ai/1-ai-agent.md §12 Rationale`

---

## 발견사항

### 발견사항 1

- **[INFO]** 기각 대안 ②의 기각 사유가 spec 기존 Rationale과 완전히 정합하나 새 Rationale에 cross-ref 미기재
  - target 위치: `spec-draft §Rationale "기각된 대안"` 표 — 대안 ② "backend 가 zod schema 의 id 를 required + default 로 변경" → 기각 사유: "schema 위반 → 재시도 1회 → silent drop 흐름이 LLM 의 자연스러운 emit 을 막아 UX 회귀"
  - 과거 결정 출처: `spec/4-nodes/3-ai/1-ai-agent.md §12.4` "Schema 위반의 silent fallback 결정" — "LLM 의 형식 위반이 워크플로 분기를 끊으면 사용자 입장에서 '가끔 텍스트만 보이다가 가끔 멈춤' 처럼 보인다". 동 §4.1 — "재시도 1회 후에도 실패: 해당 turn 의 render_* 시도는 silent drop"
  - 상세: 대안 ②의 기각 논리("id를 required로 바꾸면 LLM emit이 막힘")는 §12.4의 silent fallback 결정("LLM 형식 위반이 워크플로를 끊으면 안 됨") 과 완전히 일치한다. 위반이 아니라 올바른 계승이다. 다만 target의 기각 표에 `spec §12.4 silent fallback 결정` 에 대한 명시적 cross-ref가 없어, 향후 독자가 "왜 required 변경이 안 되는지"를 따로 추적해야 한다.
  - 제안: target Rationale "기각된 대안" 표의 대안 ② 기각 사유 셀에 "`(spec §12.4 silent fallback 원칙)`" 참조 한 줄 추가 권장. spec 자체 변경 불필요.

### 발견사항 2

- **[INFO]** `defaults overlay` 이후 button.id 보존 정책의 Rationale 연계 명시 부재
  - target 위치: `spec-draft §본문 draft step 3` — "사용자가 defaults 또는 LLM payload 에 명시한 id 는 보존"
  - 과거 결정 출처: `spec/4-nodes/6-presentation/0-common.md §10.3 Defaults Overlay 규칙` — "defaults 가 LLM 입력을 override (defaults 가 후순위 merge)". Array 규칙: "defaults 가 비어 있지 않으면 defaults 로 교체".
  - 상세: defaults overlay 후 버튼 배열 자체가 defaults로 교체될 수 있으므로, 그 배열 안의 id는 defaults가 명시한 값이 된다. target draft의 "명시한 id는 보존" 문구는 이 §10.3 overlay 규칙과 모순 없이 성립하나, overlay가 Array replacement를 하기 때문에 "LLM payload에 명시한 id"가 overlay 후에도 살아있는지 여부가 §10.3 규칙과 교차 확인이 필요하다. overlay 이후 normalize를 적용하므로 overlay가 id를 지워도 normalize가 채운다 — 실질 충돌 없음. 그러나 "명시한 id는 보존"의 '명시'가 overlay 후 남아있는 id를 뜻하는 것인지 overlay 전 LLM raw payload의 id를 뜻하는지 spec draft 본문이 모호하다.
  - 제안: target draft step 3 문구를 "overlay 및 cap 적용 후 남아 있는 button 중 id가 설정된 것은 그대로 보존하고, id가 없는 것에만 UUID v4를 채운다"로 명확화 권장. Rationale 항목 신설 불필요.

### 발견사항 3

- **[INFO]** "§1 ButtonDef.id 자동 생성 원칙의 적용 범위 확장" — 기존 Rationale에 "LLM tool 모드 적용 범위" 예외·경계가 명시되지 않았음을 target이 올바르게 인지하나, 이전 consistency-check W5 권고 (session 10_28_45)의 Rationale 갱신 범위와 target draft의 갱신 범위가 일치하는지 확인 필요
  - target 위치: `spec-draft §Rationale "§1 cross-ref 만 두고 추가 surface 신설하지 않는 이유"` — "ButtonDef.id '자동 생성' 원칙은 §1 의 단일 진실. 본 변경은 그 원칙의 적용 범위 확장이지 새 결정이 아니다."
  - 과거 결정 출처: `review/consistency/2026/05/23/10_28_45/rationale_continuity.md` 발견사항 1 (WARNING) — "`spec/4-nodes/6-presentation/0-common.md §10.5` 처리 파이프라인에 normalizeButtonIds 단계 추가" 를 권고.
  - 상세: target draft가 제안하는 spec 변경(`§10.5` step 3 신규 삽입)은 10_28_45 세션의 WARNING 권고사항 그대로를 이행한다. 따라서 기각된 대안을 재도입하거나 합의 원칙을 위반하는 요소가 없다. 이전 세션의 WARNING이 이번 draft로 해소된 것으로 연계 추적할 수 있다.
  - 제안: spec-draft의 "사전 일관성 검토 결과" 섹션(`§ 사전 일관성 검토 결과`) 의 "TBD" 항목에 `review/consistency/2026/05/23/10_28_45/rationale_continuity.md` 발견사항 1 (W5 권고)을 본 draft가 해소하는 것으로 명기 권장.

---

## 요약

`plan/in-progress/spec-draft-presentation-normalize-button-ids.md` 는 `spec/4-nodes/6-presentation/0-common.md §Rationale` 및 `spec/4-nodes/3-ai/1-ai-agent.md §12.4 Rationale` 에서 합의된 결정을 정면으로 재도입하거나 위반하는 항목이 없다. 특히 (a) 기각 대안 ② ("zod id required 변경") 의 기각 논리가 §12.4 silent fallback 결정을 올바르게 계승하고, (b) normalize 순서 ("validate → overlay → cap → normalize") 가 §10.3·§10.4·§10.5 의 기존 파이프라인 순서와 정합하며, (c) §10.6·§10.7 무영향 논거도 각 섹션의 설계 의도와 충돌하지 않는다. 발견된 세 가지는 모두 INFO 등급으로, Rationale 문서 간 cross-ref 보완 및 문구 명확화 권고 사항이며 구현 또는 spec 적용을 차단할 수준이 아니다.

---

## 위험도

LOW
