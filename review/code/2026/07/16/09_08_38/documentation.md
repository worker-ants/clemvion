# 문서화(Documentation) 리뷰

## 발견사항

- **[WARNING]** "함수 개수 6 유지" Rationale 서술이 이번 카운트 정합화 델타에서 누락됨 (2곳, 서로 다른 파일)
  - 위치: `spec/conventions/chat-channel-adapter.md` `### R-CCA-7. renderNode 시그니처 union 확장 — chat-channel-internal 이벤트 수용` 본문의
    `"...함수 개수 6 을 유지해 [R-CCA-5]... 정신을 보존한다."`; 그리고 `spec/5-system/15-chat-channel.md` (line 680)
    `"...함수 개수 6 유지. SoT: [Convention §R-CCA-7]..."`.
  - 상세: 이번 델타는 `escapeControlText` 추가로 어댑터 필수 함수가 6→7개가 된 데 따라 "6함수" 하드코딩 표현을
    "핵심 함수"/"어댑터 인터페이스" 로 일반화하는 것이 명시 목적이다. 실제로 discord/slack adapter spec 의 테스트명,
    `slack.adapter.ts` Phase 1 주석, `chat-channel-adapter.md` R1/R2 헤딩, `15-chat-channel.md` 의
    "6함수 인터페이스" 서술은 정확히 갱신됐다. 그러나 두 파일에 남아있는 R-CCA-7 Rationale 본문의
    "함수 개수 6 을(유지)" 라는 명시적 숫자 단언은 손대지 않았다 — `escapeControlText` 가 신설된 지금 시점에서
    읽으면, 같은 파일 안에서 몇 문단 위 R1/R2 헤딩은 숫자를 뺐는데 R-CCA-7 은 여전히 "6" 을 사실처럼
    서술하는 자기모순이 발생한다(§1 인터페이스 정의는 `escapeControlText` 를 옵션이 아닌 필수 함수로 명시하므로
    현재 필수 함수는 7개). 참고: 직전 리뷰 라운드(`review/code/2026/07/16/08_30_00`)에서 동일 클래스의 이슈가
    WARNING 으로 지적됐고 RESOLUTION.md 는 "types.ts/R-CCA 본문 6함수 일반화" 를 조치 항목으로 명시했는데,
    이번 라운드의 실제 diff 는 R1/R2 헤딩만 갱신하고 R-CCA-7 본문의 숫자 단언은 반영하지 않은 것으로 보인다.
    (앵커 자체는 깨지지 않음 — R1/R2 헤딩 rename 에 대한 cross-reference 는 저장소 전체에 없음을 grep 으로 확인.)
  - 제안: 두 위치의 "함수 개수 6 (을) 유지" 를 "함수 개수 불변(변경 대상은 `renderNode` 시그니처뿐)" 또는
    "기존 필수 함수 목록은 그대로" 같은 숫자-비의존 표현으로 바꾸거나, 최소한 "(당시 6개, 현재는
    `escapeControlText` 포함 7개)" 같은 각주를 추가해 시점 혼동을 없앨 것.

- **[INFO]** R2 Rationale 제목이 `escapeControlText` 를 포함하도록 확장됐으나 본문은 여전히 `ackInteraction` 분리 근거만 설명
  - 위치: `spec/conventions/chat-channel-adapter.md` `### R2. 어댑터 함수(필수 코어 + ack + escapeControlText) 의 의도`
  - 상세: diff 는 제목만 "5+1 ack" → "필수 코어 + ack + escapeControlText" 로 확장했고, 본문 문단은 이전 그대로
    ack 를 별도 함수로 분리한 이유만 서술한다. `escapeControlText` 를 `renderNode`/`sendMessage` 에 흡수하지 않고
    별도 메서드로 둔 설계 의도(§1 JSDoc 에 일부 서술은 있으나 Rationale 절에는 없음)는 제목이 암시하는 것과 달리
    본문에 없다.
  - 제안: 본문에 "`escapeControlText` 는 `renderNode` 우회 발송 경로 전용이라 별도 함수로 분리 — `renderNode`/`sendMessage`
    에 흡수하면 pure/side-effect 계약이 섞인다" 정도의 1~2문장을 추가하거나, 제목에서 `escapeControlText` 언급을
    제거하고 별도 Rationale 항목(R-CCA-9 등)으로 분리할 것.

## 요약

이번 델타는 명시된 목적(`"6함수"` → `"핵심 함수"` 표현 일반화 + `escapeControlText` 반영에 따른 카운트 정합화)을
discord/slack adapter 테스트 설명, `slack.adapter.ts` Phase 주석, `chat-channel-adapter.md` R1/R2 헤딩,
`15-chat-channel.md` 어댑터 인터페이스 서술 등 핵심 지점에서는 정확히 이행했고, CHANGELOG 의 배포 마이그레이션
주의 문구 추가도 SoT 링크를 포함해 충실하다. 다만 같은 정합화 작업의 사정권 안에 있는 R-CCA-7 Rationale
본문의 "함수 개수 6 유지" 단언(두 파일, cross-file)이 갱신에서 누락되어 문서 내부 자기모순이 남았다 —
직전 라운드에서 이미 지적·조치 대상으로 식별됐던 동일 클래스의 잔존 항목이다. 기능·테스트에 영향은 없는
순수 문서 일관성 이슈이며 anchor 파손 등 연쇄 손상은 없음을 확인했다.

## 위험도

LOW
