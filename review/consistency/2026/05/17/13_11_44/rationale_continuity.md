# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-2-navigation-hygiene.md`
검토 시각: 2026-05-17

---

### 발견사항

- **[INFO]** Change A (자기 참조 링크 제거) — 관련 Rationale 결정 없음, 독립 변경으로 안전
  - target 위치: target 문서 §3.1 / 의사결정표 §4 첫 행
  - 과거 결정 출처: 해당 Rationale 없음 (docs-consolidation 2026-05-12 이후 자기 참조 링크 존재 자체가 위생 결함으로 식별)
  - 상세: `spec/2-navigation/14-execution-history.md` 줄 3 의 `[PRD 실행 내역](./14-execution-history.md)` 링크는 docs-consolidation 후 PRD 가 본 파일의 §Overview 로 흡수된 결과다. 어떤 Rationale 에도 "자기 참조 링크를 유지한다" 거나 "다른 처리 방식을 기각했다" 는 기록이 없다. 단순 제거는 과거 결정과 충돌하지 않는다.
  - 제안: 현행 처리 그대로 진행해도 Rationale 연속성 위배 없음.

- **[INFO]** Change B (`autoRefresh` derived 필드 주석) — 기존 Rationale 과 완전 정합
  - target 위치: target 문서 §3.2 / 의사결정표 §4 두 번째 행
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` Rationale "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)"
  - 상세: 해당 Rationale 이 이미 다음을 명문화했다.
    - `autoRefresh` 는 DB 컬럼이 아닌 derived 필드이며 `ServiceDefinition.supportsTokenAutoRefresh` 에서 매 응답 시점에 계산된다.
    - "옛 attention 술어 SQL 에 `service_type IN ('cafe24', 'google')` 같은 하드코딩을 두는 안" 이 기각됐다.
    - `data-model.md §2.10` 본문에 이 사실이 아직 명시되지 않아 구현자가 DB 컬럼으로 오인할 위험이 있다고 cross-spec checker 가 W-1 로 보고했다.
  - target 문서의 Change B 는 이 결정을 data-model 에 반영해 단일 진실 원칙을 완성하는 보완이다. 어떤 기각된 대안도 재도입하지 않는다.
  - 제안: 현행 처리 그대로 진행. 주석 본문에서 "DB 컬럼이 아니다" 표현을 명확하게 포함하는 것이 중요하며 target §3.2 After 에 이미 반영돼 있음.

- **[INFO]** 범위 밖 항목 처리 방식 — 기각 아닌 보류
  - target 위치: target 문서 §2 "본 PR 범위 밖" 표 및 §4 의사결정표 W-6/W-5/W-7/I-* 행
  - 과거 결정 출처: CLAUDE.md "응집도 분리 원칙" / 개별 해당 Rationale 없음
  - 상세: W-6 (`prd/` 출처 blockquote 줄 9 처리), W-5/W-7/I-* 를 본 PR 에서 제외하고 별도 plan 으로 분리한 것은 과거 어떤 spec Rationale 에서도 이를 반드시 함께 처리해야 한다고 정의한 적이 없다. 단순 보류이며 기각된 대안의 재도입이나 합의된 invariant 위반에 해당하지 않는다.
  - 제안: 후속 plan (`spec-update-2-navigation-hygiene-followup.md`) 을 실제로 신설해 추적 상태를 유지하면 충분.

---

### 요약

target 문서가 제안하는 두 가지 spec 변경(Change A: 자기 참조 링크 제거, Change B: `autoRefresh` derived 필드 주석 추가) 은 모두 기존 Rationale 코퍼스와 충돌하지 않는다. Change A 는 어떤 Rationale 도 건드리지 않는 위생 패치이고, Change B 는 `spec/2-navigation/4-integration.md` 의 "자동 갱신 통합을 attention 술어에서 제외 (2026-05-17)" Rationale 에서 이미 결정·명문화된 derived 필드 사실을 data-model 문서에 전파하는 일관성 보완으로, 기각된 대안(SQL 하드코딩) 과 정반대 방향이다. 기각된 대안의 재도입, 합의된 원칙 위반, 무근거 번복, 암묵적 가정 충돌 어느 항목도 해당 없다.

---

### 위험도

NONE
