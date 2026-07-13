# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 코드 자체(§3.2 엣지 실행 상태 스타일)는 3회차에 걸쳐 CRITICAL/WARNING 없이 수렴했으나, `scope`/`documentation`/`user_guide_sync` 3개 reviewer 가 매니페스트상 `status=success` 임에도 출력 파일이 디스크에 실재하지 않아(disk-write gap) 실제 발견사항이 유실됐을 위험이 있고, 특히 이 3개는 라우터가 이번 diff(CHANGELOG/mdx/spec/plan 변경)를 근거로 `router_safety` 강제 포함시킨 도메인 적합 reviewer라 공백이 더 유의미하다. 여기에 testing 리뷰어의 WARNING 2건(핵심 성능 수정·문서 약속 동작에 대한 자동화 회귀 가드 부재)이 더해져 MEDIUM 으로 판정한다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | 이번 3라운드 diff 의 핵심 성능 수정("노드 드래그로 `nodes` 참조가 바뀌어도 무관한 엣지가 재계산되지 않는다")을 검증하는 자동화 테스트가 없음. 7개 renderHook 케이스 중 어느 것도 `nodes` 를 새 참조/새 객체로 교체한 뒤 `disabledKey`/결과 배열 참조가 유지되는지 확인하지 않음 | `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-execution-state.test.ts`(전체 7케이스), 대상 로직 `use-edge-execution-state.ts` `disabledKey`/`disabledNodeIds` memo | `renderHook`+`rerender({ nodes: nodes.map(n => ({...n})) })` 로 결과 배열 참조가 `toBe` 동일함을 단언하는 케이스 추가 |
| 2 | 테스트 | mdx 사용자 문서가 명시적으로 약속하는 "비활성 노드 재활성화 시 엣지가 원래대로 복귀" 동작의 rerender 토글(disabled→enabled) 회귀 테스트 부재 | `use-edge-execution-state.test.ts`(전체), `connecting-nodes.mdx`/`connecting-nodes.en.mdx` | `isDisabled: true→false` rerender 후 `edge.data.edgeInactive`가 `false`로, 필요 시 `className`도 갱신되는지 단언하는 케이스 1개 추가 |
| 3 | 리뷰 인프라(disk-write gap) | `scope` reviewer 가 매니페스트상 `status=success` 이나 출력 파일이 디스크에 존재하지 않음 — 실제 스코프 관점 발견사항이 있었는지 확인 불가(false-clean 위험) | `<session_dir>/scope.md`(부재) | scope reviewer 재실행 후 본 SUMMARY 갱신. 재실행 전까지 이 diff 의 스코프 적합성은 미검증 상태로 취급 |
| 4 | 리뷰 인프라(disk-write gap) | `documentation` reviewer 가 `status=success` 이나 출력 파일 부재. 이번 diff 는 CHANGELOG/mdx/plan/spec 다수 변경을 포함해 documentation reviewer 의 핵심 도메인과 정확히 겹치는데도(router_safety 강제 포함 사유도 "문서 파일 변경") 그 결과가 유실됨 | `<session_dir>/documentation.md`(부재) | documentation reviewer 재실행 필수(다른 도메인 대비 이번 diff 와의 관련성이 가장 높음) |
| 5 | 리뷰 인프라(disk-write gap) | `user_guide_sync` reviewer 가 `status=success` 이나 출력 파일 부재. mdx 사용자 가이드(ko/en)와 구현 정합성 검증이 라우터에 의해 강제 포함됐으나 결과 유실 | `<session_dir>/user_guide_sync.md`(부재) | user_guide_sync reviewer 재실행 필수 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/부작용(해소 확인) | 1차 라운드에서 지적된 "노드 드래그·실행 tick마다 캔버스 전체 엣지 재생성 → `memo(CustomEdge)` 무효화" MEDIUM 이슈가 per-edge bail-out(`className === edge.className && state.inactive === prevInactive`)과 안정적 `disabledKey`(정렬 join)로 실제 해소됨을 performance/side_effect/architecture/maintainability 4개 reviewer 가 소스 레벨로 교차 재확인 | `use-edge-execution-state.ts` | 없음(확인 완료). bail-out 로직 리팩터링 시 관련 renderHook 테스트 통과 여부 재확인 |
| 2 | 요구사항 | `flowing` 판정이 `status==='running'` 에만 게이트되어, 다른 분기가 `waiting_for_input` 인 동안은 무관 분기의 flowing 표시가 나타나지 않음 — spec §3.2 본문도 이 케이스를 다루지 않아 구현이 spec 을 정확히 따른 것(SPEC-DRIFT 아님, 회색지대) | `use-edge-execution-state.ts`(`executing = s.status === 'running'`) vs `execution-store.ts` `ExecutionStatus` | 조치 불요. 병렬 분기 중 waiting_for_input 실제 발생 가능성·UX 의도는 별도 확인 과제 |
| 3 | 아키텍처 | `useEdgeExecutionState`→`useEdgeHighlighting` 합성 순서·병합 전략(overwrite vs Set 병합) 계약이 타입이 아닌 주석으로만 강제됨 — 현재 2-훅 규모에서 리스크 낮음 | `workflow-canvas.tsx`, `use-edge-execution-state.ts` vs `use-edge-highlighting.ts` | 세 번째 엣지 스타일링 훅 추가 시 `mergeEdgeClassName` 같은 공용 헬퍼로 병합 전략 코드화 권장 |
| 4 | 유지보수성 | `edge-utils.ts` 응집도 지속 확장(포트색상/연결유효성/드래그조립/stale pruning/실행상태판정 누적), `nodeStatusById: ReadonlyMap<string, string>` 이 store 의 `NodeExecutionStatus` 유니온 대신 원시 string 으로 widening(오타 시 컴파일타임 미검출) | `edge-utils.ts` | §4/§5 작업 시 파일 분할·타입 강화 검토(기존 결정 유지, 신규 이슈 아님) |
| 5 | 유지보수성 | `#22c55e` 값이 CSS keyframe(`edge-complete-flash`)과 TS 상수(`PORT_TYPE_COLORS.data`)에 의미가 다름에도 이중 하드코딩; 마칭 점선 CSS 선언이 두 selector 에 완전 중복 | `globals.css`, `edge-utils.ts` | 주석으로 의미 구분 명시 또는 공용 클래스/comma-separated selector 로 단일화(우선순위 낮음) |
| 6 | 성능 | `disabledKey`(`ids.sort().join(",")`)의 콤마 구분자가 이론상 캐시키 충돌 가능(노드 id 가 UUID/nanoid 라 실질 위험 낮음) | `use-edge-execution-state.ts` `disabledKey` | 방어적으로 `JSON.stringify(ids)` 등 콤마 비의존 인코딩 고려 가능(비필수) |
| 7 | 테스트 | `buildEdgeStyle` 상호 조합(`selected && inactive` 등) 명시적 케이스 없음, `edge.data` 기존 임의 필드(`portType`) 보존 회귀 테스트 없음, disabled 노드 2개 이상 시 `disabledKey` 정렬 안정성 직접 검증 없음 | `edge-utils.test.ts`, `use-edge-execution-state.test.ts` | 선택적 보강 케이스 각 1개 추가 권장 |
| 8 | 문서 | 한국어 사용자 문서 어휘가 문서군 내 완전히 통일되지 않음("비활성(꺼진) 노드" vs "비활성화된 노드") — 오류 아님 | `connecting-nodes.mdx` | 다음 mdx 편집 시 용어 통일 검토(선택) |
| 9 | 리뷰 인프라 | 이전 2회 ai-review 라운드(`14_20_12`, `14_42_20`) 및 이번 라운드 산출물이 diff 에 커밋됨 — 저장소 관례상 `review/`는 커밋 대상이며 시크릿/민감정보 없음 확인(grep) | `review/code/2026/07/13/{14_20_12,14_42_20}/*` | 없음(저장소 관례와 일치) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 프레젠테이션 변경, 신규 네트워크/입력/DOM삽입 경로 없음 — 보안 표면 미확장 |
| performance | NONE | 1차 MEDIUM(전체 엣지 재생성) 해소 재확인, O(V+E) per-tick 이하 잔여는 전부 INFO |
| architecture | LOW | 3계층 분리 양호·순환의존 없음, 훅 합성 계약이 타입 미강제(INFO) |
| requirement | NONE | spec↔구현 line-level 일치 재검증, `vitest run` 80/80·`tsc --noEmit` 0진단 직접 실행 확인 |
| scope | 알 수 없음 (disk-write gap) | 출력 파일 부재로 발견사항 확인 불가 — 재실행 필요 |
| side_effect | NONE | SoT(`editor-store.edges`) 비오염, clobber 없음, 이전 성능 수정 소스 레벨 재확인 |
| maintainability | NONE | 이월 INFO 6건 외 신규 CRITICAL/WARNING 없음, 애플리케이션 코드 2회차 이후 무변경 확인 |
| testing | LOW | WARNING 2건 — 핵심 성능 수정(드래그 참조안정성)·문서 약속 동작(재활성화) 회귀 가드 부재 |
| documentation | 알 수 없음 (disk-write gap) | 출력 파일 부재 — 이번 diff 와 도메인 겹침 커서 재실행 우선순위 최상 |
| dependency | NONE | 신규 외부 의존성·package.json/lock 변경 없음 |
| user_guide_sync | 알 수 없음 (disk-write gap) | 출력 파일 부재로 mdx 정합성 확인 불가 — 재실행 필요 |

## 발견 없는 에이전트

security, performance, dependency — 실질 조치사항 없이 "문제 없음" 확인성 INFO 만 존재.

## 권장 조치사항

1. `scope`/`documentation`/`user_guide_sync` 3개 reviewer 를 재실행해 disk-write gap 을 해소하고, 실제 발견사항 유무를 확인한 뒤 본 SUMMARY 를 갱신한다(특히 documentation·user_guide_sync 는 이번 diff 의 CHANGELOG/mdx/spec/plan 변경과 도메인이 정확히 겹쳐 우선순위가 가장 높다).
2. testing WARNING #1(드래그 시 `nodes` 참조 변경에도 무관 엣지 재계산 안 됨)에 대한 `renderHook`+`rerender` 회귀 테스트를 추가한다 — 이는 3라운드에 걸친 성능 수정의 유일한 자동화 가드가 된다.
3. testing WARNING #2(비활성 노드 재활성화 시 `edgeInactive` 해제)에 대한 rerender 토글 테스트를 추가해 mdx 문서가 약속하는 동작을 실제로 보증한다.
4. 나머지 INFO(edge-utils.ts 응집도, 색상값 이중 하드코딩, CSS 중복 선언, 훅 합성 계약 미강제, 국문 어휘 미세 불일치)는 현재 조치 불요 — §4/§5 후속 작업 또는 세 번째 엣지 스타일링 훅 추가 시점에 재검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, user_guide_sync` (11명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync` (8명)
  - **제외**: 아래 표 (3명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | database | 이번 diff 에 DB 스키마/쿼리 변경 없음(순수 프런트엔드 프레젠테이션 로직) |
  | concurrency | 동시성 제어 대상 코드(락/트랜잭션/큐) 변경 없음 |
  | api_contract | API 계약(엔드포인트/DTO/스키마) 변경 없음 |