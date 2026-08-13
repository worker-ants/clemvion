# Rationale 연속성 검토 결과

## 검토 범위 요약

- 검토 모드: `--impl-done`, scope=`spec/4-nodes/`, diff-base=`origin/main`
- 실제 `git diff origin/main...HEAD -- code_areas` 는 **파일 1개, 코드 변경 2줄** (doc-comment 문구 수정)만 포함한다:
  - `codebase/backend/src/modules/hooks/public-webhook-quota.service.ts`
    - `MINUTE_WINDOW_SEC` / `HOUR_WINDOW_SEC` 상수 doc-comment 를 "분/시간 단위 **슬라이딩 윈도우**" → "분/시간 버킷의 **fixed-window**. `EXPIRE ... NX` 라 window 는 연장되지 않는다 / 경계에서 버킷이 리셋된다" 로 수정.
  - spec 본문·Rationale 변경은 diff 에 없음(스캔된 spec 파일들은 컨텍스트 번들일 뿐 이번 diff 의 대상이 아님).

## 발견사항

없음.

이 변경은 오히려 **기존 Rationale 과의 불일치를 해소**하는 방향이다:

- `spec/5-system/15-chat-channel.md` R-CC-19 는 이미 이 서비스를 "**fixed-window(sliding 아님)** + Redis 선택" 으로 명시하고 있고 (`PublicWebhookQuotaService` 의 `INCR`+`EXPIRE` pipeline 을 근거로 든다), 같은 문서 CCH-NF-03 표에도 "Redis fixed-window 카운트" 로 재확인된다.
- `spec/5-system/12-webhook.md` §6 구현 파일 구조(정상 본문)에도 이미 "Redis fixed-window 카운터", "60초 fixed-window", "3600초 fixed-window" 로 명시돼 있다.
- `spec/data-flow/10-triggers.md`, `spec/7-channel-web-chat/4-security.md` 도 동일하게 "fixed-window" 로 서술한다.

즉 spec 쪽 정본 용어는 이미 오래전부터 "fixed-window" 로 확정돼 있었고, 코드 쪽 doc-comment 만 "슬라이딩 윈도우" 라는 옛 표현이 남아 있던 상태였다. 이번 diff 는 그 code-comment 를 spec/Rationale 정본 용어에 맞춰 정정한 것으로, 기각된 대안의 재도입·합의 원칙 위반·무근거 번복·invariant 우회 중 어느 것에도 해당하지 않는다.

## 요약

이번 리뷰 대상 diff 는 `public-webhook-quota.service.ts` 의 상수 doc-comment 2줄을 "슬라이딩 윈도우" → "fixed-window" 로 정정한 것뿐이며, 이는 `spec/5-system/15-chat-channel.md` R-CC-19 및 `spec/5-system/12-webhook.md`/`spec/data-flow/10-triggers.md`/`spec/7-channel-web-chat/4-security.md` 에 이미 확립된 "fixed-window(sliding 아님)" Rationale·정본 서술과 완전히 정합한다. 오히려 코드 주석이 spec 정본 용어보다 뒤처져 있던 상태를 바로잡은 것으로, 기각된 결정 재도입이나 원칙 위반, 무근거 번복, invariant 우회 사례는 발견되지 않았다. Target scope 로 지정된 `spec/4-nodes/` 자체에는 이번 diff 로 인한 변경사항이 전혀 없다.

## 위험도

NONE
