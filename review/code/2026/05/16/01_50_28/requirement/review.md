# 요구사항(Requirement) 리뷰

## 발견사항

### 기능 완전성

- **[WARNING]** `previewHeader` 가 legacy flat shape 에서 `outputFormat` 을 읽지 못함
  - 위치: `presentation-renderers.tsx` — `previewHeader` 계산부
  - 상세: `envelopeConfig?.outputFormat` 은 structured envelope(`{ config, output }`) 에서만 채워진다. legacy flat payload(`{ rendered, buttonConfig, ... }`)는 `isStructured === false` 이므로 `envelopeConfig`가 `undefined`이고, 결과적으로 `previewHeader`는 항상 `"Preview (text)"` 로 고정된다. 실제 outputFormat이 "html"이나 "markdown"인 flat 페이로드에서 헤더 표기가 틀릴 수 있다.
  - 제안: legacy path 에서도 `rawInput.outputFormat as string | undefined` 를 fallback으로 읽거나, `envelopeConfig ?? rawInput` 에서 `outputFormat`을 추출하는 헬퍼를 공통화한다.

- **[WARNING]** legacy flat shape 에서 `TemplateContent`에 전달되는 `config`가 `undefined`
  - 위치: `presentation-renderers.tsx` — `switch case "template"` 분기
  - 상세: `envelopeConfig`는 `isStructured`일 때만 설정된다. legacy flat payload(`rendered` 최상위 키)가 들어오면 `envelopeConfig`가 `undefined`가 되어 `TemplateContent` 내부의 `config?.outputFormat`도 `undefined`가 된다. 이 경우 text path로 fallback되므로 동작은 하지만 "Legacy flat shape" 테스트(`still renders buttons from legacy flat data.buttonConfig`)가 이 동작을 `outputFormat` 검증 없이만 확인한다.
  - 제안: legacy flat shape에서 `outputFormat`(또는 `format`)이 존재할 경우 `config`로 전달되도록 처리하거나, 이 제약을 주석과 테스트로 명확히 문서화한다.

- **[INFO]** `renders no button bar when buttonConfig is absent` 테스트가 `nodeType`을 명시하지 않음
  - 위치: `presentation-renderers.test.tsx` — "renders no button bar when buttonConfig is absent" 테스트
  - 상세: `makeResult`의 기본 `nodeType`은 `"template"`이다. 이 테스트는 `nodeType: "template"` 묵시적으로 사용하지만, structured envelope(`config + output`) 형태이므로 template switch 분기로 진입한다. 의도와 일치하지만 `nodeType` 명시 없이 기본값에 의존하여 가독성이 낮다.
  - 제안: `nodeType: "template"` 을 명시하거나 주석으로 "template nodeType" 임을 기재한다.

### 엣지 케이스

- **[WARNING]** `buttonItemMap` 필터링 시 `allButtons`가 빈 배열일 때와 `buttonItemMap`이 빈 객체일 때 모두 버튼 바가 숨겨지는 것은 올바르나, `buttonItemMap`의 모든 버튼이 필터링되어 `buttons.length === 0`이 되는 경우에 대한 테스트가 없음
  - 위치: `presentation-renderers.tsx` — `buttonItemMap` 필터 로직
  - 상세: 스펙 §6.5의 "global button bar" 와 "item-level button" 구분 로직이 있는데, 모든 버튼이 `buttonItemMap`에 속하여 `buttons`가 빈 배열이 되는 케이스(버튼 바 미표시)에 대한 테스트가 없다. 기존 carousel 테스트에도 없다.
  - 제안: `buttonItemMap`에 전체 버튼 id가 등록되어 글로벌 버튼 바가 없어지는 케이스를 테스트로 추가한다.

- **[INFO]** `TemplateContent`에서 `content`가 빈 문자열(`""`)일 때 `null` 반환
  - 위치: `presentation-renderers.tsx` — `TemplateContent` 내 `if (!content) return null`
  - 상세: `content = ""` (빈 문자열)도 falsy이므로 `null`을 반환한다. 비어있는 rendered 결과가 의도적인 출력인 경우 잘못 처리될 수 있다. 그러나 스펙상 "렌더링된 콘텐츠가 없음"으로 취급하는 것이 올바른지는 스펙 문서에서 명확히 다루지 않고 있다.
  - 제안: `content === undefined` 또는 `content == null` 로 조건을 좁히거나, 빈 문자열 처리 정책을 주석으로 명시한다.

- **[INFO]** link 타입 버튼에 `url`이 없을 때 `onPortButtonClick`으로 fallback
  - 위치: `presentation-renderers.tsx` — 버튼 onClick 핸들러
  - 상세: `btn.type === "link" && btn.url` 조건에서 `url`이 없으면 `onPortButtonClick?.(btn.id)`가 호출된다. link 버튼에 url이 빠진 잘못된 데이터일 때 port click으로 처리되는 것이 의도인지 불명확하다. 테스트에서 이 케이스를 다루지 않는다.
  - 제안: url이 없는 link 버튼은 비활성화하거나 별도 에러 처리 분기를 추가하고, 해당 케이스를 테스트로 커버한다.

### TODO/FIXME

- **[INFO]** 미완성 TODO/FIXME/HACK 주석은 발견되지 않음.
  - 위치: 전체 변경 파일
  - 상세: `plan/in-progress/template-preview-buttons-fix.md`에 미체크 작업 항목(`[ ]`)이 5개 남아있으나, 이는 plan 문서의 정상적인 in-progress 상태이며 코드 내 TODO 주석과는 구분된다.

### 의도와 구현 간 괴리

- **[WARNING]** plan 문서의 체크박스 상태와 구현 완료 상태 불일치
  - 위치: `plan/in-progress/template-preview-buttons-fix.md`
  - 상세: 구현 코드(`presentation-renderers.tsx`, `presentation-renderers.test.tsx`)는 이미 완성된 상태로 제출되었으나, plan 문서의 모든 작업 항목이 `[ ]` (미체크) 상태이다. 즉 구현은 완료되었지만 plan 문서가 갱신되지 않아 일관성이 없다.
  - 제안: 완료된 항목을 `[x]`로 표시하고, `/ai-review` 및 `RESOLUTION.md` 작성 완료 시 나머지 항목도 체크한 뒤 `plan/complete/`로 이동한다.

- **[INFO]** `TemplateContent` 주석의 §6.5 참조가 실제 로직과 일치
  - 위치: `presentation-renderers.tsx` — `TemplateContent` 함수 주석
  - 상세: `rendered` 미존재 시 `null` 반환으로 공유 Output Data 섹션이 노출되고, 글로벌 버튼 바는 `PresentationContent` 수준에서 처리되므로 주석의 의도와 구현이 일치한다.

### 에러 시나리오

- **[WARNING]** `PresentationContent`에서 `unwrapped`가 배열인 경우 처리 부재
  - 위치: `presentation-renderers.tsx` — `const raw = unwrapped` 이후
  - 상세: `if (!raw || typeof raw !== "object") return <JsonContent data={raw} />` 가드가 있지만, `Array.isArray`는 `typeof` 체크를 통과한다. 배열이 들어오면 `data.rendered`, `data.buttonConfig` 등이 `undefined`가 되어 버튼 없이 빈 화면으로 렌더링된다. 이는 기존 동작과 동일하지만 명시적 처리가 없다.
  - 제안: `Array.isArray(raw)` 케이스에도 `JsonContent`로 fallback하는 가드를 추가한다.

- **[INFO]** `onPortButtonClick`이 없을 때 port 버튼 클릭 시 아무것도 안 함
  - 위치: `presentation-renderers.tsx` — 버튼 onClick 핸들러
  - 상세: `onPortButtonClick?.(btn.id)` 옵셔널 체이닝으로 조용히 무시된다. `disabled={!isInteractive && !isSelected}` 로 버튼이 비활성화되어 있어 일반적으로는 클릭이 불가하지만, CSS로만 제어되는 disabled 상태이므로 JS 접근 시에는 핸들러 부재 시 무동작이 된다. 이는 허용 가능한 방어적 패턴이다.

### 데이터 유효성

- **[WARNING]** `btn.url`에 대한 URL 유효성 검증 부재 (link 버튼)
  - 위치: `presentation-renderers.tsx` — 버튼 onClick 핸들러, `isHttpUrl` 함수와의 불일치
  - 상세: `isHttpUrl` 헬퍼가 파일 상단에 정의되어 있고 `CarouselContent`의 이미지 src에 사용되지만, link 타입 버튼의 `btn.url`에는 적용되지 않는다. 악성 URL(예: `javascript:alert(1)`)이 `onLinkButtonClick` 콜백으로 그대로 전달될 수 있다.
  - 제안: 버튼 onClick 핸들러에서 `isHttpUrl(btn.url)` 검증을 통과한 url만 `onLinkButtonClick`으로 전달하거나, 해당 검증을 호출자(onLinkButtonClick 구현부)에서 일관되게 담당하도록 문서화한다.

- **[INFO]** `buttonConfig.buttons` 배열 항목의 `id`·`label` 누락 시 렌더링 에러 없음 (방어적)
  - 위치: `presentation-renderers.tsx` — allButtons 처리
  - 상세: `allButtons`는 `Array<{ id: string; label: string; ... }>` 타입으로 캐스팅되지만, 런타임에 `id`나 `label`이 `undefined`인 경우 `key={btn.id}`가 `undefined`가 되어 React key 경고가 발생하고 `{btn.label}`이 빈 버튼을 렌더링한다.
  - 제안: `allButtons` 매핑 시 `id`와 `label`이 유효한 문자열인지 필터링하거나, 타입 가드를 추가한다.

### 비즈니스 로직

- **[INFO]** spec 근거(0-common §1, §6.5, 5-template §1, §5.4)에 대한 Template 버튼 바 구현이 정확히 반영됨
  - 위치: `presentation-renderers.tsx` — `PresentationContent` switch 분기 및 버튼 바 렌더링
  - 상세: Template이 switch에 합류하여 `preview + 버튼 바 + Output Data` 공유 구조를 사용하는 것이 spec §6.5의 "렌더링된 콘텐츠 아래 버튼 바 표시" 요구사항과 일치한다. `waiting_for_input` 상태에서 버튼 클릭 가능, `button_click` resumed 상태에서 선택 버튼 하이라이트 동작이 모두 테스트로 검증된다.

- **[WARNING]** `waiting_for_input` 상태 조건이 구현에 반영되지 않음
  - 위치: `presentation-renderers.tsx` — 버튼 렌더링 조건
  - 상세: 스펙 §6.5는 "버튼 대기 중(`waiting_for_input`)" 에만 버튼 바를 표시하도록 명시하지만, 구현은 `buttons.length > 0` 이면 항상 버튼 바를 렌더링한다. `status`나 `interactionType` 조건을 확인하지 않는다. 이는 `completed` 상태에서도 버튼 바가 표시될 수 있음을 의미하며, resumed(선택 완료) 상태를 별도 처리하는 `selectedButtonId` 로직으로 부분 보완되어 있지만, status 기반 조건이 명시적으로 없다.
  - 제안: `waiting_for_input` 상태(또는 버튼 인터랙션이 활성 상태)일 때만 버튼 바를 렌더링하는 조건을 추가하거나, "버튼 바는 항상 표시하되 비활성화/하이라이트로 상태를 표현한다"는 설계 결정을 스펙 및 주석에 명시한다.

### 반환값

- **[INFO]** 모든 분기에서 적절한 React 노드를 반환함
  - 위치: `TemplateContent`, `PresentationContent` 전체
  - 상세: `TemplateContent`는 `null`(content 없음), JSX(html/markdown/text 각 분기) 를 모두 반환한다. `PresentationContent`는 `<JsonContent>`(early return 2곳), `<div className="space-y-3">` 조합 구조를 반환한다. 누락된 반환 경로는 없다.

---

## 요약

이번 변경은 Template 노드의 글로벌 ButtonDef 버튼 바 미표시 버그를 올바르게 수정한다. `TemplateContent`에서 자체 "Output Data" 섹션을 제거하고 `PresentationContent`의 공유 구조에 합류시킨 접근은 DRY 원칙에 부합하며 spec §6.5 요구사항을 충족한다. 테스트 커버리지도 structured/legacy flat/포트 클릭/링크 클릭/resumed 하이라이트/버튼 없음 등 주요 시나리오를 포괄한다. 다만 link 버튼 URL 유효성 검증 누락(`isHttpUrl` 미적용), `waiting_for_input` 상태 조건의 명시적 부재, plan 문서 체크박스 미갱신, legacy flat shape에서 `outputFormat` 헤더 미반영이 경계 리스크로 남아있다. 이 중 URL 검증 누락은 XSS 방어선과 관련되어 별도 조치를 권장한다.

## 위험도

MEDIUM

