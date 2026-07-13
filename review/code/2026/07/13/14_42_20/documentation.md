# 문서화(Documentation) 리뷰 — §3.2 엣지 실행 상태 스타일 (ai-review 후속 수정)

대상: CHANGELOG.md, globals.css, custom-edge.tsx, use-edge-execution-state.ts(신규)+test,
workflow-canvas.tsx, edge-utils.ts/test, mdx 문서(ko/en), plan/spec-sync-edge-gaps.md,
spec/3-workflow-editor/2-edge.md, review/code/2026/07/13/14_20_12/*(전 라운드 리뷰 산출물, 커밋됨)

본 diff 는 직전 ai-review(`review/code/2026/07/13/14_20_12`, MEDIUM)의 RESOLUTION 을 반영한
후속 커밋이다. 그 라운드에서 documentation 리뷰어가 낸 WARNING 2건(주석 부정확)과
requirement/scope/documentation 리뷰어가 낸 INFO 3건(mdx `code:` 누락, CHANGELOG 테스트 언급
누락, 국문 어휘 오류)이 실제로 해소됐는지 대조 검증했다.

## 발견사항

- **[INFO]** 전 라운드 WARNING "주석-구현 불일치" 2건 — 해소 확인
  - 위치: `codebase/frontend/src/components/editor/canvas/custom-edge.tsx` (`inactive` 변수 선언 앞 주석), `codebase/frontend/src/components/editor/canvas/workflow-canvas.tsx` (`useEdgeExecutionState`/`useEdgeHighlighting` 호출 앞 주석)
  - 상세: 이전 라운드는 (a) custom-edge.tsx 주석이 "flowing 은 React Flow 내장 애니메이션이 처리"라고 서술했으나 실제로는 completed 와 동일하게 `className` → globals.css CSS 애니메이션임을, (b) workflow-canvas.tsx 주석이 "두 관심사가 edge.data 로 합성"이라고 했으나 실제로는 className Set 병합(하이라이트)+`data.edgeInactive`(비활성)임을 지적했다(WARNING). 현재 diff 는 두 주석을 각각 "`edge.className`(`edge-flowing`/`edge-completed`)을 globals.css 의 CSS 애니메이션이 소비"·"실행 상태는 `edge.className`(flowing/completed) 과 `edge.data.edgeInactive` 로, 하이라이팅은 className Set 병합(edge-highlighted)으로 합성"으로 정정했다. `use-edge-execution-state.ts`/`edge-utils.ts` 의 JSDoc 및 실제 코드(className 할당·`FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS` 상수)와 대조해 정확함을 확인.
  - 제안: 없음(확인 완료).

- **[INFO]** 전 라운드 scope INFO "mdx frontmatter `code:` 목록 누락" — 해소 확인
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx`, `connecting-nodes.en.mdx` frontmatter
  - 상세: 두 mdx 파일 frontmatter `code:` 배열에 `codebase/frontend/src/components/editor/canvas/use-edge-execution-state.ts` 가 추가되어 `spec/3-workflow-editor/2-edge.md` 의 `code:` SoT 목록과 동기화됐다.
  - 제안: 없음(확인 완료).

- **[INFO]** 전 라운드 documentation INFO "CHANGELOG 테스트 커버리지 언급 누락" — 해소 확인
  - 위치: `CHANGELOG.md` 신규 §3.2 항목
  - 상세: 항목 말미에 "테스트: `resolveEdgeExecutionState` vitest 7 + `useEdgeExecutionState` renderHook 5" 가 추가되어, 인접 §1.3 항목("detach 결정을 renderHook 단위 테스트")과 상세도가 맞춰졌다. 성능 수정("성능을 위해 sibling 훅과 동일한 per-edge bail-out(상태 불변 엣지는 원본 참조 유지)+안정 disabled 키로 실행 tick·노드 드래그 시 전체 엣지 재생성을 피한다")도 함께 서술되어 이번 후속 수정 내용이 CHANGELOG 에 정확히 반영됐다.
  - 제안: 없음(확인 완료).

- **[INFO]** CSS 클래스 접두사 `wc-` → `edge-` 리네이밍이 전 표면에 일관되게 전파됨 — 잔존 `wc-` 참조 없음
  - 위치: `codebase/frontend/src/app/globals.css`(`.edge-flowing`/`.edge-completed`/`@keyframes edge-complete-flash`), `codebase/frontend/src/lib/utils/edge-utils.ts`(`FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS` = `"edge-flowing"`/`"edge-completed"`), `spec/3-workflow-editor/2-edge.md`, `CHANGELOG.md`, `plan/in-progress/spec-sync-edge-gaps.md`
  - 상세: 전 라운드 maintainability WARNING(신규 `wc-` 접두사가 기존 무접두 컨벤션과 불일치)에 따른 리네이밍이 diff 전 표면(CSS 셀렉터·keyframe 이름·TS 상수·spec 서술·CHANGELOG·plan 체크박스)에 빠짐없이 반영되어, 문서와 코드 간 클래스명 SoT 가 어긋나는 곳이 없다.
  - 제안: 없음(확인 완료).

- **[INFO]** 한국어 사용자 문서 "비활성(꺼진) 노드" — 오탈자는 정정됐으나 저장소 기존 용어와 미세한 표현 차이
  - 위치: `codebase/frontend/src/content/docs/03-workflow-editor/connecting-nodes.mdx:82`
  - 상세: 전 라운드 requirement WARNING("비활성(끈) 노드" 오탈자)은 "비활성(꺼진) 노드"로 정정되어 의미가 명확해졌다. 다만 같은 워크플로 편집기 문서군의 `editing-nodes.mdx`(§노드 비활성화)는 동일 개념을 "비활성화된 노드"로 지칭한다("비활성화된 노드는 캔버스에서 흐리게 표시돼서…"). 두 표현 모두 오류는 아니고 영문판("disabled (turned-off) node")의 괄호 부연을 살린 자연스러운 번역이라 차단 사유는 아니지만, 같은 문서 세트 내에서 용어 형태(`비활성(꺼진)` vs `비활성화된`)가 완전히 통일되지는 않았다.
  - 제안: 선택 사항 — 다음 mdx 편집 시 "비활성화된 노드"로 맞추거나, 현재처럼 괄호 부연을 유지하려면 두 페이지 모두 동일한 괄호 문구로 통일. 차단 대상 아님.

- **[INFO]** README/설정/API 문서 갱신 불요 확인
  - 위치: 저장소 루트 `README.md`, `codebase/frontend` 관련 API 문서
  - 상세: 이번 변경은 순수 프런트엔드 편집기 프레젠테이션 로직(신규 env 변수·설정 옵션·API 엔드포인트·DB 스키마 없음)이라 README 의 상위 기능 목록("실시간 모니터링 — WebSocket 기반 실행 상태 실시간 추적")이 이미 개념적으로 포괄하며, 별도 API 문서 갱신 대상도 없다. CHANGELOG·spec·plan·mdx 사용자 가이드로 문서화 계층이 정확히 대응된다.
  - 제안: 없음.

## 요약

전 라운드 ai-review(`review/code/2026/07/13/14_20_12`)에서 documentation 리뷰어가 지적한 WARNING 2건(주석-구현 불일치)과 인접 리뷰어들의 INFO 3건(mdx `code:` 목록 누락·CHANGELOG 테스트 언급 누락·국문 어휘 오류)이 이번 diff 에서 모두 실제 코드/문서 상태와 대조 검증한 결과 정확히 해소됐다. CSS 클래스 접두사 리네이밍(`wc-`→`edge-`)도 CSS·TS 상수·spec·CHANGELOG·plan 전 표면에 누락 없이 전파되어 있다. 새로 도입한 함수(`resolveEdgeExecutionState`, `useEdgeExecutionState`, `FLOWING_EDGE_CLASS`/`COMPLETED_EDGE_CLASS`)의 JSDoc 은 목적·우선순위·상호배제 관계·성능 최적화 근거까지 상세히 기술되어 있고, 인라인 주석은 이제 실제 구현(className 기반 CSS 애니메이션, Set 병합)과 정확히 일치한다. 유일하게 남은 항목은 한국어 사용자 문서의 "비활성(꺼진) 노드"라는 표현이 같은 문서군의 기존 관용 표현 "비활성화된 노드"와 형태가 완전히 통일되지는 않았다는 매우 경미한 스타일 참고 사항으로, 오류나 차단 사유는 아니다. README·설정·API 문서는 이번 순수 프런트엔드 변경 범위상 갱신 불요로 적절히 판단됐다.

## 위험도
LOW
