# Consistency Check 통합 보고서 (spec draft — channel-web-chat gaps)

**BLOCK: YES** — Critical 1건. 단 **설계 내용은 기존 spec 과 충돌 없음**; Critical/Warning 은 draft 파일 frontmatter 위생 + 타 worktree 동시수정 경합.

> target: `plan/in-progress/spec-draft-channel-web-chat-gaps.md` · 2026-06-03 09:37:49 · --spec

## Critical (BLOCK)
| # | Checker | 위배 | 제안 |
|---|---|---|---|
| 1 | Convention | draft frontmatter `worktree` 에 full path 사용(`.claude/worktrees/feat-web-chat-demo`) — 규약은 디렉토리 이름만 | `worktree: feat-web-chat-demo` |

## Warning
| # | Checker | 위배 | 제안 |
|---|---|---|---|
| 1 | Convention | `kind: spec-draft` 비표준 frontmatter 필드 | 제거(본문 h1 으로 명시됨) |
| 2 | Convention | `targets:` 비표준 필드 + codebase/spec 혼재 | 제거, 본문 "(developer)" 주석으로 유지 |
| 3 | Convention | `spec-frontmatter-parse.ts` 를 §4 공식 가드와 동급 기술 | helper(INCLUDE_PREFIXES) 임을 명기 |
| 4 | Plan | `spec-impl-evidence.md` 동시 수정 경합 — spec-sync-audit worktree | 병합 순서 직렬화/리베이스 |
| 5 | Plan | `codebase/backend/.env.example` 동시 수정 경합 — system-status worktree | 병합 순서 직렬화/리베이스 |

## INFO (요지)
cross-ref 보완(EIA §5.3 snapshot, W2 refresh→W1 SSE 재연결, 0-arch→4-security SoT, 2-sdk §5 show/hide·updateProfile SoT/소급불가, blocked enum 을 2-sdk §R4·4-security §3-① 와 1:1), Rationale 표준 제목, §1/§3 결번, spec/6 제외 근거.

## Checker별 위험도
Cross-Spec LOW / Rationale LOW / Convention MEDIUM(Critical 1) / Plan LOW(경합 2) / Naming NONE.

## 조치
draft frontmatter 수정(Critical+Conv Warning) + INFO cross-ref 반영 후 재검토 → BLOCK:NO 확인 후 spec 반영. W4/W5 는 환경적 경합(병합 순서) — plan 에 기록.
