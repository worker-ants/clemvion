---
title: "workflow-assistant LLM 도구의 약한 마스킹 — 유출 차단 우선으로 닫는다"
status: complete
worktree: assistant-mask-leak-e36aa6
started: 2026-08-23
completed: 2026-08-23
owner: developer
spec_impact:
  - spec/3-workflow-editor/4-ai-assistant.md
  - spec/5-system/14-external-interaction-api.md
---

# workflow-assistant 마스킹 — 두 축을 닫는다

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](../in-progress/spec-sync-external-interaction-api-gaps.md)
의 항목 *"workflow-assistant LLM 도구가 `inputData`·`outputData`·`error` 세 필드를 더 약한
마스킹으로 내보낸다"* (2026-08-16 등재, `17_12_34` requirement W1).

**사용자 결정 (2026-08-23): 유출 차단이 우선** — `****<last4>` 의 식별 힌트를 잃더라도
값-패턴 마스킹을 적용한다.

## 무수정 프로브로 두 갭을 실증했다

고치기 전에 현행을 그대로 돌렸다:

```
값축 → {"message":"auth failed: Bearer sk-live-abc123def456"}
URI  → {"message":"connect failed: postgres://u:pw@db.internal/prod"}
키축 → {"token":"****1111","csrf_token":"BBBB2222","auth_token":"CCCC3333",
        "session_token":"DDDD4444","csrfToken":"EEEE5555"}
```

- **값 축**: `Bearer …`·자격증명 URI 가 **완전 통과**. `maskSensitiveFields` 는
  `typeof value !== 'object'` 면 그대로 반환하므로 문자열 **안**은 아예 안 본다.
- **키 축**: bare `token` 만 잡히고 `csrf_token`·`auth_token`·`session_token`·`csrfToken`
  은 **평문 그대로**.

## 실측이 트래커의 예상을 바꿨다 — 목록을 넓힐 필요가 없다

트래커는 `DEFAULT_SENSITIVE_KEYS` 를 계열째 넓히는 것을 잔여 작업으로 적어 뒀다. 그런데
`deepRedactSecrets` 를 겹쳐 실행해 보니 **두 축이 한 번에 닫힌다**:

```
P2값  → {"message":"auth failed: ***"}
P2URI → {"message":"connect failed: postgres://***@db.internal/prod"}
P2키  → {"token":"***","csrf_token":"***","auth_token":"***",
         "session_token":"***","csrfToken":"***"}
```

`CREDENTIAL_KEY_PATTERN` 의 `[a-z0-9_-]*token` 이 (`/i` 플래그라 camelCase 포함) 계열을
이미 잡는다. 즉 이 표면에서는 **목록 확장이 불요**하다 — 정규식을 읽고 판단한 게 아니라
겹쳐서 돌려 본 결과다.

## 표면별로 강도를 나눈다 (같은 결정, 다른 위험)

| 표면 | 무엇을 내보내나 | 처분 |
| --- | --- | --- |
| `explore-tools.service.ts` (6곳) | LLM 도구가 읽는 실행 기록 | **값+키 축 전면** — `deepRedactSecrets` 중첩 |
| `handler-output.adapter.ts` (1곳) | 노드 `config` echo → **DB 저장·WS emit·표현식** | **키 축만** — 목록에 token 계열 추가 |

자매를 그냥 두면 이 저장소에서 내가 반복한 *"방어를 한 칸 좁게 잡는다"* 가 된다. 그러나
값 축까지 겹치면 **저장되는 값과 표현식이 읽는 값**이 바뀌어 정상 워크플로를 깨뜨릴 수 있다.
그래서 자매에는 위험이 없는 절반(키 축)만 적용하고, 값 축은 별건으로 등재한다.

## 기존 단언 6개가 바뀐다 — 결정이 인가한 변경

`explore-tools.service.spec.ts:515-523` 이 `****1234`·`****0001`·`****9999`·`****`·
`****2345`·`****9876` 을 고정한다. 겹치면 전부 `***` 가 된다(실측).

**키 이름은 출력에 그대로 남는다**(`apiKey: "***"`) — 어떤 키가 가려졌는지는 여전히 알 수
있고, 잃는 것은 값의 마지막 4자다. 그게 사용자가 고른 트레이드다.

## 작업

- [x] `/consistency-check --impl-prep` — **BLOCK: YES** (`16_09_25`). 아래 §차단 참조
- [x] `explore-tools.service.ts` — 세 필드 triple 을 헬퍼로 묶고 `deepRedactSecrets` 중첩
- [x] `DEFAULT_SENSITIVE_KEYS` 에 token 계열 8개 추가 (자매 표면 키 축)
- [x] 단언 6개 갱신 + 두 갭 캐너리 + **유틸 레벨 캐너리 9건**(아래 §뮤테이션 참조)
- [x] 자매의 값 축 잔여를 트래커에 **별도 체크박스**로 등재
- [x] 뮤테이션 검증 — M2 가 **가드 부재를 드러냈다**(아래)
- [x] TEST WORKFLOW 4단계 전부 PASS + ratchet 199건 baseline 일치
- [x] `/ai-review` — `16_46_56` CRITICAL 0 · WARNING 4 → **전부 반영** (RESOLUTION.md)

## 검증 기준

- **캐너리**: 프로브가 보여준 두 형태(`Bearer …` in message · `csrf_token` 평문)를 테스트로
  고정한다. 이게 없으면 다음 사람이 같은 갭을 다시 발견한다.
- **뮤테이션**:
  - M1 `deepRedactSecrets` 중첩 제거 → 값 축 캐너리 RED 여야
  - M2 token 계열을 목록에서 뺀다 → 자매 표면 캐너리 RED 여야
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.

## ⛔ `--impl-prep` 이 BLOCK: YES — `spec_impact: none` 이 틀렸다

checker 5명 중 4명이 같은 것을 지적했고(cross_spec 이 CRITICAL 로 통합), **실측으로
확인했다**:

**`spec/3-workflow-editor/4-ai-assistant.md:259` §4.1.1 (요구사항 `ED-AI-37` 정본)**

> *"`maskSensitiveFields` 공통 유틸을 재귀 적용해 반환한다. 매칭 키(대소문자 무시):
> `apiKey`, `api_key`, `password`, `token`, `accessToken`, `refreshToken`, `secret`,
> `clientSecret`, `authorization`. 매칭된 값이 문자열이면 `"****<last4>"` 로 …"*

spec 이 **유틸·키 목록·포맷 셋 다** 못박고 있고 내 변경은 셋 다 깬다.

**`spec/5-system/14-external-interaction-api.md:1652-1658` §R17 잔여 ③**

> *"여기에 값-패턴 마스킹을 **단순 합성하면 안 된다** … 어느 의미가 우선하는지는 **별도
> 결정**이라 분리했다."*

사용자 결정(유출 차단 우선)이 이 열린 항목을 정당하게 닫는다. 그러나 **닫았다는 사실을
spec 본문에 되반영하는 것은 planner 권한**이다.

### 이 PR 의 예외(#1203)는 여기 적용되지 않는다

방금 명문화한 narrow 예외는 *"developer 가 자기가 쓴 **예고** 문장을 실측으로 반증하는"*
경우다. 여기는 **제품 서술**(요구사항 `ED-AI-37` 의 출력 포맷)을 사용자 결정에 따라 바꾸는
것이라 조건 2 를 충족하지 못한다. 예외를 좁게 쓴 것이 바로 이 구분을 위해서였다.

### 처분 — 우회하지 않고 planner 턴을 앞에 둔다

~~코드는 이 브랜치에 보존하고, **spec 동기화를 별도 planner PR 로 먼저** 올린다.~~
→ **뒤집었다 (같은 턴 안에서).** §4.1.1 이 출력 포맷을 **리터럴로** 못박기 때문에, spec 만
먼저 머지되면 *"spec 은 `***`, 코드는 `****1234`"* 라는 **실시간 spec-impl drift** 가 생긴다.
이 저장소가 `/spec-coverage` 로 감시하며 반복해서 비용을 치른 바로 그 형태다.

**같은 PR 안에서 planner 턴을 앞에 두고 원자적으로** 간다 — 역할 분리는 PR 경계가 아니라
**게이트**로 지킨다(spec 쓰기 직전 `--spec`, 구현 후 `--impl-done`).
planner draft: [`spec-update-assistant-masking.md`](./spec-update-assistant-masking.md).

## 뮤테이션 — M2 가 **가드가 없다는 사실**을 드러냈다

예측을 먼저 적고 돌렸다.

| 뮤턴트 | 예측 | 실측 |
| --- | --- | --- |
| **M1** `deepRedactSecrets` 중첩 제거 | 값 축 캐너리 RED | **RED 3건** (값 축·키 축 캐너리 + 포맷 단언) |
| **M2** `DEFAULT_SENSITIVE_KEYS` 에서 token 계열 8개 제거 | explore-tools 는 GREEN 유지 | **GREEN 27/27** — 예측대로 |

M2 가 GREEN 인 건 겹친 층이 같은 키를 덮기 때문이고 그 자체는 정상이다. **그런데 그게
곧 "공유 목록에 키 8개를 넣었는데 그걸 지키는 테스트가 하나도 없다" 는 뜻이었다.**
자매(`handler-output.adapter.ts`)는 값 축을 안 겹치므로 그 목록이 **유일한 방어**인데,
목록에서 항목을 빼도 전 스위트가 초록이었다.

→ **유틸 레벨에 캐너리 9건 신설**(`it.each` 8 + 완전 일치 대조군 1). 다시 M2 를 걸었더니
**8건 RED**. 목록 확장이 이제 기계로 고정된다.

대조군 1건(`tokenCount` 는 안 가린다)은 이 목록이 **부분 문자열이 아니라 완전 일치**라는
성질을 못박는다 — 넓히다 그 성질을 잃으면 그 자리가 RED 가 된다.

## 게이트·수치

- **TEST WORKFLOW**: lint · unit(backend 8,931 → **8,950**) · build ·
  e2e(285 + **Playwright 51**, 로그 직접 확인) 전부 PASS — 리뷰 fix 후 재수행분
- **ratchet**: 199건 / 38파일 — baseline 일치
- `--impl-prep` `16_09_25` BLOCK:YES → planner 턴 → `--spec` `16_21_45` BLOCK:NO

## `/ai-review` 처분 (`16_46_56` — CRITICAL 0 · WARNING 4 · MEDIUM)

전문은 [`RESOLUTION.md`](../../review/code/2026/08/23/16_46_56/RESOLUTION.md). 요지:

**W1 이 내 plan 의 틀린 지점을 짚었다.** 자매 표면의 키 축을 *"위험 없는 절반"* 이라
적었는데 **그건 측정이 아니라 단정**이었다. 실측하니 노드 config 필드명 **충돌 0건** —
유일한 정확 일치(`http-request.handler.ts` 의 `auth_token`)는 **URL 쿼리파라미터** 블랙리스트라
목적이 다르고, `oauth_token_exchange_failed` 류는 부분 문자열인데 이 목록은 완전 일치라 안
걸린다. 리뷰어가 제안한 목록 분리는 **하지 않았다** — 같은 규칙을 두 목록에 손으로
동기화하는 상태가 되고, 그건 이 세션이 #1202 부터 없애 온 형태다. 실측을 코드 옆에 남겼다.

**W2 는 뮤테이션이 이미 보여준 것을 확인했다** — 목록에서 8개를 빼도 assistant 쪽은 GREEN
이라 그 목록의 유일한 실사용처가 자기 테스트로 보호되지 않았다. 자매 spec 에 캐너리 5건 +
대조군 1건을 넣고, M2 재적용 시 **자매 spec 단독 5건 RED** 를 확인했다.

**W3·W4** 는 각각 내가 만든 가독성 결함(헬퍼가 클래스 JSDoc 과 선언 사이에 낌)과 CHANGELOG
누락이라 그대로 반영했다.

## `/ai-review` 2라운드 (`17_14_18` — CRITICAL 0 · WARNING 1) — 내 실측이 프록시였다

3/4 reviewer 가 1라운드 WARNING 해소를 **뮤테이션 재현으로 직접 확인**했다. 남은 1건이
내 측정의 사각지대를 정확히 짚었다:

> 정적 grep 은 **스키마 필드명**만 본다. HTTP Request · Send Email 노드의 `headers`/`body`
> 는 **사용자가 키 이름을 직접 정한다** — 정적 분석으로 원리적으로 안 보인다.

**맞다.** 1라운드에서 "단정" 을 "실측" 으로 바꿨는데, 그 실측의 **축이 프록시**였다.
사용자가 `headers.id_token` 을 쓰면 그 값이 config echo 에서 가려진다.

**처분** — 위험을 재평가하되 없는 척하지 않는다:

- 방향이 **과잉 마스킹(안전 쪽)** 이라 유출이 아니라 표시 문제다.
- 이 노출은 **신규가 아니다** — 이미 목록에 있던 `token`·`access_token`·`authorization`·
  `apiKey` 가 같은 성질을 갖는다. 이번 확장은 접두형으로 넓혔을 뿐 **새 클래스를 만들지
  않았다**.
- 그래서 되돌리지 않고 **한계를 코드 주석과 트래커에 명시**했다. 트래커 항목에 **재개
  신호**(사용자 신고 · config echo 를 표현식이 실제로 읽는 사례 확인)와 그때의 조치 순서
  ((a) 표현식 경로 제외 먼저, (b) 목록 분리는 손 동기화 비용 때문에 나중)를 적었다.

INFO #3(자매 spec 5종 vs 유틸 spec 8종 비대칭)도 **8종으로 맞췄다** — M2 재적용 시 자매
spec 단독 **8건 RED**(5 → 8).
