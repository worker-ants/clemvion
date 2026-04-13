## 발견사항

### `node-config-summary.ts`

- **[WARNING]** 사실상 데드 코드가 된 `WARNING` 상수
  - 위치: `const WARNING = Object.freeze<ConfigSummaryResult>(...)` 및 `getConfigSummary` 내 `if (!result) return { ...WARNING }`
  - 상세: 모든 formatter 함수가 `ConfigSummaryResult`를 반환하도록 리팩터링되었으나 `WARNING` 상수와 null 폴백 분기가 그대로 남아 있음. 현재 기준으로 `carouselSummary`만 `| null`을 반환할 수 있어 분기 자체는 완전히 죽지 않았지만, 대부분의 formatter가 null을 반환하지 않음에도 폴백이 존재한다는 사실이 코드를 읽는 사람에게 불필요한 의문("어떤 경우에 null이 반환되나?")을 유발함
  - 제안: `carouselSummary`도 `ConfigSummaryResult`를 반환하도록 변경하고 (실제로 모든 경로에서 값을 반환 중), `WARNING` 상수와 `if (!result)` 분기를 제거

- **[WARNING]** `carouselSummary`만 `ConfigSummaryResult | null` 반환 — 패턴 불일치
  - 위치: `function carouselSummary(config: NodeConfig): ConfigSummaryResult | null`
  - 상세: 이번 리팩터링으로 모든 formatter가 `ConfigSummaryResult`를 반환하도록 통일되었으나 `carouselSummary`만 예외로 남음. `FORMATTERS` 레지스트리 타입이 여전히 `| null`을 포함해야 하는 이유가 오직 이 하나의 함수 때문이며, 함수 구현을 보면 실제로 null을 반환하는 경로도 없음. 패턴을 읽는 유지보수자에게 불필요한 혼란을 줌
  - 제안: `carouselSummary`의 반환 타입을 `ConfigSummaryResult`로 변경하고, `FORMATTERS` 레지스트리 타입도 `| null` 제거

- **[INFO]** 경고 메시지 문자열이 각 formatter에 인라인 하드코딩
  - 위치: 각 `warning("...")` 호출 전체
  - 상세: "URL not set", "Count not set" 등의 문자열이 구현 코드와 테스트 코드 양쪽에 중복 분산되어 있음. 메시지를 수정할 때 두 파일을 동시에 변경해야 함. 규모가 작아 현재는 낮은 위험이지만 노드 수가 늘어날수록 부담이 커짐
  - 제안: 현 규모에서 즉각적인 변경은 불필요하나, 향후 노드 타입이 추가될 때 메시지를 상수 객체로 추출하는 것을 고려

- **[INFO]** `\u26a0` 유니코드 이스케이프가 `warning()` 함수 내부에 매직 문자로 존재
  - 위치: `function warning(detail: string)` 내 템플릿 리터럴
  - 상세: `\u26a0`이 무엇인지 직관적으로 파악하기 어려움. 리터럴 `"⚠"` 또는 상수 `const WARNING_ICON = "⚠"` 형태가 더 가독성이 높음
  - 제안: `\u26a0` → `"⚠"` 리터럴 사용 또는 모듈 상단에 `const WARNING_ICON = "⚠"` 상수 정의

---

### `node-config-summary.test.ts`

- **[INFO]** 매트릭스 테스트(`expected` 객체)에서 `merge`의 빈 config 기대값이 "Input count and strategy not set"이나 실제 빈 config `{}` 기준으로는 두 조건이 동시에 누락됨 — 올바름
  - 위치: `it("returns specific warning for empty config on each configured node type", ...)` 내 `merge: "Input count and strategy not set"`
  - 상세: 현재는 정확하지만, `mergeSummary`가 null 체크 순서를 바꾸면 기대값이 달라질 수 있음. 하지만 복합 조건 경고 메시지를 별도 테스트로 커버하고 있어 실질적 위험은 낮음 — 현 상태 유지 가능

---

### `custom-node.test.tsx`

- **[INFO]** `/^⚠/` 정규식이 특정 경고 메시지를 검증하지 않음
  - 위치: `screen.queryAllByText(/^⚠/)` 세 곳
  - 상세: 이전 코드 `"\u26a0 Not configured"`는 메시지 전체를 검증했으나, 변경 후 `/^⚠/`는 ⚠로 시작하는 모든 텍스트에 매칭됨. `body` 영역에 경고 `<p>` 태그가 렌더링되지 않아야 한다는 의도를 검증하는 데는 충분하지만, 실수로 잘못된 경고 텍스트가 `<p>`에 렌더링되어도 테스트가 통과할 수 있음
  - 제안: 현재 사용 맥락(body에 `<p>` 렌더링 여부 확인)에서는 허용 가능한 트레이드오프. 다만 주석으로 의도를 명시하면 유지보수에 도움이 됨

---

## 요약

이번 변경은 일관된 `WARNING` 상수를 구체적인 `warning(detail)` 팩토리 함수로 전환하여 UX와 진단 가능성을 크게 개선한 의미 있는 리팩터링이다. 코드 구조와 테스트 품질 모두 명확히 향상되었다. 주된 유지보수성 문제는 리팩터링이 **절반만 완성**된 데 있다 — `carouselSummary`가 여전히 `| null`을 반환하여 `FORMATTERS` 레지스트리 타입과 `getConfigSummary`의 null 폴백 분기가 불필요하게 잔존하고, 이로 인해 `WARNING` 상수가 데드 코드가 되었다. 이 세 가지(carouselSummary 반환 타입, WARNING 상수, null 폴백 분기)를 함께 정리하면 리팩터링이 완성되어 코드 의도가 명확해진다.

## 위험도

**LOW**