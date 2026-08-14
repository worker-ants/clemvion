# Cross-Spec 일관성 검토 — `spec-draft-eia-62-waiting-payload.md`

## 발견사항

- **[WARNING]** `error.code` 옵셔널화(변경 제안 (4))가 `data-model.md` §2.14 갱신(변경 제안 (5))과 어긋난다
  - target 위치: `## 변경 제안` (4) `error.code` 를 옵셔널로 / (5) `1-data-model.md` §2.14
  - 충돌 대상: `spec/1-data-model.md` §2.14 `Execution.error ↔ NodeExecution.error 관계` 표의 "구조" 행 —
    `{ nodeId: "uuid", code: "ERROR_CODE", message: "에러 설명" }` (code 가 항상 존재하는 것으로 서술, `?` 없음)
  - 상세: target 은 (4)에서 "종결 error 를 싣는 4개 지점 중 `code` 를 실제로 갖는 것은 `finalizeFailedExecution`
    의 sentinel 경로뿐" 이라는 근거로 EIA §6.4(+필드 집합 표)의 `error.code` 를 **옵셔널로 정정**하기로 했다.
    같은 draft 의 (5)는 같은 `data-model.md` §2.14 를 건드리지만 **`nodeId` 의 nullable 화만** 다룬다 —
    "구조" 행의 `code` 는 그대로 두면 여전히 필수처럼 읽힌다. 즉 이 draft 를 그대로 적용하면
    **EIA §6.4(code 옵셔널) vs `data-model.md` §2.14(code 항상 존재)** 라는 새로운 데이터 모델 불일치가
    같은 커밋 안에서 발생한다. 이 불일치는 실제로도 근거가 있다 — `finalizeFailedExecution`
    (`execution-engine.service.ts:4828`)이 `savedExecution.error`(= `Execution.error` 컬럼)를
    `{ message, ...(sentinel ? { code } : {}) }` 로 조립해 `code` 를 조건부로만 채운다. 형제 developer plan
    [`eia-terminal-payload.md`](../../../../plan/in-progress/eia-terminal-payload.md) 의 "함께 넘기는 spec 항목"
    표에서도 `data-model.md §2.14` 갱신 문구를 `{nodeId: "uuid"|null, code, message, details?}` 로 적어
    (code 에 `?` 없이) 같은 누락을 반복하고 있다 — 그 문서 바로 아래 W2 결정("code 를 옵셔널로 정정")과도
    자기 모순이다. 부수적으로 같은 "구조" 행에는 `details` 키도 없어 EIA 쪽 목표 shape
    (`{code?, message, nodeId, details?}`)과 완전히 대응하지 않는다.
  - 제안: (5)의 `data-model.md` §2.14 편집 범위를 `{ nodeId: "uuid" | null, code?: "ERROR_CODE", message: "에러 설명", details?: {...} }`
    로 확장 — nullable `nodeId` 뿐 아니라 optional `code`(+ 필요시 `details?`)까지 같은 턴에 반영해
    (4)와 (5)가 동일 문서에서 서로 다른 이야기를 하지 않도록 한다. `eia-terminal-payload.md` 의 해당 행도
    함께 정정 대상(교차 참조만 추가해도 됨).

- **[WARNING]** `turnDebug` 이름 충돌(기존 CRITICAL)이 "spec 반영 7항목 (1)~(7)"에 포함되지 않아 누락 위험
  - target 위치: `## 🔴 조사 중 발견` 처분 체크리스트의 미해결 항목("이름 충돌은 이 커밋에 포함되지
    않았다 — 별도 잔여") vs `## 체크리스트` "spec 반영 — **7항목** `(1)`~`(7)`"
  - 충돌 대상: `spec/5-system/6-websocket-protocol.md` §4.4 표(`nodeOutput.meta.turnDebug`, 배열, "정본"
    으로 명시) ↔ `ai-turn-orchestrator.service.ts:615-617` 의 waiting emit 최상위 `turnDebug`
    (object `{llmCalls, metadata}`) — 같은 `execution.waiting_for_input` wire payload 안에 이름이
    같고 shape 이 다른 두 필드가 공존한다(target 문서 자신이 "경로 1/경로 2" 로 실증).
  - 상세: 이 naming collision 은 앞선 라운드(`10_32_29`)에서 이미 **naming_collision CRITICAL 1**로
    등재됐고, target 문서도 "그대로 옮겨 적으면 spec 에 정식 충돌로 고착된다" 고 스스로 경고한다.
    그런데 target 이 확정한 "변경 제안 (1)~(7)" 어디에도 이 리네임/disambiguation 이 포함돼 있지
    않다 — (1)은 "안쪽 JSON(`node`/`interaction`/`context`)은 그대로 둔다"(재작성 철회)이고, (3)의
    blockquote 재작성 예시에도 `node.id`/`interactionType`/`conversationConfig`/`buttonConfig`/
    `formConfig`/`conversationThread` 6개 매핑만 나열되며 `turnDebug` 는 등장하지 않는다. 즉 이
    draft 가 그대로 spec 에 반영되면, WS §4.4 가 "정본" 으로 선언한 `nodeOutput.meta.turnDebug`(배열)
    옆에 이름이 같은 최상위 `turnDebug`(object)가 여전히 **아무 disambiguation 없이** 문서화될
    가능성이 높다. 체크리스트가 "7항목" 이라는 닫힌 숫자로 스코프를 못박고 있어, planner 가 항목
    개수만 보고 이 잔여를 놓치기 쉬운 구조다(이 저장소에서 반복돼 온 체크박스/스코프 drift 패턴).
  - 제안: (1)~(7) 중 하나(예: (3))의 범위를 넓혀 최상위 `turnDebug`(waiting emit 전용 스냅샷)에
    disambiguation 문구를 명시적으로 부착하거나, 별도 (8)항목으로 승격해 "7항목" 표기를 갱신한다.
    최소한 blockquote(item 3)에 "top-level `turnDebug` 는 `nodeOutput.meta.turnDebug`(WS §4.4 정본,
    배열)와 이름만 같은 별개 필드" 라는 한 줄 caveat 를 넣는 것으로 CRITICAL 을 WARNING 수준으로
    낮출 수 있다.

## 요약

target 은 EIA §6.2 재작성을 "봉투만 고치고 안쪽 논리 표기는 보존" 으로 스코프를 좁힌 재판정이며,
실측(§6.2 봉투 누락, `2-api-convention.md` 버전-URL 위반, `Conversation Thread §4.4.6` 오귀속,
WS §4.4/EIA §R17 strip 범위 서술이 실제 구현보다 좁았던 문제)이 모두 코드·타 spec 문서와 교차
검증돼 근거가 탄탄하다. 형제 plan(`spec-draft-eia-notification-payload-contract.md`)에는 이미
소급 정정 각주가 반영돼 있어 plan 간 충돌은 해소된 상태다. 다만 이번 draft 자체가 새로 만드는
작은 데이터 모델 불일치(§6.4 `error.code` 옵셔널화가 `data-model.md` §2.14 "구조" 행에 반영 안 됨)와,
이미 CRITICAL 로 등재된 `turnDebug` 이름 충돌이 확정된 "7항목" 커밋 범위에서 빠져 있는 스코프
누락 위험이 남아 있다. 둘 다 target 이 손대는 바로 그 섹션/체크리스트에 국한된 좁은 보정으로
해소 가능하다.

## 위험도

MEDIUM
