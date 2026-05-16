# 신규 식별자 충돌 검토 — Cafe24 App URL 상세 페이지 spec draft

> 검토 대상: `plan/in-progress/spec-draft-cafe24-app-url-detail.md`
> 검토 일시: 2026-05-16
> 검토 범위: 변경 1~4 (변경 5는 변경 없음 확인만이므로 식별자 충돌 대상 아님)

---

## 발견사항

### 발견 없음 — CRITICAL 충돌 0건

target 문서가 도입하는 모든 신규 식별자에 대해 기존 코퍼스 전체(spec/, plan/in-progress/, conventions/)를 점검한 결과, CRITICAL 등급의 충돌은 발견되지 않았다.

---

### [INFO] `appUrl` 필드명이 기존 URL 계열 필드들과 구분 명확성 검토

- **target 신규 식별자**: `IntegrationDto.appUrl: string | null` (변경 3)
- **기존 사용처**: `spec/1-data-model.md` §2.1 User 의 `avatar_url`, `spec/1-data-model.md` §2.7 Object Storage 의 `file_url`, `spec/2-navigation/4-integration.md` 전반의 `credentials` JSONB 내부 값들
- **상세**: 기존 `Integration` DTO/엔티티에는 `app_url` 또는 `appUrl` 이라는 최상위 필드가 없다. `spec/1-data-model.md` §2.10의 `Integration` 엔티티 필드 목록(id, workspace_id, service_type, name, auth_type, credentials, scope, status, install_token, install_token_issued_at, mall_id, status_reason, consecutive_network_failures, token_expires_at, last_used_at, last_rotated_at, last_error, created_by, created_at, updated_at)에는 `app_url` 또는 `appUrl`이 포함되어 있지 않다. target 이 `IntegrationDto`(응답 객체)에 새로 추가하는 것은 엔티티 필드 추가가 아니라 DTO 계산 필드 추가로, DB 컬럼 변경 없이 서비스 레이어에서 조립하는 형태이므로 충돌은 없다. 다만 `avatar_url`, `file_url`, `base_url`(LLMConfig) 등 기존 URL 계열 필드가 snake_case인 데 반해 `appUrl`은 camelCase DTO 관례를 따른다 — 이는 REST API 응답 DTO의 일반 관례(camelCase)와 일치하므로 이름 충돌이나 혼동 가능성은 낮다.
- **제안**: 충돌 없음. DTO 레이어의 camelCase 관례와 정합하므로 `appUrl` 명칭 유지 적절.

---

### [INFO] `Cafe24AppUrlCard` 컴포넌트 이름이 기존 Cafe24 관련 컴포넌트와 중복 없음 확인

- **target 신규 식별자**: `Cafe24AppUrlCard` (변경 2 — §4.2 표에서 UI 컴포넌트 이름으로 기술됨), `Cafe24PrivatePending` (변경 4 Rationale 에서 기존 컴포넌트로 참조됨)
- **기존 사용처**: `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 상세 페이지 표시" 항의 `Cafe24PrivatePending` 언급, `spec/4-nodes/4-integration/4-cafe24.md` 전반
- **상세**: `Cafe24AppUrlCard`는 target이 처음 도입하는 신규 컴포넌트명이다. 기존 코퍼스에서 이 이름은 발견되지 않는다. 변경 4 Rationale이 참조하는 `Cafe24PrivatePending`은 기존 신규 등록 흐름 컴포넌트(`frontend/src/app/(main)/integrations/new/page.tsx`)로, `Cafe24AppUrlCard`와 다른 이름이므로 충돌 없다. 두 컴포넌트가 같은 `Cafe24` 접두사를 공유하지만 의미가 명확히 다르다(신규 등록 중간 상태 UI vs 상세 페이지 URL 표시 카드).
- **제안**: 충돌 없음. 다만 프런트엔드 구현 시 `Cafe24PrivatePending`과 UX 패턴을 공유하는 점을 spec이 명시하고 있으므로, 구현 단계에서 공통 하위 컴포넌트(예: `Cafe24UrlDisplay`)로 추출하면 중복 코드 방지에 유리할 수 있다 — 이는 구현 판단이며 spec 식별자 충돌은 아님.

---

### [INFO] `install_token` 보존 정책 표현의 spec 파일 간 용어 정합 확인

- **target 신규 식별자**: 변경 1의 `install_token 보존` 표현, `post-install navigation 식별 키` 설명 문구
- **기존 사용처**: `spec/1-data-model.md` §2.10 Integration.install_token 설명("Cafe24 Private 앱 설치 흐름 식별 키"), `spec/4-nodes/4-integration/4-cafe24.md` §9.4 step 5("install_token 은 **보존** (post-install navigation 의 식별 키)"), `spec/2-navigation/4-integration.md` Rationale "Cafe24 App URL 재호출 흐름 — install_token persistent 격상"
- **상세**: target 변경 1이 data-flow spec의 시퀀스에 추가하는 표현 `install_token 보존 — post-install navigation 식별 키`는 위 세 파일에서 이미 사용 중인 용어를 그대로 따른다. 새 표현이 기존 용어와 의미상 일치하며, 충돌 없이 drift를 정정하는 방향이다.
- **제안**: 충돌 없음. 용어 통일이 오히려 강화된다.

---

### [INFO] `CAFE24_INSTALL_INVALID_HMAC` 에러 코드가 기존 정의와 정합 확인

- **target 신규 식별자**: `CAFE24_INSTALL_INVALID_HMAC` (변경 4 Rationale에서 기술됨 — 신규 도입이 아니라 기존 에러 코드 참조)
- **기존 사용처**: `spec/4-nodes/4-integration/4-cafe24.md` §9 핸들 에러 섹션 (코퍼스에서 직접 확인 가능한 범위 내)
- **상세**: target Rationale이 이 에러 코드를 신규로 도입하는 것이 아니라, 기존 `renderInstallErrorHtml`의 에러 응답에서 이미 사용 중인 코드를 참조하는 방식으로 기술하고 있다. 식별자 충돌 관점에서는 문제없다.
- **제안**: 충돌 없음.

---

### [INFO] `SECRET_LEAK_PATTERNS` 상수 참조가 기존 정의와 정합 확인

- **target 신규 식별자**: `SECRET_LEAK_PATTERNS` (변경 4 Rationale에서 `client_secret` 로그 제외 근거로 참조)
- **기존 사용처**: 백엔드 코드베이스에서 정의된 상수로 추정 (코퍼스 spec 파일 내에는 직접 정의 없으나, 변경 4가 이를 기존 규약으로 참조하고 있음)
- **상세**: target이 이 식별자를 새로 도입하는 것이 아니라 기존 규약을 참조하는 방식으로 언급하므로, spec 식별자 충돌 점검 범위에서는 문제없다.
- **제안**: 충돌 없음.

---

## 요약

target 문서(`spec-draft-cafe24-app-url-detail.md`)가 도입하는 신규 식별자는 `IntegrationDto.appUrl` 필드, `Cafe24AppUrlCard` 컴포넌트명, `install_token 보존` 표현 보강이 핵심이다. `appUrl`은 기존 `Integration` 엔티티나 DTO에 동일 이름의 다른 의미 필드가 없어 충돌이 없고, `Cafe24AppUrlCard`는 신규 이름으로 기존 `Cafe24PrivatePending`과 명확히 구분된다. `install_token 보존` 표현은 이미 세 개의 관련 spec 파일에서 동일 용어를 사용 중이어서 drift 정정에 해당하며 충돌이 없다. 에러 코드 `CAFE24_INSTALL_INVALID_HMAC`, 상수 `SECRET_LEAK_PATTERNS`는 신규 도입이 아닌 기존 참조다. API endpoint `GET /api/integrations/:id`는 기존에 정의된 엔드포인트의 응답 shape를 확장하는 것이므로 메서드+경로 충돌이 아니다. 전체적으로 식별자 충돌 관점에서 위험 요소는 발견되지 않는다.

## 위험도

NONE
