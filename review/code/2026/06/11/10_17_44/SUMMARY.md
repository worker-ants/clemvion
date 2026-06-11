# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 핵심 fail-closed 구현 자체는 견고하나, JWT_SECRET 최소 길이 미검증(spec 요구사항과 가드 구현 간 괴리) 및 `auth.module.ts` dead code 미제거로 MEDIUM 판정. 나머지 발견사항은 WARNING/INFO 수준.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Requirement | `JWT_SECRET` 최소 길이 미검증 — `.env.example` 이 `>= 32 bytes` 를 명시하나 `assertProductionConfig` 는 empty/blocklist 만 검사. `JWT_SECRET=abc` 같은 짧은 값도 부팅 통과. CWE-521 범주. | `production-guards.ts` L76–82, `.env.example` L87 | `jwtSecret.length < 32` 조건 추가, 또는 의도적 결정임을 spec 문서에 명시 |
| 2 | Requirement | `auth.module.ts` 의 `?? 'fallback'` dead code 미제거 — plan `security-jwt-secret-fallback.md` SUPERSEDED 로 처리됐으나 해당 체크리스트 항목이 완료되지 않아 독자가 이미 완료됐다고 오해할 수 있음 | `codebase/backend/src/modules/auth/auth.module.ts` L35 | SUPERSEDED 노트에 "dead code 미완료" 명시 또는 이 PR 에서 제거 |
| 3 | Security | `ALLOW_PRIVATE_HOST_TARGETS=true` warn-only 정책 — 멀티테넌트 환경에서 워크플로 편집자가 내부망을 HTTP Request 노드 대상으로 지정 가능. warn 이 `logger.warn` 으로만 남아 모니터링 미구성 시 실질적 무시 가능 | `main.ts` L986–993 | warn 메시지에 `[SECURITY]` 태그 추가; spec `http-request §4` 에 "이 플래그 활성화 시 egress 방화벽/IP allowlist 필수" 명시 |
| 4 | Maintainability / Requirement | `main.ts` 의 `ALLOW_PRIVATE_HOST_TARGETS` warn 체크가 `isFlagOn` 헬퍼 대신 `=== 'true'` 리터럴 비교 — `ALLOW_PRIVATE_HOST_TARGETS=1` 설정 운영자는 경고 로그를 수신하지 못함 | `main.ts` L988 | `isFlagOn` 을 export 해 `main.ts` 에서 재사용, 또는 `\|\| === '1'` OR 조건 추가 |
| 5 | Testing | `main.ts` `ALLOW_PRIVATE_HOST_TARGETS` warn 분기 테스트 부재 — 메시지 내용 변경 시 자동 탐지 불가 | `main.ts` L986–993 | `warnProductionConfig` 유틸 함수로 추출 후 단위 테스트 추가 |
| 6 | Testing | fail-fast 단일 throw 순서 계약 미검증 — 복수 위반 시 첫 번째 위반 메시지만 throw 되는 우선순위 계약을 고정하는 테스트 없음. 검사 순서 변경 시 자동 탐지 불가 | `production-guards.ts` L60–63, `production-guards.spec.ts` 전체 | `assertProductionConfig(prodEnv({ OAUTH_STUB_MODE: 'true', JWT_SECRET: '' }))` → `toThrow(/OAUTH_STUB_MODE/)` 테스트 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `isFlagOn` 파싱 규칙(`'true'`/`'1'` 만 ON) — 실제 동작 코드들과 파싱 규칙 일치 여부 교차 확인 권고 | `production-guards.ts` L695–697 | `OAUTH_STUB_MODE`, `LLM_STUB_MODE`, `MCP_ALLOW_INSECURE_URL` 실제 사용처에서 동일 파싱 규칙 확인 |
| 2 | Security | `JWT_SECRET` 길이 검증 미포함 — `JWT_SECRET=x` 같은 극도로 짧은 값도 가드 통과. NIST SP 800-107 권고 위배 가능 | `production-guards.ts` L726 | 최소 `jwtSecret.length >= 32` 조건 추가; `.env.example` 에 "32자 이상 무작위" 명시 |
| 3 | Security | `ENCRYPTION_KEY` 형식 검증 미포함 — 64자 hex 패턴 외 임의 평문도 부팅 통과. 기능상 SHA-256 파생으로 동작하나 낮은 엔트로피 키 오설정 허용 | `production-guards.ts` L737 | 선택적으로 `/^[0-9a-fA-F]{64}$/` 정규식 warn 추가 |
| 4 | Security | Swagger 문서 프로덕션 노출 — `SwaggerModule.setup` 이 `NODE_ENV` 무관하게 항상 활성화 | `main.ts` L1020–1087 | `NODE_ENV=production` 시 비활성화 또는 인증 미들웨어로 접근 제한 |
| 5 | Security | 테스트 파일의 `VALID_ENC` 상수가 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 에 미포함 — 해당 값이 실제 배포에 복사될 경우 가드 통과 | `production-guards.spec.ts` L394 | Set 에 추가하거나 "테스트 전용, 운영 사용 금지" 주석 명시 |
| 6 | Architecture | `INTERACTION_JWT_SECRET` fail-closed 가 `InteractionTokenService` 생성자에 분산 — 동일 정책이 두 위치에 존재해 암묵적 결합 | `interaction-token.service.ts`, `production-guards.ts` 모듈 JSDoc | 향후 가드 확장 시 `assertProductionConfig` 통합 재검토; 현재는 JSDoc 에 분리 이유 한 줄 명시 권장 |
| 7 | Architecture | warn-only 가드 복수화 시 `main.ts` 정책 판단 코드 누적 우려 | `main.ts` warn 블록 | warn-only 가드가 복수화될 때 `warnProductionConfig(env, logger)` 를 `production-guards.ts` 에 추가 검토 |
| 8 | Architecture | `assertProductionConfig` fail-fast 단일 throw — 복수 위반 시 반복 재부팅 필요. 현재 5개 항목에서는 적합 | `production-guards.ts` L711 | 항목 증가 시 모든 위반 일괄 throw 방식 전환 검토 |
| 9 | Maintainability | `production-guards.spec.ts` "no-op outside production" 테스트가 `for` 루프 사용 — `it.each` 를 이미 사용하는 다른 케이스와 불일치, 실패 시 어느 값에서 실패했는지 식별 어려움 | `production-guards.spec.ts` L407–418 | `it.each(['development', 'test', undefined])` 패턴으로 교체 |
| 10 | Maintainability | `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 항목별 날짜 주석 하드코딩 — 항목 증가 시 관리 비용 증가 | `production-guards.ts` L686–691 | 3개 이상 시 Git 커밋 해시/PR 번호로 변경 추적성 확보 |
| 11 | Maintainability | `.env.example` `ENCRYPTION_KEY` 주석 스타일이 `JWT_SECRET` 과 혼용(`!!` 강조형 vs 서술형) | `.env.example` L196–202 | 기능 영향 없으나 일관성 정비 시 통일 권장 |
| 12 | Documentation | `production-guards.ts` 모듈 JSDoc 에 `INTERACTION_JWT_SECRET` 예외 미언급 — 미래 기여자가 이 파일에 해당 가드를 추가하려는 시도 가능 | `production-guards.ts` 모듈 JSDoc | "`INTERACTION_JWT_SECRET` fail-closed 는 `InteractionTokenService` 생성자에 별도 유지" 한 줄 추가 |
| 13 | Documentation | `spec/5-system/14-external-interaction-api.md` 괄호 중첩 가독성 저하 | `14-external-interaction-api.md` 변경 라인 | 핵심 내용을 별도 blockquote 또는 note 로 분리 |
| 14 | Documentation | `spec/5-system/7-llm-client.md` 가드 목록 인라인 열거 — 가드 확장 시 spec 동기화 부담 | `7-llm-client.md` — "프로덕션 차단" 항목 | 열거 대신 "production-guards.ts 참조(현재 목록은 예시)" 로 단순화 |
| 15 | Documentation | `plan/complete/security-jwt-secret-fallback.md` `worktree` frontmatter 가 `(unstarted)` 로 남아 있어 lifecycle 정합성 불완전 | `plan/complete/security-jwt-secret-fallback.md` frontmatter | `worktree` 필드를 `prod-fail-closed-guards` 로 갱신 |
| 16 | Requirement | `CORS`·`WEBAUTHN_ALLOW_FALLBACK` 등 기타 production 가드가 `production-guards.ts` 에 포함되지 않음 — 모듈 doc 의 "단일 응집" 의도와 부분 불일치 | `cors-origins.ts` (`assertCorsOriginsConfigured`) | `production-guards.ts` doc 에 "CORS, INTERACTION_JWT_SECRET 은 의도적으로 각 모듈에 유지" 이유 한 줄 추가 |
| 17 | Testing | `ENCRYPTION_KEY` 포맷 검증 미수행 의도 미문서화 — 짧거나 잘못된 형식의 키도 부팅 통과하는 것이 의도적 결정임을 테스트로 명시하지 않음 | `production-guards.spec.ts` | "32자 미만 키도 통과(형식 검증 담당 아님)" 명시 테스트/주석 추가 |
| 18 | Testing | `MCP_ALLOW_INSECURE_URL: undefined` 케이스 명시적 테스트 누락 — 간접 커버는 되나 의도 불명확 | `production-guards.spec.ts` L483–487 | 기존 `passes when false/unset` 테스트에 `undefined` 케이스 명시 추가 |
| 19 | Testing | `main.ts` 에서 `assertProductionConfig` 호출 위치(bootstrap 첫 단계) 통합 테스트 부재 | `main.ts` L981 | `main.spec.ts` 에 spying 테스트 추가 검토 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `ALLOW_PRIVATE_HOST_TARGETS` warn-only SSRF 표면(WARNING), JWT_SECRET 길이/ENCRYPTION_KEY 형식 미검증(INFO) |
| architecture | LOW | `INTERACTION_JWT_SECRET` 분산(INFO), warn-only 가드 복수화 시 `main.ts` 정책 누적 우려(INFO) |
| requirement | MEDIUM | JWT_SECRET 최소 길이 가드-spec 괴리(WARNING), `auth.module.ts` dead code 미제거(WARNING) |
| scope | NONE | 모든 변경이 plan 체크리스트와 정확히 일치. 범위 이탈 없음 |
| side_effect | NONE | 의도치 않은 부작용 없음. 순수 함수 설계로 전역 상태 변경 없음 |
| maintainability | LOW | `ALLOW_PRIVATE_HOST_TARGETS` warn 의 `=== 'true'` 리터럴 비교 일관성 결함(WARNING), 테스트 스타일 불일치(INFO) |
| testing | LOW | fail-fast 순서 계약 미검증(WARNING), warn 분기 테스트 부재(WARNING) |
| documentation | NONE | 전반적 문서화 품질 높음. 모두 INFO 수준 개선 제안 |

## 발견 없는 에이전트

- **scope**: 모든 변경이 plan 체크리스트 범위 내. 이탈 없음.
- **side_effect**: 의도치 않은 부작용 전무. 순수 함수 분리 설계 확인.
- **documentation**: Critical/Warning 없음. INFO 개선 제안만 존재.

## 권장 조치사항

1. **(WARNING — Requirement/Security)** `assertProductionConfig` 에 `jwtSecret.length < 32` 검사 추가 — `.env.example` 의 `>= 32 bytes` 명시와 가드 구현을 일치시킴. 또는 의도적 결정임을 spec 에 명시.
2. **(WARNING — Requirement)** `auth.module.ts:35` `?? 'fallback'` dead code 제거 또는 SUPERSEDED 노트에 "미완료" 명시 — 완료 오해 방지.
3. **(WARNING — Maintainability)** `main.ts` `ALLOW_PRIVATE_HOST_TARGETS` warn 체크를 `isFlagOn` 재사용으로 교체 (`=== 'true'` 리터럴 → `isFlagOn(...)`) — `'1'` 설정 운영자의 경고 누락 방지.
4. **(WARNING — Testing)** fail-fast 순서 계약 고정 테스트 추가 (`OAUTH_STUB_MODE + JWT_SECRET=''` 복수 위반 시 첫 번째 throw 메시지 검증).
5. **(WARNING — Security)** `ALLOW_PRIVATE_HOST_TARGETS` warn 메시지에 `[SECURITY]` 태그 추가; spec `http-request §4` 에 egress 제어 필수 조건 명시.
6. **(WARNING — Testing)** `main.ts` warn 분기를 `warnProductionConfig` 유틸로 추출해 단위 테스트 가능하게 분리.
7. **(INFO)** `production-guards.ts` 모듈 JSDoc 에 `INTERACTION_JWT_SECRET` 예외 이유 한 줄 추가 — 미래 기여자 혼선 방지.
8. **(INFO)** `production-guards.spec.ts` `for` 루프를 `it.each` 로 교체, `MCP_ALLOW_INSECURE_URL: undefined` 케이스 명시 추가.
9. **(INFO)** `plan/complete/security-jwt-secret-fallback.md` `worktree` frontmatter 를 `prod-fail-closed-guards` 로 갱신.
10. **(INFO)** Swagger 프로덕션 노출 여부 검토 — `NODE_ENV=production` 시 비활성화 또는 접근 제한.

## 라우터 결정

라우터가 선별을 수행함 (`routing_status=done`).

**실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (8명, 전원 `forced` 강제 포함)

**강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)

**제외** (6명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 성능 관련 변경 없음 — 순수 함수 추출 리팩토링 |
| dependency | 신규 외부 의존성 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 동시성 관련 변경 없음 |
| api_contract | 외부 API 계약 변경 없음 |
| user_guide_sync | 사용자 가이드 관련 변경 없음 |