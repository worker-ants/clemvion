# Code Review 통합 보고서

## 전체 위험도
**LOW** — §3.2 엣지 실행 상태 스타일 구현은 직전 ai-review(14_20_12) 라운드에서 지적된 CRITICAL 없음·WARNING 7건(전체 엣지 재생성 성능 문제, 훅 테스트 부재, 주석-구현 불일치, CSS 접두사 불일치, 국문 어휘 오류 등)을 실제 소스 레벨에서 모두 해소했다(10개 리뷰어가 각자 독립적으로 재확인). 신규 CRITICAL 은 없으며, 남은 항목은 테스트 커버리지 갭 2건(WARNING)과 다수의 경미한 INFO 뿐이다. 단, `user_guide_sync` 리뷰어는 `status=success` 로 보고됐으나 output 파일이 디스크에 존재하지 않아(disk-write 갭) 그 결과를 통합에 반영하지 못했다 — 재확인 필요.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `use-edge-execution-state.test.ts` 5케이스 전부 "renderHook 이전에 store 상태 세팅"만 검증하고, 이 훅의 존재 이유인 "재렌더 간 참조 안정성"(실행 tick·드래그 시 무관한 엣지가 원본 참조를 유지)을 실제로 재현하는 케이스가 없음(`act`+store 업데이트 후 `rerender` 패턴 부재). 형제 훅 `use-edge-highlighting.test.ts` 는 이 패턴을 이미 사용 중 | `codebase/frontend/src/components/editor/canvas/__tests__/use-edge-execution-state.test.ts` | `renderHook(...).rerender()` + `act(() => useExecutionStore.setState(...))` 로 (1) 무관한 엣지의 참조 유지(`toBe`), (2) `executing=true`인데 `nodeStatuses` 가 아직 빈 Map 인 과도 상태 케이스 추가 |
| 2 | testing / side_effect / maintainability (교차 확인) | `custom-edge.tsx` 의 `inactive` 스타일 분기와 `props.style` 스프레드 우선순위(마지막 적용) 상호작용이 여전히 미검증 — 직전 라운드(`14_20_12`)에서 이미 식별돼 `RESOLUTION.md` 에 "canvas RTL 하네스 부재로 이월" 로 명시적으로 defer 된 항목이며, 대응 테스트 파일이 아직 없음(`find` 0건). 현재 diff 범위에서 실질 회귀는 아니나 `edge.style` 을 채우는 경로가 추가되면 비활성 스타일이 조용히 무효화될 수 있음 | `codebase/frontend/src/components/editor/canvas/custom-edge.tsx` (`...(inactive ? {opacity:0.4, strokeDasharray:"6 4"} : {}), ...props.style`) | 스타일 조립을 `buildEdgeStyle(props)` 순수 함수로 추출해 단위 테스트하거나, §4 canvas RTL 하네스 도입 시 우선 편입(의도된 이월 — 신규 조치 강제 아님) |
| 3 | 프로세스/도구 (meta) | `user_guide_sync` 리뷰어가 `status=success` 로 보고했으나 output 파일(`user_guide_sync.md`)이 세션 디렉터리에 실제로 존재하지 않음(disk-write 갭) — 해당 리뷰 결과를 이번 통합 보고서에 반영하지 못함 | `review/code/2026/07/13/14_42_20/user_guide_sync.md` (부재) | 이 리뷰어를 단독 재호출해 결과 파일 존재를 확인한 뒤 SUMMARY 재통합 권장 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | requirement | `.edge-flowing` 마칭 점선 애니메이션이 error 포트 엣지를 제외하지 않음(기존 hover 하이라이트 규칙 `:not([class*="error"])`과 차이). spec 은 이 예외를 요구하지 않아 spec 위반은 아니며 직전 라운드에서도 동일하게 회색지대 INFO 로 이월됨 | `codebase/frontend/src/app/globals.css` `.edge-flowing .react-flow__edge-path` | 조치 불요(현행 유지). 필요 판단 시 후속 결정 |
| 2 | requirement | `edge-complete-flash` keyframe 이 0%/20% 만 정의(100% 미정의) — 20%~100% 구간엔 `animation-fill-mode` 기본값으로 20% 시점 색이 유지되다 1.2초 후 인라인 stroke 로 즉시 스냅백. spec 문구와 시각적으로 크게 어긋나지 않음 | `codebase/frontend/src/app/globals.css` `@keyframes edge-complete-flash` | 조치 불요. 페이드아웃 원하면 100% 키프레임에 명시적 색상 추가 검토 |
| 3 | performance | `nodeStatusById` Map 이 상태 변경마다 O(V) 전체 재구축(노드 수 상한 있어 실사용 규모 무위험) | `use-edge-execution-state.ts` | 조치 불요. 그래프가 매우 커지면 store API 를 diff 기반으로 확장 고려(현재는 과설계) |
| 4 | performance | `disabledKey`(`ids.sort().join(",")`) 가 무관한 노드 드래그로 `nodes` 참조가 바뀔 때마다 O(N log N) 재계산 — 더 비싼 O(E) 엣지 재구성을 피하기 위한 합리적 트레이드오프 | `use-edge-execution-state.ts` (`disabledKey` useMemo) | 조치 불요 |
| 5 | performance | `disabledKey` 콤마 join 방식은 이론상 노드 id 에 콤마가 포함되면 키 충돌 가능(현재 UUID/nanoid 류라 실질 위험 낮음) | `use-edge-execution-state.ts` | 조치 불요. 방어적으로 `JSON.stringify(ids)` 등 고려 가능(과설계 소지) |
| 6 | maintainability / architecture | flowing/completed 상호배타 판정이 중첩 삼항으로 구현되어 "동시에 true 일 수 없다"는 불변식이 타입 시스템이 아닌 주석·구현에만 의존 | `use-edge-execution-state.ts` | 상태 종류 확장 시 조회 테이블/헬퍼로 추출 검토(현행 유지 가능) |
| 7 | maintainability | 마칭 점선 CSS 선언이 기존 hover 하이라이트 규칙과 신규 `.edge-flowing` 규칙에 완전히 동일하게 중복(값 변경 시 이중 관리 지점) | `codebase/frontend/src/app/globals.css` | comma-separated selector 또는 공용 클래스로 단일 소스화(우선순위 낮음) |
| 8 | maintainability | `#22c55e` 가 CSS 키프레임(`edge-complete-flash`)과 TS 상수(`PORT_TYPE_COLORS.data`)에 의미가 다름에도 이중 하드코딩(우연히 같은 색) | `globals.css`, `edge-utils.ts` | 조치 불요. 후속 리팩터 시 "포트색과 무관한 고정 성공색"임을 주석으로 명시 권장 |
| 9 | maintainability / architecture | 실행 상태 훅(`useEdgeExecutionState`, overwrite 방식)과 하이라이팅 훅(`useEdgeHighlighting`, Set 병합 방식)이 서로 다른 className 합성 전략을 사용 — 현재는 적용 순서가 우연히 안전하나, 3번째 훅 추가나 순서 변경 시 조용히 className 유실 가능(타입으로 강제되지 않는 OCP 계약) | `use-edge-execution-state.ts` vs `use-edge-highlighting.ts`, 배선: `workflow-canvas.tsx` | 현재 2개 훅 규모에선 조치 불요. 3번째 스타일링 훅 추가 시 `mergeEdgeClassName` 같은 공용 헬퍼로 계약을 코드 레벨로 강제 권장 |
| 10 | maintainability / architecture | `edge-utils.ts` 응집도 지속 확장(포트 색상·연결 유효성·드래그 조립·stale pruning·이제 실행 상태 판정까지 누적) — 직전 라운드부터 이월된 기존 항목, 이번 diff 의 신규 문제 아님 | `codebase/frontend/src/lib/utils/edge-utils.ts` | 조치 불요. §4/§5 후속 작업 시 파일 분할 여지 검토 |
| 11 | testing | `resolveEdgeExecutionState` 가 `completed`/`running` 외 `NodeExecutionStatus`(`failed`/`cancelled`/`skipped`/`waiting_for_input`) 조합에 대한 명시적 테스트 없음(예: target 이 `failed` 로 전이 시 flowing/completed 모두 false 인지) | `edge-utils.test.ts` | `it("target 이 failed 면 flowing/completed 모두 false")` 등 1~2 케이스 추가 권장(선택) |
| 12 | testing | `flowing` 판정의 방향 역전 케이스(source `running` + target `completed`) 가 `flowing:false` 임을 확인하는 테스트 없음 | `edge-utils.test.ts` | 역방향 조합 1케이스 추가 권장 |
| 13 | testing | `edge.data` 의 기존 임의 필드(예: `portType`) 보존 여부를 명시적으로 검증하는 회귀 테스트 없음(현재 스프레드 구현은 정확하나 향후 리팩터 시 유실이 조용히 발생해도 못 잡음) | `use-edge-execution-state.ts` 대응 테스트 | `edge()` 헬퍼에 사전 `data` 필드를 부여한 케이스 추가 권장 |
| 14 | testing | `useEdgeExecutionState` → `useEdgeHighlighting` 합성(className 공존)을 검증하는 통합 테스트 부재 — canvas RTL 하네스 부재로 §4 오케스트레이션 시 편입 예정(기존 결정 이월) | `workflow-canvas.tsx:164-166` | 조치 불요(§4 로 이월된 기존 결정 유지) |
| 15 | documentation | 한국어 사용자 문서의 "비활성(꺼진) 노드"(정정 완료)가 같은 문서군의 기존 관용 표현 "비활성화된 노드"(`editing-nodes.mdx`)와 형태가 완전히 통일되지는 않음(오류 아님, 차단 대상 아님) | `connecting-nodes.mdx:82` | 선택 사항 — 다음 편집 시 용어 형태 통일 검토 |
| 16 | scope (참고) | diff 에 직전 ai-review 세션(`review/code/2026/07/13/14_20_12/*`) 산출물 16개(RESOLUTION.md, SUMMARY.md, meta.json, _retry_state.json, 리뷰어 .md 등)가 신규 파일로 포함됨 — 저장소 관례상 `review/` 커밋은 정상 워크플로우이며 범위 이탈 아님 | `review/code/2026/07/13/14_20_12/*` | 조치 불요. 리뷰 시 이 파일들을 "코드 변경"으로 오인해 별도 실질 코드 리뷰를 요구하지 않도록 유의 |
| 17 | side_effect | `edge.data.edgeInactive` 가 조건 없이 부여됨(false 값도 명시) — 현재 저장 경로로 되먹임되지 않아 영속화 오염 위험 없음. 향후 캔버스 파생 edges 를 저장 경로에 연결하는 변경이 생기면 `data` strip 단계 필요 | `use-edge-execution-state.ts:80-89` | 조치 불요(현재). 향후 저장 경로 연결 시 유의 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 순수 프런트엔드 프레젠테이션 변경, 신뢰 경계를 넘는 문자열 삽입 경로 없음. 보안 우려 없음 |
| performance | NONE | 직전 라운드 CRITICAL 성능 회귀(전체 엣지 재생성)가 per-edge bail-out + 안정 disabledKey 로 해소 확인. 잔여는 O(V)/O(N log N) 수준 무해 INFO 뿐 |
| architecture | LOW | 3계층 분리(순수 판정→어댑터 훅→프레젠테이션) 양호, SOLID/순환의존 문제 없음. 훅 합성 순서 계약이 타입으로 미강제(낮은 리스크 참고) |
| requirement | NONE | spec §3.2 표·함수 시그니처·필드명·색상·우선순위 line-level 일치 확인(71/71 테스트, tsc 0 진단). 잔여 2건은 spec 이 침묵하는 회색지대 INFO |
| scope | NONE | 27개 변경 파일 전체가 §3.2 구현 하나로 수렴, over-engineering·무관 리팩터링 없음 |
| side_effect | NONE | 전역 스토어 읽기 전용 소비, SoT(editor-store) 미오염, 공개 API 파괴적 변경 없음 |
| maintainability | NONE | 직전 라운드 WARNING 7건 모두 해소 확인. 남은 항목은 전부 이월된 경미 INFO |
| testing | LOW | 핵심 로직 71케이스 통과하나, 훅의 핵심 설계 목적(재렌더 간 참조 안정성)을 재현하는 테스트 부재(WARNING) + custom-edge.tsx 스타일 상호작용 미검증(이월 WARNING) |
| documentation | LOW | 직전 라운드 WARNING 2건·INFO 3건 전부 해소 확인(주석-구현 일치, mdx code: 동기화, CHANGELOG 테스트 언급, CSS 접두사 통일). 잔여 1건은 경미한 용어 통일성 참고 |
| user_guide_sync | 재확인 필요 | output 파일이 디스크에 없음(disk-write 갭) — 결과 미반영 |

## 발견 없는 에이전트

- security, scope, side_effect, maintainability — CRITICAL/WARNING 없이 INFO 또는 확인용 기재만 존재.

## 권장 조치사항

1. (선택, 낮은 우선순위) `use-edge-execution-state.test.ts` 에 `rerender`+`act(store.setState)` 기반 참조 안정성 테스트를 추가해 훅의 핵심 설계 목적(재렌더 간 bail-out)을 실제로 가드할 것.
2. `user_guide_sync` 리뷰어를 단독 재호출해 output 파일 존재를 확인하고 SUMMARY 를 재통합할 것(disk-write 갭 재발 방지).
3. (선택, §4 이월) `custom-edge.tsx` 의 `inactive`/`props.style` 우선순위 상호작용을 canvas RTL 하네스 도입 시 편입해 검증할 것 — 현재는 실질 회귀 아님.
4. 그 외 INFO 항목(CSS 중복 선언, 색상 이중 하드코딩, edge-utils.ts 응집도, 훅 합성 전략 비대칭 등)은 즉시 조치 불요 — 후속 리팩터/§4·§5 작업 시 함께 검토.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, user_guide_sync` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing, user_guide_sync, performance` (9명 — architecture 를 제외한 실행 전원이 router_safety 강제 포함 대상이었음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | diff 가 순수 프런트엔드 프레젠테이션 변경(신규 패키지 의존성·버전 변경 없음)이라 라우터가 무관 판단 |
  | database | 백엔드/DB/wire 프로토콜 변경 전혀 없음 — 전 리뷰어가 공통 확인한 사실과 일치 |
  | concurrency | 신규 동시성 프리미티브(락·트랜잭션·비동기 경합) 없음, 순수 useMemo/useSelector 파생 상태 |
  | api_contract | 신규 API 엔드포인트·DTO·wire 스키마 변경 없음 |