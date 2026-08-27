---
title: "config echo 마스킹을 어댑터에서 출구로 — 표현식이 읽는 값을 되살린다 (C2 (a))"
status: complete
worktree: masking-residuals-0b195b
started: 2026-08-24
completed: 2026-08-27
owner: developer
spec_impact:
  # `19_26_06` CRITICAL — 이 변경이 **보안 설계 Rationale 을 무효화**한다. 내가 쓴 예고가
  # 아니므로 자기-반증형 소정정 대상이 아니고, 이 PR 안에서 **planner 턴**으로 처리한다.
  - spec/2-navigation/14-execution-history.md      # R-5: "저장 시점에 이미 마스킹" → 무효
  - spec/4-nodes/3-ai/1-ai-agent.md                # "adaptHandlerReturn boundary" 서술
  - spec/3-workflow-editor/4-ai-assistant.md       # "노드 config echo boundary" 소비처 열거
  - spec/5-system/4-execution-engine.md            # config 가 storage-time 마스킹 없음을 명문화
  - spec/conventions/node-output.md                # Principle 7 인접: config 도 egress-only
  - spec/conventions/egress-masking.md             # §1 좌표계 표에서 어댑터 행 처분
---

# C2 (a) — 표현식 경로만 마스킹에서 제외

정본 트래커의 항목 *"`DEFAULT_SENSITIVE_KEYS` 의 실질 위험은 정적 grep 으로 못 닫는다"*
(2026-08-23 등재, `17_14_18` side_effect W1)이 지정한 **재개 신호가 발화**했다.

## 재개 신호가 발화했다 (실측)

그 항목의 재개 조건은 *"config echo 를 다운스트림 표현식이 **실제로 읽는 사례**가 확인될 때"*
였다. 확인됐고, 가장 강한 형태다:

| 근거 | 위치 |
| --- | --- |
| 표현식 컨텍스트가 `config` 를 노출한다 | `expression-resolver.service.ts:60` — `config: adapted.config ?? {}` |
| **저장소가 사용자 표현식을 그 패턴으로 이주시킨다** | `scripts/migrate-node-output-refs.ts` — *"`$node["<Label>"].config.<field>` 로 재작성"* |

즉 경로가 있는 정도가 아니라 **사용자를 그 패턴으로 옮기고 있다.** 그런데 어댑터
(`handler-output.adapter.ts:36`)가 `maskSensitiveFields(r.config)` 를 걸어, 그 표현식들이
**마스킹된 값**을 읽는다. `apiKey` 같은 이름의 config 필드를 다운스트림에서 참조하면
리터럴 `****abcd` 가 흘러간다 — 가시성 저하가 아니라 **기능 오염**이다.

## 안전성은 **키 집합 포함관계**에 걸려 있다

어댑터의 마스킹을 걷어내도 되는 이유는 **출구가 이미 각자 마스킹하기 때문**이다:

| 출구 | 마스커 | 확인 |
| --- | --- | --- |
| WS emit | `maskWireEnvelope` → `deepRedactSecretsPreserving` | `websocket.service.ts:334`·`:408` — **모든** emit 이 지난다 |
| REST 응답 | `redactStoredDataForResponse` → `deepRedactSecrets` | `redact-stored-error.ts:107-108` |
| DB | **원문 보존** | EIA §R17 의 egress-only 원칙 |

**다만 두 마스커는 키 집합이 다르다.** 어댑터는 `DEFAULT_SENSITIVE_KEYS`(키 이름 목록),
출구는 `CREDENTIAL_KEY_PATTERN`(정규식). 걷어낸 뒤 **차집합이 생기면 그게 유출**이다.

> **이 PR 의 안전성이 그 포함관계 하나에 걸려 있으므로, 눈으로 읽지 않고 정본 구현을 실행해
> 확인하고 그 불변식을 테스트로 못박는다.** 목록이 나중에 넓어져도 테스트가 잡는다.

## 왜 "출구로 옮긴다" 가 아니라 "어댑터에서 뺀다" 인가

출구는 **이미** 마스킹하고 있다. 새로 걸 것이 없다 — 어댑터의 것은 **중복**이었다.
그래서 이 작업은 *"마스킹을 옮기는 리팩터"* 가 아니라 *"중복 한 겹을 걷어내는 것"* 이고,
이 저장소가 반복해 겪은 **"출구 중 하나를 빠뜨린다"** 위험이 원리적으로 없다.

## 착수 전 측정 — 전제는 섰고, 게이트가 두 가지를 고쳐 줬다

### ① 포함관계 확인 (go/no-go) — **성립한다**

`DEFAULT_SENSITIVE_KEYS` 전 키를 **정본 `deepRedactSecrets` 에 실제로 통과**시켜
전부 마스킹됨을 확인했다. `[...DEFAULT_SENSITIVE_KEYS]` 를 **직접 순회**하므로 목록이
넓어져도 새 키가 자동으로 검사된다.

> **⚠️ 두 번 틀렸고 둘 다 리뷰가 잡았다.**
>
> **(1) 측정하지 않고 측정했다고 적었다.** 초판의 *"18 passed"* 는 **기존 테스트 수**다 —
> 캐너리를 쓰는 스크립트가 rate limit 으로 실행되지 않은 상태에서 jest 결과만 보고 내
> 것으로 읽었다.
>
> **(2) 파생이 아니었다.** 다시 쓴 캐너리도 키를 **손으로 나열**하고
> `Object.keys(maskSensitiveFields({...}))` 로 감쌌는데, 그 함수는 키를 **드롭하지
> 않으므로** 입력 리터럴을 그대로 돌려줄 뿐 `DEFAULT_SENSITIVE_KEYS` 와 **무관**했다.
> `10_53_52` 리뷰의 두 reviewer 가 각자 실증했다 — egress 가 못 잡는 가상 키를 목록에
> 넣어도 **전 스위트 GREEN**. 이 PR 의 안전 주장 전체가 그 캐너리에 걸려 있었으므로
> **가장 나쁜 종류의 오류**다.
>
> 상수를 export 해 진짜 파생으로 고쳤고, **그 실패 모드를 재현해 검증**했다 —
> `oauthCred` 를 넣으니 케이스가 41→42로 늘고 **새 키가 RED**(M4).

### ② `19_26_06` plan W6 정정 — 중복 선언은 **이 경로 위에 있지 않다**

지적: *"`CREDENTIAL_KEY_PATTERN` 이 REST 와 WS 에 독립적으로 두 번 선언됐고 오늘도 다르다
(REST 만 `x[_-]api[_-]?key`). 포함관계를 단수로 서술하면 '동명이인 상수' 실수를 재현한다."*

**중복과 차이는 사실이다.** 다만 실측하니 **config echo 경로는 그 중복 위를 지나지 않는다**:

| 경로 | 마스커 |
| --- | --- |
| WS 전 emit(`maskWireEnvelope`) | **공유** `deepRedactSecretsPreserving` (`sanitize-error-message.ts`) |
| REST(`redactStoredDataForResponse`) | **공유** `deepRedactSecrets` (같은 파일) |
| `websocket.service.ts` 의 **로컬** 패턴 | `sanitizePayloadForWs` → `ctx.chatChannel` **라우팅 컨텍스트 전용** |

즉 config echo 는 두 출구 모두 **같은 공유 마스커**를 지나므로 포함관계 단언은 하나로 충분하다.

> **그래도 지적이 진짜를 하나 드러냈다** — 로컬 패턴이 공유본보다 **좁다**(`x-api-key` 없음).
> `chatChannel` 라우팅 컨텍스트만 그 좁은 마스커를 받는다. 이 PR 의 범위는 아니라 **별건으로
> 등재**한다.

## 이 변경은 **DB 저장을 원문으로 바꾼다** (별도 결정, `19_26_06` rationale W3)

표제가 *"표현식 경로만 제외"* 라 좁게 읽히는데, 어댑터를 걷어내면 **DB 에 저장되는 config 도
원문**이 된다. 그 자체가 결정이므로 따로 적는다.

**근거**: EIA §R17 이 세운 **egress-only 원칙**과 같은 방향이다 — DB 는 원문을 보존하고
나가는 자리에서 가린다(서버 로그·사후 디버깅의 진실 유지). `Execution.error`·`outputData` 가
이미 그렇게 하고 있고, config 만 storage-time 마스킹으로 예외였다. **이 PR 은 그 예외를
없애 원칙과 정렬한다.**

**대가**: DB 를 직접 읽는 사람은 원문을 본다. 그건 §R17 이 이미 수용한 trade-off 다.

## 작업

- [x] `/consistency-check --impl-prep` — `19_26_06` **BLOCK: YES**(보안 Rationale 무효화)
      → `RESOLUTION.md`. `spec_impact` 를 6건으로 확장.
- [x] **포함관계 캐너리** — 정본 `deepRedactSecrets` 실행으로 확인. `10_53_52` CRITICAL 로
      **두 번 정정**(측정 미실행 · 파생 아님) 후 상수 export + 실패 모드 재현 검증(M4).
- [x] 어댑터에서 `maskSensitiveFields(config)` 제거 + 왜 안전한지 주석
- [x] 캐너리 — 어댑터 원문 6건 · **egress 대조군**(같은 파일에서 마스킹 확인) · 비-문자열
- [x] 뮤테이션 3건 — **M1·M3 예측 일치, M2 는 예측이 어긋났고 그게 더 유익했다**
- [x] (planner 턴) **6개 spec** + `10_53_52` 로 stale 인용 4곳 추가 정정
- [x] 자매 트래커 2건 종결 — 하나는 **전제가 바뀌어 대상 소멸**
- [x] `chatChannel` 로컬 마스커 별건 등재 + 자격증명 참조 간접화 등재
- [x] TEST WORKFLOW 4단계 + ratchet — backend **9,023 passed** / 433 suites · e2e 285 ·
      199/38 일치. ⚠️ 이 수는 **PR 이 닫히는 시점의 값**이라 리뷰 라운드마다 갱신한다
      (`12_00_05` INFO 11 — 9,018 로 적어 둔 사이 후속 커밋이 2건을 더했다).
- [x] `/ai-review` — **5라운드 수렴**. `10_53_52`(CRITICAL 1) → `11_25_15`(W4) →
      `12_00_05`(W6) → `12_28_26`(W2, 신규 1) → `12_52_43` **CRITICAL 0 · WARNING 0**.
      1~4 라운드는 RESOLUTION.md 동봉, 5라운드는 clean 이라 불요.
      > 라운드마다 반증된 것이 **직전 라운드에서 내가 쓴 수정**이었다 — 캐너리가
      > 아무것도 안 보던 것(R1) · 정정문의 논리 오류(R2) · vacuous 단언(R3) ·
      > 덮지 않는 캐너리를 근거로 인용한 JSDoc(R4). 5라운드에서 리뷰어가 M6 을
      > 독립 재현해 *"직전 라운드엔 동일 뮤테이션이 66/66 GREEN 이었다"* 까지 확인.

## 뮤테이션 (예측을 실행 전에 쓰고 실측과 두 칸으로 대조)

| # | 뮤턴트 | 예측 | 실측 |
|---|---|---|---|
| M1 | 어댑터에 `maskSensitiveFields(config)` 되돌리기 | 원문 캐너리 **7건** RED, egress 대조군은 GREEN | ✅ **7 failed / 34 passed** — 정확히 그 7건 |
| M2 | `DEFAULT_SENSITIVE_KEYS` 에서 `idToken` 제거 | 포함관계 캐너리가 **케이스를 잃어** 조용히 통과할 위험 | ⚠️ **1 failed / 40 passed** — 잡은 건 기존 명시 테스트. ~~내 캐너리는 예상대로 조용히 줄었다~~ **이 해석이 틀렸다**(`10_53_52`): 캐너리 케이스 수는 22로 **불변**이었다 — 파생이 아니라 손 나열이었으므로 목록 변화에 **아예 반응하지 않았다** |
| M4 | (재작성 후) egress 가 못 잡는 키 `oauthCred` 를 목록에 추가 | 진짜 파생이면 케이스가 늘고 **그 키가 RED** | ✅ **1 failed / 41 passed (42 총)** — 리뷰어가 GREEN 으로 통과시켰던 뮤턴트를 이제 문다 |
| M3 | `CREDENTIAL_KEY_PATTERN` 에서 `[a-z0-9_-]*token` 제거 | 포함관계 캐너리 token 계열 다수 RED | ✅ **13 failed / 28 passed** |

### M2 를 내가 잘못 읽었다 — 파생이라고 믿은 것이 파생이 아니었다

포함관계 캐너리는 `DEFAULT_SENSITIVE_KEYS` 에서 케이스를 **파생**한다. 그래서 목록이 줄면
케이스도 함께 줄어 **조용히 통과**한다(41 → 40). `#1205` 에서 겪은 것과 같은 형태다.

**그런데 이번엔 결함이 아니다.** 이 캐너리의 계약은 *"목록에 있는 키는 egress 도 덮는가"*
이고, 키가 목록을 떠나면 그 키에 대한 포함관계는 **공허하게 참**이라 검사를 멈추는 것이 맞다.
목록 **멤버십**은 다른 가드가 지킨다 — 실제로 M2 를 잡은 것이 그 **기존 명시 키 테스트**다.

즉 두 가드가 서로 다른 방향을 본다:

| 가드 | 무엇을 지키나 | M2 에서 |
|---|---|---|
| 기존 명시 키 테스트 | 목록 **멤버십**(이 키가 목록에 있는가) | **RED** |
| 신규 포함관계 캐너리 | **포함관계**(목록 ⊆ egress 키 축) | 케이스 소실(정상) |

**그런데 그 해석조차 틀렸다.** 캐너리는 *"케이스를 잃은"* 것이 아니라 **애초에 목록을 보고
있지 않았다** — 손으로 나열한 리터럴을 순회했으니 목록이 줄든 늘든 22로 고정이었다.
`10_53_52` 의 두 reviewer 가 각자 뮤테이션을 재현해 그것을 밝혔다.

**교훈은 더 날카롭다**: 나는 M2 를 돌리고 *"파생 fixture 의 한계를 확인했다"* 는 **그럴듯한
설명**을 붙였다. 실측 숫자(41→40)는 맞았지만 **원인 해석이 틀렸고**, 그 틀린 해석이 진짜
결함(파생이 아예 없음)을 **덮었다**. 뮤테이션을 돌리는 것만으로는 부족하고, **관측된 숫자가
내 가설로만 설명되는지**를 물어야 했다 — 여기서는 "케이스가 줄었다" 를 확인하지 않고 믿었다.

## 검증 기준

- **포함관계가 깨지면 이 PR 은 성립하지 않는다.** 캐너리가 RED 면 되돌리고 다른 설계로 간다.
- **뮤테이션은 출구별로**: WS 마스킹 제거 → WS 캐너리만 RED, REST 제거 → REST 캐너리만 RED.
  둘이 함께 죽으면 캐너리가 출구를 안 가르고 있다는 뜻이다.
- 뮤테이션은 **커밋 후** `cp` 백업으로. `git checkout`/`reset --hard` 금지.
