# Cross-Spec 일관성 검토 — 트리거 시크릿/토큰 회전 3종 감사 로깅

## 검토 범위

target: `spec/5-system` (impl-done, diff-base `origin/main`). 실제 diff 는 6개 파일 한정:

- `spec/5-system/1-auth.md` §4.1 (신규 카탈로그 행: `trigger.notification_secret_rotated` / `trigger.chat_channel_bot_token_rotated` / `trigger.interaction_token_revoked`)
- `spec/conventions/audit-actions.md` §3 (레지스트리 행 추가 + rationale 노트)
- `spec/data-flow/1-audit.md` §1.1 (writer 표 3행 추가 + 커버리지 갭 서술 갱신)
- `spec/5-system/15-chat-channel.md` (규약 위반 액션명 `chat-channel.rotate-bot-token` → `trigger.chat_channel_bot_token_rotated` 정정 + 정정 이력 각주)
- `spec/2-navigation/2-trigger-list.md` §3 API 표 (3개 endpoint 행에 감사 액션 cross-link 추가)
- `spec/5-system/14-external-interaction-api.md` (EIA-NX-12 · EIA-AU-07 요구사항에 감사 기록 의무 문구 추가)

bundle 예산 초과로 `spec/5-system/14-external-interaction-api.md`·`15-chat-channel.md`·`conventions/audit-actions.md`(번들에 아예 미포함) 는 프롬프트에서 절단됐으므로, 위 6개 파일 + 연관 파일(`spec/1-data-model.md`, `spec/5-system/2-api-convention.md`, `spec/data-flow/14-chat-channel.md`, `spec/data-flow/15-external-interaction.md`, `spec/conventions/error-codes.md`, `spec/4-nodes/7-trigger/providers/slack.md`, `spec/conventions/user-guide-evidence.md`)를 워크트리에서 절대경로로 직접 `Read`/`grep` 하여 대조했다.

## 점검 결과

### 1. 데이터 모델 충돌
`spec/1-data-model.md` §2.8(Trigger)의 `notification_secret_v2`/`notification_rotated_at`/`chat_channel_token_v2`/`chat_channel_rotated_at` 컬럼 정의가 `14-external-interaction-api.md §7.1`·`15-chat-channel.md §4.2`·`data-flow/14-chat-channel.md`·`data-flow/15-external-interaction.md`의 서술과 필드명·의미·grace 유무(HMAC/bot-token 은 24h dual-accept, per-trigger interaction 토큰은 grace 없이 즉시 무효화)까지 정확히 일치한다. 충돌 없음.

### 2. API 계약 충돌
`2-trigger-list.md §3`의 3개 endpoint(`.../chat-channel/rotate-bot-token`, `.../notification/rotate-secret`, `.../interaction/revoke-token`) 서술이 `14-external-interaction-api.md`(EIA-NX-12·EIA-AU-07·§7.1·§7.3)·`15-chat-channel.md`(CCH-SE-04·§5.4)의 요청/응답 계약과 일치한다. `chat_channel_bot_token_rotated`의 경우 "새 토큰은 호출자 입력이라 응답에 반환하지 않는다"(`1-auth.md §4.1`)는 서술이 `15-chat-channel.md §5.4`의 실제 응답 스키마(요청 body 에 `newBotToken`, 응답은 `rotatedAt`/`triggerId`/`chatChannelHealth`/`botIdentity`만)와 정확히 부합한다. `spec/5-system/2-api-convention.md`의 RPC-style sub-channel exception 표에도 세 endpoint 가 명시적 허용 예시로 이미 등재돼 있어 API 규약과도 충돌 없음.

### 3. 요구사항 ID 충돌
신규 요구사항 ID는 도입되지 않았다 — 기존 `EIA-NX-12`·`EIA-AU-07`에 감사 기록 의무 문구만 추가됐다. ID 재사용·의미 변경 없음.

### 4. 상태 전이 충돌
회전(rotation, grace 있음) vs 폐기(revoke, grace 없음)의 구분이 `audit-actions.md §3` 노트("`interaction_token_revoked` 만 `revoked` 인 것은 의도다 — 유예 컬럼 없음")·`14-external-interaction-api.md §7.3`·`data-flow/15-external-interaction.md §1.1`(교체 즉시 이전 토큰 무효) 전부에서 동일하게 기술된다. `chat_channel_token_v2`/`notification_secret_v2`의 24h grace → `ChatChannelTokenRotatorService`/`NotificationSecretRotatorService` 에 의한 정리(`data-flow/14-chat-channel.md`, `15-chat-channel.md CCH-SE-04-C`)도 일치. 충돌 없음.

### 5. 권한·RBAC 모델 충돌
`1-auth.md §4.1`의 "Editor+ 가 호출 가능한 특권 작업" 서술은 `1-auth.md §3.2` RBAC 매트릭스의 Trigger 행(Owner/Admin/Editor: CRUD)과 `2-trigger-list.md §2.3.1` 하단("권한 게이트: 각 edit 토글은 editor 이상에서만 노출")·§4.1 삭제 권한 표와 정합적이다. Auth Config Reveal(Admin+ 로 별도 제한)과 대비되는 문구도 §3.2 각주와 모순되지 않는다. 다른 spec 어디에도 이 세 endpoint 를 Admin+ 로 좁히는 상충 서술이 없다.

### 6. 계층 책임 충돌
`AuditLogsService.record` 호출 위치를 `triggers.service`로 한정한 서술이 `data-flow/1-audit.md §1.1`(writer 표) 전체 패턴(워크스페이스 도메인 service + `user.*` controller)과 일치하며, `audit-actions.md`가 명명 규약, `1-auth.md §4.1`이 카탈로그, `data-flow/1-audit.md`가 구현 현황 SoT 라는 책임 분리(각 문서 Overview 에 명시)도 세 파일 모두 그대로 준수한다.

### 명명 규약 정정 확인
`15-chat-channel.md`에 있던 `chat-channel.rotate-bot-token`(dot-prefix 없는 resource·하이픈·현재형 위반)이 `trigger.chat_channel_bot_token_rotated`로 정정되고 정정 이력이 각주로 남았다. `spec/` 전체를 grep한 결과 옛 오표기(`chat-channel.rotate-bot-token`/`chat_channel.rotate_bot_token`/`chatChannel.rotateBotToken`)가 액션명으로 잔존하는 곳은 없다(위 각주 자기 언급 1건 제외). `audit-actions.md §3` 레지스트리에 `trigger`가 두 행(기존 CRUD + 신규 3종)으로 나뉘는 것은 `workspace`의 기존 선례(CRUD 행 vs `transfer_ownership` 행)와 동일 패턴이라 모순이 아니다.

### 앵커·링크 무결성
신규로 추가된 상호 참조 링크(`../5-system/1-auth.md#41-기록-대상-액션` 등)는 실제 헤딩(`### 4.1 기록 대상 액션`)과 슬러그가 일치한다. `[`conventions/audit-actions.md §3`](../conventions/audit-actions.md)`처럼 텍스트에 `§3`을 적고 href 에는 앵커를 달지 않는 스타일은 이 문서에 이미 존재하던 기존 패턴(예: `1-auth.md` L443 `workflow.executed` 행)과 동일하므로 본 PR 이 새로 만든 문제가 아니다.

## 발견사항

없음 — CRITICAL·WARNING·INFO 모두 발견되지 않았다.

## 요약

이번 변경은 트리거 시크릿/토큰 회전 3종(`notification_secret_rotated`/`chat_channel_bot_token_rotated`/`interaction_token_revoked`)에 대한 감사 로깅을 6개 spec 파일에 걸쳐 도입하면서, 동시에 `15-chat-channel.md`에 남아 있던 감사 액션 명명 규약 위반(`chat-channel.rotate-bot-token`)을 정정했다. 카탈로그(`1-auth.md`)·명명 규약(`audit-actions.md`)·구현 현황(`data-flow/1-audit.md`)·API 계약(`2-trigger-list.md`, `14-external-interaction-api.md`, `15-chat-channel.md`) 간 책임 분리가 각 문서에 명시된 대로 정확히 지켜졌고, 데이터 모델·API 계약·상태 전이(회전 vs 폐기)·RBAC 서술이 연관된 모든 spec 영역(1-data-model.md, 2-api-convention.md, data-flow/14-chat-channel.md, data-flow/15-external-interaction.md, providers/slack.md 등)에서 상호 모순 없이 일관되게 갱신·상호 참조되어 있다. 스코프가 좁고 각주에 정정 이력까지 남긴 매우 깨끗한 spec 동기화 PR이다.

## 위험도

NONE

STATUS: OK
