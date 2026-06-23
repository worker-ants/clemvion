# Plan 정합성 검토 결과

검토 모드: --impl-done (구현 완료 후)
Target 영역: `spec/7-channel-web-chat/`
관련 plan: `plan/in-progress/web-chat-console.md` (primary), `channel-web-chat-impl.md`, `channel-web-chat-followups.md`, `webchat-eager-start.md`, `fix-webchat-sse-field-map.md`

---

## 발견사항

### [INFO] Phase 1 빌드 파이프라인이 증분 2 계획 대비 증분 1 PR 에 선구현됨

- target 위치: diff `codebase/frontend/scripts/copy-widget.mjs` (신규), `package.json build:widget`, `.gitignore /public/_widget/`
- 관련 plan: `plan/in-progress/web-chat-console.md §증분 전략` — "증분 2(후속 PR): Phase 1 위젯 동봉 빌드 파이프라인(workspace dep + `out/` 복사) + Phase 3 라이브 미리보기"
- 상세: plan의 "증분 전략" 절은 Phase 1(동봉 빌드 파이프라인)과 Phase 3(라이브 미리보기)을 "후속 PR"로 분리하기로 명시했으나, 실제 diff에는 두 항목이 모두 포함되어 있다. 단, plan 본문의 Phase 1·Phase 3 체크박스는 이미 `[x]`(완료)로 업데이트되어 있어 plan 자체가 최신 상태를 반영하는 것으로 보인다. "증분 전략" 절의 구분만 구식 상태로 남아 있다.
- 제안: plan의 `## 증분 전략` 절을 실제 구현 결과(증분 1 = Phase 2 코어 + Phase 1 env 유틸, 증분 2 = Phase 1 동봉 파이프라인 + Phase 3 미리보기)로 사후 갱신하면 이력이 명확해진다. 차단 사유는 아니다.

### [INFO] `web-chat-console.md` Phase 4 미완 항목 — e2e / user guide

- target 위치: `plan/in-progress/web-chat-console.md §Phase 4`
- 관련 plan: 동일 plan — `[ ] docker e2e: 환경 차단`, `[ ] user guide 페이지 신규 작성`
- 상세: 두 항목이 미완(`[ ]`)으로 남아 있으며 이는 plan이 `in-progress` 상태를 유지해야 하는 근거다. target spec·구현과 직접 충돌은 없다. e2e는 환경 차단으로 명시 유예, user guide는 증분 2 완성 시 작성 예정으로 이월 추적 중.
- 제안: 추적 메모 수준. plan 이동(complete) 전에 user guide 항목 처리가 필요함을 명시.

### [INFO] `spec/7-channel-web-chat/5-admin-console.md` pending_plans 항목이 worktree-local plan 파일를 가리킴

- target 위치: `spec/7-channel-web-chat/5-admin-console.md` frontmatter `pending_plans: - plan/in-progress/web-chat-console.md`
- 관련 plan: `plan/in-progress/web-chat-console.md` — 현재 worktree(`webchat-console-95fe1e`)에만 존재, origin/main 미존재
- 상세: `web-chat-console.md`는 현재 worktree에서 생성된 파일이라 spec frontmatter의 `pending_plans` 참조가 main 머지 후에야 진실이 된다. 머지 전에는 `spec-pending-plan-existence` 가드가 실패할 가능성이 있다. 단, plan 파일과 spec이 같은 PR에서 동시에 머지되므로 머지 후에는 문제가 해소된다.
- 제안: 머지 시점에 plan-lifecycle 가드가 정상 통과하는지 확인. 별도 액션 불필요.

### [INFO] `fix-webchat-sse-field-map.md`의 EIA §6.2 abstract 블록 교체 backlog — target spec과 미해소 drift 유지

- target 위치: `spec/7-channel-web-chat/0-architecture.md §3` SSE wire 필드 note
- 관련 plan: `plan/in-progress/fix-webchat-sse-field-map.md §비차단 followup` — "EIA §6.2 abstract jsonc 블록은 notification 형태 유지 + SSE wire note 추가로 보완함. 추상 블록 자체를 wire 로 교체하는 정식 EIA 이슈는 backlog"
- 상세: target spec의 `0-architecture §3`이 SSE wire 필드명 note를 명시하고 있어 현재 위젯 구현과 일치하나, EIA §6.2(notification 형태 abstract)와의 drift는 여전히 미해소 backlog 상태다. 이는 본 PR scope 밖이며 기존 followup에서 추적 중.
- 제안: 추적 메모. 본 target 변경이 이 backlog를 무효화하거나 가중시키지 않음.

---

## 요약

Plan 정합성 관점에서 심각한 위반 사항은 발견되지 않았다. `web-chat-console.md`의 핵심 결정(위젯 동봉 co-deploy + same-origin 미리보기 + self-origin 기본값)이 target spec과 구현 diff에 일관되게 반영되어 있다. plan의 "증분 전략" 절이 실제 구현 범위보다 구식으로 남아 있으나 이는 이력 기록상의 불일치일 뿐 결정 충돌이 아니다. 미해결 항목(e2e, user guide)은 plan에 명시적으로 이월 처리되어 있으며 target spec·구현과 직접 충돌하지 않는다.

---

## 위험도

LOW
