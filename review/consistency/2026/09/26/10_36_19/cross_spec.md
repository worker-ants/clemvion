# Cross-Spec 일관성 검토 — `post-status-openapi` (impl-done)

## 검토 범위

target scope(`.../pso-done-scope/spec`) 자체의 spec 델타는 0개 파일이다(코드 전용 PR). 실제로 대조한 것은
**구현 diff**(`git diff origin/main...HEAD`, 31파일/1515줄 — 프롬프트에서 예산 절단되어 본 워크트리에서
직접 `git diff` / `git show` 로 재확인)와 그 diff 가 건드리는 14개 POST 액션 + 1개 DELETE 라우트가
`spec/**` 의 다른 영역(내비게이션·시스템·컨벤션 문서)의 기존 서술과 어긋나는지다.

- 변경 코드: `auth-configs` `regenerate`, `integrations` `previewTest`/`oauthBegin`/`testConnection`/`rotate`/
  `reauthorize`/`requestScopes`, `knowledge-base` `search`, `schedules` `previewExpression`,
  `workflow-assistant` `sendMessage`(SSE), `workflows` `saveCanvas`, `workspaces` `leave`/`transferOwnership`/
  `acceptInvitation`(이상 14곳 `@HttpCode(HttpStatus.OK)` 추가, 실제 201→200) + `workspaces` `revokeInvitation`
  (DELETE, 광고만 `@ApiNoContentResponse`(204)→`@ApiOkWrappedResponse(OkResultDto)`(200)로 정정, 런타임은
  원래부터 200).
- 유일한 spec 변경: `spec/conventions/swagger.md` (§2-4 "광고한 성공 코드는 실제 성공 코드를 담는다" 신설
  문단 + §5-4 체크리스트 1행 + `code:` 가드 등재 + Rationale).

## 발견사항

### [INFO] `api-convention.md` §6 표가 신규 "광고=실제" 불변식을 역참조하지 않음

- target 위치: `spec/conventions/swagger.md` §2-4 신설 문단 ("광고한 성공 코드는 실제 성공 코드를 담는다…")
- 충돌 대상: `spec/5-system/2-api-convention.md` §6 HTTP 상태 코드 표 (200/201/204 행)
- 상세: 모순은 아니다 — 두 표 모두 200=조회/수정, 201=Created 로 의미가 일치하고, 신규 문단은 그 의미를
  바꾸지 않고 "선택한 코드가 실제 런타임 코드와 짝을 이뤄야 한다"는 별도 축만 얹는다. 다만 §6 표는 상태
  코드를 고를 때 가장 먼저 참조되는 자리인데 이 새 불변식(가드 `http-status-advertised` 로 강제)을 전혀
  가리키지 않는다. 이는 `--spec` 단계 cross_spec 검토(`review/consistency/2026/09/26/09_22_45/cross_spec.md`)
  에서 이미 동일하게 지적됐고, developer plan(`spec-draft-swagger-http-status-guard.md` Rationale)이 "단일
  축 가드는 그 축을 소유한 문서(`swagger.md`)에만 등재" 라는 선례(`dto-class-name-collision` 등)를 근거로
  `api-convention.md` 동시 갱신을 의도적으로 보류했다. impl-done 시점 재확인 결과 이 보류는 그대로 유지됐고
  (§6 은 여전히 미변경), planner 백로그 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
  "두 표에 «자원을 만들지 않는 POST 액션 = 200» 한 줄 + api-convention §6 → swagger §2-4 역참조" 항목으로
  이미 등재돼 있다(`착수 조건: 없음(여유 있을 때)`).
- 제안: 신규 조치 불요 — 이미 추적 중인 항목이다. planner 가 여유 있을 때 위 백로그 항목을 처리하면 됨.

### [INFO] `api-convention.md` §6 "204=삭제 성공" 일반 서술과 `workspaces` DELETE 3곳(200)의 괴리가 한 곳 더 명문화됨

- target 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` — `revokeInvitation` 의
  광고를 `@ApiNoContentResponse`(204)에서 `@ApiOkWrappedResponse(OkResultDto)`(200)로 정정
- 충돌 대상: `spec/5-system/2-api-convention.md` §6 (`204 | No Content | 삭제 성공`)
- 상세: 이 PR 은 런타임을 바꾸지 않았다 — `revokeInvitation` 은 원래부터 `{ data: { ok: true } }` 를 담아
  Nest 기본값 200 으로 응답했고, 이번 fix 는 **잘못 광고돼 있던 204 를 실제(200)에 맞춘 것**뿐이다. 다만
  결과적으로 "OpenAPI 문서가 명시적으로 200 이라고 선언하는 DELETE 라우트"가 기존 2곳(`DELETE /api/workspaces/:id`,
  `.../members/:memberId`)에서 3곳으로 늘었고, 이는 §6 표의 일반 안내("DELETE=204")와 계속 어긋난다.
  이 괴리 자체는 이 PR 이전부터 planner 백로그(`spec-draft-nullable-notation-followups.md`, 2026-06-21 등재,
  낮음/planner)에 "컨트롤러 단위의 다른 관례" 로 기록돼 있었고, 이번 diff 는 그 항목 본문에 "셋째 라우트"로
  갱신하는 커밋을 함께 포함한다(추적 정합 확인됨 — 새로 발견된 미등재 갭이 아니다).
- 제안: 신규 조치 불요. 위 백로그 항목의 "204 로 통일 vs §6 각주 추가" 결정이 내려지면 세 라우트(런타임+광고)를
  함께 바꾸면 되고, 신설 가드 `http-status-advertised` 가 향후 그 짝을 자동 강제한다.

### 확인됨 — 충돌 없음 (조치 불요)

- **spec 본문의 명시적 상태 코드와 배치되지 않음**: 이번에 201→200 으로 정정된 14개 라우트를 언급하는 다른
  영역 spec(`spec/2-navigation/4-integration.md`, `5-knowledge-base.md`, `6-config.md`, `9-user-profile.md`,
  `3-workflow-editor/0-canvas.md`, `4-ai-assistant.md`, `2-navigation/3-schedule.md`)에서 `201` 을 명시한
  자리는 0건(grep 확인). 오히려 `spec/5-system/11-mcp-client.md`(`preview-test` "HTTP 200 OK")·
  `spec/2-navigation/4-integration.md`(`:id/test` pending_install "200 + {success:false}")는 이미 200 을
  적고 있어, 이번 코드 수정(201→200)이 그 문서들과의 기존 불일치를 해소하는 방향이다.
- **POST 의미 표와의 정합**: `spec/5-system/2-api-convention.md` §5.2 자원 액션 표는 POST 를 "리소스 생성,
  액션 실행" 두 갈래로 이미 구분해 두고 있어, "액션 POST 는 200" 이라는 이번 규칙과 상충하지 않는다.
- **요구사항 ID·데이터 모델·상태 전이·RBAC·계층 책임**: 이번 diff 는 새 요구사항 ID·엔티티·상태 머신·권한
  구조를 도입하지 않는다. `@Roles()` 데코레이터는 전 라우트에서 변경 없이 유지되고, 코드는 `@HttpCode` 추가와
  응답 데코레이터 정정뿐이다. 신규 가드 파일(`http-status-advertised{-guard.ts,.spec.ts}`)은 기존
  `dto-class-name-collision`·`param-uuid-pipe` 등과 동일하게 `codebase/backend/src/repo-guards/__tests__/`
  아래에 위치해 계층 배치도 기존 결정과 일치한다.
- **`3-schedule.md`/`2-trigger-list.md` 번들 포함은 무관**: 프롬프트에 이 두 문서가 "관련 spec" 으로 실린
  것은 diff 가 `schedules.controller.ts`/`triggers.controller.ts` 를 `code:` 로 문 spec 이기 때문이며(schedules
  의 `preview` 핸들러가 이번 `@HttpCode(OK)` 대상), 두 문서 어디에도 이번 변경과 모순되는 상태 코드 서술은
  없다.

## 요약

이번 PR 은 `spec/**` 에 새 데이터 모델·API 계약·요구사항 ID·상태 머신·RBAC·계층 책임을 도입하지 않고,
14개 POST 액션 + 1개 DELETE 라우트의 **실제 성공 코드를 이미 존재하던 OpenAPI 광고/관련 spec 서술(200)에
맞추는** 정정이다. 대조한 모든 관련 spec 문서(`4-integration.md`·`11-mcp-client.md`·`9-user-profile.md`·
`5-knowledge-base.md`·`6-config.md`·`0-canvas.md`·`4-ai-assistant.md`·`3-schedule.md`)에 이번 수정과
배치되는 명시적 상태 코드 서술은 없으며, 오히려 두 문서(`11-mcp-client.md`, `4-integration.md`)는 이미
200 을 명시해 이번 코드 변경이 그 방향을 뒤늦게 따라잡은 셈이다. 유일하게 남는 두 관찰(§6 표의 신규
불변식 역참조 부재, §6 "204=삭제 성공" 일반 서술과 workspaces DELETE 3곳의 괴리)은 모두 이 PR 이전부터
planner 백로그에 등재돼 있고 이번 diff 가 그 백로그 항목 자체를 최신화했음을 확인했다 — 새로 발견된
미등재 갭이 아니라 이미 추적 중인 사안이다.

## 위험도
NONE
