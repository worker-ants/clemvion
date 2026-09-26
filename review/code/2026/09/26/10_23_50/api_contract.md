# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** 14개 엔드포인트의 실제 성공 HTTP 상태 코드가 `201 Created` → `200 OK` 로 바뀐다 — 하위 호환성 관점에서 실질적 breaking change
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:160`(regenerate), `codebase/backend/src/modules/integrations/integrations.controller.ts:209,231,502,525,559,588`(previewTest·oauthBegin·testConnection·rotate·reauthorize·requestScopes), `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts:432`(search), `codebase/backend/src/modules/schedules/schedules.controller.ts:187`(previewExpression), `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:153`(sendMessage, SSE), `codebase/backend/src/modules/workflows/workflows.controller.ts:452`(saveCanvas), `codebase/backend/src/modules/workspaces/workspaces.controller.ts:244,270,566`(leave·transferOwnership·acceptInvitation)
  - 상세: 종전에는 OpenAPI 는 200 을 광고하면서 `@HttpCode` 미지정으로 Nest 기본값(POST→201)이 실제로 나가는 불일치였고, 이번 변경은 **광고(200) 쪽에 실제 코드를 맞춘다** — 즉 wire 응답의 실제 상태 코드가 201→200 으로 바뀐다. 이는 명시적 상태 코드 비교(`res.status === 201`)를 하는 외부/제3자 API 소비자에게는 breaking change 다. 저장소 내 조치는 충분히 신중했다: (1) `frontend`·`channel-web-chat`·`packages` 전체에서 `=== 201` 류 비교 0건 확인, (2) SSE 클라이언트는 `response.ok` 판정이라 영향 없음, (3) CHANGELOG(`Unreleased — POST 액션 14곳...`)에 "상태 코드를 `=== 201` 로 비교하는 외부 API 호출자가 있다면 확인할 것" 이라는 명시적 경고를 남김, (4) 15/15 뮤턴트 KILLED·e2e 전수 조정·정적 가드 신설로 회귀 방지. 다만 이 저장소의 다른 규약(`spec/conventions/error-codes.md` §"등급 B — 잔여 위험 인수" 행)이 스스로 지적하듯, "워크스페이스 JWT 로 호출 가능한 내부 REST 엔드포인트는 저장소 밖 서드파티가 그 값(여기서는 상태 코드)으로 분기했을 가능성을 grep 으로 배제할 수 없다"— 이번 PR 의 plan 문서에는 그 잔여 위험을 "0건 확인" 으로만 적고 명시적 인수(risk acceptance) 문구가 없다(반면 CHANGELOG 에는 있다). API 버전 관리 체계(예: `/v1` prefix, `Accept-Version`, deprecation window)가 없는 프로젝트 특성상 이 방식(문서화+회귀 테스트) 자체는 합리적이나, 실제 외부 연동이 존재한다면 이번 CHANGELOG 경고가 유일한 안전장치다.
  - 제안: 현재 조치(CHANGELOG 경고 + 전수 grep + e2e 고정)로 충분하다고 판단되나, 만약 이 관리 API 에 프로그래매틱(비-SPA) 외부 소비자가 실재한다면 릴리스 노트/공지 채널로 별도 안내를 고려. 향후 유사 breaking 변경 시 plan 문서에도 `error-codes.md` 선례처럼 "잔여 위험 인수" 문구를 명시하는 관행을 따르면 일관성이 좋아진다.

- **[INFO]** `DELETE /api/workspaces/:id/invitations/:invitationId` — OpenAPI 광고만 정정(204→200), 실제 런타임 동작 불변
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:550` (`@ApiOkWrappedResponse(OkResultDto, ...)` 로 `@ApiNoContentResponse` 대체)
  - 상세: 핸들러(`revokeInvitation`, 556행)는 `@HttpCode` 미지정 + DELETE 에 대한 Nest 기본값 200 으로 이미 `{ data: { ok: true } }` 를 반환하고 있었다. 종전 광고(`@ApiNoContentResponse` 204)가 거짓이었고, 이번 변경은 실제 동작을 문서에 맞춘 **순수 문서 정합화**다 — 클라이언트에 대한 breaking 영향 없음. `OkResultDto`(`{ ok: boolean }`) 스키마도 실제 응답 바디와 일치함을 확인했다.
  - 제안: 없음(정상 수정). 컨트롤러의 삭제 응답을 204 로 옮길지는 plan 이 밝힌 대로 별도 트래커 결정 사항이므로 이 PR 범위 밖으로 남겨 둔 것도 타당.

- **[INFO]** 신설 정적 가드 `http-status-advertised` — 광고된 성공 코드 ↔ 실제 성공 코드 정합을 AST 로 강제, `spec/conventions/swagger.md` §2-4 에 규약으로도 등재됨
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts`, `codebase/backend/src/repo-guards/__tests__/http-status-advertised.spec.ts`, 대조군 `codebase/backend/src/repo-guards/__tests__/fixtures/http-status-advertised/sample.controller.ts`
  - 상세: 응답 데코레이터 이름을 손으로 나열하지 않고 `@nestjs/swagger` 팩토리를 실제로 적용해 메타데이터를 읽으므로 신규 2xx 데코레이터 추가 시에도 판정이 새지 않는다. `@Res()` SSE 핸들러도 면제하지 않음을 실제 Nest 앱 기동 캐너리로 고정했고, 대조군 fixture 로 6개 위반·다수 clean·3개 unresolved 케이스를 각각 가른다. 베이스라인 0(동결 목록 없음)이라 향후 유사 불일치의 재발을 원천 차단한다. API 계약 관점에서 가장 실효성 있는 안전장치다.
  - 제안: 없음. `plan/complete` 로 이관 시 "광고 없음 15곳"(§남기는 것) 트래커 등재 여부를 확인.

- **[INFO]** 워크플로우 저장(`saveCanvas`)·워크플로우 import 는 같은 파일에서 서로 다른 상태 코드(200 vs 201)를 유지 — 의도된 구분
  - 위치: `codebase/backend/test/workflow-crud.e2e-spec.ts` (import 는 `201` 유지, save 는 `200` 로 조임)
  - 상세: `saveCanvas`(액션, 기존 캔버스 갱신)는 200, `duplicate`/`import`(신규 리소스 생성)는 201 — RESTful 관례(생성=201, 액션=200) 를 일관되게 지킨다. 확인 목적으로 기재하며 결함 아님.

## 요약

이번 변경은 15곳의 "OpenAPI 광고 성공 코드 ≠ 실제 성공 코드" 불일치를 해소하는 작업이다. 14곳은 실제 HTTP 상태를 201→200 으로 바꾸는 **진짜 breaking change** 지만, 내부 클라이언트(frontend/channel-web-chat/packages) 전수 grep 으로 영향 없음을 확인했고 CHANGELOG 에 외부 API 호출자를 위한 명시적 경고 문구를 남겼으며, e2e 전수 조정과 신설 정적 가드(`http-status-advertised`)로 회귀를 봉쇄했다. 1곳(`revokeInvitation`)은 런타임을 그대로 두고 광고(204→200)만 실제와 맞춘 순수 문서 정합화로 클라이언트 영향이 없다. 응답 바디 구조·에러 응답 형식·인증/인가 데코레이터·URL 설계·페이지네이션은 이번 변경으로 건드리지 않았다. 유일한 잔여 우려는 이 저장소가 스스로 인정한 선례(`error-codes.md`)대로 "workspace-JWT 로 호출 가능한 내부 REST 엔드포인트는 저장소 밖 그렙 미검출이 절대적 안전 증거가 아니다"는 점인데, 이번 PR 은 CHANGELOG 경고로 이를 실질적으로 커버했다고 판단한다.

## 위험도

LOW
