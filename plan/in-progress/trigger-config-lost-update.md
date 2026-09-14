---
worktree: trigger-config-lost-update-9860c6
started: 2026-09-14
owner: developer
spec_impact: none
---

# 동시 PATCH 가 `trigger.config` 를 잃는다 — 그리고 닫아 둔 fail-open 이 그 경로로 되살아난다

트래커 항목 *"동시 PATCH 가 `trigger.config` 를 잃을 수 있다 (lost update)"*
(2026-09-11 등재 · `/ai-review` `review/code/2026/09/10/23_55_23` `concurrency` W1 +
`database` INFO 가 같은 지점을 TOCTOU 로 **독립 확인**)을 닫는다.

이 배치의 다른 항목들과 성격이 다르다 — **하드닝이 아니라 실제 결함**이고, 잃는 것이
`inboundSigningRef` 라 **인입 서명 검증이 fail-open 으로 되돌아간다.**

## A. 착수 전 실측 — 창이 **넷**이다 (트래커는 둘로 적었다)

넷 다 «읽기 → 쓰기» 사이가 락·트랜잭션·버전 비교 **없이** 이어지고, 쓰기는 읽은 시점의
**in-memory 스냅샷**으로 `config` 를 통째로 재구성한다. 2·3·4 는 그 사이에 **외부 호출**까지 낀다.

| # | 함수 | 읽기 | 외부 호출 | 쓰기 |
|---|---|---|---|---|
| 1 | `TriggersService.update()` | `findById` `:468` | — (없다) | `save(trigger)` `:531` |
| 2 | `ChatChannelBinderService.setupChatChannel()` **성공** | 넘겨받은 스냅샷 | `adapter.setupChannel` `:195` | `triggerRepository.update` `:230` |
| 3 | 같은 함수 **catch** | 같음 | 같음(던진 뒤) | `triggerRepository.update` `:262` |
| 4 | `TriggersService.rotateBotToken()` | `findById` `:999` | `adapter.setupChannel` `:1071` | `triggerRepository.update` `:1101` |

2·3·4 의 쓰기는 전부 `{ ...(trigger.config ?? {}), chatChannel: … }` — 오래된 스냅샷 위에
덮는다. 그 사이에 다른 PATCH 가 커밋한 키는 **되돌아간다.**

> 위 표의 `:NNN` 은 **착수 전(= `origin/main`) 기준 앵커**다. 이 브랜치가 그 자리들을 고쳤으므로
> 현재 HEAD 에서는 맞지 않는다 — 지금 코드를 찾을 땐 함수 이름으로 가라.

> **트래커는 둘로 적었고, 내 첫 판은 셋으로 적었다.** 전수로 세니 **넷**이다 — 빠져 있던 것이
> binder 의 **catch 경로**(`:262`)이고, 하필 **e2e 에서 실제로 도달하는 경로가 그것**이다
> (외부 provider mock 이 없어 `setupChannel` 이 항상 던진다). 성공 경로만 보고 테스트를 짰으면
> **재현 자체가 안 됐을 것이다.**
>
> 그중 둘(2·3)은 `TriggersService` 가 아니라 **`ChatChannelBinderService` 안**이다(T2 이후).
> 락을 어디에 두느냐가 실제로 갈리는 지점이 여기다.

> **1번은 외부 호출이 없다** — `findById` 와 `save` 사이는 검증·병합(순수)과 DB 조회
> 하나뿐이다(실측). 그래서 1번은 트랜잭션+락으로 감싸도 외부 호출을 가두지 않는다.

### 무엇이 실제로 사라지나

`update()` 는 병합 **전**에 `previousInboundSigningRef` 를 집어(`:502`) 2에 넘긴다.
2 는 그 값으로 `inboundSigningRef` 를 되살린다. 두 PATCH 가 겹치면 **나중 것이 옛 ref 를
복원**해, 먼저 커밋된 새 ref 가 사라진다 — 그 트리거의 인입 서명이 검증할 대상을 잃는다.

## B. 설계 — 락은 쓰되, **외부 호출을 락 안에 두지 않는다**

선례가 이 저장소에 있다. `execution-engine.service.ts:2977` 이
`pg_advisory_xact_lock(hashtext($1))` 을 트랜잭션 안에서 쓰고, 그 JSDoc 이 근거까지 적는다 —
*"**조건부 UPDATE 단독은 불충분** … advisory lock 이 같은 workspace 의 admission 을
순차화하고 다른 workspace 는 병렬 유지한다."*

**그대로 베끼면 안 되는 차이가 하나 있다**: 그쪽 임계 구간은 순수 SQL 이고, 여기는
**외부 provider HTTP 호출**이 한가운데 있다. 트랜잭션+락을 그 위에 씌우면

- provider 가 느리거나 멈추면 **DB 커넥션과 락을 그동안 붙잡는다**,
- 커넥션 풀이 트리거 수만큼 고갈될 수 있다.

그래서 처방은 **«외부 호출을 락 밖에 두고, 락 안에서 다시 읽는다»** 다:

```
        [락 밖]  adapter.setupChannel(...)          ← 느릴 수 있다
        [락 안]  advisory lock (trigger 단위)
                 config 를 **지금** 다시 읽는다      ← 스냅샷을 버린다
                 그 위에 이번 결과를 머지
                 UPDATE
```

이러면 임계 구간이 «읽기+머지+쓰기» 로 짧아지고, 잃는 것이 없다 — 늦게 도착한 쪽이
**먼저 커밋된 값 위에** 머지하기 때문이다.

### 정정 — 다시 읽어야 하는 것은 **컨테이너가 아니라 presence 게이트**다

`--impl-prep` (`review/consistency/2026/09/14/17_10_16` rationale_continuity **WARNING#1**)
가 첫 판 처방의 구멍을 짚었다. *"`config` 를 다시 읽어 머지"* 만 하면 **머지해 넣는
`chatChannel` 자체가 락 밖에서 옛 값으로 계산된 것**이라 표적 결함이 그대로 재발한다.

실제 게이트는 `chat-channel-binder.service.ts:185`:

```ts
const inboundSigningRefSurvives =
  providerIssuedStored || Boolean(preservedInboundSigningRef);
```

유실 시나리오를 좁히면 — 두 PATCH 가 **ref 가 아직 없을 때** 겹치고 A 가 먼저 확립하는 경우:

| | A | B (동시) |
|---|---|---|
| 읽기 | ref 없음 | ref 없음 |
| A 커밋 | **ref 최초 확립** | — |
| B 의 게이트 | — | `preserved=undefined` · `providerIssued=false` → **`survives=false`** |
| B 쓰기 | — | `chatChannel` 에서 **ref 를 뺀다** → **fail-open** |

그래서 락 안에서 **게이트를 다시 계산**한다:

```
survives = providerIssuedStored
        || Boolean(preservedInboundSigningRef)
        || Boolean(<락 안에서 다시 읽은 행>.config.chatChannel?.inboundSigningRef)
```

### R-CC-21 의 *"`trigger.config` 에서 읽으면 안 된다"* 와 충돌하지 않는다

같은 파일 `:181-184` 가 **`trigger.config` 를 읽지 말라**고 못박는다. 그 금지의 주어는
**함수에 넘어온 in-memory `trigger`** 다 — `update()` 가 `mergeExternalConfig` 로
`config.chatChannel` 을 통째로 갈아치운 **뒤** 넘기므로 거기엔 옛 ref 가 없다.

**락 안에서 DB 행을 새로 읽는 것은 다른 출처다** — 그 시점의 «커밋된 최신 상태» 이고,
동시 요청이 방금 확립한 ref 가 **거기에만** 있다. 두 출처를 같은 것으로 읽으면 이 수정이
불가능해지므로 구현 시 그 구분을 주석에 명시한다.

### 반대 선례와의 대조 — advisory lock 은 이미 한 번 기각됐다

`spec/2-navigation/4-integration.md:1444` 가 Cafe24 토큰 갱신에서
`pg_advisory_xact_lock(hashtext(integrationId))` 를 **명시적으로 기각**했다. 기각 사유:
*"lock 보유 중 HTTP 요청을 transaction 안에 묶어야 해 DB 커넥션 점유 시간이 늘고"*.

**그 사유가 정확히 이 설계가 지키는 제약이다** — 외부 호출을 락 밖으로 뺐으므로 그 반론이
적용되지 않는다. 기각된 대안의 재도입이 아니라 **그 반론을 받은 설계**임을 커밋·PR 에 적는다.
(`--impl-prep` rationale_continuity INFO#3 · plan_coherence INFO#7 이 같은 대조를 권고.)

### lock key 는 Redis 키처럼 생겼지만 Redis 가 아니다

`trigger-config:<id>` 는 `{도메인}:{식별자}` 라 Redis 키와 겉모양이 같은데 실체는
**Postgres `pg_advisory_xact_lock(hashtext(...))` 입력 문자열**이다. `redis-keys.md §4`
(«인접 네임스페이스»)가 정확히 이 혼동을 막으려는 절인데 **자매 사례
`exec-cap:<workspaceId>` 조차 미등재**다(naming_collision WARNING#2).

`spec/` 은 권한 밖이라 **코드 주석에 «이 문자열은 Redis 키가 아니다» 를 명시**하고,
`redis-keys.md §4` 등재는 두 계열(`exec-cap:*` · `trigger-config:*`)을 함께 planner 로 등재한다.

### 락을 어느 층에 두는가 — 트래커가 남긴 결정

트래커: *"호출자(`TriggersService`)가 트랜잭션/락을 열고 binder 를 그 안에서 부를지,
binder 가 스스로 잠글지."*

**위 설계가 그 질문을 없앤다.** 외부 호출이 락 밖에 있어야 하므로 «호출자가 열고 binder 를
그 안에서 부른다» 는 선택지는 애초에 성립하지 않는다(그러면 외부 호출이 락 안에 들어간다).
**각 쓰기 지점이 자기 락을 잡는다** — 세 곳이 같은 lock key(`trigger-config:<id>`)를 쓰므로
서로 직렬화되고, 다른 트리거는 병렬을 유지한다.

### 착수 시 확인할 것 (설계 전제)

- [x] `EntityManager.query` 의 `[rows, rowCount]` 함정 — **해당 없음으로 확정**. 최종 배선은
      `RETURNING` 을 쓰지 않는다(`m.query` 는 `pg_advisory_xact_lock` 한 줄, 반환값 미사용).
      `updateReturningRows` 도 호출하지 않는다.
- [x] 재읽기 시점에 트리거가 **삭제**됐을 수 있다 → **쓰기 skip + `false` 반환**으로 확정.
      호출부 셋은 전부 best-effort 경로라 무시하지만, 반환값을 둔 이유는 «조용히 아무것도
      안 했다» 를 호출부가 관측할 수 있게 하기 위해서다(`trigger-config-lock.ts` JSDoc).
- [x] `chatChannelHealth`·`chatChannelSetupAt`·`chatChannelLastError` 는 «이번 호출의 결과»
      라 머지 대상이 아니다 — **확인**(`:230-238` 셋 다 이번 호출 산출). 재읽기 대상은 `config` 하나.
- [x] **락 안에서 `inboundSigningRefSurvives` 를 재계산**한다 — `survivesWithFresh(freshConfig)`
      로 배선 완료(`chat-channel-binder.service.ts`). 세 번째 항은 재읽은 행의
      `config.chatChannel?.inboundSigningRef`. 성공·실패 두 경로가 같은 술어를 쓴다.
- [x] **`rotateBotToken` 도 같은 게이트를 가진다** — **실측: 갖지 않는다.** 그 경로의
      `mergedChannel` 은 «이번 회전의 산출» 이고 `inboundSigningRef` presence 를 요청 시작
      시점 상태로 게이팅하지 않는다. 그래서 재조율은 불필요하고, 필요한 것은 **컨테이너
      재읽기**뿐이라 `(freshConfig) => ({...freshConfig, chatChannel: mergedChannel})` 로 닫았다.
- [x] `updateReturningRows(result, **detail**)` — **해당 없음**(위와 같은 이유로 `RETURNING` 미사용).

## C. 검증 — 동시성은 unit 이 못 잡는다

이 저장소가 이미 실측한 교훈이다: *"e2e 만 포착, unit 미검출 → 동시성·상태전이엔 e2e 필수"*
(`refactor 06 C-2` 원자 claim). **두 PATCH 를 실제로 겹치게 하는 e2e** 를 쓴다.

판별 fixture 의 조건: 두 요청이 **같은 스냅샷을 보도록** 겹쳐야 한다 — 그러지 않으면 고치기
전에도 통과한다(기록된 *"분기를 못 가르는 fixture"*). 락을 빼는 뮤턴트로 **전 RED → 후 GREEN**
이 아니라 **전(락 없음) 유실 재현 → 후 유실 없음**을 보인다.

### 배선 — `test/trigger-config-lost-update.e2e-spec.ts`

겹침을 우연에 맡기지 않고 **테스트가 advisory lock 을 직접 쥔다**. 요청 B(카드 편집 PATCH)는
`update()` 의 첫 쓰기부터 같은 lock key 를 잡아야 하므로 **아무것도 쓰기 전에** 멈추고,
그동안 테스트가 «요청 A» — *setupChannel 이 성공해 server-issued 서명을 확립하고 자기
스냅샷으로 `config` 를 통째로 다시 쓴 동시 요청* — 를 연기한 뒤 COMMIT 으로 락을 놓는다.

**단언이 셋인 이유**: 하나만으로는 한쪽 자리를 조용히 통과시킨다.

| | 고치기 전 | 고친 뒤 | 단언 |
|---|---|---|---|
| B 의 PATCH 값 | A 가 통째로 덮어 사라진다 | 락 뒤 재읽기라 남는다 | ① `rateLimitPerMinute === 42` |
| A 가 막 확립한 ref | B 가 요청 시작 시점 게이트로 지운다 → fail-open | 게이트 두 항이 재읽은 행에서 온다 | ② `inboundSigningRef` 존재 |
| A 가 함께 커밋한 손대지 않은 키 | B 의 창 1 이 옛 스냅샷으로 덮는다 | 창 1 이 재읽은 행 위에 병합 | ③ 그 키 생존 |

**provider 는 telegram 이다.** 결함의 전제가 *"B 가 읽는 시점에 ref 가 없고, 그 사이 다른
요청이 그것을 처음 확립한다"* 인데, slack/discord 의 PATCH DTO 는 `inboundSigningPlaintext`
를 `OmitType` 으로 아예 갖지 않아 기존 트리거에서 ref 를 **새로 확립**할 수 없다. telegram 의
server-issued 발급만이 그 역할을 하고, 게다가 이 환경의 telegram 트리거는 setupChannel 이
실패해 **ref 없는 행**으로 자연히 만들어진다 — 전제를 만들려고 행을 손으로 긁지 않아도 된다.

**공허성 가드**: 락을 놓기 직전에 «B 가 아직 미완이고 아직 아무것도 쓰지 않았다» 를 관측해
두고 맨 뒤에서 단언한다(④). 앞에서 단언하면 고치기 전 코드가 **유실을 보여 주기 전에** 멈춰
실패 메시지가 «응답이 벌써 왔다» 가 된다 — 실측으로 확인했다.

> **종전엔 창 1 커밋을 폴링으로 기다렸다.** 창 1 이 락 밖에 있던 동안엔 그것이 옳았지만,
> 창 1 을 락 안으로 넣자 그 폴링은 **자기가 쥔 락 때문에 영영 관측되지 않는다** — 교착이다.
> 구조를 고칠 때 테스트의 전제도 함께 바뀐다는 사례라 적어 둔다.

### 실측 — 전(락 없음) 유실 재현 → 후 유실 없음

«고치기 전» 을 **이 PR 이 만진 두 서비스 파일을 `origin/main` 그대로 되돌린 상태**로 정의했다.
부분 되돌리기는 «어디를 되돌렸나» 가 논쟁거리가 되지만, 통째로 이전 상태로 두면 *"이 PR 이
없었다면"* 이 정확히 재현된다. 뮤턴트의 `tsc` 를 먼저 통과시켜 **거짓 RED**(구문·타입 오류로
인한 실패)를 배제했다.

| | 결과 |
|---|---|
| 뮤턴트(`origin/main` 두 파일) | **RED** — `Expected: 42 / Received: 7`. B 의 PATCH 가 통째로 사라졌다 |
| 원본 | **PASS** (4단계 ALL PASS, e2e 308건) |

> **첫 뮤턴트 실행은 엉뚱한 자리에서 RED 였다** — «B 가 아직 미완인가» 관측 단언을 유실
> 단언보다 **앞**에 둬서, 실패 메시지가 `Expected: false / Received: true` 였다. 유실을
> 보여 주기 전에 멈춘 것이다. 관측 값만 붙잡고 단언을 맨 뒤로 옮긴 뒤 다시 재서 위 표를 얻었다.
> **RED 라는 사실만으로는 «무엇을 판별했는가» 가 정해지지 않는다.**

## D. 창 1 — 유예했다가 **되돌렸다**

### 유예의 근거가 틀렸다 (리뷰가 반증)

처음엔 창 1(`update()` 의 `save`)을 열어 두고 이렇게 적었다:

> ~~창 2·3·4 를 닫고 나면 `inboundSigningRef` 의 **영속적** 유실은 사라지고, 여기 남는 것은
> «손대지 않은 `config` 키» 의 유실이다.~~

**거짓이다.** `/ai-review` `review/code/2026/09/14/18_17_44` security CRITICAL#1 이 반례를
들었다 — `chatChannel` 을 **아예 싣지 않은** PATCH(이름 변경 등)도 `mergeExternalConfig` 가
`config ?? trigger.config` 로 옛 스냅샷을 기준 삼아 병합하고 `save` 로 덮는다. 즉 이 PR 이
막으려는 fail-open 이 창 1 로 그대로 재현된다. `Trigger` 에 `@VersionColumn` 도 없다.

**내가 쓴 문장이 구현보다 넓었다.** 실측(단위 6건 RED)은 *"`save` 를 `update`+재조회로 바꾸면
계약이 깨진다"* 를 보였을 뿐인데, 나는 그것을 *"창 1 은 닫을 수 없다"* 로 일반화했다.

### 어떻게 닫았나 — 저장 동사는 건드리지 않는다

병합과 저장을 **같은 advisory lock 안**에 넣고, 기준 `config` 를 **락 안에서 재읽은 행**에서
가져온다. `save(trigger)` 는 그대로다 — 바꾼 것은 «어느 `config` 위에 병합하는가» 와
«그 구간이 직렬화되는가» 뿐이다.

| | 결과 |
|---|---|
| `update` + 재조회로 교체 (첫 시도) | 단위 **6건 RED** — 반환 엔티티·subscriber·409 경로가 함께 달라졌다 |
| `save` 유지 + 락 + 재읽기 (채택) | **1건 RED** → 그 1건은 다른 파일(`triggers.web-chat.spec.ts`)의 mock 누락이었고, 고친 뒤 **291건 전부 통과** |

그 1건도 교훈이 있다: `getRepositoryToken(Trigger)` provider 를 **한 파일 안에서만** 세어
감쌌는데 전수로는 **6개 파일**에 흩어져 있었다. 헬퍼를
`__test-utils__/trigger-transaction-mock.ts` 로 올려 다음 파일이 찾을 수 있게 했다.

### 수정이 테스트로 지켜지는지 — 뮤턴트 4종

리뷰(testing CRITICAL#2·#3)가 실측으로 지적했다: **핵심 수정이 어떤 테스트로도 보호되지
않았다.** 기존 mock 이 전부 `findOne.mockResolvedValue(...)` 라 «최초 읽기 == 락 안 재읽기»
였기 때문이다 — 두 읽기가 같으면 «다시 읽는다» 는 동작은 관측될 수 없다.

`freshFindOne` 으로 두 읽기를 갈라 놓는 suite 를 넣고 뮤턴트로 **1:1 대응**을 확인했다:

| 뮤턴트 (고치기 전 모양) | RED 가 된 테스트 |
|---|---|
| `buildChannel` 의 `survivesWithFresh` 항 제거 (성공 경로) | 성공 경로 ref 보존 |
| 같은 항 제거 (실패 경로) | degraded 경로 ref 보존 |
| `rotateBotToken` 머지를 스냅샷으로 되돌리기 | rotate 나머지 키 보존 |
| 창 1 의 `fresh?.config` → `trigger.config` | `chatChannel` 없는 PATCH 회귀 |

각 뮤턴트가 **자기 테스트 하나만** 죽였다 — 부수 RED 0.

### 창 1 을 옮기자 **정적 가드가 눈이 멀었다**

`endpoint-path-conflict-wrap` 래칫이 RED 를 냈다 — *"래핑된 자리가 알려진 목록과 정확히
일치한다(남몰래 줄어도 실패)"* 에서 `#update` 가 사라졌다고. **래핑은 그대로였다.** 가드가
`this.triggerRepository.save(` 라는 **수신자 이름**으로 저장을 찾는데, 저장이
`manager.transaction(async (m) => m.save(Trigger, …))` 안으로 들어가면서 수신자가 `m` 이 된
것이다. 가드는 «저장이 사라졌다» 로 읽었다.

두 축을 함께 넓혔다 — 하나만 고치면 나머지가 남는다:

| 축 | 종전 | 지금 |
|---|---|---|
| 저장 인식 | 수신자가 `triggerRepository` 인 `save(` 만 | **첫 인자가 `Trigger` 엔티티인** `save(` 도 (EntityManager 형태). 수신자 이름이 임의라 인자로 좁힌다 |
| 래핑 인식 | 위로 올라가다 **문장 경계**에서 중단 | **콜백 경계를 넘는다** — 함수형 노드의 부모가 호출식이면 계속, 아니면 중단(감싸는 메서드). `.catch` 가 바깥 체인에 붙는 형태를 본다 |

대조군 fixture 3종(`managerSaveWrapped` · `managerSaveUnwrapped` · `managerSaveOtherEntity`)을
넣고, **가드가 아직 무는지** 뮤턴트로 확인했다:

| 뮤턴트 | 결과 |
|---|---|
| `update` 의 `.catch(rethrowEndpointPathConflict)` 제거 | **RED 2건** (래핑 목록 + 미래핑 목록) |
| `m.save(Trigger, …)` 를 `m.update(…)` 로 교체 | **RED 1건** (래핑 목록에서 사라졌다) |

> **교훈은 «가드를 고쳤다» 가 아니다.** 정적 가드는 자기가 아는 **형태**만 본다 — 리팩터링이
> 형태를 바꾸면 보호가 남아 있어도 가드는 사라진 것으로 읽는다. 이번엔 fail-**safe** 방향이라
> 시끄럽게 RED 가 났지만, 반대 방향(형태가 바뀌어 **조용히 스캔 밖으로 나가는** 경우)이면
> 아무도 모른다. 그래서 인식 축을 넓힐 때 **음성 대조군**(`managerSaveOtherEntity`)을 함께
> 넣어 술어가 되레 넓어지는 것도 막았다.

### `--impl-prep` · `/ai-review` 등재 항목 (planner 범위 — 이 브랜치에서 고치지 않는다)

| 항목 | 왜 planner 인가 |
|---|---|
| `spec/5-system/15-chat-channel.md` 의 `code:` glob 이 `trigger-config-lock.ts` 를 안 문다 | 그 문서의 R-CC-22 가 *"명시 경로가 새 파일을 세 번 놓쳤다"* 며 glob 으로 바꾼 바로 그 결함의 **네 번째 재발**이다. `chat-channel-*` 밖이라 §7 tree 와 함께 갱신 필요 (`review/code/.../18_17_44` requirement W5). `spec/` 은 권한 밖 |
| advisory lock 키 **인벤토리 문서 부재** | `redis-keys.md §4`(인접 네임스페이스)가 이 혼동을 막으려는 절인데 정작 lock key 계열이 미등재 |
| `exec-cap:*` · `trigger-config:*` 의 `redis-keys.md §4` 등재 | 자매 사례(`execution-engine.service.ts`)도 미등재라 **둘을 함께** 올려야 한다 |
| 기존 spec 의 회전 정책 **자기모순** | spec 본문끼리의 충돌 — 구현으로 못 닫는다 |
| 번들 절단 | consistency 하네스의 예산 문제 |
| 전역 **32비트** 키 공간 공유 | `hashtext` 는 int4 를 낸다 — 전 도메인이 한 공간을 쓴다. 충돌해도 과직렬화뿐이라 무해하지만 **어디에도 적혀 있지 않다** |

### 같은 클래스의 자리가 **넷보다 많다** — 전수 열거 결과

§A 는 *"`{...(trigger.config ?? {}), chatChannel: …}` 로 덮는 자리"* 를 세어 **넷**을 얻었다.
그 술어는 **모양**을 셌지 **주어**를 세지 않았다. 주어를 *"Trigger 행을 쓰는 모든 호출"* 로
바꿔 전수로 세면 `src/` 에 **21건**이다(`repo-guards/` fixture·주석 11건 제외).

> **첫 열거는 줄 단위라 두 건을 놓쳤다** — `await this.triggerRepository\n  .save(trigger)` 처럼
> 체인이 개행을 넘는 형태. 하필 **창 1 자신**이 그중 하나였다. 개행을 넘어 매칭하도록 방법을
> 바꿔 다시 셌다.

갈라야 하는 축은 **`update` 냐 `save` 냐**다. `repository.update(criteria, partial)` 는 준
컬럼만 쓰므로 `config` 를 건드리지 않는다. `repository.save(entity)` 는 **엔티티를 통째로**
저장해서, `config` 를 고칠 의도가 없는 자리도 로드 시점의 `config` 를 함께 싣는다. 저장소가
이미 이 패턴에 이름을 붙여 뒀다: *"무가드 full-entity save lost-update"*
(`plan/in-progress/ie-resume-turn-boundary-cancel.md`).

**기존 행에 `save(entity)` 하는 자리는 8곳**(신규 INSERT 2건·DELETE 1건·테스트 mock 2건 제외):

| 자리 | 처분 |
|---|---|
| `triggers.service.ts` `update()` (창 1) | **닫았다** — 락 안 + 재읽은 행을 저장 대상으로 |
| `normalizeNotificationSecretRef` · `revokePerTriggerToken` · `promoteRotatedNotificationSecrets`(2자리) | `config` 를 **명시 수정**한다. 후속 — 아래 §후속 |
| `rotateNotificationSecret` · `cleanupRotatedChatChannelTokens` · `schedules.service.ts#update` | 컬럼만 고치지만 `save` 라 `config` 가 **암묵적으로** 실린다. 후속 |

> 위 «명시/암묵» 구분은 각 메서드를 **읽어서** 정했다. 본문에 `config` 토큰이 있는지 세는
> 휴리스틱은 `rotateNotificationSecret` 을 «명시» 로 오분류했다(인접한 notification config
> 조회를 주워 온다) — 그래서 그 수를 쓰지 않았다.

**웹훅 인입 hot path 는 이 PR 에서 닫았다.** `hooks.service.ts` 의 두 자리
(`handleWebhook` · chat-channel 인입)는 `lastTriggeredAt` 만 바꾸면서 `save(trigger)` 로
엔티티를 통째로 썼다 — **인입 메시지마다** 도는 경로라 PATCH 경합보다 훨씬 잦고, 잃는 것이
같은 `inboundSigningRef` 다. 컬럼 한정 `update` 로 바꿨다.

> **~~"뮤턴트 두 방향이 모두 RED 임을 확인했다"~~ — 이 문장은 거짓이었다.** 내 뮤턴트
> 스크립트는 두 자리 중 **`handleWebhook` 하나만** 건드렸다(두 뮤턴트가 같은 앵커를 썼다).
> chat-channel 인입 자리는 회귀 테스트가 아예 없었고, 리뷰가 뮤테이션으로 실측해 잡았다 —
> 그 자리만 되돌려도 `hooks.service.spec.ts` 전건이 GREEN 이었다
> (`review/code/2026/09/14/19_44_08` testing CRITICAL#2). 하필 빠진 쪽이 **더 위험한 경로**다.
>
> **측정 범위가 문장보다 좁았다.** 고친 방식은 대조군 추가만이 아니다 — 뮤턴트 스크립트가
> 자기가 건드린 **파일 오프셋**을 두 자리의 오프셋과 대조해, 의도한 자리가 아니면 **단언으로
> 멈추게** 했다. 산문 규율이 아니라 코드가 범위를 지킨다.

지금 실측(자리별로 확인):

| 뮤턴트 | 자리 | 결과 |
|---|---|---|
| 전체 `save` 로 되돌리기 | `handleWebhook` (offset 9593) | **RED 1건** |
| 전체 `save` 로 되돌리기 | chat-channel 인입 (offset 28829) | **RED 1건** |
| patch 에 `config` 섞기 | chat-channel 인입 (offset 28938) | **RED 1건** |

### 2라운드 리뷰 처분 (`review/code/2026/09/14/19_07_43` — C0 · W7)

| # | 처분 |
|---|---|
| W1 웹훅 hot path 가 같은 fail-open 클래스 (더 잦다) | **수용·수정** — 컬럼 한정 `update` + 회귀 테스트(양방향 뮤턴트 RED) |
| W2 창 1 의 `save` 가 형제 창의 **컬럼** 커밋을 되돌린다 | **수용·수정** — 저장 대상을 재읽은 행으로. 내가 1라운드 수정으로 **새로 만든 결함**이다 |
| W3 `config` 를 명시 수정하는 형제 3메서드 | **후속 등재** — 아래 표. `revokePerTriggerToken` 을 최우선으로 적는다 |
| W4 락 획득 SQL 이 두 곳에 손으로 중복 | **수용·수정** — `acquireTriggerConfigLock` 프리미티브로 통합 |
| W5 PATCH 전체가 락+재읽기를 지게 됨 | **수용(트레이드오프)** — 임계 구간은 DB 왕복 두 번이고 외부 호출이 없다. 후속 표에 «호출 빈도·P95 관측» 으로 등재 |
| W6 `spec` `code:` glob 미포함 | planner 범위 — 위 등재 표 유지 |
| W7 인라인 ref 캐스트 3중 복제 | **수용·수정** — `extractInboundSigningRef` 로 통합 |

### 3라운드 리뷰 처분 (`review/code/2026/09/14/19_44_08` — C2 · W3)

| # | 처분 |
|---|---|
| C1 창 1 이 **삭제된 트리거를 되살린다** (`save` 는 행이 없으면 INSERT) | **수용·수정** — `!fresh` 면 404. 이 경로는 이 PR 이 만든 것이 아니라(`origin/main` 의 `save(trigger)` 도 같은 호출 형태) 형제 세 창을 skip 으로 만들며 생긴 **비대칭**이다. 부재 단언(`save` 미호출)까지 건다 |
| C2 chat-channel 인입 자리에 회귀 테스트 부재 + **내 실측 서술이 거짓** | **수용·수정** — 대칭 테스트 추가 + 뮤턴트 스크립트가 자리별 오프셋을 단언하게 했다. 위 註 |
| W1 형제 write-site 3곳 | 이미 등재됨 — 후속 표 유지 |
| W2 CHANGELOG 가 `12ed21ff1` 시점 범위 | **수용·수정** — hooks 전환과 «네 자리» 표현 정정 |
| W3 `previousInboundSigningRef` 가 클로저 경계를 셋 넘는다 | 후속 등재 — 트랜잭션 콜백이 결과 객체를 반환하도록 |
| INFO#3·#4·#5 (mock JSDoc 이관 범위 · 「네 자리 vs 배선 3곳」 · lock spec 제목) | **수용·수정** — INFO#4 는 3라운드 연속 지적이라 이번에 못박았다 |

### 4라운드 리뷰 처분 (`review/code/2026/09/14/20_17_16` — C0 · W5, 위험도 LOW)

| # | 처분 |
|---|---|
| W1 PATCH 마다 `workflow` JOIN SELECT 가 **두 번** | **수용·수정** — 검증용 경량 조회(`findByIdForUpdate`) 분리. 저장·응답용 엔티티는 락 안 재읽기가 준다 |
| W2 `remove()` 가 락에 참여하지 않아 **쓰기 시점** 삭제 경합이 남는다 | **수용·수정** — 삭제의 DB 부분만 같은 락으로 감쌌다(teardown 은 락 밖). 읽기 시점 가드(`!fresh`)만으로는 «읽었을 땐 있었는데 저장 직전에 삭제» 를 못 막는다 |
| W3 형제 3창이 `false` 를 무시해 삭제된 트리거에 **200 + 감사** | **수용·수정(부분)** — `rotateBotToken` 을 404 + 감사 미기록으로. binder 의 두 경로는 «저장 **뒤**의 best-effort» 라 `false` 로 감추는 것이 맞고, 그 판단 기준을 JSDoc 에 표로 적었다 |
| W4 hooks 두 자리에 주석 5줄 + 코드 4줄 복제 | **수용·수정** — `touchLastTriggeredAt` 으로 통합. **그 복제가 정확히 이 PR 을 물었다**(한쪽만 테스트가 있었다) |
| W5 CHANGELOG 문단 오귀속 | **수용·수정** — 락 근거 문장을 원 단락으로 되돌리고 삭제 락을 명시 |
| INFO#3 부재 처리가 창마다 다른데 서술이 뭉뚱그린다 | **수용·수정** — 판단 기준은 «이번 요청의 **결과**인가, 뒤따르는 **부수 작업**인가» |
| INFO#4 삭제 경합 시 유령 listener 등재 | **수용·수정** — 쓰기 성공일 때만 `register` |
| INFO#6 mock JSDoc 의 «13개» 가 낡았다 | **수용·수정** — 닫히는 시점 실측 **53건**으로 갱신 + 시점 의존임을 명시 |
| INFO#7 `extractInboundSigningRef` 격리 테스트 부재 | **수용·수정** — 7갈래 표 단언 |
| INFO#1 헬퍼가 workspace 소유권을 자체 검증하지 않는다 | 후속 등재 — 현재 호출부 3곳 모두 검증된 id 만 넘긴다 |

**뮤턴트 확인**(예측을 먼저 적고 쟀다):

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| `remove()` 에서 락 제거 | RED | **RED** (락 키 관측 단언) |
| `rotateBotToken` 의 `!wrote` 제거 | RED | **RED** (404 + 감사 미기록) |
| 검증 조회를 `findById` 로 되돌리기 | **생존**(성능 변경이라 동작 단언이 없다) | **생존** |

> 락은 SQL 한 줄이라 바깥에서 관측할 방법이 없었다 — 그래서 트랜잭션 mock 에 `onLock` 을
> 두어 «이 경로가 락을 잡는가» 를 테스트가 직접 단언한다. 그게 없으면 락을 빼는 뮤턴트를
> 잡을 고리가 없다.

### 5라운드 리뷰 처분 (`review/code/2026/09/14/20_49_15` — C0 · W5)

| # | 처분 |
|---|---|
| W1 secret store 쓰기·provider 등록이 **락 밖**이라 삭제 경합 시 고아 자원 | **후속 등재** — `config` 컬럼은 보호되지만 원자성 경계가 다른 자원으로 옮겨간 것이다. 정리 순서를 바꾸려면 «외부 호출을 락 안에 두지 않는다» 제약과 정면으로 부딪히므로 **별도 설계 검토**가 필요하다 |
| W2 `remove()` 가 되돌릴 수 없는 정리 **뒤에** 무한 대기를 신설했다 | **수용·수정** — 삭제 경로에만 `SET LOCAL lock_timeout = 5000ms`. 실패 시 «반쯤 삭제된 상태» 를 `logger.error` 로 소리내어 남긴다 |
| W3 `remove()` 의 락→삭제 **순서**를 아무도 단언하지 않는다 | **수용·수정** — 락·상한·삭제를 **한 배열**에 모아 순서를 그대로 단언. 종전엔 «락 키가 있다» + «remove 가 불렸다» 라 뒤집는 뮤턴트가 통과했다 |
| W4 4라운드에 넣은 `if (wrote) register(...)` 게이트가 미행사 | **수용·수정** — 음성(쓰기 skip → 미등록) + **양성 대조군**(쓰기 성공 → 등록). 음성만 두면 «어차피 아무도 안 부른다» 로 공허해진다 |
| W5 `RESOURCE_NOT_FOUND` 리터럴이 2→4곳 | **수용·수정** — `assertTriggerFound` 로 통합. 이 PR 이 반복해 적은 *"복제가 drift 를 부른다"* 와 정면으로 어긋나 있었다 |
| INFO#16 리뷰 중 워킹트리 dirty 관측 | **확인 완료** — 다른 리뷰어의 뮤테이션이었고 이미 원복됐다(`git status --short` 로 실측). 저장소가 기록한 *"병렬 리뷰어가 공유 트리를 뮤테이션한다"* 의 재현 |

**뮤턴트 확인**(예측을 먼저 적었다):

| 뮤턴트 | 예측 | 실측 |
|---|---|---|
| `remove` 를 락보다 먼저 | RED | **RED** |
| `register` 를 무조건 호출 | RED | **RED** |
| 삭제 경로의 `lock_timeout` 제거 | RED | **첫 판 생존** → 관측 고리(`onLockTimeout`)를 만든 뒤 **RED** |

> 세 번째가 이 라운드의 교훈이다. **관측 고리가 없으면 그 보증은 테스트가 지킬 수 없다** —
> SQL 한 줄로 표현되는 것(락 획득·상한 설정)은 전부 같은 문제를 갖는다. 순서도 마찬가지라
> 두 사건을 **같은 배열**에 모아야 «앞뒤» 를 물을 수 있다.

### 6라운드 리뷰 처분 (`review/code/2026/09/14/21_18_21` — C0, 위험도 LOW)

요약이 *"이 배치를 막을 사유는 없다는 데 14개 reviewer 전원이 동의한다"* 로 맺혔다.

**이 라운드부터 규율을 좁혔다** — 동작 결함이거나 **내 서술이 거짓인 것**만 코드로 고치고
나머지는 등재한다. 그러지 않으면 매 라운드가 새 코드를 만들어 «`codebase/**` 수정 0 라운드» 에
영영 도달하지 못한다. 실제로 3~5라운드의 지적 대부분이 **직전 라운드에 내가 넣은 것**이었다.

| # | 처분 |
|---|---|
| W1 `remove()` 실패를 «던진다» 는 보증을 아무 테스트도 안 지킨다 | **수용·수정** — `throw err` → `swallow` 뮤턴트가 전건 GREEN 이었다. 실패 전파 + **감사 미기록**을 함께 단언하고 두 뮤턴트 RED 확인 |
| W2 CHANGELOG 의 «대기 상한은 없다» 가 지금은 거짓 | **수용·수정** — 삭제 5초 예외를 사유와 함께 |
| W3 **orphan JSDoc** — `touchLastTriggeredAt` 을 끼워 넣으며 CCH-NF-03 docblock 이 남의 함수를 설명하게 됐다 | **수용·수정** — 이 PR 에서 **두 번째** 같은 클래스다(1라운드 `createBaseProviders`). 함수를 끼워 넣을 때 «위에 붙은 주석이 누구 것인가» 를 매번 물어야 한다 |
| W6 `SET LOCAL lock_timeout` 의 실제 범위가 내 주석보다 넓다 | **수용·수정(문서)** — advisory lock 뿐 아니라 같은 트랜잭션의 `DELETE` 행 잠금·CASCADE 연쇄까지 걸린다 |
| INFO#4 후속 표에 **이미 해결된** `remove()` 락 행이 남아 있었다 | **수용·수정** — 게다가 내 5라운드 편집이 문장을 겹쳐 놨다 |
| INFO#6 `assertTriggerFound(null)` 로 계약을 인자로 우회 | **수용·수정** — `throwTriggerNotFound(): never` 분리 |
| INFO#7 lock spec 의 «null·undefined» 제목이 `undefined` 만 검증 (3라운드 연속) | **수용·수정** — `it.each` 로 두 값 모두 |
| W4·W5·W7·W8 | **후속/무조치** — W7·W8 은 리뷰어 자신이 «조치 불요» 로 판정했다 |

> **타입 ratchet 이 또 한 번 일했다.** null 케이스를 추가하며 `config as Trigger['config']`
> 캐스트를 썼더니 새 타입 오류가 났다 — jest 는 타입을 strip 하므로 **이 검사 말고는 아무도
> 못 보는** 자리다. 캐스트로 뭉개지 않고 `Omit` 으로 프로퍼티를 갈아 끼웠다(교차 타입은
> 프로퍼티 타입도 교차시켜 `null` 을 도로 잘라낸다).

### 7라운드 리뷰 처분 (`review/code/2026/09/14/21_50_09` — C1)

CRITICAL 의 근거는 **내 CHANGELOG 문장**이었다 — *"`config` 를 다시 쓰는 네 자리 전부"* 가
«config 를 다시 쓰는 **모든** 자리» 로 읽힌다. 같은 파일에 락 없이 `save(trigger)` 하는 자리가
다섯 개(실은 쓰기 지점 기준 여섯) 더 있었으니 그 읽기로는 거짓이다. **네 번째로 같은 병**이다
(1·3·5라운드에도 «내 서술이 구현보다 넓다» 가 있었다).

**이번엔 문장을 좁히지 않고 문장이 참이 되게 했다.** 남은 자리를 전부 닫는 비용이 작았기
때문이다 — 도구(`rewriteTriggerConfigLocked`)는 이미 있고 테스트도 서 있었다.

| 자리 | 처분 |
|---|---|
| `normalizeNotificationSecretRef` | `config.notification` 재작성 → **락 안 재작성** |
| `revokePerTriggerToken` (라이브 엔드포인트) | `config.interaction` 재작성 → **락 안 재작성**, 삭제 경합 시 404 |
| `promoteRotatedNotificationSecrets` 승격 | `config` + 컬럼 → **락 안 재작성**(cron 이라 부재는 조용히 skip) |
| `promoteRotatedNotificationSecrets` stale 클리어 | 컬럼만 → **컬럼 한정 `update`** |
| `rotateNotificationSecret` | 컬럼만 → **컬럼 한정 `update`** |
| `cleanupRotatedChatChannelTokens` | 컬럼만 → **컬럼 한정 `update`** |
| `schedules.service.ts#update` 의 trigger 동기화 | 컬럼만(`name`·`isActive`) → **컬럼 한정 `update`** |

**전수 재확인**: 프로덕션의 `triggerRepository.save(` 는 이제 **3건**이고 전부 신규 INSERT 다
(`triggers.service#create` · `schedules.service#create` 둘, 그리고 창 1 의 락 안 `m.save`).
기존 행을 통째로 저장하는 자리는 **하나도 남지 않았다.**

**래칫이 그 상태를 고정한다.** `endpoint-path-conflict-wrap` 의 «래핑 없는 자리» 베이스라인이
여섯에서 **빈 목록**으로 내려갔다 — 새 `save()` 가 생기면 그 자리에서 깨진다. 빈 목록이 더
강한 상태다.

> **단언 아홉 개가 함께 바뀌었다.** 그 테스트들이 `save` 를 모델링하고 있었기 때문이다.
> 특히 «저장이 실패하면 감사를 남기지 않는다» 둘은 실패를 `save` 에 주입하고 있어서, 그대로
> 두면 **실패가 주입되지 않아 통과하는** vacuous 테스트가 됐을 것이다 — 쓰기 동사를 바꿀 땐
> 실패 주입 지점도 함께 옮겨야 한다.

### 8라운드 리뷰 처분 (`review/code/2026/09/14/22_24_35` — C4)

**이 라운드가 이 PR 전체에서 가장 아픈 지적이다.** 7라운드에 새로 닫은 자리에서
**1라운드에 내가 직접 적어 둔 함정**을 그대로 반복했다:

> §B 정정 — *"컨테이너만 다시 읽는 것으로는 부족하다"*

`(freshConfig) => ({ ...freshConfig, notification: X })` 에서 `X` 를 **락 이전 스냅샷**으로
만들어 넘겼다. 최상위 키는 재읽기가 지키지만 그 **하위**(`notification.url` 등)는 옛 값으로
되돌아간다 — 이 PR 이 닫는 것과 같은 클래스다. 세 자리(`normalizeNotificationSecretRef` ·
`promoteRotatedNotificationSecrets` · `revokePerTriggerToken)에서 반복됐다.

**산문으로 막지 않고 시그니처로 막았다.** `mergeIntoFreshSubKey(freshConfig, key, patch,
fallback)` 이 «어느 하위 키를, 무엇을 얹어» 를 인자로 강제한다 — 호출부가 스냅샷 객체를
통째로 대입할 자리가 없어진다. 저장소의 규율 그대로다: *세 번째 재발이면 산문 말고 코드로.*

| # | 처분 |
|---|---|
| C1 하위 키가 스냅샷으로 대입돼 lost update 재발 | **수용·수정** — `mergeIntoFreshSubKey` 로 세 자리 통일 |
| C2 `revokePerTriggerToken` 의 404 게이트 미검증 | **수용·수정** — 삭제 경합 테스트 추가 |
| C3 `SchedulesService.update` 컬럼 한정 전환 미검증 | **수용·수정** — 쓰기 방식 단언 + name-only 분기 대조군 |
| C4 CHANGELOG 자기모순(«`save` 가 한 곳도 없다» vs «저장 동사는 그대로») | **수용·수정** — «컬럼만 고치려던 자리가 의도치 않게 엔티티 전체를 저장하던 경로» 로 좁히고, 창 1 은 `save` 를 쓰되 **재읽은 행**을 저장한다는 사실을 적었다. 래칫의 보증 범위(`modules/triggers/` 한정)도 명시 |
| W3 `revokePerTriggerToken` 도 같은 스냅샷 패턴 | **수용·수정** — C1 과 같은 헬퍼 |
| W7 테스트 헬퍼 중복 (3라운드 연속) | **수용·수정** — `at()` 선언을 앞으로 |
| W1·W2·W4·W5·W6 | **후속 등재** — 아래 표 |

**뮤턴트 확인**(자리별):

| 뮤턴트 | 실측 |
|---|---|
| `revoke` 하위 키를 스냅샷 대입 | **RED** |
| `revoke` 404 게이트 제거 | **RED** |
| `normalize` 하위 키를 스냅샷 대입 | **첫 판 생존** → 두 읽기가 갈리는 테스트 추가 후 **RED** |
| `schedules` 컬럼 한정을 `save` 로 | **RED 2건** |

> `normalize` 가 첫 판에 생존한 이유가 5라운드의 `lock_timeout` 과 같다 — **두 읽기가 다른
> 값을 보는 fixture 가 없으면** 그 차이를 묻는 단언도 있을 수 없다. 대조군은 «두 상태가
> 다르게 판정하는 값» 이어야 한다.

### 9라운드 리뷰 처분 (`review/code/2026/09/14/23_01_18` — C1)

| # | 처분 |
|---|---|
| C1 `cleanupRotatedChatChannelTokens` 전환에 **동작 테스트 0건** | **수용·수정** — patch 에 `config` 를 몰래 끼워 넣어도 25 스위트 전건 GREEN 이었다. 정적 래칫은 `.save(` 만 세고 `.update(` 의 **내용물**은 안 본다. `Object.keys(patch)` 단언 추가 |
| W1 `rotateBotToken` 의 `chatChannel` 이 스냅샷 대입 — 같은 클래스 **네 번째 자리** | **수용·수정** — `mergeIntoFreshSubKey` 적용. `inboundSigningRef` 축은 닫혀 있었지만 `rateLimitPerMinute`·`uiMapping` 등은 되돌아갔다 |
| W5 **orphan JSDoc — 세 번째 재발** | **수용·수정**. 아래 «가드를 만들려다 전제가 반증됐다» 참조 |
| INFO#1 `promoted` 카운터가 쓰기 skip 에도 증가 | **수용·수정** — cron 로그가 거짓을 말하지 않도록 |
| INFO#3 `@param freshConfig` 누락 · INFO#4 lock spec 이중 JSDoc(3라운드 연속) | **수용·수정** |
| W2·W3·W4 · INFO#5·#6·#7 | **후속 등재** — 아래 표 |

**뮤턴트**: `rotateBotToken` 스냅샷 대입 → RED · cleanup patch 에 `config` 끼워 넣기 → RED ·
`promoted` 카운터 분리 → **첫 판 생존** 후 테스트 추가하여 RED.

### 가드를 만들려다 전제가 반증됐다 — orphan JSDoc

세 번째 재발이라 저장소 규율(*"세 번째 재발이면 산문 말고 코드로"*)대로 정적 가드를 만들려
했다. 술어 후보는 **«두 JSDoc 블록이 빈 줄 없이 맞붙은 형태»** 였다 — 세 번의 orphan 이 전부
그 모양이었기 때문이다.

**착수 전에 쟀고, 전제가 틀렸다.** `codebase/backend/src` 전수에서 그 형태는 **28건**이고
대부분 정당하다(파일 머리말 주석 + 선언 주석, 섹션 구분 블록). 가드를 만들었으면 오탐 25건이
난다. 들여쓰기로 좁혀도(클래스 내부 = indent 2+) 10건이라 여전히 정밀하지 않다.

> **그래서 만들지 않았다.** 진짜 신호는 *"이 JSDoc 이 **원래 어느 함수 것이었나**"* 인데 그건
> 이력 의존이라 정적 검사로 알 수 없다. 세 번 재발했다는 사실만으로 가드를 만들면, 이 저장소가
> 기록한 «양성 0건짜리 vacuous 가드» 대신 **오탐 25건짜리 가드**가 된다.
>
> 남는 규율은 편집 습관이다: **새 private 헬퍼를 기존 함수 사이에 끼워 넣지 말 것** — 그
> 자리가 JSDoc 과 함수 사이면 반드시 orphan 이 된다. 세 번 다 그 형태였다.

### 10라운드 리뷰 처분 (`review/code/2026/09/14/23_38_09` — C1)

**헬퍼를 쓰면서 헬퍼가 막으려던 결함을 냈다.** 9라운드에 `rotateBotToken` 을
`mergeIntoFreshSubKey` 로 옮기면서 `patch` 자리에 **`mergedChannel` 전체**를 넘겼다 — 그건
함수 시작 시점 `chatChannelCfg` 를 스프레드한 객체라, 재읽기로 얻은
`rateLimitPerMinute`·`uiMapping`·`languageLocale` 을 무조건 되돌린다. 헬퍼의 `patch` 는
**델타**여야 한다.

**그리고 내가 쓴 회귀 테스트가 그것을 못 잡았다.** fixture 가 스냅샷 쪽에 그 키를 **아예 두지
않아** «새로 생긴 필드» 만 검증했기 때문이다 — 2라운드에 한 번 겪은 그 형태다
(«대조군은 두 상태가 **다르게 판정하는 값**이어야 한다»).

| # | 처분 |
|---|---|
| C1 `patch` 에 스냅샷 전체를 넘겨 lost update 재발 + 그 테스트가 vacuous | **수용·수정** — `patch` 를 `{...configUpdates, botTokenRef, inboundSigningRef}` 로 좁히고, fixture 를 «같은 키를 30 vs 99 로» 채워 판별하게 했다. 두 ref 는 `buildSecretRef` 로 매번 재유도되는 결정적 값이라 델타에 **포함**한다(빠지면 fail-open) |
| W3·INFO#7 `create()`/`update()` 주석이 쓰기 메커니즘을 stale 하게 서술 | **수용·수정** — 내 PR 이 stale 하게 만든 두 자리 |
| INFO#8 `withTransactionMock` 의 도달하지 않는 분기 | **수용·수정(문서)** — 「검증된 동작으로 인용하지 말 것」을 코드 옆에 |
| INFO#9 `SchedulesService.update` 의 조합 분기 미검증 | **수용·수정** — name+isActive 동시 · 빈 patch 대조군 |
| INFO#10 hooks spec 의 동일 제목 두 개 | **수용·수정** — 제목에 call site 구분자. 하필 «한쪽만 테스트가 있어 다른 쪽이 되돌려져도 GREEN» 이었던 그 두 자리다 |
| W1·W2 · INFO#1~#7·#11·#12 | **후속/무조치** — 이미 등재됐거나 리뷰어가 «조치 불요» 로 판정 |

**뮤턴트**: `patch` 를 다시 `mergedChannel` 전체로 → **RED**(고친 fixture 가 문다).

> **이 라운드의 교훈은 «헬퍼가 규율을 대신하지 않는다» 다.** `mergeIntoFreshSubKey` 는
> «어느 하위 키를, 무엇을 얹어» 를 인자로 강제하지만, `patch` 에 무엇을 넣을지까지는
> 강제하지 못한다. 시그니처로 좁힌 자리가 남아 있다는 뜻이고, 그래서 **테스트 fixture 가
> 두 상태를 갈라 놓는가**가 여전히 최종 방어선이다.

### 11라운드 리뷰 처분 (`review/code/2026/09/15/00_07_52` — **C0** · W3)

| # | 처분 |
|---|---|
| W1 `mergeIntoFreshSubKey` 의 `fallback` 분기를 **어느 fixture 도 행사하지 않는다** | **수용·수정** — 분기를 지워도 147건 전건 GREEN 이었다(리뷰가 뮤테이션으로 실측). 재읽은 행에 그 키가 **없는** fixture 를 넣고 뮤턴트 RED 확인. 「판별 못 하는 fixture」의 다섯 번째 자리다 |
| W3 `trigger-config-lock.ts` JSDoc 의 «창 2·3·4» 가 이제 **과소 서술** | **수용·수정** — 호출부를 세어 적지 않고 «창 1 하나를 빼고 전부» 라는 **규칙**으로 바꿨다. 부재 처리 표에도 빠져 있던 세 갈래를 채웠다 |
| W2 cron 왕복 증가 | 이미 등재(8라운드 W5 · 9라운드 W4) |

> **같은 문장을 세 라운드에 걸쳐 «과대» 방향으로 고쳤다가 이번엔 «과소» 로 틀렸다.**
> 교훈은 방향이 아니라 형태다 — **목록은 낡고 규칙은 안 낡는다.** 호출부 개수를 문서에
> 적는 순간 그 문서는 다음 커밋에 틀린다.

### 후속(developer 범위) — 이 PR 로 넓히지 않는다

| 항목 | 근거 |
|---|---|
| `PATCH /api/triggers/:id` 의 P95/P99 관측 | W5 — 새 결함은 아니나 전제가 바뀌었다 |
| `rewriteTriggerConfigLocked` 반환값을 세 호출부가 무시 | JSDoc 이 약속한 «관측 가능» 이 아직 실현되지 않았다 |
| `chatChannelHealth` 등 상태 컬럼은 락 밖 | 관측성 lost update, 보안 무관 |
| `setupAt`/`rotatedAt` 을 락 획득 **전**에 캡처 | 컨텐션 시 «완료 시각» 과 괴리 |
| 헬퍼가 `Trigger` 에 하드코딩 | 위 후속들에서 제네릭화 필요 |
| `update()` 가 182줄 — 트랜잭션 클로저를 `mergeAndSaveLocked(...)` 로 분리 | 다음 편집 때 (6라운드 W4) |
| 세 경로(`update`·binder·`rotateBotToken`)의 락 대기 상한 부재 | 리뷰어 판정 «조치 불요» — 임계 구간이 짧다. 특정 트리거 폭주가 관측되면 `timeoutMs` 확대 (6라운드 W7) |
| 삭제 락 타임아웃(5s) 시 `57014` 가 일반 500 으로 마스킹 | 발생 조건이 좁다. 실사례 관측되면 409/503 + 전용 코드로 승격 (6라운드 INFO#12) |
| **`UpdateTriggerDto.config` raw 필드가 락 안 병합을 우회한다** | 요청이 `config` 를 통째로 보내면 `baseConfig` 가 그것이 되어 재읽기 병합을 건너뛴다. **의도된 설계**다(사용자가 통째로 보낸 것이 곧 의도) — 다만 그 선택이 동시 커밋된 서브키를 지울 수 있다는 사실을 여기 등재한다 (8라운드 W1) |
| `cleanupRotatedChatChannelTokens` 의 무조건 null-write | 동시에 커밋된 `rotateBotToken` 의 새 v2 회전을 지울 수 있다 → 조건부 `WHERE chatChannelTokenV2 = <읽은 값>` 으로 낙관적 확인 (8라운드 W2) |
| `rotateNotificationSecret` 이 락 도메인 밖 | 창 1 의 저장이 그 사이 커밋된 `notificationSecretV2` 회전을 되돌릴 수 있다. 관측용(`lastTriggeredAt`)과 달리 **보안 성격** (8라운드 W4) |
| `promoteRotatedNotificationSecrets` cron 이 후보마다 순차 트랜잭션 | 배치가 커지면 실행시간이 비례 이상 증가 → `.take(N)` + 이월 또는 청크 (8라운드 W5) |
| 삭제 외 경로의 `lock_timeout` 부재 + 기본 풀 10 | 같은 트리거에 동시 쓰기가 몰리면 풀 고갈로 번질 수 있다. 이 PR 이 이 패턴을 1곳에서 7곳 이상으로 넓혔다 (8라운드 W6) |
| `SchedulesService.update()` 의 trigger 컬럼 동기화가 락 도메인 밖 | 창 1 의 전체 엔티티 저장과 경합하면 방금 커밋한 `isActive` 가 되돌아갈 수 있다 — `rotateNotificationSecret`(8라운드 W4)과 같은 클래스 (9라운드 W2) |
| `update()` 응답이 DB 커밋값보다 오래된 `notification` 서브키를 돌려줄 수 있다 | `mergeIntoFreshSubKey` 가 DB 쓰기는 정확히 병합하지만 in-memory 는 스냅샷 그대로다. read-after-write 불일치, 보안 영향 없음 (9라운드 W3) |
| cron 스윕이 행마다 새 트랜잭션(왕복 약 2배) | 대량 회전 이벤트 시 소요 시간이 배치 크기에 비례. 소규모 동시성 제한 또는 백로그 관측 로그 (9라운드 W4) |
| `normalizeNotificationSecretRef` 가 쓰기 skip 을 관측하지 않는다 | 형제 동기 경로와 다른 취급 — 5라운드 W1(secret store 원자성) 대상 목록에 이 함수도 넣는다 (9라운드 INFO#6) |
| `create()` 안 두 주석이 실제 쓰기 경로를 더 이상 정확히 서술하지 않는다 | 결론은 참이라 낮은 우선순위 (9라운드 INFO#7) |
| `previousInboundSigningRef` 가 선언→트랜잭션 내 재대입→커밋 후 소비로 클로저 경계를 셋 넘는다 | 트랜잭션 콜백이 `{ saved, previousInboundSigningRef }` 를 반환하도록 (급하지 않음) |
| `rewriteTriggerConfigLocked` 가 workspace 소유권을 자체 검증하지 않는다 | 현재 호출부 3곳 모두 이미 검증된 id 만 넘겨 악용 경로는 없다. 선택적 `workspaceId` 파라미터 또는 JSDoc 전제 명시 |
| **secret store 쓰기·provider 등록의 원자성** — 락은 `config` 컬럼만 보호한다 | 삭제와 겹치면 정리(`teardownChatChannel`·`deleteByPrefix`)가 먼저 끝난 뒤 생성된 secret row·provider 등록이 고아로 남는다. 정리 순서를 바꾸려면 «외부 호출을 락 안에 두지 않는다» 제약과 충돌하므로 **별도 설계 검토** (5라운드 W1) |

## 하지 않는 것

`setupChatChannel` 의 관심사 분리(별 항목) · `chatChannelLastError` 원문 노출(별 항목,
보안 축이 다르다) · `SecretResolver.rotate` 빈 값 가드(별 항목, 호출부 전수 선행) ·
`spec/` 편집(권한 밖).

## 체크리스트

- [x] `/consistency-check --impl-prep` — `review/consistency/2026/09/14/17_10_16`
      **BLOCK: NO** (Critical 0 · WARNING 2 · MEDIUM).

      | # | 처분 |
      |---|---|
      | W1 처방이 컨테이너만 다시 읽어 표적 결함 재발 가능 | **수용** — §B 정정, 실측으로 시나리오 확인 |
      | W2 lock key 가 Redis 키 모양인데 Redis 아님 | **수용** — 주석 명시 + `redis-keys.md §4` 등재(planner) |
      | INFO#3·#7 Cafe24 advisory lock 기각 선례 미인용 | **수용** — §B 에 대조 추가 |
      | INFO#6 원 트래커 항목 동시 갱신 | 이미 체크리스트에 있다(재확인) |
      | INFO#1·#2·#5·#8 | **등재** — advisory lock 키 인벤토리 부재 · 기존 spec 회전정책 자기모순 · 번들 절단 · 전역 32비트 키 공간 공유 |
- [x] `--impl-prep` INFO 등재 (planner · harness) — §D 표.
- [x] 창 **4곳 전부**에 «락 안에서 재읽기» 배선. 2·3·4 는 공용 유틸
      `trigger-config-lock.ts`, 창 1 은 `save` 를 유지한 채 같은 락 안에서 병합 — §D.
- [x] 동시 PATCH e2e — `test/trigger-config-lost-update.e2e-spec.ts`. 배선·대응표는 §C.
- [ ] 트래커 항목 `[x]` + 실측 각주 (창이 **넷**이었다는 정정 포함)
- [ ] `run-test-all.sh`
- [ ] `/ai-review` + `--impl-done`

      **완료 기준**: 마지막 라운드가 **`codebase/**` 수정 0 으로 끝날 것.**
      **정지 규칙**(결과를 보기 전에 선언): `/ai-review` 가 **Critical 0 이고 WARNING 0** 이면
      INFO 내용과 무관하게 멈추고 INFO 는 등재한다.
