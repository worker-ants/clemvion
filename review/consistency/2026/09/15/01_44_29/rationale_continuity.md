# Rationale 연속성 검토 — trigger-config-lost-update

검토 모드: `--impl-done` (scope=`spec/5-system/`, diff-base=`origin/main`). 이 브랜치는 `spec/5-system/`
파일을 수정하지 않았다(델타 0, 정상). 따라서 이번 검토는 **코드 diff(17개 파일)가 기존
`spec/5-system/*` 및 인접 spec(`2-navigation/4-integration.md`, `1-data-model.md`,
`data-flow/10-triggers.md`)의 `## Rationale` 에서 이미 정한 결정·기각한 대안·원칙을 그대로
지키는지**를 코드/JSDoc/plan 을 직접 대조해 판정했다.

## 발견사항

- **[WARNING] R-CC-22 원칙의 네 번째 재발 — 신규 파일이 chat-channel `code:` glob 밖에 있다**
  - target 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts` ·
    `trigger-config-lock.spec.ts` (이 PR 신규 파일, `git diff --diff-filter=A origin/main...HEAD` 로 확인)
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `### R-CC-22. triggers/ 안의 chat-channel
    구현 경로를 code: 에서 glob 으로 잡는다` — "같은 누락이 세 번 연속 났다" 며 **명시 나열을
    버리고 술어(glob)로 전환한 것 자체가 결정**이고, 그 근거는 "증가가 예정된 집합은 열거가
    아니라 술어로 잡는다" 다.
  - 상세: 현재 frontmatter `code:` 는 `chat-channel-*.ts` · `dto/**/chat-channel-*.dto.ts` ·
    `trigger-callback-url*.ts` · 명시 경로(`triggers.service.ts` 등) 로 구성돼 있다.
    `trigger-config-lock.ts` 는 이 PR 이 4개 쓰기 창(chat-channel setup/teardown·rotate·삭제·
    notification/interaction secret 재작성)의 lost-update 방지를 담당하는 **공용 프리미티브**로
    새로 만들었는데, 파일명이 `chat-channel-*` 패턴에 들지 않아 R-CC-22 가 고치려던 바로 그
    형태(신규 파일이 `code:` 밖에 남는 것)가 **네 번째로 재발**했다. 이 PR 이 이 사실을 스스로
    적어 두었다(`plan/in-progress/trigger-config-lost-update.md` §D "--impl-prep · /ai-review
    등재 항목" 표 1행, `review/code/2026/09/14/18_17_44` requirement W5 인용) — 은폐된 결함이
    아니라 **인지는 됐으나 아직 닫히지 않은** 상태다. `spec/` 쓰기는 developer 권한 밖이라
    이 PR 안에서 닫을 수 없다는 처분도 맞다.
  - 제안: planner 턴에서 `spec/5-system/15-chat-channel.md` 의 `code:` glob 을 넓히거나(예:
    `trigger-config-lock*.ts` 추가, 또는 술어를 "triggers/ 안의 config 원자성 관련 파일" 로
    재정의) `spec/2-navigation/2-trigger-list.md`/데이터모델 쪽에 이 파일의 소유권을 옮기는
    결정을 내려야 한다. 이 발견은 이미 plan 에 등재돼 있으므로 **새로 발견된 문제가 아니라
    "아직 안 닫혔다" 는 재확인**이다 — 별도 planner 플랜 티켓이 없다면 이번에 만들 것을 권고.

- **[INFO] 락 key 네임스페이스(`trigger-config:*`) 가 `redis-keys.md §4/§5` 미등재 — 이미 추적 중인 gap 재확인**
  - target 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:6-18`
    (`TRIGGER_CONFIG_LOCK_PREFIX`)
  - 과거 결정 출처: `spec/conventions/redis-keys.md` `## 4. 인접 네임스페이스`(`{도메인}:{용도}:{id}`
    꼴이지만 Redis 를 경유하지 않는 것은 인접 네임스페이스로 명시 등재) · `## 5. 새 키를 도입하면
    등재한다` · Rationale "왜 인접 네임스페이스를 명시하나"(과거에 실제로 Socket.IO 채널을 Redis
    키로 오인 등재했던 사고가 이 절의 존재 이유).
  - 상세: 코드 JSDoc 자체가 "이 문자열은 Redis 키가 아니다" 를 명시하고 자매 사례
    (`exec-cap:<workspaceId>`, `execution-engine.service.ts`)도 함께 미등재임을 정확히
    지적한다. 즉 원칙은 알고 있고 우회하지 않았으며, 등재 의무만 planner 로 넘겼다
    (`--impl-prep` `review/consistency/2026/09/14/17_10_16` naming_collision WARNING#2 로 이미
    수용됨). 새 발견이 아니라 스코프(`spec/5-system` 아님, `spec/conventions/`) 밖에서 이미
    처리 경로가 확정된 항목이라 INFO 로 하향한다.
  - 제안: 조치 불요(이미 등재된 planner 후속). 다만 두 세션 이상 지나도 planner 턴이 없다면
    다음 트래커 그루밍에서 우선순위를 올릴 것.

- **[INFO] Cafe24 advisory lock 기각 선례와의 대조는 정합적으로 수행됨 (반증 아님, 확인 기록)**
  - target 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:97-116`
    (`rewriteTriggerConfigLocked` JSDoc "외부 호출을 락 안에 두지 않는다 — 기각된 선례가 그
    이유다") · `chat-channel-binder.service.ts:260-266`(`setupChannel` 호출 **후**에
    `rewriteTriggerConfigLocked` 호출을 실측 확인)
  - 과거 결정 출처: `spec/2-navigation/4-integration.md` `### BullMQ cafe24-token-refresh 큐`
    Rationale — "PostgreSQL advisory lock: … lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해
    DB 커넥션 점유 시간이 늘고 … " 를 **명시적으로 기각**.
  - 상세: 이 PR 은 동일한 1차 도구(`pg_advisory_xact_lock(hashtext(...))`)를 다른 도메인
    (`trigger.config`)에 도입하면서, 기각 근거였던 "HTTP 호출을 트랜잭션 안에 묶는다" 는
    조건을 **구조적으로 피했다** — 코드를 직접 대조한 결과 `adapter.setupChannel(...)` 호출은
    락 트랜잭션(`rewriteTriggerConfigLocked`) **밖**에서 먼저 끝나고, 락 트랜잭션은 그 결과를
    받아 재읽기+병합+`UPDATE` 만 수행한다. 실행엔진의 admission-lock 선례(`execution-engine
    .service.ts:2977`, 순수 SQL 구간)와도 결이 같다. **기각된 대안의 무비판적 재도입이
    아니라, 기각 사유를 해소한 설계**라는 JSDoc 의 주장이 코드로 뒷받침된다.
  - 제안: 없음 — Rationale 연속성 관점에서 모범 사례로 기록해 둔다.

- **[INFO] R-CC-21("PATCH 는 비밀을 쓰지 않는다")·"trigger.config 를 넘겨받은 in-memory 값으로
  읽으면 안 된다" 내부 불변식과 충돌 없음**
  - target 위치: `chat-channel-binder.service.ts:181-187`, `trigger-config-lock.ts:154-161`
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` R-CC-21 및 그 절이 기각한 대안 목록
    ("botToken 을 optional 로 두고 값이 오면 무시" 등).
  - 상세: 이번 설계가 추가한 "락 안에서 DB 행을 다시 읽는다" 는 동작은 R-CC-21 이 금지한
    "PATCH 로 넘어온 값으로 비밀을 갱신"과는 다른 축이다 — 코드 주석이 그 구분("두 출처를
    같은 것으로 읽지 말 것")을 명시적으로 적어 혼동을 예방하고 있고, `botToken`/
    `inboundSigningPlaintext` 를 PATCH 에서 계속 차단하는 기존 로직(`storeUserSuppliedSecrets`
    게이팅)은 그대로 유지된다. R-CC-10(단일 rotate 경로)도 `rotateBotToken` 경로가 그대로
    전담해 변경되지 않았다.
  - 제안: 없음.

## 요약

이번 브랜치는 `spec/5-system/` 문서 자체를 건드리지 않는 순수 코드 PR 이며, `trigger.config`
동시 쓰기 lost-update 를 advisory lock + 락 안 재읽기로 닫는다. 설계 과정(13라운드 리뷰 기록)에서
개발자가 **스스로** 두 개의 실제 과거 Rationale — (1) `spec/2-navigation/4-integration.md` 의
Cafe24 advisory-lock 기각, (2) `spec/5-system/15-chat-channel.md` R-CC-21 의 "trigger.config
읽기 금지" 내부 불변식 — 을 찾아 대조하고, 기각 사유가 재도입되지 않도록 구조(외부 호출을 락
밖에 둠)로 반영했다는 점이 코드 확인으로 뒷받침된다. 유일하게 남는 연속성 결함은
**R-CC-22 가 "명시 나열 대신 술어로 잡으라" 고 정한 원칙이, 그 원칙을 만든 지 얼마 되지 않아
신규 파일(`trigger-config-lock.ts`)에 대해 다시 한번(4번째) 실패했다는 것**인데, 이는 이미
developer 자신이 인지·등재했고 spec 쓰기 권한이 없어 planner 턴으로 넘겨 둔 상태다 — 은폐가
아니라 **미완결 후속**이므로 WARNING 으로 낮춰 기록한다. 그 외 advisory lock 키 네이밍
미등재(`redis-keys.md`)도 이미 이전 라운드에서 수용된 항목의 재확인일 뿐 새로운 위반이 아니다.

## 위험도

LOW
