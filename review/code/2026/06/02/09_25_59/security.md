# 보안(Security) 리뷰

## 발견사항

### **[INFO]** state 파라미터 길이/형식 검증 없음
- 위치: `integration-oauth.service.ts` `rejectCafe24InvalidScope(state: string)` / `handleCallback` 의 `query.state` 수신 후 즉시 SQL 파라미터로 사용
- 상세: `query.state` 값이 컨트롤러에서 라우트 쿼리스트링으로 들어오고, 그대로 `rejectCafe24InvalidScope(query.state)` 로 전달되어 `DELETE FROM integration_oauth_state WHERE state = $1` 의 바인딩 파라미터로 쓰인다. TypeORM `dataSource.query` 는 파라미터 바인딩(`$1`)을 사용하므로 SQL 인젝션 위험은 없다. 그러나 `state` 값 자체에 길이 상한이나 형식(예: 48자 hex) 검증이 없다. 극단적으로 수백 KB짜리 state 문자열을 전달해 DB 쿼리 실행 비용을 높이거나 로그를 오염시키는 DoS 시도가 이론상 가능하다. 기존 `handleCallback` 이 state 를 소비하기 전 동일 검증 부재를 공유하며, `rejectCafe24InvalidScope` 에서도 동일 패턴을 그대로 복제하고 있다.
- 제안: 컨트롤러 또는 서비스 진입점에서 state 길이(예: ≤128자) 및 허용 문자(영숫자+하이픈) 화이트리스트를 DTO 수준 또는 가드로 검증하는 것을 권장한다. 이는 기존 코드의 부재이며 이번 변경에서 신규 추가되지 않았으므로 현재 변경의 책임 범위 밖이나, 동일 패턴을 확산시키는 점에서 언급한다.

---

### **[INFO]** `requiresCafe24Approval` 배열이 프론트엔드에 그대로 렌더링됨 — XSS 위험 평가
- 위치: `scope-tab.tsx` 라인 1369–1372, `requiresApprovalFromError.join(", ")`
- 상세: `last_error.details.requiresCafe24Approval` 배열은 `pickRestrictedApprovalScopes` 가 정적 allowlist(별도 승인 명단)와의 교집합으로 생성하므로, 배열 원소가 서버-사이드에서 정의된 정적 scope 문자열로만 구성된다. 따라서 사용자 제어 입력이 직접 포함되지 않는다. React 의 JSX 텍스트 노드는 기본적으로 이스케이프되므로 XSS 위험이 실질적으로 존재하지 않는다. `readRequiresApproval` 함수도 `typeof s === "string"` 필터를 통해 배열 원소를 string 으로만 제한한다. 현재 구현은 안전하다.
- 제안: 문제 없음. 다만 향후 `pickRestrictedApprovalScopes` 의 입력 범위가 정적 allowlist 밖으로 확장될 경우 렌더링 경로 재검토 필요.

---

### **[INFO]** `markIntegrationCallbackError` 내 `errorCode` 가 로그에 직접 노출
- 위치: `integration-oauth.service.ts` 라인 888–891, `logger.warn` 출력
- 상세: `markIntegrationCallbackError` 의 catch 블록에서 `err.message` 를 `logger.warn` 으로 출력한다. `sanitizeLastErrorMessage` 는 DB 저장 경로에만 적용되고 로그 경로에는 적용되지 않는다. `err` 는 DB `save` 실패 예외이므로 Postgres 에러 메시지(쿼리 일부, 컬럼명)가 로그에 노출될 수 있다. 이는 기존 코드이며 이번 변경에서 신규 추가되지 않았으나, `extra` 파라미터 추가로 인해 `markIntegrationCallbackError` 가 더 많이 호출될 경로가 생겼다.
- 제안: `logger.warn` 출력 시 에러 메시지를 고정 포맷으로 제한하거나, DB 에러 클래스(`QueryFailedError`)를 구별해 코드/제약명만 로그에 남기는 방식으로 민감 정보 노출 범위를 줄이는 것을 고려한다.

---

### **[INFO]** 하드코딩된 시크릿 없음
- 상세: 테스트 파일에서 사용된 `'tok'`, `'ws-1'`, `'u-1'` 등은 단순 픽스처 식별자이며 실제 자격증명이 아니다. 소스 파일 어디에도 API 키, 비밀번호, 실제 토큰이 하드코딩되지 않았다.

---

### **[INFO]** OAuth state 의 provider 무결성 검증은 `rejectCafe24InvalidScope` 경로에서 생략됨
- 위치: `integration-oauth.service.ts` `rejectCafe24InvalidScope` (라인 736–766)
- 상세: 기존 `handleCallback` 의 정상 경로(`handleCallback` → state 소비 후 `record.provider !== provider` 검사)와 달리, `rejectCafe24InvalidScope` 는 state 를 소비한 뒤 `record.provider` 와 라우트 provider (`'cafe24'`) 의 일치 여부를 확인하지 않는다. 실제로는 이 분기에 진입하는 시점에 이미 `provider === 'cafe24'` 로 확정되고, 소비된 row 의 `provider` 가 `'cafe24'` 가 아닌 경우는 비정상이지만, 그 불일치를 명시적으로 거부하지 않는다. 결과적으로 Cafe24 `invalid_scope` 콜백을 악용해 다른 provider 의 state row 를 소비하는 시나리오가 이론상 가능하다(단, `invalid_scope` 를 직접 발생시키려면 실제 Cafe24 OAuth 플로우를 조작해야 하므로 실현 가능성은 낮다).
- 제안: `record.provider !== 'cafe24'` 인 경우 state 를 소비했음을 로그에 남기고 `OAUTH_STATE_MISMATCH` 를 throw 하도록 방어 코드를 추가하는 것을 권장한다.

---

## 요약

이번 변경(`rejectCafe24InvalidScope` 메서드 추가, `handleCallbackWithErrorCapture` 의 `extra` 파라미터 연결, `scope-tab.tsx` 의 `oauth_invalid_scope` 섹션 렌더링)은 보안 측면에서 양호하다. SQL 은 파라미터 바인딩을 일관되게 사용하며 인젝션 위험이 없다. 프론트엔드 렌더링은 정적 allowlist 기반 데이터를 React JSX 텍스트 노드로 출력해 XSS 위험이 없다. 하드코딩된 시크릿 없음. `sanitizeLastErrorMessage` 가 DB 저장 경로에 적용되어 토큰·자격증명이 마스킹된다. 다만 `rejectCafe24InvalidScope` 에서 state row 의 provider 필드를 명시적으로 검증하지 않는 점(INFO)과, state 파라미터에 길이/형식 상한이 없는 점(INFO)은 방어 코드 보강이 권장된다. 두 항목 모두 기존 패턴의 미충족이며 신규 취약점을 도입한 것은 아니다.

## 위험도

LOW

STATUS: SUCCESS
