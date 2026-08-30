# 요구사항(Requirement) 리뷰 — `updateExecutionStatus` else 분기 트랜잭션화 (3라운드 누적 diff)

대상: `origin/main`(`5fbcd20b8`) 대비 `HEAD`(`9d5e001bf`) — 커밋 `1a12088f2`(트랜잭션화 본체) ·
`519671792`(리뷰 W2+SPEC-DRIFT fix) · `9d5e001bf`(JSDoc 20곳 정정). 이전 두 라운드
(`17_36_15`, `18_10_28`)의 산출물도 이번 diff 에 포함돼 있어 함께 검토했다.

## 발견사항

- **[WARNING]** `project-planner` 거버넌스 턴의 근거 산출물(`plan/in-progress/spec-draft-else-branch-transaction.md`)이 **git 이력에 한 번도 존재한 적이 없다** — 6곳 이상의 참조가 죽은 링크다
  - 위치: 커밋 `519671792` 메시지("우회하지 않고 planner 턴을 밟았다 ... draft → `--spec`(BLOCK: NO) → 반영") / `review/code/2026/08/30/17_36_15/RESOLUTION.md:29-31`(같은 주장) / `review/code/2026/08/30/17_36_15/requirement.md:11`("project-planner 경로로 ... 반영을 권고") / `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:691`("`spec-draft-else-branch-transaction.md` 가 후속 각주와 「원자성 보장」 문장을 더해 보강했다")
  - 상세: `review/consistency/2026/08/30/17_49_59/meta.json` 의 `target_path` 는 `plan/in-progress/spec-draft-else-branch-transaction.md` 이고, 그 시점(17:49:59)에 실행된 5개 checker(`cross_spec`/`rationale_continuity`/`convention_compliance`/`plan_coherence`/`naming_collision`) 전원이 이 파일의 구체적 구조(frontmatter `worktree`/`started`/`owner`, `spec_impact` 리스트, `## Rationale` 하위의 `### 왜 이 PR 에 함께 넣나`/`### 기각한 대안 — 별도 planner PR` 서브섹션)를 상세히 인용하고 있어, **그 시점에는 실재하는 파일**이었다고 볼 근거가 강하다. 그런데 `git log --all --oneline -- "**/spec-draft-else-branch-transaction.md"` 는 전 이력에서 0건이다 — 이 경로는 **어느 커밋에도 add 된 적이 없다.** 현재 워킹 트리에도, untracked 상태로도 존재하지 않는다(`git status --short`, `ls plan/in-progress/` 둘 다 확인). 즉 이 draft 는 `--spec` 검토엔 쓰였지만 **한 번도 커밋되지 않은 채 사라졌다.**
    이 저장소의 `spec-draft-<name>.md` 관례는 예외 없이 **영속**한다 — `plan/complete/` 에서 세는 것만 30개 이상(`spec-draft-cancel-invariant-drift.md`, `spec-draft-error-codes.md` 등), `project-planner/SKILL.md` §5-7 도 "draft → spec 반영 → commit" 만 규정하지 "draft 삭제"는 어디에도 없다. 이번 건이 그 관례의 유일한 예외다.
    이것이 문제가 되는 이유는 CLAUDE.md 의 거버넌스 경계다 — `developer` 는 `spec/` 을 직접 못 고치고, 유일한 좁은 예외(자기-반증형 소정정)는 커밋 메시지 스스로 "조건 1·2 둘 다 실패해 해당 없다"고 명시했다. 즉 이번 `spec/5-system/4-execution-engine.md`·`spec/data-flow/3-execution.md` 갱신은 **오직 project-planner 턴을 거쳐야만 정당**한데, 그 턴이 실제로 있었다는 유일한 증거(산출물 파일)가 지금 저장소에는 없다. 컨텐츠 자체(아래 참고)는 코드와 정확히 일치하므로 결과물이 틀린 것은 아니지만, **거버넌스 감사 추적이 끊겼고 4개 문서·1개 커밋 메시지가 존재하지 않는 파일을 근거로 인용**하고 있다 — 다음 사람이 이 링크를 따라가면 아무것도 찾지 못한다.
  - 제안: `plan/complete/spec-draft-else-branch-transaction.md`(또는 원래 있어야 할 경로)를 실제 반영 내용 그대로 복원해 커밋하거나, 복원이 불가능하면 위 4곳의 참조를 "산출물 미보존, `519671792`/`17_49_59` 리뷰 기록이 유일한 근거"로 정정해 죽은 링크를 알린다. 재발 방지로 `--spec` 오케스트레이터가 draft 파일을 `git add` 하는 단계를 검토.

- **[INFO]** 위 거버넌스 갭과 별개로, **spec 본문 내용 자체는 코드와 line-level 로 정확히 일치**함을 직접 대조로 확인했다(발견 아님, 근거 기록)
  - 위치: `spec/5-system/4-execution-engine.md`(§1.1 "원자성 보장" 아래 2026-08-30 후속 각주 두 곳) ↔ `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8565-8582`(JSDoc), `:8692-8751`(else 분기 트랜잭션 본문) / `spec/data-flow/3-execution.md` §2.1 `execution ¦ 상태 전이` 행 ↔ 동일 코드
  - 상세: spec 이 서술하는 "else 분기도 `dataSource.transaction` 안에서 돈다", "목적이 짝 전이와 다르다(shape 가드 throw 롤백 vs 두 save 원자성)", "17일 노출 창, 발동 여부는 미확인" 은 전부 실제 코드·커밋 이력과 정확히 대응한다. 임의의 필드명·에러 코드·기본값 불일치 없음.

- **[INFO]** JSDoc 의 "호출부 20곳(내부 11 + `EngineDriver` 경유 9)" 수치를 직접 재실측해 정확함을 확인
  - 위치: `execution-engine.service.ts:8571-8575`
  - 상세: `grep -n "this.updateExecutionStatus(" execution-engine.service.ts` → 11(라인 652/2309/2409/2485/2574/3569/4307/4432/4755/4893/5014). `driver.updateExecutionStatus(` 소비처 4파일(`ai-turn-orchestrator.service.ts` 3, `retry-turn.service.ts` 2, `form-interaction.service.ts` 2, `button-interaction.service.ts` 2) = 9. 합계 20, JSDoc 과 정확히 일치. `retry-turn.service.ts` 의 유일한 `.transaction(` 블록(215~244행)도 두 driver 호출(696/915)보다 한참 위에서 닫혀 self-deadlock 경로 없음을 확인 — `18_10_28` W1 이 지적한 "11곳만 세고 9곳 누락" 결함이 `9d5e001bf` 에서 정확히 닫혔다.

- **[INFO]** 회귀 테스트 2건이 mutation 관점에서 vacuous 하지 않음을 코드 대조로 확인
  - 위치: `execution-engine.service.spec.ts:4812-4864`
  - 상세: 롤백 전제조건 테스트는 `mockExecutionRepo.query = jest.fn().mockResolvedValue(undefined)`(shape 위반 유도), 공허방지 테스트는 `mockResolvedValue([[{ id: 'eOk' }], 1])`(정상 shape) — 서로 다른 입력으로 각 분기를 실제로 가른다. `beforeEach` 의 `mockTxManagerQuery` → `mockExecutionRepo.query` 위임(gate 275-291)도 실제로 트랜잭션 manager 경유 여부를 별도 신호로 기록해, "throw 경로만 우연히 트랜잭션을 탔다"는 공허한 통과를 만들지 않는다.

## 그 외 확인한 것 (문제 없음)

- TODO/FIXME/HACK/XXX 류 미완성 표식은 코드 diff 전체에서 0건(`grep -niE`).
- `updateReturningRows`(0행 매칭 시 `[]` 반환, 비배열일 때만 throw)와 트랜잭션 래핑의 상호작용을 직접 대조 — 동시 cancel 로 인한 0행 매칭은 throw 하지 않고 정상 commit(no-op)되며, `persisted=false` 로 호출부가 이벤트 emit 을 건너뛴다. shape 위반(비배열)만 throw → 트랜잭션 롤백. 의도와 정확히 일치.
- `finishStatusTransition` 추출은 두 분기의 반환값·부작용 순서(세그먼트 기록 → 메트릭 발행 → return)를 정확히 보존한다 — 리팩터가 동작을 바꾸지 않았음을 확인.
- 이전 두 라운드(`17_36_15` WARNING 2건, `18_10_28` WARNING 2건)의 처분은 전부 현재 트리에서 실물로 확인됨: CHANGELOG 소급 정정 블록 존재, `plan_coherence.md` 선두 프로토콜 헤더 오염 제거, JSDoc "20곳" 정정, `spec_impact`/자매 plan 역참조/`data-flow §2.1` 3건 전량 반영. 재열 사유 없음.
- 프로덕션 코드의 반환값(`Promise<boolean>`)은 모든 경로(정상 persist / 0행 no-op / shape 위반 throw)에서 정의된 대로 동작 — 반환값 누락 경로 없음.

## 요약

핵심 기능 변경(`updateExecutionStatus` else 분기를 `dataSource.transaction` 으로 감싸 shape-위반 throw 가 UPDATE 를 롤백하게 함)은 의도한 동작을 정확히 구현하며, spec 본문(§1.1 원자성 보장, data-flow §2.1)과 line-level 로 일치하고, 회귀 테스트 2건은 mutation 관점에서 견고하다. 이전 두 라운드의 모든 WARNING(CHANGELOG 누락, epilogue 중복, JSDoc 호출부 과소집계, 리뷰 산출물 프로토콜 헤더 오염, spec_impact 부정확)도 현재 트리에서 실물로 해소를 확인했다. 유일한 신규 발견은 코드 결함이 아니라 **거버넌스 감사 추적 갭**이다 — `spec/` 갱신을 정당화하는 유일한 근거였던 `project-planner` draft 산출물(`plan/in-progress/spec-draft-else-branch-transaction.md`)이 `--spec` 검토 시점에는 실재했음이 5개 checker 의 상세 인용으로 뒷받침되나, git 이력 전체에서 커밋된 적이 없어 지금은 6곳 이상의 문서·커밋 메시지가 존재하지 않는 파일을 근거로 인용하고 있다. 이 저장소의 `spec-draft-*` 관례(30개 이상 전례)는 예외 없이 영속하므로 이번 건이 유일한 이탈이다.

## 위험도

LOW — 프로덕션 코드·spec 콘텐츠 자체는 결함 없음. 거버넌스 산출물 소실은 문서/추적성 문제로 런타임 동작에 영향 없으나, 반복되면 "spec/ 은 반드시 project-planner 턴을 거친다"는 이 저장소의 핵심 규율을 검증 불가능하게 만들 수 있어 WARNING 으로 표기한다.
