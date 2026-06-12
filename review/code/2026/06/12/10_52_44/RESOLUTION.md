# RESOLUTION — code-snapshot-perf-ff751c / 2026/06/12/10_52_44

## 조치 항목

| SUMMARY # | 분류 | 상태 | 조치 commit | 비고 |
|-----------|------|------|-------------|------|
| WARNING #1 (W-D) | 코드 — Testing | FIXED | (이 커밋) | `jest.isolateModules` + `createSnapshot` mock 으로 DAYJS_SNAPSHOT=undefined fallback 경로 단위 테스트 추가. W-B의 console.warn도 이 테스트에서 실제 출력됨을 확인. |
| WARNING #2 (W-A) | 코드 — Maintainability | FIXED | (이 커밋) | `execute()` 내 isolate 생성 분기의 옵션 객체 중복 제거 — `ConstructorParameters<typeof ivm.Isolate>[0]` 타입의 `isolateOptions` 공통 객체로 리팩터, `DAYJS_SNAPSHOT` 유무에 따라 조건부 `snapshot` 추가 |
| WARNING #3 (W-C) | 코드 — Performance | WON'T FIX (근거 명시) | (이 커밋 — 주석만) | `ivm.Script`는 컴파일된 isolate에 바인딩되어 cross-isolate 재사용 불가(isolated-vm 제약). per-exec 신규 isolate 보안 모델상 모듈 레벨 1회 컴파일 공유 불가능. BOOTSTRAP_SOURCE(~70 LoC) 재컴파일 비용은 dayjs UMD 대비 미미하며 이번 최적화의 주목표(dayjs) 달성됨. 코드에 WON'T FIX 근거 주석 추가. |
| INFO #3 (W-B) | 코드 — Security/Observability | FIXED | (이 커밋) | DAYJS_SNAPSHOT IIFE `catch` 블록에 `console.warn('[CodeHandler] dayjs snapshot 생성 실패 — per-exec 컴파일 fallback 사용:', err)` 추가 |

## 코드 외 INFO 처리

| INFO # | 카테고리 | 처리 방침 |
|--------|----------|-----------|
| INFO #1 (SPEC-DRIFT) | spec §4 step 3 snapshot 경로 미기술 | DEFERRED — `project-planner` 위임. spec 파일: `spec/4-nodes/5-data/2-code.md §4 step 3`. 코드 변경 없음. |
| INFO #2 (SPEC-DRIFT) | spec §7.1 createSnapshot 메커니즘 미언급 | DEFERRED — `project-planner` 위임. spec 파일: `spec/4-nodes/5-data/2-code.md §7.1`. 코드 변경 없음. |
| INFO #4 (Testing) | 루프 내 중간값 검증 보강 | FIXED (저비용) — `stays consistent` 테스트의 루프에서 대표 구간 i=0, 12, 24 의 output 값 검증 추가 |
| INFO #5 (Architecture) | `execute()` 과도한 책임 / W4 미완료 | DEFERRED — 기존 `plan/in-progress/code-node-isolated-vm-followups.md` W4 항목으로 추적 중. 본 PR 범위 밖. |
| INFO #6 (Architecture) | 모듈 전역 가변 상태 | DEFERRED — W4와 함께 처리 권장. 본 PR 범위 밖. |
| INFO #7 (Documentation) | `DAYJS_LOAD_SCRIPT` dual-use 주석 미기술 | FIXED (저비용) — "Used both as the snapshot bootstrap script … and as the per-exec legacy compile fallback …" 주석 추가 |
| INFO #8 (Documentation) | describe 블록 상단 주석 중복 가능성 | CHECKED — 파일 전체 확인 결과 해당 블록 주석은 단 1개 존재(line 632-639). 중복 없음. 변경 불필요. |
| INFO #9 (Documentation) | `DAYJS_SNAPSHOT` 블록 주석에 메모리 상주 비용 미언급 | FIXED (저비용) — "NOTE: The snapshot ArrayBuffer lives for the lifetime of the Node.js process; it is not GC'd between requests (process-scoped memory cost, ~few hundred KB)." 1줄 추가 |
| INFO #10 (Performance) | 사용자 코드 `compileScript()` 매 exec 재실행 | DEFERRED — 단기 현 구조 수용. 중기적으로 `produceCachedData: true` + 코드 해시 keyed LRU 캐시 방안을 별도 plan 항목으로 검토. |
| INFO #11 (Side Effect) | 모듈 임포트 시점 IIFE 동기 실행 side-effect | NOTED — DAYJS_SNAPSHOT 블록 주석에 이미 충분히 기술됨. 추가 변경 불필요. |
| INFO #12 (Testing) | 메모리 한도 테스트 CI flakiness 모니터링 | NOTED — 기존 plan `code-node-isolated-vm-followups.md` 테스트 섹션에 반영 권장. 본 PR에서는 모니터링 노트로만 기록. |

## TEST 결과

- lint  : 통과 (0 errors, 0 warnings)
- unit  : 통과 (73 passed) — `code.handler.spec.ts` 전체
- build : 실행 안 함 (code-only 변경, 단위 테스트로 충분 — 호출자 지시에 따름)
- e2e   : skipped (면제 화이트리스트: code.handler.ts + code.handler.spec.ts 단독 변경, 호출자 명시 지시 "전체 e2e/build 는 불필요(code-only, 단위 테스트로 충분)")

## 보류·후속 항목

- **SPEC-DRIFT #1, #2**: `project-planner` 위임 — `spec/4-nodes/5-data/2-code.md` §4 step 3 및 §7.1에 snapshot 경로 기술 추가 필요
- **W4 (_buildIsolateContext 분리)**: `plan/in-progress/code-node-isolated-vm-followups.md` W4 항목으로 추적 중
- **사용자 코드 compileScript() LRU 캐싱**: 중기 검토 항목, 별도 plan 필요
- **메모리 한도 테스트 CI flakiness**: snapshot 활성화 후 `CODE_MEMORY_LIMIT` 테스트 CI 통과율 모니터링 권장
