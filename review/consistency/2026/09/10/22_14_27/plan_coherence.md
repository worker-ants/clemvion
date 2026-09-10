# Plan 정합성 검토 — spec-draft-telegram-signing-carveout.md (3R)

## 검토 범위와 방법

- Target: `plan/in-progress/spec-draft-telegram-signing-carveout.md` (변경안 A~H, 결정 D-A/D-B/D-C)
- 대조: `plan/in-progress/**` 전체(63개 생략 파일 포함, 관련 키워드로 개별 확인) +
  선행 완료 plan `plan/complete/spec-draft-chat-channel-patch-token.md` + 현재
  `spec/5-system/15-chat-channel.md` 실제 본문(target 이 인용하는 앵커가 유효한지 대조)

## 발견사항

- **[WARNING]** "이 턴에 하지 않는 것" 의 두 트래커 등재 예고가 변경안 A~H·체크리스트 어디에도
  구체 항목으로 없다
  - target 위치: `## 이 턴에 하지 않는 것` 2·3번째 불릿 (`details.field` 실측 캡처 범위 확장,
    `swagger.md §1` naming 규약 제안) — *"트래커에 반영한다"* / *"트래커에 등재만 한다"* 라고
    action 형으로 적혀 있다
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md:2010-2019` (기존
    `details.field` 항목, 현재 3필드 `botTokenRef`·`inboundSigningRef`·`inboundSigning` 만 기재).
    swagger.md 제안은 대상 트래커 자체가 지정되어 있지 않음
  - 상세: target 의 변경안 표(A~H)와 체크리스트(`- [ ] 변경안 A~H 적용` 등)는 모두 `spec/`
    파일 편집만 열거한다. 두 트래커 등재 행위는 표·체크리스트 어디에도 대응 항목이 없어,
    이 draft 가 `complete/` 로 이동한 뒤에는 "등재하겠다"는 서술만 과거 이력에 남고 실제
    `- [ ]` 항목은 생기지 않을 위험이 있다. 이 실패 유형은 **바로 이 plan 계열의 직전
    선행 plan** `plan/complete/spec-draft-chat-channel-patch-token.md` 의 2라운드에서 이미
    한 번 발생해 `rationale_continuity` 가 CRITICAL 로 잡았던 것과 **동일 클래스**다 — 그 문서
    자체가 *"절 제목을 바꾸고 항목을 3→5개로 늘린 것으로 응답하고 처분 칸에 '실제 등재'라고
    적었다… `plan/` 전체 grep 결과 그 다섯은 이 draft 안에만 있었고 살아 있는 트래커에는
    0건이었다"* 고 자기 이력에 기록해 두었다. target 은 그 선례를 §변경안 G 로 인용하며
    (D-1/D-2/D-3 요약 옆 telegram 각주 삽입) 트래커 편집을 이미 한 번 다루고 있으면서도,
    같은 문서 안의 나머지 두 예고 항목은 같은 방식(체크박스로 실체화)을 적용하지 않았다
  - 제안: target 체크리스트에 두 항목을 명시적으로 추가한다 — 예:
    `- [ ] spec-draft-nullable-notation-followups.md:2010 details.field 항목 범위를 5필드로 확장`,
    `- [ ] swagger.md §1 Patch 접두 금지 제안을 <어느 트래커>에 - [ ] 로 등재`. 대상 트래커가
    불명확하면(swagger.md 건) 어느 파일에 등재할지부터 이 draft 안에서 확정한다

## 정합성 확인된 부분 (참고)

- 선행 plan 정합: `plan/complete/spec-draft-chat-channel-patch-token.md` (D-1/D-2/D-3, PR #1311
  전신)이 이미 `plan/complete/` 로 적용·이동돼 있고, target 이 전제하는 `15-chat-channel.md`
  §5.4.1/§5.4.1.1/`R-CC-10`(`:614`)/`R-CC-21`(`:734/761`) 앵커가 실제 spec 본문과 위치·문구
  모두 일치함을 확인 — target 의 변경안 A/F/H 가 인용하는 "blanket 문장" 자리가 현재도 그대로
  존재한다
- 미해결 결정 충돌 없음: `plan/in-progress/**` 전체에서 `R-CC-21`·`R-CC-10`·`CCH-AD-02`·
  `issuedInboundSigning`·`inboundSigningRef`·`secret_token`·`rotate-inbound-signing` 을 grep한
  결과 target 자신과 `spec-draft-nullable-notation-followups.md` 외 어떤 in-progress plan 도
  이 표면을 다루고 있지 않다 — telegram carve-out 결정과 경합하는 "결정 필요" 항목이 다른
  plan 에 없다
  - `spec-draft-nullable-notation-followups.md:2031`(§5.4.1 표 2행 "활성화 PATCH" 불확실성,
    planner+조사 open item)은 target 의 변경안 E(같은 행에 자매 형식 캐비아트 부여)와 같은
    자리를 겨냥하지만, 변경안 E 는 그 불확실성을 "해결됐다"고 단정하지 않고 형식만 맞추므로
    두 항목이 충돌하지 않는다(단, target 이 이 교차 참조를 본문에 명시하지 않아 후속 독자가
    "이미 처리됨"으로 오인할 소지는 작게 있음 — INFO 수준)
  - `chat-channel-discord-gateway.md`·`chat-channel-slack-socket-mode.md`·
    `chat-channel-visual-ssr-png.md` 는 같은 §5.4/§5.4.1 번호대를 인용하지만 메시지 포맷 정책
    (CCH-MP-0x)과 R-D-3/R-CC-13 이라 target 의 secret 쓰기 정책과 축이 다르다 — 충돌 없음
  - `secret-store.md §5.5`(target 이 인용하는 convention)와 `spec-sync-external-interaction-api-
    gaps.md:803-805`(§1 필드 단위 비대상 예외 논의)는 같은 파일이지만 다른 절(§1 vs §5.5)을
    다루므로 충돌 없음

## 요약

Target 문서는 `plan/complete/spec-draft-chat-channel-patch-token.md` 가 이미 적용한 결정을
전제로 telegram carve-out 을 정확히 좁히고 있고, 인용 앵커·미러 문서 4곳(`:176`·`:392`·`:614`·
`:734/761`·`:151`)이 실제 spec 본문과 일치함을 확인했다. 다른 `plan/in-progress/**` 문서와
경합하는 미해결 결정이나 선행 조건 미해소는 발견되지 않았다. 다만 target 의 "이 턴에 하지
않는 것" 절이 예고한 두 건의 트래커 등재(`details.field` 범위 확장, `swagger.md` 명명 규약
제안)가 변경안·체크리스트에 구체 항목으로 나타나지 않아, 바로 이 plan 계열이 직전 라운드에서
이미 한 번 겪은 "등재하겠다고 적고 실제로 등재하지 않는" 실패가 재발할 위험이 있다 —
`plan/complete/` 이동 전에 체크리스트에 명시적 항목으로 못박을 것을 권고한다.

## 위험도
LOW
