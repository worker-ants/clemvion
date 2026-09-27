# Cross-Spec 일관성 검토 — spec draft 2 (cross-workspace-refs)

대상: `plan/in-progress/spec-draft-cross-workspace-refs-2.md`

## 발견사항

- **[CRITICAL]** `spec/1-data-model.md` 는 frontmatter-evidence 가드에서 제외된 파일이다 — 변경안 3이 "가드가 강제한다"고 주장하는 승격 메커니즘이 이 파일에는 애초에 작동하지 않는다
  - target 위치: `plan/in-progress/spec-draft-cross-workspace-refs-2.md` §변경안 3, §Rationale (해당 문단 없음 — 변경안 본문에만 근거 서술)
    > "3. `spec/1-data-model.md` frontmatter `status: implemented` → `partial`, `pending_plans:` 에 같은 경로. … 구현 plan 이 `complete/` 로 옮겨지는 커밋에서 `implemented` 로 되돌린다 — `spec/conventions/spec-impl-evidence.md` §3 이 «마지막 `pending_plans` 가 `complete/` 로 이동한 commit 안에서 승격» 을 가드로 강제한다."
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` §1 "적용 대상" 의 제외 목록 —
    > "basename `1-data-model.md` · `6-brand.md` (단순 overview 성격) — `EXCLUDE_BASENAMES` 에 등재."
    실제 가드 구현 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts` 의 `EXCLUDE_BASENAMES = new Set(["0-overview.md", "1-data-model.md", "6-brand.md"])` 와 `isApplicable()` 이 이를 구현한다. `collectApplicableSpecs()` 를 호출하는 4개 가드(`spec-frontmatter.test.ts` / `spec-code-paths.test.ts` / `spec-status-lifecycle.test.ts` / `spec-pending-plan-existence.test.ts`) 모두 이 필터를 거치므로, `spec/1-data-model.md` 의 frontmatter 는 **어느 가드도 읽지 않는다**.
  - 상세: target 은 "§3 이 승격을 가드로 강제한다" 고 명시적으로 근거를 대며 `1-data-model.md` 의 `status`/`pending_plans` 를 다른 두 문서(`1-workflow-list.md`·`0-canvas.md`)와 같은 방식으로 바꾸려 하지만, 그 가드(`spec-status-lifecycle.test.ts` (c))는 `collectApplicableSpecs()` 결과에서 애초에 `1-data-model.md` 를 걸러낸다 — 즉 `pending_plans` 가 전부 `complete/` 로 옮겨져도 `partial` 로 영원히 남아 있어도 어떤 build 도 실패하지 않는다. 이는 추측이 아니라 **저장소 자체 이력으로 이미 한 번 실증됐다**: 커밋 `f0fa0bac`(PR2a exec-park durable resume) 가 `1-data-model.md` 에 `pending_plans: [plan/in-progress/exec-park-durable-resume.md]` 를 추가했고(`status` 는 그때도 `implemented` 로 그대로 두었다 — 이번 target 처럼 `partial` 로 내리지 않았다), 이후 `db496a3c2`(spec↔code 전수 상호 감사) 에서 **자동 승격이 아니라 사람이 수동으로** 그 `pending_plans` 항목을 지웠다. 가드가 존재했다면 자동으로 잡았어야 할 지점을 사람이 손으로 치운 것 자체가 "가드가 강제한다" 는 이번 target 서술이 이 파일에는 성립하지 않는다는 직접 증거다.
  - 제안: (a) `spec/1-data-model.md` 는 `status` 를 `partial` 로 내리지 말고 저장소의 기존 선례(커밋 `f0fa0bac`)를 따라 `status: implemented` 를 유지한 채 `pending_plans:` 만 추가하거나, (b) `status: partial` 전환을 유지하고 싶다면 이 PR 에서 `spec/conventions/spec-impl-evidence.md` §1 의 `EXCLUDE_BASENAMES`(및 대응 코드 `spec-frontmatter-parse.ts`)에서 `1-data-model.md` 를 제외 목록에서 빼 실제로 가드가 보게 만들거나, (c) 최소한 target 의 근거 문장에서 "가드로 강제한다" 는 표현을 지우고 "이 파일은 가드 제외 대상이라 승격은 수동으로 되돌려야 한다"로 정정한다. 세 선택지 모두 `spec/conventions/spec-impl-evidence.md` 와의 불일치를 없앤다.

- **[INFO]** `0-canvas.md` §11.2.2 의 현재형 서술은 이번 draft 의 변경 대상에서 빠져 있으나, 이는 설계상 의도된 비대칭으로 보인다
  - target 위치: 변경안 2 (0-canvas.md 는 `pending_plans:` 추가만, 본문 §11.2.2 문구는 그대로 둠)
  - 충돌 대상: `spec/3-workflow-editor/0-canvas.md` §11.2.2 ("캔버스 저장은 이번 페이로드에 없는 노드를 가리키면 400 `VALIDATION_ERROR`…") — 이 문장은 여전히 미구현 동작을 현재형으로 서술한다(`plan/in-progress/cross-workspace-refs.md` 의 e2e 실측이 캔버스 저장의 cross-workflow `containerId`/`toolOwnerId`/엣지 케이스가 현재 200 으로 통과함을 재현했다 — 아직 RED).
  - 상세: 이 자체는 결함이 아니다 — target 의 Rationale("«(Planned)» 라벨을 달지 않는다", "spec 은 목표 상태다")이 이미 "본문은 목표 상태를 현재형으로 적고, 미구현 기간의 추적은 `pending_plans` 단독으로 맡는다"는 패턴을 확립했고, `0-canvas.md` 도 그 패턴을 그대로 따르는 것으로 읽힌다. 다만 이 설계가 성립하려면 그 문서가 frontmatter-evidence 가드 적용 대상이어야 하는데, `0-canvas.md`(basename 이 `EXCLUDE_BASENAMES` 에 없음)는 대상이 맞아 이 경우엔 문제가 없다. 위 CRITICAL 항목과 대조하면, 같은 패턴이 `1-data-model.md` 에서만 깨진다는 점이 대비된다.
  - 제안: 조치 불필요 — 위 CRITICAL 항목의 대조 사례로만 기록.

## 요약

target 은 세 문서(`1-workflow-list.md`·`0-canvas.md`·`1-data-model.md`)에 동일한 `status`/`pending_plans` 추적 패턴을 일괄 적용하려 하지만, 그 패턴의 전제(=`spec-impl-evidence.md` 의 4개 build 가드가 이 문서를 감시한다)가 `1-data-model.md` 에서는 SoT 컨벤션 자체의 `EXCLUDE_BASENAMES` 제외 목록에 의해 깨진다. target 의 근거 문장은 "가드가 승격을 강제한다"고 명시적으로 주장하지만 이는 이 파일에 한해 사실이 아니며, 저장소 자체의 과거 이력(커밋 `f0fa0bac` → `db496a3c2`)이 이를 실증한다. 나머지 두 문서(`1-workflow-list.md`·`0-canvas.md`) 및 Rationale 정정(항목 4)은 관련 spec·plan·가드 구현과 정합적이다.

## 위험도
CRITICAL
