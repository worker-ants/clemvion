# Plan 정합성 검토 — `spec-draft-api-convention-104-reconnect.md`

## 검토 대상

- target: `plan/in-progress/spec-draft-api-convention-104-reconnect.md`
- 근거 tracker: `plan/in-progress/spec-draft-nullable-notation-followups.md` (해당 항목은 이 브랜치에서 아직 미편집 — `git status --short` 로 확인, `plan/in-progress/spec-draft-api-convention-104-reconnect.md` 만 untracked)

## 발견사항

- **[WARNING]** 등재 항목 재판정 "②" — "두 번째 불릿만 지적했다" 는 draft 자신의 서술이 부정확하고, draft 뒷부분과도 내적으로 모순된다
  - target 위치: `spec-draft-api-convention-104-reconnect.md` "## 등재 항목의 전제 두 개를 실측이 뒤집었다" → "### ② 틀린 곳이 두 번째 불릿 하나 — **아니다. 두 불릿이 다 틀렸고 註의 축도 틀렸다**"
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 `- [ ] **`2-api-convention.md §10.4` 가 native WS 에 없는 복구 메커니즘을 기술한다**` 항목 (2026-09-10 등재)
  - 상세: draft 는 "등재 항목은 두 번째 불릿만 지적했다. 실측하니 **세 곳**이다" 라고 쓴다. 그러나 tracker 원문을 그대로 옮기면:

    > **바로 아래 blockquote 가 문제를 고치는 대신 봉인한다.** 그 註는 *"위 두 줄은 **전송 계층이
    > 끊긴 경우**를 말한다"* 며 "서버가 스스로 `disconnect()` 한 경우" 만 예외로 빼낸다 — 즉
    > **전송 계층 끊김에는 last-event-ID 재전송이 있다는 잘못된 주장을 그대로 유지**한다. 실제로는
    > 두 경우 모두 snapshot 이다.
    >
    > 처방 후보: (a) 두 번째 불릿을 snapshot 모델로 정정하고 blockquote 의 "위 두 줄은 전송 계층이
    > 끊긴 경우" 프레이밍도 함께 고친다 — **불릿만 고치면 註가 다시 모순을 만든다.**

    즉 tracker 항목은 이미 (i) 두 번째 불릿과 (ii) blockquote 의 "구분 축" 오류("실제로는 두 경우 모두
    snapshot 이다")를 **둘 다** 명시적으로 지적했고, 둘을 함께 고쳐야 한다고 처방까지 했다. draft 의
    ③("註가 구분 축을 잘못 잡았다 — 이게 제일 고약하다... 실제로는 복구 방식은 두 경우가 같다")은
    이 tracker 문장을 "재연결 발화 vs 복구 방식" 이라는 더 정확한 언어로 다듬은 것이지, tracker 가
    놓친 새로운 발견이 아니다. draft 가 실제로 새로 찾은 것은 **①(첫 번째 불릿의 백오프 수치가
    `6-websocket-protocol.md §6.1` 이 스스로 "spec 초안 값" 이라 적어 둔 값이라는 것)** 하나뿐이다.
    draft 는 이 구절 바로 다음 문장("불릿만 고치면 註가 다시 모순을 만든다 — **등재 항목이 이미
    경고한 그대로다**")에서 스스로 이를 인정하고 있어, 절 도입부의 "두 번째 불릿만 지적했다" 는
    프레이밍과 draft 내부에서도 모순된다.
  - 제안: "실측하니 세 곳이다" 서술을 "tracker 는 이미 두 곳(불릿②+blockquote 축)을 지적했고,
    실측으로 새로 추가되는 것은 불릿①(spec 초안 백오프 수치) 한 곳이다" 로 정정할 것. 자매 트래커
    항목을 플립할 때도 "(b) 의 근거가 거짓이었다" 는 정정과는 별도로, 이 개수 서술을 그대로 복사하지
    말고 정확한 형태로 남길 것 — 그렇지 않으면 다음 사람이 "이 항목이 실은 결함을 하나만 알고
    있었다" 는 잘못된 인상을 갖는다. (E-1 자체의 최종 내용은 세 지점 모두 옳게 고치므로 **기술적
    결과에는 영향 없음** — 순수히 이력 서술의 정확성 문제.)

- **[INFO]** 폭 확장(3-fix)은 항목 범위 안에 머문다
  - target 위치: `spec-draft-api-convention-104-reconnect.md` "## 변경안" → "### E-1. §10.4 전체 교체"
  - 관련 plan: 위와 동일한 tracker 항목
  - 상세: tracker 항목 title 은 "native WS 에 없는 복구 메커니즘을 기술한다" 로 좁게 적혀 있고 새로
    추가된 결함(①, 백오프 수치)은 "존재하지 않는 메커니즘" 이 아니라 "SoT 가 폐기한 초안 값을
    사실처럼 옮겨 적음" 이라는 다른 결함 축이다. 그럼에도 (a) 동일 절(`§10.4`, 4줄 + blockquote 2개)
    안에 있고, (b) tracker 의 처방이 이미 "§10.4 전체를 하나의 단위로 다시 쓴다" 는 재량(처방
    (a)/(b) 택일 + §6.2 인용 필수)을 부여했으며, (c) 새 결정 축이나 새 spec 파일을 요구하지 않는다.
    별도 항목으로 쪼갤 이유가 약하다 — 같은 절을 두 번 여는 비용이 더 크다.
  - 제안: 없음 (현재 범위 유지 권장). 다만 위 WARNING 처럼 "몇 개를 새로 찾았는가" 서술만 정확히
    할 것.

- **[INFO]** 선행 관련 plan `ws-token-expired-socket-lifetime-impl.md` 을 draft 가 인용하지 않는다
  - target 위치: `spec-draft-api-convention-104-reconnect.md` 전체 (선행 작업 인용 없음)
  - 관련 plan: `plan/in-progress/ws-token-expired-socket-lifetime-impl.md` 의
    `- [x] **`2-api-convention.md §10.4` — 완료.**` 항목
  - 상세: 이 항목은 2026-09-02~03 께 이미 §10.4 에 "예외 — 서버가 끊은 경우" blockquote(현재 spec
    파일에 실재, WS §1.2·§6.1·§6.2·§9.2 로 위임)를 넣은 작업이다. 스스로 "**내 앞선 판단이
    약해졌다** — spec draft 에서 §10.4 를 안 고친 근거는 '요약에 예외를 복제하면 두 곳이 갈릴 자리를
    새로 만든다' 였다" 고 적어, 정확히 지금 draft 가 마무리하는 종류의 후속 수정을 예견하고 있었다.
    직접적인 충돌은 없다 — 그 항목은 (i) 이미 `[x]` 로 닫혀 있고, (ii) 범위가 "예외를 위임 한 줄
    넣기" 로 좁게 확정돼 있어 draft 의 E-1(그 blockquote 를 유지하며 재구성)과 내용이 상충하지
    않는다. 다만 이 이력을 draft 가 인용했다면 "왜 지금 손대는가" 의 계보가 한 문서 안에서 완결됐을
    것이다.
  - 제안: 필수는 아니지만, 트래커 플립 커밋 메시지나 이 draft 의 배경 절에
    `ws-token-expired-socket-lifetime-impl.md` 의 위 항목을 한 줄 인용해 두면 향후 §10.4 이력을
    추적하는 사람에게 도움이 된다.

- **[INFO]** 검증 완료 — 미해결 결정 충돌 없음, 선행 조건 없음, Gate C 통과
  - §10 전체를 직접 열어 확인한 결과, "§10.1 연결(URL 인라인) · §10.2 메시지 형식(JSON 인라인) ·
    §10.3 용도(표 인라인, 실행 제어 행만 §4.2 링크)" 이며, draft 의 전제 반박 ①("§10 의 나머지
    소절은 이미 전면 위임 구조" 가 거짓)은 실측과 정확히 일치한다.
  - `6-websocket-protocol.md` §6.1(spec 초안 값 註)·§6.2(native WS snapshot 모델·seq 는 SSE
    어댑터 소유)·§4.7(5분 버퍼는 SSE 어댑터 소유) 을 열어 대조한 결과, draft 의 인용문·논증이
    모두 SoT 본문과 정확히 일치한다.
  - 신규 앵커 `#61-클라이언트-재연결-socketio-내장` 은 대상 heading("### 6.1 클라이언트 재연결
    (Socket.IO 내장)")에 이 저장소의 기존 slug 규칙(괄호 제거·소문자화)을 그대로 적용한 값과
    일치한다. `#62-놓친-이벤트-복구`·`#47-외부-표면-매핑-external-interaction-api` 는
    `14-external-interaction-api.md:442,1148,1918` 가 이미 실제로 사용 중인 링크라 확실히 유효하다.
  - `plan/in-progress/**` 전체를 `§10.1`~`§10.4`, "spec 초안 값", `§6.1`/`§6.2`(WS 문서 한정),
    "재연결 전략" 키워드로 훑었다. `2-api-convention.md §10` 이나 `6-websocket-protocol.md`
    §6(재연결 전략) 을 여는 **다른 미해결 항목은 없다**. `execution-engine-residual-gaps.md` 의
    §10.3 "Planned 마킹" 항목은 이미 `[x]` 로 닫혀 현재 spec 상태(`execution.start/stop` 비채택
    won't-do·`execution.continue` 계획·미구현)와 일치한다. §10.1/§10.2 의 raw-WS 표기나 §6.1 의
    "spec 초안 값" 註를 열려는 다른 등재 항목도 없다 — 직전 항목(archive-anchor 처분)에서 있었던
    "다른 plan 이 소유한 결정을 중복 처분" 유형의 문제는 이번 draft 에서 재발하지 않았다.
  - Gate C: frontmatter `spec_impact` 는 `spec/5-system/2-api-convention.md` 단일 항목이고
    (`- spec/5-system/2-api-convention.md`), 해당 파일은 실재한다. draft 본문도 "무엇을 하지 않나"
    에서 `6-websocket-protocol.md` 를 명시적으로 배제하며, `git status --short` 로 확인한 실제
    작업 트리 변경분도 신규 plan 파일 하나뿐이라 두 번째 spec 파일을 건드리지 않는다는 서술과
    일치한다.

## 요약

`spec-draft-api-convention-104-reconnect.md` 가 반증하는 두 전제 중 ①("§10 나머지 소절이 전면
위임 구조")은 §10 원문 실측과 정확히 일치해 문제가 없다. ②("등재 항목은 두 번째 불릿만
지적했다")는 부정확하다 — tracker 항목은 이미 blockquote 의 "구분 축" 오류까지 지적하고 함께
고치라고 처방해 두었고, draft 자신도 몇 문장 뒤에서 이를 인정한다. draft 가 실제로 새로 찾은 것은
세 곳이 아니라 첫 번째 불릿(백오프 수치) 한 곳이며, 이 개수 착오는 자매 트래커를 플립할 때 그대로
옮기면 이력을 왜곡한다 — 다만 최종 처방(E-1)의 기술적 내용 자체는 SoT 와 정확히 일치해 결과물의
정합성에는 영향이 없다. 폭 확장(3곳 동시 수정)은 같은 §10.4 절 내부에 머무르고 새 결정 축을
만들지 않으므로 별도 항목으로 쪼갤 필요는 없다고 판단한다. `2-api-convention.md §10`·
`6-websocket-protocol.md` §6(재연결)·EIA replay 를 여는 다른 미해결 plan 항목은 없으며, 유일하게
관련된 선행 작업(`ws-token-expired-socket-lifetime-impl.md` 의 §10.4 항목)은 이미 닫혀 있고 내용도
충돌하지 않는다. Gate C(spec_impact 단일 파일)와 신규 앵커 3건도 모두 검증됐다.

## 위험도

LOW
