# 요구사항(Requirement) Review — V-05 execution-detail node sub-tabs (재검증, 17_10_43)

리뷰 대상: 이전 라운드(16_49_52)에서 발견된 2건의 CRITICAL 수정 검증 + §3.3 서브탭 요구사항 전체 재확인.

## 검증한 수정 사항

### CRITICAL ① `inputData` 미매핑 — 해결 확인

`toNodeResult()` (`codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx:476-493`) 가 이제 `inputData: ne.inputData` 를 포함한다. `NodeExecutionData.inputData` (`codebase/frontend/src/lib/api/executions.ts:26`, `Record<string, unknown>` 비-optional)를 `NodeResult.inputData?: unknown` 로 그대로 전달. `ResultDetail` 의 Input 탭 (`codebase/frontend/src/components/editor/run-results/result-detail.tsx:334-338`) 은 `result.inputData != null` 이면 `JsonContent` 를 렌더링하고, 그렇지 않으면 `t("editor.runResults.loadingInput")` ("입력 데이터 로드 중...") placeholder 를 렌더링하는 구조 그대로다. 매핑 추가로 Input 탭이 실데이터를 렌더링하게 됨을 신규 회귀 테스트로 직접 검증(`execution-detail-waiting.test.tsx` "completed node Input tab renders inputData, not the loading placeholder (V-05)")했고, 로컬 vitest 실행 결과 통과 확인(10/10, execution-detail-waiting 스위트).

### CRITICAL ② `startedAt` 미매핑 — 해결 확인

동일 함수에 `startedAt: ne.startedAt` 추가. `ResultDetail` 헤더 (`result-detail.tsx:1178-1180`) 는 `result.startedAt` 이 truthy 일 때만 `formatDate(result.startedAt, "datetime")` 를 렌더링 — 매핑 누락 시 조건이 항상 false 라 헤더 시작 시각이 사라지는 것이 정확한 인과관계였고, 지금은 정상 전달된다. `NodeResult.startedAtEpoch` (정렬 전용 파생 캐시, `execution-store.ts`) 는 `ResultDetail` 이 읽지 않으므로 `toNodeResult` 가 이를 채우지 않아도 이 경로에는 영향 없음 — 별도 결함 아님.

두 필드 모두 값의 흐름(`NodeExecutionData` → `toNodeResult` → `NodeResult` → `ResultDetail`)이 타입 레벨로 일치하고(`npx tsc --noEmit` 대상 파일 타입 에러 없음), 신규 회귀 테스트가 실사용 경로(노드 클릭 → 탭 렌더)를 커버한다. 두 CRITICAL 모두 재현 조건과 수정이 addr 되었다.

## §3.3 서브탭 요구사항 전체 재확인

`spec/2-navigation/14-execution-history.md §3.3` "우측 패널(노드 상세)": "노드 이름, 타입 배지, 상태, 소요 시간" + "서브 탭(노드 레벨): Preview / Input / Output / LLM Usage(AI 노드에서만) / Config / Error(에러가 있을 때만)" + 메시지 레벨 전환(Preview/Response/Request/LLM Usage) + "기본 선택 탭: 에러면 Error, outputData가 있으면 Preview, 그 외 Output".

- Input/Output/Config/LLM Usage/메시지 레벨 탭: `ResultDetail` 재사용으로 전부 제공, 신규 테스트(`makeCompletedExecution` AI/non-AI 케이스)로 Config·LLM Usage 노출 조건 검증됨(`설정`/`LLM 사용량` 텍스트 존재/부재 어서션).
- 기본 선택 탭 로직: `ResultDetail` 내부(에디터 drawer 와 공유)의 기존 로직 그대로 재사용 — 이번 diff 범위 밖이며 기존 컴포넌트가 이미 이 규칙을 구현·테스트하고 있음(241/241 `run-results` 스위트 통과).
- 헤더의 "노드 이름, 타입 배지, 상태, 소요 시간": `toNodeResult` 가 `nodeLabel/nodeType/nodeCategory/status/duration` 을 모두 매핑 — 이번 수정 전부터 유지되던 필드들이라 회귀 없음. `startedAt` 표시는 spec §3.3 자체가 명시하지 않지만 §3.2(요약 카드) 패턴과 에디터 drawer 의 기존 동작(`3-execution.md §724` 부근 `startedAt` hydration 서술)과 일치하는 부가 정보로, spec 과 상충하지 않는다(회색지대, INFO 수준).

## dry-run 배지 WARNING 수정 재확인

`ResultDetail` 에 `executionDryRun?: boolean`(기본 `false`) prop 추가, 배지 조건이 `executionDryRun || isDryRunOutput(result.outputData)` 로 확장(`result-detail.tsx:340-342`). `page.tsx:457` 이 `execution.dryRun === true` 를 전달. 에디터 drawer 소비처는 prop 미전달로 `false` 기본값 유지 → 기존 동작 보존. 신규 회귀 테스트("shows dry-run badge on a non-effect node when the whole execution is dry-run")로 검증, 통과 확인.

## 기타 확인

- TODO/FIXME/HACK/XXX 주석 없음 (page.tsx, result-detail.tsx 검색 결과 0건).
- `npx vitest run` 대상 스위트: `execution-detail-waiting.test.tsx` 10/10 통과, `components/editor/run-results/**` 15개 파일 241/241 통과.
- `npx tsc --noEmit` 대상 영역 타입 에러 없음.
- CHANGELOG.md·mdx(ko/en) 문서 갱신 확인 — §3.3/§3.4 dangling 안내 해소 서술과 코드 diff 가 line-level 로 일치(`nodeExecution.outputData`·`inputData`·`startedAt` 동일 shape 서술이 실제 `toNodeResult` 구현과 부합).

## 발견사항

없음 (이전 라운드 CRITICAL 2건 모두 해소 확인, 신규 이슈 미발견).

### 요약

이전 라운드에서 지적된 두 CRITICAL(`inputData`/`startedAt` 미매핑으로 인한 Input 탭 영구 placeholder 및 헤더 시작 시각 소실)은 `toNodeResult()` 에 두 필드 매핑을 추가하는 최소 수정으로 정확히 해결됐으며, 데이터 흐름이 타입 레벨·런타임 테스트 레벨 모두에서 검증된다. 부수적으로 지적됐던 dry-run 배지 execution-level fallback 도 하위호환 기본값(`false`)을 유지하며 올바르게 확장됐다. §3.3 이 요구하는 서브탭 구성(Preview/Input/Output/Config/LLM Usage/Error + 메시지 레벨 전환)은 에디터 `ResultDetail` 재사용을 통해 완전히 충족되고, 신규 회귀 테스트가 실제 렌더 결과로 이를 뒷받침한다. spec 본문과 구현 간 불일치는 발견되지 않았다.

### 위험도

NONE
