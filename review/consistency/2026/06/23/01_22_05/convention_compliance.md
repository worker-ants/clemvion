# 정식 규약 준수 검토 결과

검토 대상: `spec/3-workflow-editor` (5개 파일 + `_product-overview.md`)
검토 기준: `spec/conventions/spec-impl-evidence.md`, `spec/conventions/swagger.md`, `spec/conventions/error-codes.md`, `spec/conventions/audit-actions.md`, CLAUDE.md 문서 구조 규약

---

## 발견사항

### [INFO] `3-execution.md` 섹션 번호 불연속 (§3.4 → §3.6, §3.5 누락)

- target 위치: `spec/3-workflow-editor/3-execution.md` §3.4(Form 노드 대기 상태) 다음 §3.6(AI Agent Multi Turn)으로 건너뜀. §3.5가 없음
- 위반 규약: CLAUDE.md "문서 구조 규약" — 명시적 금지 항목은 아니지만 목차 일관성 훼손
- 상세: `## 3.4 Form 노드 대기 상태` 이후 곧바로 `## 3.6 AI Agent Multi Turn 대기 상태`가 등장하여 §3.5가 존재하지 않음. 이후 `## 3.5 실행 실패`가 다시 나타나, 번호 순서가 3.4 → 3.6 → 3.5 순으로 역전됨
- 제안: §3.6 AI Agent Multi Turn 을 §3.5로 재번호하고, 기존 §3.5 실행 실패를 §3.6으로 순서 정렬할 것

---

### [INFO] `4-ai-assistant.md` `code:` 경로에 glob 패턴 혼용 일관성 미흡

- target 위치: `spec/3-workflow-editor/4-ai-assistant.md` frontmatter `code:` 필드
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 glob 허용. 명시적 위반은 아님
- 상세: `codebase/backend/src/modules/workflow-assistant/**/*.ts` 는 `**/*.ts` glob 형태이나, `codebase/frontend/src/components/editor/assistant-panel/*.ts` 와 `*.tsx` 는 별도로 나뉜 2개 엔트리로 각각 선언됨. `*.{ts,tsx}` 또는 `**/*.{ts,tsx}` 로 통합 가능. 기능적으로는 두 경로 모두 매치되므로 가드 통과에는 문제 없음
- 제안: `codebase/frontend/src/components/editor/assistant-panel/*.{ts,tsx}` 한 줄로 통합하거나 현행 유지 (가드 통과 기준상 문제 없으므로 INFO 수준)

---

### [INFO] `0-canvas.md` `pending_plans:` 항목 `spec-sync-canvas-gaps.md` 실존 여부 확인 권장

- target 위치: `spec/3-workflow-editor/0-canvas.md` frontmatter `pending_plans:`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 가 `pending_plans:` 모든 path 의 `plan/in-progress/` 또는 `plan/complete/` 실존을 강제
- 상세: `plan/in-progress/spec-sync-canvas-gaps.md` 와 `plan/in-progress/ai-agent-tool-connection-rewrite.md` 가 선언됨. 빌드 가드가 자동 검증하므로 CI 단에서 실패 시 발견되나, 본 검토에서 파일 존재 여부를 직접 확인하지 못함. CI 통과 여부로 준수 확인 가능
- 제안: `pnpm --filter frontend test -- spec-pending-plan-existence` 실행으로 실존 확인

---

## 요약

`spec/3-workflow-editor` 6개 파일(실질 검토 5개 + `_product-overview.md` 면제)은 `spec/conventions/spec-impl-evidence.md`의 핵심 규약을 전반적으로 준수하고 있다. 모든 대상 파일에 `id`/`status` frontmatter가 존재하고, `status: partial` 파일(`0-canvas.md`, `2-edge.md`)은 `pending_plans:`를 정상 선언했으며, `status: implemented` 파일들은 `code:` glob이 ≥1 매치되는 경로를 보유한다. `_product-overview.md`는 밑줄 prefix로 frontmatter 의무에서 올바르게 면제된다. 에러 코드(`spec/conventions/error-codes.md`)·감사 액션(`audit-actions.md`)·Swagger(`swagger.md`) 규약은 이 spec 파일들의 직접 적용 대상이 아니라 구현 코드 측 규약으로, 본 문서 검토 범위 밖이다. 발견된 사항은 `3-execution.md`의 섹션 번호 역전(3.4→3.6→3.5)과 `4-ai-assistant.md` frontmatter의 glob 중복 선언 두 가지 모두 INFO 수준이며, 가드 차단이나 invariant 파괴에는 해당하지 않는다.

## 위험도

LOW
