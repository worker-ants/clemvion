# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — `LLM_STUB_MODE` 프로덕션 fail-closed 가드 부재가 핵심 위험. Critical 없음, Warning 9건(중복 제거 후).

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| W1 | 부작용 / 유지보수성 / 테스트 / 의존성 | `LLM_STUB_MODE=true` 에 `NODE_ENV=production` fail-closed 가드 없음. `OAUTH_STUB_MODE`는 `main.ts` 부트스트랩에 프로세스 종료 가드가 있으나 `LLM_STUB_MODE`는 해당 가드가 없어 운영 환경에서 실수로 설정 시 모든 LLM 응답이 stub echo로 대체됨 | `llm.service.ts` L81, `main.ts` | `main.ts`에 `OAUTH_STUB_MODE`와 동일한 패턴으로 가드 추가: `if (process.env.NODE_ENV === 'production' && process.env.LLM_STUB_MODE === 'true') throw new Error(...)` |
| W2 | 테스트 | `StubLlmClient` 단위 테스트(`stub.client.spec.ts`) 부재. 빈 메시지 배열, 200자 초과 슬라이싱, `embed([])`, 고정 반환값 등 경계값 미검증 | `src/modules/llm/clients/stub.client.ts` (신규) | `stub.client.spec.ts` 추가하여 주요 경계값 커버 |
| W3 | 테스트 | `llm.service.spec.ts`에 `LLM_STUB_MODE` 분기 테스트 0건. `OAUTH_STUB_MODE`는 `auth-oauth.service.spec.ts`에서 분기 명시 검증하나, `LLM_STUB_MODE`는 (a) stub 반환 여부, (b) 정상 provider 경로, (c) stub 캐시 일관성 모두 미검증 | `src/modules/llm/llm.service.spec.ts` | `describe('LLM_STUB_MODE')` 블록 추가, `process.env.LLM_STUB_MODE` 설정/복원 패턴으로 세 케이스 커버 |
| W4 | 유지보수성 | `process.env.LLM_STUB_MODE` 직접 참조 — NestJS `ConfigService` DI 패턴과 불일치. 단위 테스트에서 env 직접 조작이 필요해 격리가 어렵고, 타입 안전성 우회 | `llm.service.ts` L265 | `ConfigService.get<string>('LLM_STUB_MODE')` 로 교체하거나 생성자에서 `isStubMode` 한 번만 평가 |
| W5 | 유지보수성 | `createClient` 내 stub 분기가 캐시 체크 이후에 위치해 "factory + cache"와 "stub injection" 두 책임이 혼재. 단위 테스트에서 env mid-test 변경 시 캐시 오염 위험 | `llm.service.ts` L265–269 | stub 분기를 캐시 체크 이전으로 이동하거나 `resolveClient`/`getCached` 로 단계 분리 |
| W6 | 유지보수성 | `createWorkflow`, `saveCanvas`, `poll`, `authHeader` 4개 함수가 PR-B1/PR-B2a 두 `describe` 블록에 중복 정의. 전체 파일 1663라인으로 탐색 비용 높음 | `execution-park-resume.e2e-spec.ts` L709–754 vs L1119–1164 | 공통 헬퍼를 파일 상단 모듈 레벨 또는 `helpers/` 파일로 추출 |
| W7 | 유지보수성 | 단일 `it` 블록 약 215라인 — LLM config insert부터 end_conversation까지 8단계를 하나의 블록에서 순차 실행. 실패 단계 진단 어려움 | `execution-park-resume.e2e-spec.ts` L820–1034 (PR-B2a `it`) | 8단계를 별도 `it` 또는 중첩 `describe`로 분리해 Jest 보고에서 실패 단계 식별 |
| W8 | 유지보수성 | `JWT_SECRET` 리터럴(`clemvion-e2e-jwt-secret-do-not-use-in-prod-x9y8z7`)이 `docker-compose.e2e.yml`과 테스트 파일 두 곳에 중복. 동기화 실패 시 인증 실패 원인 추적 어려움 | `execution-park-resume.e2e-spec.ts` L679, `docker-compose.e2e.yml` L1827 | `test/helpers/`에 `E2E_JWT_SECRET` 상수를 export하는 모듈로 단일화하거나 compose 파일을 SoT로 주석 명시 |
| W9 | 의존성 | `jsonwebtoken`이 `package.json`에 직접 선언되지 않고 `@nestjs/jwt`의 전이 의존성으로만 존재. `@nestjs/jwt` 버전 업 시 암묵적 파손 위험 | `codebase/backend/package.json`, `execution-park-resume.e2e-spec.ts` L3 | `devDependencies`에 `"jsonwebtoken": "9.0.3"` 및 `"@types/jsonwebtoken": "^9.0.0"` 명시 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| I1 | 보안 | e2e 테스트가 JWT를 직접 mint — 서버측 토큰 검증이 발급 기록(DB/Redis)과 대조하지 않으면 동일 `JWT_SECRET`을 아는 공격자가 임의 executionId로 interaction 토큰 위조 가능 | `execution-park-resume.e2e-spec.ts` `mintInteractionToken()` | `InteractionTokenService` 검증 로직에서 `jti` 기반 단회성 또는 revoke 메커니즘 확인 |
| I2 | 보안 | `docker-compose.e2e.yml`에 낮은 엔트로피 `ENCRYPTION_KEY`(`0123456789abcdef...`) 및 다수 평문 시크릿 하드코딩 (e2e 격리 전용, 의도적) | `docker-compose.e2e.yml` L1730–1831 | CI 시크릿 스캐너(gitleaks 등) 예외 목록에 명시적으로 관리 |
| I3 | 보안 | `LLM_STUB_MODE` env 검사가 `=== 'true'` 문자열 비교만 — `'True'`, `'1'` 등은 stub 비활성화 | `llm.service.ts` L265 | `?.toLowerCase() === 'true'` 정규화 또는 헬퍼 함수 사용 (낮은 우선순위) |
| I4 | 부작용 | stub 사용 시에도 `usageLogService.record` 호출되어 e2e DB에 stub usage row 기록. usage log 검증 테스트가 추가되면 충돌 가능 | `llm.service.ts` L140 | 현재 e2e가 usage log 미검증이므로 허용. 필요 시 stub 경로에서 usage 기록 건너뛰기 고려 |
| I5 | 부작용 | `StubLlmClient.embed`가 3차원 고정 zero 벡터 반환. embedding e2e 추가 시 실제 provider 차원(1536 등)과 불일치로 downstream 오동작 | `stub.client.ts` L73 | 주석에 "embedding e2e 추가 시 차원 수 조정 필요" 명시 |
| I6 | 테스트 | `waitForUserTurn` 후 assistant turn 기록 + re-park 완료를 원자적으로 대기하지 않아 이론적 race window 존재 (stub 즉시 반환으로 실제 실패율 낮음) | `execution-park-resume.e2e-spec.ts` L507–514 | `waitForAssistantTurn` 헬퍼 추가해 re-park poll 전 assistant echo 기록 확인 |
| I7 | 요구사항 | `LLM_STUB_MODE` 캐시 키 — 동일 `config.id`로 실 클라이언트가 이미 캐시된 경우 `LLM_STUB_MODE=true`여도 stub 대신 실 클라이언트 반환 (e2e/운영에서는 미발현, 단위 테스트 env mid-test 변경 시 가능) | `llm.service.ts` L72–84 | `LLM_STUB_MODE` 확인을 캐시 체크 이전으로 이동하거나 주석에 전제 명시 |
| I8 | 유지보수성 | 매직 넘버 — `slice(0, 200)`, `[0, 0, 0]`, `inputTokens: 1`, `maxRetries = 3`, `MAX_BACKOFF_MS = 60_000` 인라인 상수 | `stub.client.ts` L61/73/65, `llm.service.ts` L507/526 | 파일 상단 named constant로 추출 |
| I9 | 유지보수성 | `TERMINAL_STATUSES.includes(s as never)` 캐스팅 패턴이 6회 이상 반복 | `execution-park-resume.e2e-spec.ts` L888/926/969 등 | `const isTerminal = (s: string): boolean => ...` 헬퍼 함수로 추출 |
| I10 | 유지보수성 | `readThread` 반환 타입 인라인 정의가 B1/B2a 양쪽에 4회 중복 | `execution-park-resume.e2e-spec.ts` L757–772 | 파일 상단에 `interface ConversationThread` 정의 후 참조 |
| I11 | 의존성 | `StubLlmClient`는 외부 의존성 없는 순수 TypeScript 구현체 — 번들/빌드 영향 없음 | `stub.client.ts` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | JWT 직접 mint 패턴(운영 코드 토큰 검증 강도 확인 필요), e2e 전용 시크릿 하드코딩(의도적) |
| side_effect | LOW | `LLM_STUB_MODE` production guard 없음(W1), 나머지는 INFO 수준 |
| maintainability | LOW | e2e 헬퍼 함수 중복(W6), 215라인 단일 `it`(W7), JWT_SECRET 리터럴 중복(W8), `process.env` 직접 참조(W4) |
| testing | MEDIUM | `StubLlmClient` 단위 테스트 부재(W2), `LLM_STUB_MODE` 분기 미검증(W3), production 가드 부재로 테스트 검증 수단 없음(W1) |
| requirement | LOW | 기능 요구사항 전반 충족. 캐시 선행 체크 경계 케이스(I7), assistant turn race window(I6) |
| dependency | LOW | `jsonwebtoken` 직접 선언 누락(W9), `LLM_STUB_MODE` production 가드 부재(W1 중복) |
| scope | N/A | output_file 미생성 (재시도 필요) |

## 발견 없는 에이전트

없음 (모든 실행 에이전트가 1건 이상 발견사항 보고).

## 권장 조치사항

1. **(즉시)** `main.ts`에 `LLM_STUB_MODE=true && NODE_ENV=production` 조합 fail-closed 가드 추가 — `OAUTH_STUB_MODE`와 동일 패턴 적용 (W1)
2. **(즉시)** `llm.service.spec.ts`에 `LLM_STUB_MODE` 분기 단위 테스트 추가 — stub 반환, 정상 경로, 캐시 일관성 3케이스 (W3)
3. **(단기)** `stub.client.spec.ts` 신설 — 빈 메시지, 슬라이싱, embed, 고정값 검증 (W2)
4. **(단기)** `codebase/backend/package.json` `devDependencies`에 `jsonwebtoken` 직접 선언 추가 (W9)
5. **(단기)** `process.env.LLM_STUB_MODE` 직접 참조를 `ConfigService` 또는 생성자 시점 1회 평가로 교체 (W4)
6. **(중기)** e2e 헬퍼 함수(`createWorkflow`, `saveCanvas`, `poll`, `authHeader`) 공통 모듈로 추출해 B1/B2a 중복 제거 (W6)
7. **(중기)** PR-B2a 215라인 단일 `it`을 단계별 `it`/중첩 `describe`로 분리 (W7)
8. **(중기)** `JWT_SECRET` 리터럴 단일화 — `test/helpers/`에 상수 export 또는 SoT 주석 명시 (W8)
9. **(낮은 우선순위)** `waitForAssistantTurn` 헬퍼 추가해 re-park 전 assistant echo 확인 (I6)
10. **(낮은 우선순위)** 매직 넘버(`ECHO_MAX_CHARS`, `EMBEDDING_DIMS` 등) named constant 추출 (I8)

## 라우터 결정

router_safety에 의해 전체 reviewer 강제 실행됨.

- **실행(ran)**: security, scope, side_effect, maintainability, testing, requirement, dependency (7명)
- **강제 포함(router_safety)**: dependency, maintainability, requirement, scope, security, side_effect, testing (전체)
- **제외(skipped)**: security_dummy_keep_order

| 제외된 reviewer | 이유 |
|------------------|------|
| security_dummy_keep_order | 라우터 순서 보장용 더미 — 실제 reviewer 아님 |

> **참고**: `scope.md` output_file이 존재하지 않아 scope 리뷰 결과를 통합하지 못했습니다 (재시도 필요 1건).