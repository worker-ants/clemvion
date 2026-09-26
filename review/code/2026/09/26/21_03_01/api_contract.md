# API 계약(API Contract) Review

## 개요

이번 변경의 핵심은 `POST /api/integrations/:id/test` 의 OpenAPI 응답 스키마(`TestConnectionResultDto`)에
이미 실제 응답이 싣고 있던 MCP 전용 필드 3종(`capabilities` · `serverInfo` · `preview`)을 뒤늦게 선언하고,
그 성공 경로에 대한 서비스 레벨 계약 검증(`assertMatchesContract`) 및 HTTP 와이어 레벨 검증
(`integrations.controller.wire.spec.ts`)을 신설한 것이다. 실제 런타임 응답 바이트는 바뀌지 않으며(발행
생산자는 이미 그 값을 돌려주고 있었다 — plan 의 "실측" 절), 이번 diff 는 문서(OpenAPI)와 테스트만 실제에
맞춘다.

## 발견사항

- **[INFO]** `TestConnectionResultDto.serverInfo` 의 TS 타입은 닫힌 2필드(`{ name: string; version: string }`)인데
  OpenAPI 선언은 `additionalProperties: true` 로 열려 있다 — OpenAPI 산출물만 보고 클라이언트 코드를 생성하면
  TS 소스가 말하는 shape 보다 넓은 타입이 나온다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:511-516`
    (`TestConnectionResultDto.serverInfo`), 같은 패턴이 형제 `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:272-277`
    (`PreviewTestResultDto.serverInfo`)에도 이미 존재
  - 상세: SDK 가 `name`·`version` 밖의 키를 실을 수 있어 의도적으로 연 것(주석·plan §방향-1·`--impl-prep` INFO 2 에 명시)이지만,
    TS 타입 자체는 닫혀 있어 "선언(OpenAPI) vs 소스 타입"의 불일치가 신규 필드에도 그대로 복제됐다. 신규 결함은 아니고
    기존 형제 DTO의 패턴을 의도적으로 그대로 따른 것이며, 이미 이번 plan 의 `--impl-prep` 처분에서 인지·수용됐다.
  - 제안: 조치 불필요(의도적). 다음에 이 DTO 를 만질 때 `Record<string, unknown>` 등으로 TS 타입 자체를 넓히는 것을
    검토하면 선언과 소스 타입의 괴리가 없어진다.

- **[INFO]** 신규 필드 3종은 `@ApiPropertyOptional()` 대신 `@ApiProperty({ required: false, ... })` 로 선언되어,
  같은 파일의 다른 optional 필드(`message?`, `statusReason?`, `lastCheckedAt?` 등)가 쓰는 관용구와 다르다.
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:503-507, 511-515, 519`
    (`capabilities` · `serverInfo` · `preview`)
  - 상세: `@nestjs/swagger` 에서 `@ApiProperty({ required: false })` 와 `@ApiPropertyOptional()` 은 기능적으로 동일해
    산출 스키마에는 차이가 없다. 형제 `PreviewTestResultDto` 가 이미 이 관용구를 쓰고 있고(`integration-response.dto.ts:264-281`)
    이번 필드가 "형제와 같은 선언" 을 명시적 목표로 삼았으므로(plan §방향-1) 의도된 일관성이며 새로 만든 비일관은 아니다.
  - 제안: 조치 불필요. 다음에 이 파일에 optional 응답 필드를 새로 추가할 때는 두 관용구 중 하나로 파일 전체를
    통일하는 편이 가독성에 낫다는 정도의 참고.

- **[INFO]** `INTEGRATION_TEST_FAILED` 의 HTTP 상태 코드(422 vs 400)·발생 엔드포인트 귀속이
  `spec/2-navigation/4-integration.md` §9.4 와 `spec/5-system/11-mcp-client.md` §9 사이에서 어긋나는 기존 오기가
  있다(코드 실측: `integrations.service.ts` `rotate()` 만 400 을 던지며 `:id/test` 는 절대 throw 하지 않는다).
  - 위치: `spec/2-navigation/4-integration.md` §9.4 (`INTEGRATION_TEST_FAILED (422)`) — 이번 diff 의 코드 변경과는
    무관한 문서이며, 관련 대상은 `:id/rotate` 지 이 PR 이 다루는 `:id/test` 가 아니다.
  - 상세: 이미 이번 plan 의 `--impl-prep` consistency check(`review/consistency/2026/09/26/20_32_24`, cross_spec·
    convention_compliance WARNING #1)가 실측으로 짚었고, `plan/in-progress/spec-draft-nullable-notation-followups.md`
    에 planner 후속 항목으로 정확히 등재됐으며(`spec_impact: none` 유지 근거로 기록), 이 PR 의 코드·DTO·테스트와는
    직접 접점이 없다. 새로 지적할 결함이 아니라 "이미 적절히 처분된 항목" 으로 재확인.
  - 제안: 추가 조치 불필요 — 이미 트래커 등재·처분 완료.

## 확인된 양호 사항

- **하위 호환성**: 신규 필드 3종은 전부 optional(`required: false`)이고, 실제 런타임 응답은 이번 PR 이전부터
  이미 이 값들을 포함해 왔다(서비스 생산자 `testMcpTransport`/`IntegrationsService.testConnection` 변경 없음).
  기존 클라이언트가 이 필드를 무시하던 동작에는 영향이 없고, OpenAPI 스키마가 실제를 뒤늦게 따라잡는 문서
  전용 변경이라 breaking change 가 아니다.
- **응답 형식 일관성**: 두 형제 엔드포인트(`POST /integrations/:id/test` ↔ `POST /integrations/preview-test`)가
  같은 `dispatchTest` 결과를 반환하는데, 이번 변경 전까지 `TestConnectionResultDto` 만 MCP 필드 3종을 미선언
  이었다. 이번 diff 로 두 DTO 의 필드 선언이 동일해졌고, 서비스 spec 에 "[형제 대조]" 테스트
  (`codebase/backend/src/modules/integrations/integrations.service.spec.ts`, 새 `it` 블록)를 추가해 향후 두 선언이
  다시 벌어지는 것을 뮤테이션 테스트(M3·M9)로 검증된 방식으로 잡는다 — 계약 검증자가 열린 맵 내부를 보지
  못해 값 대조만으로는 놓치는 사각을 형제 스키마 대조로 메운 것이 API 계약 유지에 좋은 설계다.
- **와이어 레벨 검증 추가**: 신규 `integrations.controller.wire.spec.ts` 가 전역 `TransformInterceptor` 를 포함한
  실제 HTTP 왕복으로 응답 키 전수(`Object.keys(res.body.data).sort()`)를 단언한다. 서비스 유닛 테스트만으로는
  포착되지 않는 인터셉터/직렬화 계층의 필드 유실을 방어한다.
- **컨트롤러 문서 정확성**: `@ApiOkWrappedResponse` 설명이 존재하지 않는 `meta` 필드를 언급하던 낡은 문구
  ("메타 정보")에서 실제 응답 구성(성공 여부·실패 코드·MCP capability 미리보기)을 반영한 문구로 교정됐다
  (`codebase/backend/src/modules/integrations/integrations.controller.ts:520-522`).
- **버전 관리 / URL·경로 / 페이지네이션 / 인증·인가**: 이번 diff 는 라우트·HTTP 메서드·가드·페이지네이션을
  전혀 건드리지 않는다. `:id/test` 의 `@ApiUnauthorizedResponse`·`@ApiForbiddenResponse` 등 인증/인가 데코레이터도
  변경 없음 — 해당 관점에서는 회귀 위험이 없다.
- **요청 검증**: 요청 바디·쿼리 파라미터 관련 변경 없음(응답 스키마·설명·테스트만 변경).

## 요약

이번 PR 은 `POST /api/integrations/:id/test` 응답에 이미 실려 나가고 있던 MCP 전용 필드 3종을 OpenAPI 스키마에
뒤늦게 선언하고, 형제 엔드포인트와의 선언 일치를 테스트로 강제하며, HTTP 와이어 레벨 계약 검증을 신설하는
문서·테스트 중심 변경이다. 실제 응답 바이트에는 변화가 없어 하위 호환성 파괴가 없고, 새 필드는 전부
optional 이라 클라이언트 영향도 없다. `serverInfo` 의 열린 스키마·닫힌 TS 타입 간 괴리, `@ApiProperty(required:false)`
관용구 혼용은 모두 기존 형제 DTO 패턴을 의도적으로 복제한 것으로 신규 결함이 아니며, 이미 알려진
`INTEGRATION_TEST_FAILED` 상태 코드 spec 불일치는 이 PR 의 코드 표면과 무관하고 트래커에 적절히 등재·처분됐다.
전반적으로 API 계약 관점에서 안전하고 오히려 계약 정확성·회귀 방어력을 개선하는 변경이다.

## 위험도

LOW
