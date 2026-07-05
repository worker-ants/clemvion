# 아키텍처(Architecture) 리뷰

## 대상

- `codebase/frontend/src/app/(main)/workflows/[id]/executions/[executionId]/page.tsx`
  — execution-history 상세 페이지가 자체 구현하던 노드 상세 패널(서브탭·프리뷰·waiting
    상호작용)을 전량 삭제하고 `@/components/editor/run-results/result-detail`의
    `ResultDetail`을 그대로 import 해 대체.
- `codebase/frontend/src/app/(main)/workflows/[id]/executions/__tests__/execution-detail-waiting.test.tsx`
  — 신규 회귀 테스트(완결 실행에서 Config/LLM Usage 서브탭 노출 검증) 추가.

## 발견사항

- **[INFO]** 에디터 전용 폴더(`components/editor/run-results`)에서 execution-history
  피처가 컴포넌트를 직접 import — 디렉터리 네이밍과 실제 재사용 범위의 불일치
  - 위치: `page.tsx:56` `import { ResultDetail } from "@/components/editor/run-results/result-detail";`
  - 상세: `components/editor/**`라는 경로는 "에디터 화면 전용"을 암시하지만, 이번
    변경으로 `run-results` 서브트리는 사실상 "실행 결과 상세 뷰어"라는 독립적
    응집 단위가 되어 에디터 페이지(`workflow-editor.tsx`, `editor-toolbar.tsx`)와
    execution-history 페이지 양쪽에서 소비된다. 실제로 확인한 결과:
    - `run-results` 하위 어떤 파일도 에디터 전용 상태(`workflow-editor`,
      editor store 등)를 import 하지 않는다. 유일한 외부 의존은
      `lib/stores/execution-store`, `lib/websocket/use-execution-interaction-commands`,
      `lib/node-definitions`, `lib/i18n`, `components/ui/*` 등 이미 앱 전역
      공유 레이어다.
    - 즉 **의존성 방향 자체는 문제가 없다** — `run-results`는 에디터에도,
      execution-history 에도 의존하지 않고 반대로 양쪽이 이 모듈에 의존하는
      정상적인 "공유 feature 컴포넌트 ← 두 소비자" 형태다. 우려되는 것은
      물리적 위치(`components/editor/` 하위)가 그 사실을 반영하지 못해 코드
      탐색자가 "에디터 전용"으로 오인하기 쉽다는 점뿐이다.
  - 제안: 즉시 리팩터를 요구할 정도는 아니나, 향후 세 번째 소비자가 생기기
    전에 `components/editor/run-results` → `components/run-results` (또는
    `components/execution/run-results`) 로 이동해 실제 소유 관계(양쪽 페이지가
    공유)를 디렉터리 구조에 반영하는 편이 명확하다. 최소한 `run-results` 폴더
    최상단에 "이 모듈은 editor 전용이 아니라 execution-history 페이지도
    재사용한다"는 1줄 주석/README를 남겨 다음 변경자가 실수로 에디터-전용
    가정(예: 에디터 store 참조 추가)을 심지 않도록 가드하면 좋다.

- **[INFO]** `ResultDetail`이 내부에서 `useExecutionInteractionCommands`를 직접
  호출 — 두 소비자(에디터 드로어, execution-history 페이지)가 WS 커맨드 계층에
  암묵적으로 결합
  - 위치: `result-detail.tsx:889` `const commands = useExecutionInteractionCommands(executionId);`
  - 상세: 이전 execution-history page.tsx는 `useExecutionInteractionCommands`를
    페이지 레벨에서 호출해 콜백을 prop 으로 내려주었다(diff 제거분 `-  const
    commands = useExecutionInteractionCommands(executionId);`). 변경 후에는
    `ResultDetail` 내부가 이 훅을 소유한다. 이는 오히려 **응집도 개선**이다 —
    "waiting 상호작용을 커맨드로 변환해 WS로 보내는 책임"이 프레젠테이션
    컴포넌트 두 곳에 중복 구현되지 않고 단일 지점에 캡슐화됐다. execution-history
    page.tsx는 이제 store selector(`resumeFromForm` 등 순수 상태 전이 콜백)만
    prop 으로 넘기면 되므로 실제로는 **레이어 책임이 더 깔끔해졌다**
    (프레젠테이션 상세 로직 vs 페이지의 데이터 페칭/스토어 배선 분리).
  - 제안: 없음(개선 방향). 다만 `ResultDetail`이 이제 "순수 프레젠테이션
    컴포넌트"가 아니라 "WS 커맨드 사이드이펙트를 내장한 컨테이너"라는 점을
    컴포넌트 상단 JSDoc에 명시해 두면, 향후 SSR/스토리북 등 사이드이펙트 없는
    렌더링 컨텍스트에서 재사용을 시도할 때 오해를 줄일 수 있다.

- **[INFO]** execution-history page.tsx의 로컬 서브탭 상태 머신
  (`DetailTab`, `nodeDetailTab`, `JsonViewer`, `handleFormSubmit` 등) 전량 삭제 —
  중복 로직 단일화(양쪽 화면이 동일 서브탭 집합·판별 규칙을 공유해야 하는
  요구사항이므로 타당)
  - 위치: diff의 `-type DetailTab = ...`, `-function JsonViewer`,
    `-const detailTabs: ...` 등 대량 삭제 구간(라인 95, 143-215, 300-393 부근)
  - 상세: 기존에는 execution-history 페이지가 에디터의 `ResultDetail`이 가진
    서브탭 목록(Preview/Input/Output/Error)의 부분집합을 독자 재구현하고
    있었다 — 두 구현이 분기(conversation/presentation/waiting 판별 로직 등)를
    각자 유지보수해야 하는 이중 관리 부담이 있었다. 이번 변경은 그 중복을
    제거하고 SoT를 `ResultDetail` 하나로 좁혔다. spec
    (`spec/2-navigation/14-execution-history.md §3.3/§3.4`)도 두 화면이 동일
    서브탭 집합(Config/LLM Usage/Response/Request/References 포함)을 보이도록
    요구하므로, 화면별 개별 구현을 유지하는 편이 오히려 spec 드리프트 위험이
    컸다.
  - 제안: 없음. 이 방향이 맞다.

- **[INFO]** 순환 의존 없음 확인
  - 위치: `components/editor/run-results/*` 전체
  - 상세: `run-results` 서브트리가 `app/(main)/workflows/[id]/executions/*`
    (execution-history 페이지)나 `components/editor/workflow-editor.tsx`를
    역참조하지 않는지 확인했다. 없음. 소비 방향은 항상
    `page.tsx(executions)` → `run-results` 및 `workflow-editor.tsx` →
    `run-results`의 단방향이며, `run-results` → 소비자 역참조는 존재하지
    않는다. 순환 의존 위험 없음.

## 요약

이번 변경은 "에디터 폴더 아래 컴포넌트를 다른 피처가 import"라는 표면적 형태만
보면 모듈 경계 위반처럼 보이지만, 실제 의존성 그래프를 추적하면 `ResultDetail`
자체는 에디터 전용 상태에 전혀 결합돼 있지 않고 `lib/stores`, `lib/websocket`,
`lib/node-definitions` 등 이미 앱 전역 공유 레이어에만 의존한다. 따라서 이는
"에디터 → execution-history" 또는 그 반대 방향의 부적절한 결합이 아니라, 두
독립적인 페이지가 하나의 잘 캡슐화된 프레젠테이션+상호작용 컴포넌트를 공유하는
정상적 패턴이며, 이전에 존재하던 서브탭 판별 로직의 이중 구현(및 그로 인한 spec
드리프트 위험)을 제거했다는 점에서 오히려 응집도가 개선됐다. 유일한 잔여 이슈는
디렉터리 네이밍(`components/editor/run-results`)이 실제 소유 관계(두 피처가
공유)를 반영하지 못해 향후 기여자에게 "에디터 전용"이라는 잘못된 신호를 줄 수
있다는 점으로, 폴더 이동 또는 명확화 주석 정도의 경미한 개선 여지가 있다.

## 위험도

LOW
