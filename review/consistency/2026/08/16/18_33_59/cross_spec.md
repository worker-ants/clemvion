# Cross-Spec 일관성 검토 — spec/5-system/ (impl-done)

## 검토 범위·방법

diff-base `origin/main` 대비 이번 PR 이 건드린 spec 파일: `spec/1-data-model.md`,
`spec/2-navigation/14-execution-history.md`, `spec/4-nodes/1-logic/12-background.md`,
`spec/5-system/14-external-interaction-api.md`(§R17), `spec/5-system/6-websocket-protocol.md`,
`spec/conventions/secret-store.md`. 주제는 "종결 `Execution.error`/`nodeExecutions[].error` 응답 egress
값-패턴 마스킹(`redactStoredErrorForResponse`/`toTerminalErrorPayload`) + `Trigger.config.interaction.triggerToken`
평문 보관 비대상 등재" 이며, 이미 여러 라운드(`/ai-review` 4라운드·`--spec`/`--impl-done` 다수)를 거쳐
수렴 중인 PR 이다. 본 검토는 diff 파일들 자체와, 그 파일들이 참조하는 인접 영역
(`3-workflow-editor/4-ai-assistant.md`, `4-execution-engine.md`, `2-api-convention.md`,
`3-error-handling.md`, `15-chat-channel.md`) 및 실제 워킹트리 코드(`executions.service.ts`,
`redact-stored-error.ts`, `terminal-error-payload.ts`, `explore-tools.service.ts`,
`chat-channel.dispatcher.ts`)를 절대경로로 대조했다.

## 발견사항

- **[WARNING]** EIA §R17 "잔여(범위 밖) ③" 이 workflow-assistant 노출 스코프를 "같은 두 컬럼" 으로 적어
  실제 코드가 마스킹하는 3개 필드(`inputData`/`outputData`/`error`) 를 정확히 반영하지 못한다 —
  같은 문서가 스스로 경고하는 "총칭이 아니라 열거" 원칙을 이 문장 자신이 어기고 있다
  - target 위치: `spec/5-system/14-external-interaction-api.md` §R17 "잔여(범위 밖)" ③
    (`"③ workflow-assistant LLM 도구(explore-tools.service.ts)는 같은 두 컬럼을 maskSensitiveFields(키 이름 기반)로만 내보내 자유 텍스트 안의 자격증명을 통과시킨다."`)
  - 충돌 대상: `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙"(약 L259)
    — *"`inputData` · `outputData` · `error` 필드는 서버가 `maskSensitiveFields` 공통 유틸을 재귀 적용해 반환한다"* (명시적으로 **3개 필드**, `error` 포함)
    + 실제 코드 `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:462-464`
      (`inputData`/`outputData`/`error` 3-필드, NodeExecution) 및 `:482-484` (동형 3-필드, Execution) —
      전부 `maskSensitiveFields`(키-이름 기반)만 적용, `deepRedactSecrets`(값-패턴) 미적용.
  - 상세: R17 바로 앞 문장은 "적용 범위는 총칭이 아니라 열거다 … 잔여가 가려진다 — 이 문서가
    반복해 겪은 실패 형태라 표면을 이름으로 못박는다" 라고 스스로 못박고 있는데, 바로 다음 ③번
    항목의 "같은 두 컬럼" 이 정확히 그 실패를 재현한다. "같은 두 컬럼" 이 (a) 직전 ②번의
    `inputData`/`outputData` 를 가리키는 것으로 읽으면 workflow-assistant 를 통한 **`error` 자체의
    유출**(이 PR 전체의 핵심 주제)이 열거에서 누락된 것처럼 보이고, (b) "이 절 전체가 다루는
    `Execution.error`+`NodeExecution.error` 두 컬럼" 을 가리키는 것으로 읽으면 같은 툴이
    `inputData`/`outputData` 도 동일하게 약하게 마스킹한다는 사실(②의 REST 갭과는 **별도의 노출
    표면**)이 묻힌다. 실제로 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 대응
    백로그 항목(L213 제목 "같은 두 컬럼" ↔ L214-216 본문·인용 라인이 `explore-tools.service.ts:464`·
    `:484`, 즉 `error` 필드 라인)도 같은 모호성을 그대로 물려받아 제목과 본문이 어긋난다. 두 문서
    (`14-external-interaction-api.md` ↔ `3-workflow-editor/4-ai-assistant.md`) 는 이 지점에서
    서로를 **참조조차 하지 않는다** — `4-ai-assistant.md` 어디에도 `R17`/EIA 언급이 없고, R17 도
    `4-ai-assistant.md` 링크 없이 코드 파일명만 인용한다. `4-ai-assistant.md` §259 는 이 3-필드
    동일 취급 마스킹을 **자체 spec 계약**으로 정의하고 있으므로("서버가 … 반환한다"), R17 이 이를
    "코드의 잔여 갭" 으로만 취급하고 그 계약의 SoT 문서를 인용하지 않으면, 두 문서 중 한쪽만 고치는
    drift(예: `4-ai-assistant.md` 마스킹 규칙을 바꾸는데 R17 잔여 서술을 안 건드림, 또는 그 반대)가
    재발할 위험이 이 PR 자신이 여러 차례 겪은 실패 패턴과 동형이다.
  - 제안: R17 ③ 을 "같은 두 컬럼" → "**`inputData`/`outputData`/`error` 세 필드**"(또는 정확한 수)로
    정정하고, `spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙" 을 SoT 로 직접 링크. 동시에
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` L213 항목 제목도 본문(라인
    464/484 = `error` 필드)과 일치하도록 정정. (`4-ai-assistant.md` §259 자체를 즉시 고칠 필요는
    없다 — 두 마스킹 함수 합성 시 접미 힌트가 깨지는 회귀가 이미 실측·보류돼 있으므로, 여기서는
    "서술의 정확성" 만 문제다.)

## 확인했으나 충돌 아님 (참고)

- `spec/1-data-model.md` §2.14 신규 "응답 마스킹" 행("두 필드 모두") ↔ EIA §R17 "내부 읽기 경로" 불릿:
  `Execution.error`/`NodeExecution.error` 양쪽 다 마스킹된다는 서술이 서로 일치하고, 코드
  (`executions.service.ts` L643/950/998, `redact-stored-error.ts`)도 동일하게 4개 반환 경로
  (`findById`/`toExecutionDto`/`getChain`→`toResponseExecution`/`stop`→`toResponseExecution`) 를
  통해 이를 확인.
- `spec/2-navigation/14-execution-history.md` R-5 위 신규 캐비엇("R-5 의 대상 범위") ↔ EIA §R17:
  "Config 탭 write-시점 마스킹" 과 "`error` egress 마스킹" 을 별개 정책으로 명확히 분리해 두 문서가
  서로 모순되지 않는다.
- `spec/4-nodes/1-logic/12-background.md` §8.2 `nodeExecutions.data` 신규 캐비엇 ↔ EIA §R17:
  `background-runs.service.ts` 가 동일 `redactStoredErrorForResponse` 를 재사용함을 코드로 확인 —
  "같은 관문" 서술이 정확하다.
- `spec/5-system/6-websocket-protocol.md` `execution.snapshot` 행의 마스킹 상속 서술 ↔ 같은 표의
  `execution.node.*` "emit 은 원문" 대비 서술: EIA §R17 "잔여 ①" 과 정확히 대칭 — 충돌 없음.
- `spec/conventions/secret-store.md` `Trigger.config.interaction.triggerToken` 평문 비대상 예외 ↔
  EIA §7.1 blockquote(`결정 2026-08-16` 상호 링크) ↔ §8.3 Token 규약: 세 문서가 같은 날짜·같은
  근거로 정합. `AuthConfig.config` 기존 예외와 근거를 재사용하지 않는다는 명시적 경고도 일관.
- `spec/5-system/15-chat-channel.md` CCH-ERR-02/04 의 "`error.message` 원문을 사용자 안내에 포함하지
  않는다" 정책(자격증명 audit 이 비현실적이라는 사유)과 새 값-패턴 egress 마스킹의 관계: 표면적으로
  겹쳐 보이지만 충돌 아님 — 새 마스킹은 자격증명 **패턴**만 겨냥(내부 호스트명·스택 조각 등은
  통과, R17 "잔여 갭(의도)" 자인)하므로 chat-channel 이 `error.message` 를 아예 미노출하는 더 넓은
  방어를 유지할 근거가 그대로 남는다. `chat-channel.dispatcher.ts` 의 `toTerminalErrorPayload` 재사용은
  `EiaFailedEvent.error` 내부 표현 정규화용이며, CCH-ERR-02 분류·사용자 안내 텍스트는 여전히
  `error.code`+`details.statusCode` 카탈로그만 사용해 `.message` 를 그대로 노출하지 않는다.
- `spec/2-api-convention.md` §5.3 HTTP 에러 envelope 비echo 원칙 ↔ EIA §R17 신규 egress 마스킹:
  R17 자신이 "다른 레이어다" 라고 명시적으로 구분해 self-consistent.

## 요약

diff 가 건드린 6개 spec 파일은 이미 여러 라운드의 `--spec`/`--impl-done`/`ai-review` 를 거치며
서로 및 코드와 대부분 잘 수렴돼 있다 — 데이터 모델(`Execution.error`↔`NodeExecution.error` 복사
관계·응답 마스킹), WS 스냅샷·background body 마스킹 상속, R-5 오독 방지 캐비엇, secret-store 의
`triggerToken` 예외 등재는 모두 실제 코드(`redactStoredErrorForResponse`·`toTerminalErrorPayload`
호출부)와 정확히 맞아떨어진다. 다만 EIA §R17 의 "잔여(범위 밖)" 열거 중 workflow-assistant
항목("같은 두 컬럼")이 실제로 그 도구가 마스킹하는 필드 수(3개: `inputData`/`outputData`/`error`,
`spec/3-workflow-editor/4-ai-assistant.md` §"마스킹 규칙" 및 `explore-tools.service.ts` 코드로 확인)와
어긋나거나 최소한 모호하며, 이 서술은 R17 자신이 명시한 "열거이지 총칭이 아니다" 원칙을 그 자리에서
위반한다 — 두 spec 문서가 서로를 링크하지 않는 것도 이 drift 를 조장한다. 그 외 새로 CRITICAL 급
데이터 모델/API 계약/요구사항 ID/상태 전이/RBAC/계층 책임 충돌은 발견하지 못했다.

## 위험도

LOW
