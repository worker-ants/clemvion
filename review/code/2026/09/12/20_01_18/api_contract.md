# API 계약(API Contract) 리뷰

## 발견사항

- **[INFO]** `rotateBotToken` 의 `:id` 경로 파라미터에 `ParseUUIDPipe` 를 추가해 관측 가능한 응답이 바뀐다 (500 → 400)
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:291` (`@Param('id', ParseUUIDPipe) triggerId: string`)
  - 상세: 종전에는 `:id` 가 UUID 형식이 아니어도 그대로 서비스 레이어까지 흘러 Postgres 가 `SQLSTATE 22P02` 로 거부했고, `GlobalExceptionFilter` 에 그 분기가 없어 500 `INTERNAL_ERROR` 로 마스킹됐다. 이번 변경으로 400 `VALIDATION_ERROR` 로 즉시 차단된다. `GlobalExceptionFilter`(`codebase/backend/src/common/filters/http-exception.filter.ts`) 코드를 직접 확인해 `ParseUUIDPipe` 가 던지는 `BadRequestException`(응답 객체에 `code` 없음)이 `getCodeFromStatus(400)` 경로로 `VALIDATION_ERROR` 에 정확히 매핑됨을 검증했다 — 새로 추가된 `@ApiBadRequestResponse` 문서 문구(`VALIDATION_ERROR (:id 가 UUID 형식이 아님 — ParseUUIDPipe)`)와 실제 런타임이 일치한다. 이는 버그 수정이며 정상 UUID 를 보내는 기존 클라이언트에는 영향이 없으나, 비-UUID `:id` 를 보내던 (오작동) 클라이언트 관점에서는 HTTP 상태 코드가 바뀌는 **관측 가능한 breaking change** 다.
  - 제안: 의도된 수정이므로 추가 조치 불필요. 다만 사내/외부 API 변경 로그(CHANGELOG)에 상태 코드 변경을 기록해 두면 좋다. `switchWorkspace`(`auth.controller.ts`)는 이미 `ParseUUIDPipe` 를 갖고 있었으므로 이번 diff 는 `@ApiParam({format:'uuid'})` 문서 축만 추가한 것이라 대비된다.

- **[INFO]** 반환 타입을 `Awaited<ReturnType<...>>` 대신 명시적 DTO(`ChatChannelRotateBotTokenDto`)로 선언 — 계약-구현 drift 방지
  - 위치: `codebase/backend/src/modules/triggers/triggers.controller.ts:298` (`): Promise<ChatChannelRotateBotTokenDto>`)
  - 상세: 서비스 반환 타입에 구조적으로 결합돼 있던 반환 타입 선언을 명시적 DTO 로 바꿔, 서비스 쪽 반환 형태가 바뀌어도 `tsc` 가 이 지점에서 잡아낸다. 응답 스키마-구현 일관성을 강화하는 긍정적 변경이며 위험 없음.

- **[INFO]** 유저 가이드(MDX) 4곳의 rotate-bot-token 404 에러 코드가 실제 코드(`RESOURCE_NOT_FOUND`)와 다른 `TRIGGER_NOT_FOUND` 로 적혀 있던 4개월 선재 결함을 정정
  - 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` / `triggers.en.mdx` / `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` / `telegram.en.mdx` (각 diff 게이트 참조)
  - 상세: `triggers.controller.ts` 의 `@ApiNotFoundResponse({ description: 'RESOURCE_NOT_FOUND — trigger 미존재 또는 워크스페이스 권한 없음' })` 이 실제 계약이고, `TRIGGER_NOT_FOUND` 는 별도 진입 경로(`hooks.service.ts` 의 인입 webhook)에서만 쓰이는 코드임을 코드에서 확인했다. 문서를 실제 계약에 맞게 정정한 것으로 API 계약 관점에서 올바른 방향의 수정이다.
  - 제안: 없음(이미 해소).

- **[INFO]** `backend-labels.ts` / `backend-labels.test.ts` 의 `TRIGGER_NOT_FOUND` 관련 주석 정정 — 매핑 로직 자체는 무변경
  - 위치: `codebase/frontend/src/lib/i18n/backend-labels.ts` (`ERROR_KO` 블록, `TRIGGER_NOT_FOUND` 항목 주변) / `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` (`LOCALIZED_ERROR_CODES` 블록)
  - 상세: 두 파일 모두 실제 key-value 매핑(`ERROR_KO.TRIGGER_NOT_FOUND` 값, `LOCALIZED_ERROR_CODES` 배열 원소)은 그대로이고 **어느 코드 계열(webhook 인입 vs chat-channel API)에 속하는지 설명하는 주석**만 정정됐다. API 계약 자체에는 영향 없음.

- **[INFO]** 신규 repo-guard(`param-uuid-pipe-guard.ts` + `param-uuid-pipe.spec.ts` + fixture)로 "id-형 경로 파라미터 = `ParseUUIDPipe` + `@ApiParam({format:'uuid'})`" 두 축을 전수(AST 기반) 강제
  - 위치: `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts`, `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts`, `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts`
  - 상세: `spec/conventions/swagger.md §5-4` 를 정적 분석으로 상시 강제하는 좋은 관행이다. 직접 `grep -rnE "@Param\('[a-zA-Z]*[Ii]d'\)" --include="*.controller.ts"` 로 `modules/` 전체를 훑어 `ParseUUIDPipe` 없이 id-형 파라미터를 받는 자리가 현재 0건임을 확인했다(가드의 "베이스라인 0" 주장과 일치). `@ApiExcludeEndpoint()` 핸들러는 문서 축만 면제하고 런타임 축(파이프)은 그대로 요구하는 설계도 적절하다. `isIdShaped`(이름이 `id` 이거나 `/Id$/` 매치) 술어에 허용목록을 두지 않은 설계는 향후 `externalId` 류 비-UUID id-형 파라미터가 생기면 사람이 개입하도록 강제하는데, 이는 API 계약 리뷰 관점에서 바람직한 fail-loud 설계다.
  - 제안: 없음 — 실제 프로덕션 컨트롤러 코드는 변경 대상이 아니므로(가드/테스트/fixture 뿐) 이 항목 자체는 계약 변경이 아니다.

- **[INFO]** `mcp-servers.mdx` / `mcp-servers.en.mdx` 의 환경변수 오기 정정(`MCP_INSECURE_URL_ALLOWED` → `MCP_ALLOW_INSECURE_URL`)
  - 위치: `codebase/frontend/src/content/docs/06-integrations-and-config/mcp-servers.mdx:39`, `mcp-servers.en.mdx:28`
  - 상세: API 엔드포인트·요청/응답 스키마와 무관한 서버 환경변수명 오기 정정. API 계약에 영향 없음.

## 요약

이번 변경은 신규 엔드포인트나 스키마 변경이 아니라, 기존 계약을 **정확하게 만드는** 성격의 diff다. 핵심은 `rotateBotToken` 의 `:id` 파라미터에 `ParseUUIDPipe` 를 추가해 비-UUID 입력이 500(마스킹)에서 400 `VALIDATION_ERROR` 로 정정된 것인데, `GlobalExceptionFilter` 코드를 직접 확인해 문서화된 에러 코드와 실제 런타임 매핑이 정확히 일치함을 검증했다. 나머지는 (1) 유저 가이드 MDX 의 stale 에러 코드 정정, (2) i18n 매핑 파일의 주석(귀속) 정정, (3) UUID 경로 파라미터 계약(런타임 파이프 + OpenAPI `format:'uuid'` 문서화)을 전수로 강제하는 신규 정적 가드 추가로 구성되며, 모두 API 계약을 실제와 더 가깝게 맞추는 방향이다. 인증/인가·페이지네이션·URL 설계·요청 바디 검증에는 변경이 없다. 유일하게 "하위 호환성" 관점에서 짚을 점은 `rotateBotToken` 의 HTTP 상태 코드가 (오작동 클라이언트 한정) 500→400 으로 바뀐다는 것인데, 이는 의도된 버그 수정이라 위험도를 낮게 본다.

## 위험도

LOW
