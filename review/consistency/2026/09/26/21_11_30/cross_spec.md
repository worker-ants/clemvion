# Cross-Spec 일관성 검토 — `integration-test-contract` (impl-done, scope=spec/2-navigation/)

## 전제

- `spec/2-navigation/` 델타는 0개 파일 (`spec_impact: none`) — 이 PR 은 spec 을 바꾸지 않는다.
- 실제 변경은 `codebase/backend/src/modules/integrations/` 4파일 + `CHANGELOG.md`: `TestConnectionResultDto`
  (`POST /api/integrations/:id/test` 응답)에 `capabilities?` / `serverInfo?` / `preview?` 3개 필드를
  형제 `PreviewTestResultDto` 와 동일하게 선언 추가, 컨트롤러 설명 문구 수정, 서비스/와이어 레벨 계약 검증
  테스트 신설.
- 이 변경이 광고하는 필드 셋은 `spec/2-navigation/4-integration.md §5.6`("테스트": `{ capabilities, serverInfo,
  preview: { toolCount, resourceSupported, promptSupported } }`)와 `spec/5-system/11-mcp-client.md §9`
  (동일 JSON 예시)가 **이미** 문서화하고 있던 내용이다 — DTO 가 spec 을 뒤쫓아 따라간 것이라 신규 충돌을
  만들지 않는다. `serverInfo` 를 열린 맵(`additionalProperties: true`)으로 선언한 것도 형제
  `PreviewTestResultDto` 의 기존 패턴을 그대로 미러링한 것이며(`git show`로 사전 존재 확인), 두 DTO 의
  캡ability 필드 3종(존재·스키마·required 여부)이 실제로 일치함을 서비스 spec 의 "[형제 대조]" 테스트가
  고정한다.

## 발견사항

- **[WARNING]** `INTEGRATION_TEST_FAILED` 의 HTTP 상태·발생 경로를 두 spec 문서가 다르게 적는다 (pre-existing, 이 PR 무관)
  - target 위치: (target 자체는 무변경이나) 조사 과정에서 대조한 `spec/2-navigation/4-integration.md §9.4`
    ("`INTEGRATION_TEST_FAILED` (422)")
  - 충돌 대상: `spec/5-system/11-mcp-client.md §9` ("한편 이미 저장된 Integration 의 credential rotate 경로
    (`POST /api/integrations/:id/test` 후 갱신)는 테스트 실패 시 `INTEGRATION_TEST_FAILED`(`BadRequestException`,
    HTTP 400)를 던진다")
  - 상세: 실제 코드(`integrations.service.ts`)에서 `INTEGRATION_TEST_FAILED` 를 던지는 자리는 `rotate()`
    (`POST /api/integrations/:id/rotate`) 단 한 곳이며 `BadRequestException` → HTTP 400 이다.
    `testConnection()`(`POST /api/integrations/:id/test`, 이번 PR 이 건드린 그 엔드포인트)은 이 코드를
    **던지지 않고** 항상 `200 + { success, code?, message }` 를 반환한다 — 이번 PR 이 신설한 wire 테스트
    (`integrations.controller.wire.spec.ts` "MCP 실패" 케이스)가 바로 이 사실(`status 200` + `success:false`)을
    실측으로 고정한다. 즉 `11-mcp-client.md §9` 는 endpoint 경로 라벨을 `:id/test` 로 잘못 붙였고(`:id/rotate`
    여야 함), `4-integration.md §9.4` 의 "422" 도 실제 400 과 어긋난다.
  - 제안: 이미 이 PR 의 `--impl-prep` 단계(`review/consistency/2026/09/26/20_32_24` WARNING 1)에서 동일하게
    포착되어 **planner 트래커 항목으로 등재 완료**된 상태다 —
    `plan/in-progress/spec-draft-nullable-notation-followups.md:3610`
    ("`INTEGRATION_TEST_FAILED` 의 상태 코드와 발생 경로를 spec 두 문서가 다르게 적는다", planner, 2026-09-26 등재).
    처분안도 이미 명시됨: `§9.4` 를 400·`:id/rotate` 한정으로 정정, `11-mcp-client.md §9` 의 경로 라벨을
    `:id/rotate` 로 교정. 코드 변경 불요. **이번 PR 의 diff·spec 범위와는 무관**하므로 이 PR 을 막을 사유가
    아니며, 재중복 등재만 하지 않으면 된다.

## 검토하지 않아도 되는 것 (명시적으로 배제 확인)

- 데이터 모델 충돌: 없음 — `capabilities`/`serverInfo`/`preview` 는 DB 컬럼이 아닌 MCP 연결-테스트의 휘발성
  응답 필드이고, `spec/1-data-model.md` 는 이를 다루지 않는다(grep 0건). 두 소비 spec(`2-navigation`,
  `5-system`)의 필드 셋·형태 서술이 서로 일치한다.
- API 계약 충돌: 위 WARNING 외에는 없음. 엔드포인트·메서드·request/response shape 변경 없음(선언 추가일 뿐,
  기존 런타임 응답 값은 무변경 — CHANGELOG 명시).
- 요구사항 ID 충돌: `spec_impact: none` — 신규 요구사항 ID 없음.
- 상태 전이 충돌: Integration 상태 머신(§6) 무변경.
- 권한·RBAC 충돌: 없음 — 권한 데코레이터·가드 무변경.
- 계층 책임 충돌: 없음 — 백엔드 모듈 내부 DTO/테스트 변경만, frontend 는 이 응답 타입을 별도로 소비하지
  않는다(grep 0건). 신규 와이어 테스트 파일을 컨트롤러 옆 `owner.spec.ts` 계열과 별도 파일로 둔 것도
  `--impl-prep` INFO 5 에서 이미 근거(관점별 파일 관례) 확인됨.

## 요약

이 PR 은 `spec/2-navigation/` 을 변경하지 않고, 이미 두 spec(`spec/2-navigation/4-integration.md §5.6`,
`spec/5-system/11-mcp-client.md §9`)이 문서화해 둔 MCP 성공 응답 필드 셋을 뒤늦게 OpenAPI DTO 에 선언하고
계약 검증 테스트로 고정하는 순수 "코드를 spec 에 맞춘" 변경이다. 조사 중 발견한 유일한 실질적 cross-spec
불일치(`INTEGRATION_TEST_FAILED` 의 상태 코드·경로 라벨이 `4-integration.md §9.4` 와 `11-mcp-client.md §9`
사이에서 어긋남)는 이 PR 이전부터 있었고, 이 PR 의 `--impl-prep` 리뷰가 이미 같은 것을 짚어 planner 트래커에
등재까지 마친 상태라 재차 막을 이유가 없다. 이번 diff 범위 안에서 새로 만들어진 데이터 모델·API 계약·요구사항
ID·상태 전이·RBAC·계층 책임 충돌은 없다.

## 위험도

LOW
