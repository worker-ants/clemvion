# 신규 식별자 충돌 검토 — spec/5-system/4-execution-engine.md (impl-done)

## 검토 방법

payload 의 diff(`origin/main...HEAD`, code_areas 관련 backend/frontend 변경)에서 신규 도입된 식별자를 추출하고, 각각을 아래 두 경로로 대조했다.

1. HEAD 워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/conversation-thread-secret-hardening-6477bb`) 전체 코드베이스 `grep` — 동일 이름의 기존 정의/중복 정의 여부
2. `spec/` 전체 — 동일 requirement ID·용어·에러코드가 이미 다른 의미로 정의돼 있는지 여부

대상 신규 식별자: `makeLocaleResolver`, `SURFACE_MISMATCH_DEFAULTS` / `resolveSurfaceMismatchMessage`, `MARKDOWN_V2_SPECIAL_CHARS` / `firstUnescapedMarkdownV2Special`(신규 파일 `chat-channel/shared/markdown-v2.ts`), `expectedNodeId` 파라미터(4개 continuation 메서드 + `resolveWaitingNodeExecutionId`), `TELEGRAM_RAW_SEND_HINT_KEYS` / `LanguageHintsRawSendValidator`(`ValidatorConstraint` name `languageHintsRawSend`) / `findFirstUnsafeRawSendHint`, `sendBestEffortNotice` / `sendSurfaceMismatchNotice`(HooksService), `languageHints.surfaceMismatch` 신규 config 키, 에러 메시지 포맷 `UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>`, e2e 신규 테스트 라벨 `G-2`.

## 발견사항

없음 — CRITICAL/WARNING 없음.

검증 상세 (모두 충돌 없음으로 확인):

- **`markdown-v2.ts` (신규 파일)**: `find codebase -iname "*markdown-v2*"` 결과 `src/modules/chat-channel/shared/markdown-v2.ts`(+`.spec.ts`, dist 빌드산출물)만 존재 — 다른 영역(frontend/channel-web-chat/packages)에 동명 파일·모듈 없음. `MARKDOWN_V2_SPECIAL_CHARS` 는 이 파일 1곳에만 정의되고 telegram renderer/DTO validator 양쪽이 import 하는 SoT 통합 리팩터(diff 주석에 명시)라 오히려 기존 중복 정의를 제거하는 방향.
- **`expectedNodeId`**: `ExecutionEngineService`(`continueExecution`/`continueButtonClick`/`continueAiConversation`/`endAiConversation`/`resolveWaitingNodeExecutionId`)와 `InteractionService.interact` 에서만 사용. 기존 코드베이스에 동명 파라미터가 다른 의미로 쓰인 곳 없음(grep 전수 확인).
- **`TELEGRAM_RAW_SEND_HINT_KEYS` / `sendBestEffortNotice` / `makeLocaleResolver`**: 각각 정의처 1곳 + 참조처만 존재, 중복 정의·의미 충돌 없음.
- **`LanguageHintsRawSendValidator`(`ValidatorConstraint({ name: 'languageHintsRawSend' })`)**: 코드베이스 전체 `ValidatorConstraint` 이름 목록(`isIpOrCidr` / `languageHintsPlaceholder` / `languageHintsRawSend`) 확인 — 3개 모두 고유. 기존 `LanguageHintsPlaceholderValidator` 와 이름·역할이 명확히 분리돼 있어 혼동 소지도 낮음.
- **`languageHints.surfaceMismatch` 신규 키**: `spec/5-system/15-chat-channel.md`(§4.1.1, 정의·default 문구·F-5 raw-send 등록 검증), `spec/4-nodes/7-trigger/providers/telegram.md`(§5.8), `spec/5-system/4-execution-engine.md`(§7.5.1), `spec/5-system/14-external-interaction-api.md` 에 이미 동일 의미로 spec 이 선행 반영돼 있고 구현이 그대로 정합 — 다른 의미의 기존 사용처 없음.
- **에러코드 재사용 확인**: 이번 변경은 `STATE_MISMATCH`/`INVALID_EXECUTION_STATE`(기존 코드) 를 nodeId 불일치 사유로 "확장"만 하고 새 에러코드를 별도로 만들지 않았다 — 신규 코드 네임스페이스 충돌 리스크 자체가 없음. 유일한 신규 문자열은 `UNSAFE_TELEGRAM_MARKDOWN:<field>:<char>` (validator `message`, DTO 필드 `code` 는 여전히 `VALIDATION_ERROR`) 이며 기존 `UNKNOWN_PLACEHOLDER` 패턴과 동형 설계로, 다른 곳에서 이 문자열이 이미 쓰인 바 없음.
- **요구사항 ID 재사용 확인**: 신규 코드/spec 이 참조하는 `CCH-ERR-04`, `CCH-CV-03`, `CCH-CV-05`, `§7.5.1` 은 모두 기존 정의를 그대로 재사용(의미 변경 없이 nodeId 불일치 케이스를 §7.5.1 표에 추가)한 것이지, 새 ID 를 발급하며 기존 ID 와 겹친 사례가 아니다. 이번 변경에서 새로 발급된 formal requirement ID(`CCH-*`/`ND-*`/`EIA-*` 패턴)는 없다.
- **`F-1`~`F-6`**: `plan/in-progress/eia-command-waiting-surface-guard.md` 파일 스코프의 작업 라벨이며 요구사항 ID 네임스페이스(CCH-*, EIA-* 등)와 별개 관례 — 다른 plan 문서의 자체 `F-*` 라벨과는 파일 경계로 격리되어 충돌 소지 없음(프로젝트 표준 관례).
- **e2e 테스트 라벨 `G-2`**: `external-interaction.e2e-spec.ts` 전수 확인 — 기존 `G`(라벨 없는 단일 케이스) 1건만 있고 `G-2` 는 신규 추가, 중복 없음.
- **API endpoint / 이벤트명 / ENV var**: 이번 diff 는 기존 `/api/external/executions/:id/interact`, WS `submit_message`/`click_button`/`end_conversation` 핸들러의 내부 시그니처만 확장했을 뿐 신규 endpoint·webhook/queue/SSE 이벤트명·환경변수를 도입하지 않았다.

## 요약

이번 target(`spec/5-system/4-execution-engine.md` §7.5.1 nodeId 불일치 검증 확장 및 연관 chat-channel `surfaceMismatch`/F-5 raw-send 검증 구현)이 도입한 신규 식별자(함수·상수·DTO 필드·validator·파라미터·파일 경로)를 전수 조사한 결과, 기존 코드베이스·spec 어디에도 동일 이름이 다른 의미로 이미 쓰이고 있는 사례가 없었다. 에러코드는 기존 `STATE_MISMATCH`/`INVALID_EXECUTION_STATE` 를 확장 재사용하는 방식을 택해 신규 코드 네임스페이스 충돌 리스크 자체를 구조적으로 회피했고, `markdown-v2.ts` 신규 공유 모듈도 기존 중복 정의를 제거하는 리팩터라 오히려 drift 위험을 줄이는 방향이다. `F-1~F-6`/`G-2` 등 라벨류도 스코프(플랜 파일·단일 e2e 파일) 안에서만 유일해 실질적 충돌이 없다.

## 위험도
NONE
