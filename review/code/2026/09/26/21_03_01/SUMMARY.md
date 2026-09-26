# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 없음. `POST /integrations/:id/test` 응답의 기존 MCP 필드(`capabilities`·`serverInfo`·`preview`)를 OpenAPI DTO 에 뒤늦게 선언하고 서비스·와이어 양 축의 계약 테스트를 신설한 문서/테스트 정합화 PR — 8개 reviewer(강제 7명 + api_contract) 전원 결과 확보, forced 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | maintainability | `capabilities`·`serverInfo`·`preview` 3필드의 데코레이터·JSDoc 이 `PreviewTestResultDto` 와 `TestConnectionResultDto` 두 클래스에 그대로 복제(중복). 소스 오브 트루스가 물리적으로 두 곳 | `codebase/backend/.../integration-response.dto.ts:264-281`(Preview), `:503-520`(TestConnection) | 즉시 조치 불요 — 형제 대조 회귀 테스트가 드리프트 방지. 다음에 만질 때 공통 데코레이터 팩토리/mixin 추출 고려 |
| 2 | maintainability / api_contract / requirement / side_effect | `serverInfo` 의 TS 타입(닫힌 `{name; version}`)과 OpenAPI 스키마(`additionalProperties: true`, 열린 맵)가 어긋남 — 형제 DTO 의 기존 패턴을 의도적으로 복제, 신규 결함 아님 | `integration-response.dto.ts:511-516`(신규), `:272-277`(기존 형제) | 이번 PR 스코프 밖. 후속에서 `Record<string,unknown>` 류로 TS 타입 확장 검토 |
| 3 | documentation | `TestConnectionResultDto.preview` 와 `PreviewTestResultDto.preview` 의 JSDoc 문구가 다름("성공 시" vs "등록 UI 의") — "형제와 같게 선언" 방향성 문장과 대조 시 다음 사람이 혼동 가능 | `integration-response.dto.ts:518` vs `:279` | 차단 사유 아님. 문구 통일하거나 "JSDoc 은 대조 대상 아님" 주석 추가 |
| 4 | documentation | 신규 와이어 테스트 docblock "자매와 같은 틀" 표현이 실제로는 자매가 별도 파일이 아닌 기존 파일 내 describe 추가였다는 구조 차이를 가릴 수 있음 | `integrations.controller.wire.spec.ts:27` | 차단 사유 아님(impl-prep 에서 이미 INFO 로 수용). docblock 에 파일 분리 이유 한 문장 추가 권장 |
| 5 | security | MCP 서버가 보고하는 `capabilities`/`serverInfo` 를 검증 없이 pass-through 하는 기존 동작이 이번에 OpenAPI 로 공식 광고됨 — 향후 프런트엔드가 이 값을 이스케이프 없이 렌더링하면 저장형 XSS 벡터 가능성(이 diff 자체의 결함 아님) | `integration-response.dto.ts:508, 516` | 이번 PR 스코프 밖. 프런트엔드 렌더링 지점이 있다면 이스케이핑 확인 가치 있음(비차단) |
| 6 | testing | 와이어 스펙이 MCP 성공/실패만 다루고 non-MCP 성공 경로에서 MCP 전용 필드가 누출되지 않는지 직접 검증하는 케이스 없음(구조상 위험 낮음 — fallback 분기가 리터럴만 반환) | `integrations.controller.wire.spec.ts` 전체 | 필수 아님. 원하면 non-MCP 성공 경로에 `assertMatchesContract` 한 줄 추가 |
| 7 | requirement / api_contract | `INTEGRATION_TEST_FAILED` 상태 코드(422 vs 400)가 두 spec 문서 간 불일치 — 이 PR 의 코드 변경과 무관, 이미 `--impl-prep` 에서 WARNING 으로 식별 후 planner 후속 트래커에 등재 완료 | `spec/2-navigation/4-integration.md §9.4` vs `spec/5-system/11-mcp-client.md §9` | 조치 불필요(이미 처분 완료). project-planner 턴에서 별도 정정 예정 |
| 8 | scope | `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 위 #7 관련 트래커 항목 추가 — 코드와 무관해 보이나 CLAUDE.md 절차(BLOCK:NO 여도 반영)를 정확히 따른 것 | 해당 plan 파일 | 조치 불필요 |
| 9 | side_effect / api_contract | 신규 필드 3종은 모두 optional 이라 OpenAPI 스키마 확장이 하위호환을 깨지 않음 — 다만 코드젠 클라이언트 재생성 시 타입이 넓어짐(CHANGELOG 에 이미 고지) | `integration-response.dto.ts:503-520` | 조치 불필요(이미 CHANGELOG 고지) |
| 10 | api_contract | 신규 필드가 `@ApiPropertyOptional()` 대신 `@ApiProperty({required:false})` 관용구 사용 — 기능적으로 동일, 형제 DTO 관용구를 의도적으로 따름 | `integration-response.dto.ts:503-507, 511-515, 519` | 조치 불필요. 다음 optional 필드 추가 시 파일 전체 관용구 통일 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 새 실행 코드·인증/인가 변경·시크릿 하드코딩 없음. 테스트 인증 우회는 표준 스캐폴딩 |
| requirement | NONE | spec-생산자-DTO 필드명·shape·optional 여부 line-level 일치. 유일한 불일치(#7)는 기존 spec 결함, 이미 트래커 등재 |
| scope | NONE | 15개 파일 전수 diff 대조, plan 방향 4개에 1:1 대응. 무단 확장 없음 |
| side_effect | NONE | 런타임 응답 바이트 불변, 새 필드 전부 optional. 신규 와이어 테스트도 cleanup 적절 |
| maintainability | LOW | 형제 DTO 간 데코레이터/JSDoc 복제(#1), TS 타입-스키마 괴리(#2) — 둘 다 인지·테스트로 방어됨 |
| testing | LOW | 뮤테이션 10개+ 실측, mock 경계 설계 우수. 갭은 INFO 수준(#6) |
| documentation | LOW | CHANGELOG·주석 갱신 우수. 사소한 문구 불일치 2건(#3, #4) |
| api_contract | LOW | 하위호환 유지, 계약 정확성 개선. 기존 패턴 복제 2건(#2, #10) 신규 결함 아님 |

## 발견 없는 에이전트

security, requirement, scope, side_effect — Critical/Warning 없음(NONE 등급, INFO만 존재).

## 권장 조치사항

1. (선택, 비차단) `serverInfo` 의 TS 타입을 OpenAPI 스키마와 맞추기 위해 `Record<string, unknown>` 류로 확장하는 것을 후속 트래커에 남긴다 (#2).
2. (선택, 비차단) `capabilities`/`serverInfo`/`preview` 데코레이터·JSDoc 중복을 공통 팩토리/mixin 으로 추출하는 것을 다음 DTO 수정 시 고려한다 (#1).
3. (선택, 비차단) `TestConnectionResultDto.preview` JSDoc 문구를 형제와 통일하거나 "JSDoc 은 대조 대상 아님" 주석을 추가한다 (#3).
4. `INTEGRATION_TEST_FAILED` 상태 코드 spec 불일치(#7)는 이미 planner 후속 트래커(`plan/in-progress/spec-draft-nullable-notation-followups.md`)에 등재 완료 — project-planner 턴에서 처리.
5. 이번 PR 자체는 병합 차단 사유 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(DTO 선언·테스트 신설)와 관련성 낮음 |
  | architecture | router 판단상 이번 diff 와 관련성 낮음 |
  | dependency | 신규 의존성 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | user_guide_sync | 사용자 대면 기능 변경 없음 |