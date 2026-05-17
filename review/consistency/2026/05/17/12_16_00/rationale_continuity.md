# Rationale 연속성 검토 결과

> 검토 범위: `spec/2-navigation/` (impl-prep 모드)
> 점검 대상: 본 PR 변경 의도 (`autoRefresh` 필드 추가, `computeStatus` 수정, 상세 페이지 UI 변경)
> 참조 Rationale: `spec/1-data-model.md`, `spec/2-navigation/4-integration.md`, `spec/3-workflow-editor/4-ai-assistant.md`

---

### 발견사항

- **[INFO]** `autoRefresh` 식별자 도입 — Rationale 에 전례 없는 개념, 새 Rationale 부재
  - target 위치: "변경 의도 §1" — `IntegrationDto.autoRefresh`, `ServiceDefinition.supportsTokenAutoRefresh`
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §2.2`, §4.2, §10.5 (토큰 만료 상태 관리), `spec/1-data-model.md Rationale` (Integration 상태 Enum 정책)
  - 상세: `Integration.status` Enum (`connected`/`expired`/`error`/`pending_install`) 과 가상 필터값 분리 원칙이 spec §2.3 에 명시되어 있다. "영속화되는 상태와 화면 필터링용 술어를 분리" 가 기존 합의. 본 변경에서 `autoRefresh`(=`supportsTokenAutoRefresh`)는 DB Enum 이 아니라 서비스 레지스트리 수준의 메타데이터로 도입되어 원칙과 방향은 일치한다. 그러나 이 신규 개념이 기존 Rationale 어디에도 명시되어 있지 않으며, "autoRefresh 통합을 Need Attention / Expiring 칩 / 가상 필터에서 어떻게 다룰 것인가"에 대한 설계 근거가 spec Rationale 에 없다.
  - 제안: `spec/2-navigation/4-integration.md` 의 `## Rationale` 섹션에 "autoRefresh(supportsTokenAutoRefresh) 개념 도입 — 토큰 자동 갱신 기능이 있는 provider(Cafe24/Google) 에서 `expiring` 상태를 사용자 주의 대상에서 제외하는 근거, 향후 Attention 배너·칩·가상 필터 연동 방향" 항목을 추가한다. project-planner 위임 또는 후속 spec 갱신 시 포함.

- **[INFO]** `expiresSoon && !autoRefresh` 분기 — 기존 `computeStatus` 계약의 암묵적 확장
  - target 위치: "변경 의도 §2" — `computeStatus` 의 `expiresSoon` 분기 변경
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §2.2` 상태 아이콘 정의 (🟡 expiring: 7일 이내), §2.3 Expiring 칩 정의, §9.1 `?status=expiring` 가상 필터
  - 상세: spec §2.2 는 `token_expires_at` 이 7일 이내이면 🟡 `expiring` 으로 표시함을 정의하고, Rationale "Attention 가상 필터값" 항이 `Expiring` 칩의 합집합 구성을 설명한다. 본 변경은 autoRefresh 통합의 `expiresSoon` 분기를 false 처리하여 라벨을 "Connected"로 유지한다. 이는 spec 본문의 `expiring` 정의를 조용히 축소하는 것이나, "본 PR 범위 밖" 섹션에서 §2.4 배너·§11.4 카운트·§2.3 Expiring 칩·§9.1 가상 필터 변경은 후속 PR 로 미뤄진다고 명시되어 있다. 결과적으로 spec 본문과 구현이 일시적으로 불일치하는 상태가 된다 (spec 은 여전히 7일 이내 = expiring 으로 정의되어 있고, 코드는 autoRefresh 통합을 제외).
  - 제안: 후속 spec 갱신 PR 이 완료되기 전까지 구현 코드 주석 또는 plan 문서에 "spec §2.2/§2.3 과의 불일치는 spec-update-integration-autorefresh.md 완료 시 해소" 임을 명시한다. 현재 `plan/in-progress/spec-update-integration-autorefresh.md` 가 그 역할을 하므로 plan 이 존재하는 동안은 관리 가능.

- **[INFO]** `InfoRow` tooltip 도입 — spec §4.2 Overview 탭 행 정의와 암묵적 확장
  - target 위치: "변경 의도 §3" — `InfoRow` 의 optional `tooltip` prop 추가, "Token Expires" 행 친화 표기
  - 과거 결정 출처: `spec/2-navigation/4-integration.md §4.2 Overview 탭` — "기본 정보: 토큰 만료 시각" 행 정의
  - 상세: spec §4.2 는 "토큰 만료 시각" 을 기본 정보 행으로 정의하지만, `in 1h 24m · auto-renews` 친화 표기 형식과 tooltip 으로 절대시각을 강등하는 패턴은 Rationale 에 없다. 이 자체는 spec 위반이 아닌 구현 세부이나, `InfoRow` 는 공유 컴포넌트이므로 tooltip prop 추가가 다른 행에도 파급될 수 있다. 현재 spec 어디에도 "기본 정보 행의 tooltip 패턴" 에 관한 가이드가 없으므로 후속 확장 시 혼선이 생길 수 있다.
  - 제안: `InfoRow` tooltip 패턴을 spec §4.2 또는 `spec/2-navigation/_layout.md` 에 컴포넌트 수준 규약으로 간략히 추가해두면 이후 구현자의 혼선이 줄어든다. 필수는 아니며 INFO 수준.

---

### 요약

본 PR 변경 의도(`autoRefresh` 필드 + `computeStatus` 수정 + 상세 페이지 UI)는 기존 `spec/2-navigation/4-integration.md` 의 "영속화 상태 Enum 과 화면 필터 술어 분리" 원칙과 방향이 일치한다. `autoRefresh` 를 DB Enum 이 아닌 서비스 레지스트리 메타데이터로 두는 결정도 기존 설계 철학에 어긋나지 않는다. 다만 이 신규 개념의 도입 근거가 spec Rationale 에 아직 명시되지 않았고, `computeStatus` 의 `expiresSoon` 분기 축소는 spec §2.2/§2.3 과 일시적 불일치를 유발하며 이는 이미 진행 중인 후속 spec 갱신 plan 으로 추적 중이다. CRITICAL 또는 WARNING 수준의 Rationale 연속성 위반은 발견되지 않았으며, 모든 발견 사항은 후속 문서화로 해소 가능한 INFO 수준이다.

### 위험도

LOW
