# Rationale 연속성 검토 결과

검토 모드: --impl-done (V-02 IE/TC auto-form 이행 + spec §2.6.3 트랙 배정 갱신 + R-3 Rationale + override-registry 회귀 테스트 + CHANGELOG)
diff-base: origin/main

---

### 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

**[INFO]** R-3 Rationale 이 기각 사유를 구체적으로 기록했으나 "기각된 대안" 형식이 아닌 "폐기 이유" 형식으로만 서술됨
- target 위치: `spec/3-workflow-editor/1-node-common.md` § Rationale R-3
- 과거 결정 출처: 해당 없음 (R-3 자체가 신규 결정 항목)
- 상세: R-3 는 bespoke 폼 폐기 결정을 기록하면서 "왜 폐기했는가"(필드 누락 사유) 는 명시했지만, "bespoke override 를 유지하는 대안을 왜 기각했는가" 라는 대안 비교 형식은 없다. 그러나 이는 대안 비교가 불필요할 만큼 상황이 단방향이었기 때문(기존 bespoke 가 스키마 힌트를 무시하여 필드를 렌더 못 하는 결함이 이미 명백)이므로, 형식적 보완 필요성은 낮다.
- 제안: 선택 사항으로, R-3 에 "bespoke 폼 수정 후 유지하는 대안을 검토하지 않은 이유" 를 한 줄 추가하면 후속 독자가 "왜 수정이 아닌 폐기인가" 를 자문하는 일을 없앨 수 있다. 예: "bespoke 폼을 수정해 누락 필드를 추가하는 대안도 있었으나, schema 가 이미 full ui 힌트를 방출하고 있어 bespoke 컴포넌트 유지 자체가 잉여이므로 제거를 선택."

---

### 요약

이번 변경(`text_classifier` · `information_extractor` bespoke override 폼 제거 + `OVERRIDE_REGISTRY` 미등록 회귀 테스트 + §2.6.3 트랙 배정 갱신)은 spec `3-workflow-editor/1-node-common.md` Rationale 에 기록된 어떤 기각된 대안도 재도입하지 않으며, 합의된 2-트랙 렌더 전략(R-2) 을 정확히 따르고 있다. R-3 는 이번 결정의 신규 Rationale 로 함께 작성되어 "결정의 무근거 번복" 이 아니다. `OVERRIDE_REGISTRY` 미등록 상태를 고정하는 회귀 테스트는 §2.6.3 의 트랙 배정 invariant 를 코드 레벨에서 enforcement 하며 spec 의 합의 원칙을 강화한다. INFO 1건은 Rationale 문체 보완 제안이며 차단 사유가 아니다.

### 위험도

NONE
