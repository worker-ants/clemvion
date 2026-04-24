### 발견사항

---

**[HIGH] SSRF via 미검증 `baseUrl`**
- 위치: `preview-llm-models.dto.ts` — `baseUrl` 필드, `llm.service.ts:previewModels`
- 상세: `baseUrl`에 `@IsString()` + `@MaxLength(500)` 만 적용되어 있고, URL 형식·스킴 검증이 없다. `editor` 권한 사용자가 `http://169.254.169.254/latest/meta-data/`, `http://localhost:5432/` 등 내부 주소를 `baseUrl`로 전달하면 서버가 해당 엔드포인트로 HTTP 요청을 보낸다. `editor` 권한이 필요해 공격 면은 좁지만, 계정 탈취·내부자 위협 시나리오에서 인프라 정보 수집 경로가 된다.
- 제안: DTO에 `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })` 추가. 서비스 레이어에서도 `http`/`https` 스킴만 허용하는 allowlist 체크 추가. 클라우드 배포 시 메타데이터 IP 대역(`169.254.169.254`, `fd00:ec2::254`)을 명시적으로 차단하는 것을 권장.

---

**[WARNING] 팩토리 원본 에러 메시지가 클라이언트에 그대로 노출**
- 위치: `llm.service.ts` — `previewModels` 내 첫 번째 catch 블록
- 상세: `clientFactory.create()`가 던지는 에러의 `message`를 `sanitizeErrorMessage`를 거치지 않고 `BadRequestException.message`에 그대로 담아 클라이언트에 반환한다. 팩토리 구현이 baseUrl이나 provider 설정을 에러 문자열에 포함시킬 경우 내부 정보가 노출된다.
  ```ts
  throw new BadRequestException({ code: 'LLM_CONFIG_INVALID', message }); // raw
  ```
- 제안: 두 번째 catch와 동일하게 `this.sanitizeErrorMessage(message)`를 거쳐 반환하거나, 팩토리 에러를 위한 별도 sanitize 처리를 추가.

---

**[WARNING] provider 원본 에러를 sanitize 전에 로깅**
- 위치: `llm.service.ts:previewModels` — `client.listModels()` catch 블록
- 상세: 일부 LLM provider는 인증 실패 시 에러 응답 body에 API 키 일부나 요청 헤더를 포함하는 경우가 있다. 현재 raw `message`를 `this.logger.warn()`에 먼저 기록한 뒤 sanitize된 메시지만 throw하므로, 로그에 민감 정보가 남을 수 있다. spec에는 "apiKey는 로그·응답·캐시 어디에도 기록하지 않는다"고 명시되어 있다.
  ```ts
  this.logger.warn(`LLM preview models failed: ${message}`); // raw before sanitize
  ```
- 제안: `this.sanitizeErrorMessage(message)` 결과를 변수에 저장한 뒤 sanitized 메시지를 로그와 예외 모두에 사용.

---

**[INFO] `preview-models` 엔드포인트에 rate limiting 없음**
- 위치: `llm-config.controller.ts:previewModels`
- 상세: 이 엔드포인트는 외부 LLM provider API 호출을 프록시한다. `editor` 권한 사용자가 반복 호출해 타 provider 계정의 credential stuffing(API 키 유효성 검증 자동화) 또는 자체 provider API 쿼터 소진에 악용할 수 있다.
- 제안: NestJS `@nestjs/throttler`의 Throttle 데코레이터(`@Throttle({ default: { limit: 10, ttl: 60000 } })`)를 해당 엔드포인트에 적용.

---

**[INFO] `baseUrl` URL 형식 검증 부재 (DTO 레벨)**
- 위치: `preview-llm-models.dto.ts`
- 상세: `@IsUrl()` validator 없이 임의 문자열이 통과된다. SSRF 항목과 연동되는 근본 원인.
- 제안: `class-validator`의 `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })`로 형식 강제.

---

### 요약

이번 변경의 핵심인 `POST /api/llm-configs/preview-models` 엔드포인트는 인증·인가(`editor` 역할 필수), API 키 미저장·미캐시, 에러 sanitize 등 기본 보안 설계는 잘 갖추어졌다. 그러나 `baseUrl` 파라미터에 URL 형식·스킴 제한이 없어 인증된 editor가 서버를 SSRF 벡터로 활용할 수 있는 중간 위험도 취약점이 존재하며, 팩토리 에러 메시지가 sanitize 없이 클라이언트에 반환되는 정보 노출 문제와 로그에 provider 원본 에러가 기록될 수 있는 로깅 취약점도 함께 수정이 필요하다.

### 위험도

**MEDIUM** (SSRF는 editor 권한 이상만 접근 가능하나, URL validation 부재로 인한 내부 네트워크 접근 가능성이 확인됨)