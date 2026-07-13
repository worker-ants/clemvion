# Resolution — edge §3.2 ai-review (2026-07-13 14:20)

원 리뷰 위험도 **MEDIUM** (CRITICAL 0, WARNING 7). disk-write gap(user_guide_sync)은 journal.jsonl 로 복구 → NONE(frontmatter code INFO만, 아래 반영).

## WARNING

| # | 카테고리 | 발견 | 조치 |
|---|----------|------|------|
| 1 | 성능/부작용/유지보수(3리뷰어 공통) | `useEdgeExecutionState` 가 sibling `useEdgeHighlighting` 의 per-edge bail-out 을 안 따라 실행 tick 마다·노드 드래그마다 전체 엣지 재생성 → `memo(CustomEdge)` 무효화 | **반영** — (a) **per-edge bail-out**: 부여할 className·inactive 가 직전과 같으면 원본 엣지 객체 참조 반환(무상태 엣지는 재사용), 아무것도 안 바뀌면 원본 배열 반환. (b) **안정 disabledKey**: 비활성 집합을 `nodes` 참조가 아니라 disabled id 정렬 join 에 의존 → 드래그(위치만 변경)로 재계산 안 됨. |
| 2 | 테스트 | 신규 훅 renderHook 테스트 부재(sibling 훅 관례) | **반영** — `use-edge-execution-state.test.ts` 신설(5케이스): early bail-out 참조 안정·inactive·flowing·completed className·per-edge bail-out 참조 안정. |
| 3 | 테스트 | `custom-edge.tsx` inactive 스타일 분기·props.style 우선순위 미검증 | **이월** — inactive 스타일은 `{opacity:0.4, strokeDasharray}` 조건부의 얇은 glue 이고, 상태 플래그 생성 로직은 `resolveEdgeExecutionState`(7) + `useEdgeExecutionState`(5) 로 전수 검증됨. canvas RTL 하네스 부재(§1.2/§1.3 4라운드 반복 확인)로 §4 오케스트레이션 정리 시 편입. |
| 4 | 문서 | `custom-edge.tsx` 주석 "flowing=React Flow 내장 애니메이션" 오기(실제 className+CSS) | **반영** — className(`edge-flowing`)+globals.css 애니메이션으로 정정. |
| 5 | 문서 | `workflow-canvas.tsx` 주석 "두 관심사가 edge.data 로 합성" 부정확 | **반영** — className(flowing/completed)+`data.edgeInactive` / 하이라이트 className Set 병합으로 정정. |
| 6 | 유지보수 | CSS 접두 `wc-` 가 기존 무접두 컨벤션(`edge-highlighted`/`edge-flow`)과 불일치 | **반영** — `wc-edge-flowing`/`wc-edge-completed`/`wc-edge-complete-flash` → `edge-flowing`/`edge-completed`/`edge-complete-flash`(edge-utils 상수·CSS·spec·CHANGELOG·plan 전파). |
| 7 | 사용자 문서 | ko "비활성(끈) 노드" 어휘 오류 | **반영** — "비활성(꺼진) 노드". |

## INFO(반영/이월)
- frontmatter `code:` mdx 누락(user_guide_sync/#4) → **반영**(connecting-nodes.mdx 에 `use-edge-execution-state.ts` 추가). CHANGELOG 테스트 언급(#5) → **반영**.
- nodeStatusById 타입 `string`→`NodeExecutionStatus` 좁히기(#1) → 이월(edge-utils 가 store 타입 의존하지 않게 유지, 리터럴 비교로 충분). 마칭 점선 CSS 중복(#6)·flowing error-포트 미제외(#3 gray-area)·edge-utils.ts 응집도(#2) → INFO 이월.

## 검증
- tsc `--noEmit` clean · vitest **71 passed**(edge-utils 66 + hook renderHook 5) · eslint 0 errors
- e2e `make e2e-test-full` + fresh `/ai-review` 후속(수렴 확인).
