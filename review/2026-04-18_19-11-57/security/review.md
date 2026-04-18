### 발견사항

---

**[INFO]** `resolve()`에서 `Object.hasOwn` 미사용으로 상속 프로퍼티 접근 가능
- **위치**: `core.ts:27-29`
- **상세**: `current[part]` 패턴이 `hasOwnProperty` 검사 없이 프로퍼티를 접근한다. `part`가 `__proto__`, `constructor`, `toString` 등의 값이 될 경우 프로토타입 체인을 타고 올라간다. 단, (1) `TranslationKey` 타입이 컴파일 타임에 유효한 딕셔너리 경로만 허용하고, (2) 최종 반환 전 `typeof current === "string"` 검사가 객체·함수를 걸러내며, (3) 읽기 전용 탐색이므로 Prototype Pollution은 불가하다. 실질적 악용 가능성은 없으나 방어 코드 명시성이 낮다.
- **제안**: 
  ```typescript
  if (!Object.hasOwn(current, part)) return undefined;
  current = current[part];
  ```

---

**[INFO]** `interpolate()` 결과가 React 외 컨텍스트에서 사용될 경우 XSS 잠재 경로
- **위치**: `core.ts:34-49`
- **상세**: `String(value)` 변환 결과가 HTML 특수문자를 포함할 수 있다(`<`, `>`, `"` 등). React 일반 텍스트 노드로 렌더링되는 한 React의 자동 이스케이프로 보호되지만, 호출자가 반환값을 `dangerouslySetInnerHTML`, `innerHTML`, 서버 사이드 템플릿 등에 전달하면 XSS가 된다. `translate()` 반환값이 raw HTML로 취급되어야 한다는 제한이 API 문서나 타입에 표현되지 않는다.
- **제안**: JSDoc에 "반환값은 안전한 텍스트로 취급되어야 하며 `dangerouslySetInnerHTML`에 전달하면 안 됨" 명시. 또는 반환 타입을 `SafeString` 브랜드 타입으로 구분하는 방안 검토.

---

**[INFO]** `localStorage` 키 `"idea-workflow.locale"`가 동일 오리진 내 다른 앱과 충돌 가능
- **위치**: `locale-store.ts:6`
- **상세**: 키 네임스페이스가 앱 이름을 포함하고 있어 일반적인 충돌 위험은 낮다. 그러나 동일 오리진에서 여러 인스턴스(스테이징, 멀티 테넌트 서브패스 등)를 운영하는 경우 locale 값이 교차 오염될 수 있다. 공격자가 XSS로 `localStorage["idea-workflow.locale"] = "en"` 을 주입해도 `isLocale()` 화이트리스트 덕분에 `"ko"` | `"en"` 이외 값은 차단된다. 영향은 UI 언어 변경 수준이며 기밀 데이터 노출은 없다.
- **제안**: 현재 구현으로 충분. 멀티 테넌트 확장 시 키에 테넌트 식별자 추가 고려.

---

**[INFO]** `isLocale()` 화이트리스트 검증이 모든 외부 입력 경계에서 일관되게 적용됨 (긍정적 발견)
- **위치**: `locale-store.ts:12`, `locale-sync.tsx:28`
- **상세**: `localStorage` 읽기값과 `user.locale` 필드 모두 `isLocale()` 통과 후에만 store에 반영된다. `document.documentElement.lang` 조작도 검증된 `Locale` 타입(`"ko"` | `"en"`)만 사용하므로 DOM 속성 인젝션 벡터가 구조적으로 차단된다.

---

**[INFO]** `setLocale` 호출 시 localStorage에 기록되는 값이 사용자 제어 가능
- **위치**: `locale-store.ts:43`
- **상세**: `window.localStorage.setItem(STORAGE_KEY, locale)` — `locale` 파라미터는 `Locale` 타입(`"ko"` | `"en"`)으로 제한되어 있어 임의 문자열 저장이 타입 수준에서 차단된다. 런타임 우회 시에도 `readStoredLocale()`의 `isLocale()` 검증이 2차 방어선이 된다. 안전.

---

**[WARNING]** 서버 오류 메시지 직접 노출 패턴 — i18n과 무관하게 기존 코드베이스 전반에 존재
- **위치**: 다수 컴포넌트의 `error.response?.data?.message` 참조부 (본 변경과 직접 연관 없음)
- **상세**: 백엔드 응답 메시지를 toast/화면에 그대로 전달하는 패턴이 유지된다. 백엔드가 DB 오류 상세, 내부 경로, 스택 트레이스 등을 메시지에 포함할 경우 정보 노출(OWASP A05)이 된다. 이번 i18n 작업에서 새로 도입된 문제는 아니나 개선 필요.
- **제안**: 알 수 없는 오류는 `t("common.error")` 같은 generic 키로만 표시하고, 구체적 서버 메시지는 개발 환경 콘솔에만 출력하도록 API 에러 핸들러 중앙화.

---

### 요약

i18n 모듈은 보안 관점에서 전반적으로 안전하게 구현되어 있다. `isLocale()` 화이트리스트 검증이 `localStorage`와 사용자 프로필 두 외부 입력 경계 모두에 적용되고, `\w+` 정규식이 interpolation 플레이스홀더 이름을 영숫자로 제한하며, React의 기본 이스케이프로 XSS 경로가 차단된다. `resolve()`의 `Object.hasOwn` 미사용은 이론적 Prototype 체인 접근을 허용하나 `typeof current === "string"` 타입 가드와 읽기 전용 특성으로 실질적 악용이 불가하다. 가장 실질적인 위험은 번역 결과가 `dangerouslySetInnerHTML`에 전달될 경우의 XSS 가능성과, 기존 코드베이스 전반의 서버 오류 메시지 직접 노출 패턴(OWASP A05)이다.

### 위험도

**LOW**