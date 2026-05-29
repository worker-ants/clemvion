# Plan 정합성 검토 결과

- target: `plan/in-progress/spec-draft-webhook-consistency.md`
- worktree: `webhook-url-env-5de041`
- 검토 시각: 2026-05-29

---

## 발견사항

### [INFO] Decision #5 (rate limit 100 req/min) — 미해결 사용자 확인 항목, 타 plan 과 직접 충돌 없음

- target 위치: 결정 테이블 #5 ⚠️ 비고, 진행 메모 "사용자 확인 필요 1건"
- 관련 plan: 없음 (rate limit 값에 관해 열린 결정을 보유한 in-progress plan 없음)
- 상세: target 은 스스로 "60(12-webhook 권장 목표) vs 100(코드 현행)" 을 미확정으로 표시하고 있다. 현재 `spec/5-system/12-webhook.md` Rationale(308/359행) 및 `spec/5-system/2-api-convention.md`(165/351행) 는 60req/min 또는 1000req/min 을 기재하고 있으며, 코드(`ThrottlerModule` named 'webhook') 는 100req/min 으로 운영 중이다. 타 plan 에서 이 값을 "결정 필요" 로 지정하거나 다른 값으로 제안한 사례는 없다. 따라서 plan 간 충돌은 아니며, 사용자 단독 확인으로 해소 가능하다.
- 제안: spec 갱신 전 사용자 확인(100 채택)을 받고 target 에 결정 기록 후 진행. plan 갱신 불필요(target 에 이미 ⚠️ 표시됨).

---

### [INFO] `spec/2-navigation/2-trigger-list.md` — telegram-guide-realign (ACTIVE) 와 동일 파일 경합, 단 섹션 분리

- target 위치: 결정 테이블 #2 (§2.4 URL prefix) · #3 · #12 (workspaceSlug)
- 관련 plan: (없는 plan file) / worktree `telegram-guide-realign-6ad222` (branch `claude/telegram-guide-realign-6ad222`, PR #353 OPEN)
- 상세: `telegram-guide-realign-6ad222` 는 `spec/2-navigation/2-trigger-list.md` 의 §2.3.1 isActive 행 및 R-16 Rationale 섹션을 수정한다. target 은 동일 파일의 §2.4 Webhook URL 형식(`{base_url}/hooks/` → `{base_url}/api/hooks/`) 과 하단 Rationale 에 해당하는 항목을 수정 예정이다. 두 변경은 **물리적으로 다른 섹션**이라 의미 충돌은 없으나, telegram-guide-realign 이 먼저 머지되면 target 적용 시 파일 베이스가 달라져 문맥 merge 가 필요하다.
- 제안: target 실제 spec 편집 시점에 현행 main 기준 파일을 다시 읽어 재확인 (현재 draft 단계이므로 편집 전 체크로 충분). CRITICAL 으로 분류하지 않음 — 섹션이 분리되어 있고 의미 충돌 없음.

---

### [WARNING] `auth-config-webhook-wiring.md` — status in-progress 이나 PR #341 MERGED, plan 파일 미이동

- target 위치: 해당 없음 (target 자체의 문제가 아닌 plan 관리 문제)
- 관련 plan: `plan/in-progress/auth-config-webhook-wiring.md` (worktree 필드 `.claude/worktrees/auth-config-webhook-wiring` — 실제 디렉토리 미존재, PR #341 squash-merge MERGED)
- 상세: `auth-config-webhook-wiring.md` 의 Phase 0 spec 갱신(`spec/5-system/12-webhook.md` 전반·AuthConfig 도메인) 은 PR #341 로 이미 main 에 반영되었다. 그러나 plan 파일은 `status: in-progress` 인 채 `plan/in-progress/` 에 남아 있어, target 이 "auth-config-webhook-wiring 이 선행 완료되어야 한다" 고 가정할 경우 혼동을 줄 수 있다. 실제로는 선행 조건이 이미 충족된 상태. 또한 `plan/in-progress/spec-draft-auth-config-webhook-wiring.md` 도 동일 worktree 로 in-progress 인 채 남아 있다.
- 제안: `plan/in-progress/auth-config-webhook-wiring.md` 및 `plan/in-progress/spec-draft-auth-config-webhook-wiring.md` 를 `plan/complete/` 로 `git mv` (PLAN 라이프사이클 규약). target 에 대한 영향은 없지만 plan 인덱스 신뢰도를 위해 정리 권장.

---

### [INFO] `auth-config-webhook-followups.md` 의 spec 보완 항목 #3 — 대부분 이미 반영됨, 미반영 1건 확인

- target 위치: 결정 테이블 전체 (12-webhook.md 관련 변경)
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` §3 (spec 보완 — project-planner 위임, worktree 미정 backlog)
- 상세:
  - "IP whitelist CIDR/IPv6 지원 여부 명시" → PR #348 (w4-cidr-ipwhitelist-a829b8, MERGED) 에서 WH-SC-09 에 반영 완료. followups plan 의 해당 항목 체크 필요.
  - "ip_whitelist fail-closed 명시" → PR #348 WH-SC-09 에 "클라이언트 IP 를 알 수 없으면 거부(fail-closed)" 기재됨. 반영 완료.
  - "IP 추출 정책 (CF-Connecting-IP → X-Forwarded-For → req.ip) 명시" → 현재 `spec/5-system/12-webhook.md` 에 미반영. target plan 의 결정 테이블에도 포함되지 않음. 따라서 target 과 충돌하지 않으나 followups plan §3 의 미완수 항목으로 남아있다.
  - target 이 12-webhook.md 를 수정할 때 IP 추출 정책 섹션과 겹치지 않으므로 직접 충돌 없음.
- 제안: `auth-config-webhook-followups.md` 에서 이미 해소된 CIDR/IPv6·fail-closed 항목을 `[x]` 체크 갱신 권장(plan 관리). IP 추출 정책(CF-Connecting-IP) 은 별도 project-planner 위임으로 계속 처리.

---

### [INFO] `spec/data-flow/10-triggers.md` — `/api/webhooks/:path` 및 `workspaceSlug` 잔존, 현재 선행 plan 없음

- target 위치: 결정 테이블 #3, #12 — `spec/data-flow/10-triggers.md` L14, L25, L54, L180
- 관련 plan: 없음 (10-triggers.md 를 수정하는 다른 active plan 미발견)
- 상세: 현재 `spec/data-flow/10-triggers.md` 는 3개 라인에서 `/api/webhooks/:path` (구 명칭) 를 참조하고, L180 에서 `/api/webhooks/:workspaceSlug/:path` 를 참조한다. target 이 올바르게 이를 정정 대상으로 식별했으며, 다른 plan 과의 충돌·선행 미해소 항목 없음. 안전하게 진행 가능.
- 제안: 없음. 정상 경로.

---

### [INFO] `spec/5-system/2-api-convention.md` §11 — 선행 미수행 항목 다수, 타 plan 과 충돌 없음

- target 위치: 결정 테이블 #2 #4 #5 #7 #8 #9 #10 #11 — 2-api-convention §11 전반
- 관련 plan: 없음 (2-api-convention.md §11 을 수정하는 다른 active worktree 미발견)
- 상세: `spec/5-system/2-api-convention.md` §11 에는 다음 구 설계 잔재들이 현재 main 에 그대로 남아있다. `{base_url}/hooks/` (without /api), `/hooks/* 는 /api/* 와 분리` note(사실 반대), text/plain Content-Type, `?wait=true` 동기 모드, `?api_key=` 쿼리, `path` 입력 필드, 1000 req/min. target 이 이를 모두 식별했고 다른 plan 과의 영역 중복 없음.
- 제안: 없음. 정상 경로.

---

### [INFO] `telegram-chat-channel-spec-polish-49c49b` worktree — branch 부재로 stale 판정 불가

- target 위치: 해당 없음
- 관련 plan: `plan/in-progress/spec-telegram-chat-channel-ui-polish.md` (worktree `telegram-chat-channel-spec-polish-49c49b`)
- 상세: Step 1 (ancestor 검사) ACTIVE, Step 2 (PR 조회) branch 미존재로 쿼리 공란. Step 3 fallback — active 로 처리. 그러나 실제 diff 를 확인한 결과 이 branch 는 remote 에 존재하지 않으며 `spec/5-system/2-api-convention.md` 를 수정하지 않는다. target 과 실질적 충돌 없음.
- 제안: `cleanup-worktree-all.sh --yes --force` 실행으로 해당 plan 의 worktree 정리 검토. 실제 작업이 남아있다면 새 worktree 생성 필요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 탐색 결과 총 **5건 후보** 식별. 그 중 **4건 stale 판정**으로 skip.

| worktree 이름 | branch | 판정 단계 | 사유 |
|---|---|---|---|
| `triggers-auth-column-a80393` | `claude/triggers-auth-column-a80393` | Step 1 (ancestor) | branch HEAD 가 origin/main 의 조상 — stale |
| `w4-cidr-ipwhitelist-a829b8` | `claude/w4-cidr-ipwhitelist-a829b8` | Step 2 (PR #348 MERGED) | squash merge, commit 7f56850f 이 main HEAD. stale |
| `auth-config-webhook-wiring` | `worktree-auth-config-webhook-wiring` | Step 2 (PR #341 MERGED) | squash merge. stale (worktree 디렉토리 자체 부재) |
| `telegram-chat-channel-spec-polish-49c49b` | (존재하지 않음) | Step 3 fallback | branch remote 미존재, diff 결과 대상 spec 파일 미수정 — 실질 충돌 없음. INFO 기록 |

위 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**active 로 처리된 후보**: `telegram-guide-realign-6ad222` (PR #353 OPEN, spec/2-navigation/2-trigger-list.md R-16 수정) — 1건.

---

## 요약

`plan/in-progress/spec-draft-webhook-consistency.md` 는 12가지 결정을 코드 ground truth 기반으로 도출하였으며, plan 정합성 관점에서 미해결 결정 우회·선행 plan 미해소·의미 충돌은 발견되지 않았다. 주요 선행 작업(`auth-config-webhook-wiring` §12-webhook.md 개편, `w4-cidr-ipwhitelist` WH-SC-09 CIDR) 은 이미 main 에 반영되었다. 유일한 active worktree 경합은 `telegram-guide-realign-6ad222` 의 `spec/2-navigation/2-trigger-list.md` 수정이나, 이는 §2.3.1 isActive / R-16 이라 target 의 §2.4 Webhook URL 섹션과 물리적으로 분리되어 의미 충돌이 없다. Decision #5 (rate limit 100 req/min) 는 사용자 확인이 선행되어야 하나 이는 plan 간 충돌이 아닌 단독 제품 결정 사안이다. `auth-config-webhook-wiring.md`·`spec-draft-auth-config-webhook-wiring.md` 두 plan 파일은 MERGED PR 임에도 in-progress 에 남아있어 plan 라이프사이클 정리가 필요하다. worktree 충돌 후보 5건 중 stale 4건 skip, active 1건 분석.

---

## 위험도

LOW

STATUS: OK
