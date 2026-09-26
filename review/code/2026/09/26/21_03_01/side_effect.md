# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 공개 API(OpenAPI) 응답 스키마의 광고 필드가 늘어난다 — 하위호환은 유지되나 계약 소비자(코드젠 클라이언트)에 영향
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:503-520` (`TestConnectionResultDto.capabilities` · `.serverInfo` · `.preview` 신규 선언), `codebase/backend/src/modules/integrations/integrations.controller.ts:521-522` (`@ApiOkWrappedResponse` description 변경)
  - 상세: `POST /integrations/:id/test` 의 OpenAPI 응답 스키마에 `capabilities?` · `serverInfo?` · `preview?` 3개 필드가 새로 광고된다. 셋 다 `required: false` 로 선언돼 있고, 실제 런타임 응답 객체는 이 PR 로 바뀌지 않는다(서비스 코드 `integrations.service.ts` 는 diff 대상이 아님, 이미 그 값을 돌려주고 있었음) — 즉 필드가 "새로 실리는" 게 아니라 "이미 실리던 것이 이제 선언됨" 이라 와이어 하위호환성은 유지된다. 다만 OpenAPI 스키마에서 이 응답을 코드젠하는 외부 소비자(프런트엔드 타입 생성기 등)가 있다면 재생성 시 타입이 넓어진다 — CHANGELOG(`CHANGELOG.md:26-33`)에 이미 명시돼 있어 절차상 문제는 없음.
  - 제안: 별도 조치 불요(이미 CHANGELOG 고지 완료). 참고로만 남김.

- **[INFO]** `serverInfo` 의 TS 타입(닫힌 2필드)과 OpenAPI 스키마(`additionalProperties: true`, 열린 맵)가 어긋나는 기존 패턴이 새 필드에도 그대로 복제된다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:511-516` (`TestConnectionResultDto.serverInfo`)
  - 상세: `serverInfo?: { name: string; version: string }` 로 타입은 닫혀 있지만 데코레이터는 `additionalProperties: true` 로 열려 있다. 형제 `PreviewTestResultDto.serverInfo`(같은 파일 271-277행)에 이미 있던 불일치를 plan 이 의도적으로 그대로 복제한 것(방향성 1, plan 문서에 근거 명시)이며, 이번 PR 이 새로 만든 결함은 아니다. `--impl-prep` 단계에서 `rationale_continuity` checker 가 INFO#2 로 이미 포착했다. 실행 시점 부작용은 없음(스키마는 컴파일 타임 문서일 뿐, 런타임 직렬화 로직에 영향 없음).
  - 제안: 이번 PR 스코프 밖. 트래커에 이미 기록된 대로 후속에서 다룰 것.

- **[INFO]** 신규 HTTP 와이어 테스트가 `INestApplication` 을 매 파일 1회 생성하지만 정리(cleanup)가 적절히 구현돼 있음(문제 아님, 확인 사항)
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.wire.spec.ts:88-124` (`beforeAll`/`afterAll`)
  - 상세: 새 `describe` 블록이 `Test.createTestingModule(...).compile()` 로 실제 Nest 앱을 띄우고 `app.useGlobalInterceptors(new TransformInterceptor())` 를 등록한다. `afterAll` 에서 `app.close()` 를 호출해 리스너·인터셉터 인스턴스가 테스트 프로세스에 잔류하지 않도록 정리한다. `McpClientService.connect` 만 mock 이고 나머지(`DataSource`, `IntegrationCacheBus`, `WorkspacesService` 등)는 빈 객체 mock 이라 실제 네트워크·DB·Redis 호출은 발생하지 않는다. 부작용 관점에서 문제 없음 — 검증 목적의 기록.

## 요약

이번 변경은 `POST /integrations/:id/test` 의 OpenAPI 응답 스키마에 이미 런타임에서 반환되고 있던 MCP 전용 필드 3종(`capabilities` · `serverInfo` · `preview`)을 선언으로 추가하고, 컨트롤러 데코레이터의 설명 문구를 갱신하며, 이를 검증하는 서비스-레벨·와이어-레벨 테스트를 신설하는 문서/선언/테스트 성격의 PR이다. 실제 서비스 로직(`integrations.service.ts`)은 diff에 포함되지 않았고 응답 객체 생성 경로도 바뀌지 않았으므로 전역 상태·시그니처·인터페이스의 파괴적 변경, 예기치 않은 파일시스템·네트워크·환경변수 접근은 발견되지 않았다. 유일하게 주목할 지점은 OpenAPI 스키마가 넓어진다는 점(추가 필드는 모두 optional 이라 하위호환)과, 형제 DTO에 이미 있던 "TS 타입은 닫혀 있는데 스키마는 열려 있다"는 기존 불일치가 새 필드에도 의도적으로 복제된 점인데, 둘 다 CHANGELOG·plan 문서·직전 consistency-check 에서 이미 인지·고지된 사항이라 새로운 부작용으로 보기는 어렵다. 신규 와이어 테스트도 실제 Nest 앱을 띄우지만 `afterAll` 정리와 하위 의존성 mock 처리가 되어 있어 잔류 부작용 위험이 낮다.

## 위험도
NONE
