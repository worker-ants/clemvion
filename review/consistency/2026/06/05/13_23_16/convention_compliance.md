# 정식 규약 준수 검토 결과

검토 범위: `git diff 7afa9ae0..HEAD` (worktree: `memory-backlog-a2-fe9c8f`)
변경 파일: `spec/5-system/17-agent-memory.md` (§6 pagination 문구 추가),
           `plan/in-progress/memory-backlog-grooming.md` (신규),
           `codebase/backend/src/nodes/ai/ai-agent/ai-agent.schema.ts`,
           `codebase/backend/src/modules/agent-memory/agent-memory.service.ts` 외
검토 규약: `spec/conventions/` 전체, `.claude/docs/plan-lifecycle.md`

---

## 발견사항

### [WARNING] `spec/5-system/17-agent-memory.md` frontmatter — `pending_plans` 가 완료된 plan을 여전히 참조

- target 위치: `spec/5-system/17-agent-memory.md` frontmatter L6-9
- 위반 규약: `spec/conventions/spec-impl-evidence.md §3 partial 전이 규칙` — `pending_plans:` 의 모든 path 가 `plan/in-progress/` 또는 `plan/complete/`(치환) 에 실존해야 하고, `partial` → `implemented` 전이 조건은 "마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격"
- 상세: 현 worktree의 `17-agent-memory.md` frontmatter는 `pending_plans`로 세 개를 등재한다:
  1. `plan/in-progress/ai-context-memory-followup-v2.md` — 실존
  2. `plan/in-progress/agent-memory-admin-ui.md` — worktree 내 실존하나, `agent-memory-admin-ui` PR은 이미 main에 머지 완료된 것으로 보임 (diff에서 해당 plan이 삭제 대상으로 나타남). 이 plan이 `plan/complete/`로 이동하지 않고 worktree에 `in-progress/`로 남아있으면 spec-pending-plan-existence 가드가 main 머지 시점에 오염될 수 있음.
  3. `plan/in-progress/agent-memory-summary-model.md` — 동일 우려.
  본 diff(`7afa9ae0..HEAD`)에서 이 두 plan은 삭제되고 `17-agent-memory.md` `pending_plans`에서도 제거됐으나, worktree 작업 파일(`HEAD`)에는 여전히 등재되어 있다. 이 worktree가 main에 머지될 때 해당 plan 파일이 `plan/in-progress/`에 존재하지 않으면 `spec-pending-plan-existence.test.ts` 가드가 실패한다.
- 제안: PR이 main에 머지되기 전 `agent-memory-admin-ui.md`·`agent-memory-summary-model.md`가 `plan/complete/`로 이동(또는 이미 다른 PR에서 삭제됨)을 확인하고, `17-agent-memory.md` frontmatter의 `pending_plans` 목록에서도 제거하거나 complete 경로로 교체한다. `memory-backlog-grooming.md` 자체는 현재 `in-progress`이므로 `pending_plans` 등재 여부를 아래 INFO 참조.

---

### [WARNING] `plan/in-progress/memory-backlog-grooming.md` — `spec` 필드명이 비표준

- target 위치: `plan/in-progress/memory-backlog-grooming.md` frontmatter L8-9
- 위반 규약: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마` — 필수 필드는 `worktree`·`started`·`owner` 세 개이며, 추가 필드는 `priority`/`status`/`title` 예시로 열거. `spec:` 라는 키는 plan frontmatter 표준 예시에 없고, `spec/conventions/spec-impl-evidence.md §2.2`에서 user-guide MDX의 `spec:` 필드(가이드가 설명하는 spec 경로)와 이름이 충돌한다.
- 상세: `memory-backlog-grooming.md`에 `spec:` 키와 `code:` 키가 모두 있다. `code:` 필드는 plan-lifecycle에서 공식 예시가 없으나 spec frontmatter와 동명 키를 plan에 쓰는 것은 `spec-impl-evidence.md §2.2`가 경고한 "의미 도메인 혼동"과 동형이다. 특히 `spec:` 키는 user-guide MDX에서 "이 가이드가 설명하는 spec 파일"로 쓰이는 동명 키라 plan frontmatter에서 사용 시 가드·파서 가독성 혼란을 유발할 수 있다.
- 제안: plan frontmatter의 `spec:` 키를 `spec_ref:` 또는 `related_spec:` 등으로 리네임해 user-guide MDX의 `spec:` 와 네임스페이스를 분리한다. 단 규약 자체가 "추가 필드 허용"이므로 build 차단은 없다 — 규약 갱신(plan-lifecycle §4에 `spec_ref` 예시 추가)을 함께 권장.

---

### [INFO] `spec/5-system/17-agent-memory.md §6` — `pending_plans`에 `memory-backlog-grooming.md` 미등재

- target 위치: `spec/5-system/17-agent-memory.md` frontmatter `pending_plans` 목록
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 시 `pending_plans` 의무. `spec-status-lifecycle.test.ts`는 "partial의 pending_plans 미작성"을 fail로 처리.
- 상세: `memory-backlog-grooming.md`는 `spec: [spec/5-system/17-agent-memory.md]`를 참조하며 §6의 `listScopes` 동작을 명시하는 작업이다. 그러나 `17-agent-memory.md` frontmatter `pending_plans`에는 이 plan이 등재되지 않았다. 현재 `pending_plans`에 다른 plan이 남아있으므로 `partial` 상태는 유지되고 가드 차단은 없다. 단 일관성 측면에서, spec §6을 직접 수정하는 plan이 spec의 `pending_plans`에 연결되지 않으면 역추적이 어려워진다.
- 제안: `17-agent-memory.md` frontmatter에 `plan/in-progress/memory-backlog-grooming.md`를 `pending_plans`에 추가한다 (선택적 개선, build 차단 없음).

---

### [INFO] `spec/5-system/17-agent-memory.md §6` — 추가 문구의 요구사항 태그 누락

- target 위치: `spec/5-system/17-agent-memory.md` §6 L117 (pagination 불릿 추가 줄)
- 위반 규약: 없음 (정식 규약 직접 위반 아님). 문서 내 기존 관행(§6의 각 behavior에 요구사항 ID 태그 `AGM-NN`) 기준.
- 상세: 추가된 `페이지네이션(scopes)` 불릿은 `GET /agent-memories/scopes`의 `total` 의미론을 명확히 하는 spec SoT 문구인데, 기존 `AGM-12`/`AGM-13` 태그 블록에 포함되지 않고 독립 불릿으로만 추가됐다. 이 동작은 `AGM-12`의 확장 명세이므로 `AGM-12` 요구사항 블록에 통합하거나, 기존 `>` 요구사항 블록을 갱신해 "total = COUNT(*) OVER 전체 수, over-page 시 0" 을 포함시키면 추적성이 향상된다.
- 제안: `> 요구사항 AGM-12 — ...` 라인에 `total` 의미론(LIMIT 전 전체 수, over-page = 0)을 추가한다. 또는 현 불릿을 `AGM-12a` 등 서브 태그로 분류한다. 강제 의무 아님.

---

### [INFO] `plan/in-progress/memory-backlog-grooming.md` — 완료 체크리스트 전부 `[x]` 이나 plan이 `in-progress/`에 유지

- target 위치: `plan/in-progress/memory-backlog-grooming.md` 항목 L21-23
- 위반 규약: `.claude/docs/plan-lifecycle.md §2` — 모든 항목이 체크됐으면 `complete/`로 이동 의무
- 상세: 세 항목 모두 `[x]`이고 미해결 follow-up도 없다("보류" 절은 명시적으로 제외한 scope이므로 "미완" 아님). plan-lifecycle §2·§3에 따르면 이 상태에서 plan은 `plan/complete/`로 이동해야 한다. 단, 이동은 "마지막 작업 PR 안에서" 이루어지며 본 diff가 해당 PR의 마지막 commit이라면 이동 commit이 누락된 것이다.
- 제안: 본 PR 마지막 commit에 `chore(plan): mark memory-backlog-grooming complete` + `git mv`로 `plan/complete/`로 이동하고, 완료 시 `spec_impact: [spec/5-system/17-agent-memory.md]`를 frontmatter에 추가한다 (Gate C — `started: 2026-06-05` → cutoff `2026-06-04` 이후이므로 `spec-plan-completion.test.ts` 강제 대상). 단 보류 항목이 있는 한 현 `in-progress` 유지도 합리적 — 보류 항목을 "별도 백로그"로 공식 분리(별 plan 등록)했다면 이동 가능.

---

## 요약

정식 규약 준수 관점에서 이 diff의 주된 위험은 **`spec/5-system/17-agent-memory.md` frontmatter의 `pending_plans` 정합**이다. `agent-memory-admin-ui.md`·`agent-memory-summary-model.md`가 worktree에 `in-progress/`로 남아있으나 이 두 plan이 완료·삭제된 채 main에 머지되면 `spec-pending-plan-existence.test.ts` 빌드 차단이 발생할 수 있다 (WARNING). 신규 plan의 `spec:` 키는 user-guide MDX 동명 필드와 네임스페이스 충돌 우려가 있으나 build 차단은 없다 (WARNING). 나머지 두 항목은 추적성·관행 일관성 제안 수준(INFO)이다. SQL 명명·코드 식별자 명명은 위반 없음. §6 추가 문구 자체의 형식·문체는 기존 spec 문서 관행과 일치한다.

## 위험도

MEDIUM

---

BLOCK: NO
