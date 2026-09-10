# Plan 정합성 검토 — `spec-draft-chat-channel-patch-token.md` (2라운드)

1라운드(`20_13_39`, BLOCK: YES)의 지적 3건(W1/W2/`R-CC-17` 충돌)이 이번 개정에서 각각
후속 5번·변경안 C·`R-CC-21` 정정으로 반영된 것을 확인했다. 이번 라운드는 좁힌 4개 초점만
다룬다.

## 발견사항

- **[INFO]** 범위 확장(변경안 C)은 다른 in-progress plan 과 충돌하지 않는다 — 근거를 실측으로 확인
  - target 위치: `## 구조가 같은 두 번째 우회가 바로 옆에 있다`, `## 변경안` C, `## 이 turn 에서 하지 않는 것` 마지막 줄
  - 관련 plan: `plan/in-progress/chat-channel-slack-socket-mode.md`, `plan/in-progress/chat-channel-discord-gateway.md` (둘 다 `status: backlog`, `worktree: (unstarted)`)
  - 상세: 두 CRITICAL 트래커 항목(`spec-draft-nullable-notation-followups.md`)은 원래 `botToken` 만
    적었지만, 이번 draft 는 "PATCH 는 어떤 비밀도 쓰지 않는다" 로 규칙을 통일하며 `inboundSigningPlaintext`
    도 함께 막는다(변경안 C). 이 확장이 다른 in-progress plan 의 `inboundSigning` 관련 결정과
    충돌하는지 저장소 전체(`plan/in-progress/**`)를 `inboundSigning`·`botTokenRef`·`rotate-bot-token`·
    `ChatChannelConfigDto`·`assertChatChannelInputSafe`·`setupChatChannel`·`§5.4.1` 키워드로 전수
    검색했다 — 이 draft 와 그 부모 트래커(`spec-draft-nullable-notation-followups.md`) 두 파일
    바깥에는 어디에도 등장하지 않는다. 유일하게 이름이 겹치는 두 plan(`chat-channel-slack-socket-mode.md`
    · `chat-channel-discord-gateway.md`)을 직접 열어 확인한 결과, 둘 다 **transport 계층**(Socket
    Mode WebSocket · Discord Gateway WebSocket 도입)을 다루는 backlog 항목이고 `inboundSigning`
    회전 정책 자체는 언급하지 않는다. 또한 draft 자신이 "§5.4.1.1 의 v2 회전 결정은 건드리지 않는다"
    로 v2 설계 공간을 명시적으로 비워 두므로, 장래 이 두 backlog plan 이 착수되더라도 겹칠 결정
    표면이 없다.
  - 제안: 없음 — 현재 상태로 충돌 없음. draft 의 "밑에 깔린 결정이 하나라 쪼개면 규칙을 반만
    쓴다" 는 근거는 유효하다.

- **[WARNING]** 후속 5건이 목적지 파일·형식(owner/date/source) 없이 나열돼 있어 "적용 커밋에서
  그대로 등재" 하기엔 한 단계가 비어 있다
  - target 위치: `## 후속으로 등재할 것` (1~5번 목록)
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` `## 후속 (이 draft
    범위 밖 — 등재만)` — 이 트래커 안의 다른 모든 등재 항목(예: "질문: 비밀-부재 헬퍼를
    `secret-store.md` 의 `code:` 에도 등재해야 하나", "하드닝: 트리거 비밀 컬럼 목록이 3중 독립
    사본이다" 등 최소 6개 이상 사례)은 예외 없이 `- [ ] **제목** (owner, 날짜 등재, 근거출처)`
    형식을 쓴다.
  - 상세: 1라운드 지적 #7("후속 2건을 '등재한다' 고 선언만 하고 등재 안 했다 — 직전 턴에 같은
    지적을 받고 또 그랬다")은 "목록화" 자체는 이번에 해소됐다(2건 선언 → 5건 구체 목록). 그러나
    이 5개 항목은 여전히 (a) **어느 파일의 어느 섹션에 들어가는지**가 문면에 없고(1~4번은 새
    항목이라 목적지가 자명하지 않다 — `spec-draft-nullable-notation-followups.md` 의 `## 후속`
    에 이어 붙이는 것인지, 다른 트래커를 새로 여는 것인지 draft 는 말하지 않는다), (b) **owner**
    (developer/planner)·**date**·**source 인용**이 없어, 이 저장소 전체가 관례로 삼는 등재 형식과
    다르다. 특히 5번("트래커의 두 CRITICAL 처방문을 D-1/D-2/D-3 로 갱신")은 1라운드 지적 #6의
    처분("적용 커밋에서 갱신")과 짝을 이루는데, "후속으로 등재할 것" 이라는 절 제목이 "지금 바로
    고쳐야 할 기존 두 항목의 수정" 과 "새로 만들 4개 항목의 등재" 를 구분 없이 같은 어조로 묶어,
    적용 시점에 "5번도 새 체크박스를 추가하는 것" 으로 오독될 여지가 있다(그러면 기존 두
    CRITICAL 처방문은 옛 서술 그대로 남아 developer 가 D-2 없는 낡은 처방("PATCH 전용 DTO 변형
    — botToken 만 제외")을 그대로 따라갈 위험이 재현된다 — 이 draft 자신이 "그것만 하면 지금보다
    나빠진다" 고 지적한 바로 그 실패 모드다). 이 트래커는 정확히 이 클래스의 실패(선언만 하고
    미등재)를 이미 두 번 지적받은 이력이 있다(1라운드 #7, 그리고 그 이전 턴).
  - 제안: 적용 커밋에서 (i) 5번은 **새 체크박스가 아니라 기존 두 CRITICAL 항목의 본문을 직접
    수정**하는 것임을 draft 본문에 한 문장으로 못박고, (ii) 1~4번은 목적지 파일(가장 자연스러운
    후보는 `spec-draft-nullable-notation-followups.md` `## 후속` 계속 — 이 트래커의 종결 조건이
    "`## 후속` 체크박스 전부 닫힘" 이므로 새 항목을 거기 추가하면 종결 조건에도 자동 편입된다)과
    owner/date/source 를 이 저장소 관례 형식으로 채워 넣을 것.

- **[INFO]** `ChatChannelCard` 처분 — "무수정 통과" 는 구현 대기 상태이며 draft 는 이를 정확히
  반영하고 있다 (재확인, 새 지적 아님)
  - target 위치: `## 이 turn 에서 하지 않는 것` 둘째 항목
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 의 "버그: `ChatChannelCard` 편집-저장이
    항상 400 이다" (여전히 `- [ ]` 미체크 상태로 남아 있음을 파일에서 직접 확인)
  - 상세: draft 는 "D-1·D-2·C 가 **반영되면**" 이라는 조건절로 미래형을 명시하고, 별도 첫 항목으로
    "구현 — DTO 분리·`setupChatChannel` 분기는 developer 턴" 을 적어 이번 턴(spec 만 쓰는 턴)이
    코드를 바꾸지 않음을 분명히 한다. 실제로 부모 트래커의 두 CRITICAL 체크박스는 지금도 미체크
    상태이므로, spec 결정만으로 이 버그가 닫히는 것처럼 잘못 표시된 곳은 없다. 1라운드 W2 가
    지적한 "C 없이는 telegram 한정으로만 참" 도 이번에 "C 를 포함해야 성립한다" 로 명시 정정됐다.
    D-1(present→400)+D-2(PATCH 가 시크릿을 쓰지 않는다)+C(inboundSigningPlaintext 도 차단)가
    구현되면 PATCH DTO 가 두 값 필드를 요구하지 않게 되고, `chat-channel-card.tsx` 는 이미 두
    필드를 생략하므로 코드 변경 없이 통과한다는 논리 연쇄도 착수 전 재판정 표(호출자 1곳, 두
    필드 다 생략)와 맞아떨어진다.
  - 제안: 없음 — 처분 정확함. (참고로 확인차 살펴본 것으로, 재지적이 아니라 이번 라운드
    focus #3 에 대한 긍정 확인이다.)

- **[INFO]** (참고, 이번 draft 의 책임 밖) `spec/5-system/15-chat-channel.md` frontmatter
  `pending_plans:` 가 이미 완료된 `spec-sync-chat-channel-gaps.md` 를 여전히 가리킴
  - target 위치: 해당 없음 (draft 가 이 필드를 건드리지 않음)
  - 관련 plan: `plan/complete/spec-sync-chat-channel-gaps.md` (완료, mtime 이 draft 시작보다 이름)
  - 상세: `15-chat-channel.md` frontmatter 의 `pending_plans:` 목록에 `plan/in-progress/spec-sync-chat-channel-gaps.md` 가 있으나 그 파일은 이미 `plan/complete/` 로 이동됐다. 이 draft 의 결정(D-1/D-2/D-3, 변경안 A~F)과는 무관한 내용(실행 상태 forwarding·rate-limit·rotate-bot-token 응답 필드)이라 충돌은 없다.
  - 제안: 이 draft 의 적용 커밋이 같은 파일을 편집하는 김에 stale 참조를 제거하면 좋으나, 범위 밖이라 강제하지 않는다.

## 요약

이번 라운드의 4개 좁은 초점 중 셋(①범위 확장 정당성, ③`ChatChannelCard` 처분 정확성, ④재지적
금지)은 문제 없음으로 확인됐다 — 특히 ①은 `plan/in-progress/**` 전수 검색과 이름이 겹치는 두
backlog plan(Slack Socket Mode·Discord Gateway)을 직접 열어 대조한 결과 `inboundSigning` v1/v2
결정 공간을 다투는 다른 plan이 없음을 실측으로 확인했다. 남은 하나(②후속 5건의 등재 가능성)는
내용 자체는 타당하지만 목적지 파일·owner/date/source 형식이 비어 있어, 이 트래커가 이미 두 번
겪은 "선언했지만 실제 등재 안 함" 실패의 3번째 재발 여지를 완전히 닫지는 못했다 — 특히 5번
항목("트래커 처방문 D-1/D-2/D-3 갱신")이 "새 후속 등재" 로 오독되면 developer 가 낡은 처방을
그대로 집행해 D-2 없이 봇 토큰을 파괴하는, 이 draft 가 스스로 경고한 바로 그 실패가 재현될 수
있다. CRITICAL 수준의 결정 충돌이나 미해소 선행조건은 없으므로 차단 사유는 아니지만, 적용
커밋 전에 이 형식 갭을 메우는 것을 권한다.

## 위험도

LOW
