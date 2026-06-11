# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 차단 사유 없음.

## 전체 위험도
**MEDIUM** — spec/data-flow/ 영역이 frontmatter 가드 적용 범위에서 누락되어 spec-impl lifecycle 추적이 작동하지 않음. 기능적 정합성 위반은 없음.

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `spec/data-flow/` 가 `spec-impl-evidence.md §1 INCLUDE_PREFIXES` 에 미등재 — lifecycle 추적 가드 무작동 | `spec/data-flow/*.md` 전체 (16개 파일) | `spec/conventions/spec-impl-evidence.md §1`, `spec-frontmatter-parse.ts INCLUDE_PREFIXES` | `spec-impl-evidence.md §1` 에 `spec/data-flow/**.md` 추가 + `spec-frontmatter-parse.ts` 동기 갱신. 이후 각 파일 frontmatter(`id`, `status`, `code:`) 추가 (`0-overview.md` 는 EXCLUDE_BASENAMES 면제 유지) |
| 2 | Convention Compliance | refresh token 회전 원자성 설계 결정 근거가 §1.4 인라인 주석에만 있고 `## Rationale` 섹션에 미등재 | `spec/data-flow/2-auth.md §1.4` (줄 180–189) | `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`" | `## Rationale` 섹션에 `### Refresh token 회전 원자성 (트랜잭션 + 조건부 UPDATE)` 항목 추가 (TOCTOU 방지·세션 소실 방지·JWT 사전 계산 분리 근거). §1.4 인라인 주석은 요약 + 링크로 축약 권장 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/5-system/1-auth.md §2.4` 토큰 갱신 플로우가 단일 트랜잭션 원자화·TOCTOU 차단 개념을 미반영 (직접 모순 아님, 독자 오해 가능) | `spec/5-system/1-auth.md §2.4` 3~4단계 | "(revoke + INSERT 는 단일 트랜잭션 원자화 — [data-flow §1.4](../data-flow/2-auth.md))" 한 줄 링크 추가 |
| 2 | Cross-Spec | `spec/5-system/1-auth.md §2.3` 세션 정책(동시 세션 5개·자동 종료·비활동 만료 30일)이 구현과 이미 벌어진 기존 gap — 이번 변경이 만든 모순 아님 | `spec/5-system/1-auth.md §2.3` | 별도 spec 수정 plan 으로 위임. "미구현(Planned)" 주석 표기 또는 실제 구현 사실로 수정 |
| 3 | Cross-Spec | `spec/data-flow/2-auth.md §1.4` Rationale 에서 `plan/` 경로를 직접 인용 — plan 이동 후 링크 불안정 가능 | `spec/data-flow/2-auth.md §1.4 Rationale` | plan 경로 참조 제거 후 동작 사실만 서술, 또는 `plan/complete/` 이동 후 참조 삭제 |
| 4 | Convention Compliance | `spec/data-flow/` 폴더명에 숫자 prefix 없음 — 기존 영역 폴더 패턴과 불일치하나 정식 규약 위반 아님 | `spec/data-flow/` (디렉토리명) | 현 폴더명 유지 권장 (변경 비용 큼). `spec-impl-evidence.md §1` 갱신 시 공식 목록 등재로 체계화 |
| 5 | Convention Compliance | `TOKEN_INVALID` 트리거 확장 — `error-codes.md §1 의미 기반 명명` 내 수용 가능, 위반 아님 | `spec/5-system/3-error-handling.md TOKEN_INVALID 행` | 추가 조치 불필요 |
| 6 | Plan Coherence | main 측 `refactor/05-database.md` C-1 체크박스가 `[ ] 미착수` — PR 머지 시 자동 해소 | `plan/in-progress/refactor/05-database.md §C-1` (main 브랜치) | 추가 조치 불필요 (PR 머지 후 자동 반영) |
| 7 | Plan Coherence | `spec-draft-exec-intake-queue.md §169` 의 `3-error-handling.md §1.4 EXECUTION_TIMEOUT` 수정 항목이 main 에 이미 반영된 상태 | `plan/in-progress/spec-draft-exec-intake-queue.md §169` | 해당 항목 완료 처리 가능 여부 확인 권장 |
| 8 | Plan Coherence | `unified-model-mgmt-5af7ee` 가 `spec/data-flow/` 동시 수정 중 — 파일 단위 경합 없음 (`2-auth.md` vs 1·5·6·7·8·9·13·15) | `spec/data-flow/2-auth.md` | 추가 조치 불필요. PR 머지 순서 무관 |
| 9 | Plan Coherence | `spec-fix-eia-token-error-codes.md` 의 `TOKEN_REVOKED` 추가 계획이 `TOKEN_INVALID` 확장과 논리적으로 인접 — hunk 충돌은 없음 | `spec/5-system/3-error-handling.md` | spec-fix-eia-token-error-codes 착수 시 main 기준 최신 파일로 rebase 후 진행 |
| 10 | Naming Collision | `TOKEN_INVALID` vs `BOT_TOKEN_INVALID` — 명칭 유사하나 HTTP status·도메인이 다른 기존 별개 코드로 명확히 구분됨 | `spec/5-system/3-error-handling.md`, `spec/5-system/15-chat-channel.md:344` | 현재 상태로 충돌 없음 |
| 11 | Naming Collision | `C-1` 계획 참조 번호가 여러 plan 문서에서 지역 번호로 사용 — 파일 경로 한정자(`refactor/05-database.md C-1`)로 모호성 차단됨 | `spec/data-flow/2-auth.md §1.4 Rationale` | 변경 불필요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `1-auth.md §2.4` 원자화 미반영(INFO), `§2.3` 세션 정책 기존 gap(INFO), plan 경로 인용(INFO). 직접 모순 없음 |
| Rationale Continuity | NONE | 기각 대안 재도입·합의 원칙 위반·무근거 번복·암묵 가정 충돌 모두 없음. WebAuthn 패턴과 정합 |
| Convention Compliance | MEDIUM | `spec/data-flow/` frontmatter 가드 누락(WARNING) + Rationale 섹션 미등재(WARNING). CI 안전망 공백 |
| Plan Coherence | NONE | plan 권장 경로 이행 확인. 활성 worktree 충돌 없음. stale 1건 skip |
| Naming Collision | NONE | 신규 식별자 도입 없음. 기존 코드 설명 확장만. 유사 코드 경계 유지 확인 |

## 권장 조치사항

1. **(WARNING 해소)** `spec/conventions/spec-impl-evidence.md §1` INCLUDE_PREFIXES 에 `spec/data-flow/**.md` 추가 및 `spec-frontmatter-parse.ts` 동기 갱신 — CI 가드 공백 해소. 별도 plan 또는 이번 PR 포함 선택.
2. **(WARNING 해소)** `spec/data-flow/2-auth.md` `## Rationale` 섹션에 refresh token 회전 원자성 결정 근거(`### Refresh token 회전 원자성`) 정식 등재 — 이번 PR 범위에서 처리 권장.
3. **(INFO 해소 — 권장)** `spec/5-system/1-auth.md §2.4` 에 "(revoke + INSERT 는 단일 트랜잭션 원자화 — [data-flow §1.4])" 한 줄 링크 추가 — 독자 오해 예방.
4. **(INFO — 별도 위임)** `spec/5-system/1-auth.md §2.3` 세션 정책 gap 을 별도 spec 수정 plan 으로 추적.
5. **(INFO — 모니터링)** `spec-fix-eia-token-error-codes` 착수 시 main 기준 최신 `3-error-handling.md` 로 rebase 확인.