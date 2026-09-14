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

겹침을 우연에 맡기지 않고 **테스트가 advisory lock 을 직접 쥔다**. 요청 B(카드 편집 PATCH)의
binder 쓰기는 같은 lock key 를 잡아야 하므로 거기서 멈추고, 그동안 테스트가 «요청 A» —
*setupChannel 이 성공해 server-issued 서명을 확립하고 자기 스냅샷으로 `config` 를 통째로 다시
쓴 동시 요청* — 를 연기한 뒤 COMMIT 으로 락을 놓는다.

**단언이 둘인 이유**: e2e 에는 외부 mock 이 없어 B 의 `setupChannel` 은 반드시 실패하지만
**실패까지의 지연이 환경마다 다르다.** 그래서 고치기 전 코드에는 인터리빙이 둘이고, 단언
하나만으로는 한쪽이 조용히 통과한다.

| B 의 binder 쓰기 시점 | 고치기 전 | 고친 뒤 | 무는 단언 |
|---|---|---|---|
| A 보다 **먼저** | A 가 통째로 덮어 B 의 PATCH 가 사라진다 | 락 뒤 재읽기라 B 값이 남는다 | ① `rateLimitPerMinute === 42` |
| A 보다 **나중** | 옛 게이트로 써서 A 가 막 확립한 ref 를 지운다(fail-open) | 재읽기가 ref 를 보고 보존 | ② `inboundSigningRef` 존재 |

**provider 는 telegram 이다.** 결함의 전제가 *"B 가 읽는 시점에 ref 가 없고, 그 사이 다른
요청이 그것을 처음 확립한다"* 인데, slack/discord 의 PATCH DTO 는 `inboundSigningPlaintext`
를 `OmitType` 으로 아예 갖지 않아 기존 트리거에서 ref 를 **새로 확립**할 수 없다. telegram 의
server-issued 발급만이 그 역할을 하고, 게다가 이 환경의 telegram 트리거는 setupChannel 이
실패해 **ref 없는 행**으로 자연히 만들어진다 — 전제를 만들려고 행을 손으로 긁지 않아도 된다.

**공허성 가드**: window 1 커밋(`rateLimitPerMinute=42`)을 폴링으로 확인하고서야 A 를 쓴다.
관측 못 하면 «겹침을 만들지 못했다» 로 **던진다** — 통과로 넘기지 않는다.

### 실측 — 전(락 없음) 유실 재현 → 후 유실 없음

binder **catch 경로만** 고치기 전 모양으로 되돌려(나머지 둘은 고친 채) 이 spec 하나만 돌렸다.

| | 결과 |
|---|---|
| 뮤턴트(락·재읽기 없음) | **RED** — `Expected: 42 / Received: 7`. B 의 PATCH 가 통째로 사라졌다 |
| 원본 | **PASS** |

> **첫 뮤턴트 실행은 엉뚱한 자리에서 RED 였다** — «B 가 아직 미완인가» 관측 단언을 유실
> 단언보다 **앞**에 둬서, 실패 메시지가 `Expected: false / Received: true` 였다. 유실을
> 보여 주기 전에 멈춘 것이다. 관측 값만 붙잡고 단언을 맨 뒤로 옮긴 뒤 다시 재서 위 표를 얻었다.
> **RED 라는 사실만으로는 «무엇을 판별했는가» 가 정해지지 않는다.**

## D. 이 배치가 **닫지 않은** 것 — 창 1 과 등재 항목

### 창 1 (`update()` 의 `save`) 은 열어 둔다

락 헬퍼로 바꿔 **실행해 보고 되돌렸다**. `save(trigger)` 는 반환 엔티티·subscriber·
`endpointPath` UNIQUE 충돌 경로를 함께 규정하고 있어서, `update` + 재조회로 바꾸면 그 셋이
동시에 달라진다 — 실측으로 `triggers.service.spec.ts` **6개 케이스가 RED** 였다(interaction
전체 교체 · 생략 필드 유지 · notification 병합 유지 · 저장 실패 시 감사 미기록 ·
409 RESOURCE_CONFLICT 두 키 · R-CC-21 botTokenRef 재유도). 되돌리니 9 스위트 279건 통과.

**남는 노출**: 창 2·3·4 가 닫히면 `inboundSigningRef` 의 **영속적** 유실은 사라진다. 창 1 에
남는 것은 «손대지 않은 `config` 키» 의 유실이고, 이 구간엔 외부 호출이 없어 창도 좁다.
위 e2e 가 window 1 커밋을 기다리는 폴링을 두는 이유가 이것이다 — 그 창은 아직 열려 있다.

**후속 작업의 모양**(다음 사람이 다시 헤매지 않도록): `save` 의 세 계약을 먼저 테스트로
분리해 고정한 뒤에 저장 경로를 바꾼다. 순서를 뒤집으면 위 6건이 그대로 재발한다.

### 같은 클래스의 자리가 **넷보다 많다** — 전수 열거 결과

§A 는 *"`{...(trigger.config ?? {}), chatChannel: …}` 로 덮는 자리"* 를 세어 **넷**을 얻었다.
그 술어는 **모양**을 셌지 **주어**를 세지 않았다. 주어를 *"Trigger 행을 쓰는 모든 호출"* 로
바꿔 전수로 세면 `src/` 에 **19건**(내 새 헬퍼 1건 포함 · `repo-guards/` fixture·주석 9건 제외)이다.

> **첫 열거는 줄 단위라 두 건을 놓쳤다** — `await this.triggerRepository\n  .save(trigger)` 처럼
> 체인이 개행을 넘는 형태(`update()` `:545` · `create()` `:431`). 하필 **창 1 자신**이 그중
> 하나였다. 개행을 넘어 매칭하도록 방법을 바꿔 다시 셌다.

여기서 갈라야 하는 축은 **`update` 냐 `save` 냐**다:

- `repository.update(criteria, partial)` — **준 컬럼만** 쓴다. `chatChannelHealth` 류만 고치는
  5건(`chat-channel.dispatcher.ts` 2 · `notification-webhook.processor.ts` 2 ·
  `hooks.service.ts:970`)은 `config` 를 아예 건드리지 않는다 → **창이 아니다.**
- `repository.save(entity)` — **엔티티를 통째로** 저장한다. `config` 를 고칠 의도가 없는
  자리도 **로드 시점의 `config` 를 함께 싣는다.** 저장소가 이미 이 패턴에 이름을 붙여 뒀다:
  *"무가드 full-entity save lost-update"* (`plan/in-progress/ie-resume-turn-boundary-cancel.md`).

**기존 행에 `save(entity)` 하는 자리는 10곳**(신규 INSERT 2건·DELETE 1건 제외):

| 자리 | `config` 를 **명시** 수정 | 비고 |
|---|---|---|
| `triggers.service.ts` `update()` `:545` | ✔ | 창 1 — 위에서 유예 |
| `triggers.service.ts` `normalizeNotificationSecretRef` `:736` | ✔ | `update()` 안에서 창 1 직후에 불린다 |
| `triggers.service.ts` `revokeInteractionToken` `:969` | ✔ | `config.interaction` 교체 |
| `triggers.service.ts` `promoteNotificationSecrets` `:1217` (cron) | ✔ | `config.notification` 교체 |
| `triggers.service.ts` `:921` · `:1186` · `:1268` | — | 컬럼만 고치지만 `save` 라 `config` 가 암묵적으로 실린다 |
| `hooks.service.ts` `:228` · `:688` | — | 같음. **웹훅 타격마다** 도는 hot path (`lastTriggeredAt`) |
| `schedules.service.ts` `:234` | — | 같음 |

**이 PR 로 넓히지 않는다.** 「암묵」 행들이 실제로 되돌려 쓰는지는 `save` 의 diff 의미에
달려 있어 **자리별 판정**이 필요하고, 그 판정 없이 열 곳을 일괄로 락에 넣으면 위 hot path 에
트랜잭션을 새로 얹게 된다. 후속 항목으로 등재하고, **판정 기준은 모양이 아니라 주어**임을
여기 적어 둔다.

### `--impl-prep` INFO 등재 (planner 범위 — 이 브랜치에서 고치지 않는다)

| 항목 | 왜 planner 인가 |
|---|---|
| advisory lock 키 **인벤토리 문서 부재** | `redis-keys.md §4`(인접 네임스페이스)가 이 혼동을 막으려는 절인데 정작 lock key 계열이 미등재. `spec/` 편집 권한 밖 |
| `exec-cap:*` · `trigger-config:*` 의 `redis-keys.md §4` 등재 | 같은 문서. 자매 사례(`execution-engine.service.ts`)도 미등재라 **둘을 함께** 올려야 한다 |
| 기존 spec 의 회전 정책 **자기모순** | spec 본문끼리의 충돌 — 구현으로 못 닫는다 |
| 번들 절단 | consistency 하네스의 예산 문제. `--impl-prep` 산출물에 기록됨 |
| 전역 **32비트** 키 공간 공유 | `hashtext` 는 int4 를 낸다 — 전 도메인이 한 공간을 쓴다. 충돌 시 무해(과직렬화)하지만 **그 사실이 어디에도 적혀 있지 않다** |

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
- [x] 창 **3곳**에 «락 안에서 재읽기» 배선 (공용 유틸 `trigger-config-lock.ts` 하나로).
      **창 1 은 되돌렸다** — 실측 근거와 후속 모양은 §D.
- [x] 동시 PATCH e2e — `test/trigger-config-lost-update.e2e-spec.ts`. 배선·대응표는 §C.
- [ ] 트래커 항목 `[x]` + 실측 각주 (창이 **넷**이었다는 정정 포함)
- [ ] `run-test-all.sh`
- [ ] `/ai-review` + `--impl-done`

      **완료 기준**: 마지막 라운드가 **`codebase/**` 수정 0 으로 끝날 것.**
      **정지 규칙**(결과를 보기 전에 선언): `/ai-review` 가 **Critical 0 이고 WARNING 0** 이면
      INFO 내용과 무관하게 멈추고 INFO 는 등재한다.
