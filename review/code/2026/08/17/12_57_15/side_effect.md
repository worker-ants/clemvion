# 부작용(Side Effect) 리뷰 — eia-masking-round2 (round 3, `12_57_15`)

대상: EIA §R17 마스킹 왕복-오염 가드(`DynamicFormUI` `defaultValue` 프리필 차단) 최종 상태 +
직전 두 라운드(`12_06_12`→`12_33_36`) 리뷰 WARNING 반영분(RESOLUTION) + 관련 spec/plan/i18n/
review 산출물. 실제 런타임 코드가 바뀌는 파일은 여전히 `dynamic-form-ui.tsx` 와
`sanitize-error-message.ts` 두 곳뿐임을 소스를 직접 `Read` 하여 재확인했다.

## 발견사항

- **[INFO]** `initialValueFor` 가 마커 리터럴과 **정확히 일치하는 정상 기본값**도 오탐으로 처리한다 (2라운드 연속 미변경 잔존, 의도된 트레이드오프)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:375-384` (`initialValueFor`), `:371-373`(`isMaskedMarker`)
  - 상세: `isMaskedMarker`는 `field.defaultValue`가 egress 마스킹의 산물인지 여부를 판별할 out-of-band 신호(예: 서버가 표시하는 플래그) 없이, **문자열 값이 `"***"`/`"[REDACTED]"`/`"[REDACTED_DEPTH]"` 중 하나와 완전히 같은가**만으로 추론한다. 워크플로 작성자가(혹은 AI `render_form`이 생성 과정에서) 폼 필드의 `defaultValue`를 마스킹과 무관하게 그 리터럴 문자열 그대로 설정한 경우, 이번 가드는 그 값을 "마스킹됨"으로 오판해 조용히 빈 값으로 대체하고 안내 힌트를 노출한다 — 서버가 실제로 마스킹한 적이 없어도 발생한다. `initialValueFor`의 시그니처(`(field: FormField) => unknown`)는 그대로지만 내부 반환값 결정 로직이 "값이 정의돼 있으면 그대로 통과"에서 "값이 정의돼 있고 **또한 마커 집합의 멤버가 아니면** 통과"로 바뀐 것이 이 부작용의 근원이다. 직전 두 라운드(`12_06_12` LOW, `12_33_36`)에서 이미 식별·감수된 항목이며, JSDoc(`:361-369`)이 "정확 일치만 잡는다(의도)"로 이 경계를 명시하고 테스트가 반대 방향(부분-매치는 통과)만 캐너리로 고정해 뒀다 — 이 방향(정확 일치 오탐)에 대한 캐너리나 명문화는 없다. 확률은 낮고(자격증명 마커 리터럴을 실제 기본값으로 쓰는 워크플로는 드묾) 영향도 데이터 유실이 아니라 재입력 요구에 그친다.
  - 제안: 현행 유지 가능(비차단). 필요 시 `initialValueFor` JSDoc 에 "정확히 마커 리터럴과 같은 기본값은 지원하지 않는다"는 한 줄만 덧붙이면 향후 혼동을 줄일 수 있다.

- **[INFO]** 빈 초기값 + 네이티브 `required` 조합이 제출 흐름에 새로운 차단 지점을 만든다 (부수적으로 유익하지만 명시된 적 없는 상호작용)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:318`(`required={field.required}`, `renderField` 기본 case), `:375-384`(`initialValueFor`), `:436`(`<form onSubmit={handleSubmit} …>`, `noValidate` 없음)
  - 상세: 마스킹 마커와 일치하는 `defaultValue`를 가진 필드가 `required: true`이면, 이전에는 마커 리터럴 문자열 자체가 비어있지 않은 값이라 HTML5 native constraint validation을 통과해 별다른 저지 없이 제출될 수 있었다. 이번 변경으로 초기값이 빈 문자열이 되므로, 폼에 `noValidate`가 없어 브라우저가 `submit` 이벤트 자체를 가로막아 `handleSubmit`(→`onSubmit` 콜백) 호출 이전 단계에서 제출이 차단된다. 이는 이 PR의 목적(왕복 오염 차단)을 오히려 더 강하게 보강하는 부수 효과라 문제는 아니지만, 지금까지의 리뷰 라운드들이 "빈 값으로 대체되어 제출된다"만 서술했지 이 required 상호작용으로 **제출 자체가 아예 막히는 경로**가 있다는 점은 명시적으로 다뤄지지 않았다.
  - 제안: 조치 불요(비차단, 정보성). 필요하면 회귀 테스트에 required+마스킹 조합 케이스를 추가해 이 상호작용을 고정할 수 있다.

- **[INFO]** 신규 공개 표면 `MASKED_MARKERS`/`isMaskedMarker` export — 부작용 없는 순수 값/함수, 소비처는 현재 파일 내부 + 테스트뿐
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:339`(`export const MASKED_MARKERS`), `:371-373`(`export function isMaskedMarker`)
  - 상세: `grep -rn "MASKED_MARKERS\|isMaskedMarker" codebase/frontend/src` 결과 소비처는 같은 파일(`initialValueFor`, JSX 힌트 조건)과 `dynamic-form-ui.test.tsx`(리터럴 파생·대조용)뿐이다. 둘 다 순수(불변 `ReadonlySet` 리터럴, `typeof`+`Set.has` 만 하는 함수)라 전역 상태·I/O 영향 없음. 이 컴포넌트 파일의 공개 API 표면이 `DynamicFormUI` 하나에서 셋으로 늘었다는 점만 인터페이스 관점의 참고 사항.
  - 제안: 조치 불요.

- **[INFO]** `onSubmit(values)` 콜백이 전달하는 payload 내용이 마커-일치 필드에 한해 달라짐 — 의도된 변경, 두 소비처 모두 무변경으로 수용
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx:430-433`(`handleSubmit`)
  - 상세: `DynamicFormUI`의 `onSubmit` prop 시그니처(`(data: Record<string, unknown>) => void`)는 그대로이나, 사용자가 편집하지 않고 제출한 마스킹-마커 필드는 이제 원본 마커 문자열 대신 빈 값이 전달된다. 소비처(`result-detail.tsx`, `assistant-presentations-block.tsx`)는 이번 diff에서 손대지 않았고 `formConfig`를 그대로 넘기므로 하위 호환이 깨지지 않는다. 이 PR의 목적 그 자체이며 회귀 테스트(`제출 payload 에 마커가 실리지 않는다`)로 고정돼 있다.
  - 제안: 조치 불요.

- **[INFO]** `sanitize-error-message.ts` 변경은 선언·JSDoc 재배치뿐 — export 이름/값/로직 무변화 (재확인)
  - 위치: `codebase/backend/src/shared/utils/sanitize-error-message.ts:95-100`(`VALUE_MASK_MARKER`/`KEY_MASK_MARKER`/`DEPTH_MASK_MARKER`, 위치만 이동), `:128-136`(모듈-내부 `MASKED_MARKERS`/`isMaskedMarker`, 여전히 미export)
  - 상세: 세 상수는 이름·값·`export` 여부 모두 그대로이고 `MASKED_MARKERS`가 참조하는 시점보다 앞서 선언되어 TDZ 문제도 없다. `redactSecrets`/`deepRedactCore`/`CREDENTIAL_KEY_PATTERN` 등 실제 마스킹 로직은 diff 범위 밖으로 무변경. 전역 상태·시그니처·네트워크·환경변수·이벤트 영향 없음.
  - 제안: 조치 불요.

- **[INFO]** `CHANGELOG.md`·i18n·spec·plan·`review/**` 변경은 문서/프로세스 산출물이며 런타임 부작용 표면이 없음
  - 위치: `CHANGELOG.md`, `codebase/frontend/src/lib/i18n/dict/{ko,en}/editor.ts`(`formMaskedDefaultHint`, 양쪽 동시 additive), `codebase/frontend/src/content/docs/05-run-and-debug/{run-results.mdx,run-results.en.mdx}`, `spec/4-nodes/1-logic/12-background.md`, `spec/5-system/{14-external-interaction-api.md,15-chat-channel.md}`, `plan/in-progress/{eia-masked-prefill-roundtrip-guard.md,spec-sync-external-interaction-api-gaps.md}`, `review/code/2026/08/17/{12_06_12,12_33_36}/**`, `review/consistency/2026/08/17/{11_38_00,12_06_15,12_34_24}/**`
  - 상세: i18n 신규 키는 ko/en 양쪽 동시 추가라 fallback 결여 위험 없음. `review/**` 신규 파일 20여 건은 이 저장소가 강제하는 review/consistency-check 워크플로의 표준 산출물이며 CLAUDE.md가 지정한 저장 위치(`review/code/**`, `review/consistency/**`)에 정확히 놓여 있다 — 예상 밖의 파일시스템 쓰기가 아니다. `CHANGELOG.md`의 직전 라운드 "죽은 포인터"(문서화 도메인 W1, `12_33_36`)도 방향("위 항목")이 올바르게 수정된 상태임을 재확인했다(line 62: "위 항목이 폼 프리필에 세웠다").
  - 제안: 조치 불요.

- **[INFO]** 테스트 파일 신규 `describe` 블록은 기존 파일-전역 `beforeEach`(로케일 스토어)만 재사용, 새 전역 mutable state 없음
  - 위치: `codebase/frontend/src/components/editor/run-results/__tests__/dynamic-form-ui.test.tsx:8-10`(기존, 미변경), `:583-733`(신규 describe)
  - 상세: 각 테스트는 `render`로 격리된 트리를 마운트하고 `vi.fn()` mock으로 `onSubmit`을 격리한다. 테스트 간 오염 경로 없음.
  - 제안: 조치 불요.

## 요약

이번 diff의 런타임 부작용 표면은 이전 두 라운드와 동일하게 `dynamic-form-ui.tsx` 한 파일(신규 export `MASKED_MARKERS`/`isMaskedMarker`, `initialValueFor` 내부 판단 로직 변경, `onSubmit` payload 내용 변경, JSX 안내문 추가)로 국한되며 전부 순수 함수·로컬 state·해당 컴포넌트 소비처 범위 안에서 동작한다. 시그니처가 바뀐 기존 공개 함수(props, exported API)는 없고, 전역 변수·환경 변수·네트워크 호출·의도치 않은 파일시스템 쓰기는 발견되지 않았다. `sanitize-error-message.ts`는 선언 재배치뿐 로직·export 값 무변화를 소스 직접 대조로 재확인했다. 유일하게 반복 관찰되는 부작용은 마커 리터럴과 **우연히 정확히 일치하는** 정상 기본값이 오탐으로 빈 값 처리되는(그리고 `required` 필드라면 네이티브 검증이 제출 자체를 막는) 낮은 확률의 엣지 케이스인데, 이는 코드 JSDoc과 테스트로 이미 의도된 경계로 문서화·수용된 트레이드오프이고 2라운드 연속 비차단으로 판정된 사안이라 이번에도 등급을 올릴 근거는 없다. 신규 CRITICAL/WARNING 급 부작용은 발견되지 않았다.

## 위험도
LOW
