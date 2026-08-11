# consistency SUMMARY — `11_48_48` (`--spec spec/5-system/1-auth.md`)

**착수 전 게이트**(project-planner 의무). trigger 시크릿/토큰 회전 3종을 감사 대상으로 추가하기 전
확인.

## BLOCK: YES — 단, 성격을 갈라야 한다

| checker | Critical | Warning | 위험도 |
|---|---|---|---|
| cross_spec | **3** | 3 | HIGH |
| naming_collision | 0 | 1 | LOW |
| convention_compliance | 0 | 1 | LOW |
| rationale_continuity | 0 | 1 | LOW |
| plan_coherence | 0 | 2 | LOW |

**cross_spec 의 CRITICAL 3 중 둘은 조건부다** — "X 를 쓰면서 Y 를 같이 안 쓰면 즉시 모순" 이라는
형태로, 게이트가 **쓰기의 필수 범위를 지정**한 것이지 지금 무언가가 깨져 있다는 뜻이 아니다.
나머지 하나(#3)는 이 작업과 무관하게 **이미 참인 기존 결함**이다.

| # | 내용 | 성격 |
|---|---|---|
| C1 | `1-auth §4.1` 에서 "구현/Planned" 배치가 코드 상태와 어긋나면 §4.1 자신의 정의·code SoT 와 모순 | **조건부** — 쓰기가 지켜야 할 것 |
| C2 | `conventions/audit-actions.md §3` `trigger` 행이 신규 verb 를 반영 안 하면 즉시 stale | **조건부** |
| C3 | `15-chat-channel.md §5.4.1` 에 이미 박힌 예시 액션명(`chat-channel.rotate-bot-token`)이 명명 규약·resource 모델을 **이중 위반** | **기존 결함** — 이번에 함께 정정 |

## 착수 판정 — 진행. 단 쓰기 범위가 확정됐다

게이트가 요구하는 **동반 갱신 6곳**(cross_spec + plan_coherence 가 함께 지목):

1. `spec/5-system/1-auth.md §4.1` — 액션 카탈로그 (SoT)
2. `spec/conventions/audit-actions.md §3` — 레지스트리 행 + 3분리 근거 Rationale
3. `spec/data-flow/1-audit.md §1.1` — Writer 표 + **이미 stale 인 "남은 갭은 두 가지" 산문**
4. `spec/5-system/15-chat-channel.md:378` — 규약 위반 액션명 정정 (C3)
5. `spec/2-navigation/2-trigger-list.md` — 회전/폐기 엔드포인트 행에 감사 액션 cross-link
6. `spec/5-system/14-external-interaction-api.md` — EIA-NX-12/EIA-AU-07 에 감사 요건

이 저장소의 기록된 교훈이 그대로 적용된다 — **한 커밋에서 동시에 고쳐야 재drift 하지 않는다**.

## 착수 전 확인으로 정리된 것 3가지

- **내 명명이 셋 사이에서 비대칭이었다**(naming_collision). `notification_*`·`interaction_*` 은
  sub-channel 을 담는데 `bot_token_rotated` 만 `chat_channel` 접두를 뺐다 — 엔티티 컬럼
  (`chat_channel_token_v2`)·스케줄러(`ChatChannelTokenRotatorService`)·HTTP 경로가 모두 그
  접두를 쓴다. **`trigger.chat_channel_bot_token_rotated`** 로 확정한다.
- **3분리의 근거를 Rationale 로 남겨야 한다**(convention_compliance). 레지스트리에 양쪽 선례가
  다 있다 — 흡수(`integration.rotated` + `details.mode`) vs 세분화(`user.password_changed`/
  `email_changed`). 규약이 강제하지 않으므로 선택 근거가 기록돼야 한다.
- **이중 기록 우려는 실측으로 반증됐다**(rationale_continuity WARNING). `rotateNotificationSecret`
  은 `Trigger.notificationSecretV2` 만 쓰고 `auth_config` 을 건드리지 않는다(아웃바운드 HMAC vs
  인바운드 인증 설정) — `auth_config.regenerate` 와 겹치지 않는다.

## 구현 단계로 넘어가는 메모

`recordAudit` 는 `userId` 가 필수인데 세 엔드포인트에 **액터 배선이 없다**(plan_coherence INFO).
컨트롤러까지 손대야 한다.

## RISK: HIGH (조건부 CRITICAL 2 + 기존 결함 1)
## CRITICAL_COUNT: 3
## WARNING_COUNT: 8
