# Code Review 통합 보고서

## 전체 위험도
**LOW** — 보안 강화(04 시리즈) 후속 정비로, 신규 취약점 없음. WARNING 3건은 모두 런타임 버그 없이 개선 권고 수준이며, 기능 동작에 영향을 주지 않는다.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Type Safety | `public-webhook-throttle.guard.ts` 의 `extractClientIpFromHeaders` 호출 시 `headers as Record<string, string \| string[] \| undefined>` 강제 캐스트. 실제 타입은 `Record<string, unknown>` 이므로 TypeScript 보호를 우회하며, 향후 `pickFirst` 내부 구현 변경 시 런타임 오류 가능. 현재는 `pickFirst` 의 `typeof v === 'string'` 검사가 보호. | `codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` | `extractClientIpFromHeaders` 파라미터 타입을 `Record<string, unknown>` 으로 확장하고 내부 narrowing 을 강화하여 캐스트 제거 |
| 2 | Testing / Side Effect | `client-ip.spec.ts` 의 describe 선언 시점(모듈 로드 시 동기 실행) env 스냅샷 패턴 — `const orig = process.env.TRUST_CF_CONNECTING_IP` 가 describe 콜백 선언 시점에 평가됨. 다른 테스트 파일이 해당 env 를 설정한 채로 복원하지 않고 이 파일이 실행되면 오염된 기준값으로 복원될 수 있음. 현재 파일 단독 실행 환경에서는 실질 위험 낮음. | `codebase/backend/src/modules/auth/utils/client-ip.spec.ts` | `beforeEach`/`beforeAll` 내에서 스냅샷 취득 또는 `jest.isolateModules` 로 격리 보장 |
| 3 | Documentation | `cookieDomain` 옵션(refresh 쿠키 domain set/clear)에 대응하는 환경변수(예: `COOKIE_DOMAIN`)가 운영 문서(spec 또는 README)에 기재되어 있는지 확인 필요. 호출 측(auth.controller.ts 등)에서 env 를 주입한다면 해당 변수의 기본값·목적·예시가 문서화되어야 함. | `codebase/backend/src/modules/auth/utils/refresh-cookie.ts` (setRefreshTokenCookie / clearRefreshTokenCookie) | `COOKIE_DOMAIN` 등 관련 환경변수를 `spec/` 또는 운영 가이드에 기본값·목적·예시와 함께 명시 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | JWT fallback sentinel `'fallback'` → `'dev-jwt-secret'` 변경. `assertProductionConfig` 의 `INSECURE_JWT_SECRETS` 목록에 포함된 값으로 통일 필요. 해당 sentinel 이 목록에 없다면 production 부팅 가드를 통과할 수 있음. | `codebase/backend/src/modules/websocket/websocket.module.ts` | `assertProductionConfig` 에서 `INSECURE_JWT_SECRETS` 에 `'dev-jwt-secret'` 이 포함되어 있는지 확인·문서화 |
| 2 | Security | E2E/통합 테스트에서 기존 `'fallback'` secret 으로 서명된 JWT fixture/seed 가 있으면 fallback sentinel 변경으로 `invalid signature` 가 발생할 수 있음. | E2E / 통합 테스트 JWT fixture | E2E/통합 테스트의 JWT fixture 를 `'dev-jwt-secret'` 기준으로 검토·갱신 |
| 3 | Security | `audit-action.const.ts` 의 `user.password_changed`, `user.2fa_disabled` 등 인증 이벤트가 아직 감사 로그에 미기록. 계정 탈취·2FA 우회 시도의 사후 탐지 어려움. | `codebase/backend/src/modules/audit-logs/audit-action.const.ts` | 구현 로드맵에 따라 해당 감사 액션 우선 추가 권고 |
| 4 | Maintainability | `hooks.service.ts` / `public-webhook-throttle.guard.ts` 에 로컬 `extractClientIp` 래퍼 함수가 잔존하여 단일화가 절반만 달성됨. 미래 변경 시 세 곳을 동기화해야 함. | `codebase/backend/src/modules/hooks/hooks.service.ts`, `public-webhook-throttle.guard.ts` | 래퍼 제거 후 호출부에서 `extractClientIpFromHeaders` 직접 사용, 또는 공용 util 로 승격 |
| 5 | Maintainability | `auth.controller.spec.ts` 에서 env 저장·삭제·복원(`prev`/`prevFe`) 패턴이 세 테스트 케이스에서 반복됨. | `codebase/backend/src/modules/auth/auth.controller.spec.ts` | `beforeEach`/`afterEach` env 일괄 처리 또는 `withEnv(overrides, fn)` 헬퍼 추출 |
| 6 | Maintainability | `websocket.gateway.spec.ts` 에서 소켓 타입 단언 `socket as Socket & { workspaceId?: string; userId?: string }` 패턴이 반복됨. `handleRetryLastTurn` 블록에는 `authedSocket()` 헬퍼가 있어 불일관성 존재. | `codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` | `createMockSocket` 헬퍼에 `workspaceId`/`userId` overrides 지원 추가 또는 `authedSocket()` 헬퍼 재사용 |
| 7 | Maintainability | `websocket.module.ts` 에 JWT 만료 시간 `900` (15분)이 상수 이름 없이 하드코딩됨. | `codebase/backend/src/modules/websocket/websocket.module.ts` | `const JWT_ACCESS_EXPIRY_SECONDS = 15 * 60` 으로 추출 또는 configService 를 통해 관리 |
| 8 | Maintainability | `auth.controller.spec.ts` 전반의 `as never` 타입 캐스트 관례는 의도가 불명확함. `as unknown as Request` 가 더 표현적. 신규 테스트도 동일 패턴 사용. | `codebase/backend/src/modules/auth/auth.controller.spec.ts` | 별도 정리 작업으로 `as unknown as Request` 로 일괄 교체 권고 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | unsafe 타입 캐스트 1건(WARNING), JWT fallback sentinel 확인 필요(INFO) |
| side_effect | LOW | JWT fallback sentinel 변경으로 E2E fixture 검증 오류 가능(WARNING), describe 선언 시점 env 스냅샷 패턴(WARNING) |
| maintainability | LOW | 로컬 래퍼 잔존으로 단일화 미완(INFO), env 저장 패턴 반복(INFO) |
| requirement | NONE | 모든 변경이 관련 spec 과 line-level 일치, TODO/FIXME 없음 |
| scope | NONE | 12개 파일 모두 "04 후속" 레이블 범위 내, 무관한 수정 없음 |
| testing | (출력 파일 없음 — 재시도 필요) | — |
| documentation | LOW | `COOKIE_DOMAIN` 환경변수 운영 문서 확인 필요(WARNING), 전반적 JSDoc 품질 양호 |

## 발견 없는 에이전트

- **requirement**: spec §2.1, §2.3, §4.1, §4.4 및 spec/7-channel-web-chat/4-security.md 와 전 파일 일치 확인, 결함 없음
- **scope**: 12개 파일 전체 "04 후속" 범위 내, 불필요한 수정 없음

## 권장 조치사항

1. **[우선]** `extractClientIpFromHeaders` 파라미터 타입을 `Record<string, unknown>` 으로 확장하여 `public-webhook-throttle.guard.ts` 의 강제 캐스트 제거 — 타입 안전성 향상
2. **[우선]** `assertProductionConfig` 의 `INSECURE_JWT_SECRETS` 배열에 `'dev-jwt-secret'` 이 포함되어 있는지 확인하고, 없으면 추가
3. E2E/통합 테스트의 JWT fixture/seed 가 `'fallback'` 서명 기준이면 `'dev-jwt-secret'` 으로 갱신
4. `client-ip.spec.ts` env 스냅샷을 `beforeEach`/`beforeAll` 내부로 이동하여 병렬 실행 안전성 확보
5. `COOKIE_DOMAIN` 관련 환경변수가 실제로 사용된다면 spec 또는 운영 가이드에 목적·기본값·예시 추가
6. (중장기) `hooks.service.ts` / `public-webhook-throttle.guard.ts` 의 로컬 `extractClientIp` 래퍼 제거 후 `extractClientIpFromHeaders` 직접 호출로 단일화 완성
7. (중장기) `audit-action.const.ts` 계획된 감사 액션(`user.password_changed`, `user.2fa_disabled` 등) 구현 착수
8. (중장기) `auth.controller.spec.ts` env 처리를 `withEnv` 헬퍼로 통합, `as never` → `as unknown as Request` 일괄 교체

## 라우터 결정

라우터가 reviewer 를 선별했으나 `documentation` 을 제외하고 모든 reviewer 를 강제 포함(router_safety)하여 실행했습니다.

- **실행**: security, side_effect, maintainability, requirement, scope, testing, documentation (7명)
- **제외**: 없음
- **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing

재시도 필요: `testing` reviewer 출력 파일이 존재하지 않음 (1건)