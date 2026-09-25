# 변경 범위(Scope) 리뷰 — integration-personal-owner (3라운드)

## 검토 방법

`_prompts/scope.md` 에 나열된 `codebase/**` 26개 파일(backend 22 + frontend mdx 4) 의 unified diff 를 전수로 읽었다. 대상 파일 전체 목록:

1. `dto/responses/integration-response.dto.ts`
2. `integration-oauth.service.cafe24.spec.ts`
3. `integration-oauth.service.makeshop.spec.ts`
4. `integration-oauth.service.spec.ts`
5. `integration-oauth.service.ts`
6. `integration-visibility.spec.ts` (신규)
7. `integration-visibility.ts` (신규)
8. `integrations.controller.owner.spec.ts` (신규)
9. `integrations.controller.ts`
10. `integrations.service.spec.ts`
11. `integrations.service.ts`
12~21. `workflow-assistant/tools/{assistant-finish-guard,assistant-tool-router,candidate-lookup,explore-tools}.service{,.spec}.ts` + `workflow-assistant-stream.service{,.spec}.ts`
22. `test/integration-personal-owner.e2e-spec.ts` (신규)
23~26. `docs/06-integrations-and-config/integration-management{,.en}.mdx`, `docs/07-workspace-and-team/workspaces-and-members{,.en}.mdx`

프롬프트 자체의 "호출자 고지" 가 이 PR 의 의도를 명시한다: Personal 통합은 생성자만 접근(남의 personal 은 없는 통합과 동일한 404), Organization 통합의 변경은 Admin 이상으로 제한하는 보안 수정 + 제품 동작 변경이며, `spec/2-navigation/4-integration.md` §8 판정 규칙을 근거로 한다. 이 의도를 기준선으로 각 파일의 변경이 그 범위 안에 있는지 대조했다.

## 발견사항

발견된 범위 이탈 항목 없음. 26개 파일 전부가 다음 중 하나의 형태로 "판정 규칙 §8 강제" 라는 단일 의도에 직접 연결된다:

- **핵심 판정 로직 신설** — `integration-visibility.ts` (신규): `isIntegrationVisibleTo` · `integrationVisibilityClause` · `integrationNotFoundError` · `assertOrgScopeModifiable` · `adminRequiredError`. 두 서비스(`IntegrationsService`, `IntegrationOAuthService`)가 서로 주입하지 못하는 구조적 제약 때문에 순수 함수 모듈로 추출한 것이며 본문 주석이 그 이유를 직접 밝힌다.
- **판정을 소비하는 지점 전체로 전파** — `integrations.service.ts`(`findAll`/`findById`/`update`/`remove`/`rotate`/`requestScopes`/`updateScope`/`reauthorize`) 와 `integrations.controller.ts`(전 `:id` 라우트 + `oauth/begin`)가 새 판정 함수를 부르도록 일관되게 바뀌었다. `userId`/`userRole` 파라미터 추가는 이 판정이 요구하는 최소 정보다.
- **콜백 커밋 직전 재판정** — `integration-oauth.service.ts` 의 `assertRequesterStillAllowed` + `pickPrecheckConflict` 공통화는 "begin 시점 판정만으로는 콜백의 자격 증명 덮어쓰기를 막지 못한다" 는 동일 위협 모델의 연장이다(스펙·PR 노트가 명시).
- **AI 어시스턴트 통합 후보 필터링** — `workflow-assistant/tools/*` 5개 파일 + 그 스펙은 `IntegrationsService.findAll`/`ExploreToolsService.listIntegrations` 시그니처가 `userId` 를 요구하게 된 것의 **불가피한 연쇄**다: 이 값을 어시스턴트 스트림 서비스(`workflow-assistant-stream.service.ts`)에서 `assistant-tool-router` → `candidate-lookup`/`explore-tools` 까지 그대로 실어 나르는 것 외에 다른 선택지가 없다. 새 기능 추가가 아니라 시그니처 변경의 기계적 전파.
- **e2e 캐너리** — `integration-personal-owner.e2e-spec.ts` 는 위 판정을 실제 HTTP 계층에서 검증하며, 다루는 케이스(목록 필터링, `:id` 8개 라우트 404, `oauth/begin` 우회 차단, Organization 변경 403, 생성자 자기 personal 통과)가 정확히 스펙 §8 이 나열한 invariant 집합과 일치한다.
- **문서 4건** — 두 mdx 문서(ko/en 쌍)의 변경분은 전부 "Personal 범위는 생성자만 본다 / Organization 변경은 Admin 이상" 이라는 새 동작을 반영하는 문장·권한 표 갱신이며, 그 외 문단은 손대지 않았다.

부수적으로 관찰된, 범위를 벗어나지 않는 정리성 변경(참고용, 발견사항 아님):
- `integrations.service.ts` 상단에서 더 이상 직접 쓰지 않게 된 `NotFoundException`/`ForbiddenException` import 제거 — `integration-visibility.ts` 로 로직을 옮긴 직접적 결과이며 dead import 정리이지 별도 임포트 청소가 아니다.
- `dto/responses/integration-response.dto.ts` 의 `PRECHECK_IDENTITY_MASKED` 상수화는 같은 파일 안에서 두 번 반복되던 설명 문구를 하나로 묶은 것으로, 이번 PR 이 추가한 "충돌 대상이 남의 personal 이면 식별자를 뺀다" 서술 자체가 신규이므로 반복 방지가 새 코드 추가와 동시에 이뤄진 것이며 기존 코드에 대한 불필요한 리팩터링이 아니다.
- `integrations.service.ts` 의 `update`/`remove`/`rotate`/`updateScope`/`reauthorize` 가 `save()` 대신 조건부 `update()`(`judgedRow`)로 바뀐 것은 diff 상 큰 변경처럼 보이지만, 커밋 로그(`5999aedfe`)와 PR 노트가 밝히듯 "판정 뒤 scope 가 바뀌면 그 판정에 쓰지 않는다"는 이번 기능이 요구하는 TOCTOU 방지책이지 무관한 저장 방식 리팩터링이 아니다.

설정 파일(`package.json`/`tsconfig`/lint 설정 등) 변경, 포맷팅-only 커밋, 미사용 임포트 추가, 관련 없는 모듈 수정은 발견되지 않았다.

## 요약

리뷰 대상 26개 `codebase/**` 파일 전부가 "Personal 통합은 생성자만, Organization 변경은 Admin 이상" 이라는 단일 보안/동작 변경 의도에 직접 연결된다. 핵심 판정 모듈 신설 → 두 서비스·컨트롤러의 소비 지점 전파 → 시그니처 변경의 필연적 결과인 AI 어시스턴트 도구 체인 전파 → e2e 검증 → 문서 갱신까지, diff 규모는 크지만 모두 같은 원인(함수 시그니처에 `userId`/`userRole` 을 실어야 하는 판정 도입)에서 기계적으로 파생된 변경이며 의도 이상의 추가 수정·불필요한 리팩터링·기능 확장·무관한 파일 수정·포맷팅 혼입·불필요한 주석/임포트 변경·의도치 않은 설정 변경 중 어느 것도 관찰되지 않았다.

## 위험도

NONE
