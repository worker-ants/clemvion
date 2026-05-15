### 발견사항

---

- **[WARNING]** `WidenString` 타입 유틸리티에 설명 없음
  - 위치: `dict/ko.ts` 하단 — `type WidenString<T>` 정의
  - 상세: 재귀 매핑 타입이 주석 없이 존재. `en: Dict`가 `ko.ts`의 리터럴 타입을 widened string으로 구조적 검증하기 위한 목적이지만, 이 맥락을 모르는 개발자는 타입 삭제·수정 시 파급 효과를 예측하기 어려움.
  - 제안: 타입 정의 위에 `// allows en.ts to satisfy Dict without requiring literal string types` 한 줄 추가

---

- **[WARNING]** `PathInto` 재귀 타입 문서화 누락
  - 위치: `core.ts:7-13` — `type PathInto<T, ...>`
  - 상세: 복잡한 재귀 조건 타입이 설명 없이 정의됨. `TranslationKey`가 `"editor.saved"` 같은 dot-notation 경로를 자동 생성한다는 목적이 명확하지 않아, 처음 접하는 개발자가 수정을 꺼리게 됨.
  - 제안: `// generates "a.b.c" literal union from nested dict structure` 등 목적 한 줄 주석

---

- **[WARNING]** `index.ts`의 서버 스냅샷이 `DEFAULT_LOCALE` 상수 대신 `"ko"` 하드코딩
  - 위치: `index.ts:20` — `() => "ko" as Locale` (두 곳 반복)
  - 상세: 기본 locale이 바뀔 경우 `types.ts`의 `DEFAULT_LOCALE`은 수정하지만 `index.ts`는 놓치기 쉬움. 동일한 값이 3곳(`types.ts`, `index.ts` ×2)에 분산됨.
  - 제안: `import { DEFAULT_LOCALE }` 후 `() => DEFAULT_LOCALE` 사용

---

- **[WARNING]** 거대 단일 딕셔너리 파일 — 모듈화 전략 없음
  - 위치: `dict/ko.ts`, `dict/en.ts` (각 ~700줄)
  - 상세: 모든 도메인(auth, profile, workflows, editor 등)의 번역이 단일 파일에 평탄하게 존재. 현재는 관리 가능하지만 도메인이 추가될수록 파일이 무한 성장하며, 특정 도메인 담당자가 전체 파일을 열어야 하는 구조. `en: Dict` 제약 덕에 구조적 일관성은 보장되나, 확장성 측면에서 병목.
  - 제안: 즉시 분리가 필요한 수준은 아니나, `dict/namespaces/editor.ts` 같은 네임스페이스 분리 전략을 `spec`에 미리 기술해 두기를 권장

---

- **[WARNING]** `en.ts`가 `ko.ts` 타입에 단방향 의존 — 의존 방향이 비직관적
  - 위치: `dict/en.ts:1` — `import type { Dict } from "./ko"`
  - 상세: 영어 딕셔너리가 한국어 딕셔너리 파일을 타입 소스로 참조. `Dict` 타입을 `ko.ts`에서 추출한 것은 기능적으로 정확하지만, 새 개발자가 "영어가 왜 한국어에 의존하는가"를 의아해할 수 있음. 한국어 키 수정 시 영어에서 타입 오류가 나는 방향도 설명 없이는 혼란을 줌.
  - 제안: `en.ts` 상단 또는 `ko.ts`의 `Dict` export 위에 `// Dict is the structural contract — both locales must satisfy it` 주석 추가

---

- **[INFO]** `locale-store.ts` catch 블록이 이유 없이 침묵
  - 위치: `locale-store.ts:32, 37` — `catch { // noop }`
  - 상세: 왜 localStorage 실패를 무시하는지(예: 시크릿 모드, iframe 제한) 맥락이 없음. 유사한 패턴이 반복되면 "모든 예외를 삭아야 한다"는 잘못된 관습을 전파할 수 있음.
  - 제안: `catch { /* localStorage unavailable (e.g. private mode) — safe to ignore */ }` 로 이유 명시

---

- **[INFO]** 테스트 내 사용자 객체 반복 중복
  - 위치: `locale-sync.test.tsx:36-42, 55-61` — 동일 구조의 user 객체 두 번 인라인 작성
  - 상세: 필드가 많아 변경 시 두 곳 모두 수정해야 함. 테스트가 많아지면 drift 위험.
  - 제안: `const makeUser = (locale: string) => ({ id: "1", email: "a@b.c", name: "A", locale, theme: "light" as const })` 팩토리 함수로 통합

---

- **[INFO]** `interpolate` 함수의 `{{placeholder}}` 문법이 암묵적
  - 위치: `core.ts:27` — `/\{\{\s*(\w+)\s*\}\}/g`
  - 상세: 이 프로젝트가 `{{name}}` 형태의 보간 구문을 사용한다는 것이 정규식으로만 확인 가능. 딕셔너리 기여자가 자체 보간을 추가할 때 올바른 형식을 유추해야 함.
  - 제안: 함수 위에 `// interpolates {{varName}} placeholders` 한 줄 또는 JSDoc `@example` 추가

---

### 요약

전체적으로 i18n 인프라 설계(`translate` + `useT` 분리, `isLocale` 가드, Zustand 스토어, `LocaleSync` 컴포넌트)는 응집도가 높고 책임 분리가 명확하다. 실질적 유지보수성 위험은 **타입 유틸리티(`WidenString`, `PathInto`)와 아키텍처 설계 의도(en → ko 단방향 의존, 서버 스냅샷 하드코딩)에 대한 문서화 부재**에 집중된다. 딕셔너리 파일의 단일 파일 전략은 현재 규모에서는 허용 가능하나 확장 전에 분리 전략을 문서화해 두지 않으면 미래의 기술 부채가 된다. 기능 버그나 구조적 결함은 없으며, 지적 사항 대부분은 주석 한 줄 또는 상수 참조 변경으로 해결 가능하다.

### 위험도
**LOW**