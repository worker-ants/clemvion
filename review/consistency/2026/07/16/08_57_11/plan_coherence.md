# Plan 정합성 Check 결과

대상: `spec/5-system/15-chat-channel.md` (impl-done, diff-base `origin/main`)

## 조사 방법

`plan/in-progress/**` 전체(29개 문서)를 대상으로 `control-plane`, `escapeControlText`,
`MarkdownV2`, `languageHints`, `chat-channel`, `F-5` 키워드로 교차 검색. payload 에 실린
4개 plan(`ai-agent-tool-connection-rewrite.md` / `ai-agent-tool-payload-budget-followups.md` /
`ai-agent-tool-payload-budget-guardrail.md` / `cafe24-backlog-residual.md`)은 모두 본 target 과
무관한 영역(AI Agent 도구 연결·payload 예산·Cafe24 API 카탈로그)이라 충돌 없음. payload 에는
빠져 있었지만 실제로 본 diff 를 직접 소유하는 `plan/in-progress/control-plane-provider-escape.md`
를 별도로 읽어 대조했다 (아래 §1).

## 발견사항

### [WARNING] 인터페이스 "6함수" 불변식이 target 자신의 변경으로 깨졌는데 관련 Rationale 이 갱신되지 않음

- target 위치: `spec/conventions/chat-channel-adapter.md` §Rationale — `### R1. 6함수 인터페이스의
  책임 분리`, `### R2. 6함수 (5+1 ack) 의 의도`, `### R-CCA-7`("함수 개수 6 을 유지해 ... 보존한다.
  7번째 함수 `renderPresentationNode` 신설은 R-CCA-5 가 명시 기각한 '함수 개수 증가 = 모든 provider
  어댑터 contract 변경' 패턴을 재현하므로 채택하지 않는다")
- 관련 plan: `plan/in-progress/control-plane-provider-escape.md` 체크리스트 — `[x] spec 동기
  (§4.1.1 escape-at-send / §4.1 예제 평문 / R-CC-15 F-5 제거 / providers/telegram §5.8 /
  chat-channel-adapter §1·§1.1)` (완료로 표시됨)
- 상세: 이번 diff 는 `ChatChannelAdapter` 인터페이스에 신규 **필수** 함수
  `escapeControlText(text: string): string`(`types.ts`)를 추가했고, `chat-channel-adapter.md`
  §1.1 표에도 이 7번째 함수 행이 실제로 반영됐다(확인됨). 그런데 같은 문서의 §Rationale
  (R1/R2/R-CCA-7)은 여전히 "6함수 인터페이스", "함수 개수 6 을 유지", "7번째 함수 신설은 채택하지
  않는다"라고 명시적으로 주장한다 — 정확히 target 이 지금 실행한 패턴(7번째 함수 신설, 3개 provider
  전부 contract 변경)을 R-CCA-7 이 **명시적으로 기각한 대안**으로 서술한 채 방치돼, 같은 문서 내에서
  "6함수 불변식은 유지된다"는 이제 사실과 어긋난 주장과 실제 7함수 인터페이스가 공존한다. 소유 plan
  의 "spec 동기" 체크박스는 §1(인터페이스 정의)·§1.1(책임 표)까지만 갱신했고 §Rationale 은 대상에서
  빠진 것으로 보인다.
- 제안: target(`chat-channel-adapter.md` §Rationale)에 짧은 갱신 절 추가 — "R-CCA-7 이 기각한
  '7번째 함수 신설' 패턴은 이후 `escapeControlText`(§R-CC-X 이관)로 실제 채택됐다: R-CCA-5/R-CCA-7 이
  방어하려던 대상은 *provider 별 분기가 필요한 신규 렌더링 책임*(renderPresentationNode 류)이었고,
  `escapeControlText` 는 이미 존재하던 provider-escape 책임을 `renderNode` 밖으로 명시적으로 분리한
  것이라 성격이 다르다"는 취지의 rationale-continuity 문구. 또는 최소한 R1/R2 헤더의 "6함수"를
  "7함수"로 정정. `control-plane-provider-escape.md` 의 "spec 동기" 체크박스를 이 갱신 완료 후 다시
  확인하는 편이 안전.

### [INFO] 완료된 plan 의 잔여 백로그 항목이 이번 변경으로 moot 됐으나 주석이 갱신되지 않음

- target 위치: (간접) `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts` —
  `TELEGRAM_RAW_SEND_HINT_KEYS` / `LanguageHintsRawSendValidator` 전체 삭제
- 관련 plan: `plan/complete/eia-command-waiting-surface-guard.md` 상단 "미채택 백로그" 목록 —
  "`TELEGRAM_RAW_SEND_HINT_KEYS` 컴파일타임 연동"
- 상세: 완료된 plan(`plan/in-progress` 아님, 엄밀히는 본 체크 범위 밖)에 남아있던 백로그 항목이
  이번 diff 로 대상 상수 자체가 삭제돼 더 이상 유효하지 않다. 향후 누군가 이 backlog 를 그대로
  집어 든다면 이미 없는 식별자를 찾게 된다.
- 제안: 저비용이므로 참고로만 남김 — `plan/complete/eia-command-waiting-surface-guard.md` 상단
  백로그 줄에 "(2026-07-16 `control-plane-provider-escape.md` 로 moot — F-5 자체 제거)" 각주를
  추가하면 향후 혼선을 막을 수 있다. `plan/complete/**` 편집은 통상 이런 종류의 후속 각주로만
  이뤄지므로 강제는 아님.

## 결정 필요 항목 충돌 여부

`plan/in-progress/**` 전체를 훑었을 때 target 이 우회하거나 일방적으로 결정을 내리는 "결정 필요"
항목은 없었다. 오히려 target 이 실행하는 결정("defaults per-provider escape 이관")은
`plan/complete/eia-command-waiting-surface-guard.md` §F-5 가 명시적으로 "미채택(백로그): ...
근본 해결은 발송 경로의 per-provider escape 이관(hooks 직접 발송 대신 어댑터 escape). 별도 작업."
이라고 예고해 둔 항목을 그대로 이행한 것이며, 소유 plan `control-plane-provider-escape.md` 도
"사용자 결정(2026-07-14): '근본 fix 를 하자'"로 착수 근거를 명시하고 있다. 선행 조건 미해소나
후속 plan 항목 무효화도 발견되지 않았다 — `chat-channel-discord-gateway.md` /
`chat-channel-slack-socket-mode.md` /`chat-channel-visual-ssr-png.md` 등 인접 in-progress plan
은 각각 별개 관심사(Gateway 모드, Socket Mode, SSR PNG)이며 escapeControlText 도입과 교차하지
않는다.

## 요약

target(`spec/5-system/15-chat-channel.md` 및 연동 `chat-channel-adapter.md`)의 변경은 정확히
그 소유 plan(`plan/in-progress/control-plane-provider-escape.md`)이 명시한 범위이며, 그 plan
자체가 이미 완료된 `eia-command-waiting-surface-guard.md`(F-5)가 예고한 "미채택 백로그"를 예정대로
이행한 것이라 plan 계보상 정당하다. `plan/in-progress/**` 의 다른 어떤 문서도 이 변경과 충돌하는
"결정 필요" 항목을 갖고 있지 않고, 선행 조건 미해소도 없다. 다만 target 자신이 `chat-channel-adapter.md`
에 신규 필수 함수(`escapeControlText`)를 추가하면서, 같은 문서의 Rationale(R1/R2/R-CCA-7)이 여전히
"6함수 불변식 유지·7번째 함수 신설 기각"을 주장하는 자기모순을 남겨 뒀다 — 소유 plan의 "spec 동기"
체크박스가 완료로 표시돼 있으나 이 부분은 반영되지 않은 것으로 보여 WARNING 처리했다.

## 위험도

LOW
