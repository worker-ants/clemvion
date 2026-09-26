# 테스트(Testing) 리뷰 — post-status-openapi

## 개요

본 변경은 POST 액션 14곳(+DELETE 1곳)의 실제 성공 HTTP 코드와 OpenAPI 광고를 맞추는 작업이다. 핵심 산출물은
① `@HttpCode(HttpStatus.OK)` 데코레이터 추가/OpenAPI 광고 정정, ② 신설 정적 가드
`http-status-advertised{-guard.ts,.spec.ts}` (AST 기반 순수 로직 + 소비 spec), ③ 신설 e2e
`test/action-success-status.e2e-spec.ts`, ④ 기존 e2e 22곳의 `[200, 201]` 관대한 단언을 `toBe(200)`으로 조인 것,
⑤ 대조군 fixture `repo-guards/__tests__/fixtures/http-status-advertised/sample.controller.ts` 이다.
`plan/in-progress/post-status-openapi.md` 를 함께 확인했다 — 뮤테이션 테스트 15/15 KILLED, e2e 1회차 RED(3파일) →
원인 규명 → 수정까지 기록되어 있어 테스트 검증 과정 자체가 이례적으로 투명하다.

## 발견사항

- **[INFO]** `integrations` `:id/reauthorize` · `:id/request-scopes`, `knowledge-base` `search` 의 성공(200) 경로는
  end-to-end 로 직접 검증되지 않는다.
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` (`:id/reauthorize` 라인 559,
    `:id/request-scopes` 라인 588) · `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts:432`
  - 상세: `codebase/backend/test/integration-personal-owner.e2e-spec.ts` 는 `:id/reauthorize` 와 `oauth/begin`
    reauthorize 모드를 403/404 실패 경로만 부른다(성공 200 경로 없음, 175-227행). `request-scopes` 와
    `knowledge-base/search` 는 어떤 e2e 에서도 호출되지 않는다(`grep -rn "request-scopes"` `grep -rln
    "knowledge-base" test/`로 확인 — `knowledge-base.e2e-spec.ts` 에 `search` 문자열 자체가 없음). 신설 e2e
    `action-success-status.e2e-spec.ts` 의 헤더 주석도 "재인증 · scope 추가 · 지식 베이스 검색은 외부 OAuth ·
    임베딩에 닿아 여기서 부르지 않는다"고 명시적으로 배제를 인정한다. 세 라우트 모두 `@Res()` 없는 표준
    핸들러라 신설 정적 가드(`http-status-advertised`, 뮤테이션 15/15 KILLED)와 그 안의 `@Res()` 근거
    캐너리(Nest 가 핸들러 호출 전에 기본 상태를 무조건 싣는다는 실측)가 "선언=실제"를 이미 강하게
    보증하므로 위험도는 낮다 — 다만 이 세 자리는 가드 밖의 실 요청 스택(가드·인터셉터·필터)을 지나는지는
    끝내 검증되지 않은 채 남는다.
  - 제안: OAuth 프로바이더를 목(mock)하거나 서비스 계층 결과를 스텁해 컨트롤러 통합 테스트(HTTP 계층 포함,
    e2e 아니어도 무방)로 `:id/reauthorize`/`request-scopes`/`knowledge-base search` 의 200 응답을 최소 1곳씩
    커버하는 후속 항목을 고려. 이미 트래커/plan 에 의식적 트레이드오프로 기록돼 있어 즉시 차단할 사안은
    아니다.

- **[INFO]** `test/action-success-status.e2e-spec.ts` 파일 헤더가 `plan/complete/post-status-openapi.md` 를
  참조하지만 실제 plan 파일은 아직 `plan/in-progress/post-status-openapi.md` 에 있다.
  - 위치: `codebase/backend/test/action-success-status.e2e-spec.ts:13`
  - 상세: `find plan -iname "*post-status-openapi*"` 확인 결과 `plan/in-progress/post-status-openapi.md` 만
    존재(`plan/complete/` 에 없음). plan 의 체크리스트에 `[ ] /ai-review` · `[ ] --impl-done` 이 아직 미완료로
    남아 있어, 이 review-fix 사이클이 끝나면 `plan/complete/` 로 이동될 예정으로 보인다 — 현재는 테스트
    코드 주석이 아직 존재하지 않는 경로를 가리키는 상태다.
  - 제안: `--impl-done` 완료 후 plan 을 `plan/complete/` 로 이동할 때 이 주석의 경로가 실제와 일치하는지
    한 번 더 확인(별도 조치 불요 — 통상적인 lifecycle 순서상 자연히 맞춰짐).

## 강점 (참고용, 위험 아님)

- 신설 가드가 `Api*Response` 이름→코드 표를 손으로 유지하지 않고 `@nestjs/swagger` 팩토리를 실제로 적용해
  런타임 메타데이터에서 읽는다(`swaggerResponseStatuses`) — 새 2xx 데코레이터가 추가돼도 표가 조용히
  비지 않는다. 표에 없는 이름은 `unresolved` 로 실패해 침묵 누락을 막는다.
- `@Res()` 핸들러를 면제하지 않기로 한 판단을 산문이 아니라 **근거 캐너리**(실제 Nest 앱을 띄운 supertest
  요청 2건, `@HttpCode` 있음/없음 각각 확인)로 고정했다 — Nest 가 동작을 바꾸면 캐너리가 먼저 RED 를 낸다.
- 대조군 fixture 가 위반 6곳(`postDefaultAdvertisedOk` 등) · 정상 11곳 · unresolved 3곳 · 데코이(주석/문자열
  속 데코레이터 모양)까지 분리해 판정 함수가 실제로 가르는지 검증한다. 공허성 가드(`checked > 150`,
  `size > 40`, `size >= 6`)가 세 지점(스캔 대상·swagger 표·wrapper 표)에 다 있어 "빈 표인데 통과" 를 막는다.
- 기존 e2e 22곳의 `expect([200, 201]).toContain(status)` → `expect(status).toBe(200)` 전환은 회귀 테스트를
  실질적으로 강화한다 — 이전에는 상태 불일치를 가리고 있었다(plan 문서가 이를 명시). `grep` 으로 재확인한
  결과 저장소에 남은 `[200, 201]` 패턴이 없다 — 전수 적용됐다.
- `workflow-crud.e2e-spec.ts` 의 import 라우트는 의도적으로 `toBe(201)` 로 유지됐다(실제 자원 생성 —
  이 PR 의 범위 밖) — 일괄 치환이 아니라 라우트별 의미를 구분해 적용한 흔적.
- `workflow-assistant.e2e-spec.ts` 신설 테스트 G 는 실존하지 않는 `llmConfigId` 로 외부 LLM 호출 없이
  SSE 에러 이벤트로 스트림을 종료시켜, 외부 의존 없이 실 HTTP 스택으로 상태 줄을 검증한다 — 상태 코드만이
  아니라 `content-type` 과 스트림 본문(`ASSISTANT_NO_LLM_CONFIG`)까지 확인해 "4xx 아닌 SSE 200" 과 "JSON
  200" 을 구별한다.
- 신설 e2e(`action-success-status.e2e-spec.ts`)는 상태 코드만이 아니라 부작용(멤버십 행 삭제, 초대 행 삭제)
  까지 DB 로 재확인해 "아무 일도 안 하고 200" 과 실제 성공을 가른다.
- plan 문서에 15개 뮤턴트(G1~G11, C1, P1~P3) 전부 KILLED 로 기록되어 있고, 예측과 실제로 죽인 케이스가
  일치한다 — 가드의 판별력이 문서상 근거로 뒷받침된다.

## 요약

테스트 관점에서 이 변경은 모범적인 수준이다. 상태 코드 변경마다 정적 가드(뮤테이션 검증됨) + 필요한 곳의
e2e 강화가 짝을 이루고, 느슨했던 기존 회귀 테스트(`[200,201]`)를 전수 조였다. 유일하게 남는 갭은 외부
OAuth/임베딩에 닿는 세 라우트(`:id/reauthorize`, `:id/request-scopes`, `knowledge-base search`)의 성공 경로가
e2e 로 직접 검증되지 않는다는 점인데, 이는 신설 정적 가드와 그 근거 캐너리로 상당 부분 상쇄되고 PR 자체가
그 트레이드오프를 명시적으로 문서화하고 있어 차단 사유는 아니다.

## 위험도

LOW
