### 발견사항

- **[WARNING]** 정본 트래커(`spec-sync-external-interaction-api-gaps.md`)의 CRITICAL 항목이 여전히 미체크
  - target 위치: `codebase/frontend/src/lib/websocket/use-execution-events.ts` (`extractNodeErrorPayload` / `handleNodeFailed` / multi-turn `system_error` 배선) — 이 PR 이 실제로 고친 코드
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L206~230 의 `- [ ] 🔴 system_error 재시도 배너가 라이브 WS 경로에서 안 뜬다 …` (`12_24_55` cross_spec **CRITICAL**, "정본 트래커"로 스스로 지칭)
  - 상세: `plan/in-progress/system-error-banner-live-ws.md` 는 이 CRITICAL 항목을 해소하는 작업이며 본문에 "정본 트래커의 🔴 항목"이라고 명시적으로 지목한다. 실제로 코드(`extractNodeErrorPayload` nested 를 `rawOutput.output.error` 2단 접근으로, `handleNodeFailed`/`handleNodeCompleted` 양쪽에 `payload.output` 배선)와 테스트(`CT-S9`/`CT-S10`/`CT-S15`/completed fixture, `95/95` GREEN)가 diff 로 확인되고, `system-error-banner-live-ws.md` 의 체크리스트는 push·PR 까지 전부 `[x]`다. 그런데 `spec-sync-external-interaction-api-gaps.md` (정본 트래커, git log 로 확인 시 이 브랜치에서 **한 번도 수정되지 않음**) 는 해당 항목이 여전히 `- [ ]`(미체크)이고 `system-error-banner-live-ws.md` 로의 역참조도 없다. `eia-terminal-payload.md`(같은 트래커를 "정본"으로 지칭하는 자매 plan) 는 완료 시 "자매 plan 갱신" 체크리스트 항목을 별도로 두어 이 트래커를 동시 갱신했는데, `system-error-banner-live-ws.md` 에는 그런 항목이 없다.
  - 제안: `system-error-banner-live-ws.md` 를 `complete/` 로 옮기는 마무리 커밋에서 `spec-sync-external-interaction-api-gaps.md` 의 `12_24_55` 항목을 `[x]` 로 체크하고 "`system-error-banner-live-ws` 로 해소"라는 역참조를 남길 것.

- **[WARNING]** `spec/conventions/conversation-thread.md` §9.7 위 ⚠️ 스테일 마커가 남아, "코드가 아직 안 고쳐졌다"는 문구가 고쳐진 뒤에도 유지됨
  - target 위치: (변경 없음 — 이번 diff 는 `spec/conventions/conversation-thread.md` 를 건드리지 않았다. `git log origin/main..HEAD -- spec/` 실측: 이 브랜치는 `spec/` 파일을 **0건** 수정)
  - 관련 plan: `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L206~230 의 동일 `12_24_55` 항목 — "**착수 시** 그 문구를 다시 고칠 게 아니라, 코드를 그 문구에 맞추고 §9.7 위의 ⚠️ 블록을 지우면 된다 — 그 블록이 '아직 안 고쳐진 코드'를 가리키는 표지다" 라고 명문 지시
  - 상세: `spec/conventions/conversation-thread.md:578` 의 `> ⚠️ 위 두 행이 프런트 결함을 낳았다 (2026-08-24, 12_42_20 cross_spec CRITICAL): use-execution-events.ts 의 extractNodeErrorPayload 가 이 서술을 코드화해 … 라이브 WS 경로에서 system_error 배너가 한 번도 뜨지 않는다. 코드 수정은 … 별건으로 정본 트래커에 등재돼 있고, 그 작업이 이 두 행의 문구도 함께 검증한다.` 는 블록은 코드가 고쳐지기 **전**을 전제로 쓰여진 임시 표지이며, 마스터 트래커 자신이 "그 작업(=이 PR)이 완료되면 지우라"고 지시했다. `system-error-banner-live-ws.md` 는 frontmatter `spec_impact: none` 을 선언하고 본문에 "spec 은 이미 옳다 … 건드리지 않는다"라고 적었는데, 이는 §4.1-a/§9.7 **본문 내용**이 옳다는 뜻이지 이 **경고 마커**까지 정당화하지 않는다. 코드 수정이 실제로 반영된 지금, 이 마커는 "아직 라이브 WS 배너가 안 뜬다"는 이미 반증된 상태를 계속 주장해 향후 독자를 오도한다.
  - 제안: `system-error-banner-live-ws.md` 마무리 시(또는 `spec-sync-external-interaction-api-gaps.md` 체크 시 동반) `conversation-thread.md:578` 의 ⚠️ 블록을 제거하거나 "해소됨(PR: system-error-banner-live-ws)"으로 갱신. 이는 §4.1-a/§9.7-본문의 "8/24 정정 방향"을 되돌리는 것이 아니라 그 정정이 이미 코드에 반영됐음을 표시하는 것이므로, plan 의 "spec 은 건드리지 않는다"는 결정과 충돌하지 않는다.

### 요약
이번 PR(`system-error-banner-live-ws`)이 고친 결함과 스펙 정합성 자체(§4.1-a, §9.7 본문, node-output.md Principle 0)는 완전히 일치하며 CRITICAL 급 충돌은 없다 — 정정된 spec 문구를 코드가 정확히 따라잡았고, 마스터 트래커(`spec-sync-external-interaction-api-gaps.md`)가 사전에 남긴 결함 실측·처방과 diff 가 한 글자도 어긋나지 않는다. 다만 그 마스터 트래커 자신이 남긴 두 개의 명시적 "완료 후 정리" 지시 — (1) 트래커 체크박스 갱신·역참조, (2) `conversation-thread.md` §9.7 위 스테일 ⚠️ 마커 제거 — 가 아직 반영되지 않았다. 둘 다 기능 결정 충돌이 아니라 후속 정리 누락이므로 PR 자체를 막을 사안은 아니지만, `complete/` 로 옮기는 마무리 커밋 전에 처리하지 않으면 "이미 고친 버그를 아직 안 고친 것처럼" 스펙이 계속 말하는 상태가 남는다.

### 위험도
MEDIUM
