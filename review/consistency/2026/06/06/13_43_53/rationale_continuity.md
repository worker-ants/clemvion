# Rationale 연속성 검토 결과

검토 모드: `--impl-done`, scope=`spec/5-system/4-execution-engine.md`, diff-base=`origin/main`
검토일: 2026-06-06

---

## 발견사항

### [WARNING] PR-B2b 가 B3(in-memory 머신 완전 제거) 없이 D6(call-stack 영속)만 구현

- **target 위치**: `execution-engine.service.ts` `resumeFromCheckpoint` 내 `fireNested` 폴링 블록 (diff +1494~+1514); 정적 상수 `NESTED_FIRE_MAX_ATTEMPTS` / `NESTED_FIRE_POLL_MS` 선언; `waitForFormSubmission` / `waitForButtonInteraction` `parkMode='await'` 경로의 `pendingContinuations` 등록 코드(제거되지 않음).
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` `## Rationale` § "park 즉시 해제 + slow-path 일원화 (Phase B)", 특히 다음 항목:
  - "**PR-B2b(중첩 D6 + full B3)**: 중첩 `executeInline` blocking 의 durable 화(call-stack 영속 + 재귀 rehydration, exec-park D6)와, 그때 비로소 불필요해지는 in-memory 머신(`pendingContinuations`·`firstSegmentBarriers` 일가·`firePayload` scheduler·detached) **완전 제거(B3)**"
  - "**B1·B2 분리 불가**: ... `pendingContinuations` Map(worker-side fast-path)은 park 가 곧 세그먼트 종료가 되어 불필요해져 제거된다(B3)."
  - 과도기 잠정 잔존은 "PR-B2a 머지 후 ~ PR-B2b 전" 구간만 허용
- **상세**: 본 PR(PR-B2b)은 D6 재귀 rehydration(`driveCallStackResume` / `driveResumeFrame`)을 구현했으나, in-memory 머신(`pendingContinuations` + `fireNested` setTimeout 폴링)을 제거하지 않았다. `@todo full B3 에서 fireNested 폴링 자체를 제거(exec-park-durable-resume.md §B3)` 주석이 이를 명시한다. Rationale 는 D6 와 B3 를 "한 덩어리 변경"으로 선언하고 PR-B2b 가 두 가지를 함께 수행하도록 규정했으나, 구현은 D6 만 완료하고 B3 를 후속으로 남겼다.
- **제안**: (a) 현 PR 의 Rationale 번복을 명시적으로 기록한다 — `spec/5-system/4-execution-engine.md` `## Rationale` "단계적 롤아웃" 항의 PR-B2b 서술에 "D6 구현 완료, B3(in-memory 머신 제거)는 별도 PR-B2c 로 분리" 를 추가하고 과도기 허용 범위를 갱신한다. (b) 또는 현 PR 에 B3 제거를 포함한다. Rationale 갱신 없이 분리 구현 상태로 머지하면 "PR-B2b 완료 = D6+B3 동시" 라는 기존 합의 기록과 코드 실제 상태가 충돌한다.

---

### [WARNING] §7.5 재진입 알고리즘: spec 의 "재귀 executeInline" 와 구현의 "iterative driveResumeFrame" 불일치

- **target 위치**: `execution-engine.service.ts` `driveCallStackResume` 전체 — innermost frame 먼저 처리 후 bubble-up(`for i = frames.length-2 downto 0`) 방식; `executeInline` 재호출 없음.
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` §7.5 "중첩 sub-workflow 재개" step 2:
  - "top-level 그래프부터 `frames` 를 **outermost→innermost** 순회한다. 각 프레임의 `invokerNodeId`(sub-workflow 호출 노드)까지 전진한 뒤 **`executeInline` 을 재호출**해 해당 sub-workflow 프레임으로 내려간다."
- **상세**: spec 는 top-level에서 outermost frame 부터 `executeInline` 재귀 호출로 depth-first 진입하는 알고리즘을 명시했다. 구현은 `driveCallStackResume` 가 innermost frame 을 직접 `driveResumeFrame` 으로 처리한 뒤 bubble-up 하는 iterative 알고리즘을 선택했다. 의미론적으로 같은 결과를 낼 수 있지만 spec 에 기록된 "재귀 `executeInline` 재호출" 설계와 구현이 다르다. spec 의 알고리즘 기술은 "설계 확정안" 으로 명시되어 있어, 이를 의도적으로 변경한 것이라면 새 Rationale 가 필요하다.
- **제안**: `spec/5-system/4-execution-engine.md` §7.5 의 step 2를 실제 구현 알고리즘("innermost frame → `driveResumeFrame` + bubble-up iterative")으로 갱신하거나, 또는 `## Rationale` 에 "재귀 executeInline 대신 iterative driveResumeFrame 을 채택한 이유"(스택 깊이 제한 없음, `executeInline` 재호출 시 중복 DB lookup 비용 등)를 기록한다. 이 번경은 `project-planner` 위임 대상이다(spec 갱신 권한).

---

### [INFO] `waitForFormSubmission` JSDoc 의 `@todo` 표현 변경 — 원칙 보존 확인 필요

- **target 위치**: `execution-engine.service.ts` `waitForFormSubmission` JSDoc diff (+2012~+2024): `@todo` 가 "PR-B2/B3: Strategy 패턴 또는 함수 분리" → "full B3 에서: Strategy 패턴 추출 예정. exec-park-durable-resume.md §B3 참조" 로 변경.
- **과거 결정 출처**: `spec/5-system/4-execution-engine.md` `## Rationale` § "park 즉시 해제 + slow-path 일원화" — B3 완료 시 `waitForFormSubmission` 의 이원화(`'release'` vs `'await'`) 도 Strategy 패턴으로 추출 예정임이 암시.
- **상세**: 이전 JSDoc 은 "W15 OCP 약화" 를 언급했으나 새 JSDoc 에서 이를 삭제했다. 기술적 부채(`W15 OCP 약화`)가 spec 추적에서 사라지는 방향이나, 해당 TODO 는 B3 완료 시 함께 해소될 예정이므로 B3 가 후속 PR 로 분리된 현황에서 추적 가시성이 낮아질 수 있다.
- **제안**: B3 가 별도 PR 로 분리됨이 확정되면 plan/in-progress 의 exec-park-durable-resume.md 에 B3 잔여 TODO(OCP 약화 포함) 를 명시한다.

---

## 요약

이번 PR-B2b 구현은 exec-park D6(call-stack 영속 + `driveCallStackResume` 재진입)를 올바르게 도입하고 있으며, Rationale 의 핵심 원칙인 "bounded 메모리"·"단일 재개 경로"·"ParkReleaseSignal unwind"를 따르고 있다. 그러나 두 가지 Rationale 연속성 문제가 있다. 첫째, Rationale 는 PR-B2b 가 D6 와 full B3(in-memory 머신 완전 제거)를 "한 덩어리"로 수행한다고 명시했으나 구현은 B3 를 `@todo` 로 남겼고 Rationale 에 이 번경 근거가 없다. 둘째, §7.5 재진입 알고리즘이 spec 의 "재귀 `executeInline` outermost→innermost" 기술과 달리 "iterative innermost-first + bubble-up" 으로 구현됐으며 이 변경에 대한 spec 갱신이 동반되지 않았다. 두 항목 모두 Rationale 의 명시적 갱신 또는 spec 본문 정정이 필요한 WARNING 수준이다.

## 위험도

MEDIUM
