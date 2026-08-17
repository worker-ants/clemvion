# 정식 규약 준수 검토 — spec/5-system/ (EIA masking follow-ups, impl-done)

검토 대상: `spec/5-system/` (diff-base `origin/main`, HEAD `eia-masking-followups-3cd512`).
diff 범위: `spec/1-data-model.md` · `spec/5-system/{3-error-handling,6-websocket-protocol,12-webhook,
13-replay-rerun,14-external-interaction-api,15-chat-channel}.md` · `spec/conventions/node-output.md`
+ 대응 백엔드(`ExecutionsService`/`BackgroundRunsService`/`redact-stored-error.ts`/
`sanitize-error-message.ts`/DTO)·CHANGELOG·plan·유저 가이드.

`_prompts/convention_compliance.md` 는 컨텍스트 예산으로 target spec 본문·diff 자체가 절단돼 있어
(`spec/conventions/error-codes.md`·`execution-context.md`·`swagger.md` 등도 절단), 위 파일을 HEAD
워킹트리에서 직접 `Read`/`git diff origin/main...HEAD`로 재확인해 작성했다. 이 라운드는 직전
`review/consistency/2026/08/17/01_17_49/convention_compliance.md` 이후 landed 된 두 커밋
(`83436ed45` 재제출 카브아웃 레벨 정정, `09286d542` 레벨 구분 문서 5곳 전파 + DTO 선언)까지 포함해
재검증했다.

## 발견사항

- **[WARNING] Swagger DTO `description`/JSDoc 길이가 규약(10~40자)을 계속 크게 초과하며, 이 PR 최종
  커밋에서도 새 필드로 확대됨**
  - target 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    (`ExecutionDto.inputData`/`outputData` JSDoc 각 7~9줄, `NodeExecutionSummaryDto.inputData`
    JSDoc 13줄 — `09286d542` 신설, `NodeExecutionSummaryDto.output`/`error` JSDoc 각 4~7줄) ·
    `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
    (`BackgroundRunNodeExecutionDto.inputData`/`outputData` 의
    `@ApiPropertyOptional({ description: … })`, 각 200~400자)
  - 위반 규약: [`spec/conventions/swagger.md` §3 "주석/설명 톤"](spec/conventions/swagger.md)
    — "DTO `description`은 10~40자 내외"
  - 상세: `@nestjs/swagger` CLI 플러그인(`introspectComments: true`)이 이 JSDoc/description 을
    그대로 Swagger UI `description` 필드로 전환하므로, 정책 근거 전문이 실제 API 문서 화면에 그대로
    노출된다. 이 패턴은 이 PR 이 처음 만든 것은 아니다 — `workflow-test-dataset-response.dto.ts` ·
    `execution-status-response.dto.ts`(external-interaction) · `model-config-response.dto.ts` ·
    `webauthn-response.dto.ts` 등 저장소 전역에 이미 9개+ 응답 DTO 가 같은 형태의 다문단 JSDoc 을
    갖고 있어 규약 문서 §3 이 실제 관행보다 낡아 있다. 직전 검토 라운드(`01_17_49`)가 이미 이 항목을
    WARNING 으로 지적했는데, 그 이후 커밋(`83436ed45`·`09286d542`)은 규약과 관행의 괴리를 좁히는
    대신 오히려 새 필드(`NodeExecutionSummaryDto.inputData`, 13줄)를 같은 스타일로 추가해 괴리를
    더 키웠다 — `09286d542` 커밋 메시지 자체가 "런타임엔 늘 있었으나 스키마에 없던 선존 갭을 닫는다"
    고 밝히고 있어 의도된 선언이지만, 규약 §3 갱신은 이번에도 동반되지 않았다.
  - 제안: 다음 중 하나를 택일 — (a) `spec/conventions/swagger.md §3` 을 "보안/정책 민감 필드는
    요약 1문장 + spec 링크만 남기고 상세 근거는 spec 본문에 둔다"는 식으로 갱신해 이미 9곳 이상
    정착한 실제 관행을 규약화하거나, (b) 신규·수정된 필드(`inputData`/`outputData`/`error`
    5곳)의 `description`/JSDoc 을 1~2문장 요약 + `[EIA §R17]` 류 링크로 축약하고 상세 근거는 이미
    존재하는 spec 본문(§R17·13-replay-rerun §10.2·1-data-model §2.13/§2.14)에만 둔다. 신규 코드에
    규약을 그대로 적용하려면 (b), 관행을 추인하려면 (a) — 두 라운드 연속 미결이므로 이번 PR 내
    결정을 권장한다.

- **[INFO] WS 이벤트 카탈로그 표(§4.1)가 blockquote 로 중간 절단되는 기존 렌더링 결함이 이번 최종
  상태에서 25줄로 더 커짐 (정식 규약 위반은 아님)**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 "실행 이벤트" 표,
    `execution.node.cancelled` 행(현재 190번째 줄)과 `execution.waiting_for_input` 행(216번째 줄)
    사이 — 그 사이 191~215번째 줄이 전부 `>` blockquote.
  - 위반 규약: 없음 — `spec/conventions/**` 에 마크다운 표 서식을 규정하는 문서가 없다(점검 관점
    ③ "문서 구조 규약"이 다루는 Overview/본문/Rationale·`0-` prefix 류와 범주가 다르다). 정식 규약
    위반은 아니므로 참고용 등재.
  - 상세: GFM 표는 `|` 로 시작하지 않는 줄을 만나면 그 지점에서 끝난다. 이 결함은 origin/main 시점의
    1줄짜리 `> **Note (spec drift)**: …` 인용구에서 이미 존재했고(marked lexer 로 이전 라운드가
    실측), 최근 세 커밋(`1b8fd5cc7`→`39cb0bf1a`→`83436ed45`)이 값-패턴 마스킹·레벨 구분 설명을
    누적 삽입하며 23줄(`01_17_49` 시점)→25줄(현재)로 계속 자라고 있다. `execution.waiting_for_input`
    이하 행들이 표 토큰이 아니라 인용구 문단의 원문 텍스트로 흡수될 가능성이 높다 — 이 표는 EIA
    §R17·`1-data-model.md` 등이 "SoT: WS 이벤트 표"로 인용하는 카탈로그라 영향 범위가 좁지 않다.
  - 제안: blockquote 를 표 **완결 이후**(예: `execution.retry_last_turn` 행 뒤)로 옮기거나
    `### 4.1.1 값-패턴 마스킹` 하위 섹션으로 분리해 `payload` 열에서 각주로 링크한다.
    `13-replay-rerun.md §10.2` 는 이미 이 올바른 패턴(표 완결 후 blockquote)을 쓰고 있어 참고할 수
    있다. **이 PR 을 이 항목만으로 막을 근거는 없다** — 계속 자라는 추세만 기록해 둔다.

- **[INFO] 명명·상호참조·레벨 구분 표는 검증한 범위에서 모두 일관 (위반 아님)**
  - target 위치: `nodeName`→`nodeLabel` 정정(3-error-handling.md §2.2 · 6-websocket-protocol.md
    §4.1 표) · `Execution.inputData`(비마스킹)/`NodeExecution.inputData`(마스킹)/WS emit `input`
    (마스킹) 3분류 표(14-external-interaction-api.md §R17 잔여② · 6-websocket-protocol.md §4.1 ·
    13-replay-rerun.md §10.2 · 1-data-model.md §2.13/§2.14) · `redactStoredErrorForResponse`/
    `redactStoredDataForResponse`/`MASKED_INPUT_DATA_REASON`/`VALUE_MASK_MARKER`/`KEY_MASK_MARKER` 등
    구현 식별자.
  - 상세(확인 근거로 기록): `nodeLabel: node.label ?? node.type` emit 이 백엔드 전수이고 `nodeName`
    emit 0건임을 `grep` 으로 재확인. `redactStoredDataForResponse`/`MASKED_INPUT_DATA_REASON` 등
    DTO JSDoc 이 인용하는 식별자는 실제 소스(`executions.service.ts`·`redact-stored-error.ts`·
    `background-runs.service.ts`)에 그대로 존재한다. `[EIA §R17]`·`[WS §4.1]`·`[Re-run §10.2]`·
    `[12-webhook §5.3]`·`[node-output Principle 7]` 앵커는 전부 대상 문서에 실제로 존재
    (`### R17.`·`## Principle 7` 헤딩 확인). `83436ed45`/`09286d542` 가 정정한 "재제출 카브아웃은
    `Execution` 레벨 한정, `NodeExecution.inputData`/WS emit `input` 은 마스킹" 축은
    `1-data-model.md`(2곳)·`6-websocket-protocol.md`·`13-replay-rerun.md`·
    `14-external-interaction-api.md`·두 DTO 파일 전체에서 서로 모순 없이 동일하게 서술된다.
    `node-output.md` Principle 7 "절대 echo 금지" 뒤에 붙은 "egress 값-마스킹이 backstop" 캐비엇도
    "새 예외가 아니라 집행 계층"이라는 프레이밍이 원 규정과 정합한다.

## 요약

이번 diff(EIA/WS/webhook/Re-run 마스킹 후속, `01_17_49` 라운드 이후 2개 커밋 추가 반영)는
`spec/conventions/node-output.md` Principle 7 의 "절대 echo 금지"를 새 예외가 아니라 egress 방어
계층으로 정확히 위치시켰고, 재제출 카브아웃을 `Execution` 레벨로 좁힌 최종 정정이 5개 spec
문서(`1-data-model.md`×2·`6-websocket-protocol.md`·`13-replay-rerun.md`·
`14-external-interaction-api.md`)와 2개 DTO 파일 전체에서 상호 모순 없이 일관되게 반영됐다.
"정식 규약 직접 위반"에 해당하는 CRITICAL 은 발견되지 않았다. 유일한 실질 지적은
`spec/conventions/swagger.md §3` DTO description 길이 가이드(10~40자)와의 괴리이며, 이는 이 PR 이
새로 만든 패턴이 아니라 저장소 전역에 이미 퍼진 관행(9개+ 기존 DTO)을 두 라운드 연속 더 키운
것이라 규약 문서를 실제 관행에 맞춰 갱신하거나 신규 필드만이라도 요약+링크로 축약하는 결정이
필요하다(WARNING, 직전 라운드에서 이미 지적됐으나 미해결). WS 이벤트 표가 blockquote 로 중간
절단되는 렌더링 결함은 정식 규약 위반이 아니고 origin/main 부터 존재했던 것을 이 PR 이 누적
증폭(23→25줄)했을 뿐이라 INFO 로만 기록한다.

## 위험도

LOW
