# Cross-Spec 일관성 검토 결과

> 검토 대상: `plan/in-progress/spec-draft-integration-autorefresh.md`
> 개정 대상 spec: `spec/2-navigation/4-integration.md`
> 검토 시각: 2026-05-17

---

## 발견사항

### 1. 데이터 모델 충돌

- **[INFO]** `Integration` 엔티티에 `autoRefresh` 컬럼 부재 — 의도적 derived 설계이나 `spec/1-data-model.md` §2.10 에 언급 없음
  - target 위치: draft §2, §4.6
  - 충돌 대상: `spec/1-data-model.md` §2.10 Integration 엔티티 필드 목록
  - 상세: `spec/1-data-model.md` §2.10 의 Integration 엔티티 필드 정의에 `autoRefresh` 가 없다. draft 는 이것이 DB 컬럼이 아닌 derived 필드임을 명확히 하고 있으나, 데이터 모델 spec 에서 "이 필드는 DB 에 없고 응답 DTO 에서 derived 된다"는 설명이 없으면 다른 개발자가 마이그레이션을 시도할 위험이 있다.
  - 제안: `spec/1-data-model.md` §2.10 IntegrationUsageLog 또는 Integration 엔티티 설명부에 각주 한 줄 추가 — "응답 DTO 의 `autoRefresh: boolean` 은 DB 컬럼이 아닌 `ServiceDefinition.supportsTokenAutoRefresh` 에서 매 응답 시점 계산되는 derived 필드 (상세: [Spec 통합 §9.1](./2-navigation/4-integration.md#91-integrationdto))". 또는 `4-integration.md` 개정 후 `1-data-model.md` §2.10 에 크로스 참조 추가.

---

### 2. API 계약 충돌

- **[INFO]** `GET /api/integrations` 응답의 `autoRefresh` 필드 — 목록 조회에도 포함 여부 미명시
  - target 위치: draft §4.7 (§9.1 `GET /api/integrations` 행 보강)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §9.1 (corpus 내 미포함이나 draft 가 보강 대상으로 명시)
  - 상세: draft §4.7 은 `GET /api/integrations` (목록) 의 `status` 필터 술어를 보강하지만, `autoRefresh` 필드 자체가 목록 응답의 `IntegrationDto` 에 포함되는지 여부를 명시하지 않는다. draft §4.6 의 `GET /api/integrations/:id` (상세) 응답에만 `autoRefresh` 추가가 기술되어 있어, 목록 조회 응답에서 `autoRefresh` 를 프론트엔드가 참조할 수 있는지 불명확하다. 상태 칩 필터(§2.3) 는 서버 측 쿼리 술어이므로 프론트엔드가 직접 `autoRefresh` 를 필요로 하지 않을 수 있으나, §4.1 헤더 보조 라벨·§4.2 Overview 표기 등의 UI 분기에는 목록 응답에서도 `autoRefresh` 가 있어야 한다 (목록 화면에서 상세 이동 전 렌더 최적화 또는 사이드바 카운트 증분 계산).
  - 제안: draft §4.6 에 "본 `autoRefresh` 필드는 목록 조회(`GET /api/integrations`) 응답 DTO 에도 동일하게 포함된다" 는 한 줄을 추가하거나, `GET /api/integrations` 보강(§4.7) 에 포함 여부를 명시한다. 포함하지 않을 경우에도 그 이유를 Rationale 에 기재.

- **[INFO]** `spec/2-navigation/4-integration.md §11.4` 사이드바 카운트 술어 — 프론트엔드가 클라이언트 측에서 직접 계산하는 경우 `autoRefresh` 값 접근 경로 불명확
  - target 위치: draft §4.9 (§11.4 사이드바 카운트 술어 보강)
  - 충돌 대상: `spec/2-navigation/4-integration.md` §11.4 (corpus 미포함)
  - 상세: §11.4 사이드바 카운트가 서버 API 를 직접 호출하는 방식(예: `GET /api/integrations?status=attention` 의 `total` 카운트 필드)이라면 서버 술어 개정만으로 충분하다. 그러나 프론트엔드가 목록 응답을 캐시하여 클라이언트 사이드에서 카운트를 계산하는 경우, `autoRefresh` 필드가 목록 응답에 있어야 한다. 이 의존 관계가 spec 어디에도 명시되지 않았다.
  - 제안: §11.4 또는 §9.1 에 "사이드바 카운트는 서버 측 `?status=attention` 집계 API 로 산출한다" 또는 "클라이언트 캐시 계산 시 `autoRefresh` 필드 필요" 중 하나를 명시한다.

---

### 3. 요구사항 ID 충돌

- **[INFO]** draft 본문에 요구사항 ID 미사용 — `spec/2-navigation/_product-overview.md` 의 NAV-* ID 체계와 단절
  - target 위치: draft 전체
  - 충돌 대상: `spec/2-navigation/_product-overview.md` 의 요구사항 ID 체계 (corpus 미포함)
  - 상세: draft 는 spec 본문 패치 수준의 문서이므로 요구사항 ID 를 직접 정의할 의무는 없으나, `§I-2` 라는 자체 식별자를 §4.5 에서 사용하고 있다 ("사용자 액션 불필요 — 버튼은 활성 상태로 두되 hover 시 … (I-2)"). 이 `I-2` 가 _product-overview.md 의 기존 NAV-* 식별자와 무관한 새 임시 ID 인지 불명확하다.
  - 제안: `(I-2)` 는 draft 내부 참조 번호임을 괄호 설명으로 명시하거나, `_product-overview.md` 의 NAV-INT-* 체계에 편입시킨다. 개정 본문에서는 임시 ID 대신 Rationale 절 명칭으로 참조한다.

---

### 4. 상태 전이 충돌

- **[INFO]** `autoRefresh=true` 통합이 `status='connected'` 인 동안 Reauthorize 버튼 처리 — §4.3 Security 탭과의 의도적 비대칭 처리 확인 필요
  - target 위치: draft §4.5 참고 주석
  - 충돌 대상: `spec/2-navigation/4-integration.md` §4.3 Security 탭 Reauthorize 행 (corpus 미포함)
  - 상세: draft §4.5 는 "§4.3 Security 탭의 Reauthorize 행(라인 269)의 비활성 조건은 별도로 손대지 않는다 — autoRefresh=true 라도 사용자가 명시적으로 재인증을 시도할 권한 자체는 유지"라고 의도를 밝히고 있다. 이 결정은 정당하나 현재 §4.2 Overview Quick actions 의 기술("버튼은 활성 상태로 두되 hover 시 안내")과 §4.3 Security 탭 Reauthorize 간에 UI 처리가 달라질 수 있다(Overview 에서는 hover 안내, Security 탭에서는 아무 안내 없이 활성). 이것이 의도인지, 아니면 Security 탭에서도 hover 안내가 필요한지 spec 에 기재되지 않았다.
  - 제안: Rationale 신규 항목 또는 §4.5 주석에 "Security 탭의 Reauthorize 버튼은 autoRefresh=true 시에도 별도 hover 안내 없이 그대로 활성 유지한다" 는 결정을 한 줄로 명문화하여 두 탭 간 의도적 차이를 기록한다.

- **[WARNING]** `error(auth_failed)` / `error(network)` 전이한 autoRefresh 통합에 대한 UI 분기 기술 부재
  - target 위치: draft §4.3 (§2.4 포함 조건 보강), draft §4.10 Rationale
  - 충돌 대상: `spec/1-data-model.md` §2.10 `status_reason` 정의, `spec/2-navigation/4-integration.md` §10.5 자동 갱신 전이 정책 (corpus 미포함)
  - 상세: draft §4.3 와 §4.10 Rationale 은 "자동 갱신이 실패해 `error(auth_failed)` / `error(network)` 로 전이하면 attention 에 포함된다"고 명시한다. 이 경우는 `spec/1-data-model.md` §2.10 의 `status_reason` 으로 `auth_failed` / `network` 가 설정되며 `status='error'` 이다. 문제는 이 상태의 통합에 대해 §4.1 헤더·§4.2 Overview 의 autoRefresh 보조 라벨 표시 정책이 어떻게 되는지 draft 에서 명확히 기술하지 않는다. draft §4.4 는 "상태 배지의 메인 라벨이 `Connected` 인 경우에 한해" 보조 라벨을 노출한다고 하므로 `error` 상태에서는 표시 안 함이 논리적이지만, 이 연결고리를 spec 본문에 명시해야 향후 구현 혼란을 방지할 수 있다.
  - 제안: draft §4.4 헤더 메타 라인 규약에 "에러·만료 상태에서는 `Auto-renews` 보조 라벨을 표시하지 않는다 (`connected` 상태에서만 유효)" 라는 기존 기술로 충분하며(이미 기술됨), §2.4 포함 조건 보강에 "이 경우 status='error' 이므로 `status IN (expired, error)` 분기에서 attention 에 당연히 포함된다"는 한 줄을 추가해 독자가 연결고리를 찾지 않아도 되게 한다.

---

### 5. 권한·RBAC 모델 충돌

- **[INFO]** `autoRefresh` 필드 노출 — 권한 수준별 응답 필터링 불필요 확인
  - target 위치: draft §4.6 (§9.1 IntegrationDto 보강)
  - 충돌 대상: `spec/1-data-model.md` §2.3 WorkspaceMember.role (owner / admin / editor / viewer), `spec/5-system/` RBAC (corpus 미포함)
  - 상세: `autoRefresh` 는 service registry 에서 파생되는 공개 정보이며 기밀성이 없다. 따라서 역할별 응답 필터링이 필요 없어 기존 RBAC 와 충돌하지 않는다. 다만 spec 에서 명시적으로 언급되지 않았으므로 역할 제한이 없는 derived 필드임을 명시하면 좋다.
  - 제안: draft §4.6 에 "권한 레벨 무관하게 모든 인증된 요청에서 응답에 포함된다" 한 줄 추가 (또는 현 기술 수준이면 생략 가능 — INFO 수준).

---

### 6. 계층 책임 충돌

- **[INFO]** `spec/0-overview.md` §6.2 Cafe24 통합 설명과 draft autoRefresh 범위 비교 확인
  - target 위치: draft §2 (autoRefresh 정의)
  - 충돌 대상: `spec/0-overview.md` §6.2 Cafe24 통합 기술
  - 상세: `spec/0-overview.md` §6.2 는 "10일 임계 백그라운드 갱신 (refresh_token 14일 만료 전 자동 갱신)" 을 언급한다. 이 "10일 임계"는 refresh_token(14일) 을 위한 조기 갱신 임계이고, draft 에서 문제가 된 "2시간 수명" 은 access_token 수명이다. draft Rationale 은 이 둘을 구분하고 있으나, §0-overview.md 는 "자동 갱신"이 정상 동작 중임을 단순히 언급만 한다. draft 가 autoRefresh 술어를 cafe24 와 google 만으로 한정하는 기준이 "OAuth + provider 가 refresh_token 발급"인데, `spec/0-overview.md` 의 Cafe24 섹션은 이를 언급하지 않는다.
  - 제안: `spec/0-overview.md` §6.2 Cafe24 통합 설명에 "access_token 2시간 수명이나 BullMQ refresh 직렬화로 자동 갱신 — UI 에서 `autoRefresh=true` (Spec 통합 §9.1) 로 표시되어 attention 술어에서 제외됨" 을 참조 추가. 이렇게 하면 시스템 개요 문서에서도 autoRefresh 도입 배경을 추적할 수 있다.

- **[INFO]** `spec/2-navigation/_product-overview.md` 요구사항 갱신 연동 여부
  - target 위치: draft §3 (본 PR 범위)
  - 충돌 대상: `spec/2-navigation/_product-overview.md` Integration 관련 요구사항 항목 (corpus 미포함)
  - 상세: `_product-overview.md` 에는 Integration UI 요구사항이 있을 것이며, attention 술어나 Expiring 칩의 동작이 요구사항으로 기술되어 있다면 이번 개정으로 요구사항 기술도 갱신이 필요하다. draft 는 `4-integration.md` 단일 파일 개정만 명시하고 `_product-overview.md` 갱신 여부를 언급하지 않는다.
  - 제안: PR checklist 에 "spec/2-navigation/_product-overview.md 의 Integration 요구사항 중 attention/expiring 동작 기술이 있으면 autoRefresh 예외 조건 추가" 를 추가한다.

---

### 7. Rationale 연속성

- **[INFO]** 기존 Rationale "Attention 가상 필터값 (2026-05-16)" 과의 연속성 확인 필요
  - target 위치: draft §4.10 Rationale 신규 항목
  - 충돌 대상: `spec/2-navigation/4-integration.md` 기존 Rationale "Attention 가상 필터값" 항목 (corpus 미포함)
  - 상세: draft §4.10 Rationale 신규 항목은 "과거 결정과의 호환" 절에서 "Attention 가상 필터값 (2026-05-16)" 과 "pending_install 은 필터 칩에 추가하지 않는다 (2026-05-14)" 결정과의 일관성을 기술하고 있다. 이 연결고리가 올바르게 유지되는지는 실제 `4-integration.md` 의 기존 Rationale 텍스트를 확인해야 최종 검증 가능하나, draft 기술 논리 자체는 일관되다 — "DB Enum 비확장" 과 "사용자 액션 불필요 상태는 attention 에서 제외" 라는 원칙 두 가지가 모두 계승된다.
  - 제안: 현 draft 기술로 충분. spec 본문 패치 직전에 기존 Rationale 텍스트와 대조하여 날짜·제목이 중복되지 않는지 한 번 확인.

---

## 요약

본 draft 는 `spec/2-navigation/4-integration.md` 단일 파일 개정이며, `spec/1-data-model.md` 의 Integration 엔티티 정의 및 `spec/0-overview.md` 의 Cafe24 기술과 직접 모순되는 항목은 없다. 주요 발견은 다음 두 가지다. (1) `autoRefresh` 가 derived 필드임을 `spec/1-data-model.md` 에서도 한 줄로 연결하지 않으면 미래 마이그레이션 혼란 가능성이 있다(INFO). (2) `error(auth_failed)` / `error(network)` 상태의 autoRefresh 통합에 대한 UI 분기가 논리적으로는 일관되지만 spec 본문에서 명시적 연결고리가 없어 독자가 §10.5 전이 정책과 §4.1 헤더 정책을 각각 읽어야 추론 가능하다(WARNING). 요구사항 ID 충돌·RBAC 충돌·DB Enum 충돌은 없다. `autoRefresh` 라는 식별자가 다른 영역에서 이미 사용 중인 사례도 발견되지 않는다. 전반적으로 draft 의 논리는 기존 spec 결정들과 잘 정합되어 있으며, 제안 사항 대부분은 미래 가독성을 위한 보강이다.

---

## 위험도

LOW
