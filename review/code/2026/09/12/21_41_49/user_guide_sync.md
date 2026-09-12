# User Guide Sync 리뷰

## 점검 절차 요약

- SSOT 적재: `.claude/config/doc-sync-matrix.json` (`rows[]`, 21행) + `PROJECT.md` §변경 유형 → 갱신 위치 매핑 본문.
- 변경 파일 식별: `git diff --name-only 49318bf13 HEAD` (base = `origin/main` 과의 merge-base) — 17개 파일, prompt 목록과 일치 확인.
- 각 변경 파일을 매트릭스 trigger 에 대조하고, 매칭된 행의 target 경로가 같은 changeset 안에 실제로 갱신됐는지 diff 로 직접 확인(코드만 읽지 않고 `git diff` 로 실물 대조).

## 매칭된 trigger 와 처리 상태

| 매트릭스 행 | 매칭 근거 | 동반 갱신 대상 | 상태 |
|---|---|---|---|
| `backend-api-change` (`codebase/backend/src/**/*.controller.ts`) | `triggers.controller.ts`(`@Param('id', ParseUUIDPipe)` + `@ApiParam format:'uuid'` + `@ApiBadRequestResponse` 문면에 `VALIDATION_ERROR` 추가), `auth.controller.ts`(`@ApiParam format:'uuid'`) | swagger jsdoc + 관련 user-guide 페이지 | **충족** — 아래 상세 |
| (교차) 가이드 오기 정정 — 매트릭스에 별도 행은 없으나 `user-guide-evidence.md`/문서 정확성 관례상 동일 성격 | `mcp-servers.{mdx,en.mdx}` 의 `MCP_INSECURE_URL_ALLOWED`(존재하지 않는 이름) → `MCP_ALLOW_INSECURE_URL`(실재) | — | **충족** (아래 검증) |

### `backend-api-change` — swagger jsdoc + user-guide 동반 갱신 확인

`rotateBotToken` 이 이제 비-UUID `:id` 에 `400 VALIDATION_ERROR` 를 낸다(종전 500 마스킹). 이 행위 변경을 반영해야 하는 4개 안내 자리를 diff 로 직접 대조했다.

- `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` (line 463) / `triggers.en.mdx` (line 450) — Callout 문구가 `404 TRIGGER_NOT_FOUND`(코드베이스에 없는 오귀속)를 제거하고 `404 RESOURCE_NOT_FOUND` + `400 VALIDATION_ERROR` 를 추가했다. `triggers.controller.ts:280` 의 `'RESOURCE_NOT_FOUND — trigger 미존재 또는 워크스페이스 권한 없음'` 과 문구 일치 확인.
- `codebase/frontend/src/content/docs/06-integrations-and-config/telegram.mdx` (line 130) / `telegram.en.mdx` (line 117) — 동일하게 `400 VALIDATION_ERROR` / `404 RESOURCE_NOT_FOUND` 를 추가.
- 추가로 "이 코드들은 API 를 직접 호출할 때 보이는 값" 이라는 문장이 신설됐는데, 이를 실측으로 검증했다: `codebase/frontend/src/components/triggers/cards/chat-channel-card.tsx:394` 의 `rotateBotToken` 실패 핸들러가 서버 응답을 버리고 고정 문자열 `t("triggers.chatChannel.rotateBotTokenFailed")` 만 띄운다(en: `"Bot Token rotation failed"`, ko: `"Bot Token 회전에 실패했어요"` — `dict/{en,ko}/triggers.ts`). 신설 문구가 실제 UI 동작과 정확히 일치 — **거짓 안내 없음**.

### backend-labels.ts / backend-labels.test.ts — 주석 귀속 정정 (신규 코드 아님)

`ERROR_KO`(`backend-labels.ts:568`)와 `backend-labels.test.ts` 의 `TRIGGER_NOT_FOUND` 주석 귀속을 "chat-channel API 코드" → "hooks webhook 인입 경로 코드"로 정정했다. `TRIGGER_NOT_FOUND` 는 `codebase/backend/src/modules/hooks/hooks.service.ts:120` 가 유일한 발신처임을 grep 으로 확인 — 정정이 정확하다. 이 변경은 **신규 errorCode 발행이 아니라 기존 매핑의 주석 재귀속**이라 `new-warning-code`/`new-error-code` trigger 는 적용되지 않는다(코드·매핑 값 자체는 무변).

이 changeset 이 문서에 새로 노출한 `VALIDATION_ERROR`/`RESOURCE_NOT_FOUND` 두 코드에 대해 `ERROR_KO` 매핑 존재 여부도 확인했다 — **둘 다 매핑 없음**(영문 fallback 대상). 다만 이는 이 PR 이 만든 gap 이 아니다:
- 두 코드는 `GlobalExceptionFilter.getCodeFromStatus()` 가 **모든** 400/404 에 붙이는 범용 코드로, 각각 backend 42개·24개 파일에서 이미 광범위하게 발생하는 기존 코드다(신규 추가 아님).
- `ERROR_KO` 자체가 "`ErrorCode` enum 전체가 아니라 사용자 노출 빈도순 점진 확장"이라고 명시하며, `backend-labels.test.ts` 의 P3-C-2 가드도 수동 큐레이션된 목록만 강제한다(둘 다 그 목록 밖).
- 위에서 확인한 대로 `rotateBotToken` 실패는 애초에 코드를 화면에 렌더하지 않으므로(고정 문자열), "영문 코드가 사용자에게 노출된다"는 CRITICAL 조건(점검 관점 6) 자체가 이 경로에서 성립하지 않는다.
→ **CRITICAL 아님.** 신설 가이드 문구도 이 사실을 정확히 반영해 "화면에는 코드 대신 일반 실패 문구가 뜬다"고 스스로 좁혀 적었다.

### 회색지대 — auth.controller.ts (INFO)

`switchWorkspace` 에 `@ApiParam({ format: 'uuid' })` 한 줄만 추가됐다(`codebase/backend/src/modules/auth/**` 는 `auth-session-flow-change` 행의 glob 과 일치). 그러나 실제로는 OpenAPI 스키마 생성용 메타데이터 추가일 뿐 — 파라미터 검증 자체는 이미 `ParseUUIDPipe` 가 하고 있었고(코드 주석에도 명시), 인증·세션 동작은 무변이다. `07-workspace-and-team/` 페이지·e2e 갱신을 요구할 만한 "흐름 변경"으로 보기 어렵다 — **정보성으로만 기록**, 누락으로 분류하지 않음.

### 스코프 밖으로 확인된 항목 (참고, 발견사항 아님)

`spec/5-system/15-chat-channel.md §5.4` 표에 신규 `400 VALIDATION_ERROR` 행 부재, `spec/conventions/swagger.md §5-4` 체크리스트에 `ParseUUIDPipe` 항목 부재, `GlobalExceptionFilter` 의 22P02 미분류(파이프 밖 유입 경로 잔존) — 세 건 모두 이전 라운드(`20_26_58`, `21_20_01`) 리뷰가 이미 SPEC-DRIFT 로 지적했고, `plan/in-progress/spec-draft-nullable-notation-followups.md` (line 3168, 3198, 3213 부근)에 미체크 항목으로 등재돼 있음을 직접 확인했다. 이들은 `spec/**` 대상이라 본 리뷰어(frontend docs/i18n) 매트릭스의 target 범위 밖이며, `developer` 가 `spec/` 을 직접 쓸 수 없는 거버넌스상 project-planner 위임이 올바른 처분이다.

## 발견사항

없음.

## 요약

매트릭스 21행 중 `backend-api-change`(controller.ts glob, semantic) 1건이 매칭됐고, 그 target(swagger jsdoc + user-guide 페이지)이 이미 같은 changeset 안에서 4개 mdx 파일(`triggers.{mdx,en.mdx}`, `telegram.{mdx,en.mdx}`)에 정확히 반영돼 있음을 diff 로 직접 대조 확인했다. 별도로 `mcp-servers.{mdx,en.mdx}` 의 존재하지 않는 환경변수명 오기도 실재 이름(`MCP_ALLOW_INSECURE_URL`)으로 정정됐다. `backend-labels.ts`/`backend-labels.test.ts` 의 `TRIGGER_NOT_FOUND` 주석 재귀속은 신규 코드가 아니라 기존 매핑의 출처 정정이라 i18n parity·CRITICAL 조건에 해당하지 않으며, 이 changeset 이 새로 노출한 `VALIDATION_ERROR`/`RESOURCE_NOT_FOUND` 는 UI 가 애초에 코드를 렌더하지 않아(고정 문자열 fallback, 실측 확인) 영문 노출 위험이 없다. 신규 TSX UI 문자열·신규 노드·신규 섹션 디렉토리·표현식 언어 변경·실행/디버깅 흐름 변경에 해당하는 파일은 이 changeset 에 없다. 남은 spec 레벨 gap(§5.4 표·swagger 체크리스트·GlobalExceptionFilter 분류)은 본 리뷰어 스코프 밖이며 이미 별도 트래커에 등재돼 있음을 확인했다. 누락된 유저 가이드 동반 갱신 없음.

## 위험도

NONE
