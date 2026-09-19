# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `rotate()` 는 preview-test/`:id/test` 와 달리 실패 시 세부 `code` 를 버리고 항상 `INTEGRATION_TEST_FAILED` 로 뭉갠다
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` — `rotate()` 메서드의 `if (!test.success) throw new BadRequestException({ code: 'INTEGRATION_TEST_FAILED', message: test.message })` (해당 블록은 이번 diff 의 변경 범위 밖 — diff 는 그 아래 저장 로직만 바꿨다. `git blame` 상 pre-existing)
  - 상세: `dispatchTest` 는 이제 Database·HTTP 에 대해서도 `DB_HOST_BLOCKED`/`DB_AUTH_FAILED`/`DB_CONNECT_FAILED`/`HTTP_BLOCKED`/`HTTP_AUTH_FAILED`/`HTTP_SERVER_ERROR`/`HTTP_CONNECT_FAILED` 같은 세분화된 `code` 를 돌려준다. `PreviewTestResultDto`·`TestConnectionResultDto` 는 그 `code` 를 그대로 응답에 싣도록 이번 PR 에서 갱신됐다(§본문 참고). 그런데 같은 `dispatchTest` 결과를 쓰는 세 번째 소비자 `rotate()` 는 `test.message` 만 취하고 `test.code` 는 버려 항상 `INTEGRATION_TEST_FAILED` 하나로 응답한다 — 같은 실패 원인(SSRF 차단·인증 거부·서버 오류·타임아웃)에 대해 엔드포인트마다 클라이언트가 분기할 수 있는 세분성이 다르다. `integrations.service.spec.ts` 의 rotate 테스트가 이 뭉개짐을 그대로 단언하고 있어(`toMatchObject({ response: { code: 'INTEGRATION_TEST_FAILED', message: ... } })`) 의도된 동작으로 보이지만, 이번 PR 로 Database/HTTP 까지 실제 실패가 흔해지면서 그 격차가 처음으로 실질적인 영향을 갖게 됐다.
  - 제안: 의도된 설계라면 `code` 를 왜 preview-test/`:id/test` 에는 노출하고 rotate 에는 숨기는지 스펙/DTO 주석에 한 줄 남길 것. 세분화가 필요하면 `rotate()` 도 `test.code` 를 실어 응답 형식을 세 엔드포인트 간 일관되게 맞출 것.

- **[INFO]** `POST /api/integrations/preview-test` 는 이번 PR 로 실제 outbound Database/HTTP 접속을 트리거하지만 워크스페이스/역할 인가가 없다 (pre-existing, 신규 아님)
  - 위치: `codebase/backend/src/modules/integrations/integrations.controller.ts` — `previewTest(@Body() body: PreviewTestDto)` (`@WorkspaceId()`/`@Roles` 미사용, 다른 엔드포인트와 대비됨)
  - 상세: `git log -p` 로 확인한 결과 이 메서드 시그니처(워크스페이스 파라미터 없음)는 이번 PR 이전부터 동일하다 — 새로 만들어진 인가 공백은 아니다. 다만 이번 PR 이전에는 `preview-test` 로 실제 접속을 걸 수 있는 서비스가 MCP·Email 뿐이었고, 이제 Database·HTTP 도 추가돼 "인증된 아무 사용자나(워크스페이스 소속 무관) 분당 20회 한도로 임의 host 에 실제 연결을 시도시킬 수 있다" 는 표면이 넓어졌다. 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 결정 대기 항목으로 등재돼 있고(`review/code/2026/09/19/13_58_22` security WARNING), 이번 PR 이 새로 연 성질이 아니라고 명시돼 있다 — 재차 차단 사유로 flag 하지 않는다.
  - 제안: 별도 조치 불요 — 이미 추적 중인 백로그 항목(위 파일)의 처리를 기다린다.

- **[INFO]** `PreviewTestResultDto`/`TestConnectionResultDto.code` 는 유한 집합(`DB_HOST_BLOCKED`·`DB_AUTH_FAILED`·`DB_CONNECT_FAILED`·`HTTP_BLOCKED`·`HTTP_AUTH_FAILED`·`HTTP_SERVER_ERROR`·`HTTP_CONNECT_FAILED`·`MCP_*`·`EMAIL_*` 등)인데 Swagger 스키마는 여전히 `@ApiPropertyOptional()` 무제약 `string` 이다
  - 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts` — `PreviewTestResultDto.code` / `TestConnectionResultDto.code`
  - 상세: JSDoc 주석으로만 값 목록을 나열하고 OpenAPI `enum` 은 선언하지 않는다. 이번 PR 이 새로 만든 패턴은 아니고(`MCP_*`/`EMAIL_*` 때부터 동일), 클라이언트 코드생성(typed SDK) 을 쓴다면 이 필드만 항상 `string` 으로 좁혀지지 않는다.
  - 제안: 우선순위 낮음 — 기존 컨벤션을 그대로 따랐으므로 이번 PR 단독으로 고칠 필요는 없다. 추후 API 응답 스키마 강화 작업에서 함께 처리 권장.

- **[INFO]** HTTP 연결 테스트는 401/403 이외 4xx 를 `success: true` 로 분류한다 — `success` 불리언만 보는 클라이언트는 "자격증명 확인 못 함" 상태를 구분할 수 없다
  - 위치: `codebase/backend/src/modules/integrations/http-connection-tester.ts:74-79`(`classify()` 의 `status >= 400` 분기)
  - 상세: spec §5.3 에 의도된 설계이고 안내 메시지도 함께 실린다. 다만 응답에 `code` 가 없어(성공 응답은 `code` 미포함 컨벤션) 화면·API 소비자가 "완전 성공"과 "닿았지만 미확인"을 문자열 비교 없이 구분할 방법이 없다 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 "연결 테스트의 «확인 못 함» 안내가 화면에 닿지 않는다" 로 planner UX 결정 대기 항목으로 등재돼 있다.
  - 제안: 별도 조치 불요 — 추적 중인 항목.

- **[INFO]** 하위 호환성 — 기존에 저장된 Database·HTTP 통합 중 실제로는 틀린 자격증명이었던 것들이 배포 후 `Test connection`/`Rotate credentials` 에서 새로 실패하기 시작한다 (의도된 breaking behavior change)
  - 위치: `CHANGELOG.md` "배포 뒤 보일 수 있는 것" 절, `codebase/backend/src/modules/integrations/database-connection-tester.ts`, `http-connection-tester.ts`
  - 상세: 이는 버그 수정이 목적이므로 결함이 아니라 확인 사항이다 — CHANGELOG 와 두 언어 사용자 가이드(`integration-management.mdx`/`.en.mdx`)에 영향과 회피책(`ALLOW_PRIVATE_HOST_TARGETS`)이 이미 명시돼 있어 계약 변경 고지 요건은 충족된다.
  - 제안: 조치 불요 — 고지 확인만.

## 요약

이번 변경은 `POST /integrations/preview-test`·`POST /integrations/:id/test`·`POST /integrations/:id/rotate` 세 엔드포인트가 공유하는 `dispatchTest` 에 Database·HTTP transport tester 를 추가하고, `PreviewTestResultDto.code` 미선언이라는 기존 계약 결함을 해소했다(신규 필드는 `assertMatchesContract` 로 실측 검증됨). 요청 검증(`validateCredentials` 의 enum/필수 필드 검사)·에러 코드 네임스페이스(`DB_*`/`HTTP_*` vs 노드 런타임 코드의 충돌 가능성)는 이미 별도 consistency-check 라운드에서 심사돼 WARNING 으로 트래커에 반영돼 있다. 이번 라운드에서 새로 포착한 것은 `rotate()` 가 같은 `dispatchTest` 결과의 `code` 를 preview-test/`:id/test` 와 달리 버리고 항상 `INTEGRATION_TEST_FAILED` 로 응답한다는 점(사전부터 있었지만 이번 PR 로 실질 영향 확대) 정도이며, 그 외 인가 공백·상태 코드 400/422 불일치·성공-但-미확인 상태 노출 부재는 모두 이미 plan 백로그에 planner 결정 대기 항목으로 명시적으로 등재돼 있어 이번 코드 리뷰에서 새로 차단할 사유는 아니다. 전반적으로 API 응답 형식·요청 검증·URL 설계는 기존 컨벤션과 일관되게 확장됐다.

## 위험도

LOW
