# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** "judgedRow 조건부 update + affected 판정" 4줄 블록이 3곳에 그대로 반복된다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `update()` (약 834~838번째 줄대), `updateScope()` (약 1427~1431번째 줄대), `reauthorize()` 의 non-OAuth reset 분기 (약 1473~1477번째 줄대)
  - 상세: 세 메서드 모두
    ```ts
    const { affected } = await this.integrationRepository.update(
      this.judgedRow(entity),
      <patch>,
    );
    if (affected === 0) this.throwIntegrationNotFound();
    ```
    를 그대로 복사해 쓰고, 그중 `update()`·`updateScope()`는 이어서 `reloadOrNotFound` → `auditLogsService.record` → `toPublic` 순서까지 동일하게 반복한다. 각 호출부의 patch 내용과 audit action 만 다르다. 이 파일은 이미 `judgedRow`/`reloadOrNotFound`/`requireVisible`/`requireModifiable` 같은 작은 헬퍼로 낙관적 동시성 로직을 잘 추출해 둔 상태라, "조건부 update 한 번" 이라는 원자 단위 하나만 더 추출하면 세 곳의 복붙이 사라진다. 네 번째 변경 지점(예: 다음 PR 의 새 필드 패치)이 생기면 지금 패턴대로 또 복붙될 가능성이 높다.
  - 제안: `private async updateJudgedOrNotFound(row: Pick<Integration,'id'|'workspaceId'|'scope'>, patch: Record<string, unknown>): Promise<void>` 같은 헬퍼로 "judgedRow 계산 → update → affected===0 체크"를 한 곳에 모으고, 세 호출부는 그 헬퍼 + 각자의 reload/audit 로 좁힌다.

- **[WARNING]** e2e 테스트가 실행 순서에 암묵적으로 의존한다 (선언 순서가 곧 통과 조건)
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts` — 마지막 `it('생성자는 자기 personal 을 읽고 · 이름을 바꾸고 · 지운다', ...)` 및 그 앞 주석 `// **반드시 마지막** — beforeAll 이 만든 personalId 를 지운다. 앞의 케이스들이 그 행을 전제로 한다.`
  - 상세: `personalId` 는 `beforeAll` 에서 한 번 만들어져 여러 `it` 블록(목록·404·권한 테스트 등)이 공유하고, 마지막 `it` 가 그 행을 실제로 삭제한다. 파일 내 주석으로 "반드시 마지막" 이라고 못 박아 두었지만, 강제 장치는 주석뿐이다 — 나중에 이 describe 블록 중간에 새 `it` 를 끼워 넣거나 테스트 셔플/병렬 실행 옵션이 도입되면 조용히 깨진다. 이런 순서-의존 스타일은 이 파일에서 처음 도입된 패턴이라(다른 e2e 스펙과 비교해 특이) 다음 작성자가 그대로 따라 할 위험도 있다.
  - 제안: 삭제 대상 personal 통합을 그 `it` 안에서 새로 생성(`createHttp(editor, 'personal')`)해 자기 완결적으로 만들거나, 최소한 `afterAll` 에서의 정리와 별도로 "read→rename→delete" 케이스만 별도 `describe.serial`/전용 fixture 로 분리해 순서 의존을 구조적으로 드러낸다.

- **[INFO]** `assertCanModify` 가 `assertOrgScopeModifiable` 를 그대로 감싸는 1줄 위임 메서드
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `private assertCanModify(row, userRole, action)`
  - 상세: 시그니처·바디가 `integration-visibility.ts` 의 `assertOrgScopeModifiable` 과 완전히 동일하고 추가 로직이 없다(현재 6개 호출부). 클래스 내부에서 이름을 하나 더 두는 의도(문서화·검색 편의)는 이해되지만, 두 이름이 같은 개념을 가리키는 채로 파일을 오가며 읽어야 해 약간의 인지 비용이 있다.
  - 제안: 유지하려면 JSDoc에 "왜 얇은 위임을 두는지"(예: 향후 서비스 국소적 확장점)를 한 줄 남기거나, 그렇지 않다면 호출부에서 `assertOrgScopeModifiable` 을 직접 쓰는 것도 고려할 만하다.

- **[INFO]** mode(`request_scopes`, snake_case)와 action(`request-scopes`, kebab-case) 두 표기 규칙이 같은 개념을 가리킨다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `modifyActionOfBeginMode()`, `codebase/backend/src/modules/integrations/integration-visibility.ts` — `IntegrationModifyAction`
  - 상세: OAuth `begin` 의 wire-level `mode` 값은 snake_case(`request_scopes`)인데, 권한 판정에 쓰는 `IntegrationModifyAction` 은 kebab-case(`'request-scopes'`, `'change-scope'`)다. `modifyActionOfBeginMode` 가 `never` exhaustiveness 체크로 명시적으로 변환해 주고 주석도 있어 실수로 섞일 위험은 낮지만, 두 표기가 같은 어휘를 다르게 적는다는 사실 자체가 grep 으로 전수를 찾을 때(`request_scopes` vs `request-scopes`) 함정이 될 수 있다.
  - 제안: 그대로 둬도 무방하나, 두 상수 파일 어딘가에 "mode 는 wire 값(snake_case), action 은 권한 어휘(kebab-case)" 라는 한 줄 규약을 남겨 두면 향후 grep 함정을 줄일 수 있다.

- **[INFO]** `IntegrationsService` 가 이번 diff 로 더 커졌다 (listing/CRUD, OAuth, 4종 connection-test dispatch, 감사 로그, credential masking, catalog 메타데이터를 한 클래스가 담당)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` (전체 ~1869줄)
  - 상세: 이번 diff 자체는 가시성·인가 로직의 순수 함수 부분(`isIntegrationVisibleTo`, `assertOrgScopeModifiable`, `integrationNotFoundError` 등)을 `integration-visibility.ts` 로 잘 뽑아냈고, 서비스에 남은 `requireVisible`/`requireModifiable`/`judgedRow`/`reloadOrNotFound` 는 각각 5~15줄의 작고 문서화가 잘 된 private 메서드라 이번 추가분 자체의 가독성은 양호하다. 다만 이 서비스는 이미 커넥션 테스트 디스패치(SMTP/HTTP/DB/MCP), OAuth 트리거, 사용처 조회, 활동 로그 집계 등 서로 다른 책임을 한 클래스에 계속 누적하고 있어, 이번 추가로 그 경향이 한 걸음 더 진행됐다.
  - 제안: 지금 당장의 분리를 요구하는 수준은 아니지만, 다음 대규모 변경 시 인가 관련 private 메서드 묶음(`requireVisible`/`assertCanModify`/`requireModifiable`/`judgedRow`/`reloadOrNotFound`)을 별도 협력 객체로 옮기는 리팩터를 후보로 남겨 둘 만하다 — `integration-visibility.ts` 로의 순수 함수 추출이 이미 그 방향의 선례다.

## 요약

이번 변경은 "개인(personal) 통합은 생성자에게만 보이고 Organization 통합의 변경은 Admin 이상" 이라는 인가 규칙을 컨트롤러·서비스·OAuth 콜백·AI 어시스턴트 도구 체인 전체에 일관되게 흘려보내는 대규모 리팩터다. 핵심 판정 로직(`isIntegrationVisibleTo`, `assertOrgScopeModifiable`, `integrationNotFoundError`, `adminRequiredError`)을 `integration-visibility.ts` 순수 함수로 뽑아 두 서비스(`IntegrationsService`, `IntegrationOAuthService`)가 공유하게 한 설계는 유지보수성 관점에서 특히 우수하다 — 같은 판정·같은 문구가 두 곳에서 drift 할 위험을 구조적으로 차단했다. `userId` 파라미터를 컨트롤러→서비스→탐색 도구→AI 어시스턴트까지 일관된 위치(항상 workspaceId 다음)로 실어 나른 점, 판정 완결성을 리플렉션으로 전수 검증하는 캐너리 테스트(`integrations.controller.owner.spec.ts`), `it.each` 기반 표-주도 테스트 스타일도 기존 코드베이스 관례와 일관된다. 발견된 문제는 대부분 INFO 수준의 사소한 표기·위임 이슈이고, 실질적으로 짚을 만한 것은 `integrations.service.ts` 내 "judgedRow 조건부 update" 패턴의 3중 반복과 신규 e2e 스펙의 암묵적 실행 순서 의존 두 가지다. 둘 다 기능적 결함은 아니며 다음 변경 시의 복붙·순서 변경 리스크를 낮추는 선에서 개선하면 된다.

## 위험도

LOW
