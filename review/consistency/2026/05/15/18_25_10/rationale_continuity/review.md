# Rationale 연속성 검토 — brand-refresh spec draft

검토 대상: `plan/in-progress/spec-draft-brand-refresh.md`
보조 코퍼스: `spec/1-data-model.md`, `spec/2-navigation/1-workflow-list.md`, `spec/2-navigation/4-integration.md`, `spec/2-navigation/9-user-profile.md`, `spec/3-workflow-editor/4-ai-assistant.md` 의 `## Rationale` 발췌

---

### 발견사항

- **[INFO]** 보조 코퍼스 Rationale 과 브랜드 개정안 간 직접적 충돌 없음 — 도메인 분리 확인
  - target 위치: 문서 전체 (§8.1 ~ §8.6, R-1 ~ R-8)
  - 과거 결정 출처: `spec/1-data-model.md`, `spec/2-navigation/*.md`, `spec/3-workflow-editor/4-ai-assistant.md` 의 `## Rationale`
  - 상세: 보조 코퍼스 Rationale 은 execution model, OAuth 통합, user-profile UX, workflow AI 어시스턴트 프롬프트 구조 등 브랜드와 이질적인 도메인을 다루므로, target 문서(Visual Identity 개정)와 직접 충돌하는 항목이 식별되지 않는다.
  - 제안: 해당 없음.

- **[WARNING]** `§8.4.4` 워드마크 2-tone 허용 — "단색만 허용" 규정 폐기 시 새 Rationale 이 기술됐으나, 폐기 대상 원문 spec 조항이 명시되지 않음
  - target 위치: `§8.4.4 워드마크 사용 규정` 및 `R-3. 워드마크 2-tone 시그니처 채택 (단색 규정 폐기)`
  - 과거 결정 출처: 현행 `spec/6-brand.md §8` (임시 가이드) 의 "단색 또는 단색 반전만 허용" 조항
  - 상세: target 문서 R-3 에서 단색 규정 폐기 근거를 상세히 서술하고 있어 새 Rationale 작성 요건은 충족한다. 그러나 "폐기 대상 원문이 현행 spec 의 어느 섹션·항목이었는지"를 R-3 에서 직접 인용하지 않아, 향후 spec 이력 추적 시 어디서 왔는지 불명확하다.
  - 제안: R-3 에 "기각된 규정 원출처: `spec/6-brand.md` 구 §8.4 (임시 가이드 시절 조항)" 한 줄을 추가해 이력 추적성을 확보한다.

- **[INFO]** `§8.6 임시 자산 마이그레이션` — 폐기 자산 목록이 코드 경로 레벨에서만 명시되고, 폐기 이유(임시 가이드 출처)가 R-1/R-7 에 분산돼 있음
  - target 위치: `§8.6` 전체
  - 과거 결정 출처: 해당 spec 자체의 R-1 (모티프 전환), R-7 (자산 9종 정식화)
  - 상세: §8.6 본문에서 "이전 임시 자산(덩굴 + 잎 곡선 모티프)은 본 §8 발효와 함께 폐기 대상"이라 명시했고 R-1·R-7 에서 모티프 전환 및 자산 정식화 근거를 기술했다. 연속성 관점에서 Rationale 이 존재하므로 원칙 위반이 아니다. 다만 §8.6 에서 Rationale 항목으로 직접 교차 참조를 달면 문서 간 탐색이 용이해진다.
  - 제안: §8.6 서두에 `(근거: R-1, R-7 참조)` 한 줄 추가 권장.

- **[INFO]** `§8.2.4 코드 토큰 매핑` — 구현 위임 규약이 spec 본문에 기술됐으나 Rationale 에 별도 언급 없음
  - target 위치: `§8.2.4 코드 토큰 매핑`
  - 과거 결정 출처: CLAUDE.md 및 프로젝트 규약 "spec 은 정의, 코드 매핑은 developer skill 이 결정"
  - 상세: `§8.2.4` 가 "CSS 변수·Tailwind 매핑은 developer skill Stage 2 에서 수행한다. spec 은 HEX 정의를 보유하고 코드 토큰 이름은 구현 시 결정한다"고 명시해 프로젝트 SDD 원칙과 정합한다. Rationale 에 이 결정의 배경을 기록하지 않아도 원칙 위반은 아니지만, 추후 reviewer 가 "왜 코드 이름을 spec 에 고정하지 않았는지" 의문을 가질 수 있다.
  - 제안: R-7 또는 신규 R-9 에 "spec 은 HEX 의미 토큰만 보유, CSS/Tailwind 이름은 구현 시점 결정 — spec/구현 경계 원칙 준수" 한 줄 추가 권장.

- **[INFO]** `§8.4.6 로고 노출 자리` — `spec/2-navigation/_layout.md §2.1` 과의 우선순위 관계 기술
  - target 위치: `§8.4.6` 첫 문장 "본 §8 은 다음 자리에서의 로고 노출을 정식 사양으로 둔다 (개별 라우트 spec 보다 우선)"
  - 과거 결정 출처: `spec/2-navigation/_layout.md §2.1` (직접 Rationale 발췌 미포함이나 관련 spec 으로 참조됨)
  - 상세: 본 target 이 `_layout.md §2.1` 보다 §8 을 우선 적용한다고 선언하나, 이 우선순위 결정의 근거가 Rationale 에 기록돼 있지 않다. 단, 브랜드 spec 이 개별 라우트 spec 에 우선하는 것은 제품 일관성 원칙상 자연스러운 결정으로, 합의 원칙을 명시적으로 위반하지 않는다.
  - 제안: R-7 또는 별도 R-8 확장으로 "§8 이 개별 라우트 spec 보다 우선하는 이유: 브랜드 가이드는 제품 전체의 시각 언어 SSOT 이므로 개별 화면 spec 의 로고 처리보다 상위에 둔다" 추가 권장.

---

### 요약

보조 코퍼스로 제공된 spec Rationale 들은 execution model, OAuth/통합, user-profile UX, AI 어시스턴트 등 브랜드와 이질적인 도메인을 다루므로 target 문서(Visual Identity 개정)와 직접적으로 충돌하는 기각된 대안의 재도입이나 합의 원칙 위반은 발견되지 않는다. target 문서 자체의 R-1 ~ R-8 은 모티프 전환·컬러 ramp 확장·2-tone 허용·다크 모드 동시 도입·서브카피 상시 부착·favicon 별도 vector 등 각 결정의 근거와 기각 대안을 충실히 기술해 Rationale 연속성 요건을 대체로 충족한다. 다만 (1) "단색만 허용" 폐기 원문의 spec 내 위치를 R-3 에서 명시하지 않은 점, (2) §8.4.6 우선순위 선언의 Rationale 미기재, (3) §8.2.4 코드 토큰 위임 결정의 Rationale 부재 가 INFO/WARNING 수준의 보완 사항으로 식별된다. 이들은 연속성을 심각하게 훼손하지 않으나, 이력 추적성과 향후 reviewer 가독성을 위해 Rationale 보강이 권장된다.

---

### 위험도

LOW
