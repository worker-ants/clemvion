# 신규 식별자 충돌 검토 — M-4 park-진입 dispatch 추출

검토 대상: `park-entry-dispatch.ts` + `execution-engine.service.ts` 변경 (커밋 ecd70dd1)

---

## 발견사항

### INFO: `M-4` 식별자 — plan 파일 내 다중 의미 공존 (인지적 혼동 가능성)

- **target 신규 식별자**: 구현 커밋 메시지 및 코드 주석에서 "M-4" 를 `02-architecture.md §M-4 park-진입 dispatch 추출` 의 완료 참조로 사용.
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/plan/in-progress/refactor/03-maintainability.md:181` — `M-4` = `integration-configs.tsx` Cafe24/Makeshop 구조 중복 (결정대기).
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/plan/in-progress/refactor/04-security.md:181` — `M-4` = `.env.example` ENCRYPTION_KEY 실사용 가능 구체값 (완료).
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/plan/in-progress/refactor/05-database.md:180` — `M-4` = rehydration 루프 per-nodeId findOne N+1 (완료 포인터).
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/plan/in-progress/refactor/06-concurrency.md:166` — `M-4` = `executeAsync` fire-and-forget setup 2차 실패 시 RUNNING 잔류.
  - `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/plan/in-progress/refactor/07-dependency.md:100` — `M-4` = dayjs 버전 스큐 (완료).
- **상세**: `M-4` 는 각 refactor plan 파일(01~07)의 파일 내부 번호로서 파일 스코프가 다르다. 동일 컨텍스트(`02-architecture.md`) 내에서는 의미가 유일하므로 충돌이 아니라 파일 경계 분리된 재사용이다. 단, 커밋 메시지/주석에서 단순히 "M-4" 라고만 표기하면 어느 plan 파일의 M-4 인지 독자에게 불명확하다.
- **제안**: 코드 주석 및 커밋 메시지에서 `02 M-4` 또는 `arch-M-4` 와 같이 파일 prefix 를 붙이는 것을 권장한다. 기존 README.md 가 `02 M-4`, `04 C-1/M-4/M-7` 형식으로 이미 구분하고 있으므로 코드 주석도 동일 패턴으로 통일하면 충분하다.

---

### INFO: `ParkEntryDispatch` — plan 에서 이름 사전 예고됨, 실제 구현은 일치

- **target 신규 식별자**: `ParkEntryDispatch` (인터페이스), `ParkEntrySelector`, `ParkEntryContext`, `ParkEntryDispatchDeps`, `buildParkEntryRegistry`, `dispatchParkEntry`, `parkEntryRegistry`, `_parkEntryRegistry`.
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/plan/in-progress/refactor/02-architecture.md:227` 및 README.md:68 에서 `ParkEntryDispatch` 이름이 권장 방안으로 이미 명시됨.
- **상세**: 충돌 없음. plan 에서 예약한 이름과 구현이 정확히 일치한다. `ResumeTurnDispatch`/`ResumeTurnSelector`/`ResumeTurnContext`/`ResumeTurnDispatchDeps` 와 대칭 명명 패턴을 그대로 따른다.
- **제안**: 없음.

---

### INFO: `ParkEntrySelector.interactionType` vs `ResumeTurnSelector.persistedInteractionType` — 필드명 비대칭

- **target 신규 식별자**: `ParkEntrySelector.interactionType` (런타임 캐시에서 읽는 상태).
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/refactor-c2-circular-deps/codebase/backend/src/modules/execution-engine/resume-turn-dispatch.ts:55` — 대응 필드명은 `persistedInteractionType`.
- **상세**: 의미 차이가 실재한다. resume 측은 "park 시 `NodeExecution.outputData.meta.interactionType` 로 영속된 값" 이라 `persisted` 접두어가 붙고, park-entry 측은 "런타임 `getInteractionType` 결과" 라 `persisted` 가 없는 것이 의도적이다. 동일 이름(`interactionType`)을 다른 계층에서 쓰는 것이지 충돌은 아니다. 다만 두 Selector 를 나란히 보는 독자에게 "왜 차이가 나는가" 가 주석 없이는 불명확하다.
- **제안**: `ParkEntrySelector` JSDoc 에 "resume 측 `persistedInteractionType`(DB 영속) 과 달리 이쪽은 런타임 `getInteractionType` 결과를 그대로 받는다" 한 줄을 추가하면 충분하다. 이름 자체를 변경할 필요는 없다.

---

### INFO: `park-entry-dispatch.ts` 파일 위치 — 컨벤션 일치, `resume-turn-dispatch.ts` 와 동일 폴더

- **target 신규 파일**: `codebase/backend/src/modules/execution-engine/park-entry-dispatch.ts`, `park-entry-dispatch.spec.ts`
- **기존 사용처**: 동일 폴더에 `resume-turn-dispatch.ts` 존재.
- **상세**: 명명 패턴 `<verb>-<noun>-dispatch.ts` 와 동일 폴더 배치가 일치한다. 파일명 충돌 없음.
- **제안**: 없음.

---

### INFO: `spec/conventions/interaction-type-registry.md` §1.2 — park-entry 레이어 미등재 상태

- **target 신규 식별자**: `dispatchParkEntry` / `parkEntryRegistry` (최초 park 진입 단일 진입점).
- **기존 사용처**: `spec/conventions/interaction-type-registry.md:54` 의 "재개(resume) turn 라우팅 진입점" 주석은 `dispatchResumeTurn`/`resumeTurnRegistry` 만 언급하고 park-entry 측을 누락. `plan/in-progress/refactor/02-architecture.md:244` 가 "spec 갱신 필요 — `interaction-type-registry.md §1.2`" 를 명시하고 있으나 이 PR 범위에서 spec 은 수정되지 않았다.
- **상세**: 충돌이 아니라 미등재 상태다. spec 이 없는 것이지 이미 등재된 다른 의미와 이름이 겹치는 것은 아니다. 그러나 `interaction-type-registry.md` §1.2 의 "Backend emit 위치" 주석이 현재 resume 진입점만 서술하고 있어 park-entry 레이어가 존재하지 않는 것처럼 읽힌다.
- **제안**: 후속 spec-sync(planner 담당 — `02-architecture.md M-4` 갱신 계획에 이미 명기) PR 에서 `interaction-type-registry.md §1.2` 주석에 `dispatchParkEntry`/`parkEntryRegistry` 등재를 수행한다. 현 구현 PR 자체의 식별자 충돌은 없다.

---

## 요약

target 이 도입한 신규 식별자(`ParkEntryDispatch` 계열, `park-entry-dispatch.ts`, `dispatchParkEntry`, `parkEntryRegistry` 등)는 plan 에서 이미 예약된 이름과 정확히 일치하며 기존 영역에서 다른 의미로 사용 중인 이름과 충돌하지 않는다. `M-4` 레이블은 plan 파일별로 스코프가 분리된 번호 체계이므로 실질적 충돌은 없으나, 커밋/주석에서 파일 prefix(`02 M-4`) 없이 단독 사용하면 혼동 가능성이 있어 INFO 로 기록한다. `ParkEntrySelector.interactionType` vs `ResumeTurnSelector.persistedInteractionType` 의 명명 비대칭은 의도적 의미 차이이며, JSDoc 보강으로 해소할 수 있다. `interaction-type-registry.md` §1.2 의 park-entry 레이어 미등재는 충돌이 아닌 미기록이며 후속 spec-sync PR 의 기존 계획 범위다. CRITICAL 또는 WARNING 수준 충돌은 발견되지 않았다.

---

## 위험도

NONE
