# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `updateScope` 가 공유 판정 헬퍼(`assertCanModify`/`assertOrgScopeModifiable`)를 의도적으로 우회 — 다음 유지보수자가
  "일관성"을 이유로 되돌리면 권한 상승 결함이 된다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `updateScope` (게이트 1410, 파일 11 diff)
  - 상세: 다른 5개 변경 동작(create·update·remove·rotate×2·request-scopes)은 전부
    `this.assertCanModify(row, userRole, action)` → `assertOrgScopeModifiable` 를 거친다. 그런데
    `assertOrgScopeModifiable` 은 `row.scope !== 'organization'` 이면 무조건 통과시킨다
    (`integration-visibility.ts` 게이트 99: `if (row.scope !== 'organization') return;`).
    `updateScope` 는 이 판정을 쓰지 않고 `if (!this.isAdmin(userRole)) throw adminRequiredError('change-scope')` 를
    직접 부른다(게이트 1410) — 이유는 `IntegrationModifyAction` 의 JSDoc 에만 적혀 있다: "`change-scope` 만
    Organization 여부와 무관하게 늘 Admin 이다"(`integration-visibility.ts` 게이트 56).
    즉 `updateScope` 호출부에서 이 우회를 "왜"인지 설명하는 주석이 없어서, 다음 사람이 다섯 곳과의 불일치를 보고
    "정리하자"며 `this.assertCanModify(entity, userRole, 'change-scope')` 로 바꾸면 — personal 통합(`row.scope ===
    'personal'`)을 organization 으로 전환하는 요청은 `assertOrgScopeModifiable` 의 얼리 리턴에 걸려 **Admin 이 아닌
    생성자도 자기 personal 을 organization 으로 승격**시킬 수 있게 된다(권한 상승). 지금은 정확하지만, 이 파일 안의
    "판정은 한 곳에" 라는 불변식이 이 한 자리에서만 깨져 있다는 사실이 호출부에 드러나지 않는다.
  - 제안: `updateScope` 호출부에 "`assertCanModify` 를 쓰지 않는다 — `change-scope` 는 scope 조건부가 아니라 항상
    Admin" 같은 1줄 주석을 추가하거나, 근본적으로 `assertOrgScopeModifiable` 자체가 `action === 'change-scope'` 일
    때는 `row.scope` 조건을 건너뛰도록 만들어 `updateScope` 도 같은 헬퍼를 쓰게 통합하면 이 트랩 자체가 사라진다.

- **[WARNING]** `handleCallback` 이 이미 ~310줄짜리 다책임 함수인데, 이번 diff 가 인가 재판정 책임을 한 겹 더 얹었다.
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `handleCallback`
    (게이트 631~941, 신규 호출은 게이트 816 `await this.assertRequesterStillAllowed(integration, record);`)
  - 상세: 이 함수는 provider 검증 · state 소비 · 에러 분기(invalid_scope) · 토큰 교환 · cafe24/makeshop
    provider-specific 자격 증명 조립 · (신규) 트랜잭션 락 안 인가 재판정 · credentials 갱신 분기 · install_token
    보존/백필까지 한 함수 안에서 처리한다(diff 자체가 보여주듯 cafe24 전용 블록, makeshop 전용 블록이 순차로
    나열되어 있다). 이번 변경은 락 안에서 `assertRequesterStillAllowed` 를 부르는 한 줄만 추가했지만, 그 한 줄이
    다시 "가시성 확인 → Organization 이면 역할 조회 → 판정" 이라는 별도의 책임을 이 함수의 임계 구역(트랜잭션 콜백)
    안으로 끌어들인다. 함수가 원래도 길었다는 점을 이 diff 가 만들지는 않았지만, 보안 판정처럼 독립적으로
    검증되어야 할 로직이 더 얹히면서 단위 테스트(스펙)가 이 함수 전체를 인스턴스화해야만 그 판정을 검증할 수 있는
    구조가 굳어진다(실제로 파일 4 의 신규 테스트들도 `handleCallback` 전체를 호출해서 검증한다).
  - 제안: 최소한 "요청자 재판정 이후" 의 credentials 교체 분기(게이트 817~832 부근)를 별도 private 메서드로 뽑아
    트랜잭션 콜백 본문을 짧게 유지하면, 다음에 provider 가 하나 더 늘거나 판정 조건이 하나 더 늘 때 diff 범위가
    이 거대 함수 내부로 더 파고들지 않는다.

- **[INFO]** `IntegrationsService.assertCanModify` 가 `assertOrgScopeModifiable` 를 그대로 위임만 하는 빈 래퍼.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `assertCanModify` (게이트 645~651)
  - 상세: 본문이 `assertOrgScopeModifiable(row, userRole, action);` 한 줄뿐이다. JSDoc 은 "rotate 가 락 전·락 안
    두 지점에서 부른다" 는 이유를 대지만, 그 이유는 공유 함수 자체를 두 지점에서 직접 불러도 동일하게 성립한다 —
    이 private 래퍼가 없어도 drift 위험은 같다(공유 함수가 이미 단일 진실이다). 다음 사람이 "이 메서드는 왜 있지,
    뭔가 더 하는 줄 알았는데" 하고 찾아보게 만드는 불필요한 간접 계층이다.
  - 제안: 클래스 내부에서 로깅 등 향후 확장을 계획해 둔 게 아니라면 `assertOrgScopeModifiable` 를 직접 호출하고
    이 래퍼는 제거해도 동작·가독성 손실이 없다. 유지한다면 JSDoc 에 "왜 얇은 래퍼로 남겨두는가"(예: 이 클래스
    경계 밖에서 재사용 금지, 또는 향후 감사 로그 훅 예정)를 한 줄 적어 다음 사람이 삭제 여부를 판단할 수 있게 한다.

- **[INFO]** `judgedRow` 라는 이름이 호출부만 보면 의미가 즉시 와닿지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `judgedRow` (게이트 663~669),
    호출부 `update`(게이트 835) · `remove`(게이트 902) · `updateScope`(게이트 1417)
  - 상세: JSDoc 은 "판정한 행에만 쓴다 — compare-and-set" 이라는 정확하고 좋은 설명을 담고 있지만, 정의부를 열어
    보지 않고 `this.integrationRepository.update(this.judgedRow(entity), { name: body.name })` 같은 호출부만
    보면 "judged" 가 무엇을 판정했다는 것인지(가시성? 권한? 존재?) 바로 드러나지 않는다.
  - 제안: `compareAndSetKeyOf` / `writeGuardCriteriaOf` 처럼 "판정 결과를 조건절에 싣는다" 는 동작을 이름에 직접
    반영하면 JSDoc 을 열지 않아도 호출부만으로 의도가 읽힌다.

- **[INFO]** 컨트롤러의 `oauth/begin` 경로가 `requireModifiable` 의 반환값(엔티티)을 버린다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `oauthBegin` (게이트 259~268)
  - 상세: `await this.integrationsService.requireModifiable(...)` 의 결과를 아무 변수에도 받지 않는다.
    `requireModifiable` 는 서비스 내부의 다른 호출부(`update`·`remove`·`reauthorize` 등)에서는 반환된 엔티티를
    이어서 쓰기 때문에 `Promise<Integration>` 을 반환하도록 설계돼 있다 — 컨트롤러만 그 값을 버리는 유일한
    호출부라, 반환형을 처음 보는 사람은 "여기선 왜 안 쓰지?" 하고 한 번 더 찾아보게 된다.
  - 제안: 한 줄 주석("판정만 필요 — 행 자체는 `oauthService.begin` 이 state 로 다시 만든다")을 덧붙이거나, 부수
    효과만 필요한 호출임을 드러내는 `void this.integrationsService.requireModifiable(...)` 형태로 명시한다.

## 요약

전체적으로 이번 PR 은 이미 두 라운드의 리뷰를 거친 뒤라 완성도가 높다 — 가시성·인가 판정을 `integration-visibility.ts`
의 순수 함수로 뽑아 두 서비스(REST·OAuth 콜백)가 공유하게 만들었고, cafe24/makeshop precheck 의 중복 로직을
`pickPrecheckConflict` 하나로 통합했으며, `requireVisible`/`assertCanModify`/`judgedRow`/`reloadOrNotFound`/
`requireModifiable` 로 책임을 잘게 쪼갠 private 헬퍼마다 "왜 이렇게 했는가"(compare-and-set을 쓰는 이유, 락을 쓰지
않는 이유 등)를 JSDoc 에 성실히 남겨 두었다. 컨트롤러의 `:id` 라우트 전수 캐너리 테스트(파일 8)와 e2e(파일 22)도
설계 의도가 무너지지 않게 잡아주는 좋은 안전망이다. 남은 지적은 대부분 INFO 수준의 미세한 이름·간접 계층
문제이고, 실질적으로 주의가 필요한 것은 `updateScope` 가 공유 판정 경로를 우회하는 지점(다음 "정리" 리팩터가
권한 상승을 재도입할 수 있는 자리)과, 이미 비대한 `handleCallback` 에 인가 재판정 책임이 한 겹 더 쌓였다는 점
두 가지다. 둘 다 지금 당장 버그는 아니며 기능 차단 사유는 아니다.

## 위험도

LOW
