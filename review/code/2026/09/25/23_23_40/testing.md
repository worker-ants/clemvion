# 테스트(Testing) 리뷰 — Personal 통합 소유자 강제 (§8)

## 총평

이 변경 세트(`integration-visibility.ts` 신설 + `IntegrationsService`/`IntegrationOAuthService`/`IntegrationsController`/workflow-assistant 도구 체인 전반의 `userId` 배선)는 테스트 관점에서 상당히 성숙하다. 특히:

- `integrations.controller.owner.spec.ts` 는 리플렉션으로 `:id` 라우트를 전수 나열해 판정 누락을 구조적으로 막는 "완결성 캐너리"를 도입했다 — 새 라우트가 판정 표에 없으면 테스트 자체가 실패한다.
- `IntegrationsService.findAll` 의 모든 실제 호출부(`integrations.controller.ts`, `candidate-lookup.service.ts` 2곳)가 `userId` 를 넘기도록 수정되었고, 각각 대응하는 spec 이 갱신·추가되어 있다 (grep 으로 미배선 호출부 없음을 확인).
- `it.each` 행렬로 personal/organization × 요청자 신원 × 역할의 조합을 체계적으로 덮었고, `errorOf()` 헬퍼는 "resolve 되면 실패" 가드로 fulfilled/rejected 를 명확히 구분한다(공허성 방지).
- 조건부 쓰기(`judgedRow`) 도입에 따른 "판정 뒤 scope 가 바뀌면 0행 → 404" 레이스 시나리오가 `mockResolvedValueOnce` 로 재현되어 있다.

그럼에도 새로 도입된 `requireModifiable`/`oauth/begin` 경로에 한정해 완결성 캐너리 자신의 설계 원칙(§8 "생성자 본인은 통과한다")이 빠짐없이 적용되지 않은 지점이 있다.

## 발견사항

- **[WARNING]** `oauth/begin` 의 `integrationId` 재판정 경로에 "본인 personal → 통과" 테스트가 없다 — 완결성 캐너리 자신의 설계 원칙(#3)이 이 서브블록에는 적용되지 않았다
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.owner.spec.ts` — `describe('oauth/begin — integrationId 를 지정한 재인증 · scope 추가는 :id 경로와 같은 판정', ...)` (게이트 257행 부근, `it.each` 세 블록은 게이트 266·277·291·305행)
  - 상세: 이 파일의 헤더 주석(게이트 24행)은 판정 완결성 캐너리의 원칙을 "1) 라우트 전수, 2) 남의 personal → 404, **3) 생성자 본인으로 불러 통과를 본다**" 로 명시한다. `BY_ID` 표를 쓰는 일반 `:id` 핸들러들은 이 세 원칙을 모두 만족한다(게이트 223·247행에 각각 404·통과 테스트가 있다). 그런데 `oauth/begin` 서브블록(게이트 257~309행)은 남의 personal → 404(게이트 266)와 Organization 통합의 403/200(게이트 277·291)만 테스트하고, "요청자 본인의 personal 통합을 `integrationId` 로 지정해 `oauth/begin` 을 호출하면 통과한다" 는 케이스가 없다. `mode: 'new'` 테스트(게이트 305)는 판정 자체를 건너뛰는 경로라 대체가 되지 않는다.
  - 서비스 레벨에서 `requireModifiable` 의 "본인 personal, 역할 무관 통과" 로직 자체는 `integrations.service.spec.ts` 의 `ownMutations`(`reauthorize`·`requestScopes` 항목이 내부적으로 `requireModifiable` 을 호출)를 통해 간접적으로는 검증된다. 하지만 **`oauthBegin` 컨트롤러가 이 판정을 통과한 뒤 실제로 `oauthService.begin` 을 호출하는 배선 자체**는 남의 personal(차단)·Organization(차단/허용) 경우만 있고, 본인 personal(허용) 경우는 어디에서도 직접 검증되지 않는다. `:id/reauthorize` 라우트를 우회하는 새 입구(`oauth/begin` + `integrationId`)를 이 PR 이 막는 것이 핵심 목적인 만큼, "우회 입구가 정상 케이스는 여전히 통과시킨다" 는 것도 같은 캐너리로 보장하는 것이 설계 의도에 맞다.
  - 제안: `describe('oauth/begin — ...')` 안에 `it('본인 personal integrationId — 통과 (oauthBegin 호출)', ...)` 를 추가해 `integrationRepo.findOne.mockResolvedValue(googlePersonal())`(생성자=CREATOR) 상태에서 `begin(CREATOR, 'reauthorize', 'int-1')` 이 `oauthBegin` 을 호출함을 확인한다.

- **[INFO]** `pickPrecheckConflict` 의 priority 선택과 가시성 판정의 조합(다중 행) 이 단일 행 픽스처로만 검증된다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `pickPrecheckConflict` (게이트 351~365행). 대응 테스트: `integration-oauth.service.cafe24.spec.ts` 게이트 824~856행, `integration-oauth.service.makeshop.spec.ts` 게이트 618~648행
  - 상세: 새 `it.each` 행렬과 "priority 밖 상태의 fallback" 테스트는 모두 **한 행짜리** fixture 로 personal/organization × 생성자 여부를 검증한다. `pickPrecheckConflict` 는 `rows.find(status)` 로 우선순위 상태를 먼저 고르고, `identity()` 는 그 선택된 `hit` 하나에만 적용되므로 로직 자체는 다른 행의 존재에 영향받지 않는다 — 실제 회귀 위험은 낮다. 다만 "priority 로 선택된 행이 남의 personal 이고, 낮은 우선순위 행이 요청자 소유" 같은 다중 행 조합은 명시적으로 재현된 적이 없어, 향후 `pickPrecheckConflict` 를 리팩터링할 때 이 조합이 깨져도 지금 테스트로는 못 잡는다.
  - 제안: 필수는 아니나, 다중 행(예: connected=남의 personal, pending_install=본인 personal) 케이스 하나를 추가하면 "priority 선택은 가시성과 무관하게 먼저 일어난다" 는 불변식이 명시적으로 고정된다.

- **[INFO]** e2e 스펙의 테스트 간 순서 의존성 — 격리 원칙과는 어긋나지만 문서화되어 있고 동일 파일 내 순차 실행이 전제
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts` — 게이트 248행 주석(`// **반드시 마지막** — beforeAll 이 만든 personalId 를 지운다...`), 마지막 `it` 블록 게이트 249~258행
  - 상세: `beforeAll` 에서 생성한 `personalId` 를 앞선 여러 `it` 블록이 전제로 읽다가, 마지막 `it` 이 그 행을 rename 후 delete 한다. Jest 는 같은 `describe` 안의 `it` 을 선언 순서대로 실행하므로 현재는 안전하지만, "테스트 격리" 관점에서는 파일 내 위치에 암묵적으로 의존하는 상태 공유다 — 이 파일에 새 `it` 을 마지막 뒤에 추가하면 조용히 깨진다.
  - 제안: 이미 주석으로 경고되어 있어 즉시 조치가 필요하진 않으나, 가능하면 삭제 검증용 통합을 별도 `beforeAll`/전용 fixture 로 분리해 순서 의존을 없애는 편이 안전하다.

## 요약

새로 추가된 가시성 규칙(`isIntegrationVisibleTo`/`integrationVisibilityClause`)과 그 소비처(서비스 10여 개 메서드, 컨트롤러 전 라우트, workflow-assistant 후보 조회 체인, cafe24/makeshop precheck)에 대해 unit-스펙이 매우 광범위하게 갱신·추가되었고, 특히 `integrations.controller.owner.spec.ts` 의 리플렉션 기반 라우트 전수 캐너리와 e2e 스펙(actor 4종 × invariant 전수)은 이 종류의 "판정 누락" 버그 클래스를 구조적으로 방지하는 좋은 설계다. 유일하게 특정 조합에서 재사용된 새 메서드(`requireModifiable`)의 "본인 personal 통과" 케이스가 `oauth/begin` 컨트롤러 배선 지점에서 다른 호출부와 달리 커버되지 않았고, 나머지는 낮은 위험도의 완결성 보강 제안이다. Critical 수준의 커버리지 갭이나 mock 오용, 회귀 파손은 발견되지 않았다.

## 위험도

LOW
