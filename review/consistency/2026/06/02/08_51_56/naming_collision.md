# 신규 식별자 충돌 검토 결과

## 발견사항

충돌 또는 잠재적 혼동을 유발할 수 있는 식별자 항목을 관점별로 정리한다.

---

### [INFO] frontmatter `id: error-codes` — 기존 사용처 없음, 신설 안전

- target 신규 식별자: `id: error-codes` (격상 시 `spec/conventions/error-codes.md` frontmatter)
- 기존 사용처: 기존 conventions 에서 `id: error-codes` 를 사용하는 파일 없음. 인접 id 는 `id: error-handling` (`spec/5-system/3-error-handling.md`) 과 `id: error-empty-states` (`spec/2-navigation/11-error-empty-states.md`) 이며 의미가 다르다.
- 상세: 충돌 없음. `error-handling` 은 HTTP 에러 처리 정책(필터·파이프·DTO), `error-codes` 는 명명 규율이라 영역이 명확히 분리된다.
- 제안: 없음.

---

### [INFO] `code:` frontmatter 경로 — `error-codes.ts` 가 기존 spec 의 `code:` 목록에 미포함

- target 신규 식별자: `code: codebase/backend/src/nodes/core/error-codes.ts` (격상 시 frontmatter)
- 기존 사용처:
  - `spec/5-system/3-error-handling.md` `code:` 목록에 `http-exception.filter.ts`, `validation.pipe.ts`, `error-response.dto.ts` 만 등재 — `error-codes.ts` 미포함.
  - `spec/conventions/node-output.md` `code:` 목록에 `node-handler.interface.ts`, `handler-output.adapter.ts` 등재 — `error-codes.ts` 미포함.
- 상세: `error-codes.ts` 는 기존 spec 두 곳에서 참조 prose(`정식 목록은 ... error-codes.ts 의 ErrorCode enum`) 로 언급되지만, 어떤 spec 파일의 `code:` frontmatter 목록에도 올라가 있지 않다. target 이 이를 `code:` 에 포함시키는 것은 새 소유권을 명시하는 것이므로 충돌이 아니라 gap 해소다. 단, 기존 `3-error-handling.md` 의 prose 참조가 해당 파일의 `code:` 에 `error-codes.ts` 가 없는 상태를 암묵적으로 "자신의 관할"처럼 보이게 하고 있어, 격상 후 `3-error-handling.md` 의 prose 를 위임 참조로 교체하지 않으면 이중 소유 인상이 남는다. (이 점은 target draft 의 격상 체크리스트 §4 에서 이미 인지하고 있음.)
- 제안: 격상 체크리스트 4번 항목("`3-error-handling.md` 에 위임 한 줄 추가")이 완료되면 이슈 해소. 추가로 `3-error-handling.md` 의 `code:` 목록에서 `error-codes.ts` 가 여전히 미포함인 상태를 명시적으로 정리(prose 에서 역참조 방식으로 변경)하는 것을 권장.

---

### [INFO] `F-3` 식별자 — 동일 레이블이 완료된 다른 항목에 존재

- target 신규 식별자: `F-3` (plan frontmatter `task: F-3 — 에러 코드 명명 규약 신설`)
- 기존 사용처:
  - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-error-codes-convention-523e2d/plan/complete/cafe24-backlog-done.md` 43번 줄: `[x] F-3: spec/conventions/swagger.md §2-4 실재 확인 + cross-link 7건 정합 + dangling reference 정정 (2026-05-21)` — 다른 task 에 동일 `F-3` 레이블이 이미 존재하며 완료 처리됨.
  - `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-error-codes-convention-523e2d/plan/in-progress/cafe24-backlog-residual.md` 21번 줄: `F-3 follow-up` 으로 target 과 동일 작업을 설명하지만 "F-3" 레이블 자체는 swagger 정합 작업(완료분)에서 유래.
- 상세: `cafe24-backlog-done.md` 의 F-3 은 swagger cross-link 정합 작업 완료 항목이고, `spec-draft-error-codes.md` 의 F-3 은 에러 코드 명명 규약 신설이다. 두 항목이 같은 레이블을 공유하는데, `cafe24-backlog-residual.md` 에서는 "F-3 follow-up" 으로 구분하고 있어 실운영상 혼동이 크지 않다. 그러나 완료 아카이브와 신규 draft 에 동일 task 레이블이 겹치는 것은 추적성 측면에서 불명확하다.
- 제안: target 이 격상 후 `plan/complete/` 로 이동할 때 task 레이블을 `F-3-follow-up` 또는 `F-3b` 등으로 명확화하거나, `cafe24-backlog-residual.md` 와 task 레이블을 통일하는 것을 권장. 기능적 충돌은 없지만 이력 추적을 위해 구분이 유익하다.

---

### [INFO] 파일 경로 — `spec/conventions/error-codes.md` 신설 — 기존 파일 없음, 컨벤션 부합

- target 신규 식별자: `spec/conventions/error-codes.md` (신설 파일 경로)
- 기존 사용처: `spec/conventions/` 에 동명 파일 없음. 기존 파일 목록: `cafe24-api-catalog/`, `cafe24-api-metadata.md`, `cafe24-restricted-scopes.md`, `chat-channel-adapter.md`, `conversation-thread.md`, `cross-node-warning-rules.md`, `data-hydration-surfaces.md`, `execution-context.md`, `i18n-userguide.md`, `interaction-type-registry.md`, `migrations.md`, `node-cancellation.md`, `node-output.md`, `secret-store.md`, `spec-impl-evidence.md`, `swagger.md`, `user-guide-evidence.md`.
- 상세: 충돌 없음. 파일명 `error-codes.md` 는 kebab-case 컨벤션에 부합하고 기존 파일과 겹치지 않는다.
- 제안: 없음.

---

## 요약

target(`plan/in-progress/spec-draft-error-codes.md`) 이 도입하는 신규 식별자(frontmatter `id: error-codes`, `code: codebase/backend/src/nodes/core/error-codes.ts`, 파일 경로 `spec/conventions/error-codes.md`) 는 기존 spec 의 어떤 식별자와도 의미적 충돌이 없다. `id: error-handling` / `id: error-empty-states` 와 이름이 유사하지만 영역이 명확히 분리된다. 단, `code:` frontmatter 의 대상 파일(`error-codes.ts`)이 기존 `3-error-handling.md` 의 prose 에서 비공식적으로 소유하는 것처럼 읽히는 상태이므로, 격상 체크리스트에 이미 포함된 위임 참조 추가 작업 완료 시 이중 소유 인상이 해소된다. `F-3` 레이블이 완료 아카이브의 다른 task 에도 동일하게 사용되고 있으나 실운영 혼동은 크지 않다.

## 위험도

LOW
