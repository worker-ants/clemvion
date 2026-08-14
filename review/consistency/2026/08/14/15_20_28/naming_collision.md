# 신규 식별자 충돌 검토 — spec-draft-eia-62-waiting-payload.md

## 검토 방법
target 문서가 실제 편집을 지시하는 대상 spec 3곳(`spec/5-system/14-external-interaction-api.md`
§6 도입부·§6.2·§6.4·§6.5·R17, `spec/5-system/6-websocket-protocol.md` §4.4·Rationale,
`spec/1-data-model.md` §2.13·§2.14)을 직접 읽고, target 이 새로 도입하는 식별자(용어·필드명·
헤딩 제목·인용)가 그 현재 본문과 충돌하는지 대조했다. 프롬프트 예산 초과로 생략된 spec 파일
중 이 draft 가 실제로 건드리는 3개 파일은 전량 직접 Read 했다.

## 발견사항

- **[WARNING]** WS §4.4 Rationale 제목 리네임이 같은 파일 안의 **인용 텍스트를 stale 하게 만든다**
  - target 신규 식별자: 항목 (7) — WS `## Rationale` 의 헤딩을 `### \`ai_message.llmCalls[]\` 외부
    수신자 strip (strip-only 결정)` 에서 `### \`llmCalls\` 필드 외부 수신자 strip (위치·이벤트
    무관)` 으로 리네임
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:519` — 같은 파일 §4.4 본문이 이 헤딩을
    **따옴표로 직접 인용**한다: `"설계 근거는 본 문서 ## Rationale 의 "`ai_message.llmCalls[]`
    외부 수신자 strip" 항목 참조."` (마크다운 앵커 링크가 아니라 리터럴 텍스트 인용)
  - 상세: 항목 (7)의 첫 불릿이 편집하려는 문장(`(strip 대상은 본 WS 이벤트 필드뿐이며, …)` →
    `"WS fanout + EIA REST getStatus() 양쪽"`)이 **바로 이 519행 안**에 있고, 그 뒤에 옛 제목을
    그대로 인용하는 문장이 붙어 있다. 헤딩만 바꾸고 이 인용을 놓치면, 존재하지 않는 제목을
    가리키는 죽은 참조가 남는다 — 이 draft 자신이 항목 (6)에서 이미 잡은 "인용 오귀속" 과
    **같은 결함 클래스**다. grep 결과 다른 파일에서 이 정확한 문자열을 따옴표로 재인용하는
    곳은 없었다(코드 쪽 참조는 `websocket.service.ts:448` 처럼 "WS §4.4 strip-only 결정" 요약
    표현만 써서 영향 없음) — 위험은 이 1곳에 국한.
  - 제안: 항목 (7) 실행 시 519행의 인용문도 새 제목(`"llmCalls" 필드 외부 수신자 strip`)으로
    같은 커밋에서 동시 정정. planner draft 본문에 "제목·본문을 넓힌다" 라고만 적혀 있어
    이 자기-인용 갱신이 암묵적으로만 포함돼 있다 — 명시 불릿으로 한 줄 추가할 것을 권고.

- **[INFO]** `turnDebug` 이름 충돌은 이 draft 의 실제 spec 편집 범위에 올바르게 미포함 — 확인 완료
  - target 신규 식별자: (해당 없음 — 이 draft 는 top-level `turnDebug` 를 spec 문장으로 만들지
    않는다)
  - 기존 사용처: `spec/5-system/6-websocket-protocol.md:449` 의 `nodeOutput.meta.turnDebug`(배열,
    WS §4.4 정본) vs 코드의 `turnDebug: { llmCalls, metadata }`(top-level object, 문서화 안 됨)
  - 상세: 항목 (1)이 §6.2 안쪽 JSON 재작성을 철회했으므로 이 draft 의 실제 spec 편집(§6 도입부
    strip 문장 추가 등)은 `llmCalls` 필드명만 언급하면 되고, 실제로 §6.5 의 기존 동형 문장
    (`14-external-interaction-api.md:754`)도 `turnDebug` 를 전혀 언급하지 않는다(순수히 `llmCalls`
    필드만 지칭). 항목 (7)이 지시하는 §6.2 신규 strip 문장도 같은 패턴을 따를 것이므로
    `turnDebug` 명칭 충돌이 이 draft 로 인해 spec 에 고착될 경로는 없다 — draft 자신의 판단이
    맞다는 것을 실측으로 확인.
  - 제안: 없음(확인용 기록). 별건 처리는 이미 draft 하단 체크리스트에 있다.

- **[INFO]** `error.code`/`nodeId` 부재-`null` 통일, `Execution.error.details?` 추가는 기존
  네이밍과 정합 — 충돌 없음
  - target 신규 식별자: `1-data-model.md` §2.14 "구조" 행에 `code: "ERROR_CODE"|null`,
    `details?` 추가
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:737` (§6.4 페이로드) 은 이미
    `"details": { ... }` 를 갖고, `spec/1-data-model.md:304` (`Integration.last_error`) 도 이미
    `details?` 관례를 쓴다. `nodeId: "uuid"|null` 관례는 §6.4 에 이미 존재(`:735`)
  - 상세: 새로 추가되는 필드명·null 관례 모두 저장소 전역에서 이미 쓰이는 패턴의 재사용이라
    충돌이 아니라 **기존 진짜 SoT(§6.4)를 data-model 미러가 뒤늦게 따라잡는** 방향. §2.14 는
    `NodeExecution` 섹션이지만 "Execution.error ↔ NodeExecution.error 관계" 비교표가 그 안에
    있어 draft 의 "§2.14" 인용 자체는 정확하다(§2.13 Execution 자체 필드 표는 error 구조를
    별도로 갖지 않고 이 비교표를 참조).
  - 제안: 없음(확인용 기록).

- **[INFO]** "Conversation Thread §4.4.6" 오귀속(항목 6) — 실측으로 재확인, 제안된 재지정이 정확
  - target 신규 식별자: (해당 없음 — 재지정만)
  - 기존 사용처: `spec/5-system/14-external-interaction-api.md:473,673` 의
    `[Conversation Thread §4.4.6 / §5.1](../conventions/conversation-thread.md)` 링크
  - 상세: 실제로 `§4.4.6`(`messages[].source` 마커)은 `6-websocket-protocol.md:700` 소속이고,
    `conversation-thread.md` 에는 `§4.4.6` 헤딩이 없다(그 문서의 §5.1 만 존재). 하나의 마크다운
    링크가 두 문서 소속 섹션 번호를 한 URL 에 섞어 붙인 상태 — draft 의 진단이 정확했다.
  - 제안: draft 안대로 WS 문서로 재지정. 추가 조치 불요.

## 요약
target 문서가 새로 부여하는 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수·파일 경로는
전무하다 — 이 draft 는 거의 전부 **기존 식별자의 표기/서술을 실측에 맞춰 정정**하는 작업이고
(§6.2 봉투 추가, `interaction` Planned 표기, blockquote 재서술, `error.code` 옵셔널화, data-model
필드 보강, 인용 재지정, strip 선언 확장), 새로 만들어지는 이름은 관찰되지 않았다. `turnDebug`
top-level/nested 이름 충돌은 draft 스스로 별건으로 명확히 분리했고 실측으로 그 분리가 유효함을
확인했다. 유일한 실질 리스크는 WS §4.4 Rationale 제목을 리네임하면서 같은 파일 519행의 리터럴
인용문을 함께 고치라는 지시가 draft 문면에 명시적이지 않다는 점(WARNING 1건) — collision 이라기
보다 rename 누락으로 인한 dangling self-reference 위험이다.

## 위험도
LOW
