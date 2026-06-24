# Plan 정합성 검토 결과

검토 모드: --impl-done  
대상: M-4 park-진입 dispatch 추출 (커밋 ecd70dd1, `park-entry-dispatch.ts` + `dispatchParkEntry`)  
diff-base: origin/main

---

## 발견사항

### [WARNING] M-4 plan 미갱신 — `[ ] 미착수` 상태 그대로

- **target 위치**: `park-entry-dispatch.ts` 신설 + `execution-engine.service.ts` 3개 사이트 일원화 (diff 전체)
- **관련 plan**: `plan/in-progress/refactor/02-architecture.md` §M-4 (line 221)
  - `- [ ] 미착수 — execution-engine.service.ts:1577-1616,3709,3944-3948`
- **상세**: 구현이 완료돼 `park-entry-dispatch.ts`(ParkEntryDispatch registry + dispatchParkEntry)가 신설되고 3개 중복 사이트(`runNodeDispatchLoop` retry-드라이브·`executeInline` 중첩·`runExecution` 메인 루프)가 일원화됐으나, plan 체크박스가 `[ ]` 그대로라 추적 현황과 실제 상태가 어긋난다. 이후 다른 worktree/세션이 이 항목을 "아직 착수 안 됨"으로 오독해 중복 작업에 나설 수 있다.
- **제안**: `plan/in-progress/refactor/02-architecture.md` §M-4 체크박스를 `[x]` 로 갱신하고 완료 날짜·커밋 참조를 추가. 이 plan 이 완전히 닫히면 `plan/complete/` 이동 여부도 검토한다.

---

### [WARNING] spec 갱신 미이행 — plan이 "선행 조건"으로 지정한 spec doc-sync가 구현 후에도 반영되지 않음

- **target 위치**: `park-entry-dispatch.ts` JSDoc 의 `spec: 5-system/4-execution-engine.md §7.5 · conventions/interaction-type-registry.md §1.2` 참조 문구
- **관련 plan**: `plan/in-progress/refactor/02-architecture.md` §M-4 권장 및 spec 갱신 항목 (lines 239–243)
  - "spec 갱신(§1.2 emit 위치 열)이 선행 조건이므로 planner 의 `spec-sync-resume-dispatch-registry.md` 합류 후 착수한다."
  - "**spec 갱신**: **필요** — `interaction-type-registry.md §1.2` emit 위치 열 + 진행 중 `spec-sync-resume-dispatch-registry.md` 에 park-entry 레이어 추가 (planner)"
- **상세**: 검토 시점에서 `spec/conventions/interaction-type-registry.md §1.2`의 재개(resume) 노트는 `dispatchResumeTurn`/`resumeTurnRegistry`만 기술하고 park-진입 측(`dispatchParkEntry`/`ParkEntryDispatch`/`park-entry-dispatch.ts`)에 대한 언급이 전혀 없다. `spec/5-system/4-execution-engine.md`에도 `dispatchParkEntry`·`parkEntryRegistry` 진입점이 등재되지 않았다. plan이 "planner 선행 조건"으로 명시한 spec 갱신이 구현 완료 이후에도 반영되지 않은 상태다. 이는 선행 plan 미해소(검토 관점 2번)에 해당한다.  
  단, 검토 모드 설명(`spec frontmatter code:·§1.2 park-entry 노트는 후속 planner spec-sync PR(developer spec read-only)`)이 이를 인지하고 후속 planner PR로 명시적으로 위임했음을 확인했다. 따라서 구현 자체는 규약 위반이 아니나 planner 측 후속 PR 추적 항목이 plan에 미등재 상태다.
- **제안**: `plan/in-progress/refactor/02-architecture.md` §M-4 완료 기록 내에 "후속 planner spec-sync 필요: `interaction-type-registry.md §1.2` park-entry 노트 + `4-execution-engine.md` `dispatchParkEntry`/`parkEntryRegistry` 진입점 등재" 항목을 추가하거나, 기존 `spec-sync-resume-dispatch-registry.md`(complete/)의 후속 doc-sync 를 커버하는 신규 planner plan 항목을 열어 추적한다.

---

### [INFO] 구현 범위가 plan 원안(2개 사이트)보다 확대 — 3개 사이트 일원화

- **target 위치**: diff `runExecution` 메인 루프·`executeInline` 중첩·`runNodeDispatchLoop` 드라이브 3개 사이트 모두 `dispatchParkEntry` 로 교체
- **관련 plan**: `plan/in-progress/refactor/02-architecture.md` §M-4 개선 방안 (line 228)
  - "retry-드라이브(1577-1616)·메인 루프(3700대) 두 중복 블록을 단일 `dispatchParkEntry(ctx)` 로"
- **상세**: plan 개선 방안은 "두 중복 블록"(retry-드라이브 + 메인 루프)을 명시했으나, 실제 구현은 `executeInline` 중첩 사이트(3944-3948)까지 세 곳을 일원화했다. plan에서도 `미착수` 라인에 `3944-3948`을 포함해 세 위치를 열거했으므로 구현 범위가 plan 의도에 부합한다. 단, 개선 방안 서술이 "두 중복 블록"이라고 명시해 추후 오해 소지가 있다. 실제로는 세 사이트 일원화임을 완료 기록에 명시하는 것이 좋다.
- **제안**: 완료 기록 시 "3개 사이트(`runNodeDispatchLoop`/`executeInline`/`runExecution`) 일원화" 로 명시. spec 설명에도 동일하게 반영(spec-sync PR에서 처리).

---

## 요약

M-4 구현 자체(ParkEntryDispatch registry 신설 + 3사이트 dispatchParkEntry 일원화)는 plan 의도와 정합하며, plan이 전제한 spec 선행 조건(`interaction-type-registry.md §1.2` park-entry 노트)을 "후속 planner PR"로 명시 위임한 점도 확인됐다. 주요 정합 위험은 두 가지다. ① plan 체크박스가 `[ ] 미착수`로 방치돼 추적 현황과 실제 상태가 어긋나고, ② spec 갱신 후속 planner PR이 plan에 추적 항목으로 등재되지 않아 이행이 누락될 우려가 있다. 두 항목 모두 plan 갱신으로 해소 가능하며 구현 롤백은 불필요하다.

## 위험도

LOW
