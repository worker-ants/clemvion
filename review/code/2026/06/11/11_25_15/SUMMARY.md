# Code Review 통합 보고서

리뷰 대상: `prod-fail-closed-guards` 브랜치 — production fail-closed 가드 응집 (`assertProductionConfig`) spec 반영 (refactor 04 C-1·M-4·M-7)

---

## 전체 위험도

**MEDIUM** — 핵심 보안 기능(fail-closed 가드 응집)의 구현·spec 반영 방향은 올바르나, `INTERACTION_JWT_SECRET` 가드 분리로 인한 assertProductionConfig 단일 진입점 보증 부재, `ALLOW_PRIVATE_HOST_TARGETS` warn-only 정책의 SSRF 위험, 블랙리스트 Set의 수동 동기화 강제 미적용, 그리고 spec frontmatter `code:` 글로브 누락 등 구조적 취약점이 복수 존재한다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `INTERACTION_JWT_SECRET`이 `assertProductionConfig` 밖에서 `InteractionTokenService` 생성자 throw로만 가드됨 — DI 경로 변경·lazy load 시 가드 우회 가능 | `spec/5-system/14-external-interaction-api.md §7.2`, `production-guards.ts` 주석 | `assertProductionConfig` 내에도 `INTERACTION_JWT_SECRET` 존재·길이 이중 검증 추가 또는 파일 헤더에 "이 파일만으로 production 가드 전체가 아님" 명시 |
| 2 | 보안 | `ALLOW_PRIVATE_HOST_TARGETS=true`가 production에서 warn-only — SSRF(loopback·RFC1918·AWS IMDSv1 169.254.169.254) 실제 가능, 플래그 1차 출처(`1-http-request.md §4`)에 이 정책 미기술 | `spec/5-system/11-mcp-client.md §3.2`, `main.ts:52-65` | production에서 throw로 격상하거나, `spec/4-nodes/4-integration/1-http-request.md §4`에 "warn-only, SSRF 위험 인지 필요" 명시; 최소한 매 요청 warn으로 강화 |
| 3 | 아키텍처 | `INSECURE_JWT_SECRETS`/`KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set의 `.env.example` 동기화 의무가 구조적으로 강제되지 않음 — placeholder 변경 시 CI에서 미탐지 | `production-guards.ts:32-48` | `production-guards.spec.ts`에 `.env.example` 실제 파싱 후 Set 교차검증 테스트 추가; `jwt.config.ts` dev fallback도 동일하게 검증 |
| 4 | 아키텍처 | warn 정책이 `main.ts`에 분산돼 `production-guards.ts`의 "throw 전용" 단일 책임이 불완전 — warn 규칙 증가 시 `main.ts`가 보안 정책 코드로 오염 | `main.ts:52-65`, `production-guards.ts` | `getProductionWarnings(env)` 분리 함수를 `production-guards.ts`에 추가해 warn 정책도 단일 파일에서 선언적으로 관리, `main.ts`는 결과를 소비만 |
| 5 | 문서화 | `spec/5-system/3-error-handling.md` `TOKEN_INVALID` 설명에서 reuse 탐지(`is_revoked=true`) 케이스 누락 — 클라이언트가 refresh reuse 탐지 응답 코드를 에러 코드 SoT에서 확인 불가 | `spec/5-system/3-error-handling.md §1.2` | `TOKEN_INVALID` 설명을 "변조/형식 오류 또는 reuse 탐지(is_revoked 토큰 재사용)" 수준으로 복원, 또는 `data-flow/2-auth.md §1.4` 교차 참조 링크 추가 |
| 6 | User Guide Sync | `production-guards.ts` 신규 구현 파일이 `spec/5-system/1-auth.md`, `7-llm-client.md`, `11-mcp-client.md` frontmatter `code:` 글로브에 미포함 — `spec-code-paths.test.ts` 갭 발생 가능 | `spec/5-system/1-auth.md` frontmatter | `spec/5-system/1-auth.md` frontmatter `code:`에 `codebase/backend/src/common/config/production-guards.ts` 또는 `codebase/backend/src/common/config/*.ts` 글로브 추가 |
| 7 | User Guide Sync | `.env.example` + `main.ts` 부팅 가드 변경 시 `README.md` 미갱신 — production 배포자가 placeholder 키로 부팅 거부되는 사실을 인지 불가 | `codebase/backend/.env.example`, `codebase/backend/src/main.ts` | `README.md` 환경 변수/배포 주의사항 섹션에 "production에서 `JWT_SECRET`/`ENCRYPTION_KEY`/`MCP_ALLOW_INSECURE_URL` 기본값 사용 시 부팅 거부(`assertProductionConfig`)" 1줄 추가 |
| 8 | 유지보수성 | `7-llm-client.md §7.1` 프로덕션 차단 설명 단일 문장 200자 초과 — 주어·술어·수식·대상이 중첩 parenthetical로 뒤섞여 가독성 저하 | `spec/5-system/7-llm-client.md §7.1` | 핵심 문장과 부연(가드 위치, 관할 env 목록)을 분리하거나 불릿 목록으로 재구성 |
| 9 | 유지보수성 | `14-external-interaction-api.md` `iext_*` bullet에 주제 4가지(서명 방식·fallback 순서·production fail-closed·assertProductionConfig 예외)가 단일 bullet에 혼재, 3단계 이상 중첩 괄호 | `spec/5-system/14-external-interaction-api.md §8.3` | sub-section 또는 nested bullet으로 분리, `assertProductionConfig` 부연을 별도 blockquote로 분리 |
| 10 | 유지보수성 | `secret-store.md §3.3` 신규 bullet이 정책·근거·예외·비교를 단일 문장에 담고 기존 "미설정 → fail-fast" 항목과 부분 중복 | `spec/conventions/secret-store.md §3.3` | 기존 항목과 신규 항목을 "production fail-closed 조건" 단일 항목으로 재구성, 차이를 명시적으로 연결 |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `ENCRYPTION_KEY` 단일 마스터키가 LLM API 키 암호화·secret store 두 도메인에 재사용 — 키 노출 시 두 도메인 동시 손상 | `spec/conventions/secret-store.md §3.3`, `auth-config-webhook-followups.md` | 단기: HKDF 파생으로 도메인 분리; 중기: `ENCRYPTION_KEY_SECRET_STORE` 별도 env 도입 |
| 2 | 보안 | `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 블랙리스트 수동 관리 — 과거 교체된 예시 키 목록 완결성 보장 불가 (CWE-798 유사 구조) | `production-guards.ts:32-48` | CI에서 `.env.example` 파싱 후 블랙리스트 포함 여부 자동 검증, 또는 반복 바이트 패턴 정규식 탐지 방식 전환 |
| 3 | 보안 | `JWT_SECRET` 최소 길이 기준 32자이나 엔트로피 요건 미명시 — passphrase 입력 시 실제 엔트로피 128bit 미만 가능 | `spec/5-system/1-auth.md §Rationale` | spec에 `openssl rand -base64 32` 또는 동급 CSPRNG 출력 요건 명시, 반복 패턴 탐지 추가 |
| 4 | 보안 | `iext_*` SSE 토큰 query parameter 전달 시 서버 액세스 로그·브라우저 히스토리·Referer 노출 위험 — 로그 마스킹 정책 미명시 | `spec/5-system/14-external-interaction-api.md §7.2` | 서버 액세스 로그에서 `?token=` 파라미터 마스킹 정책을 spec 또는 구현 주석에 명시 |
| 5 | 보안 | 기존 throw 메시지 문자열 `"not allowed when NODE_ENV=production"` 폐기 — 이에 의존하는 테스트·알람·클라이언트 파싱 로직 있을 경우 silent 실패 | `spec/5-system/7-llm-client.md §7.1` | `production-guards.spec.ts`에서 실제 throw 메시지를 명시적으로 assert, 기존 코드·테스트에서 메시지 문자열 의존 여부 전수 grep |
| 6 | [SPEC-DRIFT] 요구사항 | `[SPEC-DRIFT]` `spec/5-system/1-auth.md §Rationale` 제목에 구현 추적 ID `(refactor 04 C-1·M-4·M-7)` 포함 — 기존 Rationale 항목(`### 1.4.A`, `### 1.5.B`) 패턴 불일치, spec 제목에 plan task ID 박지 않는 안정적 명명 원칙 위반 | `spec/5-system/1-auth.md §Rationale` | 제목을 `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL`로 변경, task ID는 본문 첫 줄 괄호로 이동 (spec 갱신은 project-planner 대상) |
| 7 | 요구사항 | `spec/5-system/1-auth.md §Rationale` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 누락 — 코드는 throw하나 spec 1-auth.md는 3개만 열거 | `spec/5-system/1-auth.md §Rationale` | `1-auth.md §Rationale` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` bullet 추가 |
| 8 | 요구사항 | `ALLOW_PRIVATE_HOST_TARGETS` warn 정책이 플래그 1차 출처 `spec/4-nodes/4-integration/1-http-request.md §4`에 미반영 — 해당 spec만 보면 production 동작 알 수 없음 | `spec/4-nodes/4-integration/1-http-request.md §4` | "production에서 warn 로그(부팅 차단 없음, `assertProductionConfig` warn 분기)" 1줄 추가 |
| 9 | 아키텍처 | `assertProductionConfig` 관할 목록이 spec 세 파일(`1-auth.md`, `7-llm-client.md`, `11-mcp-client.md`)에 중복 열거 — SoT 미단일화, 신규 가드 추가 시 spec 간 불일치 위험 | 세 spec 파일 내 관할 목록 | 전용 SoT 문서 또는 `1-auth.md §Rationale` 한 곳으로 확정, 나머지 파일은 링크만 유지 |
| 10 | 아키텍처 | `INTERACTION_JWT_SECRET` fail-closed가 NestJS DI 초기화 중 throw — `assertProductionConfig`의 bootstrap 최초 단계 throw와 타이밍 상이, 아키텍처 비일관성 | `spec/5-system/14-external-interaction-api.md §8.3`, `production-guards.ts` 주석 | `production-guards.spec.ts` 또는 통합 테스트에서 `INTERACTION_JWT_SECRET` 미설정 시 실제 부팅 거부 검증 케이스 추가 |
| 11 | 아키텍처 | `production-guards.ts`가 barrel export(`common/config/index.ts`) 미포함 — `isFlagOn` 재사용 시 깊은 상대 경로 import 분산 | `common/config/index.ts`, `production-guards.ts` | 파일 헤더에 "main.ts 전용, barrel 미포함 의도" 명시, 또는 `isFlagOn`을 `common/utils/env.ts`로 분리해 barrel 노출 |
| 12 | 테스트 | `ENCRYPTION_KEY` 독립 describe 블록 내 "유효 값 통과" 긍정 케이스 누락 (`JWT_SECRET`에는 있음) | `production-guards.spec.ts` | `describe('ENCRYPTION_KEY (04 M-4)')` 내에 `it('passes for a valid non-example key', ...)` 추가 |
| 13 | 테스트 | `isFlagOn` 독립 단위 테스트 블록 없음 — `MCP_ALLOW_INSECURE_URL`에서 간접 검증만 되고, `main.ts`에서도 재사용되나 계약 검증 미고정 | `production-guards.spec.ts` | `describe('isFlagOn')` 블록에서 `undefined`, `''`, `'true'`, `'1'`, `'TRUE'`, `'yes'` 등 `it.each`로 계약 고정 |
| 14 | 테스트 | `INSECURE_JWT_SECRETS`/`KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set "동기화 의무"가 테스트로 미고정 — `jwt.config.ts` dev fallback·`.env.example` 변경 시 CI 미탐지 | `production-guards.spec.ts` | `jwt.config.ts` dev fallback import 후 Set 포함 단언, `.env.example` 파싱 후 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 포함 단언 추가 |
| 15 | 테스트 | `auth.module.ts` `?? 'fallback'` → `getOrThrow` 교체 후 해당 경로 테스트 미추가 | `auth.module.ts` | mock `ConfigService`에 `jwt.secret` 반드시 제공하도록 기존 auth.module 테스트 업데이트 확인 |
| 16 | 테스트 | `main.ts` `ALLOW_PRIVATE_HOST_TARGETS` warn 분기에 대한 테스트 없음 | `main.ts:52-65` | warn 로직을 별도 함수로 추출하거나, `production-guards.spec.ts`에 warn 정책 계약 주석 테스트 추가 |
| 17 | 문서화 | `assertProductionConfig` JSDoc에 `@throws` 태그 없음 | `production-guards.ts` | `@throws {Error} production 에서 위반 항목 발견 시 기동 거부 메시지와 함께 throw` 1줄 추가 |
| 18 | 문서화 | `isFlagOn` JSDoc에 `@param`·`@returns` 태그 없음 | `production-guards.ts:51-57` | `@param {string | undefined} value`, `@returns {boolean}` 추가 |
| 19 | 문서화 | 동기화 의무(`INSECURE_JWT_SECRETS`/`KNOWN_EXAMPLE_ENCRYPTION_KEYS`)가 코드 주석에만 존재, spec SoT에 미기술 | `production-guards.ts:27-48` | `spec/5-system/1-auth.md §Rationale` 또는 `spec/conventions/secret-store.md §R5`에 동기화 규칙 1줄 추가 |
| 20 | 문서화 | `spec/2-navigation/10-auth-flow.md §5` `OAUTH_STUB_MODE` production throw 미기술 — `7-llm-client.md`는 명시했으나 `10-auth-flow.md`는 미반영 | `spec/2-navigation/10-auth-flow.md §5` | `10-auth-flow.md §5` OAUTH_STUB_MODE 설명 뒤에 production throw 보증 1줄 추가 또는 교차 참조 링크 |
| 21 | 문서화 | `review/consistency/2026/06/11/10_52_27/_retry_state.json` `agents_pending`이 완료 후에도 5개 전체 기록, 실행 중 중단된 것과 구분 불가 | `_retry_state.json` | 세션 완료 후 `agents_pending → agents_success` 이동 반영, 또는 `"status": "initial"` 필드로 명시 |
| 22 | 범위 | 두 번의 consistency check 세션(10_17_44, 10_52_27) 산출물이 동시 커밋됨 — 1차(오탐 CRITICAL 2건)와 2차(해소)가 함께 존재해 독자 혼동 가능성 | `review/consistency/` 산출물 | 현 패턴(SUMMARY에 해소 근거 명시) 유지하되, 해소 메모에 "PR B #537 = auth-refresh-rotation-atomic" 컨텍스트 1줄 추가 권장 |
| 23 | 성능 | `INSECURE_JWT_SECRETS`/`KNOWN_EXAMPLE_ENCRYPTION_KEYS`를 `ReadonlySet<string>`으로 선언 — O(1) 조회, 확장 안정적 설계 (긍정 사항) | `production-guards.ts:32-48` | 없음 |
| 24 | 부작용 | `_retry_state.json` 내 절대 경로 하드코딩 — 타 머신·경로에서 오케스트레이터 오작동 가능성 | `review/consistency/.../10_52_27/_retry_state.json` | 오케스트레이터가 세션 종료 후 해당 파일을 재활용하지 않는 구조인지 확인; 재활용 가능성 있으면 상대 경로 또는 플레이스홀더 전략 검토 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | MEDIUM | `INTERACTION_JWT_SECRET` 가드 분리, `ALLOW_PRIVATE_HOST_TARGETS` warn-only SSRF 위험, `ENCRYPTION_KEY` 다도메인 재사용 |
| architecture | MEDIUM | warn 정책 `main.ts` 분산, 블랙리스트 수동 동기화 구조적 강제 부재, spec SoT 미단일화 |
| user_guide_sync | MEDIUM | `production-guards.ts` frontmatter `code:` 글로브 미포함, `README.md` 부팅 가드 변경 미반영 |
| requirement | LOW | spec 1-auth.md 열거 불완전(OAUTH_STUB/LLM_STUB), Rationale 제목 패턴 불일치, http-request §4 미동기화 |
| maintainability | LOW | spec 파일 3곳에 과도한 인라인 밀도(200자 초과 문장, 4중 주제 혼재 bullet) |
| testing | LOW | `ENCRYPTION_KEY` 긍정 케이스 누락, `isFlagOn` 독립 테스트 없음, Set 동기화 테스트 미고정 |
| documentation | LOW | `TOKEN_INVALID` reuse 탐지 케이스 누락(WARNING), JSDoc @throws/@returns 미기술 |
| side_effect | LOW | spec-코드 정합성 교차 확인 필요, `ALLOW_PRIVATE_HOST_TARGETS` warn 1차 출처 미반영 |
| performance | NONE | 순수 부팅 1회 실행, Set O(1), I/O 없음 — 성능 이슈 없음 |
| scope | NONE | 변경 의도(spec 반영 + consistency 산출물)와 일치, 범위 이탈 없음 |
| dependency | NONE | 신규 외부 패키지 없음, Node.js 표준 내장만 사용, 단방향 단일 소비자 구조 |
| database | NONE | DB 관련 코드 변경 없음 |
| concurrency | NONE | 동시성 관련 코드 없음, assertProductionConfig 동기 부팅 가드 |
| api_contract | NONE | API 엔드포인트·DTO·인증 미들웨어 변경 없음 |

---

## 발견 없는 에이전트

- **database**: DB 쿼리/마이그레이션/스키마 변경 없음
- **concurrency**: 런타임 동시성 코드 변경 없음
- **api_contract**: API 계약 변경 없음
- **performance**: 성능 이슈 없음 (모든 항목 INFO 수준 긍정 확인)
- **dependency**: 신규 외부 의존성 없음

---

## 권장 조치사항

1. **(보안 · WARNING-1)** `assertProductionConfig`에 `INTERACTION_JWT_SECRET` 존재·길이 이중 검증 추가, 또는 `production-guards.ts` 헤더에 "이 파일만으로 production 가드 전체가 아님" 명시
2. **(보안 · WARNING-2)** `ALLOW_PRIVATE_HOST_TARGETS` production warn-only 정책에 대해 SSRF 위험 명시 — `spec/4-nodes/4-integration/1-http-request.md §4`에 warn 동작 1줄 추가; throw 격상 여부 정책 결정
3. **(아키텍처 · WARNING-3)** `production-guards.spec.ts`에 `.env.example` 및 `jwt.config.ts` dev fallback 파싱 후 블랙리스트 Set 교차검증 테스트 추가 (수동 동기화 의무를 CI 회귀 방어선으로 전환)
4. **(User Guide · WARNING-6)** `spec/5-system/1-auth.md` frontmatter `code:`에 `production-guards.ts` 글로브 추가
5. **(User Guide · WARNING-7)** `README.md` 배포 주의사항에 production 부팅 거부 환경변수 조건 1줄 추가
6. **(문서화 · WARNING-5)** `spec/5-system/3-error-handling.md §1.2` `TOKEN_INVALID` 설명에 reuse 탐지(`is_revoked`) 케이스 복원
7. **(아키텍처 · WARNING-4)** `getProductionWarnings(env)` 함수를 `production-guards.ts`에 추가해 warn 정책도 단일 파일 관리 (단계적 리팩터)
8. **(유지보수성 · WARNING-8~10)** `7-llm-client.md`, `14-external-interaction-api.md`, `secret-store.md §3.3` 과밀 인라인 문장 분리 (후속 spec 정비 시 처리)
9. **(요구사항 · INFO-7)** `spec/5-system/1-auth.md §Rationale` 대상 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` 추가
10. **(요구사항 · INFO-6 SPEC-DRIFT)** `spec/5-system/1-auth.md §Rationale` 제목에서 task ID 제거, spec 명명 패턴 정합

---

## 라우터 결정

라우터 미사용 — `routing=fallback-all`. 전체 reviewer 실행.

- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명)
- **제외**: (없음)
- **강제 포함(router_safety)**: documentation, requirement