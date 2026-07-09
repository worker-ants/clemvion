# 문서화(Documentation) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침 히스토리
> 복원. 본 라운드(19_40_53)의 changeset 은 이전 3라운드(18_44_10/19_06_55/19_26_15 `/ai-review`, 18_27_06
> `consistency-check --spec`)의 산출물 커밋 + 그 결과를 반영한 4개 spec 문서(`14-external-interaction-api.md`,
> `1-widget-app.md`, `2-sdk.md`, `3-auth-session.md`) diff 로 구성된다. 실제 `codebase/**` 소스 diff 는 이번
> changeset 에 포함되지 않음(이미 앞선 라운드에서 리뷰·커밋됨 — 알려진 "후속 세션 changeset 이 코드 제외" 패턴).
> 다만 문서-코드 정합성 검증을 위해 spec 이 서술하는 대상 코드(`use-widget.ts`, `widget-state.ts`,
> `execution.entity.ts`)를 직접 열람해 대조했다.

## 발견사항

- **[WARNING]** `2-sdk.md` 신규 서술 — `conversationEnded.reason` 의 예시값 `"gone"` 이 실제로는 host 에 전달되지 않음(spec-code 불일치)
  - 위치: `spec/7-channel-web-chat/2-sdk.md`(diff, `wc:event` 행 — `"... 위젯 로컬 종료 사유(user_ended = 헤더 '대화
    종료', gone = 410) 등"`) vs `codebase/channel-web-chat/src/widget/use-widget.ts:309-326`(`sendCommand` 의 410
    catch 블록, `dispatch({ type: "ENDED", reason: "gone" })`만 호출)와 `codebase/channel-web-chat/src/lib/widget-state.ts:82,150-151`(`ENDED` 액션의 `reason` 은 리듀서에서 아예 폐기 — state 에 저장되지 않음).
  - 상세: `bridgeRef.current?.sendEvent("conversationEnded", ...)` 호출은 코드 전체에 두 곳뿐이다 —
    `use-widget.ts:176`(SSE `TERMINAL_EVENTS` 수신 시 `reason: name`, 즉 SSE 이벤트명)과 `:432`
    (`endConversation()` 내부, `reason: "user_ended"` 고정). 반면 일반 명령(`submit_message`/`click_button`/
    `submit_form`)이 `410 Gone` 을 받는 `sendCommand` catch 경로(`:319`)는 `dispatch({ type: "ENDED", reason:
    "gone" })` 만 호출하며 `sendEvent`는 어디서도 호출되지 않는다. `ENDED` 리듀서(`widget-state.ts:150-151`)도
    `reason` 인자를 상태에 반영하지 않고 버린다(`{ ...state, phase: "ended", pending: null }`). 즉 `"gone"`
    이라는 문자열은 위젯 내부 어디에도 실제로 host 로 나가는 경로가 없다 — grep 으로도 `bridgeRef` 관련 호출에
    `"gone"` 리터럴이 등장하지 않음을 확인했다. 이 문구는 이전 라운드 `side_effect.md`(19_26_15)의 제안
    ("host 문서에 `reason` 이 열린 문자열 집합(... 또는 `"user_ended"`/`"gone"`)임을 명시")을 코드 검증 없이
    그대로 spec 에 반영한 것으로 보인다 — 제안 자체가 실제 코드를 트레이스하지 않은 추정치였고, 이번 spec
    반영 시에도 검증이 누락됐다. 결과적으로 3rd-party host 통합 개발자가 spec 을 읽고 `reason === "gone"`
    분기를 작성해도 그 이벤트는 영원히 발화하지 않는다(410 발생 시 위젯은 로컬로만 `[ended]` 전이하고 host 는
    아무 통지도 받지 못함 — 이는 이번 PR 범위 밖의 pre-existing 코드 갭이지만, 그 갭을 감추는 방향으로 새
    문서가 작성된 점이 이번 diff 의 문제다).
  - 제안: 둘 중 하나 선택. (a) spec 문구에서 `"gone"` 예시를 제거하고 실제 전송되는 값만
    (`user_ended`/SSE terminal 이벤트명)으로 한정 서술. (b) `sendCommand` 의 410 catch 블록에도
    `bridgeRef.current?.sendEvent("conversationEnded", { reason: "gone" })` 를 추가해 spec 서술을 코드로
    충족시킴(이 경우 회귀 테스트도 필요). 어느 쪽이든 developer/project-planner 결정 필요.

- **[INFO]** `1-widget-app.md` §3 ASCII 상태 다이어그램이 신규 "대화 종료" edge 를 반영하지 않음(반면 "새 대화" edge 는 프로즈 각주로 명시) — 비대칭 갱신
  - 위치: `spec/7-channel-web-chat/1-widget-app.md` §3 다이어그램(`[collapsed]...[streaming]...[awaiting_user_message]...[ended] ──new chat──▶ [booting]`)
    바로 아래 신규 bullet "**헤더 세션 컨트롤(§3.1)**"
  - 상세: 이번 diff 는 §3.1 표에 "대화 종료"가 이제 `streaming`(응답 대기 중)에서도 직접 발동 가능함을
    명시했다(`그 외(응답 대기 streaming, ...)면 cancel(범용 종료)`). 그러나 다이어그램 자체에는 `streaming`
    박스에서 `[ended]` 로 가는 edge 가 시각적으로 없다(기존에는 암묵적으로 `awaiting_user_message` 루프에서만
    `[ended]` 로 내려가는 것으로 읽힘). 신규 bullet 은 "다이어그램의 `new chat` 화살표는 ... 헤더 컨트롤
    (streaming/awaiting 발원)에서도 발생한다"고 **"new chat" edge 만** 명시적으로 각주 처리했고, 동일하게 신설된
    "대화 종료" edge(streaming→ended)에 대해서는 대응하는 각주가 없다. §3.1 표 자체는 정확하므로 기능
    이해에 실질적 지장은 없지만, 다이어그램만 훑는 독자에게는 여전히 "종료는 awaiting_user_message 이후에만"
    이라는 인상을 줄 수 있다.
  - 제안: 같은 bullet 에 "대화 종료 edge 도 streaming/awaiting 양쪽에서 발생(§3.1)"을 한 문장 추가하거나,
    다이어그램에 `streaming ─(대화 종료)─▶ [ended]` 점선을 추가. 차단 사유 아님.

- **[INFO]** `execution.entity.ts` 기존 JSDoc 과 이번 API 노출의 문면상 긴장(회귀 확인 — `requirement.md`(19_26_15) INFO#1 과 동일 지점, 문서화 관점에서도 동일 결론)
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts:160`
  - 상세: 앞선 requirement 리뷰가 이미 지적한 대로, `conversation_thread` 컬럼 JSDoc("API 응답 DTO 미포함 — 내부
    rehydration 전용")은 여전히 `execution-response.dto.ts` 기준으로는 사실이나, 이번 diff 로 노출된
    `external-interaction` 모듈의 `ExecutionStatusDto.context.conversationThread` 표면과는 문면상 긴장이
    있다. 문서화 리뷰 관점에서도 동일하게 "엔티티 주석만 읽는 개발자가 오해할 수 있는 stale-스러운 주석"으로
    분류되며, 파일 자체가 이번 diff 대상이 아니라 신규 결함은 아니다.
  - 제안: 이전 라운드와 동일 — 필수 아님. 후속으로 한 줄 교차 참조("단, external-interaction
    `ExecutionStatusDto.context.conversationThread` 는 read-only 로 노출(EIA §R17)") 추가를 권장.

## 우수 사항 (참고)

- `14-external-interaction-api.md` R17 addendum 이 **기각 대안(a)/(b)** 를 근거와 함께 명시했고(rationale_continuity
  INFO#2 반영), `context.conversationThread` 의 "값이 없으면 형제 필드의 `null` 관례와 달리 키 자체를 생략"이라는
  의도적 비대칭을 jsonc 예시 바로 위 prose 로 명확히 문서화했다 — 향후 소비자가 `null` 체크만으로 오판하지 않도록
  하는 좋은 관례.
- `1-widget-app.md`/`3-auth-session.md` 모두 이전 `cross_spec`(18_27_06) WARNING("TTL/idle 만료"가 실행엔진
  무기한 보존 불변식과 충돌)·INFO("waiting_for_input 한정 조건 누락")를 정밀 반영했음을 diff 로 직접 확인—
  "**토큰만** TTL/idle 만료" + "Execution row 는 waiting_for_input 로 무기한 잔존" 병기, "`waiting_for_input`
  상태면" 한정어 추가 모두 실제 텍스트에 반영되어 있다.
- `review/consistency/.../SUMMARY.md` 의 "처리 메모"가 subagent output 파일 누락을 journal.jsonl 로 복구한
  경위를 투명하게 기록해 프로세스 감사 추적성이 좋다.
- API 문서(`14-external-interaction-api.md` §5.3/R17) 갱신이 이번 백엔드 응답 스키마 확장과 1:1 대응하며,
  `1-widget-app.md`/`3-auth-session.md` 양쪽에서 소비 측 계약(§3.1 표·재로드 시퀀스)까지 함께 갱신되어 있어
  API 변경에 필요한 문서 업데이트가 실질적으로 누락 없이 이루어졌다.

## 요약

이번 changeset 의 문서 변경(4개 spec 파일)은 대체로 높은 품질이다 — R17 addendum 은 기각 대안까지 근거와 함께
기록했고, 이전 3라운드 `/ai-review`·`consistency-check` 가 지적한 표현 정밀도 문제(TTL/idle 문구, 한정 조건
누락)를 정확히 코드 diff 로 반영해 해소했으며, durable thread 노출의 "키 생략 vs null" 의도적 비대칭도 명시적으로
설명돼 있다. 다만 실제 코드를 직접 대조한 결과, `2-sdk.md` 에 새로 추가된 `conversationEnded.reason` 예시값
`"gone"` 은 코드상 host 로 전달되는 경로가 없어 spec-code 불일치가 확인됐다(WARNING) — 이는 앞선 `side_effect.md`
라운드의 미검증 제안을 그대로 문서화하면서 발생한 것으로 보인다. 그 외 1-widget-app.md 상태 다이어그램의
"대화 종료" edge 미반영(INFO, "새 대화" edge 는 각주 처리됐으나 대칭 처리 안 됨)과 execution.entity.ts 의 기존
stale 주석(INFO, 이전 라운드 재확인)은 차단 사유가 아닌 참고 사항이다. README/CHANGELOG/환경변수 문서화 관련
갭은 발견되지 않았다(CHANGELOG 갱신은 이전 라운드에서 이미 별도 커밋으로 처리된 것으로 확인됨, 신규 env var 없음).

## 위험도
LOW
