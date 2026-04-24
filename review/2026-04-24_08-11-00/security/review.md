## 보안 코드 리뷰

---

### 발견사항

---

**[WARNING] SSRF — DNS 기반 Private IP 우회 가능**
- **위치**: `backend/src/modules/llm/llm.service.ts` — `isPrivateHost()` 함수
- **상세**: `isPrivateHost()`는 IPv4 리터럴(`10.x`, `127.x`, `172.16–31.x`, `192.168.x`, `169.254.x`)과 `localhost`/`::1`만 차단한다. 공격자가 자신이 제어하는 도메인(예: `evil.com`)을 내부 IP(`10.0.0.1` 등)로 해석되도록 DNS를 설정하면 이 검사를 통과한다. 코드 주석(`DNS 이름은 해석 비용상 제외`)에서 이 한계를 인정하고 있으나, 편집자(editor) 권한을 가진 테넌트가 인프라 내부 서비스로 요청을 유도할 수 있다.
- **제안**: 가능하면 DNS 룩업 후 결과 IP를 재확인하거나, 별도의 아웃바운드 프록시/egress 제어로 네트워크 레벨에서 차단한다. 단기적으로는 현재 주석이 명확하므로 위험 수준을 문서화하고, 운영 환경에서 egress 방화벽으로 보완할 것을 권장한다.

---

**[WARNING] SSRF — IPv6 사설 주소 범위 미처리**
- **위치**: `backend/src/modules/llm/llm.service.ts` — `isPrivateHost()` 함수
- **상세**: `::1`/`[::1]`만 차단하고 `fc00::/7`(ULA, unique-local), `fe80::/10`(link-local) 등 IPv6 사설 범위는 점검하지 않는다. `baseUrl`에 `http://[fc00::1]/` 같은 값을 넣으면 차단을 우회할 수 있다.
- **제안**: IPv6 hostname 파싱 시 `fc`, `fd`, `fe80` 등 사설 접두사를 추가로 확인하거나, `@IsUrl({ protocols: ['http', 'https'], require_tld: true })` 등의 DTO 레벨 제약으로 IP 리터럴 자체를 금지한다(단, `local` 프로바이더 예외 처리 필요).

---

**[WARNING] SSRF — `0.0.0.0` 미차단**
- **위치**: `backend/src/modules/llm/llm.service.ts` — `isPrivateHost()` 함수
- **상세**: `a=0`은 어떤 조건에도 해당하지 않아 `false`를 반환한다. `0.0.0.0`은 많은 OS에서 localhost에 바인딩된 모든 인터페이스로 해석된다.
- **제안**: `if (a === 0) return true;` 조건을 추가한다.

---

**[INFO] Factory 에러 메시지 원문 노출**
- **위치**: `backend/src/modules/llm/llm.service.ts` — `previewModels()` 내 factory 에러 처리 블록
- **상세**: `LLMClientFactory.create()`에서 발생하는 에러는 `sanitizeErrorMessage()`를 거치지 않고 `LLM_CONFIG_INVALID` 코드와 함께 그대로 클라이언트에 반환된다. 주석은 "apiKey를 포함하지 않는다"고 설명하지만, 팩토리 구현이 변경될 경우 내부 구성 정보가 노출될 수 있다.
- **제안**: factory 에러도 `sanitizeErrorMessage()`를 통과시키거나, 최소한 팩토리가 반환하는 에러 메시지에 API 키나 내부 경로가 포함되지 않도록 단위 테스트로 보장한다.

---

**[INFO] 요청 본문 내 API Key 전송**
- **위치**: `frontend/src/lib/api/llm-configs.ts` — `previewModels()`, 백엔드 `PreviewLlmModelsDto`
- **상세**: `apiKey`가 POST body로 전달된다. HTTPS가 강제된 환경이라면 허용 가능하나, 액세스 로그나 미들웨어에서 request body를 로깅하는 경우 키가 노출될 수 있다. 현재 서비스 레이어는 `apiKey`를 로그에 남기지 않도록 주의하고 있으나, 미들웨어/인터셉터 레벨은 확인 필요하다.
- **제안**: 요청 로거(morgan, NestJS LoggingInterceptor 등)에서 `apiKey` 필드가 마스킹되는지 확인한다.

---

**[INFO] Rate limit 범위 확인 필요**
- **위치**: `backend/src/modules/llm-config/llm-config.controller.ts` — `@Throttle({ default: { limit: 10, ttl: 60_000 } })`
- **상세**: Rate limit 10회/분은 적절하나, NestJS throttler의 키 생성 방식이 IP 기반인 경우 NAT 뒤의 다수 사용자가 버킷을 공유해 정상 요청이 제한될 수 있다. 반대로 사용자 ID 기반이 아니라면 한 IP에서 다수 계정으로 우회 가능하다.
- **제안**: throttler 전역 설정에서 키 생성 방식을 확인하고, 사용자 ID(JWT 기반) 키를 사용하도록 구성한다.

---

**[INFO] `PreviewLlmModelsDto` — 스키마 레벨 SSRF 방어 부재**
- **위치**: `backend/src/modules/llm-config/dto/preview-llm-models.dto.spec.ts`
- **상세**: DTO 테스트에서 `file:///etc/passwd` 같은 비 HTTP 스킴은 잘 막고 있다. 그러나 `http://169.254.169.254/`(클라우드 메타데이터) 같은 정상적 HTTP URL은 DTO를 통과하고 서비스 레이어의 `isPrivateHost()`에만 의존한다. DTO 레벨에서 `require_tld: true` 옵션을 추가하면 IP 리터럴 URL을 1차로 차단할 수 있다(`local` 프로바이더 예외 로직 필요).
- **제안**: `local` 프로바이더가 아닌 경우 `@IsUrl({ require_tld: true })`를 적용하는 커스텀 validator 추가를 고려한다.

---

### 요약

이번 변경의 핵심 보안 신규 기능은 **`POST /api/llm-configs/preview-models`** 엔드포인트다. 30초 타임아웃, `AbortSignal` 전파, 에러 sanitization, `editor` 권한 제한, Rate limiting, API Key 미저장 원칙 등 주요 보안 요건은 충실히 구현되었다. 가장 주의할 점은 SSRF 방어의 DNS 기반 우회 가능성으로, 현재 구현은 IPv4 리터럴만 검사하여 공격자 제어 도메인이 private IP로 해석되는 경우를 막지 못한다. IPv6 사설 범위(`fc00::/7`, `fe80::/10`)와 `0.0.0.0`도 미차단 상태다. TypeScript `as unknown as` 캐스트 제거 및 Google SDK 마이그레이션(`@google/generative-ai` → `@google/genai`)은 보안에 직접적인 영향이 없는 품질 개선이다.

### 위험도

**MEDIUM**