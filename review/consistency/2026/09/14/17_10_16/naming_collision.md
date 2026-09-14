# 신규 식별자 충돌 검토 — `trigger-config-lost-update`

## 검토 범위에 대한 전제

`plan/in-progress/trigger-config-lost-update.md` 는 `spec_impact: none` 이고 "하지 않는 것"에
`spec/ 편집(권한 밖)` 을 명시한 순수 구현(코드) plan 이다. `spec/5-system/` 자체에 새로 추가되는
요구사항 ID·엔티티·API endpoint·이벤트명·spec 파일 경로는 없다. 따라서 축 1(요구사항 ID)·
축 2(엔티티/DTO명)·축 3(API endpoint)·축 4(이벤트/메시지명)·축 6(spec 파일 경로)에는 검토 대상인
"새 식별자"가 존재하지 않는다 — 이 plan 이 재사용하는 `inboundSigningRef` · `chatChannelHealth` ·
`chatChannelSetupAt` · `chatChannelLastError` 등은 모두 `codebase/backend/src/modules/triggers/`
`codebase/backend/src/modules/chat-channel/` 에 이미 존재하는 기존 식별자이며 의미 변경 없이
그대로 재사용된다(`triggers.service.ts` · `chat-channel-binder.service.ts` · `chat-channel-inbound-authenticator.ts` 확인).

실질적으로 검토할 "새 식별자"는 plan §B 가 도입하는 **advisory lock key 문자열**
(`trigger-config:<id>`, `pg_advisory_xact_lock(hashtext($1))` 용) 하나뿐이다 — 이는 축 5
(환경변수·설정키 충돌)의 "설정/네임스페이스 키" 로 취급해 검토했다.

## 발견사항

- **[WARNING]** 신규 lock key `trigger-config:<id>` 가 Redis 키 명명 컨벤션과 같은 모양이지만 Redis 키가 아니다
  - target 신규 식별자: `trigger-config:<id>` (plan §B, `pg_advisory_xact_lock(hashtext(lockKey))` 의 입력 문자열)
  - 기존 사용처: [`spec/conventions/redis-keys.md`](/Volumes/project/private/clemvion/.claude/worktrees/trigger-config-lost-update-9860c6/spec/conventions/redis-keys.md) §1 이 `{도메인}:{용도}[:{식별자}...]` 형태를 Redis 키의 SoT 명명 규약으로 선언하고, §3 인벤토리에는 `chat-channel:<triggerId>:<conversationKey>` · `chat-channel-lock:<triggerId>:<conversationKey>:formsubmit` 등 정확히 이 모양의 키들이 실재 Redis 키로 등재돼 있다. 같은 문서 §4 "인접 네임스페이스 — Redis 키가 **아닌데** 형태가 비슷한 것" 은 바로 이 혼동을 막기 위해 만들어진 절이다(Socket.IO 채널 `execution:<id>` 등 3계열을 이미 예방적으로 등재).
  - 상세: `trigger-config:<id>` 는 `{도메인}:{식별자}` 꼴이라 겉보기엔 §3 인벤토리에 들어갈 Redis 키처럼 보이지만, 실체는 Postgres `pg_advisory_xact_lock(hashtext(...))` 의 해시 입력 문자열이다(Redis 를 전혀 경유하지 않음). `redis-keys.md` §4 는 이런 "모양은 같은데 실체가 다른" 키를 정확히 예방하려고 만든 절인데, 정작 이미 존재하는 자매 사례(`execution-engine.service.ts:2974` 의 `exec-cap:${workspaceId}`, 같은 `pg_advisory_xact_lock(hashtext($1))` 메커니즘)조차 §4 에 등재돼 있지 않다. 이번 plan 이 같은 계열의 키를 하나 더 만들면서 그 갭을 그대로 물려받는다 — 다음 사람이 "lock key 목록"을 찾을 때 `redis-keys.md` 를 SoT 로 믿고 검색하면 `trigger-config:*` 도 `exec-cap:*` 도 찾지 못한다.
  - 제안: 구현 시 `redis-keys.md` §4 표에 `exec-cap:<workspaceId>` 와 신규 `trigger-config:<id>` 를 "Postgres advisory-lock hashtext 입력 (Redis 아님)" 한 줄로 함께 등재한다(§4 는 이미 "인접 네임스페이스" 포인터 목적이라 상세 SoT 는 각 소유 문서에 남기고 이 표엔 포인터만 추가하면 됨). 또는 최소한 코드 주석에 "이 문자열은 Redis 키가 아니다"를 명시해 grep 으로 `redis-keys.md` 인벤토리와 혼동되지 않게 한다.

- **[INFO]** `pg_advisory_xact_lock(hashtext(...))` 전역 32비트 키 공간을 두 계열이 접두어만 다르게 공유
  - target 신규 식별자: `trigger-config:<id>`
  - 기존 사용처: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2974` 의 `exec-cap:${workspaceId ?? execution.workflowId}`
  - 상세: 두 계열 모두 문자열을 `hashtext()` 로 32비트 정수화한 뒤 그 정수를 `pg_advisory_xact_lock` 의 단일 키로 쓴다. `pg_advisory_xact_lock(bigint)` 의 잠금 ID 공간은 애플리케이션 전역에서 공유되므로, 리터럴 문자열(`exec-cap:...` vs `trigger-config:...`)이 달라도 해시가 우연히 같은 32비트 값으로 충돌하면 서로 무관한 두 자원(어떤 워크스페이스의 실행 admission ↔ 어떤 트리거의 config 갱신)이 의도치 않게 서로 직렬화된다. 정확성 버그는 아니지만(잠금은 결국 풀린다) 가용성/지연 이상 현상으로 나타나고 원인 추적이 매우 어렵다. 계열이 두 개일 때는 확률이 낮지만, 이 메커니즘을 베끼는 세 번째 사용처가 생기면 그 확률은 계열 수의 제곱에 비례해 오른다.
  - 제안: 급하지 않음(계열이 둘뿐이라 실무 위험은 낮다). 다만 이번 구현에서 `pg_advisory_xact_lock(key1 int, key2 int)` 2-int 오버로드로 전환해 `key1=hashtext('trigger-config')` 같은 class-id, `key2=hashtext(triggerId)` 같은 instance-id 로 나누면 다른 계열(`exec-cap` 등, class-id 가 다름)과 충돌 공간이 원천적으로 분리된다. 채택하지 않는다면 최소한 이 설계 결정을 plan 또는 구현 커밋 메시지에 "hashtext 32비트 충돌 확률은 낮음, 계열 2개 기준 수용" 정도로 명시적으로 기록해 다음 사람이 "왜 안 나눴나"를 재조사하지 않게 한다.

## 검토했으나 충돌 없음으로 판정한 것들

- `inboundSigningRef` / `previousInboundSigningRef` / `chatChannelHealth` / `chatChannelSetupAt` / `chatChannelLastError` — 전부 `triggers.service.ts` · `chat-channel-binder.service.ts` · `chat-channel/types.ts` 에 기존 정의된 식별자를 그대로 재사용. 새 의미 부여 없음.
- lock 메커니즘 이름 자체(advisory lock) — 자매 케이스 `execution-engine.service.ts:2929~2990` 의 설계를 plan 이 명시적으로 인용하며 "그대로 베끼면 안 되는 차이"를 스스로 구분해 서술함 (외부 호출을 락 밖에 두는 점).
- `chat-channel-lock:{triggerId}:{conversationKey}:formsubmit` (Redis, `channel-conversation.service.ts`) — 이름이 비슷해 보이지만 리터럴 문자열이 달라 직접 충돌은 없고, 백엔드(Redis SET NX vs Postgres advisory lock)와 스코프(대화별 폼 제출 dedup vs 트리거 config 갱신 직렬화)가 모두 달라 혼동 위험이 낮다고 판단(WARNING 승격 보류).
- 프런트엔드 `trigger-configs.tsx` (에디터 노드 설정 컴포넌트, `spec/4-nodes/7-trigger/1-manual-trigger.md` 참조) — "trigger config" 라는 영어 표현은 겹치지만 도메인이 완전히 다르고(프런트 UI 컴포넌트 파일명 vs 백엔드 분산 잠금 키), 실제 리터럴 식별자 충돌은 없음.
- API endpoint / 이벤트명 / 환경변수 / spec 파일 경로 — 이번 plan 은 새로 추가하지 않음(§ "하지 않는 것"에서 `spec/` 편집 자체를 배제).

## 요약

이 plan 은 `spec/` 을 건드리지 않는 순수 구현 작업이라 요구사항 ID·엔티티·API endpoint·이벤트명·
spec 파일 경로 축에는 신규 식별자 충돌이 없다. 유일하게 검토할 가치가 있던 신규 식별자는 §B 가
제안한 advisory lock key 문자열 `trigger-config:<id>` 로, 리터럴 값 자체는 기존 `exec-cap:<workspaceId>`
와 다르지만 (1) `redis-keys.md` 가 규정한 Redis 키 명명 형태(`{도메인}:{식별자}`)와 겉모양이 같아
그 SoT 문서의 "인접 네임스페이스" 예방 절(§4)에 등재되지 않은 채로 남는 문제, (2) 같은
`pg_advisory_xact_lock(hashtext(...))` 메커니즘을 공유해 전역 32비트 잠금 ID 공간에서 낮은 확률의
해시 충돌 여지를 안고 있는 문제 두 가지가 있다. 둘 다 즉시 구현을 막을 사안은 아니지만, 전자는
문서 등재로 쉽게 닫을 수 있고 후자는 설계 결정을 명시적으로 기록해 두는 것으로 충분하다.

## 위험도

LOW
