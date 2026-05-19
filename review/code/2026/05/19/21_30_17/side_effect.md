# 부작용(Side Effect) 리뷰

## 발견사항

### 발견사항 1
- **[INFO]** `resolveTokenExpiry` 함수 내부 동작 변경 — 반환값 의미론 변화
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/resolve-token-expiry-jwt-exp-284f57/codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 라인 1456–1483
  - 상세: `resolveTokenExpiry`의 함수 시그니처(`integration: { tokenExpiresAt?, credentials? }`)와 반환 타입(`number | null`)은 변경 전후 동일하다. 단, 이전에는 `tokenExpiresAt`가 있는 경우 그 값을 최우선으로 반환했으나, 변경 이후에는 `credentials.access_token`의 JWT `exp` claim을 먼저 읽고, JWT가 없거나 파싱 실패 시에만 `tokenExpiresAt`로 폴백한다. 호출자(`ensureFreshToken`, `cafe24-token-refresh.processor.ts`) 입장에서 반환값의 의미가 "DB 저장값"에서 "토큰 실제 만료 시각"으로 격상되었으나, 이는 의도된 버그 수정이다. 시그니처 자체는 유지되므로 컴파일러 수준 breaking change 없음.
  - 제안: 이미 의도적 변경이므로 별도 조치 불필요. 단, `resolveTokenExpiry`의 JSDoc(라인 1438–1455)에 JWT exp 우선 여부가 명시되어 있지 않으므로 주석에 우선순위 순서를 명기하면 향후 혼동을 방지할 수 있다.

### 발견사항 2
- **[INFO]** `creds` 변수 선언 위치 이동 — 기능적 부작용 없음
  - 위치: 같은 파일 라인 1464 (diff 기준)
  - 상세: 이전에는 `const creds = ...`가 `tokenExpiresAt` 분기 이후에 있었다. 변경 후에는 함수 상단으로 이동하여 JWT exp 추출에 재사용된다. 이 이동은 `creds` 객체를 더 이른 시점에 생성할 뿐이며 `integration.credentials`가 변경되는 로직 없음. 부작용 없음.
  - 제안: 없음.

### 발견사항 3
- **[INFO]** `parseJwtExp` 신규 import 추가 — 모듈 경계 변화
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/resolve-token-expiry-jwt-exp-284f57/codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` 라인 15
  - 상세: `parseJwtExp`는 `../../../modules/integrations/jwt-exp.js`에서 import된다. 이 함수는 순수 함수(네트워크 호출 없음, 전역 상태 미변경, Node 내장 `Buffer.from` 만 사용)로 구현되어 있어 import 자체로 인한 런타임 부작용은 없다.
  - 제안: 없음.

### 발견사항 4
- **[INFO]** `parseJwtExp`는 이미 `performAuthRefresh` (라인 865) 에서도 호출되고 있어 `resolveTokenExpiry` 내부 호출이 추가됨에 따라 token refresh 경로에서 동일 access_token 에 대해 최대 2회 JWT 파싱이 발생
  - 위치: 라인 865 및 라인 1465
  - 상세: `performAuthRefresh`가 반환한 새 토큰을 저장할 때 `parseJwtExp`를 호출해 `expiresAt`를 결정하고, 이후 `ensureFreshToken`(또는 processor)이 `resolveTokenExpiry`를 재호출하면서 같은 access_token에 대해 재파싱이 발생할 수 있다. `parseJwtExp` 자체가 O(1) 순수 연산이므로 성능 영향은 미미하며, 공유 상태를 변경하지 않아 부작용 없음.
  - 제안: 성능 민감 경로가 아니므로 현재 설계 유지가 적절함.

### 발견사항 5
- **[WARNING]** `resolveTokenExpiry` 의 새 동작이 "access_token 없는 integration" 케이스에서 `tokenExpiresAt`를 폴백으로 사용하는 구조이나, access_token이 있지만 JWT가 아닌 opaque token(예: Cafe24가 미래에 비-JWT 형식으로 변경)인 경우 `parseJwtExp`가 null을 반환하고 TZ-bugged `tokenExpiresAt`를 그대로 사용하게 됨
  - 위치: 라인 1464–1468
  - 상세: 현재 Cafe24 access_token이 JWT 형식임은 실증적으로 확인되어 있으나(테스트·로그 상 확인), 외부 의존성이므로 형식 변경 시 silent fallback이 발생한다. 이 경우 TZ 버그 완화책이 무효화된다. 그러나 이것은 기존 코드에서도 동일하게 존재하던 취약점이며, 이번 변경이 새로 도입한 부작용은 아님.
  - 제안: `parseJwtExp`가 null을 반환하면서 `credentials.access_token`이 존재하는 경우 DEBUG 레벨 로그를 남기는 방어 코드를 고려할 수 있음 (모니터링 목적).

---

## 요약

이번 변경은 `resolveTokenExpiry` 순수 함수 내에 `parseJwtExp` 호출을 최우선 분기로 삽입한 것이다. 함수 시그니처와 반환 타입은 유지되며, 두 호출자(`ensureFreshToken`, `Cafe24TokenRefreshProcessor.process`)의 코드 수정 없이 동작한다. `parseJwtExp` 자체가 전역 상태·파일시스템·네트워크에 아무 영향을 주지 않는 순수 함수이므로 의도치 않은 상태 변경·전역 변수·파일시스템·환경 변수·네트워크 호출·이벤트/콜백 부작용은 모두 해당 없다. 반환값의 의미론이 "DB 저장 만료값 우선" 에서 "JWT exp 우선" 으로 바뀌는 것은 의도된 버그 수정이며, 기존 호출자가 동일한 계약(epoch ms | null)을 유지하므로 인터페이스 파괴 없음. opaque token fallback 시나리오는 이전부터 존재하던 리스크이며 신규 도입 부작용이 아니다.

## 위험도

LOW
