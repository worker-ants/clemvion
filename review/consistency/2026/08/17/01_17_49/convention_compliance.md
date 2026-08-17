# 정식 규약 준수 검토 — spec/5-system/ (EIA masking follow-ups)

검토 대상: `spec/5-system/` (diff-base `origin/main`, HEAD 워킹트리 `eia-masking-followups-3cd512`,
diff 범위 `spec/1-data-model.md` · `spec/5-system/{3-error-handling,6-websocket-protocol,12-webhook,
13-replay-rerun,14-external-interaction-api,15-chat-channel}.md` · `spec/conventions/node-output.md`
+ 대응 백엔드 마스킹 구현). `_prompts/convention_compliance.md` 는 컨텍스트 예산으로 target spec 본문과
diff 자체가 절단돼 있어, 위 파일들을 HEAD 워킹트리에서 직접 `Read`/`git diff` 로 재확인해 작성했다.

## 발견사항

- **[WARNING] Swagger DTO `description` 길이 규약과의 괴리가 이 PR 로 더 벌어짐**
  - target 위치: `codebase/backend/src/modules/executions/dto/responses/execution-response.dto.ts`
    (`inputData`/`outputData`/`error` JSDoc, 각 5~9줄) ·
    `codebase/backend/src/modules/executions/background-runs/dto/background-run-response.dto.ts`
    (`inputData`/`outputData` 의 `@ApiPropertyOptional({ description: … })`, 각 200~400자)
  - 위반 규약: [`spec/conventions/swagger.md` §3 "주석/설명 톤"](../../../../../spec/conventions/swagger.md)
    — "DTO `description`은 10~40자 내외"
  - 상세: 이번 PR 이 추가한 마스킹 정책 설명 JSDoc/description 은 규약이 명시한 10~40자를 5~10배
    초과하는 다문단 텍스트(볼드·백틱·링크 포함)다. `@nestjs/swagger` CLI 플러그인이 이 JSDoc 을 그대로
    Swagger UI 의 `description` 필드로 전환하므로, 실제 API 문서 화면에 정책 근거 전문이 그대로
    노출된다. 다만 이 패턴은 이 PR 이 처음 만든 것이 아니다 — 동일 저장소에 이미
    `workflow-test-dataset-response.dto.ts` · `execution-status-response.dto.ts`(external-interaction)
    · `model-config-response.dto.ts` · `webauthn-response.dto.ts` 등 최소 9개 응답 DTO 가 같은 형태의
    다문단 JSDoc 을 갖고 있어(PR 이전부터), 규약 문서(§3)가 실제 관행보다 낡아 있는 상태다. 이번 PR 은
    그 편차를 대표적으로 더 키운 사례다(신규 필드 4곳, 필드당 최대 9줄).
  - 제안: 다음 중 하나 — (a) `spec/conventions/swagger.md §3` 을 "보안/정책 민감 필드는 요약 1문장 +
    spec 링크만 남기고 상세 근거는 spec 본문에 둔다"는 식으로 갱신해 실제 관행을 규약화하거나,
    (b) 이번에 추가된 4개 필드의 `description`/JSDoc 을 1~2문장 요약 + `[EIA §R17]` 류 링크로
    축약하고 나머지 근거는 이미 존재하는 spec 본문(§R17·13-replay-rerun §10.2 등)에만 둔다. 신규
    코드에 규약을 적용하려면 (b), 관행을 추인하려면 (a) — 택일 필요.

- **[INFO] WS 이벤트 카탈로그 표(§4.1)가 인용 블록으로 중간 절단되는 기존 결함을 이 PR 이 크게 증폭**
  - target 위치: `spec/5-system/6-websocket-protocol.md` §4.1 "실행 이벤트" 표,
    `execution.node.cancelled` 행과 `execution.waiting_for_input` 행 사이(현재 라인 191~213)
  - 위반 규약: 없음 — `spec/conventions/**` 에 마크다운 표 서식을 규정하는 문서는 없다(점검 관점
    ③ "문서 구조 규약"이 다루는 Overview/본문/Rationale·`0-` prefix 류와는 범주가 다름). 참고용으로
    범위 밖임을 명시하고 등재한다.
  - 상세: GFM 표는 `|` 로 시작하지 않는 줄을 만나면 그 지점에서 종료된다. 이 표는 이미
    **origin/main 시점부터** `> **Note (spec drift)**: …` 한 줄짜리 인용구가 `node.cancelled` 행과
    `waiting_for_input` 행 사이에 끼어 있어 표가 그 지점에서 끊겨 있었다(`marked` lexer 로 실측 —
    origin/main 버전도 `waiting_for_input` 행이 별도 테이블 토큰이 아니라 인용구 마지막 문단의 원문
    텍스트로 흡수됨을 확인). 이번 PR 은 그 1줄짜리 인용구를 **23줄짜리** 값-패턴 마스킹 설명
    블록으로 치환했다 — 결함의 존재 자체는 이 PR 책임이 아니지만, 흡수되는 표 내용(스웰로우되는
    프리텍스트 분량)이 크게 늘어 렌더링 시 `execution.waiting_for_input` 행이 파이프 문자 그대로
    (`| \`execution.waiting_for_input\` | {...} | ... |`) 인용구 문단 끝에 이어 붙어 나온다 — 표가 아니라
    코드처럼 안 보이는 평문 한 줄로 뭉개진다. 이 표는 여러 spec(EIA §R17, 1-data-model.md 등)이
    "SoT: WS 이벤트 표" 로 인용하는 카탈로그라 렌더링 손상의 영향 범위가 좁지 않다.
  - 제안: 인용 블록을 표 **완결 이후**(모든 이벤트 행이 끝난 지점, 예: `execution.retry_last_turn`
    행 뒤)로 옮기거나, `### 4.1.1 값-패턴 마스킹` 같은 하위 섹션으로 분리하고 표의 `payload` 열에서
    각주로 링크한다. `13-replay-rerun.md §10.2` 는 이미 이 패턴(표 완결 후 blockquote)을 올바르게
    쓰고 있어 참고 가능. **정식 규약 위반은 아니므로 이 PR 을 이 항목만으로 막을 근거는 없다** — 다른
    checker(cross_spec 등)나 별도 후속 정리로 넘겨도 무방.

- **[INFO] 명명·상호참조는 검증한 범위에서 모두 일관**
  - target 위치: `nodeName`→`nodeLabel` 정정(3-error-handling.md §2.2 · 6-websocket-protocol.md
    §4.1 표), `redactStoredErrorForResponse`/`redactStoredDataForResponse`/`MASKED_INPUT_DATA_REASON`/
    `WIRE_PRESERVED_FIELDS` 등 구현 식별자
  - 상세(위반 아님, 확인 근거로 기록): `nodeLabel: node.label ?? node.type` emit 이 백엔드 전수이고
    `nodeName` emit 은 0건임을 `grep` 으로 실측 확인 — spec 정정이 정확하다. `redactStoredDataForResponse`
    /`MASKED_INPUT_DATA_REASON` 등 DTO JSDoc 이 인용하는 식별자도 실제 소스(`executions.service.ts`
    · `redact-stored-error.ts` · `websocket.service.ts`)에 그대로 존재한다. `[EIA §R17]`
    · `[WS §4.1]` · `[Re-run §10.2]` · `[12-webhook §5.3]` · `[node-output Principle 7]` 등
    본 diff 가 신설/참조하는 앵커는 전부 대상 문서에 실제로 존재한다(앵커 텍스트 대조 완료).
    `node-output.md` §"절대 echo 금지" 뒤에 붙은 "egress 값-마스킹이 이 금지를 backstop 한다" 캐비엇도
    "새 예외가 아니라 집행 계층"이라는 프레이밍이 §1.1(config/output 직교)·Principle 7 원 규정과
    모순 없이 정합한다.

## 요약

이번 diff(EIA/WS/webhook/Re-run 마스킹 후속)는 `spec/conventions/node-output.md` Principle 7 의
"절대 echo 금지"를 새 예외로 두지 않고 egress 방어 계층으로 정확히 위치시켰고, 관련 spec 상호참조·
구현 식별자(`nodeLabel`, `redactStoredDataForResponse`, `MASKED_INPUT_DATA_REASON` 등)가 실제 코드와
전부 일치해 "정식 규약 직접 위반"에 해당하는 CRITICAL 은 발견되지 않았다. 유일하게 규약 문서와 어긋나는
지점은 `spec/conventions/swagger.md §3` 의 DTO description 길이 가이드(10~40자)이며, 이는 이 PR 이
새로 만든 패턴이 아니라 저장소 전역에 이미 퍼진 관행(9개+ 기존 DTO)을 이 PR 이 대표적으로 더 키운
것이라 규약 문서 쪽을 실제 관행에 맞춰 갱신하거나, 반대로 신규 필드만이라도 요약+링크로 축약하는 결정이
필요하다(WARNING). 그 외 WS 이벤트 표가 blockquote 로 중간 절단되는 렌더링 결함은 정식 규약 위반이
아니고 origin/main 부터 존재했던 것을 이 PR 이 증폭했을 뿐이라 INFO 로만 기록한다.

## 위험도

LOW
