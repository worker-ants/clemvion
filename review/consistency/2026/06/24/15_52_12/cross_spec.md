# Cross-Spec 일관성 검토 결과

검토 범위: M-4 park-진입 dispatch 추출 (커밋 ecd70dd1)
- 신규 파일: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts`
- 신규 파일: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.spec.ts`
- 변경 파일: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`

---

## 발견사항

### [WARNING] spec frontmatter `code:` 참조 누락 — interaction-type-registry.md

- target 위치: `park-entry-dispatch.ts` (신규 파일)
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/conventions/interaction-type-registry.md` frontmatter lines 4-13
- 상세: `interaction-type-registry.md` 의 `code:` 목록에는 이미 `resume-turn-dispatch.ts` 가 등재돼 있다 (line 9). M-4 는 그 대칭 쌍인 `park-entry-dispatch.ts` 를 신설했지만, 이 파일이 `interaction-type-registry.md` 의 `code:` glob 에 등재되지 않았다. resume 측 registry 가 등재된 동일 이유(interaction type 분기 구현 파일로서 spec 포괄 범위)에서 park-entry 측도 함께 등재되어야 일관하다.
- 제안: `interaction-type-registry.md` frontmatter 의 `code:` 목록에 `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` 를 추가하거나, 해당 spec 의 §1.2 "재개(resume) turn 라우팅 진입점" 주석을 확장해 "최초 park 진입 측(`park-entry-dispatch.ts`, `dispatchParkEntry`)도 동일 ordered registry 패턴으로 일원화됨" 을 명시한다. 이는 후속 planner spec-sync PR 범위로 defer 가능(developer read-only 조건과 일치).

---

### [INFO] 실행 엔진 spec §7.5 Rationale 에 park-entry registry 언급 없음

- target 위치: `park-entry-dispatch.ts` JSDoc + `dispatchParkEntry` 메서드
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/5-system/4-execution-engine.md` §Rationale line ~1372 (resume-turn-dispatch 추출 기록)
- 상세: spec §Rationale 에는 "resume turn dispatch registry 추출 (#507, 2026-06-06)" 기록이 존재해 `resumeTurnRegistry` 의 추출 배경·근거·이름을 명시한다. M-4 에서 추출한 `parkEntryRegistry`(`park-entry-dispatch.ts`) 의 대칭 기록이 아직 없다. 동작 보존 리팩토링이라 spec 의미 위반은 없으나, 미래 독자가 "resume 측은 registry 추출 기록이 있는데 park 측은?" 이라는 의문을 가질 수 있다. 충돌이 아닌 누락이므로 INFO.
- 제안: 후속 planner spec-sync PR 에서 spec §Rationale 에 "park-entry dispatch registry 추출 (M-4, 2026-06-24)" 항목을 `resume turn dispatch registry 추출` 항목 인접 위치에 추가한다. 실행 엔진 spec 의 `code:` glob 은 `codebase/backend/src/modules/execution-engine/**` 를 이미 포함하므로 frontmatter 변경은 불필요.

---

### [INFO] interaction-type-registry §1.2 "재개 turn 라우팅 진입점" 노트가 park 측 대칭 언급을 미포함

- target 위치: `park-entry-dispatch.ts` 의 인터페이스 JSDoc — `ResumeTurnDispatch` 와 대칭임을 명시
- 충돌 대상: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/conventions/interaction-type-registry.md` §1.2 line 54 주석
- 상세: `interaction-type-registry.md` §1.2 의 블록 인용문은 "park 후 재개 시 `dispatchResumeTurn`…으로 일원화" 만 기술하고, "최초 park 진입 시 `dispatchParkEntry`(`parkEntryRegistry`)로 일원화" 는 언급하지 않는다. spec 의 "Backend emit 위치" 열(§1.2 매트릭스)은 최초 waiting 진입 기준이므로 `dispatchParkEntry` 가 그 라우팅을 대표하는 코드 진입점이 됐음을 동기화하면 가독성이 높아진다. 충돌은 아님(행위는 동일, enum 추가 없음).
- 제안: `interaction-type-registry.md` §1.2 노트를 확장해 "최초 park 진입 시 form/buttons/ai 분기도 `dispatchParkEntry`(ordered `parkEntryRegistry`, `park-entry-dispatch.ts`)로 일원화됐으며, `dispatchResumeTurn` 과 대칭이다" 를 추가. 후속 planner spec-sync PR 범위.

---

## 요약

M-4 변경(`park-entry-dispatch.ts` 추출 + `dispatchParkEntry` 일원화)은 동작 보존 리팩토링으로, 기존 spec 이 정의하는 엔티티·API 계약·상태 전이·RBAC·요구사항 ID 와 직접 모순되는 내용이 없다. 선행 선례(`resume-turn-dispatch.ts` registry, PR #507)가 "spec 무변 착지"로 이미 확립한 패턴을 park 측에 대칭 적용한 것이므로 계층 책임도 일관하다. 다만 `interaction-type-registry.md` frontmatter `code:` 목록에 `park-entry-dispatch.ts` 가 누락(WARNING)되어 있어 resume 측과의 등재 일관성이 깨진다. 이를 포함한 나머지 두 항목(INFO)은 모두 spec 동기화 누락이며 "후속 planner spec-sync PR" 의 기존 defer 계획에 포함하면 된다. CRITICAL·기능 충돌 없음.

## 위험도

LOW
