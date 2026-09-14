# 보안(Security) 코드 리뷰

## 발견사항

- **[CRITICAL]** 이 PR 이 닫으려는 바로 그 fail-open(`inboundSigningRef` 유실 → 웹훅 인입 서명 검증 우회)이 **window 1 을 통해 여전히 재현 가능**하다.
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` — `update()` 함수 중 `mergedConfig` 계산(517~523행), `Object.assign(trigger, defined, { config: mergedConfig })` + `save(trigger)`(544~547행), 그리고 `mergeExternalConfig()` 정의(814~825행). 해당 window 를 "이 배치에서 고치지 않는다" 고 명시한 개발자 주석은 같은 파일 525~534행.
  - 상세: `chatChannelBinder`(2/3번 창)와 `rotateBotToken`(4번 창)은 이번 PR 로 advisory lock + 락 안 재읽기(`rewriteTriggerConfigLocked`)로 보호되지만, `TriggersService.update()` 자체의 `save(trigger)` 경로(창 1)는 그대로다. `mergeExternalConfig()`는 요청 DTO 에 `chatChannel` 이 **없으면** `next.chatChannel = base.chatChannel` 로 그대로 두는데, 이 `base`(`config ?? trigger.config`)는 **`findById()` 시점의 in-memory 스냅샷**이다. 즉 `chatChannel` 필드를 전혀 건드리지 않는 PATCH(`{ name: "..." }`, `{ isActive: false }` 등)도 매 요청마다 트리거 엔티티 **전체**를 그 스냅샷 위에서 재구성해 `save()` 로 통째로 덮어쓴다.
    재현 시나리오: (1) 트리거 T 가 telegram 이고 아직 `inboundSigningRef` 가 없는 상태(예: 최초 setupChannel 실패로 degraded), (2) 요청 A = `PATCH {chatChannel: {...}}` 가 setupChannel 성공으로 `inboundSigningRef` 를 새로 확립해 락 안에서 커밋(2/3번 창, 이번 PR 로 보호됨), (3) 요청 A 의 `findById()` **이전**에 `findById()` 를 실행한 요청 B = `PATCH {name: "..."}` (chatChannel 필드 없음) 가 A 의 커밋 **이후**에 `save(trigger)` 를 커밋 — 이 경우 B 의 `config.chatChannel` 은 여전히 ref 없는 옛 스냅샷이므로, B 의 `save()` 가 A 가 방금 심은 `inboundSigningRef` 를 **되돌린다**. `Trigger` 엔티티에 `@VersionColumn` 등 낙관적 락도 없어 이 덮어쓰기를 막을 방법이 없다(직접 확인: `entities/trigger.entity.ts` 에 version 컬럼 없음). 결과적으로 `chatChannel` 과 무관한 필드 하나만 바꾸는 PATCH 가 다른 요청이 막 확립한 서명 키를 지워, 그 트리거의 인입 웹훅 서명 검증이 다시 fail-open 이 된다 — 이 PR 이 명시적으로 막으려는 시나리오와 **동일한 결과**다.
    `plan/in-progress/trigger-config-lost-update.md` §D 는 창 1 을 "이 배치에서 고치지 않는다"고 투명하게 적어 뒀지만, 거기서 "창 2·3·4 를 닫고 나면 `inboundSigningRef` 의 **영속적** 유실은 사라지고, 여기 남는 것은 «손대지 않은 `config` 키» 의 유실이다" 라고 적은 부분은 위 재현 경로상 부정확해 보인다 — `chatChannel`(그리고 그 안의 `inboundSigningRef`)도 "손대지 않은 config 키" 로서 창 1 의 사정권 안에 있다. 즉 문서가 실제보다 넓게 "닫혔다" 고 말하고 있다.
  - 제안: 창 1 을 후속 작업으로 미루는 결정 자체는 (테스트 회귀 실측이 있으므로) 수용 가능하지만, 위험 서술을 정정해야 한다 — §D 에 "`chatChannel`/`inboundSigningRef` 도 창 1 의 사정권에 있다"는 사실을 명시하고, 이 항목의 우선순위를 "데이터 일관성" 이 아니라 "인증 우회 재발 가능" 축으로 재평가할 것을 권고한다. 최소 완화책으로는 (a) `chatChannel` 이 DTO 에 없을 때 `mergeExternalConfig` 가 `base.chatChannel` 대신 **락 안에서 재읽은 최신 chatChannel** 을 넣도록 하거나, (b) `Trigger` 에 낙관적 락(`@VersionColumn`) 을 도입해 stale 스냅샷 기반 `save()` 자체를 실패시키는 방법이 있다.

- **[INFO]** `rewriteTriggerConfigLocked` 의 재읽기/쓰기가 `workspaceId` 로 스코핑되지 않는다.
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:75`(`m.findOne(Trigger, { where: { id: triggerId } })`), `:94`(`m.update(Trigger, { id: triggerId }, patch)`).
  - 상세: 현재 모든 호출부(`chat-channel-binder.service.ts`, `triggers.service.ts`)는 이미 `findById(id, workspaceId)` 로 workspace 소속을 검증한 뒤의 `trigger.id` 만 넘기므로 오늘 기준으로는 크로스 테넌트 위험이 실제로 열려 있지 않다. 다만 이 헬퍼가 앞으로 다른 호출부에서 재사용될 경우, `triggerId` 만으로 임의 행을 재작성할 수 있는 형태라 방어 계층이 전적으로 "호출자가 알아서 검증했겠지" 라는 가정에 의존한다.
  - 제안: 최소 변경으로 `merge` 콜백이 반환한 `config` 를 쓰기 직전에 `columns` 와 함께 `workspaceId` 를 옵션 인자로 받아 `WHERE id = $1 AND workspace_id = $2` 형태로 좁히는 방어적 스코핑을 고려. 지금 당장 막을 필요는 없으나(현재 호출부 안전), 다음 호출부 추가 시 실수를 막는 가드로 유효하다.

- **[INFO]** `chatChannelLastError` 에 provider 원문 에러 메시지가 그대로 저장된다(변경 없음, 기존 동작 유지).
  - 위치: `codebase/backend/src/modules/triggers/chat-channel-binder.service.ts:302`(`chatChannelLastError: message.slice(0, 1024)`).
  - 상세: 이번 diff 가 새로 만든 문제는 아니며, plan 의 "하지 않는 것" 절에서 "`chatChannelLastError` 원문 노출(별 항목, 보안 축이 다르다)" 로 명시적으로 범위 밖 처리했다. 다만 provider SDK 에러(특히 axios 계열)가 요청 URL 에 bot token 을 포함한 채로 에러 메시지를 구성하는 경우가 흔해 이 필드가 API 응답으로 노출되면 시크릿 유출 경로가 될 수 있다. 이번 PR 범위는 아니므로 참고용으로만 남긴다.
  - 제안: 별도 트래커 항목에서 provider 에러 메시지에 대한 redaction/allow-list 적용 검토(이미 언급된 대로, 이 PR 에서 처리할 필요는 없음).

- **[INFO]** advisory lock key 의 32비트 해시 공간을 `exec-cap:<workspaceId>` 계열과 공유(`hashtext()`).
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:18`(`TRIGGER_CONFIG_LOCK_PREFIX`).
  - 상세: 이미 이 PR 의 `--impl-prep` consistency check(`review/consistency/2026/09/14/17_10_16` naming_collision WARNING#2)에서 지적되었고, 코드 주석(JSDoc)으로 "Redis 키가 아니다" 를 명시하는 완화 조치가 반영되어 있다. 충돌 시 결과는 무관한 두 잠금이 우연히 직렬화되는 것뿐이라(크로스 테넌트 데이터 노출 아님) 보안 취약점은 아니다. `redis-keys.md §4` 등재는 planner 범위로 별도 등재됨.

## 요약

이번 PR 은 `trigger.config` 동시 PATCH 로 인한 lost-update — 특히 `chatChannel.inboundSigningRef` 유실로 인한 웹훅 인입 서명 검증 fail-open — 을 막기 위해 Postgres advisory lock(`pg_advisory_xact_lock`) + 락 안 재읽기 패턴을 `ChatChannelBinderService.setupChatChannel()`(성공/실패 두 경로)과 `TriggersService.rotateBotToken()` 세 지점에 배선했다. 외부 HTTP 호출을 락 밖에 두고 임계 구간을 "재읽기+머지+쓰기" 로 좁힌 설계는 이전에 기각된 Cafe24 사례(락 안에 HTTP 를 두어 커넥션을 오래 점유)의 반론을 정확히 피하고 있고, `inboundSigningRefSurvives` 게이트를 락 안에서 재계산하도록 정정한 점(`survivesWithFresh`)도 `--impl-prep` WARNING#1 을 올바르게 반영했다. 파라미터화된 쿼리, 시크릿 하드코딩 없음, e2e 테스트의 견고한 인터리빙 설계도 확인했다.
다만 developer 자신이 §A 에서 식별한 네 개의 lost-update 창 중 **창 1**(`TriggersService.update()` 의 `save(trigger)`) 은 이번 배치에서 의도적으로 남겨 두었는데, 그 창을 통해서도 정확히 같은 `inboundSigningRef` 유실 → fail-open 시나리오가 재현 가능하다(위 CRITICAL 항목). `chatChannel` 필드를 전혀 포함하지 않는 PATCH(이름 변경 등)가 `mergeExternalConfig()` 를 거치며 요청 시작 시점의 stale `config.chatChannel` 스냅샷으로 트리거 전체를 덮어쓰기 때문이며, `Trigger` 엔티티에 낙관적 락도 없다. plan 문서 자체는 이 창을 투명하게 트래커에 등재했지만, "inboundSigningRef 의 영속적 유실은 사라진다" 는 서술은 이 경로를 놓치고 있어 위험을 실제보다 좁게 서술하고 있다. 이 PR 을 이 상태로 병합하면 보안 취약점의 "닫혔다" 는 인상을 주지만 실제로는 더 좁아진 형태로 남아 있으므로, 최소한 plan 서술 정정과 후속 우선순위 재평가(인증 우회 축)를 권고한다. 그 외 발견은 모두 INFO 수준(기존에 이미 추적 중이거나 방어심층 권고)이다.

## 위험도

CRITICAL
