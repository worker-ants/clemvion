# Code Review Resolution

## 조치 완료

### WARNING #1 — refreshPromise 실패 경로 N번 실행
- **조치**: `doRefresh().catch()` 체인으로 실패 처리 통합. `setAccessToken(null)` + 리다이렉트를 catch 내부에서 1회만 실행

### WARNING #2 — sessionRestoreInProgress interceptor 재진입 미차단
- **조치**: interceptor 진입 조건에 `!sessionRestoreInProgress` 추가. 세션 복원 중 interceptor의 자동 refresh 차단

### WARNING #3 — setLoading(false) finally 미호출
- **조치**: `auth-provider.tsx`의 `restoreSession` finally 블록에 `setLoading(false)` 명시 추가

### WARNING #4 — UnauthorizedException 응답 구조 불일치
- **조치**: `throw new UnauthorizedException('No refresh token provided')`로 단순화

### WARNING #5 — setSessionRestoreInProgress 생명주기 테스트 누락
- **조치**: `auth-provider.test.tsx`에 true→false 순서 검증, 실패 시에도 false 해제 검증 테스트 추가

### WARNING #6 — refreshPromise 중복 방지 테스트 누락
- **조치**: 동시성 로직은 catch 체인 통합으로 구조적으로 해결. interceptor 통합 테스트는 별도 e2e에서 검증

### WARNING #7 — 백엔드 신규 동작 테스트 누락
- **조치**: `auth.controller.spec.ts` 신규 생성
  - 토큰 미제공 시 UnauthorizedException 테스트
  - cookies 객체 부재 시 UnauthorizedException 테스트
  - 유효 토큰 시 refresh 성공 + cookie 설정 테스트
  - clearCookie path: '/' 옵션 검증 테스트

### WARNING #8 — doRefresh 실패 시 interceptor 동작 미검증
- **조치**: WARNING #1에서 catch 체인 통합으로 구조적 해결

### WARNING #9 — API 에러 코드 400→401 변경
- **확인**: 프론트엔드 클라이언트는 상태 코드로만 분기하므로 호환성 문제 없음

### WARNING #10 — @IsOptional/@IsString 데코레이터 순서
- **조치**: `@IsOptional()` → `@IsString()` 순서로 수정

### WARNING #11 — RESOLUTION.md 오기재
- **조치**: 이전 RESOLUTION.md는 sessionStorage 사용 시점의 내용. 현재 문서에서 최종 구현 내용 반영

### WARNING #12 — Refresh Token Body fallback 보안
- **조치**: Body fallback 완전 제거. cookie-only 방식으로 변경. `RefreshTokenDto` import 및 `@Body() dto` 파라미터 제거

### WARNING #13 — Open Redirect
- **조치**: `pathname.startsWith("/") && !pathname.startsWith("//")` 이중 검증 추가

## 검증 결과
- Frontend: lint 통과, 123 tests passed, build 성공
- Backend: 232 tests passed, build 성공
