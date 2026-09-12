# User Guide Sync Review — trigger-uuid-and-guide-codes

## 매트릭스 적재
`.claude/config/doc-sync-matrix.json` (rows 18개) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문을 SoT 로 사용. 변경 파일 목록은 `git diff --name-only main...HEAD` 로 확인 (working tree clean, 전부 커밋됨):

- `codebase/backend/src/modules/auth/auth.controller.ts`
- `codebase/backend/src/modules/triggers/triggers.controller.ts`
- `codebase/backend/src/repo-guards/__tests__/fixtures/param-uuid-pipe/sample.controller.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe-guard.ts` (신규)
- `codebase/backend/src/repo-guards/__tests__/param-uuid-pipe.spec.ts` (신규)
- `codebase/frontend/src/content/docs/02-nodes/{triggers,triggers.en}.mdx`
- `codebase/frontend/src/content/docs/06-integrations-and-config/{mcp-servers,mcp-servers.en,telegram,telegram.en}.mdx`
- `codebase/frontend/src/lib/i18n/backend-labels.ts` + `__tests__/backend-labels.test.ts`
- `plan/in-progress/{spec-draft-nullable-notation-followups,trigger-uuid-and-guide-error-codes}.md`

## 매칭 결과

### 1. `backend-api-change` (semantic, `*.controller.ts`) — 매칭, 동반 갱신 이행 확인
`triggers.controller.ts`: `rotateBotToken` 의 `:id` 에 `ParseUUIDPipe` 추가로 비-UUID 입력 시 500(마스킹) → 400 `VALIDATION_ERROR` 로 동작이 바뀜 + `@ApiParam({format:'uuid'})` 신설. matrix targets `(a) swagger jsdoc` `(b) 관련 user-guide 페이지` 둘 다 같은 변경 set 안에서 처리됨:
- swagger jsdoc: `@ApiBadRequestResponse` 문면에 `VALIDATION_ERROR (:id 가 UUID 형식이 아님 — ParseUUIDPipe)` 추가 (컨트롤러 자체, diff 확인).
- user-guide: `triggers.mdx`/`.en.mdx` Callout 이 `404 TRIGGER_NOT_FOUND`(코드베이스에 없는 코드, chat-channel API 오귀속)를 `404 RESOURCE_NOT_FOUND` 로 교정, `telegram.mdx`/`.en.mdx` 도 동일 교정. ko/en 양쪽 갱신 확인 — 누락 없음.
- 마이너 INFO: Callout/prose 의 에러 목록은 "etc." 로 끝나 신규 `VALIDATION_ERROR (malformed :id)` 케이스를 명시적으로 나열하지 않음. 다만 이 케이스는 API 직접 호출자가 잘못된 UUID 문자열을 typo 한 극단적 엣지케이스이고, 1차 대상 문서(swagger jsdoc)는 이미 명시적으로 갱신됨 — CRITICAL/WARNING 급 누락 아님, 참고용 INFO.

### 2. `auth-session-flow-change` (glob `codebase/backend/src/modules/auth/**`, match: semantic) — glob 매칭하지만 의미상 비매칭
`auth.controller.ts`의 변경은 `switchWorkspace` 의 기존 `@ApiParam({ name: 'id', description: '...(UUID)' })` 에 `format: 'uuid'` 한 줄을 추가한 것뿐 — 인증 로직·권한 검사·세션 흐름의 실질 변경이 전혀 없다(순수 OpenAPI 스키마 정밀화). matrix targets 인 `codebase/frontend/src/content/docs/07-workspace-and-team/` + e2e 보강은 **행위 변경이 있을 때만** 의미가 있는데 이 diff 는 행위를 바꾸지 않는다 (같은 `ParseUUIDPipe` 는 이미 있었고 400 여부는 그대로). 따라서 이 trigger 는 glob 상 매칭되지만 semantic 판단으로는 실질 매칭이 아니라고 결론 — 07-workspace-and-team 갱신 누락을 결함으로 등재하지 않음.

### 3. i18n / backend-labels 동반 갱신 (신규 warning/error code 매핑, i18n parity)
`backend-labels.ts`의 `ERROR_KO` 변경은 신규 코드 추가가 아니라 **기존 항목의 주석 귀속 정정**(`TRIGGER_NOT_FOUND` 를 chat-channel §5.4 블록에서 분리)과 `BOT_TOKEN_INVALID` 메시지 문구 교정(401/403 제거)이다. 이에 맞춰 `__tests__/backend-labels.test.ts` 의 `LOCALIZED_ERROR_CODES` 목록도 같은 커밋에서 `TRIGGER_NOT_FOUND` 를 이동 + 주석을 정정 — 코드/테스트 동반 갱신 확인, 값 목록 자체는 변경 없이 주석만 수정되어 회귀 없음. 신규 ErrorCode enum 값 추가는 이 diff 에 없음(`error-codes.ts` 미변경) → `new-error-code` 행 비매칭.

### 4. `integration-provider-change` semantic — `mcp-servers.mdx`/`.en.mdx`
환경변수 오기 `MCP_INSECURE_URL_ALLOWED` → 실재 `MCP_ALLOW_INSECURE_URL` 로 교정. ko/en 양쪽 동시 갱신 확인 — parity 문제 없음. 이 변경은 코드 트리거(provider 자체 신규/변경)가 아니라 문서 오기 교정이라 원래 matrix trigger 대상은 아니지만, 정확성 개선이므로 결함 아님.

### 5. i18n parity 전수 확인
이번 diff 에서 변경된 모든 MDX/i18n 파일 쌍(`triggers.mdx`↔`.en.mdx`, `telegram.mdx`↔`.en.mdx`, `mcp-servers.mdx`↔`.en.mdx`)에 대해 `git diff` 로 양쪽 모두 동일한 의미 변경이 반영됐음을 확인 — CRITICAL 급 parity 누락 없음. TSX 신규 문자열 변경은 이 diff 에 없음(dict/{ko,en} 파일 자체도 미변경, 그럴 필요 없는 diff).

### 6. `new-userguide-section-dir` / 노드 신규·schema 변경 / 표현식 언어 변경 / 실행·디버깅 흐름 변경 — 비매칭
- 신규 `codebase/frontend/src/content/docs/<NN>-<name>/` 디렉토리 생성 없음.
- `codebase/backend/src/nodes/**` 변경 없음 (노드 추가/schema 변경 트리거 없음).
- `codebase/packages/expression-engine/**` 변경 없음.
- 실행/디버그 엔진 변경 없음.

### 7. `param-uuid-pipe` 가드 3파일(신규) — harness 성격
`param-uuid-pipe-guard.ts` / `.spec.ts` / fixture `sample.controller.ts` 는 `.claude/**` 가 아니라 `codebase/backend/src/repo-guards/__tests__/**` 아래 있어 리뷰 게이트 스코프(`codebase/**`)에는 들지만, 이들은 **테스트/가드 코드**이지 유저 가이드 매트릭스의 어떤 trigger 대상(노드/통합/표현식/워크스페이스)도 아니다 — user-guide-sync 관점에서는 비매칭.

## 요약
매트릭스 18개 행 중 이번 diff 에 glob/semantic 으로 매칭된 행은 `backend-api-change`(매칭, 동반 갱신 완료 확인) 와 `auth-session-flow-change`(glob 매칭하나 semantic 판단상 실질 변경 없어 비적용) 2개. 매칭된 실질 trigger(`backend-api-change`)의 동반 갱신(swagger jsdoc + user-guide MDX, ko/en 양쪽)은 같은 변경 set 안에 모두 포함되어 있고, 부수적으로 발견된 기존 문서 오류(`TRIGGER_NOT_FOUND` chat-channel 오귀속 4곳 + `backend-labels.ts`/`.test.ts` 주석 2곳, `MCP_INSECURE_URL_ALLOWED` 환경변수 오기 2곳)까지 이번 배치에서 함께 교정되어 있다(`plan/in-progress/trigger-uuid-and-guide-error-codes.md` §B 체크리스트와 실제 diff 가 1:1 일치). CRITICAL/WARNING 급 동반 갱신 누락을 발견하지 못했다. 신규 `VALIDATION_ERROR(malformed :id)` 케이스가 user-guide 산문에 "etc." 로만 뭉뚱그려져 있는 점만 INFO 로 남긴다.

## 발견사항

- **[INFO]** `rotateBotToken` 신규 400 `VALIDATION_ERROR`(malformed `:id`) 가 user-guide 산문에 명시적으로 나열되지 않음
  - 변경 파일: `codebase/backend/src/modules/triggers/triggers.controller.ts` (`@Param('id', ParseUUIDPipe)` 추가)
  - 매트릭스 항목: `backend-api-change` — "API 노출 변경이 사용자 안내에 영향 → 관련 user-guide 페이지"
  - 누락(그레이존): `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.{mdx,en.mdx}` §6 "Errors: 400 BOT_TOKEN_INVALID, 404 RESOURCE_NOT_FOUND, 502 CHAT_CHANNEL_SETUP_FAILED, etc." — "etc." 뒤에 신규 케이스가 암묵적으로만 포함
  - 상세: swagger jsdoc(1차 대상, API 통합자용)은 이미 정확히 갱신됐고 이 케이스는 사용자가 UI 를 통해서는 도달할 수 없는(malformed UUID 를 손으로 API 호출) 극단적 엣지케이스라 실사용자 영향은 낮음. CRITICAL/WARNING 급은 아니라고 판단.
  - 제안: 후속 편집 시 "etc." 를 구체 코드 나열로 바꾸는 것을 고려(선택 사항, 이번 PR 을 막을 사유는 아님).

- **[INFO]** `auth-session-flow-change` glob 매칭, semantic 비적용 판정 근거 기록
  - 변경 파일: `codebase/backend/src/modules/auth/auth.controller.ts` (`switchWorkspace` `@ApiParam` 에 `format:'uuid'` 추가)
  - 매트릭스 항목: `auth-session-flow-change` — trigger glob `codebase/backend/src/modules/auth/**`, targets `codebase/frontend/src/content/docs/07-workspace-and-team/` + e2e
  - 판단: diff 는 OpenAPI 스키마 정밀화 한 줄뿐이고 인증·권한·세션 행위 변경이 없어(같은 `ParseUUIDPipe` 이미 존재, 400/403/200 분기 불변) 07-workspace-and-team 문서·e2e 갱신 의무가 실질적으로 발생하지 않는다고 판단. 결함으로 등재하지 않음 — 참고 기록.

## 위험도
LOW

(매칭된 실질 trigger 의 동반 갱신은 모두 이행되어 CRITICAL/WARNING 없음. "LOW" 는 트리거 매칭이 실제로 존재했고 그 판정에 판단 여지가 있었다는 점을 반영하며, "NONE"이 아닌 이유는 §1 의 "etc." 그레이존 케이스가 완전한 확신을 주지 않기 때문이다.)
