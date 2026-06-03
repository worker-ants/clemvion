# 유저 가이드 동반 갱신(User Guide Sync) 리뷰 결과

## 발견사항

### [CRITICAL] spec/conventions/user-guide-evidence.md — pending_plans 경로 실존 불이행

- 변경 파일: `spec/conventions/user-guide-evidence.md`
- 매트릭스 항목: `spec-major-change` — "frontmatter `code:` / `status:` / `pending_plans:` 정합 갱신 / `status: partial` 이면 `pending_plans:` 의 plan 신설 / `status: implemented` 이면 `code:` 글로브 ≥1 매치 보장"
- 누락된 동반 갱신: `plan/in-progress/spec-sync-user-guide-evidence-gaps.md` (파일 미존재)
- 상세: 이 diff 에서 `status: implemented` → `status: partial` 로 강등하고 `pending_plans: - plan/in-progress/spec-sync-user-guide-evidence-gaps.md` 를 추가했다. `spec/conventions/spec-impl-evidence.md` §3 가드(`spec-pending-plan-existence.test.ts`)는 `pending_plans:` 의 모든 경로가 `plan/in-progress/` 또는 `plan/complete/`(in-progress→complete 치환) 에 실존해야 한다고 강제한다. 현재 해당 파일이 두 경로 모두에 부재해 가드가 fail 한다. 사용자 영향: CI `spec-pending-plan-existence.test.ts` fail → 빌드 차단.
- 제안: `plan/in-progress/spec-sync-user-guide-evidence-gaps.md` 를 동일 변경 set 안에서 신설한다. 최소 내용은 spec 에서 partial 로 남긴 gap (user-guide-writer agent 에 ImplAnchor 체크리스트 미등재, `api-endpoint` kind NestJS 데코레이터·path 검증 미구현) 을 책임 plan 으로 기술하는 frontmatter + 본문이면 충분하다.

---

### [WARNING] spec/conventions/user-guide-evidence.md — 유저 가이드 docs MDX 동반 갱신 미확인

- 변경 파일: `spec/conventions/user-guide-evidence.md`
- 매트릭스 항목: `userguide-gui-flow-section` — "user-guide GUI 흐름 절 신규/변경 (`02-nodes/**.mdx`, `06-integrations-and-config/**.mdx`)" → `<ImplAnchor kind="ui-entry">` 동반 작성 + impl-anchor 가드
- 누락된 동반 갱신: 확인 불필요 (이 파일 자체가 spec convention — docs MDX 가 아님). 단, 이 변경에서 `chatChannelCheckbox` → `chatChannelProvider` 로 symbol 이 변경됐다. 만약 이 심볼이 `02-nodes/triggers.mdx` 또는 `06-integrations-and-config/*.mdx` 의 `<ImplAnchor>` 에 직접 참조된다면 해당 MDX 도 동반 갱신이 필요하다.
- 상세: `user-guide-evidence.md` 내 두 곳에서 `symbol="chatChannelCheckbox"` → `symbol="chatChannelProvider"` 로 변경됐다. 이 값이 `impl-anchor-existence.test.ts` 의 grep 검증 대상(실제 프론트엔드 파일에 substring 으로 등장해야 함)을 통과하는지, 그리고 동일 symbol 명이 MDX 파일의 `<ImplAnchor>` 속성에도 쓰이는지 확인이 필요하다. grep 가드가 통과하면 docs MDX 별도 변경은 불필요하지만, 통과 못 하면 WARNING 수준의 가이드 불일치가 발생한다.
- 제안: `cd codebase/frontend && npm test -- impl-anchor-existence` 를 실행해 chatChannelProvider symbol 이 `codebase/frontend/src/app/(main)/triggers/page.tsx` 에 substring 으로 존재하는지 확인한다.

---

### [INFO] spec/data-flow/2-auth.md / spec/data-flow/12-workspace.md — 인증·워크스페이스 흐름 spec 변경, 유저 가이드 연동 해당 없음

- 변경 파일: `spec/data-flow/2-auth.md`, `spec/data-flow/12-workspace.md`
- 매트릭스 항목: `auth-session-flow-change` — trigger 는 `codebase/backend/src/modules/auth/**` 백엔드 코드 변경일 때 적용. 이번 변경 set 은 spec 문서만 수정했으며 backend auth 코드는 변경되지 않았다.
- 판정: 해당 없음. spec-only 갱신이며 백엔드 코드 트리거가 아니다. `07-workspace-and-team/` 유저 가이드 동반 갱신 의무가 발생하지 않는다.

---

### [INFO] spec/data-flow/** (data-flow 디렉토리) — spec-major-change 글로브 미매칭

- 변경 파일: `spec/data-flow/0-overview.md`, `1-audit.md`, `10-triggers.md`, `11-workflow.md`, `12-workspace.md`, `2-auth.md`, `3-execution.md`, `4-file-storage.md`, `5-integration.md`, `7-llm-usage.md`, `8-notifications.md`
- 매트릭스 항목: `spec-major-change` trigger glob 은 `spec/2-*/**`, `spec/3-*/**`, `spec/4-*/**`, `spec/5-*/**`, `spec/conventions/**` 이다. `spec/data-flow/` 는 어느 glob 에도 매칭되지 않는다.
- 판정: 유저 가이드 동반 갱신 매트릭스상 trigger 없음. 해당 없음으로 처리. (단, `spec/data-flow/` 를 매트릭스 trigger 에 포함시켜야 하는지는 별도 spec defect 검토 대상 — 본 리뷰 범위 외)

---

## 요약

매트릭스 총 19개 trigger 행 중 이번 변경 set 에 매칭되는 행은 `spec-major-change`(spec/conventions/** glob) 1개다. 나머지 행들(new-node, node-schema-change, new-ui-string, auth-session-flow-change, expression-language-change 등)은 백엔드/프론트엔드 코드 변경이 없어 매칭되지 않는다. 매칭된 1개 trigger 에서 누락 1건 발견: `spec/conventions/user-guide-evidence.md` 가 `status: partial` 로 강등되며 `pending_plans:` 에 `plan/in-progress/spec-sync-user-guide-evidence-gaps.md` 를 선언했으나 해당 파일이 `plan/in-progress/` 및 `plan/complete/` 어디에도 미존재해 `spec-pending-plan-existence.test.ts` 가드 fail 이 예상된다. 이 1건은 CI 차단 수준의 CRITICAL이다.

## 위험도

CRITICAL
