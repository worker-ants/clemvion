# RESOLUTION — execution §1.3 single-node execution

리뷰 세션: `review/code/2026/06/15/15_05_56` (Critical 0 / Warning 18). Critical 없음 — push 비차단. Warning 18건은 아래대로 조치(FIX) / 근거 기록 후 보류(DEFER).

## FIX (코드/테스트/문서 조치)

| # | 조치 |
|---|------|
| W-4 | `handleRunThisNode` 의 `useExecutionStore.getState()` 가 stale closure 가 아니라 **클릭 시점 live 스냅샷**임을 주석으로 명시(자주 바뀌는 status 구독 회피 의도). |
| W-6 | engine 단위 테스트에 완료 `outputData` 검증 추가 — `updateExecutionStatus(COMPLETED)` guarded UPDATE param 에서 persisted output_data 를 파싱해 대상 노드(node-2) 출력과 일치 확인(resultNodeId=singleNodeId 회귀 가드). |
| W-7 | 비-canonical(bare) predecessor `outputData` seed 경로 단위 테스트 추가(`{seeded:99}` → `wrapBareAsNodeHandlerOutput` 폴백 → flat 입력 확인). |
| W-9 | controller 테스트에 workspace-404(`findById` throw) 케이스 추가 — node 조회·engine 미호출 확인. |
| W-11 | spec §1.3 범위 한계에 "disabled 노드 대상 시 skip 처리되어 빈 결과로 완료" 1행 추가. |
| W-12 | `wrapBareAsNodeHandlerOutput` 이 null/scalar/array/object 전부 throw 없이 안전 처리함을 확인(어댑터 코드) + 주석 보강 + W-7 테스트로 커버. 추가 방어 코드 불필요. |
| W-13 | canonical 판별 인라인 로직 제거 → `handler-output.adapter.ts` 에 `isCanonicalHandlerOutput` 타입 가드 export, engine 이 참조(도메인 지식 SoT 단일화). |
| W-14 | `saveWorkflow()` await 후 execution status 재확인(TOCTOU) 추가. |
| W-15 | catch 블록 silent-fail 의도(기존 handleRun 패턴, v1) 주석 명시. |
| W-16 | `InfoTab` 의 `nodeId` prop 추가 배경 주석 명시. |
| W-17 | 유저 가이드 `05-run-and-debug/running-a-workflow.mdx`(.en) 에 "이 노드 실행 / Run this node" 섹션 추가(ko/en parity). |
| I-21 | spec §1.3 출력 행에 "대상 노드만 타임라인 표시" 명시(SPEC-DRIFT 해소). |
| I-31 | `getLatestPredecessorOutputs` 정렬에 `id: DESC` tie-break 추가(finishedAt 동점 비결정성 제거). |

## DEFER (근거 기록 후 보류 — 비차단)

| # | 근거 |
|---|------|
| W-1 / W-2 | **기존 패턴 일관**: `WorkflowsController` 는 이미 `nodeRepository` 를 직접 주입·사용한다(execute() 트리거 파라미터 스키마 조회). `executionRepository` 추가는 동일 선례를 따른 것으로, 단일 노드 검증만 service 레이어로 분리하면 같은 컨트롤러 내 비대칭이 생긴다. `WorkflowsModule` 의 `forFeature([Execution])` 도 같은 이유. 컨트롤러 전반의 레이어 정리는 별도 리팩토링 과제. |
| W-3 | **선재(先在) 이슈 + 최소 면적**: `ExecutionEngineService` 비대화는 기존 알려진 사안으로 클래스 JSDoc 에 점진적 분해(PR-H/I) 가 이미 기록돼 있다. 본 변경은 `if (singleNodeId)` 분기 + 소형 private 헬퍼 2개로 면적이 작다. 기존 분해 트랙에 위임. |
| W-5 | **데이터 누출 불가**: controller 가 previousExecutionId 의 workflow 소속을 검증한다. 추가로 `getLatestPredecessorOutputs` 는 `nodeId IN (현재 워크플로우의 직속 predecessor id)` 로 필터하는데, 노드 id 는 워크플로우 스코프 UUID 라 타 워크플로우 실행의 행은 매칭되지 않는다 → 2차 검증 없이도 cross-workflow seed 불가. |
| W-8 | **단위로 충분히 커버**: predecessor seeding 로직(canonical + bare)을 engine 단위 테스트가 결정적으로 검증(W-6/W-7). multi-node saveCanvas e2e 구성은 비용 대비 추가 가치 낮음. e2e F/G/H 가 엔드포인트 경로를 커버. |
| W-10 | **기존 커버리지 수준 일관**: `handleRunThisNode` 는 테스트 없는 기존 `handleRun`(toolbar) 패턴을 그대로 따른다. 신규 i18n 키는 parity 가드가 강제. 프론트 RTL 추가는 후속. |
| W-18 | **저위험(디버그 전용)**: `getLatestPredecessorOutputs` 는 노드 1개의 **직속 predecessor** 만 조회(소수). LIMIT 부재 영향 미미. 대규모 시 DISTINCT ON 전환은 후속. |
| I-1~I-20, I-22~I-33 | 정보성/정상 확인 — 별도 조치 불필요(필요 시 후속). |

## 검증
fix 반영 후 affected 테스트 재수행(engine spec·controller spec) + lint·build·e2e 재수행. fix 가 리뷰 시각을 postdate 하므로 fresh `/ai-review` 1회 추가 수행(clean 수렴 확인).
