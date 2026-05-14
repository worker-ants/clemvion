### 발견사항

---

**[WARNING] `ThirdPartyOAuthController`가 `IntegrationsModule`에 등록 — 모듈-URL 경계 불일치**
- 위치: `integrations.module.ts` `controllers: [IntegrationsController, ThirdPartyOAuthController]`
- 상세: URL prefix `/api/3rd-party/`를 담당하는 컨트롤러가 `IntegrationsModule` 안에 등록되어 있다. 모듈이 표현하는 도메인 경계(`integrations` = 사용자 통합 관리)와 컨트롤러가 서비스하는 URL 경계(`3rd-party` = OAuth 공급자 진입점)가 분리되지 않았다. 향후 Cafe24 외 provider 추가 시 `IntegrationsModule`이 점점 더 넓은 책임을 떠안게 된다.
- 제안: `ThirdPartyOAuthModule` (또는 `OAuthCallbackModule`)을 별도 생성하고, `IntegrationOAuthService`를 export해서 주입받는 구조가 명확한 경계를 준다. 현 규모에서는 허용 가능하나 모듈 분리가 권장된다.

---

**[WARNING] 컨트롤러 메서드 내 `process.env` 직접 접근 — 레이어 책임 위반**
- 위치: `third-party-oauth.controller.ts` `oauthCallback()` 내 `process.env.FRONTEND_URL || process.env.APP_URL`; `cafe24Install()` 내 암묵적 env 의존(서비스 위임이지만 컨트롤러가 URL origin을 직접 결정)
- 상세: NestJS의 레이어 규약 상 환경 설정은 `ConfigService`를 주입받아 사용해야 한다. `process.env` 직접 참조는 (a) 테스트 시 실제 환경 변수 오염 의존, (b) 설정 변경 포인트가 컨트롤러에 산재, (c) 런타임 타입 안전성 부재 등의 문제를 야기한다. `makeRes()` 테스트에서 `process.env.FRONTEND_URL`을 직접 set/delete하는 것이 이 패턴의 부작용이다.
- 제안: `ConfigService.get<string>('FRONTEND_URL')` 방식으로 교체하고 `ConfigModule`을 모듈에 import하면 테스트도 `ConfigService` mock으로 격리 가능해진다.

---

**[WARNING] `catch` 블록의 수동 예외 형 캐스팅 — NestJS 예외 필터 미활용**
- 위치: `third-party-oauth.controller.ts` `cafe24Install()` catch 블록 `err as { status?: number; response?: { code?: string; message?: string }; message?: string }`
- 상세: NestJS의 `HttpException`은 `instanceof HttpException`으로 안전하게 타입을 좁힐 수 있음에도 덕 타이핑 캐스팅으로 처리한다. `e.status ?? 400` 폴백이 `ForbiddenException(403)` → 의도치 않은 `400` 반환 같은 버그를 숨길 수 있다(단, 현재 서비스가 NestJS 예외를 올바로 throw한다면 `e.status`가 항상 존재하므로 실제 오발 위험은 낮음). 같은 패턴이 이전 `IntegrationsController`에서도 동일하게 존재했는데 그대로 이식된 것이다.
- 제안: `import { HttpException } from '@nestjs/common'`로 `instanceof` 분기, 또는 커스텀 예외 필터(`@UseFilters`)를 적용해 컨트롤러 catch 블록 자체를 제거하는 것이 더 NestJS다운 구조다.

---

**[INFO] `oauthCallback`과 `cafe24Install`의 혼재 — SRP 경계 애매**
- 위치: `third-party-oauth.controller.ts` 전체
- 상세: `cafe24Install`은 Cafe24 전용(HMAC 검증, redirect), `oauthCallback`은 provider-agnostic 범용 핸들러다. 두 관심사를 한 컨트롤러에 두는 것은 현재 규모에서 실용적이나, Cafe24 install의 쿼리 파라미터 수(12개)가 이 컨트롤러를 이미 무겁게 만들고 있다. `oauthCallback`의 provider 목록이 늘거나 install 로직이 복잡해지면 분리 필요성이 생긴다.
- 제안: 현 구조 유지 허용. 단, `cafe24Install`의 쿼리 파라미터 12개를 `Cafe24InstallQuery` DTO + `@Query()` 객체 바인딩으로 묶으면 메서드 시그니처가 단순해진다.

---

**[INFO] `ALLOWED_OAUTH_PROVIDERS` 검증이 컨트롤러에 위치**
- 위치: `third-party-oauth.controller.ts:oauthCallback()` 내 `ALLOWED_OAUTH_PROVIDERS` 체크
- 상세: 허용 provider 목록은 비즈니스 규칙이므로 서비스 레이어(`IntegrationOAuthService`)에 있어야 한다. 컨트롤러가 이 집합을 알아야 할 이유가 없다. 현재는 서비스도 동일 목록을 갖고 있어 중복 검증이 된다(실제로는 서비스 내부에서도 unknown provider를 거부하는지 확인 필요).
- 제안: 컨트롤러의 provider 검증을 제거하고 서비스에서 `BadRequestException`을 throw하도록 단일화하면, 컨트롤러는 HTTP 매핑에만 집중할 수 있다.

---

### 요약

이번 변경의 핵심인 `ThirdPartyOAuthController` 추출은 옳은 방향이다. `IntegrationsController`에서 OAuth 진입점(공개 엔드포인트)과 인증된 통합 관리 API가 섞여 있던 SRP 위반을 해소했고, `/api/3rd-party/` namespace 도입으로 URL 구조도 명확해졌다. 다만 새 컨트롤러가 `IntegrationsModule`에 그대로 편입되어 모듈-URL 경계 불일치가 남아 있고, `process.env` 직접 참조와 catch 블록의 수동 예외 캐스팅은 이전 컨트롤러의 패턴을 그대로 이식한 형태로 레이어 순결성 측면에서 개선 여지가 있다. 보안·기능 정확성에는 문제가 없으며, 지적 사항은 모두 구조적 품질 개선에 해당한다.

### 위험도

**LOW**