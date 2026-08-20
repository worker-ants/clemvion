---
title: "`inputOverride` 서버측 마커 리터럴 거부 — 가드를 UI 밖으로 넓힌다"
worktree: eia-inputoverride-reject-a3f1c9
started: 2026-08-20
owner: planner
status: in-progress
priority: P2
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/13-replay-rerun.md
  - spec/4-nodes/7-trigger/1-manual-trigger.md
  - spec/1-data-model.md
  - spec/3-workflow-editor/3-execution.md
  - spec/5-system/12-webhook.md
---

> **`19_34_37` 게이트가 BLOCK: YES 를 냈고 그 CRITICAL 을 본문에 반영했다.** 초안의 전제
> (*"봉투는 기존과 같다"*)가 re-run 호출부에서 거짓이었다 — 아래 "초안의 전제가 틀렸다" 절.
> WARNING 2건(안전성 근거의 출처 · `coerce_failed` 제안 라운드 수)도 같은 턴에 정정했다.

# `inputOverride` 서버측 마커 리터럴 거부

트래커 `spec-sync-external-interaction-api-gaps.md` 의 **"`inputOverride` 서버측 마커 리터럴
거부"**(2026-08-20 등재, `14_44_08` W6) 집행. #1188 후속으로 사용자가 지정했다.

## 왜 지금인가 — 유예 근거가 실측으로 반증됐다

이 항목은 세 라운드 연속 지적됐고 매번 같은 근거로 유예됐다: *"§R17 이 가드 범위를 UI 정상
흐름으로 명시했다"*. **#1188 라운드9에서 §R17 을 열어 실측하니 그런 문장이 없었다** — 프런트
소비처 셋을 나열하고 "정확 일치만 감지한다" 는 경계만 적었을 뿐이다. 근거가 약해서 지적이
계속 돌아온 것이다.

사용자 결정(2026-08-20): **거부 구현 + spec 명문화**.

**안전성 근거의 출처를 명시한다** (`19_34_37` rationale_continuity·plan_coherence WARNING).
*"저장소 밖에서 `GET /api/executions*` 의 `inputData` 를 직접 소비하는 것은 없다"* 는 내가
조사해 얻은 결과가 **아니라 저장소 소유자(사용자)의 답변**이다 — 2026-08-20 세션에서 직접
물었고 *"없다 — 프런트가 유일 소비자"* 를 받았다. 게이트가 *"검증 없는 재서술일 가능성"*
을 지적한 것은 정당하다(diff·git log 에 조사 흔적이 없다). 다만 이 질문은 **코드로 답할 수
있는 성질이 아니다** — 운영 정보이고, 그래서 트래커 항목도 "확인" 으로 남겨져 있었다.

이 답변이 근거가 되는 방식: 마커를 되보내던 외부 자동화가 없으므로 서버측 400 거부가 깨뜨릴
클라이언트가 없다. 트래커 W5(`inputData` 응답 의미 반전의 외부 소비자 확인)도 **이 답변으로
닫는다** — 닫을 때 출처를 같은 문장에 적는다.

## 무엇을 거부하는가 — 범위를 좁게 잡는다

`resolveTriggerParameters` 호출부는 **5곳**이다(실측):

| 호출부 | 입력 출처 | 재제출 성격 | 거부 대상 |
|---|---|---|---|
| `executions.service.ts:493` (re-run) | 사용자가 되보낸 `inputOverride` | **예** | **○** |
| `workflows.controller.ts:314` (execute) | 에디터 "Run with Input" JSON | **예** | **○** |
| `hooks.service.ts:183` (webhook) | 외부 시스템 body | 아니오 | ✗ |
| `schedule-runner.service.ts:78,88` | 스케줄 config | 아니오 | ✗ |

**`resolveTriggerParameters` 안에 넣지 않는다.** 그 함수는 네 경로가 공유하는데, webhook body
가 리터럴 `***` 를 담는 것은 **정상일 수 있다**(사용자가 폼에 별표를 입력했을 수도 있다).
공유 프리미티브를 넓히면 무관한 경로가 오염된다 — 이 저장소가 겪은 형태다.

> **판정 기준**: *"이 값이 마스킹된 읽기에서 되돌아온 것인가."* 그렇다면 마커는 사용자의
> 실제 입력일 수 없다. 아니라면 마커처럼 보이는 값도 정상 입력일 수 있다.

## 어떤 형태로 거부하는가

**정확 일치만.** 프런트 `isMaskedMarker` 와 같은 경계다 — 값 전체가 `***`/`[REDACTED]`/
`[REDACTED_DEPTH]` 중 하나일 때만. 부분 포함(`a***b`)으로 넓히면 정상 값을 막는다.

**중첩까지 본다.** 프런트 `hasMaskedMarkerLeaf` 와 같다 — `{"headers":{"apiKey":"***"}}` 가
#1188 에서 CRITICAL 이었던 그 형태다. 스칼라만 보면 같은 구멍이 서버에 남는다.

**깊이 상한은 backend `MAX_REDACT_DEPTH`(10) 와 같게.** 마스커가 depth 10 에서 서브트리를
마커로 치환하므로 그 아래에 마커가 있을 수 없다. 값 검사를 깊이 검사보다 **먼저** 해야
상한 지점의 마커를 놓치지 않는다(#1188 에서 off-by-one = fail-open 으로 확인).

## 에러 계약 — 기존 헬퍼를 확장한다

`trigger-parameter.types.ts` 가 이미 `reason`(내부 소문자) → `code`(공개 UPPER_SNAKE) 매핑을
갖고 있다. 네 번째 항을 더한다:

| 내부 `reason` | 공개 `code` | 의미 |
|---|---|---|
| `masked_value_resubmitted` | `MASKED_VALUE_RESUBMITTED` | 마스킹된 값이 그대로 재제출됨 |

> **형제와 명명축을 맞췄다** (`19_48_56` cross_spec·convention INFO-1). 초안은
> `masked_marker` 였는데 그건 *"값의 정체"* 를 가리키는 명사구다. 형제 셋
> (`missing_required` · `coerce_failed` · `invalid_schema`)은 전부 **`<주어>_<상태>`** —
> *"무엇이 어떻게 됐나"* 다. 축이 갈리면 다음 사람이 네 번째를 어느 쪽으로 지을지 헷갈린다.

**`coerce_failed` 를 재사용하지 않는다.** 의미가 다르고, 사용자가 받을 안내도 다르다 —
"타입이 안 맞는다" 가 아니라 "가려진 값을 다시 입력하라" 다. 의미가 틀린 코드를 재사용해
spec 작업을 아끼면 다음 사람이 그 코드를 믿고 잘못 분기한다.

### ⚠️ 초안의 전제가 틀렸다 — re-run 은 `details[]` 를 애초에 안 싣는다

초안은 *"봉투는 기존과 같다 — `details[]` 항목 코드만 새로 는다"* 고 적었다. **두 호출부 중
하나에서 거짓이다**(`19_34_37` CRITICAL, cross_spec·naming_collision 이 독립 실측):

```
executions.service.ts:496-500   throw new BadRequestException({
                                  code: 'INVALID_INPUT',
                                  errors: err.errors,      ← `details` 가 아니다 (raw reason)
                                })
http-exception.filter.ts:73     details = resp.details ?? nested?.details
                                                            ← `errors` 는 읽지 않는다
```

즉 re-run 경로는 **필드별 내역이 봉투에 실리지 않고 조용히 버려진다.** 초안대로 구현하면
execute 경로는 `MASKED_VALUE_RESUBMITTED` 안내가 도달하지만 **re-run 은 400 만 뜨고 이유가
없다** — 내가 *"사용자가 '마커를 채우라' 대신 일반 오류 토스트를 본다"* 며 `coerce_failed`
재사용을 기각한 바로 그 UX 퇴화가, 내 설계 안에서 절반 재현된다.

> **이건 선존 버그이기도 하다.** 오늘도 re-run 의 `missing_required`/`coerce_failed` 내역이
> 같은 이유로 버려진다. 이 작업이 그 배선을 함께 고친다 — 마커 코드만 새로 얹으면 새 코드가
> 도달하지 못하는 자리에 놓인다.

**구현 스코프에 포함**: `executions.service.ts` 의 catch 블록을
`details: toTriggerParameterErrorDetails(err.errors)` 로 교정. execute 경로
(`workflows.controller.ts`)는 이미 그렇게 하고 있어 두 호출부가 같아진다.

**Swagger 동반 갱신**: `details[].code` 열거를 담은 DTO/예시가 있으면 함께 갱신한다
(`19_48_56` convention INFO-3). 구현 착수 시 `ErrorResponseDto` 계열을 grep 해 실측한다 —
"있으면" 으로 두지 않고 있는지부터 센다.

## spec 변경 7곳 (+선택 1)

1. **`14-external-interaction-api.md` §R17 잔여②** — 표에 **서버측** 행을 추가하고, "닫는
   조건은 충족됐다" 아래에 범위 문장을 넣는다. 종전에는 UI 한정 폐쇄인데 그 경계가 본문에
   없어 "완전 폐쇄" 로 오독됐다(`18_24_31` rationale_continuity WARNING). 이번 변경으로
   **UI + 재제출 API 경로 둘 다** 닫히므로, 남는 경계는 *"webhook/schedule 경로는 대상이
   아니다"* 로 바뀐다.
2. **`3-error-handling.md` §1.7 주석** — `details[].code` 목록에 `MASKED_VALUE_RESUBMITTED`
   등재(정의 SoT 는 §R17). **그리고 scope 주석에 re-run(`INVALID_INPUT`)을 세 번째 소비처로
   추가** — 현재는 execute/save·webhook 만 열거해 re-run 이 빠져 있다.
3. **`13-replay-rerun.md` §8.1** — `INVALID_INPUT` 행(246행)에 *"`details[]` 는 §1.7 카탈로그를
   따른다"* 를 명문화. 지금은 `details[]` 언급이 아예 없어, 위 배선 결함이 문서상으로도
   드러나지 않는다.
4. **`13-replay-rerun.md` §10.2** — 차단이 클라이언트 전용이라는 전제를 갱신. 서버가 2층으로
   막으므로 UI 우회 시에도 오염이 실제로 일어나지 않는다.

5. **`4-nodes/7-trigger/1-manual-trigger.md` §6** — 두 곳이 **내 변경으로 stale 이 된다**
   (`19_48_56` WARNING-1). (a) reason 표(162~172행)에 `masked_value_resubmitted` 행 추가 —
   시점은 `adapter resolveTriggerParameters` **직후**(Manual 실행경로·Manual re-run 한정).
   (b) "응답 봉투" 문장(184행)이 *"Manual·Webhook 경로"* 만 열거하는데, 지금은 **정확한
   서술**이다(re-run 이 실제로 `details` 를 안 싣는다). 배선을 고치면 거짓이 되므로
   *"Manual·Webhook·Manual re-run 경로"* 로 함께 갱신한다.

   > 이 문서는 이미 어댑터 표에 *"Manual re-run (inputOverride) | `INVALID_INPUT`"* 을 갖고
   > 있으면서 봉투 문장에서만 뺐다 — 즉 **문서가 코드의 결함을 정확히 반영**하고 있었다.
   > 고치는 쪽이 문서를 따라가야 한다.

6. **`1-data-model.md` §2.13** · **`3-workflow-editor/3-execution.md` §2.2** — 두 문서가
   "닫는 조건" 의 방어를 **프런트 가드만으로** 서술한다(`19_48_56` WARNING-2). §R17 표에
   서버측 행이 생기면 이 둘만 1층 서술로 남아 어긋난다. *"서버가 2차로도 거부한다"* 한 줄
   또는 §R17 cross-ref 갱신.

7. **`12-webhook.md` §5.2** — **반영 중 자매 스윕으로 찾았다**(게이트 지적 아님). 이 절이
   *"3종 카탈로그 등재"* 라고 **개수를 세고**, 헬퍼의 내부→공개 매핑 셋을 나열한다. 넷째가
   생기면 둘 다 stale 이다. 다만 webhook 은 **대상이 아니므로**, 이 문서가 이미 `INVALID_SCHEMA`
   에 쓰던 패턴(*"헬퍼는 매핑하나 이 경로에서는 발생하지 않는다"*)을 그대로 따라 적었다.

   > 개수를 세는 문장은 전수 grep 으로 확인했다 — spec 전체에서 이 한 곳뿐이었다.

**(선택) 8. `3-error-handling.md` §1.3** — `INVALID_INPUT`(400) 행 추가. 이 코드가 §1 공용
카탈로그에 미등재이고 `13-replay-rerun.md §8.1` 에만 있다 — 같은 문서 Rationale 이 지켜 온
"§1 카탈로그 완결성" 관행과 어긋난다(`19_34_37` cross_spec INFO). §1.7 을 손대는 김에 닫는다.
등재 시 *"`RERUN_` prefix 미부여는 §2 rename-stability 상 유지"* 각주를 달아 반복 지적을
예방한다(`19_48_56` convention INFO-2).

## Rationale

**왜 공유 함수 안이 아니라 호출부인가**: `resolveTriggerParameters` 는 재제출·수신 네 경로가
공유한다. 거부는 *"되돌아온 값"* 이라는 **출처**의 성질이지 값 자체의 성질이 아니므로, 출처를
아는 호출부가 판정 지점이다. 함수 안에 넣고 플래그로 끄는 안은 기본값이 어느 쪽이든 한쪽이
조용히 틀린다.

**왜 `INVALID_INPUT` 같은 일반 코드가 아닌가**: 사용자가 취할 행동이 특정된다 — 그 필드를
다시 입력하라. 일반 코드는 그 안내를 못 싣는다. 반대로 코드를 새로 만들면 카탈로그가 자라는
비용이 있는데, `details[].code` 는 이미 세 항이 있는 확장 지점이라 신규 표면이 아니다.

**기각한 대안 — `coerce_failed` 재사용**: `17_38_33` **한 라운드에서 두 reviewer**
(security·api_contract)가 *"기존 `coerce_failed` 류 코드 재사용"* 을 제안했다. 그게 spec
작업을 아끼는 길이었지만 기각한다.

> 초안은 이를 *"세 라운드에 걸쳐"* 라고 적었는데 **실측하니 틀렸다**(`19_34_37`
> rationale_continuity W2). **서버측 거부 여부 자체**를 세 라운드 유예해 온 이력과, **코드
> 재사용 제안**이 나온 한 라운드를 뒤섞은 것이다. 앞선 라운드들(`15_59_17` 등)의
> `coerce_failed` 언급은 *"이미 존재하는 2차 방어"* 라는 관찰이지 제안이 아니었다. #1188 에서 무효 JSON 이 `coerce_failed`
로 거부될 때 **사용자가 "마커를 채우라" 대신 일반 오류 토스트를 본** 것이 정확히 이 문제였다.
같은 실수를 서버 계약에 굳히지 않는다.

**기각한 대안 — 부분 포함 매칭**: `a***b` 같은 정상 값을 막는다. 프런트가 같은 이유로 정확
일치를 택했고(`12_08_46` W2), 두 층이 다른 경계를 쓰면 한쪽만 통과하는 값이 생긴다.
