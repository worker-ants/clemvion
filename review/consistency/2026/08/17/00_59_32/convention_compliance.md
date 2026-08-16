# 정식 규약 준수 검토 — spec/5-system/ (EIA masking followups, diff-base origin/main)

## 검토 범위 · 방법

- 대상: `spec/5-system/` 하위 diff 발생 5개 파일 —
  `3-error-handling.md`(nodeLabel 표기 정정) · `6-websocket-protocol.md`(nodeLabel 정정 +
  emit 값-패턴 마스킹 캐비엇) · `12-webhook.md`(inputData 마스킹 스코프 명시) ·
  `13-replay-rerun.md`(inputData egress 비대상 이유) · `14-external-interaction-api.md`
  (§R17 확장 — 종결 error 마스킹 표면 재열거 + WS emit 값-마스킹 신설 + ingestion/egress 공존 절).
- 정식 규약 대조: `spec/conventions/` 전체. 조립된 prompt 번들이 컨텍스트 예산 초과로
  `error-codes.md`·`node-output.md`·`swagger.md`·`execution-context.md`·
  `conversation-thread.md`·`interaction-type-registry.md` 등 핵심 규약 파일을 **본문 생략**
  처리했으므로(기존에 알려진 `--spec` 예산 갭), 이 파일들은 워크트리에서 **직접 Read** 해
  보완했다.
- impl-done 모드이므로 spec 이 언급하는 식별자(`redactStoredErrorForResponse` /
  `redactStoredDataForResponse` / `MASKED_INPUT_DATA_REASON` / `WIRE_PRESERVED_FIELDS` /
  `FANOUT_EVENTS` / `CREDENTIAL_KEY_PATTERN` / `executionEventSubject.next` 호출부 2곳 등)를
  HEAD 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/eia-masking-followups-3cd512`)
  의 실제 코드에서 `git grep`/`Read` 로 재확인했다 — 전부 실재하며 spec 서술과 일치했다.

## 발견사항

없음. CRITICAL/WARNING 급 정식 규약 위반을 발견하지 못했다.

검토한 5개 관점 요약:

1. **명명 규약** — `nodeName` → `nodeLabel` 정정은 `conversation-thread.md`(수십 곳에서
   `nodeLabel` 을 SoT 필드명으로 사용)와 실제 엔진 emit(`node.label ?? node.type`)에 맞춘
   교정이며 드리프트를 **줄이는** 방향이다. 새로 등장한 식별자
   (`redactStoredErrorForResponse`/`redactStoredDataForResponse`/`MASKED_INPUT_DATA_REASON`/
   `WIRE_PRESERVED_FIELDS`/`FANOUT_EVENTS`)는 camelCase 함수 / UPPER_SNAKE_CASE 상수로
   기존 관례와 일치하고, 전부 실제 코드(`codebase/backend/src/shared/utils/redact-stored-error.ts`,
   `.../modules/websocket/websocket.service.ts`,
   `.../modules/external-interaction/notification-fanout.service.ts`)에 존재를 확인했다.
2. **출력 포맷 규약** — 신설된 "egress 값-마스킹"은 `spec/5-system/2-api-convention.md §5.3`
   의 HTTP 에러 envelope 비echo 원칙과는 다른 레이어임을 diff 자신이 명시적으로 구분해
   두었다(`14-external-interaction-api.md` R17 "이 마스킹은 API 규약 §5.3 의 … 다른 레이어다"
   불릿). `node-output.md §3.2` 의 `output.error` 표준 형태(`code`/`message`/`details`,
   `UPPER_SNAKE_CASE` code)와 `§3.2.1` 의 `retryable`/`retryAfterSec` invariant 도 이번
   마스킹으로 깨지지 않는다 — `CREDENTIAL_KEY_PATTERN` 은 키 이름 완전 일치(`password`/
   `token`/`secret`/`authorization`/`cookie` 등) 앵커드 정규식이라 `retryable`/`retryAfterSec`
   같은 키는 매치되지 않음을 소스에서 확인했다.
3. **문서 구조 규약** — 신설 서술은 전부 기존 `## Rationale` 절(R17) 또는 관련 `## N. …`
   본문 절(§4 이벤트 목록 표 하단 캐비엇) 안에 붙었다. Overview/본문/Rationale 3섹션 골격을
   새로 흔들지 않았고, `_product-overview.md`/`0-` prefix 등 파일 명명 컨벤션도 무관(기존
   번호 파일 내부 편집만).
4. **API 문서 규약** — 이번 diff 로 JSDoc 이 보강된 `ExecutionDto.inputData`/`outputData`/
   `error`, `NodeExecutionSummaryDto.config` 는 `swagger.md §1-1`(필드별 한국어 JSDoc) 을
   따르고, `additionalProperties: true` 스키마 자체는 이 diff 이전부터 있던 것으로(§1-4 의
   "형태가 실제로 열려 있는 경우" 해당, 새 위반 아님) 변경되지 않았다.
5. **금지 항목** — `swagger.md §6` 레거시 패턴(빈 껍데기 wrapper, 페이징 불일치)과 무관.
   `error-codes.md` 의 명명 규율(신규 코드 신설 vs rename 금지, historical exception registry)
   과도 충돌 없음 — 이번 diff 는 에러 코드 자체를 rename/신설하지 않았다.

## 참고 (규약 위반은 아니나 검토 중 확인한 사항)

- `spec/conventions/chat-channel-adapter.md:552` 는 "spec 차원 redact 가이드는 모든 노드
  핸들러 audit 을 요구해 비현실적" 이라는 과거 판단을 근거로 Chat Channel 이 `error.message`
  를 그대로 넘기지 않고 분류(`key`) 기반 generic 문구를 쓴다고 설명한다. 이번에 신설된
  WS emit 값-마스킹은 핸들러별 audit 이 아니라 **단일 chokepoint 의 blind 정규식 패턴
  매칭**(`deepRedactSecrets`)이라 그 판단과 기술적으로 상충하지 않는다(적용 layer 가 다르고
  Chat Channel 은 애초에 raw `error.message` 를 소비하지 않는다). 다만 두 문서가 인접
  주제를 다른 접근으로 설명하므로, 차후 `chat-channel-adapter.md` 를 개정할 일이 있으면
  이 각주를 참고해 "이제는 wire 레벨 값-마스킹이 존재한다"는 최신 사실을 곁들이면 독자
  혼동을 줄일 수 있다 — INFO 수준 제안이며 현재 두 문서 중 어느 것도 규약 위반은 아니다.

## 요약

이번 PR 의 `spec/5-system/` diff(에러 표시 `nodeLabel` 정정 + `Execution.error`/
`outputData`/WS emit 값-패턴 마스킹 확장 + `inputData` 의도적 비대상 근거)는 정식 규약
관점에서 확인 가능한 5개 축(명명·출력 포맷·문서 구조·API 문서·금지 항목) 전부에서 위반이
발견되지 않았다. 특히 diff 자신이 이미 소스 실측(코드 grep, 호출부 개수 확인)을 거쳐 "4곳"
→ "여섯 표면·두 컬럼"으로 스스로 정정하는 등 과거 부정확 서술을 능동적으로 교정했고,
`node-output.md`/`api-convention.md`/`swagger.md`/`error-codes.md` 등 인접 정식 규약과의
레이어 경계(HTTP envelope vs 도메인 데이터 egress, ingestion-time vs egress-time)를
명시적으로 구분해 두어 규약 간 SoT 충돌 여지를 스스로 차단했다.

## 위험도

NONE
