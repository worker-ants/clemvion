# 변경 범위(Scope) Review

대상: `spec/3-workflow-editor/2-edge.md` §1.3(입력 포트 역방향 연결 확인 + 기존 엣지 재연결/분리) 구현 전체 diff(`origin/main...HEAD`, 4커밋: `c74e27058`→`b15141f12`→`c538531fc`→`77850f5f9`), 46개 변경 파일. 코드(6) + 유저가이드 mdx(4) + SoT 동기화(CHANGELOG/spec/plan 3) + 동일 세션 내 3회 선행 ai-review 산출물(`12_40_48`/`13_06_50`/`13_27_36`, 33개).

## 발견사항

- **[INFO]** `editor-store.ts` `onConnect` 함수 본체가 §1.3 PR 사이클 중 리팩터링됨(인라인 자기연결/중복/컨테이너충돌 검증 → `evaluateConnection` 판별 유니온 공용 헬퍼, `buildEdgeDataForConnection` 데이터파생 헬퍼로 치환)
  - 위치: `codebase/frontend/src/lib/stores/editor-store.ts` `onConnect`(L744 부근), 신규 `evaluateConnection`/`buildEdgeDataForConnection`(L607-640 부근)
  - 상세: §1.3 신규 기능(`onReconnect`) 자체 요청과는 별개로 기존 `onConnect` 로직도 함께 수정한 변경이라 표면적으로는 "요청 밖 리팩토링"처럼 보일 수 있으나, `review/code/2026/07/13/12_40_48/RESOLUTION.md` Warning #2("onConnect/onReconnect 검증+데이터파생 로직 중복") 지적에 대한 명시적 반영으로 동일 PR 사이클 내에서 발생했다. `git diff`로 직접 대조한 결과 동작은 behavior-preserving(자기연결 조용히 거부·중복/컨테이너 충돌 toast·`pushUndo`·`buildEdgeData` 파생 순서 동일)이며, 기존 `onConnect` 테스트가 그대로 통과함을 확인했다. 무관한 리팩토링이 아니라 이 diff 자체가 유발한 중복을 이 diff 안에서 해소한 것.
  - 제안: 조치 불요(의도된 범위 내 변경, 근거가 RESOLUTION.md에 기록됨).

- **[INFO]** store 메서드명이 `deleteEdge` → `removeEdge` 로 개명되어 인터페이스·구현·`workflow-canvas.tsx`·`use-edge-reconnect.ts`·두 테스트 파일 전체에 전파됨
  - 위치: `editor-store.ts`(interface+구현), `workflow-canvas.tsx`(변수 바인딩), `use-edge-reconnect.ts`(파라미터명), `editor-store.test.ts`
  - 상세: §1.3 신규 기능명 자체가 아니라 리네이밍이라 범위 밖처럼 보일 수 있으나, `12_40_48` side_effect 리뷰 Warning(신규 store `deleteEdge`가 기존 `workflowsApi.deleteEdge`〈즉시 REST DELETE〉와 동명이라 부작용 프로파일 충돌) 반영이다. `git grep`으로 리네임이 관련 파일 전체에 누락 없이 일관 전파됐고, 무관한 기존 `workflowsApi.deleteEdge`(REST 헬퍼, 원래부터 미사용 dead code)는 손대지 않았음을 확인했다.
  - 제안: 조치 불요.

- **[INFO]** `edge-utils.ts` `firstInputHandleId` 예약 입력 포트(`emit`) 스킵 로직(`RESERVED_INPUT_HANDLE_IDS`) 추가는 "역방향 연결 + 재연결/분리"라는 §1.3 본 요청과 기능적으로 직접 관련이 없다
  - 위치: `codebase/frontend/src/lib/utils/edge-utils.ts`, `edge-utils.test.ts`
  - 상세: 그러나 이는 임의 확장이 아니라 §1.2 PR 의 ai-review(`12_02_54`)가 이미 지적하고 plan 문서 §1.3 이월 항목 (e)로 사전 예고한 latent 결함의 계획된 후속 조치이며, CHANGELOG 항목 3("부수 강화")·plan 체크박스 (e) 완료 서술·spec §1.3 각주에 명시적으로 스코프 포함이 문서화되어 있다. over-engineering 이 아니라 사전 합의된 최소 변경(리터럴 1개 Set)이다.
  - 제안: 조치 불요 — 계획된 항목.

- **[INFO]** `review/code/2026/07/13/{12_40_48,13_06_50,13_27_36}/*` 33개 파일(RESOLUTION.md·SUMMARY.md·meta.json·`_retry_state.json`·각 리뷰어 산출물)이 이번 diff 에 신규 커밋됨
  - 상세: 코드 변경과 무관해 보이지만, 저장소 컨벤션상 `review/`는 gitignore 대상이 아니며 RESOLUTION·SUMMARY 도 커밋 대상이다(체크박스=실제 상태 커밋 관례와 동일선상). 3회 선행 ai-review가 같은 §1.3 구현에 대해 CRITICAL 1건(자기연결 드롭 시 엣지 오삭제)→WARNING 다수→WARNING 2건(trivial) 순으로 수렴한 정상 워크플로우 근거 기록이지 무관한 파일 혼입이 아니다.
  - 제안: 조치 불요.

- **[INFO]** `connecting-nodes.mdx`(ko) frontmatter `code:` 목록에 `use-edge-reconnect.ts`/`edge-utils.ts` 추가, `containers-and-tools.mdx`/`.en.mdx` 의 "컨테이너 소속 변경" 안내 문구 정정("드래그가 아니라 재연결" → "노드를 드래그해 넣는 게 아니라 body/emit 연결선 재연결")
  - 상세: 둘 다 §1.3 신규 동작(끝점-드래그 재연결)이 도입되며 기존 문구가 모호해진 데 대한 직접 반응이며, spec `code:` 인벤토리와 정합한다. 범위 밖 문서 수정이 아니다.
  - 제안: 조치 불요.

이 외 diff 전체(`--ignore-all-space` 비교로 재확인)에서 포맷팅-only 변경, 미사용 임포트, 목적 불명 주석, 임의 설정 파일 변경은 발견되지 않았다. `workflow-canvas.tsx` 변경분은 신규 import 1줄 + 셀렉터 2줄 + 훅 호출 1줄 + `<ReactFlow>` prop 배선 2줄로, §1.3 요청과 정확히 일치하는 최소 배선이다.

## 요약

이번 diff 는 spec §1.3(역방향 연결 확인 + 기존 엣지 재연결/분리) 구현과 그 구현에 대한 3회 선행 ai-review 사이클(CRITICAL 1건 + WARNING 다수)의 반영으로 구성된다. 표면적으로 "요청 밖 변경"처럼 보일 수 있는 항목들 — `onConnect` 검증 로직 공용 헬퍼 추출, `deleteEdge`→`removeEdge` 리네임, `firstInputHandleId` 예약 포트 강화 — 은 모두 (1) 동일 PR 사이클의 리뷰 피드백에 대한 명시적 반영이거나 (2) 선행 PR 리뷰에서 이미 예고되고 plan/CHANGELOG/spec 에 "부수"로 문서화된 계획된 항목으로, 근거가 RESOLUTION.md·plan 체크박스에 기록되어 있다. `review/` 하위 33개 리뷰 산출물 파일 커밋은 저장소 컨벤션과 일치한다. 의도 이상의 기능 확장(over-engineering), 무관한 파일·코드 영역 수정, 포맷팅·주석·임포트 노이즈, 의도치 않은 설정 변경은 diff 전체에서 발견되지 않았다.

## 위험도
NONE
