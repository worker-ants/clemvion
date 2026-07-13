### 발견사항

- **[INFO]** `.edge-flowing` 마칭 점선 애니메이션이 error 포트 엣지를 제외하지 않음 (기존 hover 하이라이트 규칙 `:not([class*="error"])`과 차이)
  - 위치: `codebase/frontend/src/app/globals.css` `.edge-flowing .react-flow__edge-path`(§3.2 Edge execution-state styles 블록) vs 기존 `[data-edge-focus-active] .react-flow__edge.edge-highlighted:not([class*="error"])`
  - 상세: source 가 완료됐지만 error 포트를 통해 나간 엣지(정상 completed 경로가 아닌 에러 분기)도 target 이 running 이면 "flowing" 스타일을 받는다. spec §3.2 본문·Rationale 모두 이 예외를 요구하지 않아 spec 위반은 아니다. 직전 리뷰 라운드(`review/code/2026/07/13/14_20_12/requirement.md`)에서도 동일하게 회색지대 INFO 로 판정된 항목이며 이번 diff 에서 그대로 이월됨(의도/누락 판단은 여전히 모호).
  - 제안: 조치 불요(현행 유지). 별도로 error 포트 예외가 필요하다고 판단되면 후속 결정.

- **[INFO]** `edge-complete-flash` keyframe 이 0%/20% 만 정의(100% 미정의)
  - 위치: `codebase/frontend/src/app/globals.css` `@keyframes edge-complete-flash`
  - 상세: 20%~100% 구간에 대한 명시적 값이 없어 브라우저가 20% 시점 값(`#22c55e`)을 애니메이션 종료(1.2s)까지 유지한 뒤, `animation-fill-mode` 기본값(`none`)에 의해 인라인 `stroke`(포트색/primary)로 즉시 스냅백한다. 결과적으로 "잠시 표시 후 서서히 복귀"가 아니라 "1.2초간 초록 유지 후 즉시 전환"에 가깝다 — spec 문구("초록색으로 잠시 변경 후 복귀")와 시각적으로 크게 어긋나지 않고 기능 결함은 아니다.
  - 제안: 조치 불요. 페이드아웃을 원하면 100% 키프레임에 명시적 색상(또는 CSS 변수)을 추가하는 후속 개선 검토 가능.

### 검증 수행 내역
- spec 본문 대조: `spec/3-workflow-editor/2-edge.md` §3.2 표("데이터 흐름"/"실행 완료"/"비활성 노드 연결" 3행 모두 "미구현·Planned"→"구현됨")와 신설된 "현재 구현" 노트를 line-level 로 대조. 함수/필드명(`resolveEdgeExecutionState(edge, ctx)`, `edge.className='edge-flowing'|'edge-completed'`, `edge.data.edgeInactive`), 색상(`#22c55e`), 투명도(`opacity 0.4`), 우선순위(`inactive > flowing/completed`)가 spec 서술과 구현(`edge-utils.ts`, `use-edge-execution-state.ts`, `custom-edge.tsx`, `globals.css`) 간에 정확히 일치함을 확인.
- 실제 소스 대조로 스토어 계약 검증: `execution-store.ts` 의 `ExecutionStatus`("running"/"completed" 등)·`NodeExecutionStatus`·`nodeStatuses: Map<string, NodeStatusInfo>` 타입이 훅이 가정하는 `status==='running'`/`info.status` 접근과 부합. `startExecution`/`startHistoryView`/`reset` 이 매번 `nodeStatuses: new Map()` 으로 초기화해, 이전 실행의 "completed" 상태가 다음 실행으로 새지 않음을 확인.
- `useEdgeHighlighting`(§3.3) 소스를 직접 읽어 "className Set 병합" 합성 방식(공백 분리 → Set add/delete → rejoin)이 §3.2 훅이 부여한 `edge-flowing`/`edge-completed` className 을 보존한 채 `edge-highlighted` 만 추가/제거함을 확인 — CHANGELOG/spec/주석의 "앞단에서 합성" 서술과 실제 구현 일치.
- 순수 함수(`resolveEdgeExecutionState`) 로직 직접 추적: source/target 이 `disabledNodeIds` 에 있으면 즉시 `{inactive:true, flowing:false, completed:false}` 반환(우선순위 강제), 아니면 `executing && source==='completed' && target==='running'` → flowing, `source==='completed' && target==='completed'` → completed. 두 상태는 target 값이 단일 문자열이라 구조적으로 상호배타.
- `useEdgeExecutionState` 의 두 성능 최적화(early bail-out `disabledNodeIds.size===0 && !executing && nodeStatusById.size===0`, per-edge bail-out `className===edge.className && state.inactive===prevInactive`)를 코드·신규 테스트(`use-edge-execution-state.test.ts` 5케이스) 양쪽에서 확인 — 이전 라운드(`review/code/.../14_20_12`)에서 지적된 "형제 훅과 다른 전체 재생성" WARNING 이 실제로 해소됨.
- 테스트 실행: `npx vitest run edge-utils.test.ts use-edge-execution-state.test.ts` → **71/71 통과**(edge-utils 66 + hook 5, `RESOLUTION.md` 수치와 일치). `npx tsc --noEmit -p tsconfig.json` → 0 진단.
- `grep` 으로 `edge-flowing`/`edge-completed`/`edgeInactive`/`FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS` 참조가 정의부·소비부(edge-utils.ts↔use-edge-execution-state.ts↔custom-edge.tsx↔globals.css) 전부 일관되게 연결됨을 확인 — 죽은 참조·이름 불일치 없음.
- 이전 리뷰 라운드(`review/code/2026/07/13/14_20_12`)에서 WARNING 이던 두 항목이 실제로 반영됐는지 diff·소스 양쪽으로 재확인: (1) 신규 훅 renderHook 테스트 5케이스 신설 확인, (2) mdx 한국어 문구 "비활성(끈) 노드" → "비활성(꺼진) 노드"로 정정됨을 `connecting-nodes.mdx` 본문에서 직접 확인. 인라인 주석 불일치("flowing=RF 내장 애니메이션" 등)도 현재 `custom-edge.tsx`/`workflow-canvas.tsx` 주석이 실제 메커니즘(className+CSS 애니메이션, Set 병합)과 일치하도록 정정된 상태 확인. CSS 접두 `wc-`→`edge-` 통일도 소스에서 확인(잔존 `wc-` 없음).
- `connecting-nodes.mdx` frontmatter `code:` 목록에 `use-edge-execution-state.ts` 추가 확인. `connecting-nodes.en.mdx` 는 frontmatter 자체가 없는 파일(레포 컨벤션 — ko 파일만 `spec:`/`code:` 보유)이라 별도 갱신 대상 아님, 대응 무결.
- `TODO`/`FIXME`/`HACK`/`XXX` grep → 신규/변경 파일 전체에서 0건.
- `plan/in-progress/spec-sync-edge-gaps.md` 체크박스 `[ ]`→`[x]` 전환이 실제 구현·테스트 완료와 함께 동일 커밋에 반영됨(사후 체크 원칙 준수).

### 요약
§3.2 "엣지 실행 상태 스타일"(데이터 흐름 애니메이션·완료 flash·비활성 반투명 점선) 구현은 spec 표·"현재 구현" 노트와 함수 시그니처·필드명·className·색상값·우선순위까지 line-level 로 정확히 일치하며, 판정 순수 함수(`resolveEdgeExecutionState`, 7케이스)와 신규 훅(`useEdgeExecutionState`, renderHook 5케이스) 모두 실행 확인 결과 71/71 통과, tsc 0 진단이다. 직전 ai-review 라운드(14_20_12)에서 지적된 CRITICAL 없음·WARNING 7건(전체 엣지 재생성 성능 문제, 훅 테스트 부재, 주석-구현 불일치, CSS 접두 불일치, 한국어 어휘 오류 등)은 이번 diff 에서 실제 소스 레벨로 모두 반영됐음을 직접 재확인했다(bail-out 로직·안정 disabledKey·수정된 주석·통일된 클래스명·정정된 문구 전부 소스에 존재). 남은 두 항목은 spec 이 침묵하는 회색지대 INFO(error 포트 예외 미적용, keyframe 100% 값 부재로 인한 스냅백 타이밍)로 기능 결함이 아니다. TODO/FIXME 등 미완성 표식 없음, 모든 코드 경로가 정의된 boolean 조합을 반환하며 undefined 누락 없음, 실행 스토어 초기화 계약(새 실행 시 `nodeStatuses` 클리어)과도 정합적이다.

### 위험도
NONE
