### 발견사항

- **[INFO]** OAuth 콜백 오류 메시지 직접 노출
  - 위치: `callback-content.tsx:57` — `{error ?? t(...)}`
  - 상세: `error` prop은 OAuth 콜백 URL 파라미터에서 유래하며, 악의적인 인증 서버가 임의의 문자열을 전달할 수 있음. React JSX 텍스트 노드로 렌더링되므로 XSS 위험은 없으나, 사용자를 혼란시키는 사회공학적 메시지를 그대로 표시할 수 있음. 기존 동작이며 이번 PR이 새로 도입한 것은 아님.
  - 제안: 알려진 OAuth 오류 코드(`access_denied`, `invalid_request` 등)를 화이트리스트로 매핑하여 번역 키를 통해 출력하거나, 알 수 없는 오류는 제네릭 메시지로 대체하는 것을 권장.

- **[INFO]** 서버 응답 오류 메시지 직접 전달
  - 위치: `verify-email-content.tsx:43`, `accept-invitation-content.tsx:42`, 기타 여러 파일
  - 상세: `error.response?.data?.message`를 `toast.error(message)` 및 UI에 직접 표시. 서버 측 오류 메시지에 내부 구현 세부 정보(스택 트레이스, DB 오류 등)가 포함될 경우 정보 노출 위험. React가 텍스트로 이스케이프하므로 XSS 위험은 없음. 이 패턴도 기존 코드에서 유래함.
  - 제안: 백엔드에서 사용자 노출용 오류 메시지와 내부 오류를 분리하거나, 프론트엔드에서 오류 코드 기반으로 번역 키 매핑.

- **[INFO]** `useLocaleStore.getState()` 를 유틸리티 함수 내에서 fallback으로 사용
  - 위치: `date.ts:14`, `execution-status.ts:29`
  - 상세: `currentLocale()` 함수가 Zustand 스토어에서 로케일을 직접 읽음. `LocaleSync`가 localStorage 등 신뢰되지 않는 소스에서 로케일을 초기화할 경우, 악의적인 사용자가 예상치 못한 로케일 값을 주입할 수 있음. 단, `translate()` 함수가 알 수 없는 로케일에 대해 기본값(Korean)으로 폴백하므로 실질적 영향은 없음.
  - 제안: `LocaleSync`에서 로케일을 설정할 때 `isLocale()` 검증을 반드시 거치는지 확인.

---

### 요약

이번 변경사항은 하드코딩된 문자열을 i18n 번역 키로 교체하는 리팩터링으로, 새로운 보안 취약점을 도입하지 않음. React의 JSX 렌더링이 텍스트 노드를 자동 이스케이프하므로 번역 시스템을 통한 XSS 위험은 없으며, `TranslationKey` 타입으로 컴파일 타임 안전성도 확보됨. 발견된 사항 전부 기존 코드 패턴에서 비롯된 것이며, 이번 PR이 새롭게 도입한 보안 문제는 없음.

### 위험도
**LOW**