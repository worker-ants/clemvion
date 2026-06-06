# 요구사항(Requirement) 리뷰 — exec-park followup (B-1 dispatch registry)

리뷰 대상: `dispatchResumeTurn` + `resumeTurnRegistry` 추출, `process-turn-result.ts` / `resume-turn-dispatch.ts` 신규 파일, 단위 테스트 (`execution-engine.service.spec.ts`), 플랜 파일 2종.

---

## 발견사항

### **[INFO]** [SPEC-DRIFT] `dispatchResumeTurn` 레지스트리 패턴이 spec §7.5 에 미반영
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `_resumeTurnRegistry` / `resumeTurnRegistry` getter / `dispatchResumeTurn` (L1821~L1895); `codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts` 전체
- 상세: spec §7.5 시퀀스 다이어그램(L904~L906)은 `driveResumeAwaited`/`driveResumeFrame` 가 `processFormResumeTurn`, `processButtonResumeTurn`, `processAiResumeTurn` 을 **직접** 호출하는 것으로 기술한다. 이번 변경은 이 3분기를 `resumeTurnRegistry`(ordered first-match-wins) + `dispatchResumeTurn` 단일 진입점으로 추출했으나, spec 본문에는 이 레지스트리 패턴·`ResumeTurnDispatch` 인터페이스·`handleAiResumeTurn` 위임 계층이 언급되지 않는다. 코드 동작(선택 우선순위 form→buttons→ai, 에러 코드, PARK_RELEASED 전파)은 spec 과 일치하며, 이 변경은 구현 내부의 중복 제거를 위한 의도적 리팩터링이다. 코드가 옳고 spec 이 아직 이 구조를 반영하지 못한 SPEC-DRIFT.
- 제안: 코드 유지. `spec/5-system/4-execution-engine.md §7.5` 시퀀스 다이어그램(L904 부근)에 "form/button/ai 분기는 `dispatchResumeTurn`(ordered registry, `resume-turn-dispatch.ts`)을 통해 라우팅됨" 을 주석 또는 별도 단락으로 반영. 갱신 대상 spec 위치: `spec/5-system/4-execution-engine.md §7.5` L903~L906 시퀀스 항목 + `driveResumeAwaited`/`driveResumeFrame` 설명.

---

### **[INFO]** `PARK_RELEASED` / `ProcessTurnResult` 공유 파일 이관 — spec frontmatter `code:` 글로브 미반영
- 위치: `codebase/backend/src/shared/execution-resume/process-turn-result.ts` (신규); `spec/5-system/4-execution-engine.md` frontmatter
- 상세: `spec/5-system/4-execution-engine.md` 의 frontmatter `code:` 글로브에는 `codebase/backend/src/shared/execution-resume/**` 가 이미 추가된 것으로 `exec-park-polish.md` A2 항목이 기록한다. 따라서 `process-turn-result.ts` 신규 파일은 이 glob 에 의해 자동 포함된다. spec-impl evidence 연결은 충족됨 — 별도 조치 불필요.
- 제안: 확인 완료. 추가 조치 없음.

---

### **[INFO]** `_resumeTurnRegistry` reset 이 `afterEach` 에서만 수행 — `beforeEach` 모듈 재생성과 충돌 없음 확인
- 위치: `execution-engine.service.spec.ts` L77~82 (afterEach registry reset)
- 상세: 테스트 suite 는 `beforeEach` 에서 매번 `Test.createTestingModule` 을 재실행해 완전히 새로운 `service` 인스턴스를 생성한다. 따라서 `_resumeTurnRegistry = undefined` 수동 리셋은 기술적으로 불필요하지만(새 인스턴스는 이미 `undefined`), 방어적 정책으로 타당하다. 오류 없음.
- 제안: 없음. 현 코드 유지.

---

### **[INFO]** `handleAiResumeTurn` 내부 — `ctx.resumeCheckpoint` 가 `undefined` 일 때의 타입 캐스팅
- 위치: `execution-engine.service.ts` L1065 — `ctx.resumeCheckpoint as Record<string, unknown>`
- 상세: `handleAiResumeTurn` 은 `dispatchResumeTurn` → ai registry 항목의 `selects` 가 `hasResumeCheckpoint === true` 일 때만 호출된다. 즉 진입 시점에 `ctx.resumeCheckpoint` 가 반드시 non-undefined 임이 보장된다. 그러나 `ResumeTurnContext.resumeCheckpoint` 의 타입이 `Record<string, unknown> | undefined` 이므로 `as` 캐스팅이 필요하다. 이 캐스팅은 동작상 안전하며, 타입 좁히기(`ctx.resumeCheckpoint!`)로 대체 가능하나 현 방식도 문제없다.
- 제안: 없음.

---

### **[INFO]** 테스트에서 `contextService` 직접 접근 — `as unknown as { contextService: ... }` 패턴
- 위치: `execution-engine.service.spec.ts` L258~263 (`setNodeOutput` spy)
- 상세: private 멤버에 접근하기 위해 `as unknown as` 이중 캐스팅을 사용한다. 이 패턴은 다른 describe 블록에서도 동일하게 쓰이며(W1 SUMMARY 비고), 테스트 전용 타입 우회 관행으로 수용됨.
- 제안: 없음.

---

### **[INFO]** `plan/complete/exec-park-b2a-followup.md` 및 `exec-park-polish.md` — plan 파일 형식 검토
- 위치: `plan/complete/exec-park-b2a-followup.md`, `plan/complete/exec-park-polish.md`, `plan/complete/spec-draft-exec-park-b2-durable.md`
- 상세: 모두 완료 상태로 `plan/complete/` 에 배치됐으며, frontmatter 에 `worktree`, `started`, `owner`, `spec_impact` 필드가 올바르게 기재됐다. `spec-draft-exec-park-b2-durable.md` 는 `owner: planner` 로 spec draft 의 성격을 명확히 분리했다. plan lifecycle 규약 준수.
- 제안: 없음.

---

## 기능 완전성 평가

**변경 범위의 기능 완전성은 충족됨.**

1. **form 라우팅**: `blockingInteraction === 'form'` 조건이 spec §7.5 의 form 재개 경로와 정확히 대응하며, 테스트(L84~103)가 `processFormResumeTurn` 단독 호출을 검증한다.

2. **buttons 라우팅**: `persistedInteractionType === 'buttons'` 조건이 spec 의 버튼 재개 경로와 대응하며, 테스트(L105~127)가 검증한다.

3. **우선순위(form > buttons)**: form 과 buttons 가 동시에 매칭될 경우 form 이 먼저 선택된다. 이는 추출 전 if/else 순서와 동일하며 테스트(L170~191)가 검증한다.

4. **AI 라우팅 + PARK_RELEASED 전파**: `isAiConversation && hasResumeCheckpoint && isCheckpointEligibleNodeType` 조건이 spec 의 multi-turn AI 재개 경로와 대응한다. PARK_RELEASED 반환 전파 테스트(L151~168)가 검증한다.

5. **매칭 없음 → RESUME_CHECKPOINT_MISSING**: spec §7.5 실패 케이스 표("NodeExecution.outputData 가 부재 또는 손상" → `RESUME_CHECKPOINT_MISSING`)와 일치. 테스트(L193~228)가 두 케이스(unknown interaction type, ai without checkpoint)를 커버한다.

6. **handleAiResumeTurn 내부 — buildRetryReentryState 실패 → RESUME_INCOMPATIBLE_STATE**: spec §7.5 실패 케이스 표("Multi-turn AI _resumeCheckpoint 손상/부재 → `RESUME_INCOMPATIBLE_STATE`")와 일치. 테스트(L233~247)가 검증한다.

7. **handleAiResumeTurn 정상 경로 — setNodeOutput seed + processAiResumeTurn 호출**: spec §7.5 소비 절("_resumeCheckpoint → buildRetryReentryState → _resumeState 재구성 → nodeOutputCache seed → processAiResumeTurn 단발 처리")과 정확히 일치. 테스트(L250~283)가 `setOutputSpy` call 인수까지 검증한다.

8. **driveResumeAwaited / driveResumeFrame 양쪽에서 공유**: `dispatchResumeTurn` 이 두 호출 경로(`top-level` L2004, `중첩 innermost` L2287)에서 호출됨을 diff 로 확인. 중복 코드 제거 및 일관성 보장.

9. **`PARK_RELEASED` / `ProcessTurnResult` 공유 이관**: 추출 전 local `PARK_RELEASED` 심볼을 `shared/execution-resume/process-turn-result.ts` 로 이관. 심볼 동일성(Symbol identity)이 파일 경계에서 보존됨 — 단일 `export const PARK_RELEASED = Symbol(...)` 이므로 비교 의미 유지.

---

## 요약

본 변경은 `driveResumeAwaited`/`driveResumeFrame` 양쪽에 중복 하드코딩되어 있던 form/buttons/AI 분기 로직을 `dispatchResumeTurn` + `resumeTurnRegistry` (ordered first-match-wins) 로 추출·일원화한 내부 리팩터링이다. 선택 우선순위(form → buttons → ai), 에러 코드(`RESUME_CHECKPOINT_MISSING` / `RESUME_INCOMPATIBLE_STATE`), `PARK_RELEASED` 전파 의미는 추출 전과 완전히 동일하게 보존됐으며, spec §7.5 행위 명세와 line-level 로 일치한다. 신규 `process-turn-result.ts`(PARK_RELEASED 심볼 공유) 및 `resume-turn-dispatch.ts`(인터페이스 계약)는 역할이 명확하고 누락 필드·엣지 케이스 미처리가 없다. 단위 테스트는 라우팅 8경로(form/buttons/우선순위/ai/PARK_RELEASED 전파/checkpoint 부재/interaction 미지원/handleAiResumeTurn 내부 2경로)를 커버하며 요구사항 충족 근거로 충분하다. `spec/5-system/4-execution-engine.md §7.5` 시퀀스가 `dispatchResumeTurn` 레지스트리를 직접 기술하지 않는 것은 SPEC-DRIFT(코드가 옳고 spec 갱신이 필요)이며, 코드 수정 대상이 아니다.

---

## 위험도

NONE
