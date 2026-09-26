# 요구사항(Requirement) 리뷰 — 성공 응답 코드 ↔ OpenAPI 광고 정합 (post-status-openapi)

## 발견사항

- **[INFO]** e2e 신규 파일의 헤더 주석이 아직 존재하지 않는 경로를 가리킴
  - 위치: `codebase/backend/test/action-success-status.e2e-spec.ts:13` (`* e2e: ... — \`plan/complete/post-status-openapi.md\`.`)
  - 상세: 주석은 `plan/complete/post-status-openapi.md` 를 인용하지만, 실제 plan 파일은 리뷰 시점 현재 `plan/in-progress/post-status-openapi.md` 에 있다(`status: in-progress`, 체크리스트의 `/ai-review`·`--impl-done`·트래커 항목 닫기가 아직 미완료). 코드 결함은 아니고, 워크플로 관례상(`plan-lifecycle.md`) 이 PR 이 완결되며 plan 이 `complete/` 로 이동하면 인용이 맞아떨어진다.
  - 제안: 최종 커밋에서 plan 을 `complete/` 로 옮길 때 이 주석의 경로도 함께 유효해짐을 확인. 별도 코드 수정 불요.

- **[INFO]** `revokeInvitation`(DELETE 초대 취소) 런타임 204→200 재검토는 이 PR 범위 밖으로 의도적으로 유예
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.controller.ts` (`revokeInvitation`, `@Delete(':id/invitations/:invitationId')`)
  - 상세: 이번 변경은 광고만 200 으로 정정하고 런타임(암묵적 Nest 기본값 200)은 그대로 둔다. plan 본문이 이를 "런타임을 204 로 바꿀지는 별도 트래커 항목의 결정" 이라고 명시적으로 스코프 아웃했고, 트래커에 등재돼 있다고 기록돼 있음을 확인. 회색지대이며 결함 아님.

## 검증한 내용 (결함 없음 확인)

- **정합성**: 요구사항 목록(auth-configs `regenerate`, integrations 6곳, knowledge-base `search`, schedules `previewExpression`, workflow-assistant `sendMessage`, workflows `saveCanvas`, workspaces `leave`/`transferOwnership`/`acceptInvitation` = 14곳)이 diff 의 실제 변경과 1:1 대응됨을 파일 1~7 전수 확인. 데코레이터 순서(`@Roles` → `@HttpCode` → `@ApiOperation`)도 14곳 전부 일관.
- **workspaces.controller.ts import 정리**: `ApiNoContentResponse` import 제거가 dangling 아님을 `grep` 으로 확인(파일 내 잔여 참조 0건) — `revokeInvitation` 의 광고가 `ApiOkWrappedResponse(OkResultDto)` 로 바뀌며 더 이상 쓰이지 않음.
- **가드 로직**(`http-status-advertised-guard.ts`): `judgeHandler`/`statusOf`/`apiResponseStatus`/`wrapperResponseStatuses`/`swaggerResponseStatuses` 를 읽고 엣지 케이스(값을 못 읽는 `@HttpCode(<식>)`, `@ApiResponse` status 누락, 미등록 `Api*Response` 이름, `@ApiExcludeEndpoint`, 광고 0건, `ApiDefaultResponse` 의 `null`)가 위반/unresolved/스킵 중 어디로 가는지 대조 — 전부 의도한 분류로 귀결됨을 확인.
- **spec fidelity**: `spec/conventions/swagger.md` 가 이번 PR 로 갱신됨을 확인 — frontmatter `code:` 에 신규 가드 파일 경로 등재, §2-4 본문에 "광고한 성공 코드는 실제 성공 코드를 담는다" 규칙 신설, §5-4 체크리스트 항목 추가, §Rationale(2026-09-26) 에 배경·근거 기술. 코드 구현(가드의 판정 기준·`@Res()` 비면제·이름→코드 표 미하드코딩)이 spec 본문과 line-level 로 일치.
- **실행 검증**: `npm test -- src/repo-guards/__tests__/http-status-advertised.spec.ts` 를 직접 실행해 11/11 PASS 확인(0.6s) — 근거 캐너리(`@Res()` 핸들러가 실제 supertest 요청으로 201/200 을 낸다는 주장)까지 포함해 vacuous 하지 않음을 실측으로 재확인.
- **하위 호환성**: `test/helpers/auth.ts` 의 `inviteAndAccept` 리팩터(`createInvitation` 추출)가 함수 시그니처·반환 타입을 그대로 유지함을 확인 — 기존 10개 호출부(`member-remove-concurrency`, `workspace-path-guard`, `audit-logs` 등)에 영향 없음.
- **클라이언트 영향 없음**: `codebase/frontend`, `codebase/channel-web-chat` 에서 `=== 201`/`HttpStatus.CREATED` 형태로 고정 비교하는 자리 0건 확인(plan 의 주장과 일치).
- **TODO/FIXME**: 이번 diff 범위(`codebase/backend/src`, `codebase/backend/test`)에 신규 TODO/FIXME/HACK/XXX 주석 없음.
- **e2e 시나리오**: `action-success-status.e2e-spec.ts` 가 재발급(200+새 키), 초대 수락→나가기(200+DB 멤버십 소멸 확인), 초대 취소(200+DB 행 삭제 확인)를 상태 코드뿐 아니라 부수효과까지 검증 — "아무 일도 안 하고 200" 을 가리는 vacuous 패턴이 아님. `workflow-assistant.e2e-spec.ts` 의 신규 케이스 G 도 SSE 상태 줄 + 본문(`ASSISTANT_NO_LLM_CONFIG`)까지 확인해 4xx JSON 200 과 SSE 200 을 구분함.
- **가드 배치 스코프**: `http-status-advertised` 스캔 루트는 `src/modules` 이고 대조군 fixture(`src/repo-guards/__tests__/fixtures/...`)는 그 밖에 있어 자기 자신을 스캔하지 않음을 fixture 파일 헤더 주석과 실측(`checked > 150`, 실측 208) 으로 확인.

## 요약

`post-status-openapi` 작업은 전수 AST 스캔으로 발견한 15개 불일치(POST 액션 14곳의 201→200, 초대 취소 DELETE 1곳의 광고 204→200)를 정확히 완결한다. 컨트롤러 7개 파일의 `@HttpCode` 추가/광고 변경이 plan 이 정의한 목표 목록과 1:1 대응하며, 신설 정적 가드(`http-status-advertised{-guard,.spec}.ts`)는 대조군 fixture·근거 캐너리(`@Res()` 핸들러의 실제 Nest 기본 상태)를 포함해 스스로 실행·통과함을 직접 재현 확인했다. spec(`spec/conventions/swagger.md`)은 신규 규칙·체크리스트·Rationale·`code:` 등재까지 코드와 line-level 로 일치하고, e2e 는 상태 코드뿐 아니라 부수효과(DB 상태)까지 검증해 vacuous 하지 않다. CRITICAL/WARNING 급 결함을 발견하지 못했으며, 남은 두 건은 스코프 밖으로 의도적으로 유예된 사항이거나(초대 취소 런타임 204 전환 여부) 워크플로 완결 시 자연히 해소되는 plan 경로 참조(INFO) 수준이다.

## 위험도

NONE
