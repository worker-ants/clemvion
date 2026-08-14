STATUS=success naming_collision review complete (impl-done, scope=spec/5-system/, diff-base=origin/main)
===REPORT_MARKDOWN_BELOW===
# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 확인

실제 diff (`git diff origin/main...HEAD -- spec/5-system/ spec/1-data-model.md`)는
아래 두 spec 파일 + 관련 코드에 한정된다 (target 문서 전체가 아니라 이 PR 이 실제로
건드린 부분):

- `spec/5-system/14-external-interaction-api.md` — §6.2 webhook 봉투를 §6.3/§6.4 와
  같은 `payload:{…}` wrap 구조로 정정, `error.code`/`nodeId` 에 `null` 허용 추가,
  `getStatus()` 세 출구(waiting/terminal result/terminal error) strip 강화 서술
- `spec/5-system/6-websocket-protocol.md` — `llmCalls` strip 범위를 "WS fanout 전용"에서
  "WS fanout + EIA REST `getStatus()`, 깊이 무관"으로 정정
- `spec/1-data-model.md` §2.14 — `Execution.error` 구조에 nullable `nodeId`/`code` 반영
- 코드: 신규 `codebase/backend/src/shared/utils/strip-external-only-fields.ts`
  (`stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS`), `interaction.service.ts` 신규
  private 함수 `stripAndRedact`, `websocket.service.ts` 는 기존 local
  `stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS` 를 삭제하고 위 공유 유틸 import 로 교체

## 발견사항

- **[INFO]** CHANGELOG 가 실제 함수명과 다른 이름을 인용
  - target 신규 식별자: `stripAndRedact` (`codebase/backend/src/modules/external-interaction/interaction.service.ts:98`) — `getStatus()` 의 세 출구(waiting/terminal result/terminal error)를 한 헬퍼로 묶은 신규 private 함수
  - 기존 사용처: `CHANGELOG.md` (본 PR 이 추가한 "Unreleased" 항목) — "REST 쪽 세 출구는 다시 한 헬퍼(`redactAndStrip`)로 묶었다" 로 서술
  - 상세: 실제 구현된 함수명은 `stripAndRedact` 다. `interaction.service.ts` 의 JSDoc 자체가 "초판은 `redactAndStrip` 이었는데 실제로는 strip 이 먼저라 이름이 순서를 거꾸로 읽히게 했다" 며 개명 이력을 명시하는데, 같은 PR 이 작성한 CHANGELOG 항목은 개명 전 이름을 그대로 남겼다. `redactAndStrip` 이라는 식별자는 코드베이스 어디에도 존재하지 않는다 (`git grep` 0건) — 다른 대상과 "충돌"은 아니지만, CHANGELOG 를 근거로 코드를 찾는 다음 작업자가 존재하지 않는 이름을 검색하게 된다.
  - 제안: `CHANGELOG.md` 의 `redactAndStrip` → `stripAndRedact` 로 정정 (1단어 치환, 이 세션에서 바로 고칠 수 있는 범위).

- **[INFO]** 새 `payload` 래퍼는 이름 재사용이지만 사전에 소유권이 분리돼 있어 충돌 아님
  - target 신규 식별자: EIA §6.2 webhook 예시의 최상위 `payload: { node, interaction, context }` 객체 (신설이 아니라 §6.3/§6.4 가 이미 쓰던 구조를 §6.2 에도 맞춘 정정)
  - 기존 사용처: 같은 문서 §6 도입부 "채널별 봉투" 절 (line ~582-596, 본 PR 변경 범위 밖) — "`payload` 봉투는 §5 REST 응답의 `data` 봉투와 별개 표면이다 — 이름만 비슷할 뿐" 이라고 이미 명시적으로 disambiguation 해 둔 상태. WS §2.1 의 논리 프레임 `{type,id,payload}` 의 `payload` 와도 별개.
  - 상세: 잠재적으로 "payload" 라는 이름이 REST 응답 `data` 래퍼, WS 논리 프레임 `payload` 필드, webhook 봉투 `payload` 래퍼 셋으로 겹쳐 보일 수 있으나, 문서가 사전에 세 표면을 명시적으로 구분해 두었고 이번 diff 는 §6.2 예시를 그 기존 규칙에 맞게 정정한 것뿐이라 새로 충돌을 만들지 않는다.
  - 제안: 조치 불필요 (참고 기록).

- **[INFO]** `interaction` 블록 URL 을 실재 엔드포인트 경로로 교체 — 충돌 아니라 드리프트 해소
  - target 신규 식별자: §6.2 `interaction.submitUrl`/`streamUrl`/`statusUrl`/`cancelUrl` 의 값이 `https://api.clemvion.ai/v1/executions/{id}/...` (가상 도메인 + `/v1/` 버전 세그먼트) 에서 `/api/external/executions/{id}/...` 로 교체됨
  - 기존 사용처: 같은 문서 §5.1~§5.4 가 이미 `POST/GET /api/external/executions/:executionId/...` 를 정본 엔드포인트로 정의 (`interaction.controller.ts`)
  - 상세: 신규 도입이 아니라 기존에 이미 정의돼 있던 실제 엔드포인트 경로와 표기를 일치시킨 정정. 충돌 없음 — 오히려 종전 §6.2 예시가 실재하지 않는 도메인·버전 세그먼트를 써서 실제 라우트와 어긋나 있던 것을 이번 diff 가 닫았다.
  - 제안: 조치 불필요.

- **[INFO]** `error.code === null` 확장이 chat-channel 의 기존 CCH-ERR-04 와 사전에 정합
  - target 신규 식별자: EIA §6.4 `error.code` 에 `null` 값 허용 추가, `1-data-model.md` §2.14 `Execution.error.code`/`nodeId` nullable 화
  - 기존 사용처: `spec/5-system/15-chat-channel.md` CCH-ERR-04 (본 PR 변경 범위 밖) — "분류 표에 없는 `error.code` (unknown) 또는 `error.code === null` 는 `executionFailedInternal` key 로 fallback" 을 이미 규정
  - 상세: chat-channel 쪽이 이미 `error.code === null` 케이스를 전제하고 있었으므로, 이번에 EIA/data-model 이 그 값을 실제로 낼 수 있다고 선언한 것은 새 의미 충돌이 아니라 두 문서 간 선(先)-후(後) 정합이 맞아떨어진 경우다.
  - 제안: 조치 불필요.

## 확인한 무충돌 항목 (근거 기록)

- `stripExternalOnlyFields` / `EXTERNAL_STRIPPED_FIELDS` (신규 공유 유틸 `shared/utils/strip-external-only-fields.ts`) — 동일 이름의 local 선언이 `websocket.service.ts` 에 있었으나 이번 diff 가 그 local 선언을 **삭제**하고 공유 유틸 import 로 교체했다. 삭제 후 `git grep` 기준 정의처는 신규 파일 1곳뿐 — 잔존 중복 없음.
- `stripAndRedact` (`interaction.service.ts` 신규 private 함수) — 모듈 스코프 함수이며 다른 곳에 동명 export/선언 없음.
- 새 파일 경로 `codebase/backend/src/shared/utils/strip-external-only-fields.ts` — 같은 디렉터리의 `sanitize-error-message.ts`/`bcrypt-format.ts`/`retry-after.ts` 와 동일한 kebab-case 컨벤션을 따름. 컨벤션 위반·경로 충돌 없음.
- REST endpoint/이벤트명/ENV var/config key — 이번 diff 는 신규 endpoint·신규 이벤트명·신규 ENV var 를 도입하지 않는다 (기존 `/api/external/executions/...` 4개 경로, 기존 `execution.waiting_for_input`/`execution.completed`/`execution.failed` 이벤트명을 그대로 재사용).
- `MAX_REDACT_DEPTH` — `interaction.service.ts` 가 새로 import 했으나 이는 `sanitize-error-message.ts` 에 이미 존재하던 상수(신규 아님)이고, `websocket.service.ts` 의 `MAX_SANITIZE_DEPTH` 와는 별개 이름·별개 값(둘 다 10이지만 동명 충돌 없음, 자매 관계로 spec/코드 양쪽에 이미 명시).

## 요약

이번 PR (spec/5-system/14-external-interaction-api.md, 6-websocket-protocol.md, spec/1-data-model.md §2.14 + 대응 코드)이 도입하는 신규 식별자는 `stripExternalOnlyFields`/`EXTERNAL_STRIPPED_FIELDS`(신규 공유 유틸로 이관), `stripAndRedact`(신규 private 함수) 정도이며 모두 기존 코드베이스에 동명 항목이 없어 실제 CRITICAL/WARNING 급 충돌은 발견되지 않았다. spec 쪽 변경(§6.2 `payload` 래퍼 도입, URL 경로 정정, `error.code`/`nodeId` null 허용)은 모두 신규 도입이 아니라 문서가 이미 다른 절에서 선언해 둔 규칙(채널별 봉투 구분, 실제 REST 엔드포인트, CCH-ERR-04 의 null 전제)과 뒤늦게 정합시킨 정정이라 충돌보다는 drift 해소에 가깝다. 유일한 기록 대상은 CHANGELOG.md 가 실제로 존재하지 않는 옛 함수명 `redactAndStrip` 을 인용하는 사소한 표기 불일치(INFO)뿐이다.

## 위험도

LOW
