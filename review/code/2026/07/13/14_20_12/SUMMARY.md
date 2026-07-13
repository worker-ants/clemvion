# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 없으나, 신규 훅 `useEdgeExecutionState` 가 자매 훅(`useEdgeHighlighting`)이 확립한 "미변경 엣지는 참조 재사용" 최적화 패턴을 따르지 않아 실행 중 매 tick·노드 드래그마다 캔버스 전체 엣지가 재생성되는 문제를 성능(performance)·부작용(side_effect)·유지보수성(maintainability) 3개 리뷰어가 독립적으로 동일하게 지적했고, 여기에 신규 훅 단위 테스트 부재·주석-구현 불일치 등 WARNING 급 항목이 다수 누적되어 있다.

> **참고(데이터 갭)**: `user_guide_sync` 리뷰어는 매니페스트상 `status=success` 로 보고되었으나 해당 `output_file` 이 디스크에 존재하지 않는다(`ls` 로 확인, 세션 내 복구용 `journal.jsonl` 도 부재). 따라서 이 리뷰어의 실제 발견사항은 본 통합 보고서에 반영하지 못했다 — 알려진 "workflow disk-write gap" 패턴과 일치하므로, 호출자는 별도로 재확인/재실행할 것을 권장한다(아래 표에서는 "재시도 필요"로 표기).

## Critical 발견사항

없음 (모든 reviewer 기준 CRITICAL 항목 미발견)

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능/부작용 | 신규 훅 `useEdgeExecutionState` 가 자매 훅 `useEdgeHighlighting` 의 "미변경 엣지는 원본 참조 반환" bail-out 패턴을 따르지 않아, (a) 실행 중 노드 상태가 1건 바뀔 때마다(`nodeStatuses` 가 매번 새 `Map` 으로 교체) 캔버스의 **모든** 엣지가 새 객체로 재생성되고, (b) `disabledNodeIds` 가 `nodes` 배열 참조 전체에 의존해 실행 이력이 남아있거나 비활성 노드가 하나라도 있는 워크플로에서는 **노드 드래그 중에도** 무관한 전체 엣지가 재생성된다(조기 반환이 사실상 영구 우회). 결과적으로 `memo(CustomEdge)` 얕은 비교가 매번 실패해 전체 엣지 리렌더 캐스케이드 발생 — Loop/ForEach 반복 실행이나 노드 드래그 시 체감 가능한 UI jank 가능성 | `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` (L21-69), `codebase/frontend/src/lib/stores/execution-store.ts:554-559` | `useEdgeHighlighting` 과 동일한 per-edge bail-out(상태 불변 엣지는 원본 참조 반환) 적용. `disabledNodeIds` memo 키를 `nodes` 참조 대신 `isDisabled` 값들의 안정적 1차 표현(정렬된 id 문자열 join 등)으로 분리 |
| 2 | 테스트 | 신규 훅 `useEdgeExecutionState` 자체에 대한 `renderHook` 단위 테스트 부재(형제 훅 `use-edge-highlighting`/`use-edge-reconnect` 는 모두 보유하는 이 저장소의 확립된 관례). fast-path 참조 안정성, `disabledNodeIds`/`nodeStatusById` 파생, `className`/`edge.data.edgeInactive` 조립, `executing=true && nodeStatuses 빈 Map` 경계 케이스가 전혀 검증되지 않음 | `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` (신규, 대응 테스트 파일 없음) | `use-edge-highlighting.test.ts` 패턴으로 `use-edge-execution-state.test.ts` 신설 |
| 3 | 테스트 | `custom-edge.tsx` 의 `inactive` 스타일 분기(`opacity: 0.4, strokeDasharray: "6 4"`)와 뒤이은 `props.style` 스프레드의 우선순위 상호작용, `selected`/`isHighlighted` 와의 조합이 검증되지 않음 | `codebase/frontend/src/components/editor/canvas/custom-edge.tsx:29-34` | 스타일 조립을 순수 함수로 추출해 단위 테스트하거나 RTL 로 `style` 속성 assert |
| 4 | 문서화 | `custom-edge.tsx` 신규 인라인 주석이 "flowing 은 React Flow 내장 애니메이션이 처리"라고 서술하나, 실제로는 completed 와 동일하게 `className`(`wc-edge-flowing`) 을 globals.css 의 CSS `@keyframes`/`animation` 으로 소비하는 방식이다 — diff 어디에도 `edge.animated` 사용이 없어 "React Flow 내장 애니메이션" 자체가 이 구현에 존재하지 않음 | `codebase/frontend/src/components/editor/canvas/custom-edge.tsx` | 주석을 실제 메커니즘(className 기반 CSS 애니메이션)으로 정정 |
| 5 | 문서화 | `workflow-canvas.tsx` 주석 "두 관심사가 `edge.data` 로 합성"이 실제 구현(className Set 병합=하이라이트, `data.edgeInactive`=비활성)과 다르게 서술되어, 같은 PR 의 다른 파일 주석과 상충 | `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` | 두 파일의 주석 서술을 실제 메커니즘에 맞춰 통일 |
| 6 | 유지보수성 | 신규 CSS 클래스 접두사 `wc-`(`.wc-edge-flowing`, `.wc-edge-completed`, `@keyframes wc-edge-complete-flash`)가 같은 파일의 기존 무접두사 컨벤션(`edge-highlighted`, `node-edge-glow`, `edge-flow`)과 불일치하고, 별도 채널의 `WEBCHAT_`/`webchat-` 접두사와도 혼동 소지 | `codebase/frontend/src/app/globals.css:129-146`, `edge-utils.ts` | 접두사 없이 기존 명명과 통일(`edge-flowing`/`edge-completed`) 하거나 도입 배경을 주석으로 명시 |
| 7 | 사용자 문서 | 한국어 문서 신규 문구 "비활성(끈) 노드" — 어휘/오탈자 오류로 추정("끈"이 "꺼진"의 오역 가능성, 기존 관용 표현 "비활성화된"과 불일치, 영문판은 "disabled (turned-off)") | `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx:82` | "비활성(꺼진) 노드" 또는 "비활성화된 노드"로 수정 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처/테스트 | `resolveEdgeExecutionState` 의 `nodeStatusById` 타입이 실제 `NodeExecutionStatus` 유니온 대신 원시 `string` 으로 widening 되어, 스토어 status 값이 변경/리네이밍돼도 컴파일 타임에 잡히지 않고 조용히 회귀할 수 있음 | `use-edge-execution-state.ts`, `edge-utils.ts` (`resolveEdgeExecutionState` ctx 타입) | ctx 타입을 `ReadonlyMap<string, NodeExecutionStatus>` 로 좁히기 |
| 2 | 아키텍처 | `edge-utils.ts` 가 포트 색상·연결 유효성·드래그 조립·stale pruning·실행 상태 판정 등 응집도가 다른 축을 계속 축적 — 기존 관행의 연장이라 새 문제는 아니나 향후 파일 분할 검토 여지 | `codebase/frontend/src/lib/utils/edge-utils.ts` | 당장 조치 불요, §4/§5 작업 시 파일 분할 검토 |
| 3 | 요구사항 | `.wc-edge-flowing` 애니메이션이 error 포트 엣지를 제외하지 않음(기존 hover 하이라이트는 `:not([class*="error"])` 로 제외). spec 이 이 예외를 요구하지 않아 spec 위반은 아니며 의도/누락 여부가 모호한 회색지대 | `codebase/frontend/src/app/globals.css:65-68` vs 기존 hover 규칙 | 의도된 동작인지 별도 확인, 현재는 조치 불요 |
| 4 | 범위 | mdx 문서(ko/en) 프런트매터 `code:` 목록에 신규 `use-edge-execution-state.ts` 미등재(spec 파일의 `code:` 목록에는 정확히 반영됨) | `connecting-nodes.mdx`, `connecting-nodes.en.mdx` 프런트매터 | `code:` 목록에 `use-edge-execution-state.ts` 추가 |
| 5 | 문서화 | CHANGELOG §3.2 항목에 테스트 커버리지 언급 없음(인접 §1.3 항목은 명시) | `CHANGELOG.md` | "resolveEdgeExecutionState vitest 7케이스" 등 한 구절 추가(선택) |
| 6 | 유지보수성 | 마칭 점선 스타일(`stroke-dasharray`+`animation`)이 기존 hover 규칙과 신규 규칙에 완전히 동일하게 중복 선언됨 | `globals.css:97-101`, `:129-134` | comma-separated selector 또는 공용 클래스로 단일화 |
| 7 | 유지보수성 | `flowing`/`completed` 상호배타 className 결정이 중첩 삼항으로 구현되어 불변식이 코드로 강제되지 않음; `#22c55e` 가 포트색·flash색 두 의미로 중복 존재 | `use-edge-execution-state.ts:537-541`, `globals.css`/`edge-utils.ts` `PORT_TYPE_COLORS.data` | 선택 사항 — 조회 테이블/헬퍼 추출, 색상 값 의미 분리 주석 |
| 8 | 보안/의존성/DB | 신규 네트워크 호출·인증/인가·시크릿·외부 패키지·DB 스키마 변경 전혀 없음(순수 프런트엔드 파생 상태 로직) — 조치 불요 | 전체 diff | 해당 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 프런트엔드 프레젠테이션 변경, 인젝션/신규 네트워크 경로 없음 |
| performance | MEDIUM | 매 tick 전체 엣지 재생성 → memo 무효화, 반복 실행 시 누적 jank 가능성 |
| architecture | LOW | 3계층 분리는 양호. status 타입 widening, edge-utils.ts 응집도 확장 |
| requirement | LOW | spec line-level 일치 확인. 훅 단위테스트 부재·문서 어휘 오류 WARNING 2건 |
| scope | NONE | 11개 파일 모두 §3.2 구현에 정확히 수렴, 범위 이탈 없음. mdx code: 목록 누락만 INFO |
| side_effect | MEDIUM | `disabledNodeIds` 가 `nodes` 참조 전체 의존 → 드래그마다 전체 엣지 재생성(diff-0 불변식 무력화) |
| maintainability | LOW | `wc-` 접두사 불일치, 자매 훅과 다른 재렌더 최적화 전략 WARNING 2건 |
| testing | WARNING(내용상 LOW~MEDIUM) | 신규 훅 renderHook 테스트 부재, 경계 케이스·style 우선순위 미검증 |
| documentation | LOW | CHANGELOG/spec/plan/mdx 동반 갱신 양호하나 인라인 주석 2건이 실제 구현과 불일치 |
| dependency | NONE | 신규 외부 패키지 없음, 기존 스토어/keyframe 재사용 |
| database | NONE | DB/스키마/쿼리 관련 코드 전혀 없음 |
| user_guide_sync | 확인 불가 | **디스크 기록 누락(disk-write gap)** — output 파일 부재로 내용 반영 불가, 재시도 필요 |

## 발견 없는 에이전트

- **database** — DB 스키마·마이그레이션·쿼리·트랜잭션 관련 코드 전혀 없음(순수 프런트엔드 변경)
- **security(실질 발견 없음)** — 전 항목 INFO(조치 불요): 신규 네트워크/사용자입력/인증·인가/DOM 삽입 경로 없음
- **dependency(실질 발견 없음)** — 전 항목 INFO(조치 불요): 신규 외부 패키지·버전 변경·라이선스/취약점 이슈 없음

## 권장 조치사항

1. `useEdgeExecutionState` 에 `useEdgeHighlighting` 과 동일한 per-edge 참조 재사용(bail-out) 패턴을 적용해, 실행 중 tick 마다·노드 드래그마다 캔버스 전체 엣지가 무조건 재생성되는 문제를 해소한다(performance/side_effect/maintainability 3개 리뷰어 공통 지적, 가장 우선).
2. `disabledNodeIds` memo 의존성을 `nodes` 배열 참조 전체가 아니라 `isDisabled` 값들의 안정적 1차 표현으로 분리해, 드래그 중 불필요한 재계산을 차단한다.
3. `use-edge-execution-state.test.ts` 를 형제 훅 테스트 패턴(`renderHook`)으로 신설해 fast-path 참조 안정성·파생 로직·경계 케이스를 커버한다.
4. `custom-edge.tsx`/`workflow-canvas.tsx` 의 신규 인라인 주석을 실제 구현 메커니즘(className 기반 CSS 애니메이션, Set 병합)에 맞게 정정한다.
5. 한국어 사용자 문서 "비활성(끈) 노드" 어휘 오류를 수정한다("비활성(꺼진) 노드" 등).
6. CSS 클래스 접두사 `wc-` 의 컨벤션 정합성을 검토한다(기존 무접두사 명명과 통일하거나 도입 배경을 주석화).
7. mdx 문서(ko/en) 프런트매터 `code:` 목록에 `use-edge-execution-state.ts` 를 추가해 spec 의 SoT 목록과 정합시킨다.
8. `user_guide_sync` 리뷰어 결과가 디스크에 기록되지 않은 갭을 별도로 확인·재실행해 실제 발견사항 유무를 확정한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, user_guide_sync (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync (8명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | concurrency | 본 diff 는 순수 프런트엔드 파생 상태(useMemo) 로직으로 동시성 오케스트레이션·race condition·DB 트랜잭션 대상 코드가 없어 router 가 제외(구체 사유 텍스트는 매니페스트에 미포함, diff 성격상 추정) |
  | api_contract | 백엔드 API·wire 계약·DTO 변경이 전혀 없는 프런트엔드 전용 변경이라 router 가 제외(구체 사유 텍스트는 매니페스트에 미포함, diff 성격상 추정) |