# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 불요.

## 전체 위험도
**LOW** — 두 건의 WARNING(표기 불일치·frontmatter 누락)과 다수 INFO 사항. 즉시 배포 차단 수준의 충돌 없음.

## Critical 위배 (BLOCK 사유)

_해당 없음._

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `engines.node >=24` 추가로 Node 22 최소 요건 암시 표기 불일치 | `codebase/backend/package.json` `engines.node` | `spec/4-nodes/5-data/2-code.md` §Rationale `isolated-vm 6.x (node>=22)` | spec 문구를 `"isolated-vm 6.x 라인 사용 (node>=22 지원, 프로젝트 최소 요건은 node>=24 — package.json engines 참조)"` 으로 갱신 |
| 2 | Convention Compliance | refactor 배치 태그 소문자 `m-1` — 프로젝트 전체 레이블 `M-1` 불일치 | `spec/7-channel-web-chat/4-security.md` §1 테이블 `입력 sanitize` 행 말미 `(refactor 04 m-1)` | `spec/conventions/swagger.md §0` 의 `M-1` 표기 | `(refactor 04 m-1)` → `(refactor 04 M-1)` 로 수정 |
| 3 | Convention Compliance | `§1.1` 섹션 및 `safe-html.ts` code: 등재가 실제 디스크 파일에 누락 — spec-code-paths.test.ts 가드 위험 | `spec/7-channel-web-chat/4-security.md` frontmatter `code:` | `spec/conventions/spec-impl-evidence.md §2.1` (status:implemented 의 code: 강제) | `§1.1` 유지 시 frontmatter `code:` 에 `codebase/channel-web-chat/src/lib/safe-html.ts` 추가; `§1.1` 제거 시 §1 cross-ref 제거 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `safe-html.ts` frontmatter `code:` 누락 (spec-coverage 추적 미인식) — WARNING #3 과 중복, 함께 해소 | `spec/7-channel-web-chat/4-security.md` | frontmatter `code:` 에 `codebase/channel-web-chat/src/lib/safe-html.ts` 추가 |
| 2 | Cross-Spec | `spec/1-data-model.md §2.1` 의 `(otplib base32)` — 라이브러리 무관 표기 권장 | `spec/1-data-model.md §2.1` | `(otplib base32)` → `(base32 — RFC 6238 호환)` |
| 3 | Cross-Spec | `@types/node` v22→v24 — spec 영향 없음 | `codebase/backend/package.json`, `codebase/channel-web-chat/package.json` | 없음 |
| 4 | Rationale Continuity | sanitize deny-by-default 원칙 Rationale 항목 미기재 | `spec/7-channel-web-chat/4-security.md ## Rationale` | `R4. sanitize — deny-by-default allowlist (blacklist 기각)` 항목 추가 |
| 5 | Rationale Continuity | otplib v12→v13 메이저 업그레이드 근거 Rationale 미기재 | `spec/5-system/1-auth.md ## Rationale` | TOTP 라이브러리 항목 추가 (ESM-only 전환·singleton deprecation·RFC 6238 호환 유지) |
| 6 | Convention Compliance | §1 요약 테이블에 구현 세부(`ALLOWED_TAGS`/`ALLOWED_ATTR`/`ALLOWED_URI_REGEXP`) 반복 — 단일 진실 분산 | `spec/7-channel-web-chat/4-security.md` §1 테이블 | §1 행은 요약 수준 유지, 구현 세부는 §1.1 전용으로 이동 |
| 7 | Convention Compliance | `_product-overview.md` 최상위 `## Overview` 헤더 없이 번호 섹션으로 구성 | `spec/7-channel-web-chat/_product-overview.md` | `## Overview` 헤더 추가하거나 현 구조 의도 명시 |
| 8 | Plan Coherence | §1.1 에 메인 앱 `markdown-renderer.tsx` sanitize 정책 병기 — 이중 SoT 위험 | `spec/7-channel-web-chat/4-security.md` §1.1 | 단기 현위치 유지 허용. 중기적으로 메인 앱 영역 spec 에 SoT 두고 cross-ref 로 전환 |
| 9 | Plan Coherence | `(refactor 04 m-1)` 코드 리뷰 태그 spec 본문 인라인 잔류 | `spec/7-channel-web-chat/4-security.md` §1 | 태그 제거하거나 Rationale 절로 이동 (WARNING #2 와 함께 처리) |
| 10 | Naming Collision | §1.1 섹션 앵커 신규 도입 — 번호 충돌 없음 | `spec/7-channel-web-chat/4-security.md` | 없음 |
| 11 | Naming Collision | `ALLOWED_URI_REGEXP` — `3-execution.md` Chart 렌더러와 동일 의미 공유, 충돌 없음 | `spec/7-channel-web-chat/4-security.md §1.1` | 없음 |
| 12 | Naming Collision | otplib v13 신규 심볼 및 패키지 — spec 식별자 충돌 없음 | `codebase/backend/src/modules/auth/totp.service.ts`, `package.json` | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `engines.node >=24` 추가로 `spec/4-nodes/5-data/2-code.md` 의 `node>=22` 기술과 표기 불일치 (WARNING) |
| Rationale Continuity | LOW | deny-by-default 원칙 및 otplib 업그레이드 Rationale 미기재 (INFO 2건) |
| Convention Compliance | LOW | refactor 태그 대소문자 불일치 + `safe-html.ts` code: 등재 누락 (WARNING 2건) |
| Plan Coherence | NONE | 미결정 항목과 충돌 없음. INFO 2건 (이중 SoT·리뷰 태그 인라인) |
| Naming Collision | NONE | 신규 식별자 충돌 없음. INFO 3건 (모두 참고 수준) |

## 권장 조치사항

1. **[W-3 해소 우선]** `spec/7-channel-web-chat/4-security.md` frontmatter `code:` 에 `codebase/channel-web-chat/src/lib/safe-html.ts` 추가 — `spec-code-paths.test.ts` 가드 실패 방지.
2. **[W-2 해소]** 동일 파일 §1 테이블 `(refactor 04 m-1)` → `(refactor 04 M-1)` 로 수정 (1글자 변경).
3. **[W-1 해소]** `spec/4-nodes/5-data/2-code.md` §Rationale 의 `isolated-vm node>=22` 문구에 `"프로젝트 최소 요건은 node>=24"` 주석 추가.
4. **[I-4 권장]** `spec/7-channel-web-chat/4-security.md ## Rationale` 에 R4 (sanitize deny-by-default allowlist 선택 근거) 항목 추가.
5. **[I-5 권장]** `spec/5-system/1-auth.md ## Rationale` 에 otplib v13 업그레이드 근거 항목 추가.
6. **[I-2 선택]** `spec/1-data-model.md §2.1` 의 `(otplib base32)` 를 라이브러리 무관 표기로 전환.