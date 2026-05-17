### 발견사항

- **[INFO]** `extractCafe24ScopeTokens` — unknown 타입 에러 바디의 얕은 파싱에서 무한 중첩 없이 2-depth 까지만 탐색
  - 위치: `backend/src/nodes/integration/cafe24/metadata/restricted-approval.ts` 라인 943–971
  - 상세: 함수는 `body` 가 object 일 때 값들을 순회하며 string 을 추출한다. 1-depth nested object 까지 지원하도록 구현되어 있어 의도적인 depth 제한이 적용되어 있다. 그러나 정규식 `TOKEN_RE = /mall\.(?:read|write)_[a-z_]+/g` 는 `_` 를 허용하여 `mall.read_a_b_c` 같은 임의 문자열도 매칭된다. 이 자체는 큰 위험은 아니지만, 외부(Cafe24 API) 에서 수신한 에러 바디를 파싱하는 코드이므로 조작된 응답이 들어올 경우 false-positive 매칭 가능성이 있다.
  - 제안: 허용 scope 토큰을 `SCOPE_LEVEL_RESTRICTED_SCOPES` 화이트리스트와 교차하는 `pickRestrictedApprovalScopes` 를 통해 필터링하므로 현 구조는 안전하다. 다만 정규식 패턴을 `mall\.(?:read|write)_[a-z]+(?:_[a-z]+)*` 로 좁히면 더 명확해진다.

- **[INFO]** `lastError.details` 필드가 `Record<string, unknown>` 으로 프론트엔드에 노출됨
  - 위치: `frontend/src/lib/api/integrations.ts` 라인 1450–1453, `frontend/src/app/(main)/integrations/[id]/scope-tab.tsx` 라인 1181–1183
  - 상세: `scope-tab.tsx` 에서 `integration.lastError?.details` 를 `{ requiresCafe24Approval?: string[] }` 로 타입 단언(`as`)하여 사용한다. 이 필드는 백엔드가 제어하는 값이므로 신뢰할 수 있는 소스이지만, API 응답 검증 없이 타입 단언을 사용하는 패턴은 추후 필드 구조가 바뀔 경우 런타임 오류로 이어질 수 있다.
  - 제안: `Array.isArray(details?.requiresCafe24Approval)` 로 런타임 타입 가드를 추가하면 방어적 코드가 된다. XSS 위험은 없음 — `requiresApprovalFromError.join(", ")` 는 React 에서 텍스트 노드로 렌더링되어 이스케이프된다.

- **[INFO]** `RestrictedScopeNotice` 컴포넌트의 `inquiryUrl` 기본값이 하드코딩됨
  - 위치: `frontend/src/components/integrations/approval-required-badge.tsx` 라인 1389
  - 상세: `inquiryUrl = "https://developers.cafe24.com"` 이 prop 기본값으로 하드코딩되어 있다. 같은 URL 이 `restricted-approval.ts` 의 `INQUIRY_URL` 상수에도 정의되어 있어 두 곳에 중복 존재한다. 외부 URL 이므로 Cafe24 가 URL 을 변경하면 한 곳만 갱신될 위험이 있다.
  - 제안: 프론트엔드에서 백엔드 공개 메타(`restrictedApproval.inquiryUrl`)를 직접 사용하도록 호출측에서 `inquiryUrl` prop 을 명시적으로 전달하는 방향을 권장한다. 이미 백엔드 `Cafe24RestrictedApproval.inquiryUrl` 이 `required` 필드로 선언되어 있어 구조는 갖춰진 상태이다.

- **[INFO]** `integration-configs.tsx` 에서 ⚠ 이모지가 라벨 문자열에 직접 삽입됨
  - 위치: `frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` 라인 1321–1322
  - 상세: 드롭다운 옵션 라벨을 `` `${op.label} ⚠ ${t("nodeConfigs.integration.cafe24OperationApprovalSuffix")}` `` 로 구성한다. 이 문자열이 접근성 트리의 label 로 사용될 경우 스크린 리더가 ⚠ 를 "경고 삼각형" 으로 읽을 수 있어 접근성 품질에 영향을 준다. 직접적인 보안 취약점은 아니다.
  - 제안: `ApprovalRequiredBadge` 와 같이 `aria-hidden` + 별도 `aria-label` 을 사용하는 컴포넌트 기반 렌더링으로 전환하면 접근성과 보안(문자열 인젝션 방지) 모두 개선된다.

- **[INFO]** `catalog-sync.spec.ts` 의 파일시스템 파싱에서 임의 마크다운 파일 읽기
  - 위치: `backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` 라인 348–349
  - 상세: `readFileSync(filePath, 'utf-8')` 로 카탈로그 파일을 읽고 `|` 파이프 기반 파싱을 수행한다. 테스트 전용 코드이며 `CATALOG_DIR` 은 소스 트리 내 고정 경로이다. 경로 탐색 위험은 없다. 그러나 `cells.length < 9` 로 최소 컬럼 수를 체크한 후 `columnIndex` 기반 동적 접근을 혼용하는 구조에서, 헤더가 없는 파일이 잘못 파싱되어도 조용히 0행을 반환할 뿐이라 테스트가 통과 — false-negative 가능성이 있다.
  - 제안: `columnIndex.id === undefined` 같이 필수 컬럼의 존재 여부를 파싱 시작 시 명시적으로 검증하면 테스트 신뢰도가 높아진다.

- **[INFO]** `markAuthFailed` 에 전달되는 `errBody` 가 외부 API 응답의 raw 값
  - 위치: `backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 라인 1247–1248
  - 상세: `markAuthFailed(integration, reason, errBody)` 에서 `errBody` 는 Cafe24 API 가 반환한 HTTP 응답 바디 그대로다. 이 값이 `extractCafe24ScopeTokens` → `pickRestrictedApprovalScopes` 를 거쳐 `requiresCafe24Approval: string[]` 로 DB에 저장된다. 외부 소스에서 비롯된 데이터가 저장소에 기록되는 경로이다.
  - 상세 추가: `pickRestrictedApprovalScopes` 가 `SCOPE_LEVEL_RESTRICTED_SCOPES` 화이트리스트 교차 필터링을 수행하므로 임의 문자열이 저장되지 않는다. 또한 `sanitizeLastErrorMessage` 가 `message` 필드를 별도 새니타이징한다. 현재 구현은 안전하다.
  - 제안: 허용 화이트리스트 필터가 핵심 방어선이므로 `SCOPE_LEVEL_RESTRICTED_SCOPES` 의 변경은 `restricted-approval.ts` 단일 위치에서만 이루어지도록 유지한다 (현재 올바르게 관리됨).

### 요약

이번 변경은 Cafe24 OAuth 파트너 승인 스코프 식별 및 UI 표시 기능을 추가한 것으로, 전반적인 보안 설계는 양호하다. 외부 API 응답에서 추출한 스코프 토큰이 하드코딩된 화이트리스트(`SCOPE_LEVEL_RESTRICTED_SCOPES`)와의 교차 필터링을 거친 후 저장되므로 임의 문자열 주입 위험이 차단되어 있다. SSRF 방어 가드(`url.protocol !== 'https:'` / `hostname.endsWith('.cafe24api.com')`) 는 기존 코드에서 유지되며, 에러 메시지에 민감 정보가 노출되지 않도록 `sanitizeLastErrorMessage` 래퍼가 적용되어 있다. 프론트엔드에서 `lastError.details` 를 타입 단언으로 사용하는 부분과 `inquiryUrl` 의 중복 하드코딩이 경미한 위험 요인이나 실질적인 보안 취약점 수준에는 이르지 않는다. 인젝션, 하드코딩된 시크릿, 인증/인가 우회, 암호화 미적용 등 OWASP Top 10 핵심 항목에 해당하는 문제는 발견되지 않았다.

### 위험도

LOW
