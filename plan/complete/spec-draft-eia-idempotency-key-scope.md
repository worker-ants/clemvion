---
title: spec draft — idempotency 캐시 키를 execution + endpoint 로 스코프
worktree: eia-r8-cache-scope-4ae434
started: 2026-08-12
owner: project-planner
status: complete
priority: P2
spec_impact:
  - spec/data-flow/15-external-interaction.md
  - spec/5-system/14-external-interaction-api.md
---

## Overview

idempotency 캐시 키가 **`Idempotency-Key` 헤더 값 하나에만** 바인딩돼 있다 —
`interaction:idempotency:<key>`. 이 네임스페이스는 **모든 execution·모든 토큰 보유자가
공유**한다. 서로 다른 두 요청자가 같은 키 + 같은 body 를 쓰면 한쪽의 캐시된 응답이 다른
쪽에게 그대로 재생된다.

이 draft 는 키를 **guard 가 검증한 `executionId`** 와 **endpoint** 로 스코프하도록 spec 을
고친다. 구현은 후속 developer 턴.

## 왜 지금 하나 — #1155 가 이론을 실제 경로로 바꿨다

이 지적은 `16_29_45`·`16_53_26`·`17_07_45`·`18_07_36`·`18_52_47`·`19_04_29` **여섯 라운드**의
security 리뷰가 반복했다. 그동안 유예된 근거는 "409/410 캐싱이 dead code 라 이론상" 이었는데,
[#1155](https://github.com/worker-ants/clemvion/pull/1155) 가 그 dead code 를 실제 발동 경로로
바꿨다. 이제 **에러 응답까지** 이 공유 네임스페이스에 적재된다.

> ⚠️ 그 여섯 라운드 중 다섯 라운드가 "plan 백로그에 이미 등재됨" 으로 처분했으나 실제로는
> 적힌 적이 없었다. `19_04_29` security 가 plan 을 직접 grep 해 잡았다. 경위는
> [`backend-lint-gate-broken-on-main.md`](backend-lint-gate-broken-on-main.md) 해당 항목에 있다.

## 무엇이 깨지는가 — 두 축

### 축 1: execution 간 (원 지적)

`InteractionGuard` 는 인터셉터보다 먼저 돌아 토큰↔execution 대응을 검증하므로 **인증 우회는
없다.** 깨지는 것은 그 다음이다:

1. 요청자 A — execution A 에 대해 `Idempotency-Key: k`, body X → 응답이 `…:k` 에 적재
2. 요청자 B — execution **B** 에 대해 정당한 토큰으로 같은 `k`, 같은 body X
3. 인터셉터가 캐시 hit 으로 판정 → **B 의 명령은 서비스에 도달조차 하지 않고**, A 의 응답이
   B 에게 반환된다

두 결과 모두 나쁘다: (a) B 의 인터랙션이 **조용히 유실**되는데 B 는 `202 accepted` 를 받는다,
(b) A 의 응답 body(`executionId` 포함)가 B 에게 **노출**된다.

### 축 2: route 간 (원 지적의 확장 — 명시해 둔다)

같은 인터셉터가 `POST :executionId/interact` 와 `POST :executionId/cancel` **두 자리**에
붙어 있는데 키에 그 구분이 없다. `CancelDto` 는 전 필드 optional 이라 body `{}` 가 가능하고,
그 경우 `bodyHash` 가 `{}` 인 interact 요청과 **일치**한다 → cancel 의 202 ack 가 interact
요청에 재생된다.

> 이 축은 리뷰어가 지적한 범위 밖이고 내가 추가한다. 근거는 저장소 교훈이다 —
> **자매 호출부를 빠뜨려 방어를 한 칸 좁게 잡는 실패가 반복됐다.** 같은 인터셉터가 붙은 두
> 자리를 한쪽만 스코프하면 정확히 그 형태가 된다. 비용은 키 세그먼트 하나다.

## 스코프 식별자를 무엇으로 할 것인가 — 토큰이 아니라 execution

"인증 컨텍스트로 스코프" 라는 원 지적을 **토큰 식별자(jti)로** 읽으면 안 된다. 그렇게 하면
`POST :executionId/refresh-token` 으로 토큰이 회전한 뒤의 재시도가 **다른 키로 떨어져 멱등성이
깨진다** — `EIA-RL-02`("동일 키 24h 동일 응답 재현")가 요구하는 바로 그 재시도 시나리오다.

올바른 granularity 는 `executionId` 다:

- 같은 execution 을 대상으로 하는 두 요청은 **같은 작업**이다 → 같은 네임스페이스가 맞다
  (그것이 멱등성의 정의다). 토큰이 회전해도, `iext` 와 `itk` 가 섞여도 재현돼야 한다.
- 다른 execution 을 대상으로 하는 두 요청은 **다른 작업**이다 → 분리돼야 한다.

값의 출처는 `req.interaction.executionId` — `InteractionGuard.canActivate` 가 토큰 검증을
마치고 합성한 값이다(`iext` 는 토큰 `sub`, `itk` 는 trigger 소유 확인 후 URL 파라미터).
**클라이언트가 조작할 수 없는 값**이라는 점이 URL 파라미터 원문을 직접 읽는 것과 다르다.

## 범위 밖 — in-process trusted 경로 (`CCH-SE-02`)

[`spec/5-system/15-chat-channel.md`](../../spec/5-system/15-chat-channel.md) L88 `CCH-SE-02` 는
"인터랙션 명령 처리는 EIA `Idempotency-Key` 를 어댑터가 자동 발급 (텔레그램 `update_id` 기반)"
이라고 적지만, **그 경로는 이 draft 가 다루는 HTTP 인터셉터를 타지 않는다** — chat-channel 은
`in_process_trusted` ctx 로 `interactionService` 를 직접 호출한다.

실측: `ChannelUpdate.idempotencyKey`(`chat-channel/types.ts:129`)는 provider 파서 4종이
채우기만 하고 **읽는 곳이 0곳**이다(`grep` 결과 타입 선언 1건 + 파서/테스트뿐).
즉 `CCH-SE-02` 의 "동일 `update_id` 30초 안 재도착은 무시" 는 **미배선**이며, 이 draft 이전부터
그랬다. 본 draft 의 스코프 모델(`req.interaction.executionId`)은 그 경로에 적용되지 않는다.

> 그 dead field 갭은 이 draft 의 범위가 아니라 **별도 후속 항목**으로 등재한다.

## 제안 변경

### 1. `spec/data-flow/15-external-interaction.md` — 키 형식 3자리

| 위치 | 현재 | 변경 |
|---|---|---|
| L93 (§1.2 시퀀스) | `GET interaction:idempotency:<key>` | `GET interaction:idempotency:<executionId>:<route>:<key>` |
| L98 (§1.2 시퀀스) | `… interaction:idempotency:<key> 에 24h 캐시` | 동일하게 스코프 반영 |
| L258 (§2.2 Redis 표) | `interaction:idempotency:<key>` | `interaction:idempotency:<executionId>:<route>:<key>` + 스코프 사유 한 줄 |

**`<route>` 의 값 도메인은 `interact` \| `cancel` 고정 문자열**이며 출처는 Nest 핸들러명
(`context.getHandler().name`)이다. 세그먼트명을 `<endpoint>` 로 쓰지 않는 이유는 webhook 트리거의
`endpointPath`([데이터 모델](../../spec/1-data-model.md) · [webhook](../../spec/5-system/12-webhook.md))와
표면적으로 겹쳐서다 — 그쪽은 **사용자가 바꿀 수 있는 URL 경로**라 개념이 다르다. `<command>` 도
쓰지 않는다 — `dto.command`(`submit_form`·`click_button`·…)가 이미 그 이름을 쓰고 있고, 이
세그먼트의 값은 command 가 아니라 route 다.

### 2. `spec/5-system/14-external-interaction-api.md` — 요구사항 두 행에 스코프 한정

두 행 모두 "동일 키" 라고만 적어 **전역 유일성을 암시**한다. 실제 계약은 execution 안에서다.

| 행 | 현재 | 변경 |
|---|---|---|
| EIA-IN-11 (L81) | `동일 키 24h 캐시` | `동일 execution·동일 route 안에서 동일 키 24h 캐시` |
| EIA-RL-02 (L140) | `Idempotency-Key 동일 시 동일 응답 24h 재현` | 같은 한정 추가 |

### 3. `spec/5-system/14` §R8 Rationale — 스코프 근거 문단 추가

§R8 Rationale 은 지금 **무엇을 캐시하는가**만 다룬다. **어디에 캐시하는가**(키 네임스페이스)는
아무 데도 없어서, 구현이 헤더 값만으로 키를 만든 것이 문서상 위반이 아니었다. 위 "토큰이 아니라
execution" 논증과 두 파손 축을 그 자리에 남긴다 — 다음 구현자가 스코프를 **좁히거나(jti 추가)
넓히는(전역 복귀)** 두 방향 모두 왜 틀리는지 알아야 한다.

## 구현 인계 — ctx 부재 시의 처분

`req.interaction` 이 없으면(가드 미적용 등) **캐시를 건너뛴다** — 스코프 없는 전역 키로
**fallback 하지 않는다.** 조용한 fallback 은 이 draft 가 닫으려는 취약점을 그대로 되살린다.

이 인터셉터의 다른 모든 실패 경로(Redis 미주입·GET 실패·SET 실패·직렬화 실패)가 이미
"멱등성을 포기하고 요청은 통과" 이므로 일관된다. warn 로그를 남긴다.

## 동반 갱신 (구현 턴)

- `idempotency.interceptor.ts` — `REDIS_KEY_PREFIX` 조립부
- `idempotency.interceptor.spec.ts` L143 — `stringContaining('interaction:idempotency:key-1')`
- `external-interaction.e2e-spec.ts` L425·L495·L538 — `redis.get()` 관측점 3자리
- `CHANGELOG.md`

## 체크리스트

- [x] `consistency-check --spec` BLOCK: NO 확인 (`19_56_51` — WARNING 4 전량 반영, 아래 Rationale)
- [x] `spec/data-flow/15` 키 형식 3자리 + 표 사유
- [x] `spec/5-system/14` EIA-IN-11 · EIA-RL-02 한정 추가
- [x] `spec/5-system/14` §R8 Rationale 스코프 문단
- [x] `backend-lint-gate-broken-on-main.md` 의 **2-세그먼트** 조치 방향 문구를
      **3-세그먼트** (`<executionId>:<route>:<key>`) 로 갱신 + 축 2 근거 + "토큰이 아니다"
      — 그 항목이 구현 턴의 착수 근거라 문구가 어긋나면 구현이 좁게 나온다
      > checker 가 함께 지목한 L557 은 **고치지 않았다.** 그 줄은 완료된 e2e 항목 안에서
      > "그때 관측점을 무엇으로 바꿨나" 를 서술하는 **역사 기록**이라, 지금 키 형식으로
      > 덮어쓰면 사실이 아니게 된다. 구현 턴이 e2e 를 3-세그먼트로 옮기는 것과 별개다.
- [x] 후속 항목 2건 신규 등재: `CCH-SE-02` dead field · EIA Redis 키의 §9.1 미등재
      (`backend-lint-gate-broken-on-main.md` — **등재 후 grep 으로 확인함**)

> **완료 (2026-08-12).** spec 은 [#1156](https://github.com/worker-ants/clemvion/pull/1156),
> 구현은 후속 developer 턴(`eia-idem-key-scope-impl`)에서 착지했다.
>
> 구현 쪽에서 **이 draft 의 전제 하나가 실측으로 보강됐다** — draft 는 "상태코드로 갈리는
> e2e" 를 요구했는데, 첫 구현의 `IDEM-4`·`IDEM-5` 는 뮤테이션에서 **캐시 키 존재 단언(white-box)
> 에서 죽고 상태코드 단언에는 도달하지 못했다.** 단언 순서를 뒤집고서야 뮤턴트가
> `Expected: 202 / Received: 410`(남의 응답 수신)으로 죽었다. 관측점을 옳게 골라도 **단언
> 순서**가 앞의 단언에서 먼저 죽게 만들면 뒤의 단언은 없는 것과 같다.

## Rationale

### 왜 execution 단위인가 — 토큰이 아니다

위 "스코프 식별자" 절이 근거다. 요약하면 **멱등성의 단위는 "같은 작업"이고, 같은 execution 을
대상으로 한 두 요청은 토큰이 회전했든 family(`iext`/`itk`)가 다르든 같은 작업이다.** jti 로
스코프하면 `refresh-token` 직후의 재시도가 다른 키로 떨어져 `EIA-RL-02` 가 보장하려던 시나리오를
정확히 깬다.

### 왜 route 축을 더하나 — 리뷰어가 지적한 범위 밖이다

`CancelDto` 전 필드 optional → body `{}` 가 `bodyHash` 를 interact 의 `{}` 와 일치시킨다.
execution 만 스코프하면 이 축이 남는다. 저장소에서 **자매 호출부를 빠뜨려 방어를 한 칸 좁게
잡는 실패가 반복**됐으므로, 같은 인터셉터가 붙은 두 자리를 함께 닫는다. 비용은 세그먼트 하나다.

> **R16("cancel 은 interact 의 편의 alias")과 혼동하지 말 것** — 그 alias 는 응답 DTO 형태와
> 의미가 같다는 뜻이지 **캐시 네임스페이스를 공유한다는 뜻이 아니다.** 두 route 는 서로 다른
> body 스키마를 받으므로 별도 엔트리가 맞다.

### 전역 키 선례 — `exec:seq:<executionId>`

executionId 로 스코프한 **Redis** 전역 키는 이미 선례가 있다:
[`4-execution-engine.md` §9.2](../../spec/5-system/4-execution-engine.md) 의
`exec:seq:<executionId>` · `exec:cont:seq:<executionId>` 로, 같은 문서 §9.2 말미가
"executionId 가 이미 전역 유일 UUID 이므로 전역 키로 둔다" 고 근거까지 적어 뒀다. 즉 이 결정은
임기응변이 아니라 저장소의 기존 패턴이다.

> `consistency-check` 가 선례로 제시한 `bg:<executionId>:<backgroundRunId>` 는 **채택하지
> 않는다.** 같은 문서 L743 이 그 키를 **"in-memory 전용 — Redis 키 패턴(§9.1)과 무관"** 이라고
> 명시하므로 Redis 키의 선례로 인용하면 틀린 인용이 된다. 구조는 동형이지만 층이 다르다.

### consistency-check `19_56_51` 노트 (BLOCK: NO, WARNING 4)

| # | 지적 | 처분 |
|---|---|---|
| 1 | `<endpoint>` 가 webhook `endpointPath` 와 혼동 | **반영** — `<route>` 로 개명 + 값 도메인·출처 명시 |
| 2 | draft 에 `## Rationale` 부재 (planner SKILL §3·4) | **반영** — 본 절 |
| 3 | `CCH-SE-02` in-process 경로 범위 밖 명시 누락 | **반영** — 전용 절 추가. dead field 는 직접 grep 으로 확인 |
| 4 | 선행 backlog 문구가 2-세그먼트로 남음 | **반영** — 체크리스트 구체화 |

INFO 4(§9.1 `{service}:{workspaceId}:…` 패턴 미준수)는 **이번 범위에서 처리하지 않는다.**
`interaction:idempotency:` 뿐 아니라 `iext:blacklist:<jti>` 등 **EIA 계열 Redis 키 전부**가
§9.2 표와 그 예외 각주에 없다 — 내 키 하나만 등재하면 목록이 더 이상해진다. 선재이자 더 넓은
갭이라 별도 항목으로 등재한다(`spec_impact` 에 `4-execution-engine.md` 추가가 필요해 이 draft 의
consistency 결과도 stale 이 된다).
