# 문서화(Documentation) Review — `12_37_14`

## 재확인 대상 (요청 사항)

이전 라운드(`12_22_23`)의 WARNING 2건 반영분을 검증했다:
(a) `chat_channel_bot_token_rotated` 가 "응답에 새 자격증명 1회 평문 반환" 대상이라던 거짓 서술의 전수 정정 여부,
(b) 신규 CHANGELOG 항목이 구현보다 넓게 약속하지 않는지, (c) 새로 쓴 서술과 코드의 어긋남 여부.

실측 방법: `grep -rn` 으로 저장소 전체(`spec/`, `codebase/`, `plan/`, `CHANGELOG.md`)에서 "평문 반환"·"1회 평문"·`chat_channel_bot_token_rotated` 를 재검색하고, `triggers.service.ts` 의 세 메서드 반환 타입·`interaction.guard.ts` 의 `itk_*` 검증 방식·`spec/conventions/audit-actions.md §3`/`spec/5-system/14-external-interaction-api.md`(EIA-NX-12/EIA-AU-07)/`spec/5-system/15-chat-channel.md`(CCH-SE-04) 를 대조했다.

## 발견사항

### [WARNING] "앞의 둘" 표현이 실제 나열 순서와 불일치 — 정정문 자체가 다시 헷갈린다

- 위치: `spec/5-system/1-auth.md:431`, `codebase/backend/src/modules/audit-logs/audit-action.const.ts:90-92`
- 상세: 두 곳 모두 "trigger.notification_secret_rotated, trigger.chat_channel_bot_token_rotated, trigger.interaction_token_revoked" 순서로 세 액션을 나열한 직후, "**앞의 둘** 중 `notification_secret_rotated`·`interaction_token_revoked` 는 응답에 새 자격증명을 1회 평문 반환"(1-auth.md) / "**앞의 둘만** 응답에 새 자격증명을 1회 평문 반환한다"(audit-action.const.ts, 이어서 `chat_channel_bot_token_rotated` 를 제외) 라고 적는다.
  실제로 "앞의 둘"(나열 순서상 1·2번째)은 `notification_secret_rotated` + `chat_channel_bot_token_rotated` 인데, 문장이 지목하는 것은 1·3번째(`notification_secret_rotated` + `interaction_token_revoked`)다. 즉 "앞의"라는 위치 수식어가 방금 나열한 순서와 어긋나 있고, `chat_channel_bot_token_rotated` 는 나열상 "앞의 둘" 안에 있는데도 그 문장이 직후에 "얘는 아니다" 라고 배제한다 — 같은 문장 안에서 자기모순으로 읽힌다.
  내용(코드) 자체는 정확하다 — `rotateNotificationSecret` 은 `{ secret, rotatedAt }`, `revokePerTriggerToken` 은 `{ token }` 을 반환해 신규 자격증명이 응답에 실리고(`triggers.service.ts` L906/L950), `rotateBotToken` 은 `{ rotatedAt, triggerId, chatChannelHealth, botIdentity }` 만 반환해 `newBotToken`(호출자 입력) 이 응답에 없다(`triggers.service.ts` L999-L1009). 명시적으로 이름이 나열돼 있어 실제로 오독할 위험은 낮지만, "앞의" 라는 위치 수식어는 문자 그대로 틀렸다.
  참고로 `CHANGELOG.md` 의 같은 정정(4번 문단 "앞의 둘은 24h grace 로...")은 **다른 그룹**(notification+chat_channel_bot, grace 유무 기준)을 가리키는데 이건 CHANGELOG 자체 표 순서(1·2번째 행)와 일치해 문제가 없다. 결과적으로 동일 문구 "앞의 둘" 이 문서마다 서로 다른 두 개의 짝을 가리키게 됐다 — 교차 참조 시 혼동 소지.
- 제안: "앞의"(위치 수식어) 를 빼고 그냥 "셋 중 `notification_secret_rotated`·`interaction_token_revoked` 만 응답에 새 자격증명을 1회 평문 반환하고" 식으로 위치 무관하게 서술. 두 위치 모두 동일하게 고쳐야 한다.

### [INFO] 완료 표시된 plan 항목이 착수 시점의 부정확한 전제를 캐벗 없이 보존

- 위치: `plan/in-progress/spec-sync-auth-gaps.md` (해당 diff 게이트 56행, "트리거 시크릿/토큰 회전 3종 감사" 항목 본문 중 "응답에 새 시크릿을 1회 평문 반환하므로")
- 상세: 이 항목은 "완료 (2026-08-11)" 로 체크되었고 첫 줄에 "아래는 착수 시점 서술로 남긴다" 라는 안내가 붙어 있어, 이하 본문이 역사적 기록(당시 판단 근거)임을 명시한다 — 같은 파일의 다른 완료 항목들(예: 15-17행)도 동일 패턴을 쓴다. 다만 이 특정 항목의 보존된 서술은 "`rotateNotificationSecret`·`revokePerTriggerToken`·`rotateBotToken` 이 ... 응답에 새 시크릿을 1회 평문 반환하므로" 라고 **세 메서드를 묶어** 말하는데, 이는 이번 라운드가 정정한 바로 그 오류(`rotateBotToken` 은 해당 안 됨)와 같은 형태다. `audit-action.const.ts` 주석은 "이 주석의 첫 판은 셋 다 반환한다고 적었고 그건 사실이 아니었다" 라고 자기 정정 이력을 남기는 반면, 이 plan 항목은 그런 캐벗이 없어 나중에 읽는 사람이 "여전히 유효한 근거"로 오인할 여지가 남는다.
- 제안: 필수는 아님(착수 시점 기록 보존은 이 저장소의 정착된 관례) — 다만 여유가 있으면 이 문장 뒤에 "(주: `rotateBotToken` 은 새 토큰이 호출자 입력이라 실제로는 해당 없음 — 정정 이력은 `audit-action.const.ts` 참고)" 한 줄만 추가하면 충분.

## 통과 확인 (재검증에서 문제 없음)

- CHANGELOG.md 신규 항목의 "무효화되는 것" 표: `아웃바운드 HMAC 수신자(24h grace)` / `그 채널의 봇 세션(24h grace)` / `그 트리거로 열린 외부 대화 전부(grace 없음—즉시)` 세 행 모두 코드·spec 과 대조 확인됨 — `interaction.guard.ts` 가 `trigger.config.interaction.triggerToken` 을 매 요청 라이브 조회하므로 회전 즉시 구 토큰이 거부됨(grace 없음), CCH-SE-04 "old token 은 24h grace 동안 병행 받음", EIA-NX-12 "old secret 은 grace 24h 병행 검증" 과 각각 일치. 구현보다 넓게 약속하는 대목 없음.
- CHANGELOG "기존 테스트 17건을 깼고" 주장: diff 에 드러난 기존 `it(...)` 케이스 중 시그니처 변경으로 인자 추가가 필요했던 것을 세어보면 controller.spec.ts 4건 + service.spec.ts(rotateNotificationSecret/revokePerTriggerToken) 5건 + service.spec.ts(rotateBotToken 오케스트레이션) 8건 = 17건으로 정확히 일치(신규 감사 테스트는 제외하고 셈). 과장 없음.
- `spec/conventions/audit-actions.md §3` Rationale(신규 4개 문단, 2026-08-11): "폭발 반경" 3분류 근거가 CHANGELOG·코드 주석과 일관되게 재진술됨. `interaction_token_revoked` 만 `revoked` 인 이유(즉시 무효화, 유예 컬럼 없음)도 코드(`revokePerTriggerToken` 이 `trigger.config` 를 직접 덮어씀, v2 백업 컬럼 없음)와 일치.
- `spec/5-system/15-chat-channel.md:378` 의 액션명 오기(`chat-channel.rotate-bot-token` → `trigger.chat_channel_bot_token_rotated`) 정정: `<resource>.<verb>` 구조·언더스코어·과거분사 위반이었다는 서술이 `conventions/audit-actions.md §1/§2.1` 과 대조해 정확함.
- `spec/2-navigation/2-trigger-list.md`·`spec/5-system/14-external-interaction-api.md`(EIA-NX-12/EIA-AU-07) 의 신규 "감사 기록 필수" cross-link: 액션명·엔드포인트 경로 모두 `triggers.controller.ts` 의 실제 `@Post()` 경로(`:id/notification/rotate-secret`, `:id/interaction/revoke-token`, `:id/chat-channel/rotate-bot-token`)와 일치.
- 테스트 파일(controller.spec.ts, service.spec.ts) 신규 독스트링("회전/폐기 3종도 같은 배선이 필요하다", "이 자리가 셋 중 유일하게 비어 있었다") 은 diff 로 보이는 실제 테스트 배치와 부합 — `rotateBotToken` 6단계 오케스트레이션 describe 에만 감사 성공/실패 테스트가 신설된 것도 확인됨(다른 두 회전은 기존 "TriggersService — 감사 로깅" describe 에 이미 있었다는 서술과 일치).
- `.claude/tests/test_consistency_bundle_priority.py` 의 주석 변경(`rank==0`→`rank<tier0_size`)은 변경 사유(같은 브랜치에서 spec 파일을 여러 개 커밋하면 tier0 이 1개가 아닐 수 있다)를 명확히 설명하고 실측 근거("2026-08-11 — `1-auth.md` 를 커밋한 브랜치에서 재현")를 남겨 오래된 주석 문제 없음.

## 요약

핵심 요청이던 "chat_channel_bot_token_rotated 는 평문 반환 안 함" 오류는 CHANGELOG.md·`spec/5-system/1-auth.md`·`audit-action.const.ts` 세 곳 모두에서 실질적으로 정정됐고, 코드(반환 타입)·spec(EIA-NX-12/EIA-AU-07/CCH-SE-04)과 대조해도 내용은 정확하다. 다만 `1-auth.md`와 `audit-action.const.ts` 두 곳에 남은 "앞의 둘" 이라는 위치 수식어가 실제 나열 순서(1·2번째가 아니라 1·3번째를 가리킴)와 어긋나 문장 자체가 자기모순으로 읽히고, `CHANGELOG.md` 가 같은 문구를 다른 짝(grace 유무 기준)에 쓰고 있어 교차 참조 시 혼동을 더한다 — 다만 각 문장이 대상 액션명을 명시적으로 나열하므로 실제 오독 위험은 낮다. `plan/in-progress/spec-sync-auth-gaps.md` 에 보존된 착수 시점 서술도 같은 형태의 오류를 캐벗 없이 담고 있으나, 이 파일의 기존 관례(완료 항목의 원 서술 보존)에 부합하는 패턴이라 문제라기보다 개선 여지로 본다. CRITICAL 은 없다.

## 위험도

LOW
