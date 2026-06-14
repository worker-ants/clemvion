# 신규 식별자 충돌 검토: spec/2-navigation/6-config.md (--impl-prep)

검토 모드: 구현 착수 전 (`--impl-prep`). 대상 spec 의 기존 식별자가 타 영역에서 다른 의미로 사용되는지 분석한다.
구현 범위: `spec-sync-config-gaps.md §A.2 편집 폼` — 인증 설정 편집 폼(IP Whitelist·API Key Header 이름) 신설.

---

## 발견사항

### 1. 요구사항 ID 충돌

충돌 없음. 편집 폼 구현은 기존 `NAV-CA-05` (IP Whitelist 설정) 및 `NAV-CA-02` (API Key 관리) 범위 내 구현이며, 새 ID를 부여하지 않는다.
`NAV-CA-01` ~ `NAV-CA-06` 은 `spec/2-navigation/_product-overview.md §3.6` 에서만 정의되고 다른 영역에서 충돌하지 않는다.

### 2. 엔티티/타입명 충돌

- **[INFO]** `AuthConfigType` vs `IntegrationAuthType` — 기존 의도적 분리, 신규 충돌 없음
  - target 신규 식별자: 편집 폼 구현이 `AuthConfigFormState` / `AuthConfigPayload` 를 재사용 또는 확장 (예: `EditAuthConfigFormState`)
  - 기존 사용처: `codebase/frontend/src/app/(main)/authentication/auth-config-form.ts:6` 에 `AuthConfigType` 정의; `codebase/backend/src/modules/auth-configs/dto/create-auth-config.dto.ts:21` 에 동명 타입 정의
  - 상세: `AuthConfigType` 은 frontend와 backend에 별도로 정의되어 있으나 값 집합이 동일(`api_key`/`bearer_token`/`basic_auth`/`hmac`). `IntegrationAuthType` 과의 분리는 `spec/1-data-model.md §2.17.3` 에서 명시적으로 의도된 설계임. 편집 폼이 `AuthConfigFormState` 를 확장하거나 별도 타입을 도입할 때 이름 규칙을 일관되게 유지해야 한다.
  - 제안: 편집 폼용 신규 타입을 도입한다면 `EditAuthConfigFormState` (또는 `AuthConfigFormState` 를 그대로 재사용) 로 명명해 기존 `AuthConfigFormState` (생성 폼용)와 혼동되지 않도록 한다. 두 타입이 실질적으로 동일하다면 단일 타입 재사용이 더 바람직하다.

### 3. API endpoint 충돌

충돌 없음. 편집 폼은 기존 `PATCH /api/auth-configs/:id` (spec §3, 컨트롤러 `auth-configs.controller.ts:108`)를 사용한다. 이 엔드포인트는 이미 `ipWhitelist` 와 `config.headerName` 을 `UpdateAuthConfigDto` (`update-auth-config.dto.ts:53`) 를 통해 지원한다. 새 엔드포인트 추가는 불필요하고 계획되지도 않았다.

### 4. 이벤트/메시지명 충돌

충돌 없음. 편집 폼 저장 시 `auth_config.update` 이벤트가 기록되며, 이는 이미 `codebase/backend/dist/modules/audit-logs/audit-action.const.js:14` 에 정의된 값과 일치한다. 새 이벤트 이름은 도입되지 않는다.

### 5. 환경변수·설정키 충돌

충돌 없음. 편집 폼 구현에 새 환경변수 또는 설정 키가 도입되지 않는다.

- **[INFO]** `config.headerName` (AuthConfig JSONB) vs `header_name` (Integration.credentials JSONB)
  - target 신규 식별자: `spec/2-navigation/6-config.md §A.2` 의 API Key `headerName` 설정 키 (`config.headerName`)
  - 기존 사용처: `spec/2-navigation/4-integration.md:532` 에 `header_name` (Integration 자격증명 스키마); `codebase/backend/src/modules/integrations/services/service-registry.ts:358` 에 `key: 'header_name'`; `spec/5-system/11-mcp-client.md:119` 에 `header_name`
  - 상세: `AuthConfig.config.headerName` (camelCase, 인바운드 webhook 검증용)과 `Integration.credentials.header_name` (snake_case, 아웃바운드 MCP/HTTP Integration용)은 동일 의미("API 키를 담는 헤더 이름")이나 표기가 다르다. 이는 기존 의도적 분리(각 도메인이 독립 JSONB 스키마)이며 편집 폼 구현이 새로 도입하는 충돌은 아니다. 단, 코드 리뷰 시 두 키를 혼용하지 않도록 주의가 필요하다.
  - 제안: 편집 폼 구현 시 `config.headerName` (camelCase) 을 일관되게 사용한다. Integration 도메인의 `header_name` (snake_case)과 혼용하면 런타임 키 불일치가 발생한다. 현재 백엔드 `auth-configs.service.ts:396` 이 `ac.config.headerName` 을 camelCase 로 읽고 있으므로 기존 규칙 준수.

### 6. 파일 경로 충돌

충돌 없음. 편집 폼은 기존 `codebase/frontend/src/app/(main)/authentication/page.tsx` 를 수정하거나 동일 디렉터리에 새 파일을 추가한다. `spec/2-navigation/6-config.md` 는 기존 파일이며 경로 충돌이 없다.

- **[INFO]** 테스트 파일 명명 패턴
  - target 신규 식별자: 편집 폼 테스트 파일 (예: `authentication-edit-form.test.tsx` 또는 기존 `authentication-form.test.tsx` 확장)
  - 기존 사용처: `codebase/frontend/src/app/(main)/authentication/__tests__/authentication-form.test.tsx` (생성 폼 테스트)
  - 상세: 편집 폼 전용 테스트를 별도 파일로 분리할 경우, 기존 `authentication-form.test.tsx` 와 혼동될 수 있다. 같은 `__tests__/` 디렉터리 내에서 `authentication-edit-form.test.tsx` 또는 기존 파일을 확장하는 방식 모두 허용된다.
  - 제안: 순수 로직 테스트(`auth-config-form.ts` 확장)는 기존 `auth-config-form.test.ts` 에 추가하고, UI 통합 테스트는 `authentication-form.test.tsx` 를 확장하거나 별도 `authentication-edit.test.tsx` 를 신설한다. 두 접근 모두 충돌은 없으나 팀 컨벤션에 맞는 하나를 선택.

---

## 요약

`spec/2-navigation/6-config.md` 가 정의하는 인증 설정 편집 폼 구현에 새로 도입되는 식별자는 대부분 기존 DTO(`UpdateAuthConfigDto.ipWhitelist`, `config.headerName`)·API 엔드포인트(`PATCH /api/auth-configs/:id`)·이벤트(`auth_config.update`)·타입(`AuthConfigType`)을 재사용하므로 충돌이 없다. 주목할 점은 `config.headerName` (AuthConfig, camelCase)과 `Integration.credentials.header_name` (Integration, snake_case)이 동일 의미이나 표기가 다른 기존 분리인데, 편집 폼 구현 시 두 키를 혼용하지 않도록 주의가 필요하다. 그 외 요구사항 ID·파일 경로·환경변수 관점에서 충돌은 없다.

---

## 위험도

NONE
