---
title: 창 1 의 통째 save 가 락 밖 컬럼 쓰기를 되돌린다 — 부분 객체 save 로 좁힌다
status: in-progress
owner: developer
worktree: trigger-cascade-window-probe-5e9e92
started: 2026-09-17
spec_impact: none
---

# 창 1(`TriggersService.update()`)의 통째 `save` — 실측과 수정

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` developer 항목 **7**
(*"창 1 이 FK CASCADE 창에 대해 미검증"*)을 닫는다. spec `2-trigger-list.md §3` 의 ⚠️
«실측되지 않은 잔여» ①② 가 가리키는 자리다.

## 실측 — 운영 코드에 훅을 넣지 않고 창을 결정적으로 재현했다

HTTP 로는 그 창(락 안 **재읽기와 저장 사이**)을 열 수 없다 — advisory lock 은 읽기 **전에**
잡히므로 테스트가 락을 쥐어도 PATCH 는 재읽기 이전에 멈춘다. 기존 e2e 훅 관례
(`NODE_ENV==='test' && E2E_TEST_HOOKS==='1'` + `@Roles('owner')`)는 «경로를 요청 시점에
**실행**» 하는 용도이고 트랜잭션 **중간에 멈추는** 선례가 없다.

그래서 e2e 네트워크 안에서 **TypeORM 을 실제 Postgres 에 직접 붙여** 창을 재현했다 —
트랜잭션 A 재읽기(`findOne` + `relations: ['workflow']`, 창 1 과 동일) → 연결 B 경합 커밋 → A 저장.
(측정용 spec 은 특성 테스트 `codebase/backend/test/trigger-update-save-window.e2e-spec.ts` 로 전환했다)

| 창 | A 의 저장 | 관측 | 판정 |
|---|---|---|---|
| ① B 가 `workflow` 삭제(FK CASCADE) | 통째 엔티티 `save` | `QueryFailedError` **23503** `trigger_workflow_id_fkey`, 롤백, 행 0 | **추정대로 시끄럽게 실패** — 부활 없음 |
| ② B 가 `notification_secret_v2`·`last_triggered_at` 컬럼 갱신 | 통째 엔티티 `save` | 두 컬럼 모두 **`null` 로 되돌아감** | **조용한 lost update — 실결함** |
| ②b 같은 경합 | **바꿀 필드만 담은 부분 객체** `save` | `v2-from-B`·`last_triggered_at` **보존**, `name`·`config` 반영, `updated_at` 갱신 | 수정 방향 확인 |
| ③ 없는 행 `update` (main 에 올라간 `pg`) | — | `affected: 0` | `#1341` 의 0행 판정이 실제 드라이버에서 동작 |

### ② 가 왜 일어나나

TypeORM `save` 는 저장 시점에 DB 행을 다시 읽고 **엔티티와 다른 컬럼만** UPDATE 한다. 창 1 의
엔티티는 락 안 재읽기 시점 값을 들고 있으므로, 그 **뒤에** 락 밖에서 커밋된 컬럼은 «엔티티와
다르다» 로 잡혀 옛 값으로 되써진다.

`#1334` 는 이 자리를 *"락 밖 컬럼 한정 갱신 3곳의 이론적 TOCTOU"* 로 유예했다 — **이론이
아니었다.** 되돌아가는 대상:

| 컬럼 | 락 밖 쓰기 주체 | 되돌아가면 |
|---|---|---|
| `notification_secret_v2` | `rotateNotificationSecret` | 24h grace 회전 상태 유실 — **보안 성격** |
| `chat_channel_token_v2` | `cleanupRotatedChatChannelTokens` (null-write) | cron 이 지운 v2 가 되살아남 |
| `last_triggered_at` | 웹훅 인입 hot path | 관측값 퇴행 |
| `name`·`is_active` (schedule 트리거) | `SchedulesService.update()` 동기화 | 스케줄 편집이 되돌아감 |

## 설계 — `save` 는 유지하고 **저장 대상만** 좁힌다

창 1 을 `update` + 재조회로 바꾸는 안은 **이미 시도했다 되돌린 이력**이 있다 — 반환 엔티티 ·
subscriber · `endpointPath` UNIQUE 충돌 경로의 의미가 함께 달라져 단위 6건 RED
(`triggers.service.ts` 창 1 주석). 그래서 동사는 `save` 로 두고:

```ts
const target = this.assertTriggerFound(fresh);
const written = await m.save(Trigger, { id: target.id, ...defined, config: mergedConfig });
Object.assign(target, defined, { config: mergedConfig });
if (written.updatedAt) target.updatedAt = written.updatedAt;
return target;
```

- **저장**은 이 요청이 바꾸려는 필드(`defined` + `config`)만 — 나머지 컬럼은 `undefined` 라
  TypeORM 이 비교에서 뺀다(②b 실측).
- **응답**은 관계(`workflow`)를 가진 재읽은 엔티티에 **이 요청의 변경 + `save` 반환값의 `updatedAt`
  하나**를 얹는다. 반환값을 통째로 덮지 않는다 — 아래 «내가 틀린 측정» 참조.
- 엔티티에 리스너(`@Before*`/`@After*`)·필드 초기값 **없음** — 부분 객체가 달리 동작할 여지를
  확인했다.
- `endpointPath` 충돌 래핑 가드(`save(Trigger, …)` 가 `rethrowEndpointPathConflict` 로 감싸짐)는
  동사가 같아 그대로 만족한다.
- ① 창에서 부분 객체 `save` 는 INSERT 로 넘어가 NOT NULL(`workspace_id`·`workflow_id`·`type`)
  위반으로 실패할 것이다 — **여전히 시끄러운 롤백**이지만 코드가 23503 이 아니라 23502 가
  된다. 이 차이도 실측으로 고정한다.

## 내가 틀린 측정 — 그리고 그것이 만든 회귀

②b 에서 부분 객체 `save` 의 반환값 **키 목록**(`endpointPath`·`notificationSecretV2` 등 포함)을
기록하고, 거기서 «TypeORM 이 UPDATE 뒤 **다시 읽은 값**을 담아 돌려준다» 고 추론해 설계와 코드
주석에 적었다. 그래서 응답을 `Object.assign(target, written)` 으로 만들었다.

**키 목록은 값이 아니었다.** 전체 e2e 에서 `chatChannel` 을 실은 PATCH 가 전부 400
(`CHAT_CHANNEL_ENDPOINT_REQUIRED`)으로 깨졌고(`trigger-workflow-ref` · `trigger-config-lost-update`),
응답 본문을 찍어 원인을 좁힌 뒤 **값을 직접 쟀다**:

| 컬럼 | DB 실제 값 | `save` 반환값 |
|---|---|---|
| `notification_secret_v2` | `'v2-B'` | **`null`** |
| `endpoint_path` | UUID | **`null`** |
| 넘기지 않은 nullable 컬럼 전부 | 각자 값 | **`null`** |
| `updated_at` | 새 시각 | **새 시각** (유일한 실값) |

반환값은 재조회가 아니라 **넘기지 않은 nullable 컬럼을 `null` 로 채운 객체**였다. 그걸 통째로
덮어 `endpointPath` 를 지웠다 — 같은 파일 20줄 위 `defined` 註가 경고한 «로드된 값을 덮는다» 와
**같은 함정**을 그 옆에서 다시 만들었다. **단위 테스트는 mock 이라 이 모양을 흉내내지 않아 613건이
전부 GREEN 이었다.**

고친 것:
- 응답은 `defined` + `config` + **`updatedAt` 만** 얹는다.
- 단위 회귀 테스트가 **실측한 반환 모양 그대로**(`null` 채움 + `updatedAt`)를 흉내낸다.
- e2e 특성 테스트에 «반환값은 재조회가 아니다 — 넘기지 않은 컬럼은 `null`» 을 단언으로 고정했다.

> **값을 재야 할 자리에서 키를 쟀다.** 이 저장소에서 반복된 «프록시로 실측했다고 주장» 의 한
> 형태다. 그리고 **e2e 를 건너뛰었으면 이 회귀는 머지됐다** — mock 이 실측한 모양을 흉내내지 않는
> 한 단위 GREEN 은 아무것도 보장하지 않았다.

## 1라운드 리뷰 처분 (`review/code/2026/09/17/13_44_39` — **C0 · W5 · LOW**)

forced 7/7, `unfinished: []`. 대응은 **모아서** 한 번에 했다.

| # | 처분 |
|---|---|
| W1 [SPEC-DRIFT] `2-trigger-list.md §3` ⚠️ 가 이 PR 로 낡는다 | **planner 후속** — 이미 «이 PR 이 안 하는 것» 에 적었다. 코드는 옳다 |
| W2 plan 뮤턴트 표 M1 이 «2 RED» 인데 실측 1 | **수용·정정** — 리뷰어가 맞았다. 최종 코드에서 재측정해 표를 갈았다 |
| W3 창 1 머리말 «재읽은 행을 저장 대상으로 쓴다» 가 아래 코드와 모순 | **수용·수정** — 같은 전제를 가진 `withRef` 픽스처 JSDoc 도 함께 |
| W4 mock JSDoc 이 «고칠 땐 다시 재라» 인데 재측정 기록 없음 | **수용·재측정** — 53 → **60** |
| W5 저장 payload 가 `save` 와 `Object.assign` 에 두 번 | **수용·수정** — `const patch` 하나로 |
| INFO#1 `if (written.updatedAt)` 가드의 근거 부재 (5명 공통) | **수용** — 근거 주석(단위 대역이 넘긴 객체를 돌려줄 때 재읽은 값을 지우지 않으려는 것) |
| INFO#12 null 단언이 한 컬럼만 본다 | **수용** — 응답에 남는 세 컬럼으로. 처음엔 비밀 컬럼 둘로 조였다가 `TRIGGER_RESPONSE_STRIP_COLUMNS` 가 응답에서 지워 단언이 성립하지 않음을 실패로 알았다. M4 뮤턴트 RED |
| INFO#4 `jest.config.ts` 의 «e2e 는 pg Client 만 연다» 전제가 깨졌다 | **수용** — 예외 한 줄 |
| INFO#2·#3·#5~#11·#13 | 조치 불요 / 기지 갭 / 기록 목적 |

## 검증 계획

- **측정 spec 을 특성 테스트로 전환** — 관측을 단언으로. ①(통째)·①b(부분) 시끄러운 실패와 코드,
  ②(통째 = 되돌림) · ②b(부분 = 보존), ③ `affected: 0`.
  > ② 는 **TypeORM 동작을 박제**하는 단언이다(우리 버그를 박제하는 것이 아니다) — «왜 창 1 이
  > 부분 객체여야 하는가» 의 근거이고, TypeORM 이 바뀌면 이 테스트가 먼저 알린다.
- **단위**: 창 1 이 `repo.save` 에 넘기는 객체의 **키 집합**이 `id` + 요청 필드 + `config` 뿐임을
  단언 — 통째 엔티티로 되돌리는 뮤턴트가 RED 여야 한다.
- `run-test-all.sh` + 백엔드 타입 진단 ratchet.

## 이 PR 이 **안** 하는 것

- spec `2-trigger-list.md` 갱신 — ⚠️ 문장은 **planner 턴**이 썼다. 역할 경계상 developer 가
  고치지 않고 **별 PR(planner)** 로 분리한다. 그 planner PR 이 할 일(트래커에 등재):
  1. §3 ⚠️ 를 «① 시끄러운 실패로 실측 · ② 실결함이었고 부분 객체 `save` 로 수정됨» 으로 교체
  2. **①①b②②b③ 을 고정하는 e2e 특성 테스트 파일을 frontmatter `code:` 에 등재** — 이 문서가
     스스로 성문화한 관례(«e2e 가 보장을 고정하면 그 파일을 `code:` 에 올린다», 선례
     `trigger-workflow-ref.e2e-spec.ts`)다 (`--impl-prep` W1)
  3. `15-chat-channel.md §5.4` 404 행에 «CASCADE 창의 병합 쓰기 0행» 사유 한 줄 (`--impl-prep` INFO#1)

## `--impl-prep` 처분 (`review/consistency/2026/09/17/13_04_39` — **BLOCK: NO** · W1)

| # | 처분 |
|---|---|
| W1 planner 후속에 e2e 증거 파일 `code:` 등재가 빠졌다 | **수용** — 위 «이 PR 이 안 하는 것» 2 |
| INFO#1 chat-channel §5.4 404 행에 CASCADE 창 사유 | **수용** — planner 후속 3 |
| INFO#2 머지~planner PR 사이 ⚠️ 가 낡는 창 | 인지 — 머지 직후 planner PR 을 연다 |
| INFO#5 두 e2e 파일의 책임 경계 | **수용** — 특성 테스트 전환 시 파일명을 `probe` 에서 바꾸고 JSDoc 에 `trigger-config-lost-update.e2e-spec.ts` 와의 분리를 적는다 |
| INFO#3·#4 | 조치 불요 (번들 절단 기지 · 무관한 frontmatter 관행) |

## 체크리스트

- [x] `/consistency-check --impl-prep spec/2-navigation/` — `review/consistency/2026/09/17/13_04_39` **BLOCK: NO**
- [x] 창 1 부분 객체 `save` + 단위 단언 + 뮤턴트 RED

      | 뮤턴트 (최종 코드 기준 재측정) | RED |
      |---|---|
      | M1 통째 엔티티 `save` 로 되돌림 | `저장 대상은 이 요청이 바꾸는 필드뿐이다` **1건** |
      | M2 반환값을 통째로 덮음 (**내가 낸 회귀**) | `save 반환값의 null 이 재읽은 값을 덮지 않는다` |
      | M3 `updatedAt` 반영 누락 | 같은 테스트 |
      | M4 한 필드만 골라 덮음 (`lastTriggeredAt`) | 같은 테스트 — 1라운드 INFO#12 대응 |
      | mock `transaction` 이 콜백을 실행하지 않음 | **60 RED** (321건 중) — mock JSDoc 갱신 |

      > **M1 을 한때 «2 RED» 로 적었다 — 1라운드 testing W2 가 반박했고 리뷰어가 맞았다.** 그
      > «2» 는 창 1 이 `m.save(...)` 반환값을 그대로 돌려주던 **이전 형태**에서 잰 값이었다.
      > 코드를 고친 뒤 표를 다시 재지 않았다. 최종 코드에서 M1 은 키 집합 테스트 하나만 죽인다.

- [x] 측정 spec → 특성 테스트 `test/trigger-update-save-window.e2e-spec.ts` — ①(통째 23503)·①b(부분
      **23502** 실측)·②(통째 되돌림)·②c(반환값은 재조회 아님)·②b(부분 보존)·③(`affected` 0). 6건.
- [x] `run-test-all.sh` 4단계 **ALL PASS** (lint · unit 14 · build+타입 ratchet · e2e **314**). 첫
      실행에서 `chatChannel` PATCH e2e 2건이 400 으로 깨졌다 — 위 «내가 틀린 측정».
- [ ] 트래커 항목 7 `[x]` + planner 후속(⚠️ 정정) 등재 + plan → `complete/`
- [ ] `/ai-review` + `--impl-done`

      **정지 규칙**(하나만): **`codebase/**` 수정 0 으로 끝나는 라운드가 나오면 종료.**
