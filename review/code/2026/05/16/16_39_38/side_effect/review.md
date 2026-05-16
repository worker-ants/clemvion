# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** `buildFakeCafe24Integration` 내부의 `credentials` 객체가 호출별로 새 참조로 생성됨 — 공유 상태 오염 없음
  - 위치: `integration-oauth.service.cafe24.spec.ts` lines 66–86 (추가된 factory 함수)
  - 상세: 함수 내에서 `const credentials: Record<string, unknown> = { ... }` 를 매번 새로 생성하며 외부 변수를 캡처하지 않는다. `overrides` 파라미터는 값 복사(Partial 구조체)로 전달되므로 호출자가 동일 객체를 여러 테스트에 재사용하더라도 factory 결과가 서로 공유 상태를 오염시키지 않는다.
  - 제안: 현재 구조 유지. 필요 시 `Object.freeze(result)` 를 적용해 불변성을 명시적으로 보장할 수 있으나 테스트 목업 특성상 필수는 아님.

- **[INFO]** `buildFakeCafe24Integration`이 `workspaceId` 필드를 기본값으로 포함하지 않음
  - 위치: `integration-oauth.service.cafe24.spec.ts` buildFakeCafe24Integration 반환 객체 (lines 75–86)
  - 상세: 기존 인라인 mock 중 일부(`id: 'existing-connected'`, `id: 'existing-public-connected'` 등)는 `workspaceId: 'ws-1'` 필드를 포함했으나, factory 로 교체된 결과에서는 해당 필드가 생략됐다. 현재 서비스 로직이 repository `find()` 결과에서 `workspaceId` 를 직접 읽지 않는다면 동작은 동일하지만, 반환 타입이 `Record<string, unknown>` 으로 선언되어 있어 컴파일 타임에 감지되지 않는다. 향후 서비스 로직이 `workspaceId` 를 읽는 방향으로 변경되면 기존 테스트들이 암묵적으로 `undefined` 를 갖는 mock 을 사용하게 된다.
  - 제안: factory 기본 overrides 에 `workspaceId: 'ws-1'` 를 추가하거나, 반환 타입을 실제 엔티티 타입 또는 `Partial<Integration>` 으로 강화해 누락 필드가 컴파일 시 드러나도록 한다.

- **[INFO]** `Cafe24PrecheckStatus` 타입 선언의 단순 포맷 정리 — 의미 변경 없음
  - 위치: `integration-oauth.service.ts` lines 345–347
  - 상세: `type Cafe24PrecheckStatus = (typeof CAFE24_PRECHECK_STATUS_PRIORITY)[number];` 를 두 줄에서 한 줄로 병합했다. 타입의 실제 의미·범위·호환성에 영향 없음. 이 타입은 모듈 내부에서만 사용되는 private 타입이므로 외부 인터페이스 변경도 없다.
  - 제안: 현재 상태 유지 (순수 스타일 개선).

- **[INFO]** `@ApiOperation` description 문자열 변경 — Swagger 문서 노출 내용 변경
  - 위치: `integrations.controller.ts` line 371 (`cafe24/precheck` 엔드포인트 description)
  - 상세: description 문자열에 라우트 순서 경고("**Route order note**")와 spec 참조 링크가 추가됐다. 이는 Swagger UI 에만 노출되는 문서 변경이며 런타임 동작·응답 구조·클라이언트 계약에는 영향이 없다. 단, description 이 내부 구현 세부사항(NestJS 라우트 처리 순서, ParseUUIDPipe 동작)을 공개 API 문서에 그대로 노출하는 것은 외부 소비자에게 불필요한 정보일 수 있다.
  - 제안: description 을 외부 소비자 관점(기능 설명, 제약, 오류 코드)으로 유지하고, 라우트 순서 경고는 컨트롤러 코드 주석(이미 lines 590–595에 존재)으로만 관리하는 것이 바람직하다. 두 곳에서 동일 내용이 중복 관리되면 향후 상호 불일치가 발생할 수 있다.

## 요약

이번 변경은 테스트 파일의 인라인 mock 객체를 `buildFakeCafe24Integration` factory 함수로 통일하고, 서비스 파일의 타입 선언 포맷을 정리하며, 컨트롤러의 Swagger description 을 보강하는 내용이다. 전역 변수 도입, 외부 서비스 네트워크 호출, 파일시스템 부작용, 이벤트/콜백 변경은 전혀 없다. 기존 공개 API 시그니처(`cafe24Precheck`, `precheckCafe24Mall` 등)는 그대로 유지되어 호환성 파괴가 없다. 유일하게 주목할 점은 factory 반환 객체에서 `workspaceId` 필드가 누락되어 향후 서비스 로직 변경 시 무증상(silent) 결함으로 이어질 가능성과, Swagger description 에 내부 구현 세부사항이 노출되어 이중 관리 불일치 위험이 생기는 것인데, 두 항목 모두 즉각적인 런타임 부작용은 없다.

## 위험도

LOW
