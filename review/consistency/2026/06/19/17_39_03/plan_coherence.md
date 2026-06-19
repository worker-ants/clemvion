# Plan 정합성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
Target: `spec/5-system/4-execution-engine.md`

---

## 발견사항

### [WARNING] `pending_plans` 에 완료된 plan 파일 참조 잔류

- **target 위치**: `spec/5-system/4-execution-engine.md` frontmatter `pending_plans:` 4번째 항목 (line 12)
- **관련 plan**: `plan/in-progress/spec-sync-execution-engine-gaps.md` — 이 파일은 `plan/complete/spec-sync-execution-engine-gaps.md` 로 이동 완료됨
- **상세**: spec frontmatter 의 `pending_plans:` 가 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 참조하고 있으나, 해당 파일은 이미 `plan/complete/` 로 이동했다. `plan/complete/spec-sync-execution-engine-gaps.md` 내부에 따르면 §4/§7.1/§8 의 미구현 표면은 전부 `exec-intake-queue-impl.md` 로 forwarding 됐고 항목들이 완료 처리됐다. 잘못된 참조가 frontmatter 유효성 검사(`spec-frontmatter.test.ts` 의 `spec-pending-plan-existence` guard)에서 오탐을 유발할 수 있다.
- **제안**: spec frontmatter 의 `pending_plans:` 에서 `plan/in-progress/spec-sync-execution-engine-gaps.md` 를 제거한다 (project-planner 영역). `exec-intake-queue-impl.md` 와 `execution-engine-residual-gaps.md` 는 여전히 in-progress 이므로 정상 유지.

---

### [INFO] §2.3 Tool Area 노드 처리 — 미해결 결정과 부분 불일치 (비차단)

- **target 위치**: `spec/5-system/4-execution-engine.md §2.3` (line 251–258) 및 §2.1 step 3 (line 207)
- **관련 plan**: `plan/in-progress/ai-agent-tool-connection-rewrite.md` §1 "디자인 결정 (사용자 합의 필요)" — 도구 등록 모델 (a)/(b)/(c), 도구 시그니처 위치, 도구 호출 실행 컨텍스트, 결과 라우팅 전부 TBD
- **상세**: `ai-agent-tool-connection-rewrite.md` 는 Tool Area(`tool_owner_id` 기반 UX 포함) 가 제거된 상태이며 새 도구 연결 모델 설계가 미결정이라고 명시한다. 그러나 execution engine spec §2.1·§2.3 은 `tool_owner_id != null` 노드를 그래프에서 제외하고 on-demand 실행하는 모델을 현행 사양으로 서술하고 있다. 단, `ai-agent-tool-connection-rewrite.md` 는 `(unstarted)` worktree 이고 §3 Spec 작성 전에 §1 결정이 선행되도록 명시돼 있어 plan 이 이미 인지하는 잔류 서술이며, 현시점 C-1 엔진 분할 작업이 §2.3 의 on-demand 실행 경로를 직접 변경하지 않으므로 구현 착수(--impl-prep)와 충돌하지 않는다.
- **제안**: 추적 메모 수준. 새 도구 모델 결정 후 `plan/in-progress/ai-agent-tool-connection-rewrite.md §3 Spec 작성` 단계에서 spec §2.1 step 3·§2.3 을 동기화한다. 해당 plan 의 §3 체크리스트가 이미 포함하므로 별도 조치 불요.

---

### [INFO] `exec-intake-queue-impl.md PR2b` 미완 — 동시성 cap 미구현 상태 spec 표기 정합

- **target 위치**: `spec/5-system/4-execution-engine.md §8` 구현 상태 배너 (line 1039)
- **관련 plan**: `plan/in-progress/exec-intake-queue-impl.md` PR2b (동시성 cap — 미착수)
- **상세**: spec §8 배너가 "워크스페이스/워크플로우 동시 실행 cap·큐 대기 제한은 Planned(PR2b)" 로 올바르게 표기돼 있다. plan 과 spec 상태가 일치한다.
- **제안**: 조치 불요.

---

## 요약

`spec/5-system/4-execution-engine.md` 의 Plan 정합성은 전반적으로 양호하다. 유일한 실질적 이슈는 frontmatter `pending_plans:` 에서 이미 `plan/complete/` 로 이동된 `spec-sync-execution-engine-gaps.md` 를 여전히 `plan/in-progress/` 경로로 참조하고 있다는 점이다 (WARNING). 이는 `spec-pending-plan-existence` 가드 오탐 위험이 있으나 spec 내용 자체의 의미 충돌은 아니다. `ai-agent-tool-connection-rewrite.md` 의 Tool Area 미결정과 spec §2.3 의 Tool Area 기술은 plan 이 이미 인지하는 잔류 서술이며, 현재 착수 중인 C-1 엔진 분할 작업과 직접 충돌하지 않는다. 미해결 결정을 일방적으로 우회하거나 선행 plan 을 무시하는 CRITICAL 수준의 충돌은 발견되지 않았다.

## 위험도

LOW
