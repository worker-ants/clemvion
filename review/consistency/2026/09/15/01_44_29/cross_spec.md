# Cross-Spec 일관성 검토 — trigger-config-lost-update (--impl-done, scope=spec/5-system)

## 전제

이 검토의 target scope(`spec/5-system/`)는 `origin/main` 대비 **spec 델타 0개 파일**이다 —
이 브랜치는 spec 을 고치지 않았다(`plan/in-progress/trigger-config-lost-update.md` frontmatter
`spec_impact: none`). 구현 diff(17 파일 / 3145줄, `triggers`·`schedules`·`hooks` 모듈의 advisory
lock 기반 lost-update 수정)만 있고, 코드-온리 PR 이므로 spec 델타 0 자체는 정상이다.

따라서 본 검토는 "target 문서가 다른 spec 과 충돌하는가" 대신 — **이 구현이 기존
`spec/**` 의 다른 영역이 세운 계약·명명·설계 선례와 충돌하는가**를 물었다. 확인한 축:
데이터 모델(`1-data-model.md` Trigger/Schedule), API 계약(`15-chat-channel.md` §5.4/§5.4.1
에러 코드), 기각된 설계 선례(`2-navigation/4-integration.md` Cafe24 advisory lock 기각),
naming(`conventions/redis-keys.md`), spec `code:` glob 커버리지(`15-chat-channel.md` frontmatter).

결론부터: **직접 모순(CRITICAL)·미결 우선순위 충돌(WARNING)은 발견되지 않았다.** 아래
INFO 세 건은 developer 자신이 plan §D "`--impl-prep`·`/ai-review` 등재 항목(planner 범위)"에
이미 등재해 둔 것과 동일 대상이며, 독립적으로 재확인한 결과 여전히 유효하다(신규 발견 아님).

## 발견사항

- **[INFO]** `spec/5-system/15-chat-channel.md` 의 `code:` glob 이 신규 파일
  `trigger-config-lock.ts` 를 안 문다 — 그 glob 규칙(R-CC-22)이 막으려던 결함의 4번째 재발
  - target 위치: (target 은 spec 델타 0 이므로 해당 없음 — 아래 "충돌 대상" 자체가 점검 지점)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` frontmatter `code:` (5~9번째 줄) —
    `codebase/backend/src/modules/triggers/chat-channel-*.ts` glob. R-CC-22 는 "명시 경로로
    두었더니 새 파일이 세 번 연속(#1317·#1319·#1320) 누락됐다"는 이유로 glob 을 도입한
    조항이다.
  - 상세: 이번 PR 이 신설한 `codebase/backend/src/modules/triggers/trigger-config-lock.ts` 는
    파일명이 `chat-channel-` 로 시작하지 않아 그 glob 에 안 걸린다. 실측(`git -C <worktree>
    grep`)으로 확인: 해당 파일은 `chat-channel-binder.service.ts`(락 안 재계산 게이트
    `survivesWithFresh`)·`hooks.service.ts`(webhook 인입 hot path 의 `inboundSigningRef` 보존)와
    직접 결합돼 있고, chat-channel 의 `inboundSigningRef` fail-open 방지가 이 파일의 존재
    이유다 — 그런데도 §7 "관련 파일 tree"·`code:` 어느 쪽에도 잡히지 않는다. 정확히 R-CC-22 가
    "다음 파일도 놓칠 것"이라 예고한 그 클래스의 재발이다(developer 자신이 이미 이렇게
    정리: `spec-draft-nullable-notation-followups.md` 및 본 plan §D).
  - 제안: `project-planner` 가 `15-chat-channel.md` frontmatter `code:` 에
    `trigger-config-lock.ts` 를 추가(또는 glob 을 `modules/triggers/*trigger-config*.ts`
    까지 넓히거나 `chat-channel-*` 접두 자체를 재검토)하고 §7 tree 도 동기화. `spec/` 은
    developer 권한 밖이라 이 브랜치에서 닫을 수 없다(이미 plan §D 에 planner 항목으로 등재됨).

- **[INFO]** advisory lock key 두 계열이 `redis-keys.md §4`(인접 네임스페이스)에 미등재
  - target 위치: 해당 없음(spec 델타 0)
  - 충돌 대상: `spec/conventions/redis-keys.md` §4 "인접 네임스페이스 — Redis 키가 아닌데
    형태가 비슷한 것" 표 (78~86번째 줄)
  - 상세: §4 는 `{도메인}:{용도}:{id}` 꼴이지만 Redis 를 경유하지 않는 식별자를 모아 혼동을
    막으려는 절인데, 표에는 Socket.IO 채널·in-memory Map 키·BullMQ 내부 키만 있고 **Postgres
    advisory lock 문자열 계열이 하나도 없다**. 이번 PR 이 신설한 `trigger-config:<triggerId>`
    (`trigger-config-lock.ts` — `pg_advisory_xact_lock(hashtext(...))` 입력)뿐 아니라, 같은
    메커니즘의 기존 자매 사례 `exec-cap:<workspaceId>`(`execution-engine.service.ts`)도
    이미 미등재 상태였다. 코드 쪽은 문제를 인지하고 있다 —
    `TRIGGER_CONFIG_LOCK_PREFIX` 의 JSDoc 이 "이 문자열은 Redis 키가 아니다"를 명시하고 이
    갭을 직접 언급한다. 즉 **코드 주석과 convention 문서 사이에 이미 알려진 채로 방치된
    간극**이다 — 정확히 §4 도입 사유("초안이 `background:run:<id>` 를 Redis 키로 잘못
    등재했다")가 재발할 조건을 만든다.
  - 제안: `project-planner` 가 `redis-keys.md §4` 표에 `trigger-config:<id>`·`exec-cap:<id>`
    두 계열을 함께 등재(실체·SoT 링크 포함). 이미 plan §D 에 "두 계열을 함께 planner 로
    등재한다"로 명시돼 있어 이 결정은 developer 자신도 필요성에 합의한 상태다.

- **[INFO]** `15-chat-channel.md` §5.4.1.1 내부의 기존 회전 정책 자기모순이 이번 수정 범위와
  겹친다 (spec-internal — 이 PR 이 만든 것은 아니며, 전회 `--impl-prep` 검토에서 이미 INFO 로
  등재된 항목의 재확인)
  - target 위치: 해당 없음(spec 델타 0)
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1.1 표(447번째 줄) vs 같은 절 각주
    (450번째 줄) — **문서 내부** 두 서술의 충돌
  - 상세: 447번째 줄 표는 "v1 미정의 — PATCH body 의 `inboundSigningPlaintext` 는 항상 400
    차단, `chatChannel` 실린 PATCH 는 저장된 signing 값을 바꾸지 않는다"고 선언한다. 그런데
    바로 아래 450번째 줄 각주(2026-09-10 정합화)는 "회전 행은 처음부터 v1 차단을 선언하고
    있었으나 **구현이 정반대였다** — slack/discord 에서 `inboundSigningPlaintext` 부재를
    400 으로 막고 값이 있으면 통과시켜 **매 chatChannel PATCH 마다 회전이 강제**되고
    있었다"고 정정한다. 즉 표 문면과 실제 동작(각주가 서술하는 실측)이 같은 문서 안에서
    어긋난 채 남아 있다. 이것이 본 PR 과 겹치는 이유: lost-update 수정이 정확히
    `inboundSigningRef`(§A "무엇이 실제로 사라지나")를 다루고, 두 PATCH 경합 시 나중 것이
    옛 ref 로 복원해 fail-open 을 재현하는 경로가 이 각주가 서술하는 slack/discord 회전
    행동과 같은 필드를 공유한다. 이번 구현은 provider 를 구분하지 않고 일반화된
    "락 안 재읽기 + 게이트 재계산" 설계를 택해(§B "survivesWithFresh") 이 모순이 실제로
    어느 쪽이든 결과적으로 안전하다 — 다만 e2e 검증(§C)은 **telegram 한 provider만** 겹침을
    재현했고, slack/discord 겹침은 검증되지 않은 채 남았다(plan §C 가 이를 "권고, 강제
    아님"으로 명시).
  - 제안: (a) spec 정정은 `project-planner` 범위 — 표(447줄) 문면을 각주(450줄)의 실측에
    맞춰 정정하거나, 반대로 실제 코드 동작을 표에 맞게 되돌릴지 결정(spec 본문끼리의 충돌이라
    구현으로 닫을 수 없다는 developer 자신의 판단에 동의). (b) 선택 사항으로 slack/discord
    provider 로도 동시-PATCH e2e 1건을 추가하면 이 문서 내부 모순의 실제 파급 범위(telegram
    한정인지 전 provider 인지)가 코드로 확정된다 — 이번 라운드에서 필수로 요구하지는 않음.

## 참고 — 검토했으나 충돌 없음으로 확인한 항목

- **기각된 설계 선례와의 대조**: `spec/2-navigation/4-integration.md` "검토 후 배제한 대안"
  절이 Cafe24 토큰 갱신에서 `pg_advisory_xact_lock(hashtext(integrationId))` 를 "lock 보유 중
  HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고"라는 이유로 명시
  기각했다. 이번 PR 은 같은 프리미티브(advisory lock)를 쓰지만 `trigger-config-lock.ts` 실측
  결과 **외부 provider HTTP 호출은 락 밖에서 실행되고, 락 안에서는 재조회+병합+UPDATE 만
  일어난다** — 기각 사유가 정확히 피하는 설계라 재도입이 아니다. plan 자체도 이 대조를
  명시(§B "반대 선례와의 대조")하고 있어 독립 확인 결과 일치한다.
- **API 에러 계약**: `rotateBotToken`·`revokePerTriggerToken` 등이 삭제 경합 시 새로 던지는
  404 `RESOURCE_NOT_FOUND` 는 `15-chat-channel.md` §5.4 에러 표(371번째 줄)와
  `3-error-handling.md`(83번째 줄, `*_NOT_FOUND` → 404 canonical)에 이미 있는 코드·상태값과
  동일하다 — 새 코드 도입이 아니라 기존 계약을 다른 시점(초기 조회 대신 락 안 재조회)에도
  적용한 것뿐이라 API 계약 충돌 없음.
- **데이터 모델**: `spec/1-data-model.md` §2.8 Trigger·§2.9 Schedule·§2.9.1 동기화 규칙 어디에도
  `config` 컬럼의 동시성 보장(예: `@VersionColumn`, 원자적 병합)을 약속하는 문장이 없어, 이번
  advisory lock 도입이 기존 데이터 모델 서술과 모순되지 않는다(추가일 뿐 기존 약속을 깨지
  않음).
- **Schedule↔Trigger cascade 삭제 문서**: `spec/data-flow/10-triggers.md` §1.4 및
  `spec/2-navigation/3-schedule.md` 는 "Schedule 삭제 → cascade delete trigger" /
  "Trigger 삭제 → FK CASCADE로 schedule 동반 삭제"의 **순서**(removeJob 선행)만 규정하고
  원자성·락 여부는 규정하지 않는다 — `SchedulesService.remove()` cascade 경로에 advisory
  lock 을 추가한 것이 이 문서들의 서술과 충돌하지 않는다. `3-schedule.md` frontmatter
  `code:` 는 `schedules.service.ts` 를 명시 경로로 이미 포함하므로(글롭 문제 없음) 위
  chat-channel 사례와 달리 커버리지 갭도 없다.
- **웹훅 hot path**: `spec/5-system/12-webhook.md` (153·399번째 줄)는 `lastTriggeredAt` 갱신을
  "DB 업데이트"로만 서술해 저장 메커니즘(entity `save` vs column-only `update`)을 특정하지
  않는다 — `hooks.service.ts` 를 컬럼 한정 `update` 로 바꾼 것이 이 문서의 서술을 위반하지
  않는다.

## 요약

이번 구현(trigger config 의 lost-update/fail-open 수정, advisory lock 기반)은 spec 을 전혀
고치지 않았고(spec 델타 0), 독립적으로 확인한 결과 데이터 모델·API 계약·상태 전이·RBAC·계층
책임 어느 축에서도 기존 `spec/**` 과의 직접 모순(CRITICAL)이나 우선순위가 불명확한 잠재
충돌(WARNING)은 발견되지 않았다. 오히려 이 PR 은 다른 영역의 명시적으로 기각된 설계
선례(Cafe24 advisory lock 기각 사유)를 정확히 피하도록 설계됐고, 새로 던지는 에러 코드도
기존 canonical 계약을 재사용한다. 발견된 세 건은 전부 **developer 자신이 plan §D 에 이미
"planner 범위"로 등재해 둔 항목**과 동일 대상의 독립 재확인이다 — `code:` glob 커버리지
누락(4번째 재발 패턴), `redis-keys.md §4` 의 advisory-lock 계열 두 개(`trigger-config:*`·
`exec-cap:*`) 미등재, 그리고 이 PR 이전부터 있던 `15-chat-channel.md` §5.4.1.1 내부 자기
모순(표 vs 각주)이 이번 수정 대상 필드(`inboundSigningRef`)와 겹친다는 사실이다. 셋 다
`spec/` 쓰기 권한이 없는 developer 가 닫을 수 없는 항목이며 코드 변경으로 인한 새로운
리스크를 추가하지 않는다.

## 위험도

LOW
