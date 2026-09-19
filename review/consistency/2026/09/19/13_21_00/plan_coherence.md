# Plan 정합성 검토 — `spec/2-navigation/` (--impl-prep, 대상 구현 `plan/in-progress/integration-db-http-testers.md`)

## 발견사항

- **[WARNING]** spec-draft 가 developer 턴에 위임한 "DTO 두 항목 확인" 이 구현 plan 체크리스트에 안착하지 않았다
  - target 위치: `plan/in-progress/integration-db-http-testers.md` `## 체크리스트` (전체 7항목 — DTO 확인 관련 항목 없음)
  - 관련 plan:
    - `plan/in-progress/spec-draft-integration-connection-tests.md` `## 비대상` — "(교차참조) 같은 엔드포인트 `/api/integrations/:id/test` 의 응답 DTO 는 트래커의 기존 항목 «MCP 전용 응답 필드 3종이 미선언 + 계약 검증자 미배선» · «`PreviewTestResultDto` 도 `code` 를 미선언» 이 겨눈다. 이 PR 의 구현이 `code` 를 새로 돌려주므로 **developer 턴이 그 두 항목을 확인한다**."
    - `plan/in-progress/spec-draft-nullable-notation-followups.md` L3403 「`/api/integrations/:id/test` 의 MCP 전용 응답 필드 3종이 미선언 + 계약 검증자 미배선」, L3592 「`PreviewTestResultDto` 도 `code` 를 미선언한다 — 같은 클래스의 세 번째 DTO」(둘 다 미체크 `- [ ]`, owner: developer)
  - 상세: `integration-db-http-testers.md`§설계는 "preview-test(저장 전) · `:id/test` · rotate 세 경로가 모두 `dispatchTest` 를 지나므로 한 곳에서 셋이 같이 고쳐진다" 고 명시한다. 즉 이 PR 이후 **preview-test 경로에서도 database/http 실패 시 `DB_AUTH_FAILED`·`HTTP_AUTH_FAILED` 등 신규 `code` 값이 실제로 생산된다.** 그런데 preview-test 응답 DTO 인 `PreviewTestResultDto`(`codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:246-275`)는 `success`/`message`/`capabilities?`/`serverInfo?`/`preview?` 뿐이고 **`code` 필드가 없다**(실측). 컨트롤러(`integrations.controller.ts:176`)가 서비스 반환값을 그대로 통과시키고 전역 `ClassSerializerInterceptor` 류의 whitelist 스트리핑이 없어(실측: `main.ts`/`app.module.ts` 에 미등록) 런타임 값 자체는 새지 않지만, **Swagger 계약·TypeScript 타입에는 여전히 `code` 가 없다** — 트래커 항목이 지목한 결함 표면이 이 PR 로 넓어진다(신규 `DB_*`/`HTTP_*` 코드 값 추가). spec-draft 는 이 확인을 "developer 턴" 몫으로 명시했는데, 실제 developer plan(`integration-db-http-testers.md`)의 체크리스트 7항목("트래커 반영(«비대상» 여섯 등재)" 포함) 중 이 DTO 확인 항목은 없다 — 여섯 등재 대상에서 이 교차참조 항목은 의도적으로 제외돼 있어(비대상 목록 실제로는 7개 불릿, 교차참조 1개를 빼면 6개) 별도 처리로 남겨진 채 착지할 자리를 못 찾았다.
  - 제안: `integration-db-http-testers.md` 체크리스트에 "PreviewTestResultDto/TestConnectionResultDto `code` 서술 확인 — 필요 시 트래커 항목 갱신 또는 이번 PR 범위에 `code?: string` 추가" 항목을 명시적으로 추가할 것. 최소한 두 트래커 항목(`spec-draft-nullable-notation-followups.md` L3403·L3592)에 "integration-db-http-testers PR 이 이 DTO 를 통해 신규 코드값을 추가로 생산함" 역참조를 남겨, 그 배치 plan 이 `complete/` 로 봉인될 때 이 사실이 유실되지 않게 할 것.

- **[INFO]** `spec-draft-integration-connection-tests.md` 체크리스트의 "spec 반영" 항목이 완료됐는데도 미체크
  - target 위치: `plan/in-progress/integration-db-http-testers.md` 서두 — "spec 은 같은 브랜치의 planner 커밋 `74087dff6`... 이 정했다"
  - 관련 plan: `plan/in-progress/spec-draft-integration-connection-tests.md` `## 체크리스트` — `- [ ] spec 반영 (planner 커밋)`
  - 상세: git log 상 `74087dff6`(`docs(spec): 4-integration — 연결 테스트를 실제에 맞춘다...`)가 이미 같은 브랜치에 커밋돼 있고, `integration-db-http-testers.md` 자신도 이를 기정사실로 전제한다. 그런데 spec-draft 문서의 체크리스트는 여전히 이 항목을 미체크 상태로 남겨 두 문서 간 진행 상태 서술이 어긋난다.
  - 제안: `spec-draft-integration-connection-tests.md` 체크리스트의 "spec 반영 (planner 커밋)" 을 체크 완료로 갱신.

## 요약

구현 대상 `integration-db-http-testers.md` 는 같은 브랜치의 spec 커밋(`74087dff6`)과 그 근거 draft(`spec-draft-integration-connection-tests.md`)를 정확히 따르고, 설계(노드 모듈 함수 재사용, SSRF 가드 공유, connection-test 경로는 노드 실행 abort-cascade 컨텍스트 밖이라는 전제)는 `node-cancellation-residual-signal-propagation.md` 가 이미 세운 "연결 테스트 경로는 실행 컨텍스트가 없어 abort-cascade 대상이 아니다"(`rawPing()` 전례) 원칙과도 정합해 새로운 충돌은 없다. 다만 spec-draft 가 명시적으로 "developer 턴이 확인" 하라고 위임한 DTO 두 항목(`PreviewTestResultDto`·`TestConnectionResultDto` 의 `code`/MCP 전용 필드 미선언, `spec-draft-nullable-notation-followups.md` 소재)이 구현 plan 의 체크리스트 어디에도 반영되지 않아 후속 항목이 누락될 위험이 있다 — preview-test 경로가 이번 PR 로 실제 새 코드값을 더 생산하게 되므로 그 확인을 건너뛰면 다음 사람이 다시 처음부터 재발견해야 한다. 그 외 미해결 결정과의 충돌이나 선행 plan 미해소는 발견되지 않았다.

## 위험도

LOW
