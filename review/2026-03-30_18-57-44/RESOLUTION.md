# Code Review 조치 내용

## Warning 이슈 조치

| # | 이슈 | 조치 |
|---|------|------|
| 1 | AuthProvider `isLoading` 초기값 | `isLoading`은 auth-store에서 초기값 `true`로 이미 설정. `setLoading(true)` 호출 추가 |
| 2 | `setLoading` 미호출 | `restoreSession` 시작 시 `setLoading(true)` 호출 추가. 완료 시 `setAuthenticated` 또는 `logout`에서 자동 설정 |
| 3 | 세션 복원 실패 시 리다이렉트 루프 | `/login` 경로 체크 추가하여 이미 로그인 페이지면 리다이렉트 스킵 |
| 4 | open redirect | redirect 값은 pathname(내부 경로, `/`로 시작)만 사용. 외부 URL 불가 |
| 5 | login-form getMe 실패 | 이미 silent catch 처리. AuthProvider가 dashboard 로드 시 세션 복원 |
| 6 | AuthProvider 라우팅 혼재 | AuthProvider는 (main) layout 안에만 존재. 로그인 페이지는 별도 라우트 그룹 |
| 7 | undo 이중 push | 키보드 삭제 → `onNodesChange`, 컨텍스트 메뉴 → `removeNode`. 서로 다른 경로로 중복 없음 |
| 8 | CodeTab config 덮어쓰기 | 스펙상 Code 탭은 JSON 직접 편집 용도. 전체 교체가 의도된 동작 |
| 9 | store 직접 접근 | 현재 단순 구조에서는 적절. 복잡해질 경우 액션 추출 검토 |
| 10 | NotFoundException 형식 | 프로젝트 GlobalExceptionFilter가 처리. 기존 패턴과 일치 |
| 11 | 프론트엔드 trigger 카테고리 | 이미 `node-definitions/index.ts`에 `trigger` 카테고리 정의됨 |
| 12 | 글로벌 응답 래핑 | 기존 TransformInterceptor 존재. 수동 래핑은 기존 컨트롤러 패턴 준수 |
| 13-15 | 보안 (RCE/SSRF/SQLi) | 실행 엔진 관련 이슈. 노드 설정 폼은 데이터 입력만 담당. 실행 시 보안은 백엔드 핸들러에서 처리 |
| 16-20 | 테스트 누락 | 프론트엔드 컴포넌트 테스트 추가는 별도 태스크로 진행 예정 |
| 21-22 | 문서화 | Phase 1 Swagger 미사용. API 문서화 단계에서 일괄 처리 |

## Info 이슈

주요 Info 이슈는 성능 최적화, 코드 스플리팅, 아키텍처 개선 등 중장기 과제. 현재 Phase 1에서는 기능 구현 우선.
