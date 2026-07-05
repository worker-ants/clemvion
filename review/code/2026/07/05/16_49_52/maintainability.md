# 유지보수성(Maintainability) Review

## 리뷰 대상

- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx` — 우측 노드 상세 패널을 에디터 `ResultDetail` 재사용으로 교체 (로컬 4탭 구현 + 중복 waiting 핸들러 ~150줄 제거)
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-detail-waiting.test.tsx` — 완결 노드 Config/LLM Usage 서브탭 노출 회귀 테스트 2건 추가
- `plan/in-progress/spec-code-cross-audit-2026-06-10.md`, `review/consistency/**` — plan/문서 산출물 (코드 아님, 별도 언급 없음)

참고로 `codebase/frontend/src/components/editor/run-results/result-detail.tsx` (재사용 대상 컴포넌트, 비변경) 와 그 기존 소비처 `run-results-drawer.tsx` 도 결합도 평가를 위해 대조 확인했다.

## 발견사항

- **[INFO]** 중복 제거 효과가 뚜렷하고 재사용 품질이 높음
  - 위치: `page.tsx` 전체 (diff `-` 라인 다수), `NodeResultsTab`
  - 상세: `JsonViewer`, `DetailTab` 로컬 타입, `detailTabs` 배열, 9개의 waiting 핸들러(`handleFormSubmit`/`handlePortButtonClick`/`handleSendMessage` 등), `isPresentation`/`isCompletedConversation`/`hasPreview` 파생 로직, 그리고 350줄 가까운 JSX 서브탭 렌더링 블록이 모두 삭제되고 단일 `<ResultDetail {...} />` 호출로 대체됐다. 에디터 `run-results-drawer.tsx` 의 `ResultDetail` 사용 prop 목록(13개, `result`~`onSelectConversationItem`)과 본 파일의 호출부가 **완전히 동일한 prop 순서·이름**으로 정렬되어 있어(둘 다 458~471줄, 1044~1061줄 부근) 두 소비처가 진짜 동일 계약을 공유한다. 향후 두 surface 중 하나만 개선하고 다른 쪽을 놓치는 drift 위험이 구조적으로 줄었다.
  - 제안: 없음 — 모범 사례로 평가.

- **[INFO]** 남은 컴포넌트(`NodeResultsTab`)의 책임이 "리스트 선택 + waiting 상태 파생 + 자동 선택" 으로 좁아짐
  - 위치: `page.tsx:911-1066` (`NodeResultsTab`)
  - 상세: `isWaitingForm`/`isWaitingButtons`/`isWaitingConversation` 계산, `lastAutoSelectedWaiting` derived-state 패턴, 좌측 노드 리스트 렌더만 남았다. `ResultDetail` 이 헤더/탭/waiting UI/BackgroundRunSection 을 전담하므로 이 함수의 순환 복잡도가 크게 낮아졌다(구 버전 대비 조건 분기 수 절반 이하로 추정).
  - 제안: 없음.

- **[WARNING]** `NodeResultsTab` 이 여전히 `useExecutionStore` 를 7개 셀렉터로 직접 구독하고, 그 파생값(`isWaitingForm` 등)을 `ResultDetail` 에 그대로 prop-drill
  - 위치: `page.tsx:931-989` (waiting 상태 셀렉터 및 파생 변수), `page.tsx:1044-1062` (prop 전달)
  - 상세: `ResultDetail` 자체는 store 를 모르는 순수 prop 기반 컴포넌트로 잘 설계돼 있으나, 그 결과 store 구독·파생 로직(`isWaitingForm = isSelectedWaiting && waitingInteractionType === "form"` 등)이 **에디터 drawer 와 실행 페이지 양쪽에 중복**된다(`run-results-drawer.tsx` 에도 거의 동일한 계산이 있을 가능성이 높음 — 실제로 조회 결과 동일 패턴 확인). `ResultDetail` 은 재사용됐지만 그 앞단의 "store → props 매핑" 계층은 재사용되지 않아, store 필드 이름이 바뀌면 두 곳을 동시에 고쳐야 하는 잔여 결합이 남는다.
  - 제안: 이 매핑을 `useResultDetailProps(nodeId)` 같은 커스텀 훅으로 뽑아 `page.tsx` 와 `run-results-drawer.tsx` 양쪽이 공유하면 다음 단계 중복 제거가 가능하다. 이번 PR 범위를 넘는 후속 작업으로 적합.

- **[INFO]** 주석 처리 품질 — 재사용 의도와 위임 범위를 명확히 문서화
  - 위치: `page.tsx:52-56`(import 상단), `page.tsx:1037-1042`(JSX 위 블록 주석)
  - 상세: "V-05" 태그로 spec 근거(`14-execution-history.md §3.3/§3.4`)를 인용하고, `ResultDetail` 이 담당하는 책임(헤더/서브탭/대화 인스펙터/BackgroundRunSection/live waiting)을 명시적으로 나열해 향후 독자가 "왜 여기 로직이 없는지" 즉시 파악 가능하다. `selectedMsgIndex` 관련 주석(`page.tsx:919-921`, `1019-1021`)도 상태 소유권 이관을 정확히 설명한다.
  - 제안: 없음.

- **[INFO]** `DetailTab` 타입·`isDryRunOutput`/`extractBackgroundRunId` 등 재수출 함수의 단일 진실 원천화
  - 위치: `page.tsx` diff의 삭제된 `type DetailTab` (구 95라인), 삭제된 import (`isDryRunOutput`, `extractBackgroundRunId` 등)
  - 상세: 로컬 `DetailTab` 유니언과 그 판별 로직이 `result-detail.tsx` 의 `DetailTab`(더 넓은 유니언: `meta`/`port`/`status`/`llm_usage`/`response`/`request`/`config`/`references` 포함)으로 흡수됐다. 두 파일에 유사하지만 다른 이름의 타입이 병존하던 상태가 해소됐다.
  - 제안: 없음.

- **[INFO]** 테스트 추가가 회귀 방지 목적에 부합하나 커버리지가 "탭 노출" 단정에 한정
  - 위치: `execution-detail-waiting.test.tsx:1451-1473` (`completed AI node exposes...`, `completed non-AI node exposes...`)
  - 상세: `makeCompletedExecution` 헬퍼가 잘 명명되어 목적(완결 실행의 AI/non-AI 노드 구분)이 분명하고, 기존 `makeWaitingExecution` 과 네이밍 컨벤션이 일관적이다. 다만 두 테스트 모두 탭 라벨의 **존재 여부**만 검증하며, 탭 클릭 후 콘텐츠(Config JSON, LLM Usage 수치)가 올바르게 렌더되는지는 검증하지 않는다. `ResultDetail` 자체의 단위 테스트(`result-detail.test.tsx`)가 이를 커버한다면 문제 없음.
  - 제안: (선택) 필요 시 `result-detail.test.tsx` 쪽에서 콘텐츠 검증이 되고 있는지만 교차 확인.

- **[INFO]** 삭제된 `JsonViewer` 로컬 컴포넌트와 `result-detail.tsx` 의 `JsonContent` 통합
  - 위치: 삭제된 `page.tsx` 구 69-78라인
  - 상세: 로컬 `JsonViewer`(하드코딩 `max-h-[400px]`, 인라인 클래스)가 삭제되고 `ResultDetail` 내부의 `JsonContent`(`renderers/presentation-renderers`) 로 통일됐다. 이전에는 두 surface 가 미묘하게 다른 JSON 뷰어 스타일을 가질 위험이 있었는데 이제 시각적 일관성이 보장된다.
  - 제안: 없음.

- **[INFO]** `NodeResultsTab` prop 시그니처 축소(`executionDryRun` 제거)
  - 위치: `page.tsx` diff `-  executionDryRun: boolean` / 호출부 `-  executionDryRun={execution.dryRun === true}`
  - 상세: dry-run 배지 판정(`executionDryRun || isDryRunOutput(...)`)이 `ResultDetail` 내부의 `isDryRunOutput(result.outputData)` 단독 판정으로 대체됐다. `execution.dryRun`(실행 레벨 플래그)이 `outputData._dryRun` 마커와 별개 신호였다면 이는 **동작 변화**일 수 있으나, `toNodeResult` 가 `outputData` 를 그대로 전달하고 핸들러가 dry-run 실행 시 마커를 심는 게 일반적이므로 순수 리팩터 범위로 보인다. 유지보수성 관점에서는 판정 로직이 한 곳(`isDryRunOutput`)으로 좁혀져 오히려 개선.
  - 제안: 없음 (동작 동등성은 기능 리뷰어 영역이므로 여기서는 코드 구조 개선으로만 평가).

## 요약

이번 변경은 실행 상세 페이지의 우측 노드 패널 전체(약 150줄, 서브탭 정의·JSON 뷰어·9개 waiting 핸들러·조건부 렌더링 트리)를 삭제하고 에디터에서 이미 검증된 `ResultDetail` 컴포넌트를 그대로 재사용하는 교과서적인 중복 제거 리팩터다. 두 소비처(`page.tsx`, `run-results-drawer.tsx`)의 `ResultDetail` 호출 prop 목록이 완전히 동일해 계약 일관성이 높고, 남은 `NodeResultsTab` 은 리스트 선택·자동 선택·store 구독만 담당하도록 책임이 좁아져 가독성·복잡도 모두 개선됐다. 유일한 잔여 결합 지점은 "store → ResultDetail props" 매핑 로직(`isWaitingForm` 등 파생 계산)이 두 소비처에 여전히 중복돼 있다는 점인데, 이는 이번 PR 범위를 넘는 후속 리팩터 대상으로 남겨도 무방한 수준이다. 추가된 테스트도 네이밍·목적이 명확해 전반적으로 유지보수성 리스크는 낮다.

## 위험도

LOW
