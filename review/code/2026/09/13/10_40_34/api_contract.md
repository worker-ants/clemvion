# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 이전 라운드(`review/code/2026/09/13/10_12_19/api_contract.md` WARNING#1)가 지목한
  "형제 엔드포인트 `TestConnectionResultDto` 가 실제로 실리는 `code` 를 선언하지 않는다" 는
  이번 diff 에서 해소됐다 — 재확인 결과 정상
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts`
    (`TestConnectionResultDto`, 게이트 478~479행 `code?: string` 신규 선언)
  - 상세: `IntegrationTestResult.code`(`integrations.service.ts:79`)가 실제 생산자이고
    (`grep` 으로 `code:` 리터럴 26곳 발행 재확인), `spec/2-navigation/4-integration.md §9.1` 도
    `{success, code, message}` 실패 shape 을 이미 문서화하고 있어 DTO 쪽이 낡았던 것이 맞다.
    같은 diff 에서 생산자 0건이던 `latencyMs`/`meta` 도 제거해(직접 grep 으로 `IntegrationTestResult`
    인터페이스와 대조 확인 — 둘 다 그 인터페이스에 없음) "선언만 있고 안 나가는 키" 와
    "나가는데 선언이 없는 키" 양방향을 한 커밋에서 함께 닫았다. 남은 MCP 전용 3필드
    (`capabilities`/`serverInfo`/`preview`)와 이 엔드포인트에 대한 `assertMatchesContract`
    미배선은 `plan/in-progress/spec-draft-nullable-notation-followups.md` (약 3242행)에
    developer 명의로 이미 등재돼 있어 이번 PR 스코프 밖으로 적절히 위임됐다.
  - 제안: 없음 — 확인 완료. 잔여분은 별도 PR 로 추적.

- **[INFO]** `POST /api/model-configs/:id/test` 응답 필드 리네임(`error`→`message`)·
  `latencyMs` 제거는 하위 호환성 실질 영향 없음을 재확인
  - 위치: `codebase/backend/src/modules/llm/llm.service.ts` (`testConnection`, 게이트 326·354행),
    `codebase/frontend/src/lib/api/model-configs.ts` (게이트 137~144행)
  - 상세: 프런트엔드 소비처(`codebase/frontend/src/components/models/model-config-manager.tsx:83`)
    는 이미 `result.message` 를 읽고 있었음을 직접 확인(`result.message ?? ""`). `testConnection`
    의 모든 실패 경로(임베딩 probe 실패·chat/rerank 클라이언트 실패)가 단일 `catch` 블록으로
    수렴해 `message` 를 항상 채우므로 `message` 가 비는 실패 분기는 없다. HTTP 상태는
    변경 없이 200 유지(`llm-model-config.controller.spec.ts` supertest 단언으로 재확인).
    `latencyMs` 는 두 DTO(`ModelTestConnectionResultDto`, `TestConnectionResultDto`) 모두
    생산자 0건이었다는 주장을 실제 서비스 코드 대조로 확인.
  - 제안: 없음.

- **[INFO]** 신규 컨트롤러 HTTP 왕복 계약 테스트가 응답 키를 전수(`Object.keys(...).sort()`)로
  고정해 "선언보다 넓은 응답"·"필드 누락" 양방향을 실측 뮤테이션으로 검증
  - 위치: `codebase/backend/src/modules/llm/llm-model-config.controller.spec.ts`
    (`POST /model-configs/:id/test — 와이어 계약 (HTTP)` describe, 게이트 215~261행)
  - 상세: `TransformInterceptor` 를 실제로 얹은 뒤 진짜 `LlmService`(mock 은 하위 의존만)를
    태워 응답 wire 를 검증한다 — 서비스 단위 프로브만으로는 놓치는 인터셉터 층의 필드명 변형을
    닫는다. `@Roles('editor')` 데코레이터 메타데이터 존재 확인 테스트(같은 파일 게이트
    111~117행)도 유지돼 인가 계약 회귀는 없음.
  - 제안: 없음 — 긍정적 관찰.

- **[INFO]** 신규 유저 가이드 에러 코드 표(`models{,.en}.mdx`, `run-results{,.en}.mdx`,
  `integrations{,.en}.mdx`)의 코드 토큰을 backend 소스와 grep 대조 — 전수 실재 확인
  - 위치: `codebase/frontend/src/content/docs/**` (해당 mdx 6개)
  - 상세: `MAKESHOP_404/422/4XX/5XX/AUTH_FAILED/RATE_LIMITED/TRANSPORT_FAILED`,
    `HTTP_*`(4종), `DB_*`(4종), `EMAIL_SEND_FAILED`, `LLM_CALL_FAILED/RATE_LIMIT/
    RESPONSE_INVALID/TIMEOUT`, `CODE_*`(3종), `SUB_WORKFLOW_*`(3종) — 전부 backend 소스에서
    발행 확인(각 최소 1건 이상). 퇴역 처리한 `NODE_EXECUTION_FAILED`·`INTEGRATION_ERROR`,
    지어낸 `MAKESHOP_API_ERROR` 는 backend/packages 전수 검색에서 0건으로 확인해 삭제가
    정당함을 재검증. `nodeName`→`nodeLabel` 필드명 정정도 backend emit 실측(0 vs 54)으로 확인.
  - 제안: 없음.

## 요약

이번 diff(28개 파일)의 API 계약 관점 핵심은 `POST /api/model-configs/:id/test` 응답에서
서비스·DTO·프런트엔드 세 레이어가 `error`/`message` 로 갈려 실패 사유가 화면에 전혀
도달하지 못하던 실결함을 `message` 로 통일해 고치고, `assertMatchesContract` 를 서비스
단위뿐 아니라 컨트롤러 HTTP 왕복(진짜 `TransformInterceptor` 경유)까지 배선해 재발을
런타임으로 고정한 것이다. 함께 제거된 `latencyMs`/`meta` 는 실측상 생산자 0건이라 실질적
breaking change 가 아니며 CHANGELOG 고지도 적절하다. 특히 이전 라운드가 지목했던 형제
엔드포인트(`/api/integrations/:id/test`)의 `TestConnectionResultDto` 미선언 `code` 필드
WARNING 이 이번 diff 에서 실제로 해소됐고(실측 재확인), 잔여 스코프(MCP 전용 3필드,
그 엔드포인트의 계약 검사기 미배선)는 developer 가 쓸 수 있는 `plan/` 백로그에 올바르게
위임돼 있다. HTTP 상태 코드·URL 경로·인증/인가·페이지네이션에는 변경이 없고, 신규
발견된 하위 호환성·에러 응답 일관성 문제는 없다.

## 위험도

NONE
