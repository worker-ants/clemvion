# 아키텍처(Architecture) Review

## 컨텍스트

이 changeset 은 이미 4라운드째 리뷰다(1~3라운드에서 Critical 2 · Warning 17 처리 완료 — `5999aedfe` · `2f3562ce7` · `a8b5c8b13`).
공유 판정 로직을 `integration-visibility.ts` 순수 함수로 뽑아 `IntegrationsService` · `IntegrationOAuthService` 가
서로를 주입하지 못하는 제약(순환 의존 회피) 아래 공유하도록 이미 재구성돼 있다. `handleCallback` 비대(현재
`integration-oauth.service.ts:639`~`950`, 약 311줄)는 3라운드에서 이미 "수렴 예외" 트래커로 처분된 항목이라
본 라운드에서 재-flag 하지 않는다. 아래는 그 위에서 관찰한, 아직 기록되지 않은 관점이다.

## 발견사항

- **[INFO]** `IntegrationModifyAction` 타입을 원 출처(`integration-visibility.ts`)가 아니라 재수출 경유지(`integrations.service.ts`)에서 import
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (import 문, diff 게이트 47~50)와 `codebase/backend/src/modules/integrations/integrations.service.ts:389`(`export type { IntegrationModifyAction } from './integration-visibility';`)
  - 상세: `IntegrationModifyAction` 은 `integration-visibility.ts` 에서 정의되고, `integrations.service.ts` 가 그것을 재수출한 뒤 `integrations.controller.ts` 는 그 재수출을 통해 import 한다(`import { IntegrationsService, type IntegrationModifyAction } from './integrations.service';`). 기능적으로는 문제없지만, 타입의 실제 소유 모듈이 가려져 "이 타입이 어디서 오는가" 를 추적할 때 한 단계를 더 거치게 된다. `integration-visibility.ts` 는 이미 두 서비스가 직접 import 하는 공유 모듈이므로 컨트롤러도 거기서 바로 가져오는 편이 출처를 명확히 한다.
  - 제안: 컨트롤러의 import 를 `import type { IntegrationModifyAction } from './integration-visibility';` 로 바꾸고, 서비스의 재수출 라인은 (다른 소비자가 없다면) 제거. 사소한 정리라 이번 라운드의 필수 조치는 아님.

- **[INFO]** `oauth/begin` 의 인가 사전판정 매핑이 컨트롤러(presentation layer)에 위치
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `modifyActionOfBeginMode()` 함수와 `oauthBegin()` 핸들러 (diff 게이트 108~123, 258~268)
  - 상세: "`oauth/begin` 의 어느 `mode` 가 기존 통합을 변경하는 동작으로 취급되어 `requireModifiable` 사전판정을 받아야 하는가" 라는 도메인 정책이 컨트롤러 파일에 함수로 존재한다. 실제 판정(`assertOrgScopeModifiable`/`isIntegrationVisibleTo`)은 `integration-visibility.ts` 에 잘 모여 있지만, "언제 그 판정을 불러야 하는가" 라는 결정은 `IntegrationOAuthService.begin()` 이 아니라 컨트롤러가 내린다 — 같은 서비스(`IntegrationOAuthService`)가 처리하는 `reauthorize`/`request_scopes` 모드인데도, `:id/reauthorize` 경로는 서비스 레이어(`IntegrationsService.reauthorize`)가 판정하고 `oauth/begin` 경유 경로는 컨트롤러가 판정을 트리거하는 비대칭이 생겼다. `never` 소진성 검사로 새 mode 추가 시 컴파일이 멈추게 해둔 보완장치가 있어 당장 회귀 위험은 낮다.
  - 제안: 필수는 아니지만, 장기적으로는 이 매핑과 사전판정 호출을 `IntegrationOAuthService.begin()` 내부(또는 그 앞단의 전용 헬퍼)로 옮겨 "OAuth begin 관련 판정은 전부 OAuth 서비스가 오케스트레이션한다" 로 단일화하면 컨트롤러는 순수 HTTP 바인딩만 담당하게 된다. 다만 이 파일은 원래도 provider별 `providerMeta` 조립(cafe24/makeshop) 로직을 담고 있어 기존 컨벤션과 일관되므로, 이번 PR 범위에서 굳이 되짚을 필요는 없다고 판단.

- **[INFO]** `integration-visibility.ts` 가 판정 로직 + SQL 표현 + 다국어(한국어) 에러 문구 테이블을 한 파일에 결합
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts` 전체
  - 상세: `isIntegrationVisibleTo`(순수 판정) · `integrationVisibilityClause`(SQL 문자열) · `integrationNotFoundError`/`adminRequiredError`(예외 팩토리, 한국어 문구 포함) · `ADMIN_ACTION_PHRASE`(i18n 문구 테이블) · `assertOrgScopeModifiable` 이 한 파일에 모여 있다. "통합 가시성·변경 판정" 이라는 하나의 개념적 책임으로 응집돼 있어 SRP 위반이라 보긴 어렵지만, 순수 도메인 판정과 사용자 노출 문구(프레젠테이션 관심사)가 같은 파일에 있다는 점은 향후 다국어화(이 코드베이스는 이미 웹챗 위젯 chrome 에서 ko/en 다국어화를 진행 중이며, 백엔드 API 에러 메시지가 다음 대상이 될 경우) 시 분리 지점이 될 수 있다.
  - 제안: 지금 당장 조치할 사항은 아님 — 이 파일 자체가 두 서비스 간 순환 의존을 피하기 위해 의도적으로 뽑아낸 공유 모듈이라는 설계 근거가 파일 상단 주석에 명확히 적혀 있다. 다국어 확장이 실제 스코프에 들어올 때 문구 테이블(`ADMIN_ACTION_PHRASE`)만 별도 i18n 리소스로 분리하는 것을 고려.

## 긍정적으로 확인한 설계 결정 (참고)

- `IntegrationsService` ↔ `IntegrationOAuthService` 순환 의존을 피하려 순수 함수 모듈(`integration-visibility.ts`)로 판정 로직을 추출한 것은 정확한 선택이다 — 두 서비스 모두 이 모듈을 단방향으로만 참조하며, `IntegrationsService` → `IntegrationOAuthService` 단방향 의존만 존재함을 모듈 파일(`integrations.module.ts`) 로 확인.
- `cafe24`/`makeshop` precheck 의 우선순위 판정을 `pickPrecheckConflict()` 공용 함수로 통합해 두 서비스 타입 간 중복을 제거(`integration-oauth.service.ts`).
- `judgedRow()` 기반 조건부 쓰기(compare-and-set)는 락을 새로 들이지 않고 `remove()` 의 기존 원자적 DELETE 설계(#1372)와 같은 원자성 전략을 `update`/`updateScope`/`reauthorize` 로 일관되게 확장한 것 — 엔티티 `save()` 의 lost-update 위험(스냅샷 비교)을 피하는 근거가 주석에 명시돼 있어 설계 의도가 검증 가능하다.
- `integrations.controller.owner.spec.ts` 의 리플렉션 기반 `:id` 라우트 전수 캐너리는, 인가 판정이 게이트/인터셉터 한 곳이 아니라 각 서비스 메서드에 흩어질 수밖에 없는 구조(엔티티를 읽어야 판정 가능하므로)에서 "새 라우트가 판정 없이 추가되는" 회귀를 원천적으로 막는 좋은 확장성 대비책이다.

## 요약

핵심 도메인 판정(가시성·수정 권한)을 `integration-visibility.ts` 순수 함수로 단일화해 `IntegrationsService`·`IntegrationOAuthService` 두 소비자가 같은 규칙·같은 응답을 공유하도록 만든 구조는 SOLID(SRP·DIP) 관점에서 견고하며, 순환 의존도 관찰되지 않았다. compare-and-set 쓰기 패턴과 라우트 전수 캐너리 테스트는 동시성·확장성 모두에 대한 의도적이고 검증 가능한 방어다. 이번 라운드에서 새로 발견한 것은 전부 INFO 수준의 사소한 응집도/출처-명확성 관찰(타입 재수출 경유, 컨트롤러의 OAuth begin 판정 매핑 위치, 판정-모듈의 다국어 문구 결합)이며, 기능적 결함이나 새로운 결합도/레이어 위반은 없다. `handleCallback` 비대는 이미 3라운드에서 트래커로 처분된 항목이라 재지적하지 않는다.

## 위험도

LOW
