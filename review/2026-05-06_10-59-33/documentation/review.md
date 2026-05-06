이제 충분한 컨텍스트를 확보했습니다. 문서화 관점에서 분석한 결과를 정리합니다.

---

## 문서화 리뷰 결과

### 발견사항

---

**[WARNING] 영어/한국어 치트시트 콘텐츠 비대칭**
- 위치: `cheatsheet.mdx` § "필드 기본값 · 안전 접근" / `cheatsheet.en.mdx` § "Field defaults · safe access"
- 상세: 한국어 치트시트에는 옵셔널 체이닝(`?.`) 사용 예시가 세 가지 추가되어 있음 (`$input.user?.name`, `$node["Fetch User"]?.output?.profile?.age`, `$input.items?.[0]`). 영어 버전에는 이 예시가 전혀 없고 삼항 연산자와 `||` 패턴만 수록됨. 학습 자료로서 언어 버전 간 정보 격차가 발생함.
- 제안: 영어 치트시트의 "Field defaults · safe access" 섹션에 동일한 optional chaining 예시 3개를 추가.

---

**[WARNING] 문서에 언급된 `today()` 함수의 구현 확인 필요**
- 위치: `variables-and-context.en.mdx` L95 / `variables-and-context.mdx` L106
- 상세: `$today` 제거 이유를 설명하는 Callout에서 `today()` 함수를 UTC 대안 또는 서버 로컬 TZ 기반 대안으로 함께 언급함. 그런데 `expression-constants.ts`의 `ROOT_VARIABLES` 및 `BUILT_IN_PICKER_VARIABLES`에는 `today` 함수가 등재되어 있지 않음. 실제로 구현되지 않은 함수가 공개 문서에 사용 가능한 것처럼 기재되어 있다면 오해를 유발함.
- 제안: `today()` 함수가 expression engine에 실제로 구현되어 있는지 확인. 미구현이면 Callout에서 해당 언급을 제거하거나 "향후 제공 예정"으로 표기. 구현되어 있다면 `ROOT_VARIABLES` 또는 함수 목록에 추가.

---

**[INFO] `formatDate`의 `format` 파라미터 타입이 `string`으로 넓게 선언됨**
- 위치: `date.ts` L69
- 상세: JSDoc에는 `"iso" | "datetime" | "time" | "date" | undefined` 네 가지 유효 값이 명확히 기재되어 있으나, TypeScript 시그니처는 `format?: string`으로 선언됨. 잘못된 값을 넘겨도 런타임에 조용히 `"date"` 브랜치로 fallthrough 되고 컴파일 타임 에러가 발생하지 않음. 문서와 타입 계약이 불일치함.
- 제안: `format?: "iso" | "datetime" | "time" | "date"` 유니온 타입으로 변경하면 JSDoc 없이도 타입 자체가 문서 역할을 수행하고 잘못된 사용을 조기 탐지할 수 있음.

---

**[INFO] `getWebhookUrl`의 포트 하드코딩에 설명 없음**
- 위치: `trigger-detail-drawer.tsx` L227–230
- 상세: `window.location.origin.replace(/:\d+$/, ":3011")`에서 `:3011` 포트가 하드코딩되어 있으나 이 값이 무엇을 의미하는지 (개발용 webhook 서버 포트인지, 환경변수로 대체해야 하는지) 코드 내 어디에도 설명이 없음. 미래 독자가 이 숫자를 변경해야 할 때 근거를 파악하기 어려움.
- 제안: 상수로 분리하거나 한 줄 주석으로 WHY를 명시 (예: `// backend webhook listener port`).

---

**[INFO] `conversation-inspector.tsx` 내 한국어 하드코딩 문자열**
- 위치: `conversation-inspector.tsx` L314–317
- 상세: `SelectedItemDetail` 컴포넌트가 한국어 문자열 `"원문 요청 / 응답 / 사용량은 상단의 &ldquo;Request&rdquo; / &ldquo;Response&rdquo; / &ldquo;LLM Usage&rdquo; 탭에서 확인할 수 있습니다."` 을 직접 렌더함. 다른 UI 텍스트는 영어로 되어 있고 i18n 키를 사용하는 패턴과 불일치함. 영어 로케일 사용자에게 한국어 문자열이 노출될 수 있음.
- 제안: i18n 키로 추출하거나 최소한 영어 대응 문자열도 추가.

---

**[INFO] `NODE_ACCESSORS` 주석의 크로스 파일 참조**
- 위치: `expression-constants.ts` L57
- 상세: `"Matches the shape built in expression-resolver.service.ts (config/output/meta/port/status)"` 주석이 특정 파일명과 필드 목록을 명시함. `expression-resolver.service.ts`가 변경될 때 이 주석이 함께 갱신되지 않으면 stale comment가 됨.
- 제안: 파일명 참조 대신 실제 타입 또는 인터페이스를 import해서 타입 수준에서 일치를 보장하거나, 주석을 제거하고 타입으로 계약을 명시.

---

### 요약

전반적으로 문서화 수준은 양호하다. `formatDate`·`formatDuration`의 JSDoc은 모호함 없이 동작을 기술하고, MDX 문서는 `$today` 제거 이유와 `$now` UTC 의미를 명확히 설명하며, `AGENTS.md`는 날짜 표기 규약을 개발자가 잊지 않도록 적절히 강제하고 있다. 다만 두 가지 실질적 위험이 있다: ① 영어·한국어 치트시트 간 optional chaining 예시의 비대칭이 영어 사용자에게 기능 일부를 숨기고 있고, ② `today()` 함수가 공개 문서에 기재되었으나 구현 확인이 필요하다. 나머지는 타입 정밀도 및 유지보수성 관련 경미한 사항이다.

### 위험도

**LOW**