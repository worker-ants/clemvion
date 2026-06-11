# Code Review 통합 보고서

## 전체 위험도
**LOW** — production fail-closed 가드 테스트 강화 및 문서 보완 변경으로, Critical 발견사항 없음. 단일 WARNING(security)과 중복 INFO 다수 존재.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `INTEGRATION_ENCRYPTION_KEY` 가 `assertProductionConfig` 블랙리스트에서 미검증. `.env.example` 에 "REQUIRED for production. Without it, credentials are stored in plaintext" 라고 명시되어 있으나 부팅 거부 조건에 포함되지 않아, 기본값인 채 배포 시 Integration OAuth 크레덴셜이 평문 저장됨 | `codebase/backend/src/common/config/production-guards.ts` (기존 로직, 이번 diff 외) | `KNOWN_EXAMPLE_INTEGRATION_ENCRYPTION_KEYS` Set 추가 및 `assertProductionConfig` 에 검사 블록 추가. 이번 PR 범위 외이므로 별도 이슈로 추적 권장 |
| 2 | Side Effect / Testing | `production-guards.spec.ts` 의 `describe` 최상위 스코프에서 `fs.readFileSync` 를 동기 실행. `.env.example` 미존재 또는 경로 불일치 시 Jest 수집 단계에서 `ENOENT` throw 되어 파일 전체 테스트 스위트가 로드 불가 상태가 됨 | `codebase/backend/src/common/config/production-guards.spec.ts` 라인 209-210 | `beforeAll` 훅 안으로 이동하거나 `try/catch` + `test.skip` 으로 graceful 처리 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `README.md` 배포 주의 블록이 `OAUTH_STUB_MODE=true` · `LLM_STUB_MODE=true` 부팅 거부 조건을 누락해 실제 가드 동작과 불일치 | `codebase/backend/README.md` line 36 | 주의 블록에 stub 모드 플래그 조건 추가 |
| 2 | Requirement | `README.md` 배포 주의사항에 `JWT_SECRET` 32자 미만 거부 조건 미기재 (spec `spec/5-system/1-auth.md` §Rationale 명시 조건) | `codebase/backend/README.md` line 36 | "또는 JWT_SECRET 가 32자 미만이면" 조건 추가 |
| 3 | Testing | `jwtConfig()` 직접 호출이 `registerAs` 래퍼 내부 구현에 암묵 의존. 현재 NestJS 에서는 동작하나 향후 버전 업그레이드 시 계약 변경 위험 | `codebase/backend/src/common/config/production-guards.spec.ts` 라인 455 | 주석에 "registerAs 내부 구현 의존" 명시 또는 fallback 값 하드코딩 상수로 직접 참조하는 방식으로 단순화 고려 |
| 4 | Testing | `.env.example` 경로가 `__dirname` 기준 상대 경로(`'../../../.env.example'`)에 의존. 빌드 결과물 경로와 깊이 불일치 시 실패 가능 (Jest 환경에서는 무해) | `codebase/backend/src/common/config/production-guards.spec.ts` 라인 209 | repo 루트 기준 `path.resolve(process.cwd(), 'codebase/backend/.env.example')` 로 교체하거나 경로 의존성 주석 명시 |
| 5 | Testing | `parseEnvExampleValue` 정규식(`^${key}=(.+)$`)이 인라인 `#` 주석 포함 행을 처리 안 함. 현재 `.env.example` 엔 인라인 주석이 없으므로 실질 위험 없으나 헬퍼 재사용 시 오동작 가능 | `codebase/backend/src/common/config/production-guards.spec.ts` 라인 205 | 내부 사용 전용이므로 현행 허용 가능. 필요 시 key escape + 인라인 주석 처리 추가 |
| 6 | Documentation | `jwt.config.ts` 에 dev fallback(`'dev-jwt-secret'`) 이 `INSECURE_JWT_SECRETS` 와 동기화 의무가 있다는 주석 없음 | `codebase/backend/src/common/config/jwt.config.ts` | 파일 상단 또는 함수에 "dev fallback 은 production-guards.ts INSECURE_JWT_SECRETS 와 동기화 필수" 주석 추가 |
| 7 | Requirement | `production-guards.spec.ts` 라인 221-222 의 `jwtConfig()` 관련 테스트 주석이 "registerAs 래퍼가 개입하므로" 라고 서술하나, `registerAs` 는 팩토리 함수 자체를 반환하므로 설명 오류 | `codebase/backend/src/common/config/production-guards.spec.ts` 라인 221-222 | 주석을 "jwtConfig 는 registerAs 가 반환한 팩토리 함수 자체이므로 직접 호출 가능" 으로 수정 |
| 8 | Scope | `jwtConfig` 직접 호출로 `registerAs` 래퍼 우회 — 의도적이며 인라인 주석으로 문서화되어 있으나, `jwt.config.ts` 반환 형태 변경 시 묵시적 실패 가능 | `codebase/backend/src/common/config/production-guards.spec.ts` `blacklist Set sync` 블록 | 현행 주석 수준으로 충분. 필요 시 `jwtConfig` 반환 타입 고정 테스트 별도 추가 (본 PR 범위 밖) |
| 9 | Security | `process.env.JWT_SECRET` 임시 삭제 후 `try/finally` 복원 패턴 — 직렬 실행 환경에서 안전하나, Jest 병렬 worker 모드에서는 주의 필요 (실질 위험 낮음) | `codebase/backend/src/common/config/production-guards.spec.ts` 라인 222-231 | 현재 구현으로 충분. 병렬 worker 격리 가정을 주석에 명시 가능 |
| 10 | Maintainability | `README.md` 배포 주의 문장이 세 조건을 단일 문장에 압축해 초독 부담이 다소 있음 | `codebase/backend/README.md` diff +55 | 불릿 목록 또는 세미콜론 구분 목록으로 조건 분리 |
| 11 | Security | `MIN_JWT_SECRET_LENGTH = 32` 는 임의 32자 영문 패스프레이즈(낮은 엔트로피)도 통과시킴. `openssl rand -hex 32` (64자) 기준이면 통과. OWASP 최소 기준 충족 | `codebase/backend/src/common/config/production-guards.ts` 라인 594 | 필수 수정 아님. 강화 시 최솟값 48 이상 또는 hex 형식 검증 추가 가능 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `INTEGRATION_ENCRYPTION_KEY` 미검증 WARNING 1건; 나머지 전부 INFO |
| requirement | LOW | README 배포 주의사항 누락(JWT_SECRET 길이 조건, stub 모드) INFO 2건; 테스트 주석 오류 INFO 1건 |
| scope | NONE | 변경 범위가 커밋 메시지 기재 항목에 완전 수렴, 이슈 없음 |
| side_effect | LOW | `describe` 최상위 `fs.readFileSync` 동기 실행 WARNING 1건; 나머지 INFO |
| maintainability | NONE | README 문장 가독성 INFO 1건; 전반적으로 컨벤션 일관성 양호 |
| testing | LOW | `fs.readFileSync` describe 최상단 스코프 문제, `jwtConfig()` 래퍼 의존 등 INFO 다수; 즉각 위험 낮음 |
| documentation | LOW | README `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 조건 누락 INFO 1건; `jwt.config.ts` 동기화 주석 누락 INFO 1건 |

## 발견 없는 에이전트

- **scope**: 변경 범위 이상 없음 (NONE)
- **maintainability**: 실질 문제 없음 (NONE)

## 권장 조치사항

1. **(별도 이슈 등록 권장)** `assertProductionConfig` 에 `INTEGRATION_ENCRYPTION_KEY` 검증 추가 — `KNOWN_EXAMPLE_INTEGRATION_ENCRYPTION_KEYS` Set 도입 및 부팅 거부 조건 편입 (security WARNING)
2. **이번 PR 또는 후속 커밋** `production-guards.spec.ts` 의 `fs.readFileSync` 를 `beforeAll` 훅으로 이동해 Jest 수집 단계 충돌 방지 (side_effect/testing WARNING)
3. `README.md` 배포 주의 블록에 `OAUTH_STUB_MODE=true` · `LLM_STUB_MODE=true` · `JWT_SECRET 32자 미만` 조건 추가 (documentation/requirement INFO)
4. `production-guards.spec.ts` 라인 221-222 테스트 주석 오류 수정("registerAs 래퍼가 개입하므로" → "팩토리 함수 자체이므로 직접 호출 가능") (requirement INFO)
5. `jwt.config.ts` 에 dev fallback 과 `INSECURE_JWT_SECRETS` 동기화 의무 주석 추가 (documentation INFO)

## 라우터 결정

라우터가 선별 실행:

- **실행 (forced by router_safety)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명 전원 강제 포함)
- **제외**: 아래 표 (7명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 제외 |
| architecture | 라우터 제외 |
| dependency | 라우터 제외 |
| database | 라우터 제외 |
| concurrency | 라우터 제외 |
| api_contract | 라우터 제외 |
| user_guide_sync | 라우터 제외 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (전원)