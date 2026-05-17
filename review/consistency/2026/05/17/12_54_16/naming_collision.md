# 신규 식별자 충돌 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상 영역: `spec/2-navigation/` (autoRefresh UI 구현 관련 식별자)

---

### 발견사항

- **[INFO]** `autoRefresh` — 필드명이 기존 Integration 엔티티에 없으나 spec §9.1 에서 정의된 계산 필드로 정합됨
  - target 신규 식별자: `autoRefresh: boolean` — `IntegrationDto` 응답 DTO 에 추가, `computeStatus` 함수의 `expiresSoon && !autoRefresh` 분기, `StatusView` 의 `subLabel` 표시 조건
  - 기존 사용처: `spec/2-navigation/4-integration.md §2.2 항목 요소`, §2.3 필터, §2.4 배너, §4.1 헤더, §4.2 Overview 탭, §9.1 API 응답, §10.5 상태 전이 — 이미 spec PR #139 (commit c4200d51) 로 반영 완료
  - 상세: `Integration` 엔티티 자체에는 `auto_refresh` DB 컬럼이 없다. spec §9.1 에 따르면 `autoRefresh` 는 `service-registry.ts` 의 `ServiceDefinition.supportsTokenAutoRefresh` 플래그를 `toPublic()` 매핑 시 계산해 내보내는 **가상 필드**다. `spec/1-data-model.md §2.10` 의 Integration 엔티티 필드 목록에 `auto_refresh` 컬럼이 없고, `spec/1-data-model.md §3 인덱스` 에도 없다. DTO 에만 노출되는 읽기 전용 계산 필드이므로 데이터 모델 충돌은 없다.
  - 제안: 충돌 없음. 단, `spec/1-data-model.md §2.10` Integration 엔티티 필드 설명에 "응답 DTO의 `autoRefresh` 는 `service-registry.ts` 의 `supportsTokenAutoRefresh` 에서 계산되는 가상 필드" 주석을 추가하면 미래 독자의 혼동을 예방할 수 있다.

- **[INFO]** `supportsTokenAutoRefresh` — `ServiceDefinition` 인터페이스에 추가되는 옵션 필드
  - target 신규 식별자: `ServiceDefinition.supportsTokenAutoRefresh?: boolean` (backend `service-registry.ts`)
  - 기존 사용처: `spec/2-navigation/4-integration.md §9.1` 에서 서비스 정의 레지스트리 필드로 처음 명시됨. 기존 코퍼스(spec, plan, conventions)에서 같은 이름의 다른 용도 사용은 발견되지 않음
  - 상세: 식별자가 유일하고, `autoRefresh` DTO 필드와 명확히 구분되는 내부 전략 플래그. 충돌 없음.
  - 제안: 충돌 없음.

- **[INFO]** `subLabel` — `StatusView` 인터페이스 옵션 필드
  - target 신규 식별자: `StatusView.subLabel?: string` — `status-badge.tsx` 의 `StatusView` 인터페이스에 추가
  - 기존 사용처: 코퍼스 내 `StatusView` 타입 정의는 `spec/2-navigation/4-integration.md §9.1` 의 응답 DTO 맥락에서 암묵적으로 존재. 컴포넌트 내부 타입이므로 spec 레벨 충돌 없음.
  - 상세: UI 전용 로컬 인터페이스 확장. 다른 스펙 문서나 데이터 모델에 `subLabel` 로 다른 의미를 가진 정의가 없음.
  - 제안: 충돌 없음.

- **[INFO]** `InfoRow.tooltip` — `page.tsx` 의 `InfoRow` 컴포넌트에 추가되는 옵션 prop
  - target 신규 식별자: `InfoRow` 컴포넌트에 `tooltip?: string` prop 추가
  - 기존 사용처: UI 컴포넌트 내부 prop. spec 레벨에서 충돌하는 동명 식별자 없음.
  - 상세: 컴포넌트 prop 수준 확장. 데이터 모델, API endpoint, 이벤트명, 환경변수와 무관.
  - 제안: 충돌 없음.

- **[INFO]** i18n 키 `integrations.tokenAutoRenews` / `integrations.tokenExpiresInAuto`
  - target 신규 식별자: ko/en i18n 키 네임스페이스 `integrations.*` 아래 두 신규 키
  - 기존 사용처: `integrations.` 네임스페이스의 기존 키는 spec 에 열거되어 있지 않고, 코퍼스에서 같은 이름의 충돌 키는 발견되지 않음
  - 상세: 새 키가 기존 키 이름 패턴(`integrations.` prefix + camelCase 의미)과 일관되며 중복 없음.
  - 제안: 충돌 없음. ko/en parity(양쪽 모두 추가)가 요구된다는 점은 기존 i18n 규약과 동일하게 준수 필요.

- **[WARNING]** `EXPIRING_SOON_INTERVAL` — 백엔드 SQL 상수와 프론트엔드 `EXPIRING_SOON_DAYS=7` 주석 간 동기화 위험
  - target 신규 식별자: 본 PR 범위 밖(후속 PR 대상)으로 표기되었으나, `autoRefresh` 가드 추가 시 동일 위치(`integrations.service.ts:248~275`)를 수정하게 됨
  - 기존 사용처: `spec/2-navigation/4-integration.md` §2.3·§2.4·§11.4 에서 7일 기준이 중복 정의. 기존 review `20260516-full-review W-32` 가 이미 공유 상수 추출을 권고
  - 상세: `EXPIRING_SOON_INTERVAL` 자체는 신규 식별자가 아니라 기존 상수이지만, `AND NOT autoRefresh` 가드 추가가 동일 파일을 수정하므로 W-32 상수 추출과의 병합 순서가 충돌 원인이 될 수 있다. Plan 노트에 "(a) W-32 먼저 또는 (b) 한 PR에서 묶기"로 명시되어 있어 의식적으로 처리 예정이지만, 두 PR 이 독립으로 진행될 경우 `integrations.service.ts:248~275` 영역에서 git merge conflict 가 발생한다.
  - 제안: 본 PR 에서 `AND NOT autoRefresh` 가드와 W-32 공유 상수 추출을 함께 처리하거나, W-32 를 먼저 merge 한 뒤 본 PR 을 rebasing 하여 진행한다.

---

### 요약

`spec/2-navigation/` 영역이 도입하는 신규 식별자(`autoRefresh`, `supportsTokenAutoRefresh`, `subLabel`, `InfoRow.tooltip`, i18n 키 두 종)는 기존 데이터 모델, API endpoint, 이벤트명, 환경변수, 파일 경로 어디에서도 다른 의미로 쓰이는 동명 식별자와 충돌하지 않는다. `autoRefresh` 는 spec §9.1 에서 이미 명확히 정의된 DTO 가상 필드이며, 그 근거가 되는 `supportsTokenAutoRefresh` 플래그도 service-registry 내부에만 국한된 새 식별자다. 유일한 주의점은 기존 `EXPIRING_SOON_INTERVAL` 상수를 수정하는 후속 작업과의 파일 충돌 위험으로, plan 노트에 처리 순서가 이미 명시되어 있어 WARNING 수준으로 남긴다.

### 위험도

LOW
