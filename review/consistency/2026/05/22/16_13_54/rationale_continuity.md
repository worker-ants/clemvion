# Rationale 연속성 검토 결과

**검토 대상**: `plan/in-progress/ai-presentation-tools.md`
**검토 모드**: spec draft 검토 (--spec)
**검토 일시**: 2026-05-22
**참조 Rationale 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §12`, `spec/4-nodes/6-presentation/0-common.md §Rationale`, `spec/0-overview.md §Rationale`, `spec/conventions/conversation-thread.md §Rationale`

---

## 발견사항

### [INFO] `PRESENTATION_RENDER_SCHEMA_INVALID` 에러 코드 신설 여부 — plan 미결 표기, spec 은 이미 결정됨

- **target 위치**: `plan/in-progress/ai-presentation-tools.md §4.1` 항목 "§10 에러 코드: PRESENTATION_RENDER_SCHEMA_INVALID (text fallback 분기 후 expose 안 함 — meta 한정) — 또는 코드 신설 없이 meta 로 surface 만 (결정 §4.1 본문 참조)"
- **과거 결정 출처**: `spec/4-nodes/3-ai/1-ai-agent.md §10` (에러 코드 표, §967 주석), `§12.4 Schema 위반의 silent fallback 결정`
- **상세**: plan 이 작성된 시점에는 에러 코드 신설 여부를 "(결정 §4.1 본문 참조)" 로 유보했으나, spec 이 이미 갱신되어 `PRESENTATION_RENDER_SCHEMA_INVALID` 에러 코드를 §10 표에 추가하지 않는 것으로 확정됐다. `meta.presentationSchemaViolations[]` 단일 경로만 사용. plan 의 "또는 코드 신설 없이 meta 로 surface 만" 분기가 실제 채택된 방향이나, plan 문서 본문에는 여전히 양자택일 형태로 남아 있어 독자가 미결 사항으로 오해할 수 있다.
- **제안**: plan 문서가 이미 spec 갱신 이후 산출물이므로 즉각 수정 대상이기보다 plan 을 `plan/complete/` 로 이동 시 또는 구현 착수 전 해당 행을 "에러 코드 없음 — meta.presentationSchemaViolations[] 단일 경로 확정" 으로 정리. 현 상태에서 구현 혼선을 줄이려면 plan §4.1 주석 행 정리를 권장한다.

---

### [INFO] `defaults` overlay 방향성 서술이 spec 과 일치하나 표현 형식 차이

- **target 위치**: `plan/in-progress/ai-presentation-tools.md §4.3` — "defaults overlay 적용 (LLM 페이로드 ∪ defaults — defaults 가 LLM 입력을 override)"
- **과거 결정 출처**: `spec/4-nodes/6-presentation/0-common.md §10.3 defaults overlay 규칙`, `spec/4-nodes/3-ai/1-ai-agent.md §1 PresentationToolDef 표`
- **상세**: 방향성 ("defaults 가 override") 은 spec 과 일치. 다만 plan 의 표현 `LLM 페이로드 ∪ defaults` 는 수학적으로 합집합 뒤에 defaults 가 오는 것처럼 읽혀, spec 의 "LLM 페이로드와 deep-merge 시 defaults 가 후순위 merge" 와 미묘하게 다른 인상을 준다 (합집합 연산 순서가 override 방향을 결정). 기각된 대안이나 원칙 위반은 아니며, 구현자가 spec 을 단일 진실로 참조한다면 혼선은 없다.
- **제안**: 구현 착수 전 plan §4.3 의 표현을 spec §10.3 의 표현 ("LLM 페이로드와 deep-merge 시 defaults 가 LLM 입력을 override") 으로 통일하면 독자 혼선 0.

---

## 요약

`plan/in-progress/ai-presentation-tools.md` 가 기술하는 설계 결정 전체 — per-node opt-in (`presentationTools[]`), `render_*` prefix 5종 동시 출시, display-only / interactive 구분, schema 위반 silent fallback (`error` 포트 미발화), 워크스페이스 전역 토글 기각, `tool_*` 재작성과의 직교성, 단일 진실 schema 재사용, 1MB cap 동일 적용 — 는 `spec/4-nodes/3-ai/1-ai-agent.md §12.4` 및 `spec/4-nodes/6-presentation/0-common.md §10` 의 Rationale 과 완전히 정합한다. 기각된 대안 (워크스페이스 전역 토글·다른 prefix·워크플로 분기 흉내·tool_* 흡수·단계 분리 출시) 도 plan 의 §3 기각 대안 표와 spec Rationale 의 기각 목록이 일치한다. 발견된 사항은 모두 INFO 등급으로, plan 이 spec 보다 앞서 작성된 과정에서 생긴 소소한 서술 잔재이며 기각된 결정의 재도입이나 합의 원칙 위반은 없다.

---

## 위험도

NONE
