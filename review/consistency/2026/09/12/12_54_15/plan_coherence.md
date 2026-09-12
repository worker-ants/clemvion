# Plan 정합성 검토 — spec/5-system/ (impl-prep, target: 2-api-convention.md · 15-chat-channel.md 중심)

## 배경 확인

target 은 `impl-setup-error-code.md`(developer, `spec_impact: none`)가 구현 착수 전 통과해야
하는 `--impl-prep` 게이트다. 이 plan 은 `#1323` planner 턴이 이미 확정한 결정
(`15-chat-channel.md R-CC-23` · `§5.4` · `conventions/chat-channel-adapter.md §1.1.2` ·
`2-api-convention.md §6` · `conventions/swagger.md §2-4`)을 코드로 따라가는 턴이라고 스스로
밝힌다. 실측 결과 이 인용은 정확하다:

- `2-api-convention.md` §6 (HTTP 상태 코드 표) 에 `502 CHAT_CHANNEL_SETUP_FAILED` 행이 이미
  등재돼 있다 (target 본문 380행).
- `15-chat-channel.md` §5.4 (`R-CC-23`)가 "자격 증명 거부 → 400 BOT_TOKEN_INVALID, 그 밖 →
  502 CHAT_CHANNEL_SETUP_FAILED, 판별은 어댑터가 `code` 로 선언, 원문 echo 중단" 을 이미
  결정으로 못박아 뒀다.
- `spec/conventions/swagger.md` §2-4 에도 `@ApiBadGatewayResponse` 행이 이미 있다 (291행,
  spec/5-system/ 바깥이라 target bundle 엔 없지만 R-CC-23 이 "완결 조건" 으로 명시한 자리라
  직접 확인함).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "setupChannel 실패 분류"
  항목이 정확히 이 developer 후속 5건(1~5)을 문자 그대로 열거하며, spec 갈래는
  `plan/complete/spec-draft-setup-error-classification.md` 로 이미 닫혔다고 기록돼 있다.

즉 이 구현 plan 은 plan 트래커가 "결정 필요" 로 남겨둔 항목을 우회하는 것이 아니라, **이미
합의된 결정을 정확히 그 트래커가 지시하는 순서대로** 실행하는 턴이다. §1.1.2 목록(자격
증명 축 5값)·헬퍼 설계(프로퍼티 vs 서브클래스)·402(원문 미echo) 모두 spec/트래커와 어긋남이
없다.

## 발견사항

- **[WARNING] 이 PR 완료가 다른 항목의 「착수 신호」를 충족하는데 plan 에 그 사실이 반영되지 않음**
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4 (R-CC-23) — 이 PR 이 구현하는 자리
  - 관련 plan: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    **"CCA §1.1.2 의 401/403 fallback 제거 판정"** 항목 (2026-09-12 등재). 원문: *"v1 provider
    3종(telegram·slack·discord)이 모두 `code` 를 부착하면 삭제 후보 … 착수 신호: 위
    「setupChannel 실패 분류」 항목의 developer 후속 2~4 완료."*
  - 상세: `impl-setup-error-code.md` 의 작업 2~4(slack/discord/telegram adapter 에 `code`
    부착)가 완료되면, 그 문장이 스스로 지정한 재평가 조건(v1 provider 3종 전부 `code` 부착
    완료)이 정확히 이 PR 로 충족된다. 그런데 `impl-setup-error-code.md` 본문·체크리스트
    어디에도 이 트리거를 언급하지 않는다 — "401/403 fallback 은 한시적 예외로 유지" 라고만
    적어, *지금은 유지가 맞지만 그 유지가 재평가 대상이 됐다는 사실*이 이 PR 안에서 사라진다.
    이 저장소는 같은 파일의 바로 인접한 항목(`chatChannelLastError` 원문 노출)에서 "이미
    등재됨" 이 22개 세션에 걸쳐 거짓이었던 사례를 직접 기록해 뒀다 — 조건 충족 시점을 그
    조건을 충족시키는 PR 자신이 기록하지 않으면 다음 세션이 다시 grep 해서 재발견해야 한다.
  - 제안: `impl-setup-error-code.md` 체크리스트("트래커 항목 종결 + 잔여 등재")에 이 트리거를
    명시적으로 추가하거나, 커밋/PR 본문에 "CCA §1.1.2 401/403 fallback 제거 판정의 착수 신호
    충족 — 판정은 별도"를 한 줄 남긴다. spec 자체(`chat-channel-adapter.md §1.1.2`)를 지금
    고치라는 뜻은 아니다 — 판정은 별도 턴의 몫이고, 이 PR 은 그 판정이 가능해졌다는 사실만
    끊기지 않게 이어주면 된다.

- **[INFO] `chat_channel_last_error` 원문 노출 미해결 항목과 인접하나 이 PR 의 대상이 아님**
  - target 위치: `spec/5-system/15-chat-channel.md` §4.2 (`chat_channel_last_error TEXT NULL`)
  - 관련 plan: `spec-draft-nullable-notation-followups.md` 의 "`chatChannelLastError` 에 외부
    adapter 오류 원문이 저장·노출된다" 항목 (2026-09-12 등재, 3개월간 22개 리뷰 세션에서
    유실됐다고 스스로 기록)
  - 상세: 이 열린 항목은 *"응답 축의 형제 결정은 `15-chat-channel.md R-CC-23`(§5.4 응답 본문에서
    원문 echo 중단)"* 이라고 이 PR 이 구현하는 바로 그 결정을 지목한다. `impl-setup-error-code.md`
    의 설계 (a)는 원문을 `chat_channel_last_error` 컬럼이 아니라 `logger.warn` 으로만 보내므로
    이 PR 은 그 컬럼 문제를 재현하지도, 악화시키지도 않는다 — 다만 "R-CC-23 이 원문 echo 를
    끊었다" 는 사실이 "DB 컬럼 노출도 함께 해결됐다" 로 오독될 여지가 있어 명시적으로 분리해
    둔다.
  - 제안: 조치 불필요. `impl-setup-error-code.md` PR 설명이나 커밋 메시지에서 "원문 노출을
    없앴다" 는 취지로 서술할 때 `chat_channel_last_error` 컬럼까지 포함하는 것으로 읽히지
    않게 응답 본문(HTTP envelope) 한정임을 명확히 하면 충분하다.

## 요약

target(`2-api-convention.md §6`, `15-chat-channel.md §5.4`/`R-CC-23`)은 `#1323` planner 턴이
이미 확정한 결정을 정확히 반영하고 있고, 그 결정을 구현하는 `impl-setup-error-code.md` 는
`plan/in-progress/spec-draft-nullable-notation-followups.md` 가 열거한 developer 후속 5건과
문자 그대로 일치한다 — "결정 필요" 항목을 우회하거나 선행 조건을 건너뛰는 지점은 발견되지
않았다. 유일한 실질 이슈는 이 PR 의 완료가 **다른 항목(CCA §1.1.2 fallback 제거 판정)의
재평가 조건을 충족시킨다는 사실 자체가 이 PR 의 plan 에 기록돼 있지 않다**는 것 — 같은 파일이
바로 옆 항목에서 "미기록으로 인한 22회 유실" 을 스스로 경고해 둔 만큼 재발 방지 차원에서
WARNING 으로 남긴다. 나머지는 조치 불필요한 INFO 성 인접 맥락이다.

## 위험도

LOW
