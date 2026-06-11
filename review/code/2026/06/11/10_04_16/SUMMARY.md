# Code Review 통합 보고서

## 전체 위험도
**LOW** — production fail-closed 가드 응집(production-guards.ts 신규) + main.ts 리팩터링. 설계·보안 구조 모두 양호. 잔존 이슈는 테스트 경계값 누락·import 순서·spec 일부 미갱신 등 경미한 수준.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `jwt.config.ts` dev fallback(`'dev-jwt-secret'`) 미제거 — production 가드가 sentinel을 차단해 실질 노출은 막혔으나 dev/test에서 `JWT_SECRET` 미설정 시 예측 가능한 키로 토큰 서명됨 | `codebase/backend/src/common/config/jwt.config.ts` | 장기적으로 fallback 제거 후 dev/test에도 `JWT_SECRET` 명시 주입 권장. 현재는 production 가드가 방어선 |
| 2 | Security | `ALLOW_PRIVATE_HOST_TARGETS=true` — warn-only, production에서 throw 안 함. cloud metadata endpoint(`169.254.169.254`) 접근 차단이 외부 방화벽에 의존 | `codebase/backend/src/main.ts` L911-918 | 의도적 설계이나 cloud metadata IP 대역만은 추가 레이어 차단 고려. 현재는 spec 근거 있는 정책 |
| 3 | Architecture | `production-guards.ts`가 "throw 정책 전용"임을 코드/주석 레벨에서 자기서술화하지 않음 — 신규 플래그 추가 시 "어느 파일에 넣어야 하는가" 경계 불명확 | `codebase/backend/src/common/config/production-guards.ts` 상단 | 모듈 상단 주석에 "본 모듈은 throw 정책(fail-closed) 전용. warn 정책은 호출자(main.ts) 책임" 한 줄 추가 |
| 4 | Maintainability | `main.ts`에서 `Logger` / `assertProductionConfig` import가 파일 하단에 추가되어 기존 import 그룹화 패턴과 불일치 | `codebase/backend/src/main.ts` L818-819(diff 기준) | `import { Logger }`를 상단 NestJS import 블록으로, `import { assertProductionConfig }`를 로컬 유틸 블록 끝으로 이동 |
| 5 | Testing | `isFlagOn`의 false 케이스 경계값 미검증 — `'0'`, `'TRUE'`, `'yes'`, `''` 등 비표준 truthy 값이 가드를 통과하지 않음을 명시하지 않음 (OAUTH/LLM/MCP 모두 해당) | `production-guards.spec.ts` L87-96 | `it.each(['0', 'TRUE', 'yes', ''])('does NOT throw when MCP_ALLOW_INSECURE_URL=%s', ...)` 등 네거티브 케이스 추가 |
| 6 | Testing | `ENCRYPTION_KEY=''` (빈 문자열) 명시 검증 누락 — `!encryptionKey`로 falsy 처리되어 throw 되어야 하나 테스트가 이를 직접 서술하지 않음 | `production-guards.spec.ts` ENCRYPTION_KEY describe 블록 | `it('throws when empty string', ...)` 케이스 추가 |
| 7 | Documentation | `isFlagOn` 함수에 독스트링 누락 — `'true'`/`'1'`만 truthy로 취급하는 이유(`'yes'`, `'on'`, 대문자 의도적 제외)가 미설명 | `production-guards.ts` L645-647 | 함수 위에 한 줄 주석 추가: `// Only exact string 'true' or '1' are treated as on; any other value is off.` |
| 8 | Documentation | `INTERACTION_JWT_SECRET` 동형 패턴에 spec 내 교차 링크 없음 — "동형이다" 언급만 있고 실제 구현 위치나 관련 spec 섹션 링크 부재 | `spec/5-system/1-auth.md` §2.1 노트 | `spec/5-system/14-external-interaction-api.md §8.3` 링크 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/7-llm-client.md §7.1` — LLM_STUB_MODE 프로덕션 차단 주체가 `main.ts`로 기술됨. 실제 구현은 `production-guards.ts`의 `assertProductionConfig`로 이관됨 | `spec/5-system/7-llm-client.md §7.1` | 코드 유지 + spec 갱신: `"assertProductionConfig (production-guards.ts) 가 … throw 한다"`로 수정 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/14-external-interaction-api.md §8.3` — OAUTH_STUB_MODE/LLM_STUB_MODE 가드를 `main.ts` inline 가드와 동형으로 기술하나 가드 소재(`production-guards.ts`) 미명시 | `spec/5-system/14-external-interaction-api.md` L651 | 코드 유지 + spec 갱신: 가드 소재(`production-guards.ts`) 명시 |
| 3 | Security | `INTEGRATION_ENCRYPTION_KEY` production boot guard 부재 — 미설정/예시값 사용 시 warn만 출력(throw 없음). 본 PR 범위 외 기존 GAP | `.env.example` L158-160, `credentials-transformer.ts` | 별도 follow-up: `assertProductionConfig`에 `INTEGRATION_ENCRYPTION_KEY` 차단 로직 추가 고려 |
| 4 | Security | `INSECURE_JWT_SECRETS` set이 현재 2개 sentinel만 차단. `.env.example` JWT_SECRET placeholder 변경 시 동기화 의무 있음 | `production-guards.ts` L630-632 | `.env.example` JWT_SECRET placeholder 변경 시 set 동기화를 PR checklist에 포함 |
| 5 | Architecture | `KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set에 삭제 예정일 정책 없음 — 항목이 무한 증가 구조 | `production-guards.ts` L638-643 | 각 항목에 `// deprecated since YYYY-MM` 형식 주석 컨벤션 추가 |
| 6 | Architecture | `.env.example` placeholder 변경 시 `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 동기화 의무가 암묵적 | `production-guards.ts` 주석 | 주석에 ".env.example 플레이스홀더 변경 시 구 값을 이 Set에 추가할 의무" 명시 |
| 7 | Maintainability | 테스트 설명 문자열에 내부 refactor ID(`04 C-1` 등) 직접 삽입 — ID 변경 시 오해 유발 가능 | `production-guards.spec.ts` L437, L452, L467 | 의미 중심 서술(`'JWT_SECRET — production fail-closed'`)로 변경하고 ID는 주석으로 이동 |
| 8 | Maintainability | `production-guards.spec.ts`에서 `for...of` 루프와 `it.each` 혼용 (동일 목적에 두 패턴) | `production-guards.spec.ts` L407-418, L468 | `it.each`로 통일하거나 혼용 기준을 주석으로 명확히 |
| 9 | Maintainability | `main.ts`에서 `new Logger('Bootstrap').warn(...)` 인스턴스를 변수 없이 즉시 버림 + 파일 내 logging 방식 혼재(Logger vs console.log) | `main.ts` L915-918 | bootstrap 상단에 `const logger = new Logger('Bootstrap')` 선언 후 재사용 |
| 10 | Testing | `JWT_SECRET` 빈 문자열(`''`) 케이스 미검증 — `!jwtSecret`에서 falsy 처리되어 올바르게 throw 되나 테스트가 의도를 명시하지 않음 | `production-guards.spec.ts` JWT_SECRET 블록 | `it('throws when empty string', ...)` 추가 |
| 11 | Testing | 복수 위반 동시 발생 시 첫 번째 guard에서만 throw(fail-fast) — 의도인지 누락인지 테스트에서 불분명 | `production-guards.ts` 전체, spec.ts | 주석 또는 테스트 케이스로 "fail-fast" 동작이 의도적임을 명시 |
| 12 | Testing | `ALLOW_PRIVATE_HOST_TARGETS` warn 경로(`main.ts` L911-918)에 단위 테스트 없음 — main.ts 부팅 함수 특성상 수용 가능 | `main.ts` L911-918 | 향후 warn 가드 추가 시 `warnProductionConfig` 류 별도 함수로 분리해 테스트 고려 |
| 13 | Architecture | `main.ts` Logger 인스턴스를 `new`로 직접 생성 — NestJS DI 외부라 구조화 로그 어댑터 적용 전 plain text 출력 가능 | `main.ts` bootstrap 함수 | 사이드이펙트 없음, 수용 가능 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | jwt.config.ts dev fallback 미제거(production 가드 차단으로 완화), ALLOW_PRIVATE_HOST_TARGETS warn-only |
| architecture | LOW | throw/warn 정책 분리 경계 자기서술화 미흡, KNOWN_EXAMPLE_ENCRYPTION_KEYS 동기화 의무 암묵적 |
| requirement | LOW | spec/5-system/7-llm-client.md·14-external-interaction-api.md 2건 SPEC-DRIFT(가드 소재 미갱신), INTEGRATION_ENCRYPTION_KEY guard 부재(범위 외 기존 GAP) |
| scope | NONE | 8개 파일 전체 단일 목적에 응집. 범위 이탈 없음 |
| side_effect | NONE | 의도하지 않은 부작용 없음. 불변 Set, 순수 함수, 읽기 전용 env 접근 |
| maintainability | LOW | main.ts import 순서 불일치, 테스트 내 for...of/it.each 혼용, refactor ID 테스트 설명 직접 삽입 |
| testing | LOW | isFlagOn 네거티브 경계값 미검증, ENCRYPTION_KEY 빈 문자열 케이스 누락 |
| documentation | LOW | isFlagOn 독스트링 누락, INTERACTION_JWT_SECRET spec 교차 링크 부재 |

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음. 의도 외 수정 없음.
- **side_effect**: 런타임 부작용 없음. 전체 INFO 수준.

## 권장 조치사항

1. **(WARNING 즉시 권장)** `production-guards.ts` 상단에 "throw 정책 전용 모듈" 자기서술 주석 한 줄 추가 — 유지보수 경계 명확화 (Architecture W-3)
2. **(WARNING 즉시 권장)** `main.ts` import 순서를 기존 그룹화 패턴과 일치시킴 — `Logger`를 상단 NestJS 블록으로, `assertProductionConfig`를 로컬 유틸 블록으로 이동 (Maintainability W-4)
3. **(WARNING 테스트 보강)** `isFlagOn` 네거티브 경계값 케이스 추가 — `'TRUE'`, `'yes'`, `'0'`, `''`가 가드를 활성화하지 않음을 명시 (Testing W-5)
4. **(WARNING 테스트 보강)** `ENCRYPTION_KEY=''` 빈 문자열 throw 케이스 명시 추가 (Testing W-6)
5. **(WARNING 문서)** `isFlagOn` 함수에 truthy 범위 결정 이유 주석 한 줄 추가 (Documentation W-7)
6. **(SPEC-DRIFT spec 갱신)** `spec/5-system/7-llm-client.md §7.1` 가드 주체를 `assertProductionConfig (production-guards.ts)`로 수정 (Requirement INFO-1)
7. **(SPEC-DRIFT spec 갱신)** `spec/5-system/14-external-interaction-api.md §8.3` 가드 소재(`production-guards.ts`) 명시 (Requirement INFO-2)
8. **(INFO 장기 개선)** `INTEGRATION_ENCRYPTION_KEY` production boot guard 추가 follow-up plan 생성 (기존 GAP)
9. **(INFO 장기 개선)** `KNOWN_EXAMPLE_ENCRYPTION_KEYS` 항목에 `// deprecated since YYYY-MM` 컨벤션 적용

## 라우터 결정

라우터 결정 방식: done (router가 선별)

**실행** (forced 포함, 8명): `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`

**강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 강제)

**제외** (6명):

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | router 제외 |
| dependency | router 제외 |
| database | router 제외 |
| concurrency | router 제외 |
| api_contract | router 제외 |
| user_guide_sync | router 제외 |