## 발견사항

### **[INFO]** `defaultParams` 필드에 대한 JSON 깊이/크기 제한 없음
- 위치: `/codebase/backend/src/modules/model-config/dto/create-model-config.dto.ts` 라인 92–99, `update-model-config.dto.ts` 라인 59–64
- 상세: `defaultParams` 는 `@IsObject()` 만 있고 중첩 깊이, 키 수, 총 크기에 대한 제한이 없다. 공격자가 editor 권한으로 매우 큰/깊은 JSON 오브젝트를 전송해 DB 저장(jsonb) 및 역직렬화 과정에서 메모리 압박을 유발할 수 있다. 이는 서비스 수준의 과부하 위험이며, OWASP API06 (Unrestricted Resource Consumption) 에 해당한다.
- 제안: `@MaxLength` 는 문자열에 한정되므로, 커스텀 데코레이터나 인터셉터로 JSON 직렬화 후 바이트 크기(예: 64 KB 이하) 제한을 적용하거나, `@ValidateNested` + 허용 키 화이트리스트 방식을 검토한다.

### **[INFO]** `baseUrl` 에 `@IsUrl()` 검증 없음 — SSRF 가드의 서비스 레이어 의존
- 위치: `/codebase/backend/src/modules/model-config/dto/create-model-config.dto.ts` 라인 71–79, `update-model-config.dto.ts` 라인 42–48
- 상세: `baseUrl` 필드는 `@IsString()` + `@MaxLength(500)` 만 있고 `@IsUrl()` (URL 형식 강제) 이 없다. SSRF 차단은 `assertBaseUrlNotSsrf` (서비스 레이어)에서 수행되지만, 잘못된 형식의 URL(예: `javascript:...`, `data:...`)을 DTO 단에서 거르지 않는다. `ssrf.util.ts` 의 `isPrivateHost` 는 파싱 실패 시 `false` 를 반환하므로 비정상 URL 이 서비스까지 통과할 수 있다.
- 제안: `@IsUrl({ protocols: ['http', 'https'], require_tld: true })` 를 DTO 레이어에서 추가해 URL 형식 검증을 DTO 가 최우선 방어선으로 담당하도록 한다.

### **[INFO]** DNS rebinding 공격에 대한 알려진 한계
- 위치: `/codebase/backend/src/common/utils/ssrf.util.ts` 라인 72–78
- 상세: 코드 자체가 주석으로 "DNS rebinding 2차 공격(TTL 경과 후 재해석)은 connect 시점 re-resolve 가 필요해 현 Node 표준 라이브러리로는 차단할 수 없다"고 명시하고 있다. `assertBaseUrlNotSsrf` 는 저장 시점 1회만 검사하므로, 공격자가 TTL 기간 이후 A 레코드를 사설망 IP 로 변경해 기저장된 `baseUrl` 로 SSRF 를 시도할 수 있다.
- 제안: 스펙(spec §5.5)에서 언급된 대로, 완전한 차단에는 egress 방화벽/네트워크 정책 보완이 필요하다. 운영 환경에서 이 레이어가 적용되어 있는지 인프라 측에서 확인이 필요하다.

### **[INFO]** `maskApiKey` 에서 복호화 실패 시 에러 무시(silent catch)
- 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` 라인 354–359
- 상세: `maskApiKey` 내 `try/catch` 에서 복호화 실패 시 단순히 `****` 를 반환하고 예외를 소비한다. 암호화 키 로테이션·DB 손상 등으로 복호화가 실패해도 에러 로그가 남지 않아 운영 중 이상 탐지가 어렵다.
- 제안: `catch` 블록에서 경고 수준 로그(`logger.warn`)를 남겨 복호화 실패 발생 빈도를 모니터링할 수 있게 한다.

### **[INFO]** `encryptionKey` 빈 문자열 허용 — 초기화 에러가 런타임까지 지연
- 위치: `/codebase/backend/src/modules/model-config/model-config.service.ts` 라인 33–34
- 상세: `this.encryptionKey = this.configService.get<string>('llm.encryptionKey') || ''` 로 초기화되며, 키가 없을 경우 빈 문자열로 설정된다. 실제 암호화 시도는 `encryptOptionalKey` 에서 `ENCRYPTION_KEY_MISSING` 예외를 던지지만, `getDecryptedApiKey` 나 `maskApiKey` 는 빈 키를 그대로 `decrypt()` 에 전달해 크립토 레이어 오류를 발생시킨다. 생산 fail-closed 가드(PR #539)가 이를 차단하더라도, 서비스 생성자 수준의 명시적 early-fail 이 있으면 더 안전하다.
- 제안: 생성자에서 `if (!this.encryptionKey) { throw new Error('ENCRYPTION_KEY is required') }` 형태의 early validation 을 추가한다(단, PR #539 가드와 중복 여부 확인 필요).

### **[INFO]** `previewModels` 엔드포인트에서 `workspaceId` 격리 없음
- 위치: `/codebase/backend/src/modules/model-config/model-config.controller.ts` 라인 162–179
- 상세: `POST /model-configs/preview-models` 는 `@Roles('editor')` 가 있고 throttle(10 req/min) 이 적용되어 있다. 그러나 요청에 `workspaceId` 컨텍스트가 전달되지 않고, `LlmPreviewService.previewModels` 가 수신한 `apiKey` 를 즉시 외부 Provider 에 전송한다. 자격증명이 저장되지 않는다는 점은 명시되어 있으나, editor 가 타 워크스페이스에서 얻은 키를 여기서 검증용으로 사용하는 것을 막을 수단이 없다. Throttle 이 이를 완화하지만 완전한 격리는 아니다.
- 제안: 현재 설계(저장 없음 + throttle)는 허용 범위 내로 판단되나, `LlmPreviewService` 내부에서 요청 메타데이터(workspaceId, userId)를 감사 로그로 남기는 것을 고려한다.

---

## 요약

이번 변경은 `model-config` 모듈의 컨트롤러 스펙 파일 1건이 주요 검토 대상이며, 연관된 서비스·DTO·유틸리티 파일을 함께 분석했다. SQL 인젝션은 TypeORM QueryBuilder 의 파라미터 바인딩(`where('mc.workspace_id = :workspaceId', ...)`)으로 방어되어 있다. 하드코딩된 시크릿은 없으며, apiKey 는 AES-256-GCM 으로 암호화 저장되고 응답 시 마스킹된다. 인증/인가는 JWT + RolesGuard(`editor` 이상)가 변경 경로를 일관되게 보호한다. SSRF 방어는 IP 리터럴·DNS 해석 두 단계로 구현되어 있으며, DNS rebinding 한계는 코드 주석에 명시되고 인프라 보완이 권고되어 있다. 발견된 항목은 모두 INFO 수준이며, 즉각적인 보안 위협으로 분류되는 Critical/Warning 항목은 없다.

## 위험도

LOW
