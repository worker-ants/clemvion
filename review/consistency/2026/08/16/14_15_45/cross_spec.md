# Cross-Spec 일관성 검토 — spec-draft-eia-error-masking-catalog

## 검토 방법 메모

프롬프트 번들이 컨텍스트 예산 초과로 target 이 실제로 편집하는 파일
(`spec/5-system/14-external-interaction-api.md`)을 포함한 112개 spec 파일 본문을
생략했다. 이 파일이 정확히 target 이 R17/§6.4 를 수정하겠다는 그 파일이므로, 번들에
의존하지 않고 저장소의 실제 `spec/**`·`codebase/backend/src/**` 파일을 직접 `Read`/`grep` 해
검증했다 (R17 원문 §1371-1457, §6.4 원문 §770-806, §5.3 `getStatus` 원문 §437-493,
`interaction.service.ts` §326-465, `shared/utils/terminal-error-payload.ts` 전문).

## 발견사항

교차 검증 결과 target 이 §R17/§6.4 에 신설하겠다는 내용은 **기존 spec 과 직접 모순되는
지점이 없다**. 특히 target 이 스스로 지적한 "함정"(`nodeOutput.conversationConfig` 불릿의
`error` 와 `execution.failed` 의 `error` 가 다른 컬럼) 은 코드로 실증된다 —
`interaction.service.ts` `getStatus()` 의 `error` 필드는 `stripAndRedact(execution.outputData)`
(FAILED 시)이고, `execution.failed` emit 의 `error` 는 `toTerminalErrorPayload(execution.error)`
(DB `Execution.error` 원문 기반)다. 정확히 target 의 주장과 일치한다.

- **[INFO]** R17 "표면 제약(보안)" 절 preamble 과 신설 불릿의 주제 범위가 살짝 어긋난다
  - target 위치: 변경안 ①, R17 "5번째 불릿 신설" 삽입 지점
  - 충돌 대상: `spec/5-system/14-external-interaction-api.md` R17 "표면 제약(보안)" preamble
    (그 절 도입부: *"`getStatus`·SSE fanout 모두 `NodeExecution.outputData`(→`nodeOutput`)와
    `conversationThread` 를 동봉하므로 이들은 공개 EIA 표면으로 흘러간다"*)
  - 상세: preamble 은 이 절이 다루는 표면을 `outputData`/`conversationThread` 두 가지로 명시
    선언한다. 기존 불릿 1·3 은 이 범주에 정확히 들어맞고, 불릿 2(`execution.ai_message`)는
    "동일 AI 텍스트가 다른 emit 경로로도 나간다"는 연결고리로 확장되어 있다. target 이 신설하려는
    불릿은 `Execution.error`(DB 컬럼, AI 대화 텍스트와 무관한 엔진/노드 예외 메시지)를 다루므로
    preamble 이 선언한 두 표면 어느 쪽에도 속하지 않는 **세 번째 데이터 소스**다. 모순은 아니지만
    처음 읽는 사람은 preamble 범위 밖의 불릿이 왜 이 절에 있는지 그 자리에서 알기 어렵다.
  - 제안: target 의 Rationale 이 이미 이 이슈를 다뤘다("R17 의 마스킹 불릿들은 인벤토리다") —
    그 논리를 R17 preamble 문장 자체에도 한 문장 반영("이하 표는 `getStatus`/SSE 표면에 국한하지
    않고 EIA 가 외부로 노출하는 보안 마스킹 전수를 카탈로그한다" 류)하면 신설 불릿과 기존 4개
    불릿이 같은 절에 있는 이유가 preamble 만 읽어도 자명해진다. 선택 사항(다음 편집 라운드로
    미뤄도 무방) — BLOCK 사유는 아니다.

다른 관점(데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임)에서는 충돌을 찾지 못했다:

- **데이터 모델**: target 은 새 필드·엔티티를 정의하지 않는다. `spec/1-data-model.md` §2.14 의
  `Execution.error` 정의(`{nodeId, code, message, details}`, 최초 failed NodeExecution 복사)와
  target 의 "DB 원문 보존" 서술이 일치한다 — data-model.md 는 write-time 마스킹을 언급하지 않는다.
- **API 계약**: target 은 endpoint·요청/응답 shape 을 바꾸지 않는다(§6.4 필드 표는 그대로,
  `message`/`details` 의 *값*이 egress 시 치환될 수 있다는 캐비엇만 추가). `execution.failed` 의
  필드 집합("이 표가 전부다" — §6 도입부)은 변경 없음.
  `spec/conventions/chat-channel-adapter.md` §1.2 는 이미 `toTerminalErrorPayload`/"전 경로
  object" 서술을 갖고 있어 target 의 서술과 정합적이다.
- **요구사항 ID**: target 은 새 ID 를 발급하지 않는다(R17 에 이름 없는 5번째 불릿 추가, §6.4 는
  캐비엇 문단). 기존 R17/§6.4 ID 재사용에 충돌 없음. 다른 spec 파일 중 R17 을 순번(예:
  "3번째 불릿")으로 참조하는 곳은 없음(`2-api-convention.md`·`7-channel-web-chat/3-auth-session.md`·
  `5-system/11-mcp-client.md` 는 모두 R17 을 절 단위로만 참조) — 불릿 삽입이 기존 순번 참조를
  깨지 않는다.
- **상태 전이**: 대상 아님(마스킹은 상태 머신과 무관).
  `spec/5-system/6-websocket-protocol.md`(`execution.failed` 를 필드 집합 없이 "…필드 집합" 으로
  EIA §6 위임)와도 충돌 없음.
- **RBAC**: target 이 인용하는 `spec/2-navigation/14-execution-history.md` R-5(Config 탭 —
  "롤 게이팅이 아니라 서버 boundary masking parity 에 의존")는 인용 맥락이 정확하다 — 같은
  엔드포인트(`GET /api/executions/:id`)의 안전성 원칙을 일반화해 "내부라서 원문이어도 된다"를
  **결론으로 확정하지 않고** 미결로만 남기는 데 쓰인다. R-5 원문을 왜곡하거나 그 반대로
  뒤집어 인용하지 않았다.
- **계층 책임**: "egress 초크포인트에서만 마스킹, DB write 는 원문 보존" 이라는 책임 분리는
  R17 의 기존 4개 불릿(`conversationThread`→`redactThreadForPublic`, `ai_message`→emit-site
  마스킹, `nodeOutput.conversationConfig`→`stripAndRedact`)이 이미 쓰는 것과 **동일한 패턴**이다
  — 새 계층 책임을 발명하지 않고 기존 관례를 따른다.

## 요약

target 이 새로 쓰려는 §R17 5번째 불릿과 §6.4 캐비엇은 실제 코드(`interaction.service.ts`,
`terminal-error-payload.ts`, `sanitize-error-message.ts`)와 대조해 문장 단위로 검증했고, 인용하는
다른 spec 위치(`1-data-model.md` §2.14, `2-navigation/14-execution-history.md` R-5,
`conventions/chat-channel-adapter.md` §1.2, `5-system/6-websocket-protocol.md`)와도 모순되지
않는다. `getStatus` 의 `error`(outputData 기반)와 `execution.failed` 의 `error`(`Execution.error`
DB 기반)가 다른 값이라는 target 의 핵심 주장은 코드로 실증되어, 이전 라운드(`spec-sync-external-interaction-api-gaps.md`
가 "REST 와 대칭" 이라 잘못 썼던 것)의 재발을 정확히 막는다. 발견된 유일한 항목은 R17 절
preamble 의 주제 서술이 신설 불릿의 데이터 소스(AI 대화 텍스트가 아닌 엔진 에러 메시지)를
명시적으로 포괄하지 않는다는 편집상 INFO 뿐이며, target 자신의 Rationale 이 이미 그 근거
("R17 은 보안 불변식의 인벤토리")를 제시하고 있어 실질적 모순은 아니다.

## 위험도

NONE
