# Cross-Spec 일관성 검토 결과

검토 대상: `plan/in-progress/spec-draft-2-navigation-hygiene.md`
검토 모드: --spec (spec draft 검토)
검토 시각: 2026-05-17

---

## 발견사항

### [INFO] 변경 A — 자기 참조 PRD 링크 제거는 모든 관련 spec 과 일치함
- target 위치: §3.1 — `spec/2-navigation/14-execution-history.md` 줄 3 헤더 blockquote 에서 `[PRD 실행 내역](./14-execution-history.md)` 링크 제거
- 충돌 대상: 없음
- 상세: `spec/0-overview.md §4` 영역별 진입 문서 표에서 `실행 이력` 영역의 제품 정의는 "(Overview 섹션 통합)" 으로 기재되어 있다. 즉 `14-execution-history.md` 자체가 PRD 역할을 직접 수행한다는 것이 이미 아키텍처 개요에 명시되어 있다. 따라서 자기 참조 링크 제거는 `spec/0-overview.md §4` 의 설계 의도와 완전히 정합한다. `spec/2-navigation/_product-overview.md` 는 내비게이션 영역 전체의 PRD 역할을 하므로 본 파일 헤더에 다시 연결할 필요가 없다는 draft 의 판단도 타당하다.
- 제안: 변경 그대로 진행. 충돌 없음.

---

### [INFO] 변경 B — `autoRefresh` derived 필드 주석 추가는 `spec/2-navigation/4-integration.md` 와 완전히 정합함
- target 위치: §3.2 — `spec/1-data-model.md §2.10 Integration` 표 직후 단락 추가
- 충돌 대상: `spec/2-navigation/4-integration.md §9.1`, Rationale "자동 갱신 통합을 attention 술어에서 제외"
- 상세: `spec/2-navigation/4-integration.md §9.1` 은 `autoRefresh: boolean` 이 DB 컬럼이 아닌 `ServiceDefinition.supportsTokenAutoRefresh` 에서 파생되는 derived 필드임을 이미 상세히 기술하고 있다. draft 의 §3.2 추가 단락은 동일 사실을 `spec/1-data-model.md` 에 요약 주석으로 적는 것으로, 두 문서가 같은 진실을 기술하는 정합 관계다. draft 가 제안하는 cross-ref 링크(`[Spec 통합 화면 §9.1](./2-navigation/4-integration.md#91-목록crud)`) 도 실제 `§9.1 목록/CRUD` 에 `autoRefresh` 정의가 위치하므로 앵커 대상이 올바르다.
- 제안: 변경 그대로 진행. 충돌 없음.

---

### [INFO] `spec/1-data-model.md` 의 `autoRefresh` 언급이 현재 완전히 부재함 (해소 대상)
- target 위치: §3.2 — 변경 전 상태 확인
- 충돌 대상: `spec/2-navigation/4-integration.md §9.1` (상세 정의 존재)
- 상세: 현재 `spec/1-data-model.md §2.10` Integration 표에는 `autoRefresh` 필드에 대한 언급이 없고, `§9.1` 에서만 정의된다. 이는 구현자가 Integration 데이터 모델을 읽을 때 `autoRefresh` 를 DB 컬럼으로 오인하거나 인지하지 못하는 위험을 낳는다. draft 의 변경 B 가 이를 해소하는 정확한 조치다.
- 제안: draft 의 변경 B 를 그대로 적용. INFO 등급 유지 (기존 spec 간 모순은 아니며, 단순 누락 보완).

---

## 요약

본 draft 는 두 가지 매우 좁은 위생 패치로 구성된다: (1) `spec/2-navigation/14-execution-history.md` 헤더 blockquote 의 자기 참조 순환 링크 제거, (2) `spec/1-data-model.md §2.10` 에 `autoRefresh` derived 필드 주석 추가. 두 변경 모두 `spec/0-overview.md §4` 의 영역별 PRD 구조, `spec/2-navigation/4-integration.md §9.1` 의 `autoRefresh` 정의, `spec/1-data-model.md` 의 Integration 엔티티 스키마 어느 것과도 모순이 없다. 다른 spec 영역(API 계약, 요구사항 ID, 상태 전이, RBAC, 계층 책임)에 대한 변경은 전혀 없다. 선행 `impl-prep` 검토(`review/consistency/2026/05/17/12_54_16/`) 에서 BLOCK 사유가 된 C-1(자기 참조)과 W-1(`autoRefresh` 미언급)을 정확히 타겟하는 최소 변경이며, 다른 영역과의 직접 충돌은 발견되지 않는다.

---

## 위험도

NONE
