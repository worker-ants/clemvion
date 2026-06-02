# API 계약(API Contract) 리뷰

## 발견사항

### [INFO] 429 응답 형식이 기존 에러 envelope 규약과 일치함
- 위치: `third-party-oauth.controller.ts` — `isLockedOut` 분기, 약 line 928–936
- 상세: 새로 추가된 429 응답은 `{ error: { code, message } }` 구조를 사용하며, 이는 API H-1 (spec §5.3) 에러 envelope 규약과 일치한다. 기존 404/403/400 응답과 동일한 형식이므로 클라이언트 파싱 로직에 영향 없음.
- 제안: 해당 없음 (규약 준수).

### [INFO] `CAFE24_INSTALL_RATE_LIMITED` 에러 코드 — 새 코드이나 breaking change 아님
- 위치: `third-party-oauth.controller.ts` line 929–935
- 상세: 새 에러 코드 `CAFE24_INSTALL_RATE_LIMITED`는 기존 클라이언트가 처리하지 않던 케이스다. 그러나 이 엔드포인트는 Cafe24 인프라가 자동 호출하는 install flow이며, lockout은 정상 사용자에게는 발생하지 않도록 설계되어 있다. 기존 클라이언트(Cafe24 플랫폼)는 429 응답을 받더라도 install 재시도 흐름을 가지므로 계약 파괴는 아니다.
- 제안: 해당 없음.

### [INFO] Swagger `@ApiTooManyRequestsResponse` 추가 — API 문서 계약 갱신 완료
- 위치: `third-party-oauth.controller.ts` line 1052–1055
- 상세: 새 429 응답이 Swagger 문서에 정확히 선언되었다. 응답 설명도 에러 코드명과 조건을 명시하여 클라이언트 개발자가 참고할 수 있다.
- 제안: 해당 없음.

### [INFO] `Cafe24InstallRateLimitService` 가 `IntegrationsModule` exports 에 포함되지 않음 — 의도적 설계
- 위치: `integrations.module.ts` line 671–675
- 상세: `Cafe24InstallRateLimitService`는 `providers`에만 등록되고 `exports`에는 포함되지 않는다. 해당 서비스는 `ThirdPartyOAuthController`(같은 모듈 내)에서만 소비되므로 외부 노출이 불필요하다. API 계약 측면에서 적절한 캡슐화.
- 제안: 해당 없음.

### [INFO] IP 기반 lockout — `req.ip` 의존, Proxy 환경 고려 필요
- 위치: `third-party-oauth.controller.ts` line 923 (`const clientIp = req.ip`)
- 상세: `req.ip`는 NestJS/Express의 기본 IP 해석으로, reverse proxy 환경에서 `X-Forwarded-For` 헤더 처리 여부가 Express `trust proxy` 설정에 의존한다. 만약 `trust proxy`가 설정되지 않으면 모든 요청의 `req.ip`가 proxy IP로 단일화되어 정상 사용자 전체가 lockout될 위험이 있다. API 계약 계층에서는 직접적인 breaking change는 아니지만, lockout 오발동 시 정상 install 요청에 429가 반환되어 API 가용성에 영향을 준다.
- 제안: 배포 인프라에서 `trust proxy` 설정이 올바른지 확인하거나, `X-Forwarded-For` 헤더를 명시적으로 파싱하는 헬퍼를 두는 것을 권장. 이는 서비스 레이어가 아닌 인프라/설정 레벨 확인 사항.

### [INFO] 에러 응답 HTTP 상태 코드 일관성 확인
- 위치: `third-party-oauth.controller.ts` 전반
- 상세: 429(rate limited), 404(invalid token/not found), 403(invalid HMAC), 400(missing params/replay), 302(success redirect)로 구성. HTTP 표준에 부합하며 Cafe24 통합 spec §9.8과 일치. `CAFE24_INSTALL_RATE_LIMITED`를 429로 응답하는 것은 Layer 1 throttle(429)과 동일한 상태 코드를 사용해 클라이언트 처리 일관성이 높다.
- 제안: 해당 없음.

### [INFO] 실패 페널티 트리거 조건 — REPLAY(400) 제외 설계 확인
- 위치: `third-party-oauth.controller.ts` line 952–957
- 상세: `CAFE24_INSTALL_REPLAY`(400)는 `recordFailure` 대상에서 제외된다. 이는 replay가 enumeration 신호가 아닌 타임스탬프 만료(정상 사용자 가능)임을 반영한 설계로 API 계약 관점에서 적절하다. 다만 `CAFE24_INSTALL_FAILED`(서버측 내부 오류) 역시 카운트 제외인데, 이는 서버 오류를 클라이언트 페널티로 전환하지 않는다는 원칙과 일치.
- 제안: 해당 없음.

## 요약

이번 변경은 Cafe24 install 엔드포인트에 Layer 2 실패 페널티 rate limiting을 추가한 것으로, API 계약 관점에서 주요 위반 사항이 없다. 새 429 응답은 기존 `{ error: { code, message } }` envelope 규약을 준수하고, Swagger 문서에도 정상 선언되었다. 에러 코드 `CAFE24_INSTALL_RATE_LIMITED`는 신규 추가이지만 lockout은 정상 사용자에게 발생하지 않도록 설계되어 하위 호환성 영향이 극히 낮다. 유일한 주의 사항은 `req.ip` 의존으로 인한 reverse proxy 환경에서의 IP 해석 정확성인데, 이는 API 계약 파괴가 아닌 인프라 설정 검증 사항으로 INFO 수준이다. 전반적으로 API 계약 일관성이 유지되었으며 breaking change 없음.

## 위험도

LOW
