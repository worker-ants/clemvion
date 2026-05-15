# 아키텍처(Architecture) 코드 리뷰

## 발견사항

### [INFO] TemplateContent의 단일 책임 원칙 준수 개선
- 위치: `frontend/src/components/editor/run-results/renderers/presentation-renderers.tsx` — `TemplateContent` 함수 (라인 1157–1202)
- 상세: 리팩토링 전 `TemplateContent`는 (1) 포맷별 콘텐츠 렌더링, (2) Output Data 디버그 섹션 렌더링, (3) `previewOnly` 조건 분기라는 세 가지 책임을 혼합하고 있었다. 이번 변경으로 `TemplateContent`가 "포맷별 콘텐츠 프리뷰만 반환"하는 단일 책임으로 좁혀졌고, 버튼 바와 Output Data 섹션은 `PresentationContent`의 공유 경로에서 처리된다. SOLID S 원칙 준수 방향으로의 진전이다.
- 제안: 현재 방향을 유지. 추가로 `TemplateContent`의 세 포맷 분기(html/markdown/text)는 내용이 거의 동일한 wrapper div + 내부 콘텐츠 구조이므로, 포맷별 렌더러를 데이터로 분리하는 작은 리팩토링을 중장기적으로 고려할 수 있다.

---

### [INFO] previewOnly 플래그 전파 단순화 — 긍정적 변화
- 위치: `TemplateContent` 함수 시그니처 + `PresentationContent` 내 Template 분기 (라인 793–794)
- 상세: 기존에는 `previewOnly` prop이 `PresentationContent → TemplateContent`로 전달되어 `TemplateContent` 내부에서 조건 분기했다. 이번 변경으로 `TemplateContent`가 `previewOnly`를 전혀 인지하지 않아도 되는 구조로 단순화되었다. `previewOnly` 제어는 `PresentationContent`의 공유 렌더링 경로에서 일관되게 처리된다. 인터페이스 분리(ISP) 측면에서도 불필요한 props가 제거된 것은 바람직하다.
- 제안: 현상 유지.

---

### [WARNING] nodeType 기반 조건 분기가 `PresentationContent` 내부에 누적되는 구조
- 위치: `PresentationContent` 함수 내 `previewHeader` 계산 로직 (라인 1352–1355) 및 switch 분기 (라인 1297–1326)
- 상세: `previewHeader` 계산에서 `result.nodeType === "template"` 조건이 인라인으로 추가되었다. 이는 switch의 각 case와 별도로 nodeType을 다시 검사하는 이중 분기 패턴이다. 현재 노드 종류가 5종이라 관리 가능하지만, 노드 타입이 추가될수록 이 패턴은 `PresentationContent` 함수에 if/switch 조건이 반복 누적되는 "Feature Envy + God Component" 방향으로 흐를 위험이 있다. 개방-폐쇄 원칙(OCP) 관점에서 새 노드 타입 추가 시 `PresentationContent` 함수 본문을 직접 수정해야 하는 구조다.
- 제안: `previewHeader`를 각 renderer 컴포넌트의 메타데이터로 추출하거나, `{ preview: ReactNode, headerLabel: string }` 형태의 렌더러 결과 타입을 정의해 switch case가 header 문자열도 함께 반환하도록 하면 `PresentationContent` 본문에서 nodeType 재검사를 제거할 수 있다. 예시:
  ```ts
  // switch 내부
  case "template":
    preview = <TemplateContent data={data} config={envelopeConfig} />;
    previewHeader = `Preview (${(envelopeConfig?.outputFormat as string) ?? "text"})`;
    break;
  ```
  이 방식이 최소 변경으로 중복 nodeType 검사를 없앨 수 있다.

---

### [INFO] Legacy flat shape 지원을 위한 다중 경로 파싱 — 기술 부채 명시 필요
- 위치: `PresentationContent` 내 `btnConfig` 추출 로직 (라인 1331–1336) 및 `isStructured` 판별 (라인 1254–1265)
- 상세: `envelopeConfig?.buttonConfig`(신규 envelope 형식)와 `data.buttonConfig`(레거시 flat 형식)를 함께 지원하는 fallback 체인이 존재한다. 이 자체는 하위 호환성을 위한 의식적인 결정으로 타당하나, 레거시 경로가 영구화되면 파싱 로직이 두 곳에 분산된 채 유지보수 부담이 된다. 현재 코드에는 레거시 경로 제거 시점에 대한 명시가 없다.
- 제안: 레거시 flat shape 지원이 임시적이라면 `// TODO: remove legacy flat buttonConfig after migration` 같은 주석이나 spec 의 마이그레이션 완료 조건을 명시한다. 영구 지원이라면 파싱 유틸 함수(`extractButtonConfig(rawInput, envelopeConfig)`)로 추출하여 로직을 한 곳에서 관리한다.

---

### [INFO] 테스트 구조 — 레이어 책임 관점
- 위치: `frontend/src/components/editor/run-results/__tests__/presentation-renderers.test.tsx` — "Template global buttons" describe 블록 (라인 505–665)
- 상세: 신규 테스트 블록은 envelope 구조(신규)와 flat 구조(레거시) 양쪽을 커버하고, `onPortButtonClick`/`onLinkButtonClick` 콜백 호출, selected 버튼 하이라이트, buttonConfig 없을 때 버튼 미표시라는 네 가지 독립적인 동작을 검증한다. 각 테스트가 `makeResult` 헬퍼를 통해 데이터를 주입하고, UI 렌더링 결과만 단언하는 순수 프레젠테이션 레이어 테스트로 레이어 책임이 명확하다. 기존 Carousel 테스트 블록과 패턴이 동일해 일관성도 있다.
- 제안: 현상 유지. 다만 `makeResult`의 `nodeType` 기본값이 `"template"`이므로, "renders no button bar when buttonConfig is absent" 케이스에서 `nodeType`을 명시하지 않아도 template 경로를 타는데, 의도가 명시적이지 않다. 가독성을 위해 `nodeType: "template"`을 명시하는 것을 권장한다.

---

### [INFO] TemplateContent — null 반환 계약의 암묵적 의존
- 위치: `TemplateContent` 함수 (라인 1173) 및 `PresentationContent`의 `{preview}` 렌더링 위치 (라인 1366)
- 상세: `content`가 없을 때 `TemplateContent`가 `null`을 반환하고, `PresentationContent`는 `{preview}` 자리에 `null`이 오더라도 버튼 바와 Output Data 섹션을 계속 렌더링한다. 이 동작은 spec §6.5 요구사항("버튼 바는 partial content에서도 표시")을 정확히 구현하지만, `null` 반환의 의미가 코드 내에 명시적으로 드러나지 않는다. `TemplateContent`의 반환 타입이 `ReactNode`이고 `null`이 합법적이지만, 향후 다른 개발자가 `null` 케이스를 `<JsonContent data={data} />`로 되돌릴 경우 버튼 바 렌더링이 깨질 수 있다.
- 제안: 주석을 더 강조하거나 `TemplateContent`의 반환 타입을 `React.ReactElement | null`로 명시하고, null 케이스의 동작 계약(버튼 바는 상위에서 처리)을 JSDoc으로 기술한다.

---

## 요약

이번 변경의 핵심은 Template 노드를 `PresentationContent`의 공유 렌더링 파이프라인(preview → 버튼 바 → Output Data)에 통합한 것이다. 아키텍처적으로 올바른 방향이다. `TemplateContent`에서 `previewOnly` prop과 자체 디버그 섹션을 제거해 단일 책임이 명확해졌고, DRY 원칙을 지켜 버튼 바 로직 중복을 피했다. 레거시 flat shape 지원을 위한 fallback 체인은 의식적 결정으로 타당하나 제거 시점이 명시되지 않은 점은 기술 부채로 남는다. 가장 주의해야 할 부분은 `previewHeader` 계산에서 `nodeType`을 switch 외부에서 다시 검사하는 패턴으로, 노드 타입이 늘어날수록 `PresentationContent`에 nodeType 조건이 산재할 수 있다. 이를 switch case 내부로 흡수하면 개방-폐쇄 원칙 준수 수준이 더 높아진다.

## 위험도

LOW
