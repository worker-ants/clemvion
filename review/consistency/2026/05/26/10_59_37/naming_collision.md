# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/2-navigation/`

---

## 발견사항

### [WARNING] R-13 Rationale ID 가 두 spec 파일에서 다른 의미로 사용 중

- **target 신규 식별자**: `spec/2-navigation/2-trigger-list.md §Rationale ### R-13` — "호출 이력 Dialog 항목에 실행 상세 drill-down Link 추가 (2026-05-26)"
- **기존 사용처**: `spec/6-brand.md:359 ### R-13` — "§8 부분 롤백 결정 (2026-05-15, Stage 1 직후 동일자)" (컬러 토큰 정식화 폐기 결정)
- **상세**: `spec/2-navigation/2-trigger-list.md §2.1` 의 더보기 메뉴 ③ 행에서 "Rationale R-13" 으로 문서 내부 앵커를 참조하는 표현이 사용된다. `spec/6-brand.md` 도 동일한 `R-13` 번호를 다른 결정(브랜드 §8 롤백)에 사용하고 있다. Rationale ID 는 문서 로컬 앵커이므로 동일 문서 내에서는 혼동이 없다. 그러나 `spec/2-navigation/_layout.md:153` 과 `spec/2-navigation/10-auth-flow.md:452/458/462` 에서 cross-file 참조 시에는 `spec/6-brand.md R-13` 으로 명시적으로 한정하여 사용하고 있다. 반면 `2-trigger-list.md §2.1` 의 inline "Rationale R-13" 은 한정 없이 기술되어, 미래 독자가 brand spec 의 R-13 과 혼동할 수 있는 맥락이 형성된다.
- **제안**: `2-trigger-list.md §2.1` 의 "Rationale R-13" 참조를 "[Rationale R-13](#r-13-호출-이력-dialog-항목에-실행-상세-drill-down-link-추가)" 형식의 명시적 앵커 링크로 교체하거나, 해당 문장에 "(본 문서 Rationale)" 부기를 추가하여 cross-file 참조와의 혼동을 방지한다. brand spec 쪽에서 식별자를 바꿀 필요는 없다 — 발견 순서로 2-trigger-list.md 가 나중이므로 해당 문서의 기술 방식을 명확히 하는 것이 영향 범위가 작다.

---

### [INFO] `spec/2-navigation/6-config.md §B.2` "Fallback" 항목과 계획 변경의 정합성

- **target 신규 식별자**: 계획 파일 `plan/in-progress/llm-model-select-only.md` 가 `spec/2-navigation/6-config.md` 의 "Fallback" bullet 을 삭제 예정으로 명시
- **기존 사용처**: `spec/2-navigation/6-config.md:114` — "목록에 없는 모델 ID를 직접 타이핑할 수 있으며, 조회 실패 시에도 자유 입력이 가능하다." 현재 spec 본문에 이 동작이 명시되어 있음
- **상세**: 본 충돌 검토 시점에 spec 파일은 아직 수정되지 않았다 (git status 상 변경 없음). 구현 착수 전에 먼저 spec 을 갱신하는 것이 SDD 절차이므로, 현 시점 spec 본문과 계획 의도 간에 괴리가 있다. 구현 코드 파일(`model-combobox.tsx`) 이 실제로 select-only 로 전환되면 기존 spec 의 "Fallback" 자유 입력 정의와 충돌한다.
- **제안**: 구현 착수 전에 `spec/2-navigation/6-config.md §B.2` "Fallback" bullet 을 삭제하고 Rationale 섹션에 select-only 전환 근거를 기록한다. 계획 파일이 이를 정확히 안내하고 있으므로 절차상 정합이 필요한 타이밍 문제다.

---

### [INFO] `spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델` 항목과 `spec/5-system/8-embedding-pipeline.md §EmbeddingModelCombobox` 설명의 미세 의미 차이

- **target 신규 식별자**: 계획 파일이 `5-knowledge-base.md §2.2` 의 "임베딩 모델" 필드 설명을 "지정된 LLMConfig 의 임베딩 모델 목록을 불러와 select 로 선택" 으로 수정 예정
- **기존 사용처**: `spec/5-system/8-embedding-pipeline.md:322` — "`EmbeddingModelCombobox` 신설(default LLM Config 의 embedding 모델 datalist + graceful degrade)"
- **상세**: 임베딩 파이프라인 spec 은 `EmbeddingModelCombobox` 를 "default LLM Config 의 embedding 모델 datalist" 로 정의하고 있다. 계획의 수정 방향("지정된 LLMConfig 의 임베딩 모델 목록") 은 "default" 한정인지, 사용자가 선택한 임의의 LLMConfig 인지 모호하다. `5-knowledge-base.md §2.2` 의 "임베딩 모델" 필드 설명은 어떤 LLMConfig 에서 모델 목록을 가져오는지를 명시해야 한다. 또한 `embedding-pipeline.md` 의 "datalist" 표현은 select-only 전환 후에도 그대로 남아 있을 경우 spec 내부 drift 가 발생한다.
- **제안**: `spec/2-navigation/5-knowledge-base.md §2.2` 수정 시 LLMConfig 의 선택 범위(전체 목록 중 사용자 선택 vs 워크스페이스 default) 를 명시하고, 이에 맞춰 `spec/5-system/8-embedding-pipeline.md:322` 의 "datalist" 표현도 "select" 또는 "select-only" 로 일치시킨다.

---

## 요약

`spec/2-navigation/` 영역이 도입하는 식별자 중 CRITICAL 수준의 충돌은 발견되지 않았다. API endpoint, 엔티티/타입명, 요구사항 ID(EH-LIST-*, EH-DETAIL-*, EH-NAV-*, NAV-WF-*, NAV-SC-* 등), 이벤트/메시지명, 환경변수, 파일 경로 모두 기존 corpus 와 의미적으로 충돌하지 않는다. 단, `spec/2-navigation/2-trigger-list.md` 의 Rationale R-13 이 `spec/6-brand.md` 의 R-13 (전혀 다른 결정)과 동일 번호를 사용하고 있어 미래 독자가 혼동할 수 있는 WARNING 수준의 이슈가 있다. 그 외 두 건은 계획된 spec 수정이 구현 전에 선행되어야 하거나, 연관 spec 파일과의 표현을 일치시켜야 하는 INFO 수준의 보완 사항이다.

## 위험도

LOW

STATUS: SUCCESS
