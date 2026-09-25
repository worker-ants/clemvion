# 보안(Security) 리뷰 — Integration Personal-Owner 인가 강화

## 발견사항

- **[WARNING]** 워크플로 실행 경로(`getForExecution`)는 여전히 "남의 personal" 판정을 거치지 않는다 — API 계층에서만 닫힌 BOLA(Broken Object Level Authorization) 구멍
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `requireVisible()` 주석(약 622번째 줄) "실행 엔진 전용 `getForExecution` 만 예외 — 노드 실행 시점 판정은 후속 plan", 및 `getForExecution()` 정의(약 1562번째 줄)
  - 상세: 이번 PR은 `findAll`/`findById`/`getUsages`/`getActivity`/`testConnection`/`rotate`/`requestScopes`/`updateScope`/`remove`/OAuth 콜백 커밋 등 **사람이 직접 부르는 API 경로**에서는 `requireVisible`/`requireModifiable`(=`isIntegrationVisibleTo`)를 일관되게 적용해 "남의 personal 통합"이 보이지도, 바뀌지도 않게 잘 막았다. 그런데 노드 실행 엔진이 자격 증명을 가져오는 유일한 경로인 `getForExecution(id, workspaceId)`는 `workspaceId` 범위만 확인하고 `createdBy`/가시성은 전혀 보지 않는다. 이 함수는 `integration-handler-base.ts`, `mcp-tool-provider.ts`, `cafe24-mcp-tool-provider.ts`, `makeshop-mcp-tool-provider.ts` 등 실제 외부 API 호출·AI Agent 도구 실행에 쓰이는 자격 증명 조회의 유일한 창구다. 워크플로 노드의 `config.integrationId`는 (grep 결과) 저장 시점에 가시성 검증을 받지 않는 것으로 보이므로, 한 워크스페이스의 Editor/Viewer가 다른 멤버의 personal 통합 UUID를 알고 있기만 하면(예: 이 수정 이전에 목록에서 봤거나, 워크플로 JSON을 공유받는 등) 그 UUID를 자신이 편집 가능한 노드 config에 넣어 워크플로를 실행시키는 것만으로 — API 상으로는 그 통합이 "안 보임"에도 불구하고 — 실제로는 그 자격 증명으로 외부 서비스를 호출할 수 있다. 즉 "personal 통합의 자격 증명은 생성자만 쓸 수 있어야 한다"는 이번 PR의 핵심 불변식이 조회/관리 API 표면에서는 성립하지만 실행 표면에서는 아직 성립하지 않는다.
  - 참고: 코드 주석이 이를 명시적으로 "후속 plan" 으로 남겨 두었고 은폐된 회귀가 아니라 **의도적으로 스코프 밖에 둔 잔여 갭**이다. 다만 이 PR의 제목·spec 근거(§8 "Personal 통합 소유자 강제")가 정확히 이 불변식을 표방하므로, 실행 경로가 여전히 뚫려 있다는 점은 보안 리뷰에서 반드시 명시적으로 남겨야 한다고 판단해 WARNING으로 보고한다. 후속 plan에 "노드 실행 시점 판정"을 우선순위로 추적할 것을 권고.
  - 제안: (a) 워크플로 노드 config 저장(생성/수정) 시 `integrationId`가 가리키는 행이 **워크플로 소유자/편집자에게 보이는지**를 검증하거나, (b) `getForExecution`도 워크플로의 `createdBy`(또는 실행을 트리거한 주체)를 받아 `isIntegrationVisibleTo`를 적용하거나, (c) 최소한 이 갭을 `plan/`에 추적 항목으로 등록해 "후속 plan"이 실제로 예정돼 있음을 보장.

## 요약

이 변경은 `codebase/backend/src/modules/integrations/*`에 걸쳐 "Personal 통합은 생성자에게만 보이고 역할 우위가 없다 · Organization 통합의 변경은 Admin 이상" 이라는 인가 규칙(spec `2-navigation/4-integration.md` §8)을 순수 함수(`integration-visibility.ts`)로 단일화해 컨트롤러·서비스·OAuth 콜백 세 지점에 일관 적용한, 잘 설계된 인가 강화(Broken Object/Function Level Authorization 수정) 패치다. 긍정적으로 확인한 설계 요소: 없는 통합과 남의 personal이 **동일한 404 `RESOURCE_NOT_FOUND`**를 반환해 존재 여부 열거(enumeration)를 차단, 목록 조회는 메모리 필터링이 아닌 SQL `WHERE` 절(`integrationVisibilityClause`)로 걸러 페이지네이션 `total` 오염을 방지, OAuth 재인증/scope 추가 콜백은 `WorkspacesService` 미주입 시 **fail-closed**로 거부, rotate/remove/updateScope는 판정 근거(`scope`)를 조건절에 실은 compare-and-set(`judgedRow`)으로 TOCTOU/lost-update 경쟁을 차단, 삭제는 사용처 조회보다 인가를 먼저 수행해 403 없이 409 존재 확인을 하지 못하게 함, `createdBy`는 항상 서버 측 인증된 `userId`로만 설정. `integrationVisibilityClause`의 SQL 조각은 사용자 입력이 아닌 고정 alias만 받아 SQL 인젝션 위험이 없고, 하드코딩된 시크릿·안전하지 않은 암호화·평문 전송 등은 발견되지 않았다. 유일하게 남는 실질적 우려는 위에 적은 실행 엔진 경로(`getForExecution`)의 가시성 미검증으로, 코드 스스로 "후속 plan"이라 명시한 의도적 스코프 제외이지만 이번 PR이 표방하는 보안 불변식을 완전히는 충족하지 못한다는 점에서 WARNING으로 남긴다. 그 외 발견된 Critical은 없다.

## 위험도

MEDIUM
