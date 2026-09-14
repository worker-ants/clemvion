# Cross-Spec 일관성 검토 — `spec/5-system/` (impl-prep: trigger-config-lost-update)

## 스코프에 대한 메모

본 세션은 `--impl-prep` (구현 착수 전) 모드이고 `plan/in-progress/trigger-config-lost-update.md` 의
`spec_impact: none` 이 명시하듯 이번 작업은 **spec 을 고치지 않는 순수 코드 버그 수정**(동시
PATCH 가 `Trigger.config` 를 잃는 lost-update)이다. 즉 "target(draft) vs 다른 영역" 구도가 아니라
**"이 코드 변경이 밟고 지나갈 spec/5-system 영역이 다른 spec 영역과 이미 충돌하고 있는가"**
를 확인하는 것이 실질 과제다.

번들(`_prompts/cross_spec.md`)은 컨텍스트 예산 초과로 `4-execution-engine.md` · `12-webhook.md` ·
`15-chat-channel.md` 등 15개 파일 본문을 생략했는데, 이 파일들이 정확히 이번 수정이 건드리는
영역(advisory lock 선례, `TriggersService`/`ChatChannelBinderService` 계약)이라 **직접 `Read` 로
열어 확인**했다. 아래 결론은 그 직접 열람에 근거한다.

## 확인한 것 (충돌 없음 — 근거를 남긴다)

이번 수정이 참조하는 개념들이 다른 spec 영역과 실제로 어긋나는지 하나씩 대조했다:

1. **advisory lock 선례** (`4-execution-engine.md:1188,1776`) — "per-workspace `pg_advisory_xact_lock`
   으로 admission 을 직렬화, 조건부 UPDATE 단독은 불충분(서브쿼리 COUNT 에 락 없음)" 서술이
   plan 이 인용한 그대로 존재한다. plan 이 이를 다른 lock key 네임스페이스(`trigger-config:<id>`)로
   확장하는 것과 이 spec 문서 사이에 모순 없음.
2. **`botTokenRef` vs `inboundSigningRef` 의 비대칭** (`15-chat-channel.md:394`, §5.4.1.1) —
   `botTokenRef` 는 "config 에서 보존되는 게 아니라 trigger id 에서 재유도"(`buildSecretRef`, 상태
   없음)라고 명시하는 반면, slack/discord `inboundSigningRef` 는 "기존 값 그대로 사용"(재유도 아님,
   진짜 상태)이라고 갈라 적는다. 이는 plan 의 실측("잃는 것이 `inboundSigningRef` 다, `botTokenRef`
   는 아니다")과 **정합** — botToken 축은애초에 상태가 없어 lost-update 가 관측 불가능하고,
   inboundSigning 축만 진짜 상태라 사라질 수 있다는 plan 의 구분을 spec 이 뒷받침한다. 모순 없음.
3. **`TriggersService` ↔ `ChatChannelBinderService` 호출 관계** (`conventions/chat-channel-adapter.md:426`,
   data-flow/10-triggers.md 말미 Rationale) — "`ChatChannelBinderService.setupChatChannel` — `TriggersService`
   가 생성/수정 경로에서 호출한다"·"역방향 동기화를 `TriggersService` 안에 둔 이유(동기 호출이어야
   PATCH 응답 시점에 보장)" 서술이 plan 의 아키텍처 서술(3개 독립 쓰기 지점, 2번·3번이
   `ChatChannelBinderService` 안)과 일치. 계층 책임 충돌 없음 — "각 쓰기 지점이 자기 락을 잡는다"는
   설계도 기존에 문서화된 호출 방향을 뒤집지 않는다.
4. **API 계약** (`2-navigation/2-trigger-list.md §3`) — `PATCH /api/triggers/:id` 의 `chatChannel`
   top-level 키 병합 규칙, "통째로 교체" 서술에도 불구하고 `botTokenRef` 는 "소멸하지 않는다(재유도)"는
   각주까지 `15-chat-channel.md` 와 동일 문구로 미러링되어 있다. 두 문서 사이 API 계약 불일치 없음.
5. **데이터 모델** (`1-data-model.md §2.8 Trigger`) — `config`(JSONB) · `chat_channel_health` ·
   `chat_channel_last_error` · `chat_channel_setup_at` 컬럼 정의가 `15-chat-channel.md §4.2` 와
   `data-flow/14-chat-channel.md` 양쪽에 동일하게 참조되어 있고, plan 의 "이번 호출의 결과라
   머지 대상이 아니다"(§B 착수 전 확인 항목)와 이 세 컬럼이 정확히 대응한다. 모순 없음.
6. **동시 삭제 처리** (`2-trigger-list.md §4.4`) — "동시 삭제 시 두 번째는 404" 만 명시하고 동시
   PATCH 의 lost-update 는 어느 spec 문서에도 언급이 없다 — 이는 **충돌이 아니라 공백**이다(아래
   발견사항 참고).

## 발견사항

- **[INFO]** PG advisory lock 키 네임스페이스에 대한 저장소 전역 레지스트리 부재
  - target 위치: (참고) `spec/5-system/4-execution-engine.md` §8/§Rationale 의 `pg_advisory_xact_lock(hashtext($1))` — plan 의 `trigger-config:<id>` lock key 설계가 이 선례를 그대로 확장한다.
  - 충돌 대상: `spec/conventions/redis-keys.md` (Redis 키는 "저장소 전역 인벤토리"를 SoT 로 갖는 convention 문서가 있음) — 그러나 PG advisory lock 키에는 대응하는 문서가 없다.
  - 상세: Redis 키 네임스페이스는 `conventions/redis-keys.md` 가 전역 인벤토리로 관리되는데(§9.1 인용), `pg_advisory_xact_lock(hashtext(...))` 는 문자열 키를 32bit 정수로 해시하는 **더 좁은 충돌 공간**을 쓰면서도 이를 추적하는 대응 문서가 없다. 현재는 execution-engine 의 `workspace:<id>` 계열 하나뿐이라 실질 위험은 낮지만, 이번 수정이 `trigger-config:<id>` 라는 **두 번째 계열**을 신설하면 "advisory lock 키가 저장소 안에 몇 종류 있고 네임스페이스가 어떻게 분리되는가"를 답할 문서가 여전히 없어진다.
  - 제안: 이번 코드 수정 자체는 spec 변경 권한 밖(`spec_impact: none`)이므로 즉시 조치 대상은 아니다. 다만 이 fix 가 머지된 뒤 `--impl-done` 리뷰나 후속 planner 턴에서 `conventions/redis-keys.md` 와 대칭되는 "advisory lock 키 인벤토리" 절 신설을 고려할 근거로 이 항목을 남겨 둔다(지금 당장 차단 사유는 아님).

- **[INFO]** `inboundSigning` PATCH 회전 정책의 기존 자기모순이 이번 수정 범위와 겹친다
  - target 위치: (참고) `spec/5-system/15-chat-channel.md` §5.4.1.1 "회전(rotation)" 행 vs 바로 아래 2026-09-10 "정합화" 각주(line 447, 450)
  - 충돌 대상: 같은 문서 안의 두 서술 — "PATCH body 에서 `inboundSigningPlaintext` 는 v1 미정의, 회전 차단"(표 서술) vs "실측하면 `assertInboundSigningPlaintextByProvider` 가 값이 있으면 통과시켜 매 `chatChannel` PATCH 마다 slack/discord 도 회전이 강제되고 있었다"(각주).
  - 상세: 이는 cross-spec 충돌이라기보다 **spec 문서 내부에 이미 authored 로 남아있는 자기모순**이지만, 정확히 이번 lost-update 수정이 다루는 필드(`inboundSigningRef`)·경로(`chatChannel` 실린 PATCH → `setupChatChannel`)와 겹친다는 점에서 언급할 가치가 있다. plan(§A)은 "2 는 그 값(`previousInboundSigningRef`)으로 `inboundSigningRef` 를 되살린다"고 일반적으로 서술하는데, 만약 이 정합화 각주가 맞다면(slack/discord 도 매 PATCH 마다 실제로 회전) telegram 한정이 아니라 **모든 provider** 가 이 lost-update 창에 노출된다. plan 의 실측(§A)이 provider 를 구분하지 않고 "세 곳 다"라고 적은 것과는 방향이 맞다 — 다만 구현 시 이 각주를 근거로 "telegram 만 재현하면 된다"는 축소 판단을 하지 않도록 명시적으로 짚어 둔다.
  - 제안: 코드 변경 자체에는 영향 없음(이미 plan 이 provider 불문 일반화된 재읽기 설계를 택함). e2e 재현(§C, "두 PATCH 를 실제로 겹치게 하는 e2e")을 slack/discord 채널로도 1건 커버하면 이 기존 자기모순의 실제 파급 범위까지 함께 검증된다 — 강제 사항은 아니고 권고.

## 요약

target 은 `spec/5-system/` 전체이지만 이번 세션의 실질 대상은 `spec_impact: none` 인 코드 버그
수정(트리거 config 동시 PATCH lost-update)이라, "새 draft vs 기존 spec" 구도의 CRITICAL/WARNING
급 충돌은 발견되지 않았다. advisory lock 선례(`4-execution-engine.md`)·시크릿 재유도/보존
비대칭(`15-chat-channel.md` §5.4.1/§5.4.1.1)·`TriggersService`↔`ChatChannelBinderService` 호출
방향(convention·data-flow)·API 계약(`2-trigger-list.md`)·데이터 모델(`1-data-model.md §2.8`)을
교차 대조한 결과 plan 의 실측·설계와 spec 서술 사이에 모순이 없고, 오히려 `botTokenRef`(무상태)와
`inboundSigningRef`(유상태) 구분이 plan 이 "잃는 것은 후자뿐"이라 짚은 것을 뒷받침한다. 남는 것은
두 건의 INFO — advisory lock 키 네임스페이스를 추적하는 convention 문서 부재, 그리고 이미
spec 안에 자체 기록된 inbound-signing PATCH 회전 정책의 자기모순(이번 수정 범위와 겹치므로
e2e 커버리지를 provider 전반으로 넓히길 권고)이다. 둘 다 차단 사유는 아니다.

## 위험도

NONE
