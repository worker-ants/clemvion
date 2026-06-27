# Security Review

## 발견사항

### [INFO] ParseEnumPipe에 TypeScript enum 대신 배열 전달 — 기능은 정확하나 비표준
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L218
- 상세: `new ParseEnumPipe(['chat', 'embedding'], { optional: true })`는 NestJS의 비공식 API 사용이다. NestJS `ParseEnumPipe.isEnum()`은 내부적으로 `Object.values(enumType)` 을 호출하므로, 배열을 전달하면 `Object.values(['chat', 'embedding']) === ['chat', 'embedding']`이 되어 **현재 NestJS 버전에서는 정상 동작**한다. 그러나 공식 타입 서명 (`enumType: T`) 은 TypeScript enum 객체를 기대하며, NestJS 내부 구현 변경 시 enum 검증이 무력화될 위험이 있다. 또한 TypeScript 컴파일러가 타입 안전성 보장을 못한다.
- 제안: 별도 enum을 선언해 사용하는 것이 정석이다.
  ```typescript
  enum ModelType { Chat = 'chat', Embedding = 'embedding' }
  @Query('type', new ParseEnumPipe(ModelType, { optional: true })) type?: 'chat' | 'embedding'
  ```
  그렇지 않으면 현재 동작이 NestJS 버전에 묵시적으로 의존함을 주석으로 명시해야 한다.

---

### [INFO] `listModels` 엔드포인트 — `@Roles` 미적용이 의도적임을 재확인
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L195-L222
- 상세: `GET :id/models`에는 `@Roles` 데코레이터가 없다. `RolesGuard.canActivate()`는 `requiredRoles`가 빈 경우 `return true`를 반환하며 인증 검사를 수행하지 않는다 (L51-53). 즉, JWT 전역 가드가 별도로 먼저 동작해야 미인증 요청이 차단된다.
- 코드 주석은 이것이 spec §3·R-7 (Viewer+ 접근) 의도적 설계라고 명시하며, "워크스페이스 멤버십 미충족 403은 컨트롤러 공통 인증 계층 책임"이라고 적혀있다. `WorkspaceId` 데코레이터가 없는 경우 `BadRequestException`을 발생시켜 미인증 요청을 부분적으로 필터링하지만, 이는 인증 목적이 아니다.
- 제안: 글로벌 `JwtAuthGuard`(또는 동등한 가드)가 앱 모듈 레벨에서 등록되어 있는지 별도 확인을 권장한다. 현재 아키텍처가 이를 보장하고 있다면 이 항목은 무시 가능하다.

---

### [INFO] `previewModels` — API Key 요청 바디 평문 전송 (기존 이슈)
- 위치: `codebase/backend/src/modules/model-config/dto/preview-model-list.dto.ts` L57-59
- 상세: `PreviewModelListDto.apiKey`는 HTTP 요청 바디에 평문으로 전달된다. 이번 diff의 변경사항이 아니나, 해당 DTO가 이번 리뷰 범위의 컨트롤러(`previewModels`)에서 소비된다. DTO 코드 내 "보안 계약" 주석(L34-39)에서 이 사실을 인식하고 있으며, body 로거·APM이 `apiKey`를 캡처하지 않도록 명시하고, 헤더 기반 분리를 별도 PR로 이관했다고 기술되어 있다.
- `MaxLength(500)` 제한이 있고 서비스가 저장/캐시하지 않음을 명시하고 있어 현재 설계 범위 내에서 수용 가능하다. 단, HTTPS 전송이 전제이므로 인프라 수준에서 HTTPS 강제를 반드시 확인해야 한다.
- 제안: 향후 헤더 기반 전달(`Authorization: Bearer <key>`) 또는 요청 바디 마스킹 미들웨어 (`mask-sensitive-fields.util.ts`) 적용 시 body 로깅에서 `apiKey`가 제외되는지 확인.

---

### [INFO] `baseUrl` — SSRF 가능성 (기존 이슈, 설계 의도 내)
- 위치: `codebase/backend/src/modules/model-config/dto/preview-model-list.dto.ts` L70-79
- 상세: `@IsUrl({ require_tld: false, protocols: ['http', 'https'] })`는 TLD를 요구하지 않으므로 `http://localhost/`, `http://169.254.169.254/` (AWS 메타데이터 엔드포인트), `http://10.0.0.x/` 등 내부 네트워크 URL이 허용된다. Azure/Local 프로바이더 요건상 `http://localhost:11434/v1` 형태가 필요하므로 이는 설계 의도이나, Editor+ 권한 사용자가 백엔드를 통해 내부 서비스를 프로빙할 수 있다.
- 제안: 위협 모델에서 내부 사용자(Editor+)에 의한 SSRF를 허용하는 경우 현 상태 유지. 그렇지 않다면 allow-list 방식(허용된 호스트/IP 대역)을 고려하거나, 내부 IP 범위를 차단하는 검증 로직을 추가할 것.

---

### [POSITIVE] `type` 쿼리 파라미터 enum 검증 추가 — 보안 개선
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L218
- 상세: 변경 전(`@Query('type') type?: 'chat' | 'embedding'`)은 TypeScript 타입 선언이 런타임에 아무런 검증을 수행하지 않아 임의 문자열이 서비스 계층으로 전달될 수 있었다. 이번 변경으로 `ParseEnumPipe`가 추가되어 `'chat'` 또는 `'embedding'` 외의 값은 400 Bad Request로 거부된다. 이는 입력 검증 관점에서 명백한 개선이다.

---

### [POSITIVE] `PROVIDER_PROBE_THROTTLE` 상수화 — 일관성 유지
- 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.ts` L130
- 상세: 3개 핸들러에 분산된 throttle 설정(`{ default: { limit: 10, ttl: 60_000 } }`)을 단일 상수로 통합했다. 이로 인해 향후 throttle 한도를 수정할 때 한 곳만 변경하면 되어 설정 드리프트로 인한 보안 정책 불일치 위험이 제거된다.

---

## 요약

이번 변경의 핵심은 `type` 쿼리 파라미터에 `ParseEnumPipe`를 적용한 입력 검증 강화와 throttle 설정의 단일 상수화(DRY)다. 두 변경 모두 보안 관점에서 중립 이상이며, 특히 enum 검증 추가는 임의 문자열이 서비스 계층에 전달되던 취약점을 해소한다. 기존 설계에서 유래한 잠재적 우려사항(API Key 평문 전송, baseUrl SSRF 가능성)은 DTO 코드에 이미 인식되어 있고 설계 범위 내에서 수용된 결정이다. `ParseEnumPipe`에 TypeScript enum 대신 배열을 전달하는 비표준 호출 방식은 현재 NestJS에서 기능적으로 동작하나 공식 API가 아니어서 향후 버전 업그레이드 시 무성 실패(silent failure) 위험이 있다. 인증/인가 구조는 spec R-7을 따르며 `@Roles('editor')`가 editor 전용 엔드포인트에 정확히 적용되어 있다. 신규 보안 취약점은 도입되지 않았다.

## 위험도

LOW
