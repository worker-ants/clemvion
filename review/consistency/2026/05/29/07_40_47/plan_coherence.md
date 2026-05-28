# Plan 정합성 검토 결과

대상: `plan/in-progress/spec-draft-mail-send-status.md`
검토 모드: spec draft 검토 (--spec)
검토일: 2026-05-29

---

## 발견사항

발견된 CRITICAL/WARNING 항목 없음.

### [INFO] `spec-draft-chat-channel-error-notify.md` plan 은 stale — spec 은 이미 main 에 반영
- target 위치: target plan 변경 3 (spec/5-system/3-error-handling.md §1.4 Email 행에 EMAIL_HOST_BLOCKED 추가)
- 관련 plan: `plan/in-progress/spec-draft-chat-channel-error-notify.md` (worktree `chat-channel-error-notify-6d37ec`, Change 6 — 동일 §1.4 에 cross-link 1줄 추가)
- 상세: 두 plan 이 `spec/5-system/3-error-handling.md §1.4` 를 함께 수정한다. 단, chat-channel-error-notify 는 PR #323 으로 MERGED (squash). 해당 cross-link 한 줄(`Chat Channel 어댑터의 사용자 안내 메시지 분류는 본 enum 을 입력으로 사용한다 …`) 이 이미 main 의 error-handling.md line 74 에 반영되어 있음을 git 에서 확인. target plan 의 이메일 행 확장(EMAIL_HOST_BLOCKED 추가)은 해당 cross-link 행과 **다른 행**이며 충돌 없음.
- 제안: `plan/in-progress/spec-draft-chat-channel-error-notify.md` 를 `plan/complete/` 로 `git mv` 권장.

### [INFO] `spec-update-ai-error-output-fields-594d0a` worktree 는 stale
- target 위치: N/A (target plan 과 spec 파일 겹침 없음)
- 관련 plan: `plan/in-progress/spec-update-ai-error-output-fields.md` (worktree `spec-update-ai-error-output-fields-594d0a`)
- 상세: PR 스테이트 MERGED 확인. worktree 디렉토리 잔류. target plan 과 spec 파일 교집합 없음.

### [INFO] 여러 stale worktree 잔류
하단 "Stale 으로 skip 한 worktree" 절 참조.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 중 §worktree stale 판정 cascade 로 skip 된 항목:

| worktree | branch | stale 근거 |
|---|---|---|
| `docs-mobile-sidebar-complete-8659c2` | `claude/docs-mobile-sidebar-complete-8659c2` | Step 2: PR #344 MERGED |
| `eia-jti-tracking-7e68c5` | `claude/eia-jti-tracking-7e68c5` | Step 2: PR #347 MERGED |
| `llm-model-select-followup-refactor-4a3d96` | `claude/llm-model-select-followup-refactor-4a3d96` | Step 2: PR #345 MERGED |
| `spec-update-ai-error-output-fields-594d0a` | `claude/spec-update-ai-error-output-fields-594d0a` | Step 2: PR MERGED |
| `triggers-auth-column-a80393` | `claude/triggers-auth-column-a80393` | Step 1: ancestor of main (fast-forward) |
| `w4-cidr-ipwhitelist-a829b8` | `claude/w4-cidr-ipwhitelist-a829b8` | Step 1: ancestor of main |
| (declared) `chat-channel-error-notify-6d37ec` | `claude/chat-channel-error-notify-6d37ec` | Step 2: PR #323 MERGED |
| (declared) `workflow-resumable-execution-phase2-cont-64f537` | `claude/workflow-resumable-execution-phase2-cont-64f537` | Step 2: PR #321 MERGED |

8건 모두 stale. 디렉토리가 잔류하는 항목들 (`docs-mobile-sidebar`, `eia-jti-tracking`, `llm-model-select`, `spec-update-ai-error-output-fields`)은
`./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan `spec-draft-mail-send-status.md` 은 5점 검토 관점 모두에서 정합 문제가 없다. 변경 대상 spec 파일 (`spec/2-navigation/4-integration.md` §5.5 + 에러 코드 어휘 표, `spec/5-system/3-error-handling.md` §1.4) 에 대해 active worktree 가 동시 편집 중인 경우는 발견되지 않았다. spec-draft-chat-channel-error-notify 가 동일 §1.4 에 cross-link 를 추가하는 변경을 포함하고 있었으나 이미 PR #323 으로 MERGED — stale 처리. 미해결 결정 우회(§1), 중복 작업(§2), 선행 plan 미해소(§3), 후속 항목 누락(§4) 도 없음. 단, target plan 이 `ALLOW_PRIVATE_HOST_TARGETS` 환경 변수를 SMTP SSRF 정책의 opt-out 수단으로 spec 에 최초로 명시하는 변경을 포함하고 있는데, 이 변수는 codebase 에는 기존에 http-request·database-query 에서 사용 중이나 spec 에는 미기재 상태여서 target plan 의 기술이 정당하다. worktree 충돌 후보 8건 중 stale 8건 skip, active 0건 분석.

---

## 위험도

NONE
