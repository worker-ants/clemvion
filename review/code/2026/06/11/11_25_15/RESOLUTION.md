# RESOLUTION — 11_25_15 (fallback-all 재리뷰, prod-fail-closed-guards)

리뷰 세션: `review/code/2026/06/11/11_25_15/` (router 실패로 fallback-all 14명 실행).
위험도 **MEDIUM** — Critical 0 · Warning 10 · INFO 24.

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| W1 | 수용 (설계) | — | `INTERACTION_JWT_SECRET` 가드 분리는 `production-guards.ts` JSDoc L17-24 에 **의도적 설계**로 이미 문서화됨. "env 만으로 부팅 직전 판정 가능한 절대-금지 항목만" 원칙. DI 경로 변경 리스크는 설계 구조 비용으로 수용. |
| W2 | 수용 (spec 정책) | — | SSRF throw 격상은 `spec/4-nodes/4-integration/1-http-request.md §4` 정책 변경이 선행되어야 하는 planner 결정 사항. 현 warn-only 는 "정당한 self-host 용도" 설계 의도. W8(spec prose) draft 에 반영. |
| W3 | 코드 fix | `640fba79` | `.env.example` + `jwt.config.ts` dev fallback 파싱 후 `INSECURE_JWT_SECRETS`/`KNOWN_EXAMPLE_ENCRYPTION_KEYS` Set 교차검증 테스트 추가. 수동 동기화 의무를 CI 회귀 방어선으로 전환. |
| W4 | 수용 (설계) | — | warn 정책 `main.ts` 분리는 JSDoc L113-116 에 의도적 분리 원칙으로 문서화됨 — "throw 면 여기, warn 이면 main.ts" 기준. `getProductionWarnings()` 추출은 후속 리팩터 선택 사항. |
| W5 | spec draft | (위임) | `spec/5-system/3-error-handling.md §1.2` `TOKEN_INVALID` reuse 탐지 케이스 누락 → `plan/in-progress/spec-fix-prod-guards-prose.md` |
| W6 | 수용 (gate 재무장 위험) | — | `production-guards.ts` 를 spec frontmatter `code:` glob 에 추가하면 impl-done 게이트가 재무장됨. traceability 이득은 SoT 주석+Rationale 로 이미 확보. spec-impl-evidence 후속 별도 처리. |
| W7 | 코드 fix | `640fba79` | `codebase/backend/README.md` 배포 주의사항에 `assertProductionConfig` 부팅 거부 조건 1줄 추가. |
| W8 | spec draft | (위임) | `7-llm-client.md §7.1` 200자 초과 단일 문장 → `plan/in-progress/spec-fix-prod-guards-prose.md` |
| W9 | spec draft | (위임) | `14-external-interaction-api.md §8.3` 4주제 혼재 bullet → `plan/in-progress/spec-fix-prod-guards-prose.md` |
| W10 | spec draft | (위임) | `secret-store.md §3.3` 중복 항목 통합 → `plan/in-progress/spec-fix-prod-guards-prose.md` |

**코드 fix 실수**: W3, W7 — 2/10 항목 코드 수정. 나머지 6건 수용(설계/정책) + 2건 spec draft 위임.

> 직전 세션(10_52_27) 에서 W1=ENCRYPTION_KEY 형식·W2=INTERACTION fallback·W3=주석 SoT 가
> **이미 수용**됐다. 본 fallback-all 세션의 W1~W4 는 동일 영역 재표면이며, 수용 근거는
> 이미 설계 문서화되어 있다.

## 코드 추가 fix (INFO 항목 — scope 내)

| INFO # | 조치 | commit |
|--------|------|--------|
| INFO-12 | ENCRYPTION_KEY 유효 non-example 키 긍정 케이스 추가 | `640fba79` |
| INFO-13 | `isFlagOn` 독립 `describe` 블록 추가 (`it.each` 계약 고정) | `640fba79` |
| INFO-14 | Set 동기화 의무 CI 고정 (W3 와 동일 commit) | `640fba79` |
| INFO-17 | `assertProductionConfig` JSDoc `@throws` 태그 추가 | `640fba79` |
| INFO-18 | `isFlagOn` JSDoc `@param`/`@returns` 태그 추가 | `640fba79` |

## TEST 결과

- lint  : 통과
- unit  : 통과 (6547 passed — 직전 6532 대비 +15 신규 테스트)
- e2e   : 통과 (188/188)

## 보류·후속 항목

- **spec draft 위임 (W5/W8/W9/W10)**: `plan/in-progress/spec-fix-prod-guards-prose.md` — project-planner 처리 필요.
- **INFO-1 (ENCRYPTION_KEY 다도메인 재사용)**: HKDF 파생/별도 env — 별도 설계 결정 필요.
- **INFO-2 (KNOWN_EXAMPLE_ENCRYPTION_KEYS 완결성)**: 반복 바이트 패턴 정규식 탐지 전환 — 후속.
- **INFO-3 (JWT_SECRET 엔트로피 요건)**: spec `1-auth.md §Rationale` 에 CSPRNG 요건 명시 — planner.
- **INFO-4 (SSE token query param 로그 마스킹)**: spec 또는 구현 주석 명시 — 후속.
- **INFO-5 (throw 메시지 의존 grep)**: 현 코드·테스트에서 "not allowed when NODE_ENV=production" 의존 없음 (단위 테스트는 regex 매칭).
- **INFO-6 (SPEC-DRIFT — Rationale 제목 task ID)**: 이 프로젝트 spec 전반에서 `consistency-check` NONE 판정으로 확인된 일관 패턴 (`### 1.4.A`, `### 1.5.B` 등). 프로젝트 컨벤션과 일치 — drift 아님, 수용.
- **INFO-7 (1-auth.md Rationale OAUTH_STUB_MODE·LLM_STUB_MODE 누락)**: spec 갱신 필요 — spec draft 에 포함 권장.
- **INFO-8 ~ INFO-11**: spec SoT 미단일화·barrel export·ALLOW_PRIVATE_HOST_TARGETS warn 1차 출처 미반영 — planner 후속.
- **INFO-15 (auth.module.ts getOrThrow 테스트)**: 기존 auth.module 테스트 `jwt.secret` 제공 여부 — 현 6547 통과로 확인됨 (별도 조치 불필요).
- **INFO-16 (main.ts ALLOW_PRIVATE_HOST_TARGETS warn 테스트)**: warn 로직 함수 분리 후속 리팩터 시 추가 권장.
- **INFO-19 (동기화 의무 spec SoT 기술)**: spec draft 에 포함 권장.
- **INFO-20 (10-auth-flow.md OAUTH_STUB_MODE production throw)**: spec 갱신 — planner.
- **INFO-21/24 (_retry_state.json)**: 오케스트레이터 내부 — 별도 개선.
- **INFO-22 (consistency check 세션 2개 동시 커밋)**: 현 패턴 유지 허용.
