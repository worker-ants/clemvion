# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음, 차단 불요

## 전체 위험도
**LOW** — WARNING 3건(에러 코드 누락·enum 미등재·plan 추적 단절), INFO 10건; 직접 모순 없음

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Cross-Spec | `HTTP_BLOCKED` 에러 코드가 시스템 에러 카탈로그에서 누락 | `spec/4-nodes/4-integration/1-http-request.md` §6 에러 코드 표 | `spec/5-system/3-error-handling.md` §1.4 HTTP 행 (`HTTP_TRANSPORT_FAILED · HTTP_4XX · HTTP_5XX · HTTP_TIMEOUT` 만 열거) | `spec/5-system/3-error-handling.md` §1.4 HTTP 행에 `HTTP_BLOCKED` 추가. target §6 정의는 정확하므로 수정 불요 |
| W-2 | Naming Collision | `HTTP_BLOCKED` 가 `error-codes.ts` `ErrorCode` enum 에 미등재 — inline string literal 으로만 사용 중 (`http-request.handler.ts:358/367`) | `spec/4-nodes/4-integration/1-http-request.md` §5.3, §6, §4.2 | `codebase/backend/src/nodes/core/error-codes.ts` (HTTP 그룹: `HTTP_TRANSPORT_FAILED`, `HTTP_4XX`, `HTTP_5XX`, `HTTP_TIMEOUT` 은 등재) | `error-codes.ts` HTTP 그룹에 `HTTP_BLOCKED: 'HTTP_BLOCKED'` 추가. W-1 수정 시 함께 처리 |
| W-3 | Plan Coherence | `refactor/04-security.md` C-3 체크박스 미갱신 — 사용자 결정(옵션 A, 2026-06-11) 기록 누락으로 추적 단절 | `spec/4-nodes/4-integration/1-http-request.md` §8.2 ("사용자 결정 2026-06-11: 옵션 A 진행") | `plan/in-progress/refactor/04-security.md` §C-3 (`[ ] 미착수` 로 표기) | C-3 항목에 "(사용자 결정 2026-06-11, 옵션 A → worktree `http-ssrf-all-auth`, `plan/in-progress/http-ssrf-all-auth.md`)" 기록 및 진행 중 표기 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `spec/0-overview.md` §6.1 에 SSRF 전 인증 공통 변경(breaking) 반영 누락 | `spec/0-overview.md` §6.1 HTTP·Integration 행 | §6.1 에 `ALLOW_PRIVATE_HOST_TARGETS` 플래그 주의 또는 §8.2 링크 주석 추가 (우선순위 낮음) |
| I-2 | Cross-Spec | `HTTP_TIMEOUT` vs `HTTP_TRANSPORT_FAILED` 통합 — 두 문서 미세 불일치 | `spec/4-nodes/4-integration/1-http-request.md` §4 step 12, §6 | `error-codes.ts` 실제 enum 확인 후 두 문서 동기화 |
| I-3 | Cross-Spec | `EMAIL_HOST_BLOCKED`·`HTTP_BLOCKED` 쌍 관계가 에러 카탈로그에서 비가시 | `spec/5-system/3-error-handling.md` §1.4 Email 행 | W-1 수정 시 함께 해결됨 |
| I-4 | Cross-Spec | `spec/5-system/11-mcp-client.md` §3.2 역참조 앵커 유효성 확인 필요 | `spec/5-system/11-mcp-client.md` §3.2 | `ALLOW_PRIVATE_HOST_TARGETS(http-request §4)` 링크 앵커만 재확인 |
| I-5 | Rationale Continuity | §8.2 기각 대안 (C) — 코드 주석 제거 근거가 spec 내에서 자기충족적으로 서술, 외부 검증 불가 | `spec/4-nodes/4-integration/1-http-request.md` §8.2 | §8.2 에 `http-request.handler.ts` 주석 제거 brief note 또는 cross-ref 추가 |
| I-6 | Rationale Continuity | §8.2 Usage 로그 정책 재서술이 `0-common.md §4.1` 계층 관계를 모호하게 함 | `spec/4-nodes/4-integration/1-http-request.md` §8.2 | "공통 §4.1 을 그대로 유지한다" 문구로 계층 명확화 |
| I-7 | Rationale Continuity | `Location` 헤더 redaction 이 §4 실행 로직에 별도 step 없이 흡수됨 | `spec/4-nodes/4-integration/1-http-request.md` §4 step 10 | step 10 또는 별도 step 에 `sanitizeResponseHeaders` 적용 한 줄 추가 (§8.1 cross-ref 포함) |
| I-8 | Convention Compliance | `output.response` legacy 잔재 필드가 `node-output.md` Principle 1 과 미묘하게 어긋남 (spec 이 이미 인지·명시) | `spec/4-nodes/4-integration/1-http-request.md` §5.3.2 | major 버전 정리 시 제거 계획 등재 또는 Principle 1 HTTP 예외 footnote 명문화 |
| I-9 | Naming Collision | `INTEGRATION_SERVICE_UNAVAILABLE` / `INTEGRATION_CALL_FAILED` 도 `ErrorCode` enum 미등재 (target 이전부터의 기존 상태) | `codebase/backend/src/nodes/core/error-codes.ts` | `error-codes.ts` 정비 트랙에서 Integration 그룹 일괄 등재 |
| I-10 | Plan Coherence | `spec-fix-prod-guards-prose.md` frontmatter `worktree` 필드가 stale PR #539(MERGED)를 참조 | `plan/in-progress/spec-fix-prod-guards-prose.md` | `worktree` 필드를 신규 worktree 또는 `(unstarted)` sentinel 로 갱신; `cleanup-worktree-all.sh` 실행 권장 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `HTTP_BLOCKED` 가 `3-error-handling.md` §1.4 HTTP 행에서 누락(W-1). 직접 모순 없음 |
| Rationale Continuity | NONE | §8.2 신규 Rationale 이 기존 invariant 를 번복하지 않음. INFO 3건만 |
| Convention Compliance | LOW | 전반적 규약 준수. INFO 2건(legacy 잔재, 빈 절 연번 보존) |
| Plan Coherence | LOW | C-3 체크박스 추적 단절(W-3). worktree 충돌 0건 |
| Naming Collision | LOW | `HTTP_BLOCKED` enum 미등재(W-2). `INTEGRATION_*` 미등재는 기존 상태 |

## 권장 조치사항

1. **(W-1 + W-2 — 구현 착수 전 처리 권장)** `spec/5-system/3-error-handling.md` §1.4 HTTP 행에 `HTTP_BLOCKED` 추가 + `codebase/backend/src/nodes/core/error-codes.ts` HTTP 그룹에 `HTTP_BLOCKED: 'HTTP_BLOCKED'` 추가. 두 작업은 같은 커밋으로 처리 가능하며, 이후 다른 모듈이 `ErrorCode.HTTP_BLOCKED` 를 type-safe 하게 참조할 수 있게 됨.
2. **(W-3)** `plan/in-progress/refactor/04-security.md` C-3 항목에 결정 결과(옵션 A, worktree `http-ssrf-all-auth`) 기록. plan lifecycle 추적 단절 해소.
3. **(I-2)** `codebase/backend/src/nodes/core/error-codes.ts` 에서 `HTTP_TIMEOUT` 독립 코드 존재 여부 확인 후 `spec/4-nodes/4-integration/1-http-request.md` §6 표 또는 `spec/5-system/3-error-handling.md` §1.4 에서 timeout 처리 경로 기술 동기화.
4. **(I-5~I-7)** 낮은 우선순위 — spec prose 보강 시 함께 처리 가능.
5. **(I-10)** `prod-fail-closed-guards` stale worktree cleanup 및 `spec-fix-prod-guards-prose.md` frontmatter 갱신.