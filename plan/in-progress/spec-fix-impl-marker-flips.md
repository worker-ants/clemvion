---
worktree: spec-sync-impl-644d19
started: 2026-06-03
owner: planner
---

# Spec Fix — spec-sync-impl 브랜치 구현 surface 의 spec marker flip / 본문 보강

> 출처: `claude/spec-sync-impl-644d19` 브랜치가 구현한 decision-free spec-sync 항목 + ai-review 후속.
> spec/ 은 developer read-only 라 본 항목들은 **project-planner** 가 처리한다 (#443 코드 → #444 planner spec 패턴과 동일).
> **consistency-check --spec 의무**. 처리 완료 시 아래 각 spec-sync 티켓을 `plan/complete/` 로 이동(미해결 follow-up 해소).

## A. 구현 완료 → "(미구현/Planned)" marker flip 필요

| spec | 절 | 현재 표기 | 구현 커밋 | 추적 ticket |
| --- | --- | --- | --- | --- |
| spec/5-system/8-embedding-pipeline.md | §4.3 CSV 청킹, §6.1 chunk metadata | "(미구현 — Planned)" / "항상 빈 {}" | 836ce29f | spec-sync-embedding-pipeline-gaps.md |
| spec/4-nodes/3-ai/2-text-classifier.md | §3.2 RESERVED_PORT_WORDS, §5.3 error.details.retryable/retryAfterSec, §7 summaryTemplate | "🚧 미구현 (Planned)" | 0d65f322 | spec-sync-text-classifier-gaps.md |
| spec/4-nodes/3-ai/(information-extractor) | §5.3 error.details.retryable/retryAfterSec | 미정의 | 0d65f322 | spec-sync-information-extractor-gaps.md |
| spec/2-navigation/14-execution-history.md | §2.4 Nodes 열 완료/전체 카운트 | 본문 "(미구현, Planned) … 항상 `—`" (frontmatter 는 #444 에서 implemented 로 flip 됐으나 본문 stale) | #443(65012370) | spec-sync-execution-history-gaps.md |

## B. statistics — 별도 draft 참조

- `plan/in-progress/spec-fix-statistics-planned-markers.md` — §2.1 `1d` period (사용자 결정: spec 갱신 = 구현 유지) + custom-range(`period=custom`) + §2.2 전 기간 대비 증감률(`totalExecutionsChangeRate`) + LLM usage 필드(`totalPromptTokens`/`totalCompletionTokens`/`topProvider`). 코드: #443(1d/usage) + abab3831(증감률/custom-range). ticket: spec-sync-statistics-gaps.md.

## C. node-summary fallback 필터 — 별도 draft 참조

- `plan/in-progress/spec-fix-node-summary-fallback-filter.md` — `summaryTemplate` 지원 필터 목록(`upper`/`lower`/`default:`/신규 `fallback:<path>`)과 인수 해석 방식 spec 명문화. 코드: a96fac1.

## D. 신규 surface — spec 본문 추가 필요

| spec 영역 | 추가할 내용 | 구현 커밋 | 추적 ticket |
| --- | --- | --- | --- |
| workflow(sub-workflow) 노드 spec | `workflow-selector` 위젯(실 dropdown), `⚠ Missing workflow` badge(config-scoped: workflowId 有 + workflowName 無), canvas `summaryTemplate` `{{workflowName\|fallback:workflowId}} · {{mode\|default:sync}}` | a96fac1 | spec-sync-workflow-gaps.md |
| auth spec (5-system/1-auth 또는 auth-flow) | `POST /auth/resend-verification` (throttle 5/min, email-enumeration-safe), verify-email/forgot-password resend+60s cooldown, register check-email onBlur. **emailVerifyToken 저장 = SHA-256 해시**(passwordResetToken 과 동일, ai-review SEC-CRITICAL 7fc682c3) 명문화 | 27b6c362, 7fc682c3, 45e97307 | spec-sync-auth-flow-gaps.md |

## E. hooks W1 (이미 구현, spec 정합 확인만)

- spec/5-system/15-chat-channel.md R-CC-12(d): "비활성 트리거도 inbound 서명 검증 수행, 실패 시 401" — 코드 d12932ab 로 정합. spec 본문이 이를 명시하는지 확인(미명시면 보강).

## 처리 순서
1. consistency-check --spec (본 draft + B/C draft 묶음).
2. BLOCK:NO 시 A~E spec 반영 + 각 spec frontmatter `status` 재평가(partial→implemented 해당 항목).
3. 각 spec-sync-*-gaps.md ticket 의 미해결 follow-up 해소 확인 → `git mv` 로 `plan/complete/` 이동 (`chore(plan): mark <name> complete`).
