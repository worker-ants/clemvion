# 문서화(Documentation) 리뷰 — V-05 실행 상세 노드 서브탭

## 발견사항

- **[WARNING]** `run-results.mdx` / `run-results.en.mdx` 가 실행 상세(execution-detail) 페이지의 새 서브탭 구성을 반영하지 않음
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` §"실행 이력 조회" > "전용 실행 내역 페이지 (상세 탐색)" (KO 132~138행), `run-results.en.mdx` §"Dedicated executions page" (121~127행)
  - 상세: 이 문서는 이미 "노드 상세 뷰: 서브 탭" 섹션(65~95행)에서 Preview/Input/Output/Config/LLM Usage/Error 및 메시지 레벨 Response/Request/LLM Usage 구성을 설명하고 있지만, 이는 **에디터 Run Results 드로어**를 전제로 서술되어 있다. 정작 "전용 실행 내역 페이지" 절은 "실행 요약 카드, 노드별 결과, 에러 메시지, ← Prev/Next" 정도로만 기술하고, 이번 변경으로 이 페이지가 드로어와 **동일한 `ResultDetail` 서브탭 세트**(Config·LLM Usage·메시지 레벨 Response/Request 포함)를 노출하게 되었다는 사실이 빠져 있다. 사용자가 이 문서만 읽으면 실행 내역 페이지가 여전히 옛 4탭(Preview/Input/Output/Error)만 지원한다고 오해할 수 있다.
  - 제안: "전용 실행 내역 페이지" 절(KO 134~137행경, EN 123~126행)에 "노드 상세 패널은 에디터와 동일한 서브탭 구성(Preview/Input/Output/Config/LLM Usage/Error, AI 메시지는 Response/Request/LLM Usage)을 그대로 제공한다"는 한 문장을 추가. 또는 "노드 상세 뷰: 서브 탭" 섹션 도입부에서 "이 서브탭 구성은 에디터 드로어와 실행 내역 상세 페이지 양쪽에서 동일하게 적용된다"고 명시해 두 surface 서술을 통합.

- **[WARNING]** `run-results.mdx` frontmatter `code:` 목록에 실행 상세 페이지 경로 누락
  - 위치: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:9`
  - 상세: `code: ["codebase/frontend/src/components/editor/run-results", "codebase/backend/src/modules/executions"]` 로, 에디터 run-results 컴포넌트 디렉터리와 백엔드 모듈만 매핑되어 있다. 이번 변경으로 `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` 가 동일 `ResultDetail` 컴포넌트를 재사용해 문서가 설명하는 서브탭 UX 를 그대로 노출하는 두 번째 진입점이 되었으나, frontmatter 는 이 경로를 인지하지 못한다. spec-coverage/frontmatter 감사 관점에서 새 code 매핑 갱신이 합리적이다.
  - 제안: `code:` 배열에 `"codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx"` 추가.

- **[INFO]** `ResultDetail` 컴포넌트에 소비처가 2곳으로 늘었음을 알리는 컴포넌트 레벨 주석 부재
  - 위치: `codebase/frontend/src/components/editor/run-results/result-detail.tsx:829` (interface `ResultDetailProps` 바로 위, 함수 `ResultDetail` 선언부)
  - 상세: 개별 prop 에는 이미 양질의 JSDoc(spec 앵커 포함)이 달려 있으나, `ResultDetail` 함수/인터페이스 자체에는 "이 컴포넌트가 에디터 Run Results 드로어와 실행 상세(execution-detail) 페이지 양쪽에서 재사용된다"는 최상위 설명이 없다. 향후 이 컴포넌트를 수정하는 개발자가 실행 상세 페이지 쪽 소비처를 놓치기 쉽다(page.tsx 496행 주석에는 재사용 사실이 적혀 있으나, 반대 방향 — 컴포넌트에서 소비처로의 참조 — 는 없음).
  - 제안: `interface ResultDetailProps` 위에 "노드 상세 패널의 단일 구현체 — 에디터 run-results 드로어(`NodeInspectorPanel` 등)와 실행 상세 페이지(`app/(main)/workflows/[id]/executions/[executionId]/page.tsx`) 양쪽에서 사용" 정도의 1~2줄 주석 추가.

- **[INFO]** CHANGELOG.md 에 이번 UX 변경(V-05) 항목 누락
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/execution-detail-node-subtabs-ea693c/CHANGELOG.md` (Unreleased 섹션들)
  - 상세: CHANGELOG.md 는 "Unreleased" 헤딩 아래 기능·UX·보안 변경마다 상세 항목을 기록하는 관행이 확립돼 있다(예: 초대 수락 UI, webhook body 제한, workflow settings DTO 강화 등 모두 SoT spec 링크 포함 1~2문단으로 기록됨). 이번 변경은 실행 내역 페이지의 노드 상세 UI 가 4탭(Preview/Input/Output/Error) → 9종 서브탭(Preview/Input/Output/Config/LLM Usage/Error + 메시지 레벨 Response/Request/LLM Usage)으로 확장되는 **가시적 사용자 UX 변경**이며 관행상 CHANGELOG 항목 대상에 해당하나 아직 추가되지 않았다. (참고: spec 변경은 불필요 — `14-execution-history.md` EH-DETAIL-03 이 이미 ✅ 로 명시돼 있고, plan 파일이 이를 정확히 기록함.)
  - 제안: "Unreleased" 최상단에 "실행 내역 페이지 노드 상세가 에디터와 동일한 서브탭(Config·LLM Usage·메시지 레벨 Response/Request) 노출 — `ResultDetail` 컴포넌트 재사용, 두 surface 일관화 (SoT: `spec/2-navigation/14-execution-history.md` EH-DETAIL-03)" 항목 추가. 다만 이는 강제 규약이 아니라 관행이므로 WARNING 이 아닌 INFO 로 분류.

- **[INFO]** 인라인 주석 품질은 우수 — 특기사항 없음
  - 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` 52~55행, 236~242행, 1019~1021행
  - 상세: import 교체부·JSX 교체부에 각각 왜 `ResultDetail` 을 재사용하는지(spec 앵커 포함), 노드 전환 시 어떤 상태만 리셋하는지가 명확히 설명되어 있다. `DetailTab`/`JsonViewer`/개별 핸들러 삭제에 따른 dangling 참조도 diff 상 확인되지 않는다(grep 으로 재확인 완료). 이 부분은 모범적인 수준이라 추가 조치 불필요.

- **[INFO]** 테스트 파일 신규 케이스에 대한 주석은 적절
  - 위치: `codebase/frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-detail-waiting.test.tsx:1086-1087, 1141, 1451-1452`
  - 상세: `makeCompletedExecution` 헬퍼와 두 신규 `it()` 블록 모두 spec 앵커(`14-execution-history §3.3/§3.4.2`)와 V-05 태그가 명시되어 있어 회귀 테스트의 의도가 추적 가능하다. 별도 조치 불필요.

## 요약

핵심 코드 변경(page.tsx 의 로컬 4탭 구현을 에디터 `ResultDetail` 재사용으로 교체) 자체는 인라인 주석·spec 앵커가 충실하고, `ResultDetail`의 개별 prop JSDoc 도 양호하며, spec(`14-execution-history.md` EH-DETAIL-03)이 이미 ✅ 로 반영되어 있어 spec 변경도 불필요함이 plan/consistency 산출물로 교차 확인된다. 다만 사용자-대면 문서(`run-results.mdx`/`.en.mdx`)가 "전용 실행 내역 페이지" 절에서 여전히 구버전 4탭 수준의 서술에 머물러 있어, 이번 변경으로 실행 내역 페이지가 에디터와 동일한 풍부한 서브탭 세트를 갖게 되었다는 사실이 최종 사용자 문서에 반영되지 않았다. 이와 함께 해당 mdx 의 `code:` frontmatter 갱신, `ResultDetail` 컴포넌트 레벨 주석 보강, CHANGELOG 항목 추가는 모두 비차단 권고 수준이다.

## 위험도

LOW
