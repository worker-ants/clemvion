# 신규 식별자 충돌 검토 결과

검토 대상: `spec/5-system/` (impl-done, diff-base=origin/main)

## 발견사항

해당 diff 의 코드 변경은 다음 네 파일에 한정된다:

- `codebase/backend/src/common/filters/http-exception.filter.ts`
- `codebase/backend/src/common/filters/http-exception.filter.spec.ts`
- `codebase/backend/src/modules/auth/utils/client-ip.spec.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.spec.ts`

spec 파일(`spec/5-system/`)에는 변경이 없다.

### 1. 요구사항 ID 충돌

신규 요구사항 ID 없음. 충돌 없음.

### 2. 엔티티/타입명 충돌

신규 export 타입/인터페이스 없음.

- `PublicWebhookReqExtension` — 변경 전부터 존재하는 export interface. 신규 도입 아님.
- `extractClientIp` — `public-webhook-throttle.guard.ts` 에서 **제거**됨. `auth/utils/client-ip.ts` 의 동명 export 함수(`extractClientIp(req: Request): string | null`)와 이름이 같았으나 Guard 로컬 함수는 비-export 래퍼였으므로 실제 충돌이 아니었고, 이번 변경으로 제거되어 모호성이 해소됨.
- `hooks.service.ts` 에 남아 있는 모듈-private `function extractClientIp(...)` — 이미 존재하던 비-export 내부 함수이며, 신규 도입이 아니고 export 되지 않으므로 충돌 없음.

### 3. API endpoint 충돌

신규 API endpoint 없음. 충돌 없음.

### 4. 이벤트/메시지명 충돌

신규 이벤트/메시지명 없음. 충돌 없음.

### 5. 환경변수·설정키 충돌

신규 ENV var / config key 없음. 충돌 없음.

### 6. 파일 경로 충돌

신규 spec 파일 생성 없음. 충돌 없음.

### 7. 에러 메시지 문자열 (정보)

- **[INFO]** `http-exception.filter.ts` 의 `mapHttpErrorLike` 반환 메시지가 `exception.message` echo 에서 하드코딩 문자열로 변경됨:
  - 413: `'Request payload too large.'`
  - 기타 4xx: `'The request could not be processed.'`
  - target 신규 식별자: 위 두 리터럴 문자열
  - 기존 사용처: `spec/5-system/3-error-handling.md §1.3` 은 `PAYLOAD_TOO_LARGE` 코드를 정의하나 응답 `message` 필드 값을 고정 문자열로 규정하지 않음(message 는 스펙 미지정 자유 필드)
  - 상세: 스펙이 메시지 값 자체를 등재하지 않으므로 의미 충돌 없음. CWE-209 (정보 노출) 대응의 보안 개선.
  - 제안: 없음. 충돌 아님.

## 요약

이번 diff 는 spec/5-system/ 에 변경이 없으며, 코드 변경은 (1) `GlobalExceptionFilter.mapHttpErrorLike` 의 내부 메시지 echo 제거(보안), (2) `public-webhook-throttle.guard.ts` 의 로컬 `extractClientIp` 래퍼 제거 후 공유 코어 직접 호출 통합, (3) 대응 테스트 이관의 세 가지로 한정된다. 신규 요구사항 ID·export 타입·API endpoint·이벤트명·ENV var·spec 파일 경로 어느 관점에서도 기존 식별자와 충돌하는 신규 식별자는 없다.

## 위험도

NONE
