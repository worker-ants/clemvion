# 요구사항(Requirement) 리뷰 결과

리뷰 대상: production fail-closed 가드 블록 (refactor 04 C-1·M-4·M-7)
- 코드: `codebase/backend/src/common/config/production-guards.ts`, `main.ts`
- Spec: `spec/5-system/1-auth.md`, `spec/5-system/11-mcp-client.md`, `spec/5-system/7-llm-client.md`, `spec/5-system/14-external-interaction-api.md`, `spec/conventions/secret-store.md`
- 리뷰 산출물: `review/consistency/2026/06/11/10_17_44/` (1차), `review/consistency/2026/06/11/10_52_27/` (2차 rebase 후)

---

## 발견사항

### [INFO] 1차 consistency 결과(10_17_44)의 CRITICAL 2건은 cross-branch 오탐 — 2차(10_52_27)에서 정상 해소됨

- **위치**: `review/consistency/2026/06/11/10_17_44/rationale_continuity.md` — CRITICAL 2건 (Refresh 토큰 회전 원자성 Rationale 삭제, TOKEN_INVALID 설명 삭제)
- **상세**: 1차 검토는 sibling 브랜치 `auth-refresh-rotation-atomic`(PR #537)의 `spec/data-flow/2-auth.md` 변경을 본 브랜치 변경으로 오인했다. 본 브랜치(`prod-fail-closed-guards`)는 `spec/data-flow/2-auth.md`와 `spec/5-system/3-error-handling.md`를 **전혀 변경하지 않는다** (`git diff origin/main HEAD` 결과 0줄). 2차 검토(rebase 후 10_52_27)가 이를 정정해 BLOCK: NO 확정. 1차 보고서의 CRITICAL 2건은 그대로 보관되어 있어 혼동을 줄 수 있으나, 2차 보고서와 `SUMMARY.md`가 해소 근거를 명시하므로 이력상 허용.
- **제안**: 없음. 2차 검토가 올바르게 정정했음.

### [INFO] SUMMARY(10_52_27)가 plan_coherence WARNING 4건 중 2건만 WARNING 표에 게재 — 나머지 2건은 해소됨

- **위치**: `review/consistency/2026/06/11/10_52_27/SUMMARY.md` WARNING 표 vs `plan_coherence.md` 발견사항
- **상세**: `plan_coherence.md`에는 WARNING 4건이 있다 — (1) unified-model 동시 편집, (2) audit-coverage 동시 편집, (3) `security-jwt-secret-fallback.md` 결정 합의 필요, (4) `secret-store.md §3.3` 갱신 여부 확인. SUMMARY WARNING 표에는 (1)(2)만 게재되고 (3)(4)는 누락됐다.
  - (3)은 실제로 해소됨: `plan/complete/security-jwt-secret-fallback.md`가 본 브랜치에 포함되어 있어 결정 합의가 완료됐다.
  - (4)도 해소됨: `spec/conventions/secret-store.md`에 M-4 설명(`R5` Rationale + §3.3 bullet)이 본 브랜치에 포함되어 있다.
  - SUMMARY가 이 두 건을 INFO로 강등하거나 누락 처리한 판단은 내용 확인 후 적절하나, 명시적 "해소됨" 근거가 없어 독자 혼동 가능성 존재.
- **제안**: SUMMARY에 "(3)(4)는 본 브랜치에서 해소됨(plan/complete 이동, secret-store.md 갱신 포함)" 메모 추가 시 명확해지지만 기능적 문제는 없음.

### [INFO] spec 1-auth.md §Rationale 에서 OAUTH_STUB_MODE·LLM_STUB_MODE 가 assertProductionConfig 항목으로 열거되지 않음

- **위치**: `spec/5-system/1-auth.md` §Rationale "Production fail-closed 가드" — 대상 목록에 `JWT_SECRET`, `ENCRYPTION_KEY`, `MCP_ALLOW_INSECURE_URL` 3개만 나열
- **상세**: 코드(`production-guards.ts` lines 79–84)는 `OAUTH_STUB_MODE`와 `LLM_STUB_MODE`도 `assertProductionConfig`에서 throw한다. spec §Rationale의 "대상" 목록은 이 두 항목을 누락하고 있어 incomplete하다. 단, `spec/5-system/7-llm-client.md` §7.1 변경 줄에는 "JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL·OAUTH_STUB·LLM_STUB 를 응집한 단일 production fail-closed 블록"이라고 명시되어 있어, 전체 스펙에서 5개 항목이 모두 식별된다. 단일 명세 문서에서 불완전 열거.
- **제안**: `1-auth.md` §Rationale "대상" 목록에 `OAUTH_STUB_MODE`·`LLM_STUB_MODE` bullet 추가 (기존 `7-llm-client.md` 서술과 동기화). 기능 결함은 아니며 문서 완전성 문제.

### [INFO] `[SPEC-DRIFT]` spec 1-auth.md §Rationale 제목에 구현 추적 ID 포함 — spec 제목 명명 패턴 불일치

- **위치**: `spec/5-system/1-auth.md` Rationale `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP (refactor 04 C-1·M-4·M-7)`
- **상세**: 기존 Rationale 항목(`### 1.4.A`, `### 1.5.B` 등)은 번호 또는 의미 기반 제목을 쓴다. 신규 항목만 `(refactor 04 C-1·M-4·M-7)` 태스크 ID를 제목 줄에 직접 넣어 기존 패턴과 불일치한다. consistency-checker도 INFO로 식별했다. 이는 코드 결함이 아니라 spec 문서 스타일 문제다.
- **제안**: 코드 유지 + spec 제목을 `### Production fail-closed 가드 — JWT_SECRET·ENCRYPTION_KEY·MCP_ALLOW_INSECURE_URL`로 변경하고 task ID는 본문 첫 줄 parenthetical로 이동. spec 갱신은 `project-planner` 대상.

### [INFO] `ALLOW_PRIVATE_HOST_TARGETS` production warn 정책이 플래그 1차 출처(`spec/4-nodes/4-integration/1-http-request.md §4`)에 미반영

- **위치**: `spec/5-system/11-mcp-client.md` §3.2, `spec/5-system/1-auth.md` §Rationale에 warn 정책 명시됨. 단, `spec/4-nodes/4-integration/1-http-request.md §4`에는 production warn 동작이 없음
- **상세**: 코드(`main.ts` lines 52–60)는 `ALLOW_PRIVATE_HOST_TARGETS=true`를 production에서 throw가 아닌 warn으로 처리한다. 이 정책 경계("절대금지 → throw, 정당용도 → warn")가 플래그의 1차 정의 문서에 반영되지 않아 독자가 `1-http-request.md`만 보면 production 동작을 알 수 없다. 기능 충돌은 없음.
- **제안**: `spec/4-nodes/4-integration/1-http-request.md §4`에 "production에서 warn 로그(부팅 차단 없음, `assertProductionConfig` warn 분기)" 1줄 추가. spec 갱신 대상.

---

## 기능 완전성 점검 요약

| 항목 | 구현 | spec 정합 | 판단 |
|------|------|----------|------|
| C-1: `JWT_SECRET` 미설정·sentinel·예시값 throw | `production-guards.ts:89` (INSECURE_JWT_SECRETS) | spec 1-auth.md §2.1 + §Rationale | 일치 |
| C-1: `JWT_SECRET` 32자 미만 throw | `production-guards.ts:94` (MIN_JWT_SECRET_LENGTH=32) | spec "32자 미만(CWE-521)" | 일치 |
| M-4: `ENCRYPTION_KEY` 미설정·예시 키 throw | `production-guards.ts:106` (KNOWN_EXAMPLE_ENCRYPTION_KEYS) | spec secret-store.md §3.3 + R5 | 일치 |
| M-7: `MCP_ALLOW_INSECURE_URL=true` throw | `production-guards.ts:117` | spec 11-mcp-client.md §3.2 | 일치 |
| `OAUTH_STUB_MODE=true` throw | `production-guards.ts:79` | spec 7-llm-client.md §7.1(열거됨), 1-auth.md(누락) | 일치(코드↔7-llm), spec 1-auth.md 불완전 |
| `LLM_STUB_MODE=true` throw | `production-guards.ts:82` | spec 7-llm-client.md §7.1(열거됨), 1-auth.md(누락) | 일치(코드↔7-llm), spec 1-auth.md 불완전 |
| `ALLOW_PRIVATE_HOST_TARGETS` warn (not throw) | `main.ts:57-60` | spec 11-mcp-client.md §3.2 + 1-auth.md §Rationale | 일치; http-request §4 미반영 |
| dev/test/e2e no-op | `production-guards.ts:70` | 모든 spec 문서에 "영향 없다" 명시 | 일치 |
| 단위 테스트 전 분기 | `production-guards.spec.ts` 12 tests | plan 체크리스트 완료 | 충족 |

---

## 요약

production fail-closed 가드 블록(C-1·M-4·M-7)의 구현 및 spec 반영은 의도한 기능을 완전히 구현하고 있다. `assertProductionConfig` 함수는 JWT_SECRET(미설정·sentinel·예시값·32자 미만), ENCRYPTION_KEY(미설정·공개 예시 키), MCP_ALLOW_INSECURE_URL(=true), OAUTH_STUB_MODE(=true), LLM_STUB_MODE(=true)에 대해 정확히 throw하며, ALLOW_PRIVATE_HOST_TARGETS는 main.ts에서 warn-only로 분리되어 spec과 일치한다. spec 문서들(1-auth.md, 11-mcp-client.md, 7-llm-client.md, 14-external-interaction-api.md, secret-store.md)이 구현을 반영하여 갱신됐다. 1차 consistency 검토(10_17_44)의 CRITICAL 2건은 sibling 브랜치 오탐으로 확인되었고 2차(10_52_27) 검토에서 BLOCK: NO로 확정됐다. 남은 발견사항은 모두 INFO 수준 — spec 문서의 열거 불완전(OAUTH_STUB/LLM_STUB), Rationale 제목 명명 패턴 불일치, http-request §4 미동기화이며, 코드 수정이 필요한 항목은 없다.

## 위험도

LOW

STATUS: OK
