# 정식 규약 준수 검토 — `spec/2-navigation/` (--impl-prep, plan: integration-db-http-testers)

검토 대상은 같은 브랜치의 planner 커밋 `74087dff6`(`spec/2-navigation/4-integration.md` §3.3 · §5.1~§5.4 · §5.7 · §9.2 · §9.4 · §10.3 · §10.5 · §14.1 · Rationale)이다. `spec/conventions/**` 중 이 변경과 관련 있는 `error-codes.md`(에러 코드 명명)·`audit-actions.md`(감사 액션 명명)·`swagger.md`(API 문서·응답 wrapping)·`review-citations.md`(리뷰 인용 형식)를 전문 대조했고, `node-output.md` §3.2(에러 컨트랙트)도 직접 열어 대조했다.

## 발견사항

- **[INFO]** `IntegrationTestResult` 응답 예시가 `{ data: ... }` 봉투 없이 서술됨
  - target 위치: `spec/2-navigation/4-integration.md` §5.3(478·480·485행) · §5.4(501행) · §9.1(814행) · §9.4(865행 인접)
  - 위반(경향) 규약: [`swagger.md` §2-5](../../../../spec/conventions/swagger.md#2-5-응답-wrapping) — 성공 응답은 `TransformInterceptor` 가 `{ data: ... }` 로 감싼다(반환 객체에 이미 top-level `data` 키가 있을 때만 pass-through)
  - 상세: §5.3·§5.4 는 결과를 `success: true` / `success:false, code:'INTEGRATION_INCOMPLETE'` 처럼 봉투 없이 적는다. 실제 `POST /api/integrations/:id/test` 컨트롤러는 `@ApiOkWrappedResponse(TestConnectionResultDto, …)` 를 쓰므로 wire 는 `{ data: { success, code, message } }` 다(`codebase/backend/src/modules/integrations/integrations.controller.ts:420`, `dto/responses/integration-response.dto.ts:456` `TestConnectionResultDto`). 다만 §9.4 공통 응답 포맷 절이 "성공: `{ data: ... }` (기존 컨벤션 준수)" 를 이미 문서 상단에서 선언해 두었고, 이 저장소의 다른 endpoint 서술(§9.1 목록 등)도 대개 `data` 내부 값만 적는 축약 스타일을 일관되게 쓴다 — 그래서 실제 위반이라기보다 **문서 전반의 축약 관행**이며, 이번 diff 가 새로 만든 문제는 아니다(새 §5.3/§5.4 문장은 기존 §5.5 Email 절과 동일한 서술 방식을 그대로 따랐을 뿐이다). 다만 Database·HTTP 테스터가 이번에 신규 구현되므로, 구현자가 이 절만 보고 "봉투 없이 반환"으로 오독할 여지가 이론상 있다.
  - 제안: 이번 PR 범위는 아니지만, §5.x 상단에 "아래 값은 §9.4 의 `data` 내부에 실린다" 한 줄을 추가하면 다음 리비전에서 축약 스타일과 실제 wire 형태 사이의 간극이 좁혀진다. 필수 수정은 아님(기존 `TestConnectionResultDto`+`ApiOkWrappedResponse` 구현이 이미 정답 형태로 존재하므로 이번 구현이 실수로 봉투를 벗길 위험은 낮다).

- **[INFO]** §5.4 가 §5.5(자신보다 뒤에 나오는 절)를 근거로 인용
  - target 위치: `spec/2-navigation/4-integration.md` §5.4, 506행 "코드는 `IntegrationTestResult.code` namespace(§5.5)다"
  - 위반 규약: 없음(정식 규약 위반은 아님) — 문서 구조 권장 사항 수준의 가독성 지적
  - 상세: `IntegrationTestResult.code` 네임스페이스 개념은 §5.5(Email)에서 처음 온전히 설명되는데, §5.4(Database, §5.5보다 앞선 절)가 그 절을 근거로 전방 참조한다. 내용은 정확하지만 문서를 순서대로 읽는 독자에게는 정의를 아직 보지 못한 시점에 인용된다.
  - 제안: 근거 문구를 SoT 인 `error-codes.md`(UPPER_SNAKE_CASE 표기) 또는 최초 도입 절로 통일하거나, §5.5 앞부분에 "본 절이 `IntegrationTestResult.code` 네임스페이스를 최초 정의한다" 캐비엇을 추가해 순서 의존을 없앨 수 있다. 사소한 제안이라 이번 PR 필수 사항은 아니다.

## 준수 확인 (긍정적 관측)

- **에러 코드 명명** — 신규 도입 코드 `DB_AUTH_FAILED` · `DB_CONNECT_FAILED` · `HTTP_AUTH_FAILED` · `HTTP_SERVER_ERROR` · `HTTP_CONNECT_FAILED` 전부 `error-codes.md` §1(의미 기반 명명) · 도메인 prefix 권장(`<DOMAIN>_<CONDITION>`)을 따르고, `node-output.md` §3.2 의 `UPPER_SNAKE_CASE` 표기 규칙도 지킨다. 기존 형제 코드(`EMAIL_CONNECT_FAILED` · `MCP_CONNECT_FAILED` · `DB_HOST_BLOCKED` · `HTTP_BLOCKED`)와 접두·형태가 일관된다.
- **규약 위반 정정** — 이번 diff 는 `error-codes.md` §1 UPPER_SNAKE_CASE 원칙을 어기던 종전 §5.4 소문자 코드(`auth_failed` · `network` · `unknown_error`, `Integration.statusReason` 과 철자 충돌)를 철회하고 `DB_AUTH_FAILED`/`DB_CONNECT_FAILED` 로 교체했다 — 규약 위반을 스스로 정정한 사례다.
- **네임스페이스 경계 명시** — 신규 코드가 노드 런타임 `output.error.code`(`ErrorCode` enum, node-output §3.2 envelope)와 별개 `IntegrationTestResult.code` 네임스페이스임을 각 표 행·본문에서 명시적으로 밝혀 `error-codes.md` §4 의 "두 파이프라인을 갈라 적는다" 취지와 같은 원칙(레이어 혼동 방지)을 따른다.
- **감사 액션 명명** — §14.3 의 `integration.created/updated/deleted/rotated/reauthorized/scope_changed` 는 `audit-actions.md` §3 레지스트리(`integration` 행)와 정확히 일치한다(이번 diff 대상은 아니나 인접 확인).
- **리뷰 인용 형식** — Rationale 신규 절이 인용하는 `review/consistency/2026/09/10/10_47_01`(§9.1 관련, 기존 문장) 은 전체 경로 형식으로 `review-citations.md` §2(bare `hh_mm_ss` 금지)를 지킨다. 새로 추가된 Rationale 절 자체는 review 세션을 인라인 인용하지 않고 `plan/complete/spec-draft-integration-connection-tests.md` 경로로 근거를 남겨 문제되지 않는다.
- **API 문서 규약(swagger.md) 과의 정합** — 신규 서비스별 테스트 결과 코드가 실제로 노출되는 `TestConnectionResultDto`(`codebase/backend/.../integration-response.dto.ts`)· `@ApiOkWrappedResponse` 데코레이터 구조와 어긋나지 않는다(기존 구현이 이미 이 규약대로 되어 있고, 신규 코드는 같은 필드(`code`)에 문자열 값만 추가하는 확장이라 DTO·데코레이터 변경이 필요 없다).
- **문서 구조** — `4-integration.md` 는 프리엠블(관련 문서 링크) + 번호 매김 본문(§1~§14) + 말미 `## Rationale`(다중 H3, 날짜 표기) 구조를 유지하며, 신규 Rationale 절도 같은 패턴(제목에 날짜, 결정·근거·기각 대안 서술)을 따른다. 별도 `## Overview` 헤더는 없으나 이는 `_product-overview.md` 로 역할이 분리된 이 저장소의 기존 관행이며 diff 가 새로 만든 이탈이 아니다.

## 요약

이번 `74087dff6` 커밋(§5.3·§5.4 HTTP/Database 연결 테스트 재정의 + §14.1 신규 에러 코드 다섯)은 `spec/conventions/error-codes.md`·`audit-actions.md`·`swagger.md`·`review-citations.md` 를 위반하지 않는다. 오히려 종전에 존재하던 소문자 에러 코드(`auth_failed`/`network`/`unknown_error`)라는 실제 규약 위반을 UPPER_SNAKE_CASE + 도메인 prefix 형태로 스스로 교정했고, 신규 코드 다섯은 기존 형제 코드와 이름 형태가 일관되며 네임스페이스 경계(노드 런타임 vs 연결 테스트 전용)도 명시적으로 구분해 두었다. 유일하게 짚을 만한 것은 `IntegrationTestResult` 결과 서술이 문서 전반에 걸쳐(신규 diff 포함) `{ data: ... }` 봉투를 생략하는 축약 스타일인데, 이는 §9.4 가 이미 일반 규칙을 선언해 둔 상태에서의 문서 전역 관행이라 이번 PR 고유의 신규 위반은 아니며 구현 위험도 낮다(대응 DTO·wrapper 데코레이터가 이미 올바르게 구현돼 있음). CRITICAL 은 없다.

## 위험도

LOW
