# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### **[INFO]** 환경변수 저장·복원 패턴 중복 (auth.controller.spec.ts)
- 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts` 새 테스트(lines ~103-123), 기존 테스트(~241-258, ~284-302)
- 상세: `process.env.CORS_ORIGINS` 와 `process.env.FRONTEND_URL` 을 저장·삭제·복원하는 `prev`/`prevFe` 패턴이 세 테스트 케이스에서 반복된다. 신규 추가된 `null` origin 테스트는 두 env 를 모두 관리하며 `finally` 블록이 4줄이다. env 키가 늘어날수록 누락 위험이 증가한다.
- 제안: `beforeEach`/`afterEach` 에서 env 를 일괄 저장·복원하거나, `withEnv(overrides, fn)` 헬퍼를 추출하여 중복 제거.

### **[INFO]** 로컬 `extractClientIp` 래퍼 2곳 잔존 (hooks.service.ts, public-webhook-throttle.guard.ts)
- 위치: `codebase/backend/src/modules/hooks/hooks.service.ts` 하단 로컬 함수, `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L2130
- 상세: 두 파일 모두 `extractClientIp` 로컬 함수를 유지하면서 내부에서 `extractClientIpFromHeaders` 에 위임한다. "단일 구현으로 통합" 이라는 목표가 절반만 달성된 상태다. 독자가 래퍼 존재 이유를 주석에서 읽어야 한다.
- 제안: 래퍼를 제거하고 호출부에서 `extractClientIpFromHeaders` 를 직접 쓰거나, 두 래퍼의 시그니처를 통일하여 공용 util 로 올리는 방안 고려. 현재도 동작 문제는 없으나 미래 변경 시 세 곳을 동기화해야 하는 부담이 남는다.

### **[INFO]** `headers as Record<string, string | string[] | undefined>` 강제 캐스트 (public-webhook-throttle.guard.ts)
- 위치: `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` L2133-2136
- 상세: 호출부 `headers` 타입이 `Record<string, unknown>` 이므로 강제 캐스트가 필요하다. `extractClientIpFromHeaders` 내부의 `pickFirst` 가 타입 narrowing을 안전하게 처리하므로 런타임 버그는 없지만, 캐스트 자체가 거짓 타입 안전성을 준다.
- 제안: `extractClientIpFromHeaders` 파라미터 타입을 `Record<string, unknown>` 으로 완화하고 내부 narrowing을 강화하면 캐스트를 제거할 수 있다.

### **[INFO]** 테스트 소켓 타입 단언 패턴 반복 (websocket.gateway.spec.ts)
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` 신규 테스트 (~L2162-2176) 및 기존 여러 케이스
- 상세: `socket as Socket & { workspaceId?: string; userId?: string }` 로 속성을 단언 후 설정하는 패턴이 파일 전체에서 반복된다. 신규 테스트도 동일 패턴을 따른다.
- 제안: `createMockSocket` 헬퍼의 `overrides` 에 `workspaceId`/`userId` 를 직접 넘기도록 확장하거나, `authedSocket(userId, workspaceId)` 형태의 헬퍼를 `handleSubscribe` 블록에도 추가하면 반복 제거 가능. `handleRetryLastTurn` describe 에 이미 `authedSocket()` 헬퍼가 있어 불일관성도 있다.

### **[INFO]** 매직 숫자 `900` (websocket.module.ts)
- 위치: `codebase/backend/src/modules/websocket/websocket.module.ts` L3144 (`expiresIn: 900`)
- 상세: JWT 만료 시간 900초(15분)가 상수 이름 없이 하드코딩되어 있다. 이번 diff 에 포함된 변경 주변 코드이며, 기존 코드에도 있던 값이다.
- 제안: `const JWT_ACCESS_EXPIRY_SECONDS = 15 * 60;` 또는 `configService.get('jwt.accessExpirySeconds') ?? 900` 으로 추출. 현재 범위에서 필수는 아님.

### **[INFO]** `as never` 타입 캐스트 관례 (auth.controller.spec.ts)
- 위치: `codebase/backend/src/modules/auth/auth.controller.spec.ts` 전반
- 상세: `req as never`, `mockRes as never` 패턴이 기존 관례를 따른 것이라 일관성은 있으나, `never` 는 "존재 불가 값" 의미라 의도가 불명확하다. `as unknown as Request` 가 더 표현적이다. 신규 추가된 테스트도 동일 패턴이라 기존 코드와 일관성 유지.
- 제안: 별도 정리 작업으로 전체 파일을 `as unknown as Request` 로 교체 권장. 이번 변경 범위 내 필수 아님.

## 요약

이번 변경의 핵심은 `extractClientIp` 중복 구현을 `extractClientIpFromHeaders` 단일 코어로 통합하는 것으로, 중복 코드 제거라는 유지보수성 목표를 긍정적으로 달성했다. JSDoc 주석이 의도를 충분히 설명하며, 신규 상수·타입(`MAX_REGEX_LENGTH`, `RegexRejectReason`, `RegexCompileResult`)은 명명이 명확하다. 다만 두 파일에 로컬 래퍼 함수가 잔존해 "완전한 단일화" 가 이루어지지 않았고, 테스트 파일의 env 저장·복원 패턴과 소켓 타입 단언 패턴이 반복된다. 이는 기존 코드베이스 관례를 따른 것이며 기능 오류를 유발하지 않으므로 전체 위험도는 낮다.

## 위험도

LOW
