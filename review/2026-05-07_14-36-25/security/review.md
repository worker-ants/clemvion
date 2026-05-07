## 발견사항

### [INFO] `workspaceId` 권한 검증은 호출자(caller) 계층에 위임
- **위치**: `candidate-lookup.service.ts` — `fillCandidates(workspaceId, ...)` / `lookupMcpServers(workspaceId)`
- **상세**: `workspaceId`를 그대로 DB 쿼리 스코프로 사용하며, 이 서비스 계층 자체에는 현재 사용자가 해당 워크스페이스에 소속되어 있는지 확인하는 로직이 없다. BOLA(Broken Object Level Authorization) 방어는 컨트롤러·가드 레이어에서 수행한다는 아키텍처 전제다. 본 diff 에서 해당 전제가 깨지는 코드 변경은 없지만, `mcp-server-selector` 분기 추가로 새로운 조회 경로가 생겼으므로 컨트롤러 단의 워크스페이스 멤버십 가드가 이 경로를 커버하는지 재확인을 권장.
- **제안**: `CandidateLookupService`가 주입받는 `workspaceId`가 NestJS Guard/Decorator에 의해 검증된 값인지 통합 테스트 또는 코드 추적으로 명시적 확인.

---

### [INFO] `mcp` 서비스 타입은 화이트리스트 밖 — 의도된 설계이나 문서화 권장
- **위치**: `detect-pending-user-config.ts` `SUPPORTED_INTEGRATION_SERVICE_TYPES` / `candidate-lookup.service.ts` `lookupMcpServers`
- **상세**: `SUPPORTED_INTEGRATION_SERVICE_TYPES`는 `['email', 'http', 'database']`만 포함하며 `mcp`는 없다. `lookupMcpServers`는 사용자 입력을 통하지 않고 `serviceType: ['mcp']`를 하드코딩하므로 설계상 올바르다. 단, 향후 유지보수자가 화이트리스트에 `mcp`를 추가하면 중복 또는 충돌이 발생할 수 있다.
- **제안**: `SUPPORTED_INTEGRATION_SERVICE_TYPES` 정의 옆에 "mcp는 별도 전용 경로(`lookupMcpServers`)를 사용하므로 의도적으로 제외" 주석 추가.

---

### [INFO] `extractSelectedIds`의 ID 포맷 미검증
- **위치**: `candidate-picker.tsx` `extractSelectedIds` 함수
- **상세**: `currentValue`가 SSE 스트림이나 DB 복원 경로에서 올 때, `integrationId` 값의 UUID 형식이나 길이를 별도로 검증하지 않는다. 값은 서버가 제공한 후보 목록에서만 선택되므로 실제 공격 경로는 제한적이지만, 악의적으로 조작된 DB row가 복원되는 경우 예상치 못한 값이 UI에 렌더될 수 있다.
- **제안**: `entry.integrationId`에 UUID 정규식 검사(`/^[0-9a-f-]{36}$/i`)를 추가하거나, 서버 응답 직후 스키마 검증 레이어(Zod 등)로 정규화.

---

### [INFO] `settingsHref` 새니타이징 — 올바르게 구현됨
- **위치**: `candidate-picker.tsx` `sanitizeSettingsHref`, `candidate-picker.test.tsx`
- **상세**: `javascript:` URI 및 외부 URL을 거부하고 `/`로 시작하는 내부 경로만 허용. 테스트로도 검증되어 있다. 추가 조치 불필요.

---

### [INFO] 에러 로그에 DB 오류 메시지 포함 — 서버 내부 노출 없음
- **위치**: `candidate-lookup.service.ts` catch 블록
- **상세**: `err.message`가 `warn` 로그에 포함되지만 클라이언트로 반환되는 응답은 빈 배열(`[]`)뿐이다. 민감 정보가 API 응답으로 유출되는 경로는 없다.

---

## 요약

이번 변경은 `mcp-server-selector` 추가와 다중 선택 지원을 위한 것으로, 전반적인 보안 설계는 양호하다. `integrationServiceType` 화이트리스트를 통한 DB 필터 인젝션 방어, `settingsHref` XSS 방어, 에러 미노출 처리 등 기존 방어 레이어가 새 경로에도 일관되게 적용되어 있다. 가장 중요한 확인 포인트는 `workspaceId` 권한 검증이 컨트롤러 계층에서 보장되는지 여부이며, 이는 본 diff 내에서 직접 확인되지 않는 아키텍처 전제다.

## 위험도

**LOW**