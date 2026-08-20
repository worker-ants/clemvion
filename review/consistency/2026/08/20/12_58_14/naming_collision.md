# 신규 식별자 충돌 검토 — `spec/5-system/` (eia-inputdata-marker-guard, --impl-prep)

## 대상 범위 확정
`main...HEAD` 실제 diff 는 `spec/5-system/{6-websocket-protocol,12-webhook,13-replay-rerun,
14-external-interaction-api,2-api-convention}.md` 와 미러 3곳(`spec/1-data-model.md`,
`spec/3-workflow-editor/3-execution.md`, `spec/4-nodes/1-logic/12-background.md`)이다.
내용은 `Execution.inputData` egress 마스킹 카브아웃을 프런트 "마커 가드" 도입으로
폐지하는 **서술 전환**이며, 신규 requirement ID·엔티티·endpoint·이벤트·env var 를
새로 만드는 변경은 아니다. 아래는 diff 가 도입/인용하는 식별자를 전수 점검한 결과다.

## 발견사항

### 새로 "보이는" 식별자였으나 실측 결과 기존 정의 재인용 — 충돌 없음

- **`AuthConfig.config.algorithm`** (`spec/5-system/14-external-interaction-api.md` §3.1
  EIA-NX-03, §Rationale R12): `spec/5-system/12-webhook.md` §2/§4.2 에 이미 정의된 필드를
  가리키도록 인용을 `hmacAlgorithm`(폐기된 trigger inline config) 에서 정정한 것. 신규
  식별자 아님.
- **`MCP_EXTRA_SECRET_PATTERNS`** (`spec/5-system/11-mcp-client.md` §8.3, §Rationale):
  `codebase/backend/src/modules/mcp/mcp-error-codes.ts:54` 에 이미 선언돼 있는 상수(빈
  배열 훅)를 spec 이 이제 명시적으로 이름 붙여 인용한 것. 코드·spec 이름이 일치하고
  충돌 없음.
- **`/api/external/{resource}` "인증 family 전용 네임스페이스" 예외 행**
  (`spec/5-system/2-api-convention.md` §2.2): 예시로 든 `/api/external/executions/:id`,
  `/api/external/executions/:id/interact` 는 `spec/5-system/14-external-interaction-api.md`
  §5.1~§5.3 에 이미 정의돼 있던 기존 endpoint다. 새 endpoint 도입이 아니라 §2.2 명명
  규칙 표에 "이미 존재하는 예외"를 사후 등재한 것. 기존 §2.2 의 다른 예외 행("RPC-style
  sub-channel action")과 라벨·패턴이 겹치지 않는다.
- **`x-auth-token`** (§R17 "token 계열 확장" 불릿): `spec/5-system/12-webhook.md` §5.3 의
  민감 헤더 blacklist(`sanitizeResponseHeaders`)에도 동일 문자열이 나오지만 의미가
  같다(자격증명 키 이름) — 서로 다른 두 마스킹 레이어(헤더 blacklist vs 값-패턴
  key-prefix)가 같은 개념을 같은 이름으로 부르는 것으로, 의미 충돌이 아니라 의도된
  일치.

### 파일 경로 — 충돌 없음, 다만 소유 spec 이 늘었다 (INFO)

- `codebase/frontend/src/components/executions/rerun-modal.tsx` 가
  `spec/5-system/13-replay-rerun.md` 의 `code:` 프런트매터에 신규 추가되고,
  `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 가
  `spec/5-system/14-external-interaction-api.md` 의 `code:` 에 신규 추가됐다. 두 파일
  모두 실재하고(worktree 확인됨), `rerun-modal.tsx` 는 이미 `13-replay-rerun.md`
  자신의 목록에 있었으므로 **자기 자신에 재등재**가 아니라 **다른 spec 문서에 추가
  등재**다. 이 저장소 컨벤션상 한 코드 파일이 여러 spec 의 `code:` 목록에 걸치는
  것은 기존에도 흔하다(`websocket.service.ts`, `sanitize-error-message.ts` 등 다수
  spec 이 공유). 경로 충돌은 없으나, `editor-toolbar.tsx` 가 이제 `13-replay-rerun.md`
  에는 없고 `14-external-interaction-api.md` 에만 있어 "히스토리 로드 마커 가드"
  구현 시 어느 spec 이 SoT 인지 헷갈릴 여지가 있다 — 필요하면 `13-replay-rerun.md`
  §10.2 인용부에도 `editor-toolbar.tsx` 를 함께 등재해 대칭을 맞추는 편이 낫다(INFO,
  차단 아님).

### 요구사항 ID / 이벤트명 / env var — 신규 도입 없음

- diff 전체를 스캔한 결과 `EIA-*`, `WH-*` 등 requirement ID 표는 **기존 행의 서술만
  수정**됐고 새 ID 행은 추가되지 않았다(`EIA-NX-03` 내용 수정, 내부 WS 명령 매핑
  표의 `execution.stop`/`execution.start` 행에 `_(WS 명령 §4.2 won't-do)_` 캡션만
  추가).
- webhook·SSE·notification 이벤트 이름 신규 도입 없음.
- ENV var·config key 신규 도입 없음(`EXECUTION_SEQ_TTL_SECONDS` 등은 diff 밖의 기존
  텍스트).

## 요약
diff 는 `Execution.inputData` 마스킹 카브아웃을 폐지하는 순수 서술 전환으로, 새로 만든
requirement ID·엔티티·endpoint·이벤트명·env var 가 없다. `AuthConfig.config.algorithm`,
`MCP_EXTRA_SECRET_PATTERNS`, `/api/external/*` 처럼 처음 보기엔 "새 식별자"로 읽히는
표현들은 실측 결과 모두 기존 코드/spec 정의를 정확히 재인용한 것이며 의미 충돌이 없다.
유일한 잔여 사항은 `editor-toolbar.tsx` 가 `14-external-interaction-api.md` 에만
등재되고 `13-replay-rerun.md` 에는 없어 SoT 소유가 비대칭이라는 점인데, 이는 충돌이
아니라 등재 누락 가능성에 대한 INFO 수준 제안이다.

## 위험도
NONE
