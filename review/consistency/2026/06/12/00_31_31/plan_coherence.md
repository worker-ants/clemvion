# Plan 정합성 검토 — errcode-wiring (spec/conventions/, --impl-done)

검토 모드: `--impl-done`, scope=`spec/conventions/`, diff-base=`origin/main`
검토 시각: 2026-06-12

---

## 발견사항

### [INFO] spec/conventions/ 변경 없음 — 정합 확인 완료

- **target 위치**: `spec/conventions/` 전체 (diff `origin/main..HEAD` 내 해당 경로 변경 0건)
- **관련 plan**: `plan/in-progress/code-node-isolated-vm-followups.md` W1, `plan/in-progress/http-ssrf-all-auth-followups.md` `HTTP_BLOCKED enum 참조화`
- **상세**: 본 worktree(`errcode-wiring-92dc2c`, branch `claude/errcode-wiring-92dc2c`)가 실제로 수정한 파일은 5개로 한정된다 — `error-codes.ts`, `execution-failure-classifier.ts`, `http-request.handler.ts`, `code.handler.ts` + 연관 plan 파일. `spec/conventions/` 변경 0건이므로 §1~§4 관점의 정합 문제가 발생할 여지 없음.
- **제안**: 조치 불요.

---

### [INFO] chat-channel-adapter.md §3.2 — CODE_MEMORY_LIMIT·HTTP_BLOCKED 이미 spec 등재

- **target 위치**: `/Volumes/project/private/clemvion/spec/conventions/chat-channel-adapter.md` line 388 (internal codes 표)
- **관련 plan**: `plan/in-progress/code-node-isolated-vm-followups.md` W1 ("§3.1 분류 표에도 명시" 언급)
- **상세**: W1 항목에 "§3.1 분류 표에도 명시" 후속 요구가 있으나, `chat-channel-adapter.md` line 388 을 확인한 결과 `CODE_MEMORY_LIMIT` 과 `HTTP_BLOCKED(SSRF 차단)` 이 이미 `executionFailedInternal` internal 분류 행에 열거되어 있다. spec 측 추가 갱신은 불요하다.
- **제안**: `code-node-isolated-vm-followups.md` W1 완료 처리 시 "spec 갱신 불요(이미 등재)" 근거 노트로 충분.

---

### [INFO] node-output-redesign/code.md 의 CODE_MEMORY_LIMIT "로드맵 미구현" 서술 — 갱신 미수행

- **target 위치**: `/Volumes/project/private/clemvion/plan/in-progress/node-output-redesign/code.md` line 82, 132
- **관련 plan**: `plan/in-progress/code-node-isolated-vm-followups.md` 마지막 항목
- **상세**: `node-output-redesign/code.md` 에 `CODE_MEMORY_LIMIT /* 로드맵 */` 및 "현재 `node:vm` 한계로 미구현" 서술이 잔존한다. isolated-vm PR 완료로 stale. 본 `errcode-wiring` PR 범위 밖이므로 차단 수준은 아니나, 후속 작업에서 누락되지 않도록 기록.
- **제안**: `code-node-isolated-vm-followups.md` 후속 작업 시 해당 라인 갱신 포함.

---

### [INFO] worktree 활성 현황 — 경합 파일 없음

- **target 위치**: 해당 없음
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` (worktree `audit-sot-hygiene-8fc5f1` 활성)
- **상세**: `audit-sot-hygiene-8fc5f1` 의 변경 파일(`audit-log-response.dto.ts`, `auth-configs.*`, `integrations.service.*`, `workspaces.service.spec.ts`)이 본 worktree의 변경 파일과 겹치지 않는다. `pr4b-kb-embedding-retire` 는 변경 0건. `spec/conventions/` 경합 없음.
- **제안**: 조치 불요.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 조사 대상:

- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — Step 1: HEAD `a1ad25f6`, merge-base ancestor 검사 exit 1 (not stale). Step 2: PR 상태 미확인, Step 3 fallback으로 active 처리. 경합 파일 없어 §5 검토 대상 제외.
- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — diff 0건, 경합 없음.

**stale cascade 로 skip 된 worktree: 0건.**

---

## 요약

`errcode-wiring-92dc2c` worktree 의 구현(`error-codes.ts` 주석 보강, `execution-failure-classifier.ts` `CODE_MEMORY_LIMIT`·`HTTP_BLOCKED` 등재, `http-request.handler.ts` `ErrorCode` enum 참조화)은 `spec/conventions/` 를 일절 수정하지 않는다. `spec/conventions/chat-channel-adapter.md §3.2` 는 이미 두 코드를 internal 분류 행에 열거하고 있어 코드 변경과 완전히 정렬된다. 관련 plan(`code-node-isolated-vm-followups.md` W1, `http-ssrf-all-auth-followups.md` HTTP_BLOCKED 항목)의 미해결 결정 충돌·중복 작업·선행 조건 미해소 없음. 활성 worktree 2건 모두 파일 경합 없음. worktree 충돌 후보 2건 중 stale skip 0건, active 2건 분석.

## 위험도

NONE
