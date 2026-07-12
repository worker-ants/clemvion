### 발견사항

- **[WARNING]** 카루셀 잘림 배너 후속 plan 이 신설 i18n(ko/en parity) 요구를 아직 반영하지 않음
  - target 위치: `plan/in-progress/spec-draft-webchat-en-i18n.md` §3.1(ko/en leaf key parity 필수 + 위젯 로컬 parity 테스트) · §3.5 인벤토리(표에 `table.truncated*` 는 포함되나 carousel 배너는 미구현이라 미포함) · Edit C(`1-widget-app.md` 신설 `## 4. i18n` 절)
  - 관련 plan: `plan/in-progress/webchat-widget-presentation-followups.md` "미구현 항목" #2(카루셀 잘림 배너 미구현) + "착수 조건"(`project-planner 가 1-widget-app.md §2 에 표시 계약을 먼저 정의해야 한다 — 총 개수 노출 여부·카루셀 배너 문구`)
  - 상세: `webchat-widget-presentation-followups.md` 는 target 작성 이전에 쓰여 "카루셀 배너 문구"를 단수(한국어 1건)로만 전제한다 — 그 시점엔 위젯에 i18n 메커니즘 자체가 없었기 때문. target 이 위젯 chrome 전체에 ko/en parity(위젯 로컬 catalog + parity 테스트 가드)를 신설하면, 향후 이 followups plan 항목을 착수하는 project-planner/developer 는 카루셀 배너 문구를 **ko/en 두 언어로 동시에** 정의하고 신설 i18n 키 경유로 구현해야 한다. target 은 이 교차 참조를 어디에도 남기지 않는다(§8 후속 핸드오프도 이 followups plan 을 언급하지 않음).
  - 제안: (a) target §8(후속) 또는 Edit C 말미에 "향후 위젯 chrome 문자열 추가(예: `webchat-widget-presentation-followups.md` 카루셀 배너)는 본 i18n 메커니즘·parity 가드를 통과해야 한다"는 한 줄 교차 참조를 추가하거나, (b) `webchat-widget-presentation-followups.md` 의 "착수 조건" 문구를 "표시 계약(ko/en 문구, `1-widget-app.md §4` i18n 키 경유)을 먼저 정의"로 갱신. 어느 쪽이든 실질 차단(parity 테스트가 신규 키 시점에 자동 강제)까지는 아니라 WARNING 수준.

### 요약

`plan/in-progress/spec-draft-webchat-en-i18n.md` 가 전제하는 선행 결정(#922 `webchat-i18n-scope`, (c) 기각 defer + spec 의 명시적 예약)은 이미 `plan/complete/`로 merge 완료(commit 79f50cf54)돼 있어 "선행 plan 미해소" 문제는 없다. `plan/in-progress/**` 전체를 `위젯|widget|channel-web-chat|locale|i18n` 키워드로 훑은 결과, target 이 우회하는 "결정 필요" 미해결 항목이나 target 전제와 충돌하는 활성 결정은 발견되지 않았다(같은 이름의 `chat-channel-*` plan 들은 Telegram/Slack/Discord 봇 채널로 별개 스코프). 유일한 정합성 이슈는 `webchat-widget-presentation-followups.md` 의 미구현 카루셀 잘림 배너 항목이 target 이 신설하는 ko/en parity 요구를 아직 인지하지 못한 채 남아 있다는 점이며, 이는 향후 그 항목 착수 시 재작업(문구 소급 EN화) 리스크로 이어질 수 있는 경미한 후속 항목 누락이다.

### 위험도
LOW
