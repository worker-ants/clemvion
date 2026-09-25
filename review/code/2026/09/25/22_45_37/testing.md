# 테스트(Testing) 리뷰 — Personal/Owner 통합 가시성 강제 (integration-personal-owner)

## 검토 범위

`integration-oauth.service.{cafe24,makeshop}.spec.ts`, `integration-oauth.service.ts`,
`integration-visibility.{ts,spec.ts}`(신규), `integrations.controller.{ts,owner.spec.ts}`(owner.spec 신규),
`integrations.service.{ts,spec.ts}`, workflow-assistant 하위 6개 파일(userId 파라미터 스레딩),
`integration-personal-owner.e2e-spec.ts`(신규), 문서 2건. 총 22개 파일.

전체 파일 컨텍스트가 프롬프트 크기 제한으로 생략된 파일은 실제 저장소에서 `Read`로 직접 열어
대조했다(`integration-oauth.service.makeshop.spec.ts`, `explore-tools.service.spec.ts`,
`integrations.controller.owner.spec.ts` 등).

## 발견사항

- **[WARNING]** makeshop precheck 의 판정 매트릭스가 cafe24 대비 비대칭 — 회귀 방어망이 얇다
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.makeshop.spec.ts` — `describe('precheckMakeshopShop', ...)` 블록(613번째 줄 부근의 신규 `it`)
  - 상세: 같은 판정 로직(`pickPrecheckConflict`)을 cafe24 쪽 spec (`integration-oauth.service.cafe24.spec.ts`)은 `it.each`로 **3가지 케이스**(남의 personal/본인 personal/남이 만든 organization) + **priority 밖 fallback 상태**까지 4건을 커버하는 반면, makeshop 쪽은 "남의 personal → id·이름 미노출" **단 1건**만 추가됐다. `본인 personal`(노출 되어야 함)과 `남이 만든 organization`(노출 되어야 함), fallback 상태에서의 은폐 케이스가 makeshop 경로에서는 검증되지 않는다.
  - `pickPrecheckConflict` 자체에 대한 독립 단위 테스트가 없어(cafe24/makeshop 두 소비자를 통해서만 간접 검증), makeshop 쪽 호출부에서 `viewerId` 전달 순서가 잘못되거나 `본인 personal`이 잘못 은폐되는 회귀가 생겨도 makeshop spec 은 잡지 못한다(cafe24 spec 만 잡는다). 현재는 두 서비스가 같은 함수를 호출하고 파라미터 순서도 동일해 실사용 리스크는 낮지만, 향후 makeshop 전용 리팩터링·분기 추가 시 이 비대칭이 사각지대가 된다.
  - 제안: cafe24 의 `it.each(['남의 personal','본인 personal','남이 만든 organization'])` 매트릭스를 makeshop 에도 동일하게 이식(빌더 `buildFakeMakeshopIntegration`은 이미 `scope`/`createdBy` override 를 지원하므로 추가 비용이 적다). 여력이 없다면 최소한 "본인 personal → 노출" 1건만이라도 대칭으로 추가해 "차단이 지나치게 광범위해 본인 것까지 숨기는" 회귀를 잡을 수 있게 한다.

- **[INFO]** `integrations.controller.owner.spec.ts` 에서 usageLog·node 두 리포지토리에 같은 mock 객체를 재사용 — 구분력 없는 mock
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.owner.spec.ts:106-117` (`beforeEach` 내 `repoWithQb` 선언과 `new IntegrationsService(..., repoWithQb as never, // usageLog`, `repoWithQb as never, // node`)
  - 상세: `usageLogRepository`와 `nodeRepository`에 동일한 `repoWithQb` 인스턴스를 전달한다. `createQueryBuilder`가 매 호출마다 새 `makeQueryBuilder()`를 반환하도록 만들어져 있어 두 저장소가 실수로 뒤바뀌어도(예: `remove()`가 node 대신 usageLog를 조회해도) 이 스펙은 구분해서 잡아내지 못한다. 이 파일의 목적이 §8 판정 완결성 캐너리(어떤 리포지토리를 부르는지가 아니라 보이는가/바뀌는가)이므로 심각도는 낮고, usage 카운팅 자체의 정합성은 `integrations.service.spec.ts`가 별도로 커버한다.
  - 제안: 굳이 두 mock을 분리하지 않아도 되지만, 분리 시 로그성 의도(“이 스펙은 리포지토리 식별이 아니라 판정만 본다”)를 주석 한 줄로 명시해 두면 다음 리뷰어가 재지적하지 않는다.

- **[INFO]** `assertCanModify`가 액션별로 다른 메시지를 만든다는 점을 docstring 이 명시하지만, 그 메시지 문구를 검증하는 테스트는 없다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `IntegrationModifyAction`/`assertCanModify` 정의부, 및 `integrations.service.spec.ts`의 `orgMutations` 매트릭스(`'%s — Organization 통합은 %s 에게 403 ADMIN_REQUIRED · 부수효과 없음'`)
  - 상세: 테스트는 `err.getResponse?.()`를 `toMatchObject({ code: 'ADMIN_REQUIRED' })`로만 검증해 `code`는 고정되지만 액션별 `message`("...to rotate...", "...to delete..." 등)는 어느 테스트도 검증하지 않는다. 문구 자체가 클라이언트 계약은 아니므로(코드가 SoT) 위험도는 낮지만, "판정 자체는 동작과 무관하게 같다"는 주석의 반대편(문구는 동작마다 다르다)이 테스트로 고정돼 있지 않아, 리팩터링 중 문구가 실수로 동일하게 뭉개져도 회귀로 드러나지 않는다.
  - 제안: 필요하면 `orgMutations` 테이블에 기대 문구 substring 하나씩만 추가.

- **[INFO]** e2e 스펙은 `beforeAll` 로 워크스페이스·행을 1회 구성해 테스트 간 상태를 공유하고, 마지막 테스트가 `personalId`를 삭제한다
  - 위치: `codebase/backend/test/integration-personal-owner.e2e-spec.ts` — 파일 전체 구조(`beforeAll`/마지막 `it('생성자는 자기 personal 을 읽고 · 이름을 바꾸고 · 지운다', ...)`)
  - 상세: Jest는 파일 내 `it` 를 선언 순서대로 순차 실행하므로 삭제가 마지막에 위치해 이후 테스트에 영향을 주지 않지만, 파일 순서에 암묵적으로 의존한다(테스트를 재배치하면 조용히 깨진다). 이 저장소의 다른 e2e 스펙들도 흔히 쓰는 패턴이라 신규 결함은 아니다.
  - 제안: 필수는 아니나, 삭제 테스트 상단에 "반드시 마지막에 위치 — 이후 테스트가 personalId 를 참조하지 않는다" 주석을 남기면 향후 순서 변경 시 사고를 막는다.

## 긍정적으로 확인된 부분 (회귀 방지 관점에서 특히 견고함)

- `integrations.controller.owner.spec.ts`의 리플렉션 기반 "`:id` 라우트 전수 캐너리"(`idRoutes.length).toBeGreaterThan(0)` 공허성 가드 포함)는 새 `:id` 라우트가 판정 없이 추가되는 것을 구조적으로 막는다 — 좋은 테스트 설계.
- `integrations.service.spec.ts`의 `소유자 강제 (§8 판정 규칙)` 블록은 `byId`(역할×라우트 전수) / `orgMutations`(editor·viewer 403, owner·admin 통과) / `ownMutations`(본인 personal 은 전 역할 통과) 세 매트릭스로 판정 공간을 빠짐없이 분해했고, `errorOf` 헬퍼가 "resolve 되면 실패로 간주"하는 방식으로 거짓 양성(우연히 reject 안 됨)을 차단한다. `expectNoSideEffects`로 403/404 경로에서 부수효과 없음까지 확인한다.
- `rotate` 의 "락 안 재읽기 중 personal 로 전환" 케이스(TOCTOU) 는 `findOne`을 `mockResolvedValueOnce` 두 번으로 시점을 분리해 실제 동시성 시나리오를 흉내낸다.
- e2e 스펙은 절대적 기준(`ABSENT_ID`)과 남의 personal 응답을 직접 비교(`expect(answerOf(hidden)).toBe(answerOf(absent))`)해 "없는 것과 구별 불가능"이라는 spec 의 핵심 불변식을 문자 그대로 검증한다.
- workflow-assistant 하위 6개 파일의 `userId` 파라미터 스레딩은 시그니처 변경 지점마다 대응하는 spec 갱신이 빠짐없이 이뤄졌고(`assistant-tool-router`, `candidate-lookup`, `explore-tools`, `workflow-assistant-stream`), 최소 1곳(`workflow-assistant-stream.service.spec.ts`)에서 end-to-end 로 `list_integrations`가 요청자를 올바르게 전달하는지도 확인한다.

## 뮤테이션/검증 관련 메모

저장소 파일을 뮤테이션하지 않고 리뷰했다(코드 읽기만 수행). `git status --short` 로 리뷰 중 트리를 변경하지 않았음을 확인함 — 아래 결과 참고.

## 요약

이번 변경은 Personal/Organization 통합 가시성·수정 권한이라는 보안 직결 로직에 대해 컨트롤러·서비스·e2e 세 계층에서 역할×스코프×라우트를 전수에 가깝게 조합한 테스트 매트릭스를 갖췄고, 공허성 가드·부수효과 부재 검증·절대 기준 비교 등 견고한 테스트 설계 관례를 따른다. 유일하게 실질적인 갭은 cafe24 대비 makeshop precheck 쪽 테스트 매트릭스가 얇다는 점(WARNING)이며, 나머지는 mock 구분력·메시지 문구 미검증 등 낮은 우선순위의 다듬기 항목(INFO)이다. 차단 사유가 될 만한 커버리지 누락이나 vacuous 테스트, 격리 실패는 발견되지 않았다.

## 위험도

LOW
