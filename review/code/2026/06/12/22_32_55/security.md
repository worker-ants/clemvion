# 보안(Security) 리뷰 결과

## 발견사항

### **[INFO]** JWT fallback secret 변경 (websocket.module.ts)
- 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` — `secret: ... ?? 'dev-jwt-secret'`
- 상세: `'fallback'` → `'dev-jwt-secret'` 로 교체. 주석에서 언급한 대로 `assertProductionConfig`의 `INSECURE_JWT_SECRETS` 목록이 이 sentinel 값을 차단한다면, 운영 환경에서 예측 가능한 secret 이 서명에 사용되는 위험을 줄인다. 다만 해당 production guard 가 실제로 `'dev-jwt-secret'` 을 금지 목록에 포함하는지 코드에서 확인이 필요하다. 해당 sentinel 이 차단 목록에 없다면 의존성 주입 경합 시 `'dev-jwt-secret'` 로 서명된 JWT 가 운영에서 수락될 수 있다.
- 제안: `assertProductionConfig` 에서 `INSECURE_JWT_SECRETS` 배열에 `'dev-jwt-secret'` 이 명시적으로 포함되어 있는지 확인·문서화한다. 포함되지 않았다면 반드시 추가한다.

### **[INFO]** CF-Connecting-IP 신뢰 로직 단일화 (client-ip.ts, hooks.service.ts, public-webhook-throttle.guard.ts)
- 위치: `codebase/backend/src/modules/auth/utils/client-ip.ts`, `codebase/backend/src/modules/hooks/hooks.service.ts`, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts`
- 상세: 분산되어 있던 CF-Connecting-IP/XFF 파싱 사본 3개를 `extractClientIpFromHeaders` 하나로 통합. 사본 간 구현 불일치(drift)가 security-relevant IP 추출(rate-limit, ip_whitelist)에 무결성 갭을 만들 수 있었는데 이번에 해소됨. `TRUST_CF_CONNECTING_IP` 가 기본 off 인 fail-safe 정책 유지, 정확히 `'true'`/`'1'` 만 ON 처리.
- 제안: 이상 없음. 통합 후 동작은 기존 각 사본과 동일하며, 테스트 커버리지(spec 파일)가 주요 경로를 확인함.

### **[INFO]** null Origin(sandbox iframe) CSRF 방어 테스트 추가 (auth.controller.spec.ts)
- 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts` — `rejects refresh from a null origin` 테스트
- 상세: `origin: 'null'` 을 wildcard 모드에서도 거부하는 테스트 추가. 불투명 origin(`null` 문자열)이 sandbox iframe CSRF 벡터로 쓰일 수 있음을 명시적으로 인식하고 방어.
- 제안: 이상 없음.

### **[INFO]** clearRefreshTokenCookie domain parity 테스트 (refresh-cookie.spec.ts)
- 위치: `codebase/backend/src/modules/auth/utils/refresh-cookie.spec.ts` — `includes domain when provided (set/clear domain parity)` 테스트
- 상세: set/clear 쿠키에서 domain 옵션이 동일하게 적용되는지 검증하는 테스트 추가. set 은 domain 포함하고 clear 는 domain 생략하면 브라우저가 쿠키를 삭제하지 못해 logout 후 세션이 잔존하는 silent failure 가능. 해당 패리티를 테스트로 보장.
- 제안: 이상 없음.

### **[INFO]** WebSocket notifications 채널 userId 미설정 시 fail-closed (websocket.gateway.spec.ts)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` — `should reject notifications channel when the socket has no userId` 테스트
- 상세: 인증 미들웨어 회귀로 `userId` 가 설정되지 않은 소켓이 `notifications:<userId>` 채널을 구독 시도할 때 거부(fail-closed)됨을 검증하는 테스트 추가. 인증 실패 시 알림 누출 방지 보증.
- 제안: 이상 없음. fail-closed 방어가 테스트로 고정되었음.

### **[INFO]** ReDoS 방어 주석 명확화 (condition-evaluator.util.ts)
- 위치: `codebase/backend/src/nodes/core/condition-evaluator.util.ts` — `MAX_REGEX_LENGTH` 주석
- 상세: `MAX_REGEX_LENGTH=200` 단독으로는 ReDoS 를 막지 못함(`(a+)+$` 등)을 명시하고, `safe-regex` 가 1차 방어이고 길이 제한이 2차 방어임을 문서화. 코드 변경 없이 주석 보완. `compileUserRegex` 는 이미 safe-regex + 길이 + 문법 순 검사를 올바르게 구현함.
- 제안: 이상 없음.

### **[INFO]** safe-html relative URL/blob: scheme 경계 테스트 추가 (safe-html.test.ts)
- 위치: `codebase/channel-web-chat/src/lib/safe-html.test.ts` — `relative href·anchor 유지`, `blob: scheme href 제거` 테스트
- 상세: 상대 경로 URL(`/path`, `#anchor`)은 허용, `blob:` scheme 은 제거됨을 테스트로 문서화. 허용 scheme 화이트리스트(`http`/`https`/`mailto`) 경계가 명확히 검증됨.
- 제안: 이상 없음.

### **[WARNING]** `public-webhook-throttle.guard.ts` 의 `extractClientIp` 타입 캐스트 (unsafe type assertion)
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` — `headers as Record<string, string | string[] | undefined>`
- 상세: `headers` 의 실제 타입은 `Record<string, unknown>` 이다. `unknown` 타입 헤더 값에 숫자, 객체, 배열 등이 포함될 수 있는데, `extractClientIpFromHeaders` 내부의 `pickFirst` 가 `typeof v === 'string'` 을 검사하므로 현재는 안전하게 처리된다. 그러나 타입 캐스트 자체는 TypeScript 보호를 우회하므로, 향후 `extractClientIpFromHeaders` 의 내부 구현이 바뀌면 런타임 오류로 이어질 수 있다.
- 제안: `extractClientIpFromHeaders` 의 파라미터 타입을 `Record<string, unknown>` 으로 확장하거나, `req.headers` 타입을 처음부터 좁게 선언하는 것이 더 안전하다. 현재 런타임에서는 `pickFirst` 가 보호하나 타입 레벨에서도 명확히 하는 것을 권장한다.

### **[INFO]** audit-action.const.ts — 미구현 보안 관련 액션 주석 갱신
- 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` — 주석 Planned 액션 목록
- 상세: `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 등 인증 이벤트가 아직 감사 로그에 미기록임을 주석에서 명시. 이 이벤트들이 감사되지 않으면 계정 탈취·2FA 우회 시도를 사후 탐지하기 어렵다.
- 제안: 정보성 메모임. 구현 로드맵에 따라 해당 액션을 우선 추가하고 실제 서비스 이벤트에 연결하는 것을 권고한다(특히 `user.password_changed`, `user.2fa_disabled`).

---

## 요약

이번 변경은 전반적으로 기존 보안 강화(04 시리즈) 조치의 후속 정비(sane defaults 통일, 사본 제거, 테스트 추가)에 해당한다. CF-Connecting-IP/XFF IP 추출 로직의 사본 통합은 rate-limit·ip_whitelist 경로의 동작 불일치 가능성을 제거하는 긍정적 변경이다. refresh 쿠키의 set/clear domain 패리티 테스트, notifications 채널 userId 미설정 fail-closed 테스트, null Origin CSRF 테스트 모두 기존 방어 코드를 회귀 테스트로 고정하는 올바른 접근이다. `websocket.module.ts` 의 JWT fallback sentinel 변경은 `assertProductionConfig` 의 금지 목록과 연동이 핵심이므로, 해당 guard 에 `'dev-jwt-secret'` 이 실제로 포함되어 있는지 확인이 필요하다. `public-webhook-throttle.guard.ts` 의 unsafe 타입 캐스트는 현재 런타임에서는 `pickFirst` 가 보호하므로 실제 위협은 아니지만 향후 drift 위험이 있어 개선 권고 수준이다. 신규 취약점 도입은 없음.

## 위험도

LOW
