---

## 명명 충돌 검토 결과

**검토 모드**: `--impl-prep` / 구현 착수 전  
**대상 범위**: `spec/2-navigation/4-integration.md` (cafe24-pending-polish 계획 기준 신규 식별자)

---

### 발견사항

#### **[WARNING]** `CallbackFailure` 클래스 명과 기존 `OAuthCallbackFailure` 인터페이스 충돌

- **target 신규 식별자**: 계획 변경 0에서 제안된 `CallbackFailure` 예외 클래스
- **기존 사용처**: `backend/src/modules/integrations/services/oauth-callback.template.ts:21`
  ```ts
  export interface OAuthCallbackFailure {
    status: 'error';
    error: string;
  }
  ```
- **상세**: `OAuthCallbackFailure`는 팝업 callback HTML에서 반환하는 응답 형식 인터페이스다. 같은 파일/모듈에서 유사 이름의 예외 클래스를 새로 추가하면 두 식별자가 혼동될 수 있다.
- **제안**: `CallbackFailure` 대신 `OAuthCallbackException` 또는 `IntegrationCallbackError`로 네이밍.

---

#### **[WARNING]** `statusReason = 'install_timeout'`이 `data-flow/integration.md` 허용 값 표에 없음

- **target 신규 식별자**: 변경 4(W6)에서 TTL 만료 시 `statusReason = 'install_timeout'` 설정
- **기존 사용처**: `spec/data-flow/integration.md §3.2` 허용 값 표
  ```
  | status   | status_reason candidates         |
  | expired  | token_expired, refresh_failed    |
  ```
- **상세**: 현재 `expired` 상태의 `statusReason` 허용 값은 `token_expired`, `refresh_failed`만 문서화되어 있다. `pending_install` 만료는 다른 원인(OAuth 토큰 갱신 실패가 아닌 설치 시간 초과)이므로 별도 값이 타당하지만, spec 갱신 없이 구현하면 문서-코드 불일치가 된다.
- **제안**: 구현 전 `spec/data-flow/integration.md §3.2` 허용 값 표에 `install_timeout` 항목 추가.

---

#### **[WARNING]** `Integration` 응답 DTO의 `status` enum이 `pending_install`을 누락

- **target 신규 식별자**: 변경 0에서 `pending_install` 행에 `last_error` / `statusReason` 기록
- **기존 사용처**: `backend/src/modules/integrations/dto/responses/integration-response.dto.ts:34-38`
  ```ts
  @ApiProperty({ enum: ['connected', 'expired', 'error'] })
  status: string;
  ```
- **상세**: Swagger 응답 DTO에 `pending_install`이 빠져있다. 변경 0/1이 `pending_install` 상태를 FE로 노출할 때 API 문서와 클라이언트 타입 추론이 불일치된다.
- **제안**: DTO의 `@ApiProperty` enum에 `pending_install` 추가.

---

#### **[INFO]** `INTEGRATION_STATUSES` 필터 enum과 entity 타입 불일치

- **기존 사용처**: `backend/src/modules/integrations/dto/integration.dto.ts:20-26`
  ```ts
  export const INTEGRATION_STATUSES = ['connected', 'expiring', 'expired', 'error'] as const;
  ```
- **entity 정의**: `integration.entity.ts:16-20` — `connected | expired | error | pending_install`
- **상세**: 필터 DTO에는 `expiring`(entity에 없음)이 있고 `pending_install`이 없다. plan 범위와 직접 충돌은 없으나, `pending_install` 폴링(변경 1)을 구현할 때 이 불일치가 필터 동작 오류로 이어질 수 있다.
- **제안**: plan 변경 1 착수 시 DTO 필터 enum과 entity 타입을 통일.

---

#### **[INFO]** `purgeExpired()` 확장 — 기존 메서드 존재 확인

- **기존 사용처**: `backend/src/modules/integrations/integration-oauth.service.ts:762` (OAuth state 정리용)
- **상세**: plan 변경 4가 제안하는 "purgeExpired() 확장"의 대상이 **이미 존재**한다. OAuth state 정리 로직과 `pending_install` TTL 정리를 같은 메서드에 합칠 경우 단일 책임 원칙을 벗어날 수 있다.
- **제안**: `purgeExpiredOauthStates()` / `purgeExpiredPendingInstalls()` 등 별도 메서드로 분리하거나, 명확한 설명을 포함해 기존 메서드를 확장.

---

### 요약

총 4건의 발견사항 중 Critical 없음. 두 WARNING(클래스 명 충돌 가능성, `statusReason` 허용 값 문서 누락)은 구현 전에 해소하는 것이 바람직하다. `CallbackFailure` → `IntegrationCallbackError` 리네이밍과 `data-flow/integration.md` statusReason 값 추가가 가장 중요하며, 응답 DTO의 `pending_install` 누락은 변경 0/1과 직접 연관되어 있어 함께 수정이 필요하다.

### 위험도

**LOW** — Critical 충돌 없음. WARNING 2건은 문서/타입 정합성 문제로, 해당 파일 수정으로 즉시 해소 가능.