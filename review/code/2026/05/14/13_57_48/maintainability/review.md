### 발견사항

**[INFO] `verifyHmac` 로직이 테스트 헬퍼(`computeTestHmac`)와 중복**
- 위치: `integration-oauth.service.ts:857–889` / `integration-oauth.service.cafe24.spec.ts:14–22`
- 상세: HMAC 계산 로직(파라미터 정렬 → URL 인코딩 → HmacSHA256 → Base64)이 프로덕션 함수와 테스트 헬퍼에 각각 독립적으로 존재. 알고리즘 변경 시 두 곳을 동시에 수정해야 한다.
- 제안: 단순 정보성 이슈. `verifyHmac`을 `export`하거나 별도 유틸 모듈로 분리하면 테스트가 동일 함수를 직접 호출할 수 있어 이중 구현을 제거할 수 있다.

---

**[WARNING] `handleInstall`에서 `mode: 'reauthorize'`를 하드코딩**
- 위치: `integration-oauth.service.ts` `handleInstall` 내 `stateRecord` 생성 부분
- 상세: Private 앱 App URL 흐름에서 생성하는 OAuthState의 `mode`가 `'reauthorize'`로 박혀 있다. 실제로는 "pending_install → connected" 전이를 위한 전용 모드지만 기존 reauthorize 경로를 재사용하며, `handleCallback`의 `if (record.mode === 'reauthorize' || integration.status === 'pending_install')` 조건에서 이를 보완하고 있다. 두 의미가 다른 모드를 같은 문자열로 표현해 미래 유지보수자가 혼동할 수 있다.
- 제안: `'reconnect'` 같은 별도 모드 값을 정의하거나, 최소한 해당 하드코딩 라인 옆에 "pending_install 전이에 재사용"이라는 주석을 추가한다. (테스트에서는 이미 `savedState.mode === 'reconnect'`를 검증하고 있어 불일치 있음 — 실제 코드 확인 필요)

---

**[WARNING] `BeginResult` 유니온 타입의 판별이 분산되어 있음**
- 위치: `integration-oauth.service.ts:76–86`, `integrations.controller.ts`의 `oauthBegin`, `new/page.tsx:160–170`
- 상세: `BeginResult`가 `{ authUrl: string; state: string } | { mode: 'cafe24_private_pending'; ... }` 유니온이지만, 판별자(`mode` 필드)가 두 브랜치에 비대칭으로 존재한다. 프론트엔드에서는 `"mode" in result`로 검사하고, 백엔드 컨트롤러는 예외를 던지는 방식에 의존하며, `reauthorize`/`requestScopes`의 반환 타입은 여전히 `Promise<BeginResult>`로 선언되어 있어 public → private 전환 시 런타임 에러 가능성이 있다.
- 제안: `authUrl` 경로에도 `mode: 'popup'` 판별자를 추가해 exhaustive narrowing이 가능하도록 타입을 정규화한다.

---

**[INFO] `cafe24Install` 컨트롤러 핸들러가 예외를 직접 처리**
- 위치: `integrations.controller.ts:209–248`
- 상세: 다른 엔드포인트들은 NestJS 예외를 throw해 글로벌 필터가 처리하게 두지만, `cafe24Install`은 `try/catch`로 직접 `res.status(...).json(...)` 응답을 작성한다. `@Res()` 사용 때문에 불가피한 측면이 있으나, 에러 응답 형식이 나머지 API와 다를 수 있다.
- 제안: 현행 유지 가능하지만, 에러 포맷이 표준 응답 형식과 일치하는지 확인하거나 NestJS ExceptionFilter를 302 redirect 엔드포인트에 맞게 확장한다.

---

**[INFO] `APP_URL` 환경변수 폴백이 두 곳에 분산**
- 위치: `integration-oauth.service.ts` — `createPrivatePendingIntegration`과 `handleInstall` 각각에서 `process.env.APP_URL || 'http://localhost:3011'`
- 상세: 동일한 폴백 문자열이 두 private 메서드에 반복된다.
- 제안: 클래스 레벨 또는 모듈 상수로 추출한다. `const APP_BASE_URL = process.env.APP_URL ?? 'http://localhost:3011';`

---

**[INFO] `needsAttention` 함수의 조건 순서 변경으로 가독성 향상**
- 위치: `status-badge.tsx:64–68`
- 상세: 변경 후 코드가 더 명확하다. `pending_install`을 명시적으로 `false`로 단락시켜 이전의 암묵적인 `status !== 'connected'` 전체 catch보다 의도가 분명하다. 긍정적 변경.

---

**[INFO] SQL 마이그레이션의 Constraint 교체 방식이 안전하지 않을 수 있음**
- 위치: `V042__cafe24_private_app_pending_install.sql:20–25`
- 상세: `DROP CONSTRAINT IF EXISTS` 후 `ADD CONSTRAINT`는 트랜잭션 내에서 atomic하게 처리되지만, 기존 constraint 이름(`integration_status_check`)이 실제 DB와 다를 경우 `IF EXISTS`로 조용히 넘어가 새 constraint만 추가된다. 중복 constraint 가능성은 없지만, constraint 이름이 환경마다 다를 수 있는 레거시 DB라면 주의 필요.
- 제안: 마이그레이션 실행 전 constraint 이름을 검증하는 주석 또는 `\d integration` 확인 방법을 README에 추가 (현재 SQL 주석이 이미 이유를 충분히 설명하고 있어 큰 문제 없음).

---

### 요약

전반적으로 변경사항의 유지보수성 수준은 양호하다. Private 앱 흐름이라는 복잡한 외부 제약(Cafe24가 OAuth를 시작)을 `pending_install` 상태와 `handleInstall` 진입점으로 명확하게 분리했고, 마이그레이션 SQL에 맥락 설명이 충분히 기술되어 있으며, 테스트 헬퍼(`makeQueryBuilder`, `computeTestHmac`, `makePendingCandidate`)가 잘 구조화되어 있다. 주요 우려는 `BeginResult` 유니온의 비대칭 판별자로 인해 타입 내로잉이 불완전하다는 점과, HMAC 로직이 프로덕션·테스트에 이중으로 구현된 점이다. 두 이슈 모두 당장의 버그 위험보다는 미래 수정 시 일관성 보장 실패로 이어질 수 있는 잠재적 기술 부채다.

### 위험도

**LOW**