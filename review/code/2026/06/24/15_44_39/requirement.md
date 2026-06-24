# 요구사항(Requirement) 리뷰 — M-4 park-진입 dispatch registry 추출

## 발견사항

### 발견사항 1
- **[INFO]** `satisfies Record<WaitingInteractionType, …>` exhaustive 보장 미적용
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` — `buildParkEntryRegistry` 반환값
  - 상세: plan M-4 §개선방안 4항에 "4. `satisfies Record<WaitingInteractionType,…>` 로 exhaustive 보장 유지"가 명시돼 있다. 그러나 실제 구현에서 `buildParkEntryRegistry` 는 `readonly ParkEntryDispatch[]` 를 반환할 뿐, `satisfies Record<WaitingInteractionType, ParkEntryDispatch>` 또는 동등한 컴파일-타임 exhaustive 제약이 없다. `resume-turn-dispatch.ts` 도 동일하게 해당 제약을 미적용 중이라 쌍둥이 패턴의 일관성은 유지되지만, 계획에 명시된 목표는 미구현 상태다.
  - 제안: 단순 배열 구조로는 `Record<WaitingInteractionType, …>` 형을 직접 적용하기 어렵다. 현행 `resume-turn-dispatch.ts` 와 동일 수준으로 유지하는 것(일관성)이 선택지이고, 만약 plan 의 제약을 이행하려면 별도 검증 함수나 타입 어서션이 필요하다. 현실적으로 unit 테스트 7개(순서·selects 술어)가 동등한 회귀 보호를 제공하므로 INFO 수준이다.

### 발견사항 2
- **[INFO]** `dispatchParkEntry` 반환 타입이 `Promise<ProcessTurnResult>` 로 선언되나 `undefined` 반환 경로 존재 (TypeScript 수용 범위 내, 의도 명시적)
  - 위치: `execution-engine.service.ts` `dispatchParkEntry` 메서드 마지막 줄: `return handler ? handler.handle(ctx) : undefined;`
  - 상세: `ProcessTurnResult = void | ParkSignal`. `undefined` 는 JavaScript 에서 `void` 의 실질적 값이고 TypeScript 도 이를 수용하므로 타입 오류가 아니다. 또한 JSDoc 에 "매칭 처리기가 없으면 `undefined`(park 진입 분기 없음 — 추출 전 if/else 의 else-fallthrough 와 동일)" 라고 명시돼 있어 의도적이다. 다만 반환 타입을 `Promise<ProcessTurnResult | undefined>` 또는 그냥 `Promise<ProcessTurnResult>` 로 두더라도 의미가 달라지지 않으나, 미래 독자 입장에서 혼동 가능성이 있다는 점을 기록한다.
  - 제안: 현행 유지 또는 `Promise<ProcessTurnResult>` 시그니처에 대해 JSDoc 에 명시된 내용이 충분하므로 추가 조치 불필요.

### 발견사항 3
- **[WARNING] [SPEC-DRIFT]** `interaction-type-registry.md §1.2` 주석이 park-entry 진입점(`buildParkEntryRegistry`/`dispatchParkEntry`)을 언급하지 않음
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/conventions/interaction-type-registry.md` line 54 (§1.2 끝 주석)
  - 상세: §1.2 끝 주석은 "재개(resume) turn 라우팅 진입점(backend)" 로 `resume-turn-dispatch.ts`(`dispatchResumeTurn`, ordered `resumeTurnRegistry`)를 명시하지만, 이제 대칭 관계인 최초 park 진입 측 `buildParkEntryRegistry`/`dispatchParkEntry`(`park-entry-dispatch.ts`)가 구현됐음에도 spec 본문에 언급이 없다. 코드 구현 자체는 올바르며 behavior-preserving 이다 — 오히려 코드가 spec 보다 한 걸음 앞서 있는 SPEC-DRIFT 상황이다. 해결은 코드 되돌리기가 아니라 spec 갱신이다.
  - 제안: 코드 유지 + spec 반영. 후속 planner spec-sync PR 에서 `spec/conventions/interaction-type-registry.md` §1.2 끝 주석에 "최초 park 진입 라우팅도 `buildParkEntryRegistry`(ordered `parkEntryRegistry`, first-match-wins: form → buttons → ai_conversation, `park-entry-dispatch.ts`)로 일원화됐다" 를 대칭 기술로 추가한다. consistency-check impl-prep W2 에서 이미 식별·추적 중.

### 발견사항 4
- **[WARNING] [SPEC-DRIFT]** `interaction-type-registry.md` frontmatter `code:` 에 `park-entry-dispatch.ts` 미등재
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/spec/conventions/interaction-type-registry.md` frontmatter line 4–12
  - 상세: frontmatter `code:` 는 해당 spec/convention 을 구현하는 파일 목록이다(`spec-impl-evidence.md §2`). `resume-turn-dispatch.ts`(line 9)는 등재돼 있으나 대칭 파일인 `park-entry-dispatch.ts`는 신설됐음에도 등재되지 않았다. 이는 코드 구현 문제가 아니라 spec 갱신 누락이다.
  - 제안: 코드 유지 + spec 반영. 후속 planner spec-sync PR 에서 frontmatter `code:` 에 `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts` 를 추가한다. consistency-check impl-prep W1 에서 이미 식별·추적 중.

---

## 요약

M-4 구현은 의도한 기능(park-진입 blocking 인터랙션 dispatch 삼중복 → 단일 `dispatchParkEntry` 일원화)을 완전히 달성했다. form→buttons→ai 우선순위, `PARK_RELEASED` 사이트별 escape 보존, `ai_form_render` 의 `ai_conversation` 공유 매칭, 세 호출 사이트 모두에서의 dispatch 교체가 정확히 구현됐고, unit 테스트 7개와 e2e 214 PASS 로 회귀 안전이 검증됐다. 요구사항 충족에 실질적 결함은 없다. 유일한 주의 사항은 plan 4항에 명시된 `satisfies Record<WaitingInteractionType, …>` exhaustive 보장이 미적용 상태이나, 이는 `resume-turn-dispatch.ts`(대칭 파일)도 동일하게 미적용이므로 패턴 일관성 관점에서는 문제가 아니며 unit 테스트가 동등한 회귀 보호를 제공한다. spec 관련 두 항목(frontmatter `code:` 미등재, §1.2 park-entry 기술 누락)은 코드 구현의 결함이 아니라 behavior-preserving 리팩터 후 spec 갱신이 아직 진행되지 않은 SPEC-DRIFT 상황으로, 후속 planner spec-sync PR 의 대상이다.

## 위험도

LOW
