# Plan 정합성 검토 — spec-draft-channel-web-chat-gaps.md

검토 일시: 2026-06-03
대상: `plan/in-progress/spec-draft-channel-web-chat-gaps.md` (이하 "target")
모드: spec draft 검토 (--spec)

---

## 발견사항

### [CRITICAL] spec-impl-evidence.md 를 spec-sync-audit worktree 가 §2.1 이후 동시 수정 중

- **target 위치**: target 문서 §§ "병합 순서 주의" + W3 ("§1 목록에 1줄 추가 — 비겹침")
- **관련 plan**: target 문서 자체의 병합 순서 주의 절이 `spec-sync-audit worktree 가 §2.1 이후를 동시 수정 중` 임을 명시
- **상세**: `spec-sync-audit` worktree(branch `claude/spec-sync-audit`)가 현재 `spec/conventions/spec-impl-evidence.md` 를 활발히 수정 중임이 diff 로 확인됨. 수정 범위는 §2.1 필드 표(pending_plans 설명 갱신) · §3 라이프사이클 표(backlog TTL 가드 텍스트 변경) · §4.1 가드 테스트 설명(spec-status-lifecycle.test.ts, spec-pending-plan-existence.test.ts 행 교체) · Rationale R-3 전체 재작성. Target 의 W3 는 "§1 목록에 1줄 추가(비겹침)"라고 주장하지만, spec-sync-audit 이 §2.1·§3·§4.1·Rationale 를 수정하는 동안 동일 파일에 target 이 병합되면 3-way merge 충돌 리스크가 있다. target 자체가 이 위험을 인지하고 "병합 시 순서 직렬화/리베이스 확인" 을 명기했으나, 이를 plan 상의 "주의" 수준이 아닌 **직렬화 강제** 로 관리해야 한다. spec-sync-audit PR 이 먼저 머지되지 않으면 target 을 착수해서는 안 된다(worktree 동시 편집 충돌).
- **제안**: spec-sync-audit 의 PR 머지 여부를 target 착수 전 조건(`선행 plan 해소`)으로 target frontmatter 또는 "선행 조건" 절에 명문화. 또는 spec-sync-audit 를 먼저 main 에 합류시킨 뒤 target 브랜치를 리베이스 후 착수.

---

### [CRITICAL] codebase/backend/.env.example 를 system-status-recent-failed-86831b worktree 가 파일 말미에 동시 추가 중

- **target 위치**: target 문서 §§ "병합 순서 주의" + W5 ("backend `.env.example` 에 `WEB_CHAT_WIDGET_ORIGINS=` 추가")
- **관련 plan**: `plan/in-progress/` 에 별도 plan 파일 없음(system-status-recent-failed-86831b 는 inline PR worktree); diff 확인으로 충돌 범위 검증됨
- **상세**: `system-status-recent-failed-86831b` worktree(branch `claude/system-status-recent-failed-86831b`)가 `codebase/backend/.env.example` 파일 말미에 3개 env 키(`SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, `SYSTEM_STATUS_FAILED_SCAN_CAP`, `SYSTEM_STATUS_FAILED_THRESHOLD` 주석 보강)를 추가하는 diff 가 현재 커밋됨. Target 의 W5 도 동일 파일 말미에 `WEB_CHAT_WIDGET_ORIGINS=` 행을 append 한다. 두 worktree 가 동일 파일의 파일 말미를 동시에 수정하므로 merge 시 append 충돌이 발생할 가능성이 높다. target 문서 "병합 순서 주의" 절이 이를 인지했지만 "확인"이라는 표현에 그친다.
- **제안**: target 착수 전 system-status-recent-failed-86831b PR 을 먼저 main 에 합류시킨 뒤 target 브랜치를 리베이스하거나, 두 브랜치의 `.env.example` 변경을 단일 PR 로 통합. 이 항목도 target frontmatter 의 `선행 조건` 으로 명문화 필요.

---

### [WARNING] channel-web-chat-followups.md 에서 show/hide/updateProfile 는 "project-planner 선행 설계 필요" 로 표기됐는데 target 이 설계를 완료하고 있음

- **target 위치**: 섹션 4-a / 4-b (show/hide 두 직교 축 전이 규칙, updateProfile shallow-merge 의미 등)
- **관련 plan**: `plan/in-progress/channel-web-chat-followups.md` §4 [연관] 항목 — "show/hide(런처 가시성)는 1-widget-app §3 상태기계에 런처 visible/hidden 상태 추가가 선행돼야 하고(project-planner), updateProfile 는 진행 중 세션 profile 갱신 의미 정의 필요"
- **상세**: channel-web-chat-followups 는 show/hide 와 updateProfile 의 **설계 미정** 을 명시하며 project-planner 선행을 요구했다. target 은 그 설계를 이 draft 에서 완성하는데(직교 2축 전이·BLOCKED 구분·updateProfile shallow-merge/소급불가), target 자체의 Rationale 가 "show/hide 를 open/close 와 직교 2축으로 둔 건 **2-sdk §R4(이미 합의)** 의 위젯측 반영 — 신규 결정 아님" 이라고 설명한다. spec/7-channel-web-chat/2-sdk.md §R4 를 확인한 결과 R4 는 이 분리를 Rationale 로 이미 명시하고 있다. 따라서 channel-web-chat-followups 가 "의미 정의 필요" 로 열어 둔 항목이 사실 2-sdk.md §R4 에서 이미 결정됐음을 target 이 더 명확히 연결짓는 것이다. 이는 미해결 결정을 일방적으로 우회하는 것이 아니라 기존 합의의 위젯 반영이지만, channel-web-chat-followups 가 여전히 "[project-planner 선행] 설계 미완" 으로 열린 상태(체크박스 미완)이므로 해당 plan 의 [연관] 항목을 "설계 완료(target draft 참조)" 로 갱신하지 않으면 추적 불일치가 남는다.
- **제안**: target draft 가 spec 에 반영되면 channel-web-chat-followups.md §4 의 [연관] 항목을 "완료(spec-draft-channel-web-chat-gaps.md §4-a/4-b 반영)" 로 업데이트하거나, target 의 frontmatter 또는 후속 절에 "channel-web-chat-followups §4 [연관] 항목을 완료 처리 필요" 를 명기.

---

### [WARNING] 1-widget-app.md 의 `pending_plans` 에 target 작업 반영 누락

- **target 위치**: target 전체 (W1: §3.1 SSE 재연결 추가, W2: §3 신설, §4-a: §2/§3 런처 가시성 축 추가)
- **관련 plan**: `spec/7-channel-web-chat/1-widget-app.md` frontmatter `pending_plans` — 현재 `channel-web-chat-impl.md` 와 `channel-web-chat-followups.md` 만 등재
- **상세**: target draft 는 1-widget-app.md §2·§3·§3.1 을 실질적으로 수정한다(SSE 재연결 절차 추가·런처 가시성 2축 상태기계 추가). 1-widget-app.md 는 `status: partial` 이며 현재의 `pending_plans` 에 본 draft 를 책임지는 plan 이 등재되지 않는다. draft 가 실제 spec 에 반영되면 `pending_plans` 갱신 또는 완료 처리 흐름이 필요하나, 이 책임이 어느 plan 에 있는지 추적되지 않는다.
- **제안**: target spec-draft plan 의 후속 절에 "spec 반영 완료 시 1-widget-app.md pending_plans 에서 관련 항목 갱신(또는 spec-draft plan 을 pending_plans 에 등재 후 complete 이동 시 승격 확인)" 을 명기.

---

### [INFO] channel-web-chat-demo.md 후속 W1~W5 가 target 으로 이관됐으나 channel-web-chat-demo plan 에 cross-ref 없음

- **target 위치**: 전체 (W1~W5 + 섹션 4)
- **관련 plan**: `plan/in-progress/channel-web-chat-demo.md` §"후속(project-planner, 본 PR 밖)" — W1~W5 체크박스 열거
- **상세**: channel-web-chat-demo.md 의 후속 W1~W5 체크박스가 target draft(spec-draft-channel-web-chat-gaps.md)로 이관됐으나, channel-web-chat-demo.md 는 이를 체크 완료하거나 cross-ref 로 연결하지 않아 중복 추적이 남아있다. target 이 머지되면 channel-web-chat-demo.md 의 W1~W5 체크박스 5개를 완료(또는 "→ spec-draft-channel-web-chat-gaps.md") 처리해야 한다.
- **제안**: spec-draft 착수 또는 완료 시 channel-web-chat-demo.md 의 W1~W5 체크박스를 업데이트.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 식별: spec-sync-audit (spec/conventions/spec-impl-evidence.md), system-status-recent-failed-86831b (codebase/backend/.env.example).

두 worktree 모두 stale 판정 cascade 를 실행했으나 stale 아님:

- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1: `git merge-base --is-ancestor` → ACTIVE (exit 1). Step 2: `gh pr list` → empty (PR 미등록 또는 조회 실패). Step 3: active 로 처리. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.
- `system-status-recent-failed-86831b` (branch `claude/system-status-recent-failed-86831b`) — Step 1: `git merge-base --is-ancestor` → ACTIVE (exit 1). Step 2: `gh pr list` → empty. Step 3: active 로 처리. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.

**stale skip 건수: 0건** (worktree 충돌 후보 2건 모두 active 로 분류 → CRITICAL 보고).

---

## 요약

target(`spec-draft-channel-web-chat-gaps.md`)은 `channel-web-chat-demo.md` 의 후속 W1~W5 + show/hide/updateProfile 설계를 project-planner 위임으로 다루는 적절한 scope 의 spec draft 이다. 미해결 결정 우회 관점에서 show/hide 설계는 2-sdk §R4(기합의)의 위젯측 반영이라 심각한 충돌은 없다. 그러나 두 개의 **active worktree 충돌**이 확인됐다: (1) `spec-sync-audit` 가 `spec/conventions/spec-impl-evidence.md` 를 광범위하게 수정 중이며 W3 의 §1 추가와 동일 파일 경합, (2) `system-status-recent-failed-86831b` 가 `codebase/backend/.env.example` 파일 말미에 동시 추가 중이며 W5 의 append 와 충돌 가능. 두 항목 모두 target 문서 자체가 "병합 순서 직렬화 확인" 으로 인지하나 plan 상의 착수 선행 조건으로 명문화되지 않아 CRITICAL 으로 분류. WARNING 2건(channel-web-chat-followups show/hide 추적 불일치, 1-widget-app pending_plans 누락)은 plan 갱신으로 해소 가능하다. worktree 충돌 후보 2건 중 stale 0건, active 2건 분석.

---

## 위험도

**HIGH**

(active worktree 2건 충돌로 인한 CRITICAL 2건 포함. 두 선행 worktree 가 main 에 합류된 뒤 target 착수·리베이스 시 HIGH → LOW 로 해소 가능.)
