# 신규 식별자 충돌 검토 — spec/5-system/14-external-interaction-api.md (impl-done)

## 검토 범위 요약

diff-base `origin/main` 대비 HEAD(워크트리 `llm-usage-doc-alignment-01d7a4`, 커밋 `073605027`/`407ad70eb` 등)의
변경은 **① 순수 casing 리네임**(`Webchat*` → `WebChat*` — `WebChatIdleReaperService` / `markWebChatIdleTimeout` /
`findIdleWebChatExecutionIds` / `resolveWebChatIdleReapGraceMs`)과 **② 내부 유틸/헬퍼 추출**
(`processInBatches`, `ExecutionEngineService.emitCancellationEvent` — 둘 다 spec 비노출 internal), 그리고
spec 4개 파일의 동일 casing 미러 갱신뿐이다. target spec(`14-external-interaction-api.md`)이 새 요구사항 ID 를
부여하지도 않았고, 신규 엔드포인트·이벤트명·ENV var 도 도입하지 않았다.

## 발견사항

검토 관점 1~6 전부에 대해 실제 워크트리(절대경로 `git -C .../llm-usage-doc-alignment-01d7a4 grep`)를 대조했으며,
**충돌·혼선 유발 항목 없음**을 확인했다.

- 요구사항 ID(EIA-RL-07, §R19, §3.4 등) — 신규 부여 없음. 기존 §7.5.1/§9.3 등 다른 ID 와 문자열 겹침 없음.
- 엔티티/타입/클래스명 — `WebChatIdleReaperService` 로 리네임된 것은 오히려 기존 컨벤션(`WebChatCorsOriginResolver`,
  `WebChatAppearanceDto`, `codebase/backend/src/common/cors/web-chat-cors.ts`, `web-chat-cors-origin.resolver.ts` 등)과의
  **casing outlier 를 해소**한 것이다. 리네임 후 코드베이스 전체에 구 casing(`Webchat[A-Z]`) 잔존 0건
  (`grep -rn "\bWebchat[A-Z]" codebase/backend/src spec/` → 결과 없음), spec 4개 파일도 100% 동기화됨
  (`spec/5-system/14-external-interaction-api.md` §3.4 표, `spec/7-channel-web-chat/1-widget-app.md`,
  `spec/7-channel-web-chat/3-auth-session.md`, `spec/data-flow/0-overview.md`, `spec/data-flow/15-external-interaction.md`
  전부 `WebChatIdleReaperService`/`markWebChatIdleTimeout` 으로 일치).
- API endpoint — 이번 diff 는 controller/route 변경 없음. 신규 endpoint 없음.
- 이벤트/메시지명 — `EXECUTION_CANCELLED` payload 구조(`cancelledBy`/`error`)는 기존 계약 그대로이며 `emitCancellationEvent`
  헬퍼는 4개 기존 호출부(`cancelParkedExecution`/`markExecutionCancelled`/`markQueueWaitTimeout`/`markWebChatIdleTimeout`)의
  중복 `try/emit/catch/warn` 을 내부로 접은 것뿐 — 새 이벤트 타입·payload 필드 도입 없음. `cancelledBy` 3값
  union(`'user'|'system'|'timeout'`)도 spec §6.5 규약 그대로 유지(확장 없음).
- 환경변수/설정키 — `WEBCHAT_IDLE_REAP_GRACE_MS`, `WEBCHAT_IDLE_TIMEOUT`(error.code), `WEBCHAT_IDLE_REAPER_QUEUE`,
  `WEBCHAT_IDLE_REAP_BATCH_LIMIT` 모두 기존 상수(리네임 대상 아님, 이미 uppercase 라 casing 이슈 자체가 없음).
  `POOL_IDLE_TIMEOUT_MS`/`DB_POOL_IDLE_TIMEOUT_MS`(DB 커넥션 풀, `database-query.handler.ts`/`database.config.ts`)와
  부분 문자열(`IDLE_TIMEOUT`)이 겹치지만 네임스페이스 prefix(`WEBCHAT_` vs `POOL_`/`DB_POOL_`)가 명확히 분리돼 있고
  도메인도 무관(DB connection idle vs execution idle-wait cancel)이라 실질 충돌 아님. 또한 spec 본문(§R19 Rationale,
  `14-external-interaction-api.md:1262`)은 `error.code` prefix 를 `CHANNEL_` 이 아닌 `WEBCHAT_` 으로 정한 이유를
  "[Chat Channel](./15-chat-channel.md) 모듈과의 네이밍 혼동 회피" 로 **이미 명시적으로 문서화**해 뒀다 — 이 검토
  관점(4/5)이 지적할 만한 충돌을 설계 단계에서 선제 차단한 사례.
- 파일 경로 — `codebase/backend/src/common/utils/process-in-batches.ts`(+ `.spec.ts`)는 신규 파일이나, 같은 디렉토리에
  기존에도 suffix 없는 유틸(`with-timeout.ts`, `timezone.ts`, `uuid.ts`, `cors-origins.ts`)이 병존해 컨벤션 파괴가
  아니다. 경로 자체의 기존 파일과의 충돌도 없음(`new file` diff 확인). `webchat-idle-reaper.*.ts` 파일명(하이픈 없는
  "webchat")은 이번 diff 로 변경된 게 아니라 이전 PR(#918)에서 이미 존재하던 경로 — target 범위 밖.

## 참고(비충돌, 정보용)

- `codebase/backend/src/common/utils/` 안에 `.util.ts` 접미(`crypto.util.ts`, `mask-sensitive-fields.util.ts`)와
  무접미(`with-timeout.ts`, `process-in-batches.ts`) 두 네이밍 패턴이 혼재하지만 기존에도 이미 혼재했던 패턴이라
  이번 diff 가 새로 유발한 비일관성이 아니다 (컨벤션 문서 `spec/conventions/` 에 이 계층 네이밍 규칙 SoT 없음).

## 요약

이번 변경은 spec 이 새 요구사항 ID·엔드포인트·이벤트·ENV var 를 하나도 도입하지 않는 순수 리팩터(casing 정규화
`Webchat*`→`WebChat*` + `processInBatches`/`emitCancellationEvent` 내부 유틸 추출)이며, 코드·spec 5개 파일 전체가
100% 동기화되어 있고 구 casing 잔존도 0건이다. `WEBCHAT_` prefix 와 DB pool 의 `*_IDLE_TIMEOUT_MS` 간 부분 문자열
중첩, `WEBCHAT_`/`CHANNEL_` 네이밍 분리 등 잠재 혼동 지점은 이미 spec Rationale 에서 의도적으로 회피 근거가
명시돼 있다. 신규 식별자 충돌 관점에서 문제 없음.

## 위험도

NONE
