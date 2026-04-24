## 보안 코드 리뷰 결과

### 발견사항

---

#### **[WARNING]** SSRF 가드: URL 스킴 미검증

- **위치**: `backend/src/modules/llm/llm.service.ts` — `isPrivateHost()` 함수
- **상세**: `isPrivateHost()`는 hostname 기반 IP 대역 검사만 수행하며, URL 스킴을 검증하지 않습니다. `file:///etc/passwd`나 `ftp://internal-server` 같은 비-HTTP URL이 입력되면 `new URL(...).hostname`이 빈 문자열(`''`)을 반환하고 `if (!hostname) return false`로 빠져나가 **가드를 통과**합니다.

  ```ts
  // file:///etc/passwd → hostname = '' → return false (private 아님으로 판정)
  // ftp://10.0.0.5 → hostname = '10.0.0.5' → a=10 → return true (차단)
  ```

  현재 LLM SDK는 `file://`/`ftp://`를 HTTP 엔드포인트로 사용하지 않으므로 직접 익스플로잇 가능성은 낮습니다. 그러나 미래 SDK 변경이나 신규 프로바이더 추가 시 위험이 생길 수 있습니다.

- **제안**: 스킴 허용 목록 검사를 추가합니다.

  ```ts
  const parsed = new URL(rawUrl);
  if (!['http:', 'https:'].includes(parsed.protocol)) return false; // or block
  hostname = parsed.hostname.toLowerCase();
  ```

---

#### **[INFO]** 팩토리 에러 메시지 비살균 노출

- **위치**: `backend/src/modules/llm/llm.service.ts` — `previewModels()` 내 factory `catch` 블록
- **상세**: 클라이언트 생성 실패 시의 원본 에러 메시지(`raw`)를 `sanitizeErrorMessage()` 없이 직접 응답 `message` 필드와 logger에 노출합니다. 코드 주석은 "Factory errors contain no user-supplied apiKey"라고 명시하지만, 이는 팩토리 구현에 대한 묵시적 신뢰에 의존합니다. 팩토리가 verbose 에러를 생성하는 경우(예: 설정값을 에러 메시지에 포함) apiKey가 로그나 응답에 유출될 수 있습니다.

  ```ts
  // provider errors: sanitizeErrorMessage(raw) 적용됨 ✓
  // factory errors: raw 그대로 노출됨 ⚠
  throw new BadRequestException({ code: 'LLM_CONFIG_INVALID', message: raw });
  ```

- **제안**: `llm-client.factory.ts`에서 에러 메시지에 자격증명이 포함되지 않음을 코드 레벨에서 보장하거나, factory 에러도 sanitize 처리합니다.

---

#### **[INFO]** DNS 리바인딩 미차단 (문서화된 한계)

- **위치**: `backend/src/modules/llm/llm.service.ts` — `isPrivateHost()` 주석
- **상세**: 코드 내 주석에 명시되어 있듯 DNS 이름에 대한 IP 해석을 수행하지 않습니다. `editor` 권한 + `@Throttle(10/60s)` rate limit + 실질적인 공격 빈도의 낮음으로 완화되지만, DNS 리바인딩으로 private IP를 가리키는 외부 도메인 이름을 통해 우회가 이론적으로 가능합니다.
- **제안**: 현 완화책(rate limit + editor 권한)을 유지하며, 고보안 환경에서는 egress 방화벽/클라우드 네트워크 정책으로 보완을 권고합니다(이미 스펙에 기술됨).

---

#### **[INFO]** `PreviewLlmModelsDto` 스펙 미확인

- **위치**: 변경 diff에 해당 DTO 파일이 포함되지 않음
- **상세**: `llm-config.controller.ts`에서 `@Body() dto: PreviewLlmModelsDto`를 사용하지만, 해당 DTO의 검증 로직이 리뷰 범위에 없습니다. 특히 `baseUrl`에 `@IsUrl()` 유효성 검사가 적용되어 있는지, `provider`에 `@IsIn(LLM_PROVIDERS)` 검사가 있는지 확인이 필요합니다.
- **제안**: DTO 파일에서 다음을 확인하세요:
  - `provider`: `@IsIn(LLM_PROVIDERS)` 적용
  - `baseUrl`: `@IsUrl({ protocols: ['http', 'https'] })` 또는 동등한 검증
  - `apiKey`: 길이 제한(예: `@MaxLength(256)`)

---

#### **[INFO]** `withTimeout` — 타이머 미해제 edge case

- **위치**: `backend/src/modules/llm/llm.service.ts` — `withTimeout()`
- **상세**: `finally { if (timer) clearTimeout(timer) }` 패턴은 정상적으로 구현되었습니다. 다만 `inner.catch(() => undefined)` 처리로 SDK 에러가 무음으로 삼켜지는 게 의도된 동작임이 명확히 문서화되어야 합니다. (abort 전파 시 발생하는 SDK rejection을 타이머 경쟁 결과로 처리하는 것은 올바른 패턴입니다.)

---

### 긍정적 발견사항

- **apiKey 비저장 정책**: `previewModels`에서 apiKey가 cache·log·DB 어디에도 기록되지 않는 설계가 코드 레벨에서 철저히 구현됨
- **에러 살균**: `sanitizeErrorMessage()`로 provider 원본 에러(401, 429, ECONNREFUSED 등)가 사용자 친화적 메시지로 변환되어 원본 URL/키 노출 방지
- **isDefault 트랜잭션**: `create`/`update` 양쪽에서 동일 패턴으로 race condition 방지
- **IPv6 SSRF 커버리지**: loopback(`::1`), ULA(`fc00::/7`), link-local(`fe80::/10`), IPv4-mapped IPv6 모두 커버
- **delete-then-cache 순서 수정**: DB 삭제 후 캐시 제거 순서 변경으로 재로드 불일치 방지
- **rate limiting**: `@Throttle(10/60s)` + `editor` 권한으로 abuse 완화

---

### 요약

이번 변경에서 보안적으로 가장 중요한 신규 기능인 `previewModels` 엔드포인트는 SSRF 가드, 에러 살균, apiKey 비저장, rate limiting, editor 권한 요구를 모두 갖춘 방어적 구현으로 전반적으로 양호합니다. 주요 보완점은 `isPrivateHost()`의 URL 스킴 미검증(WARNING)과 팩토리 에러 비살균 노출(INFO)입니다. DNS 리바인딩은 문서화된 한계이며 현재 완화책 수준에서는 수용 가능합니다. 나머지 변경사항(TypeScript 타입 캐스트 제거, SDK 마이그레이션, 트랜잭션 추가)은 보안 중립적이거나 긍정적입니다.

### 위험도

**LOW**