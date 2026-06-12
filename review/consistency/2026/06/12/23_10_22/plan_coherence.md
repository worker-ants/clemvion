# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-audit-workspace-scope.md`
worktree: `refactor-04-followups2-1de843` (branch `claude/refactor-04-followups2-1de843`)
검토 모드: --spec

---

## 발견사항

### [WARNING] 결정 2의 반영 위치가 이미 spec에 존재 — 중복/불필요 작업 위험

- **target 위치**: target 문서 `## 결정 2 — ip_whitelist/rate-limit IP 추출 헤더 기반은 by-design (1b)` → "반영 위치: `§Rationale 2.3.B` 에 1~2줄"
- **관련 plan**: `plan/in-progress/spec-draft-refactor-04-security-drift.md` (worktree `refactor-04-security-286de9`, PR #570 MERGED) — 해당 plan이 이미 `1-auth.md §Rationale 2.3.B` 를 신설했으며 ip_whitelist·rate-limit 관련 내용을 이미 포함한다.
- **상세**: `spec/5-system/1-auth.md` L576 의 `§2.3.B` "클라이언트 IP 신뢰 (m-3)" 단락은 이미 "본 신뢰 플래그는 IP 를 읽는 세 경로(세션·감사 IP `auth/utils/client-ip`, 공개 webhook rate-limit, `ip_whitelist` 검증)에 일관 적용한다" 를 명시하고 있다. target plan의 Decision 2가 추가하려는 내용("ip_whitelist/rate-limit의 헤더 기반(CF-gated→XFF) IP 추출은 의도된 결정이며 `req.ip` 우선화는 CF Tunnel 토폴로지에서 부정확") 의 핵심은 이미 §2.3.B 에 기재돼 있다. 추가할 문장이 없거나 있어도 극히 소폭(CF Tunnel 구체 설명)에 그쳐 작업 의의가 크게 줄어든다. target plan이 §2.3.B 의 현재 상태를 확인하지 않은 채 "반영 필요" 로 기술한 것으로 보인다.
- **제안**: target plan 집필 전에 `spec/5-system/1-auth.md §2.3.B` (L570–580) 를 먼저 읽어 추가 필요 여부를 재확인한다. 이미 충분히 기재됐다면 Decision 2의 "반영 위치" 항목을 "이미 반영됨 — §2.3.B L576 참조" 로 수정하고 해당 편집을 skip 한다. 빠진 각도(예: `extractClientIp`의 XFF 첫 IP 한정이 의도인 점을 코드 리뷰어에게 공지)가 있다면 그 부분만 보충한다.

---

### [INFO] Decision 1의 `data-flow/1-audit.md §1.1` 반영 — 기존 커버리지 갭 기술과 정합 확인 필요

- **target 위치**: target 문서 `## 결정 1 — 반영 위치` → "`data-flow/1-audit.md §1.1`(Planned user.* 행에 귀속 = 세션 workspace, reset → login_history 주석)"
- **관련 plan**: 없음(직접 관련 in-progress plan 없음). 단 `data-flow/1-audit.md §1.1` L69 에 이미 "인증(`user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled`) 액션은 모두 미구현"이라는 커버리지 갭 기술이 존재한다.
- **상세**: 현재 `data-flow/1-audit.md §1.1` 은 `user.*` 3종을 "Planned 미구현" 으로 기술하지만 어느 워크스페이스에 귀속하는지에 대한 언급이 없다. target plan의 Decision 1은 "세션 workspace" 귀속 규칙을 추가하려는 것이므로 이 편집은 신규이며 기존 기술과 충돌 없이 보완적이다. 단, 편집 시 §1.1 의 커버리지 갭 기술("모두 미구현")과 일관성을 유지해야 한다 — 귀속 규칙 추가는 "미구현이지만 구현 시 이 규칙을 따른다"는 형태로 병존 가능하다.
- **제안**: 편집 시 §1.1 의 기존 "미구현" 표기를 제거하지 말고, "귀속 = 세션 workspace" 주석을 기존 기술에 병기하는 형태로 보완한다. 이미 충분히 안전한 편집이며 별도 차단 사항 없음.

---

### [INFO] `spec-draft-refactor-04-security-drift.md` plan은 stale — 정리 권고

- **target 위치**: 해당 없음 (target 문서에 직접 언급 없음)
- **관련 plan**: `plan/in-progress/spec-draft-refactor-04-security-drift.md` (worktree `refactor-04-security-286de9`)
- **상세**: `spec-draft-refactor-04-security-drift.md` 의 worktree branch `claude/refactor-04-security-286de9`는 PR #570 (MERGED) 로 이미 main에 포함됐으나 plan 파일이 `in-progress/` 에 남아 있다. 해당 plan이 `1-auth.md §2.3.B` 를 신설한 이력이며, target plan의 Decision 2 배경과 직결된다. stale plan이 정리되지 않아 Decision 2 기재 현황 파악이 어려워진 케이스.
- **제안**: `plan/in-progress/spec-draft-refactor-04-security-drift.md` 를 `plan/complete/` 로 이동 후 target plan 착수. plan-lifecycle 기준으로 모든 항목 완료 시 이동이 원칙이며 해당 plan은 전 항목 구현됨 상태로 보임.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 결과:

**후보 탐색**:
- 활성 물리 worktree: `chat-channel-rate-limit-baa15a` (branch `claude/chat-channel-rate-limit-baa15a`, PR OPEN) — `spec/5-system/1-auth.md` 및 `data-flow/1-audit.md` 변경 없음. §5 CRITICAL 해당 없음.
- `refactor-04-security-286de9` (branch `claude/refactor-04-security-286de9`) — Step 1: git merge-base --is-ancestor → ACTIVE (squash merge 케이스). Step 2: PR #570 state = `MERGED` → **stale**.
- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 1: ACTIVE (squash). Step 2: PR #516 state = `MERGED` → **stale**.
- `audit-coverage-naming` (branch `claude/auth-config-audit`) — Step 1: 브랜치 없음. Step 2: PR #547 state = `MERGED` → **stale** (물리 worktree 디렉토리도 MISSING).

| worktree | branch | stale 판정 |
|---|---|---|
| (물리 디렉토리 없음) | `claude/refactor-04-security-286de9` | Step 2 PR #570 MERGED |
| (물리 디렉토리 없음) | `claude/spec-sync-audit-998544` | Step 2 PR #516 MERGED |
| (물리 디렉토리 없음) | `claude/auth-config-audit` | Step 2 PR #547 MERGED |

세 worktree 모두 물리 디렉토리가 이미 제거됐거나 branch가 삭제됐으므로 `cleanup-worktree-all.sh` 실행 효과는 경미하다. 단, `plan/in-progress/spec-draft-refactor-04-security-drift.md` 의 frontmatter `worktree: refactor-04-security-286de9` 는 stale 표기로 갱신이 권고된다 (plan-lifecycle: complete 이동 또는 stale 명시).

---

## 요약

target plan(`spec-draft-audit-workspace-scope.md`)은 전반적으로 plan 정합성을 유지하고 있다. Decision 1(`user.*` 감사 이벤트의 세션 workspace 귀속)은 `1-auth.md §4.1` 및 `data-flow/1-audit.md §1.1` 에 아직 기술되지 않은 신규 결정으로 충돌 없이 반영 가능하다. 단 Decision 2(`ip_whitelist/rate-limit IP 추출 by-design`)의 "반영 위치: §Rationale 2.3.B 추가"는 **PR #570 이미 해당 내용을 §2.3.B 에 포함**시킨 상태라 중복 편집 위험이 있다 — 착수 전 `1-auth.md §2.3.B` 현재 내용 확인이 필수다. 활성 worktree(`chat-channel-rate-limit-baa15a`)는 target spec 파일을 건드리지 않아 병렬 경합 없음. worktree 충돌 후보 3건 모두 stale(PR MERGED)으로 skip.

---

## 위험도

LOW
