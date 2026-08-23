---
title: "workflow-assistant LLM 도구의 약한 마스킹 — 유출 차단 우선으로 닫는다"
status: in-progress
worktree: assistant-mask-leak-e36aa6
started: 2026-08-23
owner: developer
spec_impact:
  - spec/3-workflow-editor/4-ai-assistant.md
  - spec/5-system/14-external-interaction-api.md
---

# workflow-assistant 마스킹 — 두 축을 닫는다

정본 트래커
[`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
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
- [ ] `explore-tools.service.ts` — 세 필드 triple 을 헬퍼로 묶고 `deepRedactSecrets` 중첩
- [ ] `DEFAULT_SENSITIVE_KEYS` 에 token 계열 추가 (자매 표면 키 축)
- [ ] 단언 6개 갱신 + **두 갭 캐너리** 신설
- [ ] 자매의 값 축 잔여를 트래커에 등재
- [ ] 뮤테이션 검증
- [ ] TEST WORKFLOW 4단계 + ratchet
- [ ] `/ai-review`

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
