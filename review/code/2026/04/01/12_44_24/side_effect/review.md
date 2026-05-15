## 발견사항

### **[WARNING]** sessionStorage 사용으로 인한 보안 취약점 도입
- **위치**: `client.ts` — `setAccessToken`, `getAccessToken`
- **상세**: Access token이 기존 in-memory(휘발성)에서 `sessionStorage`로 확장 저장됨. `sessionStorage`는 동일 origin의 모든 JS 코드(XSS 스크립트 포함)에서 접근 가능하므로, XSS 공격 시 토큰 탈취 위험이 증가함. 원래 in-memory 방식은 이 위협을 방어하기 위한 의도된 설계였음 (주석 `// not localStorage for security`가 있었음).
- **제안**: 보안 위협 수용 여부를 명시적으로 결정해야 함. 허용한다면 주석에 트레이드오프를 명확히 기술. 거부한다면 sessionStorage 대신 메모리 내 상태를 유지하면서 페이지 새로고침 시 cookie-based refresh로 재복구하는 기존 방식 유지.

---

### **[WARNING]** `getAccessToken()` 함수에 전역 변수 변이(mutation) 부작용 추가
- **위치**: `client.ts:28-31`
- **상세**: `getAccessToken()`이 순수 읽기 함수에서 전역 변수 `accessToken`을 변경하는 함수로 바뀜. `sessionStorage`에서 읽어 in-memory 변수를 설정하는 side effect가 내재됨. 이는 함수 이름(`get`)과 의미가 불일치하며, 호출자가 예측하지 못한 상태 변경이 발생함.
- **제안**: `initAccessTokenFromStorage()` 같은 별도 함수로 초기화 책임을 분리하거나, 명칭을 `getOrRestoreAccessToken()`으로 변경하여 의도를 명시.

---

### **[WARNING]** `AuthProvider`에서 조기 반환 시 `setLoading(false)` 누락
- **위치**: `auth-provider.tsx:34-37`
- **상세**: `storedToken`이 존재하고 user 조회 성공 시 `setAuthenticated()` 호출 후 `return`하는데, `setLoading(false)`를 명시적으로 호출하지 않음. `setAuthenticated` 내부에서 `isLoading`을 리셋한다면 문제없으나, 그렇지 않을 경우 로딩 스피너가 영구적으로 표시될 수 있음.
- **제안**: `setAuthenticated` 구현을 확인하여 `isLoading` 리셋 여부를 검증. 만약 처리하지 않는다면 `return` 이전에 `setLoading(false)` 추가 필요.

---

### **[INFO]** `getAccessToken() ?? storedToken` 표현식의 의미 불명확
- **위치**: `auth-provider.tsx:34`
- **상세**: `getAccessToken()`은 401 interceptor가 token을 갱신한 경우를 감안한 코드이나, `usersApi.getMe()` 호출이 성공한 상황에서 interceptor가 토큰을 교체했다면 이미 `setAccessToken()`이 호출된 상태. `?? storedToken` fallback은 논리적으로 도달 불가능한 경로.
- **제안**: `setAuthenticated(getAccessToken()!, user)` 또는 단순히 `setAuthenticated(storedToken, user)`로 단순화.

---

### **[INFO]** 테스트에서 `vi` 전역 미임포트
- **위치**: `client.test.ts:12, 29`
- **상세**: `vi.resetModules()`를 사용하나 `vi`를 `import { vi } from "vitest"`로 명시적으로 임포트하지 않음. Vitest의 `globals: true` 설정에 의존하는 암묵적 전역 사용.
- **제안**: `import { describe, it, expect, beforeEach, vi } from "vitest"` 로 명시적 임포트 추가.

---

## 요약

이번 변경의 핵심 부작용은 **보안 모델의 의도적 약화**다. 기존 in-memory 방식은 XSS 방어를 위한 명시적 선택이었으나, `sessionStorage` 도입으로 그 방어선이 제거되었다. 또한 `getAccessToken()`이 순수 함수에서 전역 상태를 변이시키는 함수로 변경되어 예측 가능성이 낮아졌다. `AuthProvider`의 조기 반환 경로에서 로딩 상태 해제가 보장되는지 확인이 필요하다. 테스트 커버리지 자체는 신규 동작을 잘 검증하고 있으나 `vi` 임포트 누락이라는 잠재적 설정 의존성이 있다.

## 위험도

**MEDIUM**