# 정식 규약 준수 검토 — convention_compliance

- 검토 모드: `--impl-done`, scope=`spec/5-system`, diff-base=`origin/main`
- 이 라운드 델타: 커밋 `d7c6cf668` 1건 (`codebase/backend/src/modules/audit-logs/audit-action.const.ts` — `eslint --fix` prettier 개행, +2/-1)
- 점검 범위(지시된 단일 질문): 감사 액션 문자열 3종의 값이 문자 단위로 불변인지, `spec/conventions/audit-actions.md §3` 레지스트리 및 `spec/5-system/1-auth.md §4.1` 카탈로그와의 일치가 유지되는지

## 확인 절차

1. `git show d7c6cf668` 로 diff 확인 — `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED` 키의 값 문자열을 콜론 뒤 줄바꿈으로만 재배치했고, 문자열 리터럴 `'trigger.chat_channel_bot_token_rotated'` 자체는 변경 없음. 나머지 두 액션(`TRIGGER_NOTIFICATION_SECRET_ROTATED`, `TRIGGER_INTERACTION_TOKEN_REVOKED`)은 diff 에 등장하지 않음(불변).
2. HEAD 워크트리의 `codebase/backend/src/modules/audit-logs/audit-action.const.ts` 에서 3개 값을 직접 확인:
   - `TRIGGER_NOTIFICATION_SECRET_ROTATED: 'trigger.notification_secret_rotated'`
   - `TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED: 'trigger.chat_channel_bot_token_rotated'`
   - `TRIGGER_INTERACTION_TOKEN_REVOKED: 'trigger.interaction_token_revoked'`
3. `spec/conventions/audit-actions.md §3` 레지스트리(표 58행, `trigger` 행 · "과거분사 (§2.1)" · 상태 "구현 (2026-08-11)")의 verb 3종과 Python 을 이용한 바이트 단위 문자열 대조:
   - `notification_secret_rotated`, `chat_channel_bot_token_rotated`, `interaction_token_revoked` — 코드 값의 `trigger.` 접두 제거분과 정확히 일치 (표는 resource/verb 컬럼 분리 구조라 dotted-full 표기가 아님, §1 구조 규약과 부합).
4. `spec/5-system/1-auth.md §4.1 기록 대상 액션`(413행 `## 4.` → 415행 `### 4.1`, 카탈로그 행 431)의 `` `trigger.notification_secret_rotated`, `trigger.chat_channel_bot_token_rotated`, `trigger.interaction_token_revoked` `` 를 코드 값과 Python `in` 연산으로 바이트 단위 대조 — 3종 모두 완전 일치(`True`).

## 발견사항

없음 (Critical 0 / Warning 0 / Info 0). 감사 액션 문자열 3종은 코드·`audit-actions.md §3`·`1-auth.md §4.1` 세 지점에서 문자 단위로 동일하며, 이번 커밋은 prettier 개행만 추가했을 뿐 값·키 어느 쪽도 건드리지 않았다. `audit-actions.md §1` 의 `<resource>.<verb>` 구조 규약, §2.1 과거분사 taxonomy(`_rotated`/`_revoked`), 토큰 구분자(언더스코어) 규약과도 이번 델타는 무관 — 규약 위반 재평가가 필요한 변경이 아니다.

## 요약

이번 라운드의 유일한 델타는 `eslint --fix` 가 80자 초과 한 줄을 개행한 스타일 변경이며, 문제의 감사 액션 값 3종(`trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked`)은 코드·`spec/conventions/audit-actions.md §3`·`spec/5-system/1-auth.md §4.1` 세 곳 모두에서 문자 단위로 불변임을 직접 대조로 확인했다. spec 도 이번 델타에서 전혀 수정되지 않았으므로 정식 규약 준수 관점에서 재판정할 사항이 없다.

## 위험도
NONE

STATUS: OK
