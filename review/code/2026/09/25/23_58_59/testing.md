# 테스트(Testing) 리뷰 — Personal 통합 소유자 강제 (integration-personal-owner)

## 발견사항

- **[INFO]** `findAll` 의 `scope=personal` 명시 필터와 신설 가시성 절(`integrationVisibilityClause`)이 함께 걸릴 때의 조합 테스트가 없다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.spec.ts:2386` (`it('applies q/scope/serviceType/status filters to query builder', ...)`, `describe('findAll')` 블록 전체)
  - 상세: `findAll` 은 이제 항상 `andWhere(integrationVisibilityClause('i'), ...)` 를 걸고, 사용자가 쿼리로 `scope: 'personal'` 을 지정하면 별도의 `i.scope = :scope` 조건이 더 붙는다. 두 조건 모두 단순 `AND` 라 SQL 상 상호작용 위험은 낮지만, "내 personal 만 필터링" 이라는 사용자 시나리오(스코프 필터+가시성 절 동시 적용)를 직접 검증하는 유닛/e2e 케이스는 없다. `findAll` 테스트는 필터 종류별로는 있지만 필터×가시성 조합은 비어 있다.
  - 제안: `service.findAll('ws-1', OTHER, { scope: 'personal' })` 호출 시 `qb.andWhere` 호출 인자에 두 조건이 모두 실리는지(또는 e2e 로 실제 응답에 자기 personal 만 남는지) 확인하는 케이스 하나 추가.

- **[INFO]** e2e 스펙의 `beforeAll` 에서 admin 승격 조회 결과에 대한 방어적 단언이 없다.
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts:120-128` (`adminMember.rows[0].id` 접근부)
  - 상세: `SELECT id FROM workspace_member ...` 결과가 비어 있으면(초대 헬퍼가 조용히 실패하는 등) `adminMember.rows[0]` 이 `undefined` 가 되어 `.id` 접근에서 `TypeError` 로 죽는다 — 실패 자체는 감지되지만 원인이 무엇인지 스택트레이스만으로는 알기 어렵다(어떤 케이스가 죽었는지도 이후 8개 테스트가 전부 `beforeAll` 실패로 함께 죽어 묻힌다).
  - 제안: `expect(adminMember.rows).toHaveLength(1)` 한 줄을 앞에 추가해 실패 지점을 명확히 한다.

- **[INFO]** e2e 스펙은 테스트 간 실행 순서에 의존한다 — 마지막 테스트가 `beforeAll` 이 만든 `personalId` 를 삭제한다.
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts:248-258` (`// **반드시 마지막**` 주석 + `it('생성자는 자기 personal 을 읽고 · 이름을 바꾸고 · 지운다', ...)`)
  - 상세: Jest 는 파일 내 `it` 를 선언 순서대로 순차 실행하므로 현재는 깨지지 않지만, 파일이 커지거나 `test.concurrent`/`--randomize` 옵션이 도입되면 조용히 깨지는 구조다. 주석으로 의도를 밝혀 둔 점은 좋으나, 테스트 자체가 그 전제를 강제하지 않는다(예: 별도 `afterAll` 에서 정리하거나, 이 테스트만 별도 personal 통합을 새로 만들어 자기 완결적으로 만드는 방법도 있다).
  - 제안: 우선순위는 낮음 — 현재 실행 모델에서는 안전하다. 다만 다른 e2e 스펙들의 관례(각 `it` 가 자기 fixture 를 만드는지)와 맞추면 더 안전하다.

- **[INFO]** `IntegrationsService.getForExecution` 은 이번 PR 의 가시성 판정(§8) 을 의도적으로 우회하는 유일한 경로로 문서화돼 있으나, 그 경계를 지키는 회귀 캐너리가 없다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:622` (주석 "실행 엔진 전용 {@link getForExecution} 만 예외") / `:1562` (`async getForExecution(...)`)
  - 상세: `integrations.controller.owner.spec.ts` 는 리플렉션으로 `:id` HTTP 라우트 전수를 캐너리로 잡아 새 라우트가 판정 없이 추가되는 것을 막는다(좋은 설계). 반면 `getForExecution` 처럼 **컨트롤러를 거치지 않는** 내부 호출 경로가 향후 늘어나 실수로 가시성 판정을 우회하는 새 진입점이 생겨도 잡아줄 테스트는 없다. 다만 현재는 예외가 하나뿐이고 plan 상 후속 작업으로 명시돼 있어 지금 당장 막을 필요는 낮다.
  - 제안: 지금 조치는 불요. 실행 엔진 판정 후속 plan 착수 시 "getForExecution 이 유일한 예외" 를 확인하는 테스트(예: `IntegrationsService` 의 public 메서드 중 `requireVisible`/`requireModifiable` 을 거치지 않는 것이 이 하나뿐임을 리플렉션으로 확인)를 함께 추가하는 것을 권고.

## 긍정적으로 눈에 띈 점 (참고)

- `integration-visibility.ts` 의 순수 함수(`isIntegrationVisibleTo`, `integrationVisibilityClause`, `adminRequiredError`, `assertOrgScopeModifiable`) 는 `integration-visibility.spec.ts` 에서 `it.each` 로 경계값(personal/organization × 본인/타인, 각 역할)을 빠짐없이 덮는다.
- `pickPrecheckConflict` (cafe24/makeshop precheck 공통 판정)의 "충돌 행이 남의 personal 이면 식별자를 숨긴다" 규칙이 우선순위 매치 케이스와 fallback 케이스 양쪽에 대해 `it.each` 로 존재한다.
- `integrations.service.spec.ts` 는 "판정 뒤 scope 가 바뀌면 조건부 쓰기 0행 → 404 · 감사 없음" 이라는 TOCTOU 레이스를 `update`/`remove`/`reauthorize`/`updateScope` 4개 경로에 대해 `it.each` 로, `rotate` 는 락 안 재조회 시나리오로 별도 커버한다 — 뮤테이션(조건절에서 `scope` 를 빼는 회귀)이 들어와도 이 스위트가 잡는다.
- `integrations.controller.owner.spec.ts` 는 `Reflect.getMetadata(PATH_METADATA, ...)` 로 `:id` 라우트를 전수 추출해 판정 표(`BY_ID`)와 대조하는 완결성 캐너리를 두었다 — 새 `:id` 라우트가 판정 없이 추가되면 이 테스트가 즉시 실패한다. 공허성 가드(`expect(idRoutes.length).toBeGreaterThan(0)`)까지 갖춰 리플렉션이 아무것도 못 찾는 상황(거짓 통과)도 막는다.
- `IntegrationsController` mock 대신 **실제** `new IntegrationsService(...)` 를 생성자 인자 9개 순서 그대로 넣어 사용한다(mock 이 아니라 fake repo 들만 주입) — 컨트롤러 스펙이 서비스 로직까지 함께 태우므로 mock 과 실제 동작의 괴리 위험이 낮다. 생성자 인자 순서를 실제 소스와 대조한 결과 정확히 일치한다.
- `handleCallback` 커밋 직전 재판정(`assertRequesterStillAllowed`) 은 `it.each` 로 reauthorize/request_scopes 두 모드, 조직 역할 강등(editor/viewer/null), 거부 문구, owner/admin 통과, 본인 personal 스킵, `pending_install` 스킵, `WorkspacesService` 미주입 시 fail-closed 까지 分岐 전부를 덮는다 — `OAuthStateMode` 가 `'new'|'reauthorize'|'request_scopes'` 3종뿐임을 확인했고 세 모드 모두 판정 대상 여부가 정확히 코드와 일치하게 테스트돼 있다.
- 워크플로 어시스턴트 쪽(파일 12~21)은 대부분 기계적 파라미터 스레딩(`userId` 추가)이며, `candidate-lookup.service.spec.ts` 의 `mock.calls[0][2]` 인덱스 조정처럼 시그니처 변경에 맞춰 정확히 갱신됐다. 다만 이 경로들은 "userId 를 전달하는지" 까지만 유닛으로 보고, 실제 필터링 결과(SQL 레벨)는 `integration-visibility`/`IntegrationsService.findAll`/`ExploreToolsService.listIntegrations` 쪽 테스트가 보증하므로 중복 없이 책임이 잘 나뉘어 있다.

## 요약

이번 PR 은 "Personal 통합은 생성자에게만 보이고 Organization 통합 변경은 Admin 이상" 이라는 보안 직결 규칙을 컨트롤러 10여 개 라우트·OAuth 콜백 커밋 직전 재판정·workflow-assistant 후보 조회까지 일관되게 퍼뜨리면서, 각 층(순수 판정 함수 유닛 → 서비스 TOCTOU 레이스 → 컨트롤러 라우트 완결성 리플렉션 캐너리 → e2e)에 대응하는 테스트를 동반 배치했다. 특히 조건부 쓰기 0행 레이스와 `:id` 라우트 신설 누락을 막는 캐너리 설계는 이 저장소의 과거 재발 패턴(라우트별 수동 부착 누락)을 정확히 겨냥하고 있어 완성도가 높다. 발견된 갭은 전부 INFO 수준으로, `findAll` 의 필터×가시성 조합 미검증, e2e `beforeAll` 의 방어적 단언 누락, e2e 테스트 순서 의존, `getForExecution` 예외 경계의 무캐너리 정도이며 어느 것도 현재 동작을 잘못 통과시키는 거짓 양성 위험을 만들지 않는다.

## 위험도

LOW
