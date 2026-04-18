### 발견사항

---

**[INFO]** `resolve()` 함수에서 dot-notation 키가 프로토타입 체인을 순회할 수 있음
- 위치: `core.ts:18-25`
- 상세: `current[part]`로 객체를 순회할 때 `__proto__`나 `constructor` 같은 특수 키가 전달되면 프로토타입 속성에 접근 가능. 단, `TranslationKey` 타입이 컴파일 타임에 키를 제한하고, 최종 반환 전 `typeof current === "string"` 검사를 수행하므로 실질적 exploitability는 없음. 쓰기(write)가 없어 prototype pollution도 발생하지 않음.
- 제안: 완전히 방어적으로 만들려면 `Object.prototype.hasOwnProperty.call(current, part)` 체크 추가 또는 `Object.create(null)`로 dict 생성 고려. 현 규모에서는 수용 가능.

---

**[INFO]** `interpolate()` 결과를 `dangerouslySetInnerHTML`에 전달하면 XSS 위험
- 위치: `core.ts:27-40`
- 상세: `params` 값(`string | number`)을 `String(value)`로 변환 후 template에 삽입. 현재 호출 측은 React 텍스트 노드로 렌더링하므로 XSS 없음. 그러나 `translate()` 반환값을 미래 소비자가 `dangerouslySetInnerHTML`에 사용할 경우 HTML 이스케이프 없이 그대로 삽입됨.
- 제안: JSDoc에 "반환값은 HTML-unsafe" 명시. 현재 코드베이스에서 즉각적인 취약점 없음.

---

**[INFO]** `localStorage`에서 읽은 값이 모든 경로에서 `isLocale()`로 검증됨 (긍정적)
- 위치: `locale-store.ts:11-16`, `locale-sync.tsx:20`
- 상세: 외부 입력(`localStorage`, `user.locale` API 응답) 양쪽 모두 `isLocale()` 가드를 통과한 값만 사용. whitelist 방식 검증으로 예상치 못한 값이 `document.documentElement.lang`에 삽입되는 경로를 차단.

---

**[INFO]** 서버 오류 메시지가 UI에 직접 노출되는 패턴 (기존 코드, 이번 변경에서 유지)
- 위치: 다수 컴포넌트의 `error.response?.data?.message` 처리 부분
- 상세: 백엔드 내부 오류 메시지가 사용자에게 그대로 표시될 수 있음. React 텍스트 노드이므로 XSS는 없으나, 스택 트레이스·DB 오류 등 내부 정보가 포함될 경우 정보 노출 위험. i18n 도입으로 새로 생긴 문제는 아님.
- 제안: 오류 코드 기반 번역 키 매핑 또는 generic fallback 메시지 패턴 도입 권장 (별도 작업).

---

**[INFO]** `console.warn`이 development 환경에서 번역 키와 template 문자열을 노출
- 위치: `core.ts:31-34`, `core.ts:43-45`
- 상세: `Missing parameter "name" for template: ${template}` 형태로 번역 키 구조와 보간 변수명이 개발자 콘솔에 출력됨. production에서는 실행되지 않으므로 실질적 위험 없음.

---

### 요약

이번 i18n 구현은 신규 보안 취약점을 도입하지 않는다. `isLocale()` 가드가 localStorage·API 응답 등 모든 신뢰 경계에서 일관되게 적용되고, `interpolate()`의 정규식이 `\w+`로 범위 제한되어 있으며, `document.documentElement.lang` 조작도 검증된 whitelist 값만 사용한다. `resolve()`의 dot-notation 순회는 이론적 프로토타입 체인 접근 경로가 존재하지만 쓰기가 없고 타입 시스템으로 방어되어 실질적 위험이 없다. React JSX 렌더링이 텍스트를 자동 이스케이프하므로 `translate()` 결과를 통한 XSS도 불가능하다.

### 위험도
**LOW**