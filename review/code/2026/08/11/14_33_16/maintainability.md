# 유지보수성(Maintainability) Review — `14_33_16`

대상 델타: 커밋 `d7c6cf668` (`codebase/backend/src/modules/audit-logs/audit-action.const.ts`, prettier 자동 줄바꿈 2줄). CI backend lint 의 80자 제한 위반을 `eslint --fix` 로 해소한 순수 포맷팅 변경이다.

## 발견사항

- **[INFO]** 쪼개진 항목(`TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED:` 개행 후 `  'trigger.chat_channel_bot_token_rotated',`)이 `AUDIT_ACTIONS` 안에서 유일하게 2줄짜리 엔트리다.
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:95-96`
  - 상세: 나머지 ~33개 항목은 전부 `KEY: 'value',` 한 줄 형태(54~106행)라 세로로 훑을 때 `KEY:` 와 `'value'` 가 같은 줄에서 대응된다는 패턴이 일관되게 유지돼 있었다. 이 항목만 그 패턴이 깨져 훑어 읽을 때 시선이 한 번 더 꺾인다. 다만 원인이 수작업 스타일 선택이 아니라 prettier 80자 규칙의 기계적 결과이고, 깨지는 지점도 `KEY:` 와 값 사이 한 곳으로 예측 가능해 실제 가독성 손실은 작다.
  - 제안: 별도 조치 불필요 — lint 도구가 강제하는 포맷이라 손으로 되돌리면 다음 CI 에서 다시 깨진다. 굳이 통일하려면 값(`'trigger.chat_channel_bot_token_rotated'`)에 줄바꿈 없는 짧은 별칭을 쓰는 방법이 있지만, 이는 액션명 자체를 바꾸는 것이라 아래 항목과 트레이드오프가 같다.

- **[INFO]** 이번에 80자를 넘긴 키(`TRIGGER_CHAT_CHANNEL_BOT_TOKEN_ROTATED`, 83자)가 파일 내 최장 엔트리이고, 그다음으로 긴 `TRIGGER_NOTIFICATION_SECRET_ROTATED: 'trigger.notification_secret_rotated',` 도 이미 77자로 여유가 크지 않다(94행).
  - 위치: `codebase/backend/src/modules/audit-logs/audit-action.const.ts:94, 95-96`
  - 상세: 두 항목 모두 `TRIGGER_` 접두 + 회전/폐기 계열이라 길다. `spec/conventions/audit-actions.md §3` Rationale(주석 87-88행에서 포인터)에 따르면 이 파일의 명명 규약은 **의도적으로 sub-channel 을 액션명에 담는다** — 폭발 반경이 다른 자격증명을 구분하기 위한 설계다. 즉 키 이름을 줄이면 그 설계 근거와 정면으로 충돌한다.
  - 제안: 키 네이밍 규칙을 "80자를 넘지 않게" 쪽으로 손보지 않는 편이 낫다 — 이 파일의 장황함은 우연이 아니라 조회 필터·알림 규칙의 명확성을 위한 트레이드오프로 이미 문서화돼 있다(§3 Rationale). 앞으로도 유사하게 긴 회전/폐기류 액션이 추가되면 prettier 가 같은 방식으로 자동 분할하도록 두고, `eslint`/`prettier` 를 커밋 전 루틴에 포함시키는 쪽(이번 커밋 메시지가 이미 그렇게 하겠다고 밝힘)이 이 파일 하나만을 위한 네이밍 컨벤션 예외보다 비용이 낮다.

## 요약

이번 델타는 CI lint 위반을 고치는 순수 포맷 변경이며 로직 변경이 없다. 쪼개진 형태가 파일 내 유일한 2줄 엔트리라 시각적 일관성이 미세하게 흔들리지만, 원인이 도구가 강제하는 규칙이고 깨지는 위치도 예측 가능해 실질적 가독성 저하는 미미하다. 앞으로 유사하게 긴 키가 더 생길 여지는 있으나(회전/폐기류 키가 이미 파일 내 최장), 그 장황함은 `audit-actions.md §3` 에 문서화된 의도적 설계이므로 키 네이밍 규칙을 손보기보다 prettier 자동 분할을 그대로 수용하는 편이 합리적이다.

## 위험도
NONE
