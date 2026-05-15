# Code Review Resolution

리뷰 시각: 2026-04-15 14:51
대응 시각: 2026-04-15

## Warning 대응

### W1. `bodyType: 'form'` 하위 호환성 처리 — 해결
- **파일:** `backend/src/modules/execution-engine/handlers/integration/http-request.handler.ts:155`
- 기존 분기 `bodyType === 'x-www-form-urlencoded'`에 `|| bodyType === 'form'` alias 추가. 레거시 데이터 silent regression 차단.
- 테스트 추가(`should treat legacy bodyType "form" as x-www-form-urlencoded`)로 alias 동작 검증.

### W2. CRLF 헤더 인젝션 방어 — 해결
- **파일:** `http-request.handler.ts` — `toKeyValueEntries`, `stripCrlf` 헬퍼 추가
- 배열/Record 양쪽 경로에서 키·값의 `\r`, `\n` 제거. 빈 키 필터링까지 유지.
- 테스트 추가(`should strip CRLF from header keys and values`)로 인젝션 벡터 차단 검증.

### W3. 자격증명 헤더 덮어쓰기 수정 — 해결
- **파일:** `http-request.handler.ts:141-145`
- 병합 순서를 `defaultHeaders → userHeaders → credentials.headers` 로 변경해 credential 헤더가 사용자 입력을 덮어쓰도록 함 (Authorization 탈취 방지).
- 테스트 추가(`prioritizes integration credential headers over user headers`)로 우선순위 고정.

### W4. `authentication=none` SSRF — 정책 유지 (해결하지 않음)
- 기존 코드(L180-183)에 "un-authenticated HTTP requests may legitimately target internal services in some deployments"라는 명시적 설계 주석이 존재. 현재 리뷰 범위는 "헤더/바디/인증 전달 버그 수정"이므로 정책 변경은 별도 티켓으로 분리하여 제품 결정 필요.
- **후속 액션 권장:** 운영 환경에서 내부 URL 허용 여부를 confirm하는 별도 plan/spec 작성.

### W5. queryParams 빈 키 필터링 테스트 — 해결
- 테스트 추가(`should drop query param rows with empty keys`).

### W6. 헤더 충돌 우선순위 테스트 — 해결
- W3 대응 테스트로 같이 커버.

### W7. Legacy Record 형식 호환성 테스트 — 해결
- 테스트 추가(`should accept legacy Record-shaped headers and queryParams`).

## Info 대응

### I1. 프론트엔드 `integrationId` 상태 누수 — 해결
- **파일:** `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx`
- Authentication Select `onChange`에서 `v !== 'integration'`이면 `integrationId: undefined`로 설정.

### I4. `form-data` 테스트 값 검증 보강 — 해결
- `(args.body as FormData).get('field')` 값 검증 추가.

### I5. 취약한 `toHaveLength(1)` 단언 교체 — 해결
- `expect(Object.keys(headers)).toEqual(['X-Keep'])` 로 교체.

### I13. `typeof value === 'object'` null 명시 — 해결
- `toKeyValueEntries`에서 `typeof value === 'object' && value !== null`로 명시.

### 미처리 Info (근거)
- **I2 리다이렉트 시 Authorization 도메인 간 전달**: 현 구현은 Integration 계열만 리다이렉트 재검증하며 기존 SSRF 정책 범위. 별도 보안 티켓에서 다룰 사안.
- **I3 timeout 상한 validate**: 백엔드 API 레벨 방어 추가는 별도 스코프. 현재 PR 주제 벗어남.
- **I6, I7, I8 주석/JSDoc**: 핵심 함수에 간단한 의도 주석(credential 우선순위, CRLF 방어, 멀티파트 boundary)은 추가 완료. JSDoc 풀 작성은 과도하다 판단.
- **I9 리다이렉트 시 body 재사용**: 해당 경로는 Integration 인증 + 3xx만 진입하고 본 PR 변경 범위 밖. 별도 이슈.
- **I10 유틸 공용화**: 두 번째 사용처 발생 시 분리 원칙에 따라 보류.
- **I11 execute 함수 분리**: 본 리팩터 범위 초과.
- **I12 테스트 헬퍼 추출**: 기존 스타일 일관성 유지.
- **I14 `engines.node`**: Node 18+ 전제는 프로젝트 전반 공통. 본 PR 범위 아님.

## 검증
- `npx jest http-request.handler.spec.ts` — 32/32 pass
- `npm test` (backend) — 1158/1158 pass, 81 suites
- `npm run lint` — 변경 파일 신규 이슈 없음
- `npm run build` — backend, frontend 모두 성공
