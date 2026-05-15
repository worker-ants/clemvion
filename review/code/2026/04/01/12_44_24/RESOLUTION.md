# Code Review Resolution

## 조치 완료

### WARNING #1 — 보안 (sessionStorage XSS)
- **판단**: 사용자가 명시적으로 sessionStorage 사용을 요청한 기능이므로 유지
- **보완**: CSP 헤더 강화는 배포 단계에서 별도 처리 권장

### WARNING #2 — AuthProvider 테스트 누락
- **조치**: `auth-provider.test.tsx` 생성
  - stored token 유효/만료/없음 3가지 분기 테스트
  - cookie refresh fallback 테스트
  - 실패 시 login 리다이렉트 테스트

### WARNING #3 — vi import 누락
- **조치**: `client.test.ts`에 `vi` import 추가

### WARNING #4 — 동시성 (중복 refresh 호출)
- **조치**: `client.ts`에 모듈 레벨 `refreshPromise` 변수 추가
  - 동시 401 발생 시 단일 refresh 요청만 실행
  - `.finally()`로 promise 정리

### WARNING #5 — getAccessToken side effect
- **조치**: `getAccessToken()`에서 sessionStorage 읽기 제거 (순수 getter)
  - 별도 `restoreAccessTokenFromStorage()` 함수로 초기화 책임 분리

### WARNING #6 — 성능 (3 round trips)
- **조치**: `isTokenExpired()` 함수 추가
  - JWT `exp` 클레임 기반 클라이언트 사이드 만료 선검증
  - 만료 토큰은 바로 cookie refresh 경로로 분기 (불필요한 getMe 왕복 제거)

### WARNING #7 — 이중 리다이렉트 충돌
- **조치**: `sessionRestoreInProgress` 플래그 추가
  - AuthProvider 세션 복원 중에는 interceptor의 `window.location.href` 리다이렉트 억제
  - AuthProvider의 `router.replace`만 실행

## INFO 조치

### INFO #1 — getAccessToken() ?? storedToken 패턴
- **조치**: `restoreAccessTokenFromStorage()`으로 분리하여 의도 명확화

### INFO #4 — restoreSession 책임 집중
- **조치**: `tryRestoreFromToken()`, `tryRestoreFromCookie()`로 분리

## 검증
- Frontend lint: 통과
- Frontend tests: 128 passed (신규 10개 추가)
- Frontend build: 성공
- Backend tests: 228 passed (변경 없음)
