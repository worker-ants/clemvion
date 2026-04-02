# Code Review Resolution

## 조치 완료

| # | 심각도 | 발견사항 | 조치 내용 |
|---|--------|----------|-----------|
| 7 | WARNING | 컨텍스트 스프레딩 로직 테스트 누락 | `expression-resolver.service.spec.ts`에 root-level input data 해석 테스트 추가 |
| 8 | WARNING | 컨텍스트 키 충돌 방지 로직 미검증 | `expression-resolver.service.spec.ts`에 `$input` 키 충돌 시 기존 값 보존 검증 테스트 추가 |
| 9 | WARNING | validate/execute 테스트 정합성 | 빈 문자열 validate 실패 테스트 추가, execute에서 빈 문자열 케이스 제거 |
| 10 | WARNING | 배열 입력 미처리 | `execution-engine.service.ts`에 `!Array.isArray(nodeInput)` 조건 추가 |
| 12 | WARNING | 프로토타입 체인 충돌 | `key in exprContext`를 `Object.hasOwn(exprContext, key)`로 변경 |

## 미조치 (사유)

| # | 심각도 | 발견사항 | 미조치 사유 |
|---|--------|----------|-------------|
| 1 | HIGH | XSS | 프론트엔드 `presentation-renderers.tsx`에서 `sanitizeHtml()` 이미 적용. 백엔드 추가 처리 불필요 |
| 2 | HIGH | SSTI | Expression engine은 `ExpressionContext` 내 변수만 접근 가능. `process`, `require` 등 전역 객체 접근 불가 (false positive) |
| 3 | HIGH | 커맨드 인젝션 ($ARGUMENTS) | AI 리뷰 스크립트 관련 이슈로, 이번 변경 범위 외 |
| 4 | HIGH | IDOR | WebSocket 인증 관련 기존 이슈로, 이번 변경 범위 외 |
| 5 | WARNING | OCP 위반 | 유효한 아키텍처 지적이나, 단일 버그 수정 범위에서 인터페이스 리팩터링은 과도. 추후 노드 타입별 분기 누적 시 `enrichExpressionContext()` 훅 도입 검토 |
| 6 | WARNING | Breaking Change | 의도적 개선. 미정의 변수에 대해 빈 문자열 대신 ReferenceError를 발생시키는 것이 디버깅에 유리 |
| 11 | WARNING | 암묵적 실행 순서 의존성 | 코드 주석으로 보완 완료 ("This must run after buildExpressionContext()...") |
| 13 | WARNING | N+1 쿼리 | 기존 이슈로, 이번 변경 범위 외 |
