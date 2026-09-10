# Rationale 연속성 검토 — telegram signing carve-out

## 발견사항

### [CRITICAL] R-CC-21 "우회의 형태" 절의 무한정 문장(`:750`)이 변경안 B의 좁히기 대상에서 빠졌다

- **target 위치**: `plan/in-progress/spec-draft-telegram-signing-carveout.md` "## 변경안" 표
  항목 **B** — `15-chat-channel.md ### R-CC-21 (:734 제목 · :761 본문)`. 항목 설명은
  "본문 상단에 두 축 한정 caveat 를 눈에 띄게 배치하고, `:761` 의 *"경로가 비밀을 쓰지
  않는다"* 를 좁힘" 이라고만 적혀 있다.
- **과거 결정 출처**: `spec/5-system/15-chat-channel.md` `### R-CC-21` `#### 우회의 형태` 절,
  **`:750`**: `**PATCH 는 어떤 비밀도 받지 않고, 어떤 비밀도 쓰지 않는다.**`
- **상세**: R-CC-21 본문 안에는 무한정("모든 비밀") 선언이 **두 곳** 있다 — `:750`("우회의
  형태" 절의 결론 문장)과 `:761`("처방의 함정" 절의 D-2). target 의 변경안 B 는 `:761` 만
  명시적으로 좁히기 대상으로 지정한다. `:750` 은 목록에 없다. "본문 상단 caveat" 가 `:750`
  도 포괄하는지는 명시돼 있지 않다 — 두 문장이 서로 다른 소절(`#### 우회의 형태` vs
  `#### 처방의 함정`)에 있고, target 의 "다섯 자리" 그루핑(`:734/761`)이 이 두 문장을 하나로
  뭉뚱그려 실제로는 `:761` 만 짚었다. 이 상태로 변경안이 적용되면 §5.4.1.1 에 telegram 행이
  신설된 **바로 그 R-CC-21 항목 안**에서 `:750` 이 "PATCH 는 어떤 비밀도 쓰지 않는다" 를
  여전히 무조건문으로 선언해, 새로 도입되는 telegram `issuedInboundSigning` 자동 갱신과
  **같은 rationale 항목 내부에서** 직접 모순한다.
  - 근거로 대는 target 자신의 "재발 기록" 절이 이미 같은 유형의 실패("파일 단위로 대조해
    파일 **내부**의 두 번째 blanket 자리를 못 봤다")를 2회 자인했고, 3R 대응으로 "주장
    문구 자체를 `spec/` 전체에서 전수 grep" 하는 방법으로 전환했다고 적었다. 그런데 그
    grep 패턴(`비밀을 쓰지 않는다`)은 `:750` 의 실제 문구(`비밀도 쓰지 않는다` — 조사
    "을"→"도")와 한 글자 달라 매칭되지 않는다(직접 확인:
    `grep -rn "어떤 비밀도" spec/` → `:750`·`:776` 히트, 반면 target 이 적은 grep 패턴은
    `:750` 을 놓친다). 즉 "전수 grep 으로 방법을 바꿨다" 는 3R 대응 자체가 **네 번째로
    같은 병을 앓을 자리를 하나 남겼다**.
- **제안**: 변경안 B 항목에 `:750` 을 명시적 좁히기 대상으로 추가하거나(예: "PATCH 는
  botToken 값 교체와 slack/discord `inboundSigningPlaintext` 회전을 받지도 쓰지도 않는다 —
  telegram 의 server-issued 축은 [D-A](#) 참조"), 최소한 "본문 상단 caveat" 배치 지점을
  `#### 우회의 형태` 절 진입 **이전**으로 명시해 `:750` 도 그 caveat 의 스코프 안에
  들어온다는 것을 문서에 남길 것. 재발 방지를 위해 향후 전수 grep 패턴에는 조사 변형(을/이/도/는)
  까지 포함하거나, 조사를 제거한 어간 매칭(`비밀.{0,2}쓰지 않는다`)을 쓸 것.

## 요약

target 의 핵심 결정(D-A/D-B/D-C — telegram `issuedInboundSigning` 을 botToken·slack/discord
`inboundSigningPlaintext` 와 분리해 PATCH-trigger `setupChannel()` 재발급·재저장을 허용)은
Rationale 연속성 관점에서 전반적으로 건실하다. 실측으로 직접 확인한 근거:

- 어제 결정(`df1962e25`/`R-CC-21`)을 **번복이 아니라 좁히기**로 정확히 자리매김했고, D-B 가
  R-CC-21 이 든 세 가지 피해(외부 등록 mismatch·24h grace 일관성·audit mixing)를 하나씩
  반증하는 방식으로 **새 Rationale 을 실제로 작성**했다 — 무근거 번복이 아니다.
- 두 축(server-issued vs provider-issued) 구분은 신설이 아니라 이미 `2-trigger-list.md
  R-12`("telegram 은 server-issued 라 본 필드 미사용"), `conventions/secret-store.md §5.5`
  (server-issued 경로가 `setupChatChannel` 매 호출마다 `secrets.rotate` 를 재실행하는 코드
  예시 포함), `conventions/chat-channel-adapter.md §2.3/§2.4`(provider 별 발급 주체 표 +
  `issuedInboundSigning` 필드 정의)에 이미 박혀 있던 경계임을 직접 대조로 확인했다 — "기각된
  대안의 재도입" 이나 "합의된 원칙 위반" 에 해당하지 않는다.
- `CCH-AD-02`(요구사항 표, 필수)가 실제로 "enable / 신규 생성" 만 명시해 세 번째 갈래(일반
  PATCH)를 안 덮는다는 target 의 지적(변경안 D)도 실측과 일치하고, `CCH-SE-04`(bot token
  24h grace)가 botToken 전용이며 inbound-signing 축에는 대응하는 grace/audit 계약이 spec
  어디에도 없다는 D-B 의 주장도 `audit-actions.md`·§4.2 컬럼 정의 대조로 확인된다 — 시스템
  invariant 를 몰래 우회하는 설계가 아니다.
- target 이 스스로 열거한 5개 좁히기 자리(`2-trigger-list.md:176`·`15-chat-channel.md:392`·
  `:614`·`:734/761`·`data-flow/14-chat-channel.md:151`)를 동일한 문구 패턴으로 독립
  재grep 해 정확히 일치함을 확인했다 — 다만 그 grep 패턴 자체가 한 글자 차이로 `:750` 을
  놓쳤다(위 CRITICAL 참조). 이 한 곳을 제외하면 나머지 커버리지는 정확하다.

## 위험도

HIGH — 결정의 설계·근거 자체는 건실하고 기각된 대안의 재도입·합의 원칙 위반 사례는 발견되지
않았다. 다만 변경안 B 의 좁히기 목록에서 R-CC-21 본문 내부의 세 번째 무한정 문장(`:750`)이
빠져 있어, 이 상태로 target 을 그대로 spec 에 적용하면 새로 신설되는 telegram 행과 **같은
rationale 항목(R-CC-21) 안에서** 직접 모순하는 문장이 남는다. 이 한 줄을 변경안 B 의 좁히기
대상에 추가 반영하면 위험도는 해소된다 — spec 반영 전에 처리해야 하는 차단 사유로 판단해
HIGH 로 표기한다(CRITICAL 로 격상하지 않는 이유는 대상이 아직 적용 전 draft plan 이고 수정
범위가 한 줄에 그치기 때문).
