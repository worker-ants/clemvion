# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** 같은 파일의 근접한 JSDoc 블록 안에서 "5곳"이 서로 다른 두 함수의 호출부 수를 가리켜 혼동을 유발한다
  - 위치: `codebase/backend/src/shared/utils/terminal-error-payload.ts:8-9`(기존 문맥, "**현재 호출부는 `EXECUTION_FAILED` 4곳뿐이다.** 시스템 `execution.cancelled`(`emitCancellationEvent` + 호출 **5곳**)은...") vs `codebase/backend/src/shared/utils/terminal-error-payload.ts:63`(이번 diff 신규, "이 함수가 자리로 옳은 이유는 **호출부 5곳이 전부 emit 쪽**이라는 것이다")
  - 상세: 게이트 9의 "호출 5곳"은 `emitCancellationEvent`(취소 이벤트, 전혀 다른 함수)의 호출부 수를 가리키고, 게이트 63의 "호출부 5곳"은 `toTerminalErrorPayload`(이번 PR의 마스킹 대상 함수) 자신의 호출부 수(직접 조립 4 + `chat-channel.dispatcher` 재정규화 1 = 5, 실측 grep 으로 확인)를 가리킨다. 두 "5곳"은 서로 무관한 집합인데 같은 파일의 30여 줄 안에 나란히 등장하고, 어느 쪽도 "이 5곳은 앞서 언급한 취소 이벤트의 5곳과 다르다"는 명시적 구분이 없다. 이 함수의 JSDoc은 "호출부 전수를 거치므로 마스킹이 구조적으로 빠질 수 없다"는 것 자체가 핵심 안전성 논거이므로, 리더가 두 "5곳"을 같은 것으로 오독하면(예: "취소 경로도 이미 이 5곳에 포함된다"고 착각) 이번 PR이 취소 이벤트 경로는 다루지 않는다는 사실(§6.4 각주·plan "범위 밖" 절에 명시)을 놓칠 위험이 있다. CHANGELOG(`CHANGELOG.md:11`, "종결 emit **4곳** + chat-channel fanout")는 같은 숫자를 "4+1" 로 분해해 훨씬 명확하게 적었는데, 정작 소스 JSDoc은 그 분해를 채택하지 않았다.
  - 제안: 게이트 63의 "호출부 5곳"을 CHANGELOG와 같은 방식으로 분해 — 예: "호출부 5곳(`EXECUTION_FAILED` 4 + `chat-channel.dispatcher` 1)이 전부 emit 쪽" — 하거나, 최소한 "(취소 이벤트의 5곳과 무관)" 한 구절을 덧붙여 게이트 9의 "5곳"과의 혼동을 차단.

- **[WARNING]** 이번 PR이 새로 작성한 CHANGELOG 항목과 plan 문서가 "EIA outbound webhook"을 인용하며 잘못된 spec 섹션 번호(§3.3)를 두 곳에 그대로 옮겨 적었다 — §3.3은 outbound webhook과 무관한 "인증" 섹션이다
  - 위치: `CHANGELOG.md:6`("...SSE 스트림(§5.2)과 **EIA outbound webhook(§3.3)** 으로...", 이번 diff 신규) · `plan/in-progress/eia-terminal-error-sanitize.md:27`("도달 범위 | WS + SSE(§5.2) + **EIA outbound webhook(§3.3) = 외부 제3자**", 이번 diff 신규)
  - 상세: `spec/5-system/14-external-interaction-api.md`를 직접 대조하면 `### 3.3 인증`(EIA-AU-01~08, 토큰/HMAC 검증 요구사항)이고, outbound webhook 요구사항(화이트리스트 포함 `EIA-NX-02`)은 `### 3.1 Outbound Notification (Notification Webhook)`(line 54~)에 정의돼 있다 — 실측 확인(`grep -n "EIA-NX-02" spec/5-system/14-external-interaction-api.md` → line 59, §3.1 범위). "§3.3"으로 outbound webhook을 가리키는 표기는 이번 PR 이전에도 `CHANGELOG.md:45`(다른 PR, #1174)에 이미 존재했던 것으로 `git log -S`로 확인했으나(이번 diff 범위 밖이라 새로 만든 오류는 아님), 이번 PR은 그 잘못된 인용을 검증 없이 그대로 복제해 **새로 2곳**(CHANGELOG 신규 항목·plan 문서)에 추가했다. 바로 옆에 나란히 쓴 "SSE 스트림(§5.2)"은 정확(§5.2 = "SSE 이벤트 스트림")한데 "§3.3"만 틀려, 독자가 근거 확인 없이 신뢰하기 쉬운 형태다. 같은 세션의 `api_contract.md`(이번 라운드)도 같은 "§3.3" 표기를 그대로 인용해 오류가 계속 퍼지고 있다.
  - 제안: 세 곳(`CHANGELOG.md:6`·`plan/in-progress/eia-terminal-error-sanitize.md:27`·기존 `CHANGELOG.md:45`) 전부 "§3.3"을 "§3.1"(요구사항 EIA-NX-02) 또는 "§6"(Outbound Notification API 명세 본문) 중 문맥에 맞는 것으로 정정. 세 번째(`CHANGELOG.md:45`)는 이번 diff 밖이므로 이번 PR에서 고칠 의무는 아니지만, 같은 세션에서 발견된 이상 함께 정정하는 편이 재발을 막는다.

- **[INFO]** `rationale_continuity`(09_25_29) 라운드가 제기한 전제("워크플로우 에디터의 실패 배너가 `execution.failed`의 `error.message`를 그대로 렌더링한다", `spec/3-workflow-editor/3-execution.md §3.5` 근거)와 이번 PR의 W3 해소 답변("에디터는 이 payload의 `error.message`를 렌더링하지 않는다 — REST `NodeExecution`/`Execution`에서 온다")이 정면으로 다른 사실 주장을 하는데, 어느 쪽 서술이 왜 맞는지(또는 §3.5가 왜 오독됐는지) 기록에 남지 않았다
  - 위치: `plan/in-progress/eia-terminal-error-sanitize.md`(이번 diff 신규 파일) "리뷰(`09_51_00`)가 잡은 것" 절의 W3 문단
  - 상세: `spec/3-workflow-editor/3-execution.md §3.5`를 직접 열어보면 실제로는 `Error: Connection timeout [Details]` 형태의 UI 목업만 있고 데이터 출처(WS 이벤트 vs REST 재조회)를 명시하지 않는다 — 즉 rationale_continuity의 "그 소스가 `execution.failed`의 `error.message`다"는 추론이었지 spec이 명시한 사실이 아니었다. W3의 답변은 코드 실측(`external-interaction-card.tsx`, REST 소스)으로 그 추론을 뒤집었지만, plan 어디에도 "§3.5는 데이터 출처를 규정하지 않는다 — rationale_continuity의 추론이 스펙 문언보다 넓었다"는 식의 명시적 정정이 없다. 다음 사람이 두 문서를 나란히 읽으면 "리뷰가 제기한 우려에 실제로 답이 된 것인지"를 다시 조사해야 한다. 또한 W3 답변 자체도 "에디터가 REST로 무엇을 받는지"까지만 확인했지, 그 REST 경로(`NodeExecution`/`Execution` GET)가 마스킹 여부와 무관하게 원문을 유지하는 것이 R17 원칙(내부 소비처는 faithful 유지)에 부합한다는 것까지는 명시하지 않아 이 하드닝의 "내부 표면 무영향" 결론이 근거로서는 다소 얇다.
  - 제안: plan의 W3 문단에 "§3.5는 데이터 출처를 규정하지 않으며, REST 경로는 이번 PR의 egress 마스킹(`toTerminalErrorPayload`) 대상이 아니므로 원문이 그대로 유지된다(R17 내부-소비처 faithful 원칙과 부합)"는 한 문장을 추가해 rationale_continuity의 전제와 이번 조사 결과의 관계를 명시적으로 닫을 것(강제 아님, 저비용).

## 요약

핵심 코드 변경(`redactTerminalError` 도입)의 JSDoc은 이례적으로 상세하고, 이전 라운드(09_51_00)가 지적한 "리뷰 미룬 라운드 수 불일치(4 vs 5)", "CHANGELOG 누락", "webhook 알림 잔존 서술" 등은 이번 diff에서 실측 grep으로 재검증까지 마치고 정확히 정정됐다 — 재확인 결과 `plan/in-progress/eia-terminal-error-sanitize.md:11`과 `terminal-error-payload.spec.ts:135` 모두 이제 "5라운드"로 일치하고, `CHANGELOG.md`에 wire 변화·잔여 갭·수신자 영향을 포함한 신규 `## Unreleased` 항목이 정확히 추가됐다. 다만 이번 diff가 새로 도입한 서술에서 두 가지 정확성 문제가 발견됐다 — (1) `terminal-error-payload.ts` 안에서 "5곳"이 근접한 두 문단에서 서로 다른 함수(취소 이벤트 vs `toTerminalErrorPayload`)의 호출부 수를 가리켜 핵심 안전성 논거를 오독시킬 소지가 있고, (2) 이번 PR이 새로 작성한 CHANGELOG·plan 문서 두 곳이 "EIA outbound webhook"의 spec 근거로 잘못된 섹션 번호(§3.3, 실제로는 §3.1)를 검증 없이 그대로 복제해 이미 존재하던 인용 오류를 확산시켰다. 셋째로, 이전 consistency 라운드가 제기한 "내부 워크플로우 에디터 영향" 우려에 대한 이번 PR의 해소 답변이 그 라운드의 전제와 사실관계가 다른데도 그 불일치를 명시적으로 정리하지 않아 추적 기록에 미세한 간극이 남았다(INFO). 셋 다 기능 결함이 아니라 문서 정확성/추적성의 문제다.

## 위험도
LOW
