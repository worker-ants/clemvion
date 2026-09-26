# 부작용(Side Effect) 리뷰

## 발견사항

- **[WARNING]** 프로덕션 14개 POST 엔드포인트의 실제 wire-level HTTP 성공 코드가 `201 Created` → `200 OK` 로 바뀐다. 이는 OpenAPI 문서에는 이미 200으로 광고되어 있었으나 런타임(Nest 기본값)은 201을 내던 불일치를 "광고 쪽(200)"에 맞춰 해소한 것으로, 문서 정합화가 목적이지만 실제로는 **기존에 배포되어 있던 API의 응답 계약을 바꾸는 것**이다. 상태 코드를 엄격 비교(`=== 201`)하는 외부 API 소비자(웹훅 클라이언트, 서드파티 통합, OpenAPI로 생성한 SDK 등)가 있다면 영향을 받을 수 있다.
  - 위치: `codebase/backend/src/modules/auth-configs/auth-configs.controller.ts:158` (`regenerate`), `codebase/backend/src/modules/integrations/integrations.controller.ts:209,232,502,525,559,588` (`previewTest`/`oauthBegin`/`testConnection`/`rotate`/`reauthorize`/`requestScopes`), `codebase/backend/src/modules/knowledge-base/knowledge-base.controller.ts:432` (`search`), `codebase/backend/src/modules/schedules/schedules.controller.ts:187` (`previewExpression`), `codebase/backend/src/modules/workflow-assistant/workflow-assistant.controller.ts:153` (`sendMessage`, SSE), `codebase/backend/src/modules/workflows/workflows.controller.ts:452` (`saveCanvas`), `codebase/backend/src/modules/workspaces/workspaces.controller.ts:244,270,567` (`leave`/`transferOwnership`/`acceptInvitation`)
  - 상세: `@HttpCode(HttpStatus.OK)` 데코레이터를 추가해 Nest의 POST 기본 응답 코드(201)를 명시적으로 200으로 덮어썼다. 응답 바디는 그대로이므로 내부적으로는 "버그 픽스"지만, 이미 프로덕션에 존재하던 API의 실제 wire 동작이 바뀌는 것은 사실이다. 이는 `plan/in-progress/post-status-openapi.md` 에서 사전에 인지·조사된 변경이며(frontend/channel-web-chat/packages 전수 grep으로 `=== 201` 비교 0건 확인, assistant SSE 클라이언트는 `response.ok` 로 판정), `CHANGELOG.md` 에도 "상태 코드를 `=== 201` 로 비교하는 외부 API 호출자가 있다면 확인할 것" 이라는 경고 문구가 명시되어 있다. 따라서 발견 자체는 이미 완화·문서화된 상태이지만, 부작용 리뷰 관점에서는 "공개 API 인터페이스 변경이 기존(특히 저장소 밖) 사용자에 미치는 영향" 이라는 항목에 정확히 해당하므로 기록해 둔다.
  - 제안: 추가 조치 불필요 — 이미 CHANGELOG 경고와 조사 근거가 남아 있음을 확인했다. 다만 이 PR이 머지된 뒤 실제 공개 API 문서/버전 노트를 소비하는 외부 파트너가 있다면 별도 공지 채널(릴리스 노트 등)로도 알릴지는 제품 판단 영역.

- **[INFO]** `DELETE /api/workspaces/:id/invitations/:invitationId` 는 런타임 동작 변경 없이 OpenAPI 광고만 `204 No Content` → `200 OK`(`ApiOkWrappedResponse(OkResultDto)`) 로 정정된다. 실제로는 이전부터 `200 { data: { ok: true } }` 를 반환하고 있었으므로 (Nest DELETE 기본값은 200) 이 변경은 순수 문서 정정이며 side effect 없음을 코드로 확인했다.
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts:550` (`@ApiOkWrappedResponse(OkResultDto, ...)`), 핸들러 `revokeInvitation` (`:538` 부근, `@Delete(':id/invitations/:invitationId')`, `@HttpCode` 미부착 → Nest 기본값 200 그대로)
  - 상세: 참고용 기록. 액션 불요.

- **[INFO]** 신설 정적 가드(`http-status-advertised-guard.ts`)의 `swaggerResponseStatuses()` 는 `@nestjs/swagger` 가 export 하는 모든 `Api*Response` 팩토리를 실제로 호출해(`factory({})(Probe.prototype, 'handler', descriptor)`) `Reflect.getMetadata` 로 상태 코드를 역산한다. 팩토리 호출로 인한 메타데이터 부착 대상은 루프 내부에서 매번 새로 선언하는 로컬 `Probe` 클래스 프로토타입에 한정되어 있어, 전역 상태나 다른 테스트 파일로 새는 부작용은 없음을 확인했다(Jest는 스펙 파일별로 격리된 모듈 레지스트리를 사용).
  - 위치: `codebase/backend/src/repo-guards/__tests__/http-status-advertised-guard.ts` 의 `swaggerResponseStatuses` 함수 (55행 부근, 원본 파일 기준)
  - 상세: 참고용 기록. 액션 불요.

## 요약

이 PR의 실질 변경은 "OpenAPI 광고와 실제 성공 코드 불일치 15곳" 을 광고 쪽(200)에 맞춰 해소하는 작업이며, 14개 POST 액션 엔드포인트에 `@HttpCode(HttpStatus.OK)` 를 추가해 이전까지 프로덕션에서 실제로 나가던 `201` 응답을 `200` 으로 바꾼다는 점에서 이것은 단순 문서 수정이 아니라 **이미 배포된 API의 wire-level 응답 계약을 변경하는 부작용**이다. 다만 이 영향은 developer가 사전에 조사(내부 클라이언트 `=== 201` 비교 0건 확인)하고 CHANGELOG에 외부 호출자용 경고 문구까지 남겨 두는 등 상당히 신중하게 다뤄졌고, 신설된 정적 가드도 전역 상태를 오염시키지 않는 로컬 스코프에서 동작한다. `DELETE .../invitations/:invitationId` 는 런타임 불변·광고만 정정이라 side effect 없음을 확인했다. 그 외 시그니처 변경(함수 인자), 전역 변수 도입, 파일시스템/네트워크/환경변수 부작용, 예기치 않은 이벤트·콜백 변경은 발견되지 않았다. 뮤테이션 테스트/저장소 쓰기는 수행하지 않았고(코드 읽기·`git diff`/`grep`만 사용), `git status --short` 는 리뷰 산출물 디렉터리(`review/code/...`)만 untracked 상태로 남아 있어 리뷰로 인한 저장소 오염 없음을 확인했다.

## 위험도

LOW
