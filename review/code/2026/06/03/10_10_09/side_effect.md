# 부작용(Side Effect) 리뷰

리뷰 대상: consistency-check 산출물(review/consistency/2026/06/03/09_46_31/) + spec 파일 변경 4건

---

## 발견사항

### [WARNING] `spec/conventions/spec-impl-evidence.md` §1 inclusive list 에 `spec/7-channel-web-chat/**.md` 추가 — build-time 가드 즉시 활성
- 위치: `spec/conventions/spec-impl-evidence.md` diff +1줄 (§1 목록)
- 상세: 이 파일은 `spec-frontmatter.test.ts` / `spec-code-paths.test.ts` / `spec-status-lifecycle.test.ts` / `spec-pending-plan-existence.test.ts` 4개 build-time 가드의 적용 대상 목록 SoT다. `spec/7-channel-web-chat/**.md` 를 추가하는 순간, 해당 경로의 모든 spec 파일에 대해 4개 가드가 즉시 적동된다. 현재 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 배열은 아직 이 prefix 를 포함하지 않는다. 두 곳이 비동기 상태로 병합되면 spec-impl-evidence.md 의 §1 텍스트와 실제 파서 가드 간 불일치가 발생해 가드가 의도한 대상을 검사하지 않거나 예상치 못한 fail 이 생길 수 있다.
- 제안: `spec-impl-evidence.md §1` 변경과 `spec-frontmatter-parse.ts INCLUDE_PREFIXES` 배열 추가를 **동일 커밋(또는 동일 PR)** 에 묶어야 한다. 이 변경이 단독 머지되면 4개 가드의 적용 범위와 파서 실제 범위가 일시적으로 분리된다.

---

### [WARNING] `spec/7-channel-web-chat/1-widget-app.md` frontmatter `pending_plans` 에 `channel-web-chat-demo.md` 추가 — spec-pending-plan-existence 가드 즉시 영향
- 위치: `spec/7-channel-web-chat/1-widget-app.md` diff, frontmatter `pending_plans` +1줄
- 상세: `spec-pending-plan-existence.test.ts` 는 `pending_plans:` 의 모든 경로가 `plan/in-progress/` 에 실존하는지를 강제한다. `channel-web-chat-demo.md` 가 아직 `plan/in-progress/` 에 있는지 이 리뷰 시점에 확인되지 않는다(diff 에 해당 plan 파일 자체의 변경은 없음). 만약 해당 plan 이 `plan/complete/` 로 이동돼 있거나 존재하지 않으면, 이 spec 변경이 머지된 직후 `spec-pending-plan-existence.test.ts` 가 실패한다.
- 제안: 머지 전 `plan/in-progress/channel-web-chat-demo.md` 실존 여부를 확인한다. 이미 complete 된 plan 이라면 `pending_plans` 에 추가하는 것은 부적절하며, 대신 `spec-draft-channel-web-chat-gaps.md` 를 등재하는 방향이 맞다.

---

### [INFO] `spec/conventions/spec-impl-evidence.md` 변경 — `spec-sync-audit` worktree 와 동일 파일 동시 수정
- 위치: `spec/conventions/spec-impl-evidence.md` diff
- 상세: plan_coherence 리뷰에서 이미 CRITICAL 로 보고됐듯이, `spec-sync-audit` worktree(branch `claude/spec-sync-audit`)가 동일 파일의 §2.1·§3·§4.1·Rationale 를 수정 중이다. 본 변경은 §1 만 수정이라 내용 충돌 가능성은 낮으나, 3-way merge 시 git diff context 겹침으로 merge conflict 가 발생할 수 있다. 이 부작용은 실제 코드/런타임 부작용이 아니라 merge 시점 파일시스템 부작용이다.
- 제안: `spec-sync-audit` PR 먼저 main 에 합류시킨 뒤 리베이스.

---

### [INFO] `review/consistency/2026/06/03/09_46_31/_retry_state.json` — 하드코딩된 절대 경로
- 위치: `review/consistency/2026/06/03/09_46_31/_retry_state.json` 전체
- 상세: `session_dir`, `prompt_file`, `output_file` 필드가 `/Volumes/project/private/clemvion/...` 로 머신 로컬 절대경로를 하드코딩한다. 이 파일이 다른 개발자 머신 또는 CI 환경에서 retry 재개 입력으로 사용될 경우 경로가 유효하지 않아 오케스트레이터가 오동작한다. 현재는 review 아카이브용 기록 파일이므로 런타임 부작용은 없으나, 향후 같은 패턴이 실제 재시도 실행 경로에서 쓰이면 부작용이 된다.
- 제안: 이미 완료 후 기록이라 즉각 수정 불필요. 오케스트레이터 패턴이 절대경로를 상대경로 또는 환경변수 기반으로 전환하는 것을 향후 개선 항목으로 고려.

---

### [INFO] `spec/7-channel-web-chat/4-security.md` 본문 §3-① 서술 변경 — `blocked` 상태명 및 `1-widget-app §3.2` cross-ref 추가
- 위치: `spec/7-channel-web-chat/4-security.md` diff, §3-① 불일치 시 렌더 거부 문구 수정
- 상세: 기존 "불일치 시 렌더 거부 + 시작 차단" 문구에 "위젯 상태 `blocked` — host `show` 로도 해제되지 않는 정책 거부, [1-widget-app §3.2]" 를 추가했다. 이는 spec 텍스트 레벨 변경이고 코드 동작에 직접 영향을 주지 않는다. 단, `1-widget-app §3.2` 에서 back-reference 하고 있으므로 두 파일이 동시에 일관된 상태로 존재해야 한다. 이번 변경에서 두 파일이 함께 수정됐으므로 정합 문제는 없다.
- 제안: 이상 없음.

---

### [INFO] `spec/7-channel-web-chat/0-architecture.md` §4 — `WEB_CHAT_WIDGET_ORIGINS` env 키 명시
- 위치: `spec/7-channel-web-chat/0-architecture.md` diff +2줄
- 상세: 이미 코드에 구현된 env 키를 spec 에 뒤늦게 등재하는 것이므로 런타임 부작용 없음. `4-security.md §2.1` 이 동일 env 키를 명시하는 변경도 이번 diff 에 포함되어 두 spec 에 동시에 반영됐다. SoT 분리가 양쪽에 명시돼 있어 이중 진실 문제는 없다.
- 제안: 이상 없음.

---

## 요약

이번 변경의 핵심 부작용 위험은 두 곳에 집중된다. 첫째, `spec/conventions/spec-impl-evidence.md §1` 에 `spec/7-channel-web-chat/**.md` 를 추가하면 4개 build-time 가드가 해당 경로 전체에 즉시 적용되는데, `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 배열이 아직 갱신되지 않아 가드 범위와 파서 범위가 일시적으로 분리된다. 이 두 변경은 반드시 동일 PR 에 묶여야 한다. 둘째, `1-widget-app.md` 의 `pending_plans` 에 `channel-web-chat-demo.md` 를 추가하는 것이 `spec-pending-plan-existence.test.ts` 를 즉시 강제하므로, 해당 plan 파일이 `plan/in-progress/` 에 실존하는지 머지 전 확인이 필요하다. 나머지 변경(consistency review 산출물, spec 서술 보강, Rationale 신설)은 문서 레이어 변경으로 런타임·코드 부작용이 없다.

---

## 위험도

MEDIUM

(build-time 가드 적용 범위 분리 및 pending_plans 실존 미확인 2건. 두 건 모두 파일 묶음 조정 또는 사전 확인으로 머지 전 해소 가능.)

STATUS: SUCCESS
