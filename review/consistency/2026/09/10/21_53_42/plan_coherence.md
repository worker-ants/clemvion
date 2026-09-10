# Plan 정합성 검토 — `spec-draft-telegram-signing-carveout.md`

## 발견사항

- **[WARNING]** telegram carve-out 이 자매 plan 의 CRITICAL 처방문(D-2)에 아직 반영되지 않았다 —
  체크리스트 항목만으로는 재발을 못 막는다
  - target 위치: `plan/in-progress/spec-draft-telegram-signing-carveout.md`
    - `## 이 턴에 하지 않는 것` 95~96행 — *"R-CC-21 발견을 origin 트래커에 등재 … 트래커에는
      'planner 턴으로 처리 완료' 로 닫는다"*
    - `## 체크리스트` 107행 — `- [ ] 트래커 갱신 (R-CC-21 항목 종결 + details.field 범위 확대)`
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 1894~1978행,
    항목 **`- [ ] CRITICAL: chatChannel PATCH 가 bot token single-path 를 우회한다`**
    (developer, 2026-09-10 등재, `- [ ]` 미완 — "developer 수정 대기")
  - 상세: 이 CRITICAL 항목이 developer 가 실제로 집어 들 구현 지시문이고, 요약 문장(1957~1959행)이
    `D-2 PATCH 경로는 비밀을 쓰지 않는다(관측 계약: 그 요청 전후로 두 비밀이 동일)` 라고 **provider
    구분 없이** 적혀 있다. `target` 문서 자신의 "왜 이 턴이 생겼나" 절이 밝히는 실제 사고 경위가
    정확히 이 문장의 문자 그대로 구현이다 — target 의 "두 갈래 다 문제다" 표 (a) 행: *"문면대로
    `:987-993` 까지 skip → 401. 동작 파손"*. 즉 D-2 를 이 문서 그대로 읽고 구현하면 이 턴이 막으려는
    바로 그 결함이 재발한다.

    같은 파일의 **두 번째** CRITICAL 항목(`ChatChannelCard` 편집-저장이 항상 400, 1980~2008행)에는
    이미 `> **(2026-09-10 정정)** … telegram 한정으로만 참이었다` 라는 인라인 각주가 붙어 있다 —
    이 저장소가 쓰는 정정 관례가 바로 이 패턴이다. 그런데 **같은 파일, 같은 날짜의 첫 번째
    CRITICAL 항목(D-1/D-2/D-3, telegram carve-out 이 직접 영향을 주는 그 항목)에는 이 관례가
    적용되지 않았다** — 전수 확인(`grep -n "telegram\|carve\|issuedInboundSigning"
    spec-draft-nullable-notation-followups.md`) 결과 매치 0건.

    target 의 체크리스트 107행("트래커 갱신")은 이 격차를 메울 자리로 지정돼 있지만 (1) 현재
    시점 기준 아직 미실행(`- [ ]`)이고 (2) 문구가 "R-CC-21 항목 **종결**" 이라 체크박스만 닫고
    D-2 본문 문구는 그대로 두는 최소 실행으로도 통과할 수 있다 — 그 경우 격차가 그대로 남는다.
  - 제안: "트래커 갱신" 체크리스트 항목을 실행할 때 **체크박스만 닫지 말고**, 두 번째 CRITICAL
    항목에 쓴 것과 같은 형식의 각주를 D-1/D-2/D-3 요약 문장(1957~1959행) 바로 아래에 추가할 것 —
    예: *"D-2 는 telegram 의 server-issued `issuedInboundSigning` 축에는 적용되지 않는다 — 그 축은
    `setupChannel()` 재호출의 부수효과로 계속 갱신·저장된다(상세: R-CC-21 carve-out,
    `spec-draft-telegram-signing-carveout.md`)."* 이 각주가 없으면 `plan/complete/` 로 이동하는
    순간 이 정정 맥락이 그 문서(`spec-draft-nullable-notation-followups.md`, 아직 in-progress)에는
    남지 않고 target 쪽에만 남아, 다음 사람이 CRITICAL 항목만 열어 볼 경우 같은 사고를 반복할
    수 있다.

## 그 외 확인한 항목 (결함 아님 — 정합 확인)

- **선행 plan 해소 확인**: target 이 전제하는 "PR #1311(`df1962e25`) 이 R-CC-21 을 이미 결정했다"는
  실측으로 확인됨 — `spec/5-system/15-chat-channel.md:734` 에 `### R-CC-21` 본문이 현재
  존재하고, §5.4.1(:376)·data-flow/14-chat-channel.md(:151)·2-navigation/2-trigger-list.md(:176)
  세 곳 모두 "PATCH 는 저장된 비밀을 바꾸지 않는다" 는 (telegram 예외 없는) 현재 문면과 일치한다.
  즉 target 이 고치려는 대상이 실제로 존재하고, 그 전제인 R-CC-21 결정 자체는 이미 확정 상태다.
- **§5.4.1.1 이 이미 "slack / discord 한정" 임**: 실측 확인(`grep -n "5411"` 로 절 제목 확인) —
  target 의 "이미 그어져 있던 경계" 주장이 사실과 일치한다.
- **`R-CC-21` 채번 충돌 없음 재확인**: `plan/in-progress` 전수에서 `R-CC-21` 을 이미 점유한
  다른 in-progress 항목 없음(`spec-sync-chat-channel-gaps.md` 는 이미 `plan/complete/` 로 이동).
- **다른 chat-channel 계열 in-progress plan 과 충돌 없음**: `chat-channel-discord-gateway.md`,
  `chat-channel-slack-socket-mode.md`, `chat-channel-visual-ssr-png.md` 는 각각 게이트웨이 연동·
  소켓 모드·PNG 렌더링을 다루며 PATCH 비밀-쓰기 축과 교차하지 않는다(전수 grep 확인).
  `auth-guard-reflection-hardening.md` 의 `15-chat-channel.md §5.4` 언급은 워크스페이스 UUID
  검증 축이라 무관하다. `webchat-*` 계열은 `channel-web-chat` 위젯(별도 도메인)이라 무관하다.
- **change E (§5.4.1 표 2행)**: `spec-draft-nullable-notation-followups.md` 2031~2038행의
  아직 열려 있는 항목("활성화 PATCH 가 `setupChannel` 재호출하는지 불확실")과 정합한다 —
  target 은 이 불확실성을 **해소**하지 않고 자매 행과 같은 형식의 캐비아트만 부여하겠다고
  명시해, 그 plan 항목이 요구하는 실측(e2e 확인) 없이 결론을 앞지르지 않는다.
- **change D (CCH-AD-02)**: target 스스로 "forward-link, 이 턴에 안 고침" 으로 명시 — 미해결
  상태를 감추지 않고 열어 둔 정상적 처리다.

## 요약

target 의 핵심 판단(telegram 의 server-issued `issuedInboundSigning` 은 R-CC-21 의 "PATCH 는
비밀을 쓰지 않는다" 스코프 밖이라는 D-A/D-B/D-C)은 spec 실측과 정합하고 R-CC-21 을 번복하지
않는 좁히기로 타당하다. 다만 이 결정이 실제로 막아야 하는 사고(문면 그대로 구현 시 텔레그램
401 파손)의 **직접 원인이 되는 자매 plan 의 CRITICAL 처방문**(`spec-draft-nullable-notation-
followups.md` D-1/D-2/D-3, 아직 미완 상태)에는 telegram 예외가 아직 반영되지 않았다. target 은
이를 체크리스트 항목("트래커 갱신")으로 인지는 하고 있으나, 현재 시점 실행이 안 됐고 문구도
"체크박스 종결" 로 읽힐 여지가 있어 — 같은 파일의 두 번째 CRITICAL 항목에 이미 쓴 각주 관례를
따르도록 명시적으로 좁혀야 재발을 막을 수 있다. 그 외에는 관련 in-progress plan 들과 충돌·
선행 미해소·후속 무효화 없음.

## 위험도

MEDIUM
