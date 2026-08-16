---
worktree: eia-followups-1464c0
started: 2026-08-16
owner: developer
branch: claude/eia-followups-1464c0
status: in-progress
priority: P1
pending_plans:
  - plan/in-progress/spec-sync-external-interaction-api-gaps.md
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/conventions/secret-store.md
  - spec/2-navigation/14-execution-history.md
  - spec/5-system/6-websocket-protocol.md
  - spec/4-nodes/1-logic/12-background.md
  - spec/1-data-model.md
---

# 같은 `Execution.error` 를 표면마다 다르게 말한다 — 내부 경로에도 egress 마스킹

## 다른 plan 과의 관계

정본 트래커는 [`spec-sync-external-interaction-api-gaps.md`](./spec-sync-external-interaction-api-gaps.md)
이고, 이 작업은 그 문서의 **I1**(*"내부 REST 와 WS 가 같은 `Execution.error` 에 다른 값을
말한다"*, 2026-08-16 등재) 과 **D**(`interaction.triggerToken`) 두 미결 항목을 집행한다.
둘 다 *"택일해서 근거를 남긴다"* 로 등재돼 있었고, **사용자가 2026-08-16 에 택일했다**:

| 항목 | 결정 | 근거 |
|---|---|---|
| I1 | **내부 경로에도 마스킹** | 아래 §근거 |
| D | **`secret-store.md` 에 명시 예외 등재** (이관 아님) | 아래 §D |

> **직전 세션은 이 I1 을 근거 없이 한쪽으로 닫으려다 `--spec` 에서 CRITICAL 을 맞았다.**
> 그래서 이번엔 결정을 사용자에게 올렸고, 올리기 전에 아래 실측을 먼저 세웠다.

## 근거 — "내부라서 원문이어도 된다" 가 왜 성립하지 않나

전부 실측이다.

| 사실 | 실측 위치 |
|---|---|
| `GET /api/executions/:id` 에 `@Roles` 게이트가 **없다** → viewer 포함 워크스페이스 전원 | `executions.controller.ts:63` |
| 응답이 `Execution.error` **원문**을 싣는다 | `executions.service.ts:862` 외 (§표면 전수) |
| 프런트가 실패 배너에 `error.message` 를 **그대로 렌더**한다 | `executions/[executionId]/page.tsx:393` |
| #1177 이후 WS/SSE/webhook 종결 이벤트는 **마스킹**된다 | `terminal-error-payload.ts` |

`spec/2-navigation/14-execution-history.md` **R-5** 는 이 엔드포인트의 안전성이 *"롤 게이팅이
아니라 서버 boundary masking parity 에 의존"* 한다고 규정한다.

> **R-5 를 과대인용하지 않는다.** R-5 의 대상은 **Config 탭**(노드 config echo)이고, 그건
> `handler-output.adapter.ts` 의 `maskSensitiveFields` 로 **write 시점에** 이미 마스킹된다.
> 즉 R-5 는 `Execution.error` 를 **이미 덮고 있지 않다** — R-5 가 주는 것은 *원칙*이지
> 이 필드에 대한 기존 판정이 아니다. 그 구분을 안 하면 "이미 규정돼 있었다" 는 거짓 서술이 된다.

선례도 같은 방향이다 — §R17 의 `execution.ai_message` 불릿은 **내부 WS·Chat Channel 도
마스킹**을 수용된 trade-off 로 이미 택했다.

## 표면 전수 — 한 곳만 고치면 이 저장소의 반복 실패다

정본 트래커의 I1 항목은 `executions.service.ts:862` **한 줄만** 지목했다. 실측하니
**그 줄은 목록 경로 전용**이고 상세 경로는 다른 함수였다. 전수:

| # | 표면 | 진입점 | `Execution.error` 를 싣는 자리 |
|---|---|---|---|
| 1 | `GET /executions/:id` | `findById` | 엔티티 spread (`:615`) |
| 2 | `POST /executions/:id/re-run` | `reRun` | **`findById` 재사용** (`:465`) → ①이 덮는다 |
| 3 | `GET /executions/workflow/:workflowId` | `findByWorkflow` → `toExecutionDto` | `:862` |
| 4 | `GET /executions/:id/chain` | `getChain` | `stripPrivateRelations` 엔티티 (`:536`) |
| 5 | `POST /executions/:id/stop` | `stop` | 엔티티 반환 (`:748`) |
| 6 | **WS `execution.snapshot`** | `websocket.gateway.ts:399` → `findById` | ①이 덮는다 |

**⑥ 이 가장 중요하다** — 트래커에도, 내 첫 설계에도 없었다. 같은 소켓에서
`execution.failed` 는 마스킹된 값을, `execution.snapshot` 은 원문을 보낸다. *"내부 REST vs
WS"* 라는 항목 제목 자체가 부정확했다 — 갈리는 축은 REST↔WS 가 아니라 **종결 emit ↔ 그
밖의 모든 읽기 경로**다.

> 독립 조치가 필요한 자리는 **①③④⑤ 넷**이다(②⑥은 ①을 재사용). "6곳 고쳤다" 라고 쓰지 않는다.

## 설계

**신규 파일** `shared/utils/redact-stored-error.ts` (`terminal-error-payload.ts` 와 형제 — 둘 다
`sanitize-error-message` 만 import 하는 leaf util 이라 #1175 가 해소한 ES-module 순환에
재유입하지 않는다). 파일 위치를 명시한다 — 초안이 "형제" 로만 써서 신규 파일인지 기존 파일
추가인지 불명확했다 (`16_03_57` naming INFO5).

```ts
redactStoredErrorForResponse(
  err: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null
```

> **이름을 바꿨다** (`16_03_57` naming W1). 초안의 `redactExecutionErrorValue` 는 기존 예외
> 계층 클래스 `ExecutionError`(`workflow-errors.ts:33`)를 **온전한 부분 문자열로 포함**한다.
> **다만 checker 가 제시한 대안 3개(`redactExecutionErrorField`·`maskExecutionErrorRecord`·
> `redactExecutionErrorColumn`)는 전부 그 부분 문자열을 그대로 갖고 있어 지적한 문제를 풀지
> 못한다** — 제안을 그대로 받으면 이름만 바뀌고 충돌은 남는다. 그래서 `ExecutionError` 를
> 포함하지 않으면서 **출처(stored = DB 컬럼)와 목적(response egress)** 을 둘 다 말하는
> 이름으로 갔다.

- **`toTerminalErrorPayload` 를 재사용하지 않는다.** 그건 §6.4 **wire 형태**(`{code, message,
  nodeId, details?}`)로 **정규화**한다 — 내부 REST 에 쓰면 값 마스킹이 아니라 **응답 계약
  변경**이 되고, 프런트가 읽는 형태가 바뀐다. 이번 결정은 "값을 마스킹" 이지 "형태 통일" 이 아니다.
- 내부는 `deepRedactSecrets` 로 동일 — 두 egress 의 **방어 강도가 같아야** 비대칭 해소다.
- DB 는 **원문 보존**(§R17 egress-only 원칙 그대로). 서버 로그·사후 디버깅의 진실은 유지된다.

### 전제를 무수정 프로브로 먼저 실증했다 (구현 전)

`deepRedactSecrets` 를 실제 `Execution.error` 모양에 걸어 봤다. **안 바뀌면 이 PR 은 no-op 이고
어떤 테스트도 vacuous 하다** — 그 전제를 가정하지 않고 쟀다:

| 입력 | 결과 |
|---|---|
| `postgres://u:pw@db.internal/prod` | `postgres://***@db.internal/prod` **CHANGED** |
| `auth failed: Bearer sk-live-…` | `auth failed: ***` **CHANGED** |
| `details.headers.authorization` | `***` **CHANGED** |
| `details.api_key` | `***` **CHANGED** |
| `postgres://db.internal:5432/prod` (자격증명 없음) | 무변화 (잔여 갭 — 의도) |
| `Node "Send Email" failed` | **무변화** |

마지막 행이 이 결정의 **비용 상한**이다 — 평범한 에러 메시지는 손상되지 않고, 진단 정밀도
손실은 **자격증명 형태 부분문자열에 한정**된다.

### 캐시 상호작용 — 마스킹을 캐시 **안쪽**에 둔다

`findById` 는 종결 상태 snapshot 을 LRU 캐시에 넣는다(`writeSnapshotCache`). 마스킹을
캐시 **쓰기 전**에 두면 캐시가 마스킹된 값을 담고, 읽기 경로가 어디로 들어오든 같은 값이
나온다. 캐시 **읽은 뒤**에 두면 히트·미스 경로 둘 다에 걸어야 하고, 그게 이 저장소가
겪은 *"캐시 우회 4곳 중 1곳"* 형태다.

## 범위 밖 — 이름을 붙여 남긴다 (조용히 빠뜨리지 않는다)

- **`NodeExecution.error`** — **다른 컬럼**이고 `execution.node.*` 이벤트의 계약이 다르다.
  프런트도 별도로 렌더한다(`page.tsx:493`). 같은 클래스의 유출 가능성이 **있다**고 실측
  기록하되, 이번 결정(`Execution.error`)의 범위가 아니므로 **정본 트래커에 신규 등재**한다.
- **`inputData` / `outputData`** — 내부 REST 는 원문을 준다(`:860`·`:861`). EIA `getStatus`
  는 `stripAndRedact` 를 건다. 역시 다른 컬럼이라 별건 등재.
- 자격증명 **없는** 연결 문자열·내부 호스트명·스택 — 트래커의 별도 항목(shared SoT 승격).
  이 PR 의 보장은 **`deepRedactSecrets` 가 잡는 만큼**이고 그 이상이 아니다.

## D — `interaction.triggerToken`

`secret-store.md §1` 의 "비대상" 절에 명시 등재한다(현재 `AuthConfig.config` 만 있다).

실측으로 드러난 것 하나를 근거에 반드시 적는다 — **같은 `Trigger.config` JSONB 안에서
`notification.signing.secretRef` 는 `SecretResolver` 를 경유하는데 `interaction.triggerToken`
만 평문**이다. 한 객체 안의 비대칭이라 "왜 다른가" 를 적지 않으면 다음 사람이 결함으로 읽는다.

EIA spec `:910` 의 *"향후 secret store 통합 검토"* 문구도 함께 정정한다 — 의식적 예외로
결정된 이상 "검토 중" 은 거짓이 된다.

## spec 초안 (planner 턴에서 `--spec` 통과 후 적용)

### ① `14-external-interaction-api.md` §R17 — `:1484` 불릿 **교체**

현재(미결 선언):

> - **내부 REST 와의 비대칭은 미결이다**: `GET /api/executions/:id` 는 `Execution.error` **원문**을
>   반환하므로 같은 컬럼을 두 표면이 다른 값으로 말한다. 어느 쪽이 옳은지는 아직 정하지 않았다 …

교체안:

> - **내부 읽기 경로도 같은 마스킹을 적용한다 (결정 2026-08-16)**: 같은 `Execution.error` 를
>   내부 표면이 원문으로 말하던 비대칭을 해소했다. `redactStoredErrorForResponse`
>   (`deepRedactSecrets` 위임, **형태 보존**)를 `ExecutionsService` 의 독립 반환 경로
>   **4곳**(`findById` · `toExecutionDto` · `getChain` · `stop`)에 적용한다.
>   `POST /executions/:id/re-run` 과 WS `execution.snapshot` 은 `findById` 를 재사용하므로
>   함께 덮인다.
>   - **`nodeExecutions[].error` 도 함께 마스킹한다** — 데이터 모델 §2.14
>     (`spec/1-data-model.md`, 적용 시 `../1-data-model.md` 로 링크)
>     가 `Execution.error` 를 *"최초 failed NodeExecution 의 에러 정보를 **복사**"* 로 정의하므로,
>     최상위만 가리면 **같은 문자열이 같은 응답 안에 원문으로 병존**해 방어가 통째로 우회된다.
>     자매 표면인 `GET /executions/:id/background-runs/:id` 의 body 노드도 같이 건다.
>   - **갈리는 축은 REST↔WS 가 아니다** — 종전 서술이 이 항목을 *"내부 REST vs WS"* 라 불렀는데
>     실측하면 WS `execution.snapshot`(`websocket.gateway.ts`)도 같은 원문을 싣고 있었다. 실제 축은
>     **종결 emit ↔ 그 밖의 모든 읽기 경로**였다.
>   - **형태는 바꾸지 않는다** — `toTerminalErrorPayload`(§6.4 wire 형태로 정규화)를 재사용하지
>     않는다. 내부 응답 계약(`Record<string, unknown> | null`)은 그대로 두고 **값만** 마스킹한다.
>   - **근거**: `GET /api/executions/:id` 에 `@Roles` 게이트가 없어 viewer 포함 전원이 조회하고,
>     프런트가 실패 배너에 `error.message` 를 그대로 렌더한다. 실행 내역 R-5
>     (`spec/2-navigation/14-execution-history.md`, 적용 시 `../2-navigation/…` 로 링크)
>     의 *"안전성은 롤 게이팅이 아니라 서버 boundary
>     masking parity 에 의존"* 원칙과 §R17 `execution.ai_message` 불릿(내부 WS·Chat Channel 도
>     마스킹 — 수용된 trade-off)의 선례가 같은 방향이다. **단 R-5 의 직접 대상은 Config 탭이며
>     `Execution.error` 를 이미 규정하고 있지는 않다** — 원칙을 원용한 것이지 기존 판정이 아니다.
>   - **DB 는 여전히 원문**(egress-only 원칙 불변). 서버 로그·사후 디버깅의 진실은 유지된다.
>   - **잔여(범위 밖, 실측 기록)**: ① WS `execution.node.*` **emit** 경로의 `error` 는 여전히
>     원문이다 — 읽기 표면이 아니라 별도 emit 계약이고 WS 프로토콜
>     (`spec/5-system/6-websocket-protocol.md`, 적용 시 `./6-websocket-protocol.md` 로 링크)
>     이 마스킹을 규정하지 않는다. ② `inputData`/`outputData` 는 **다른 컬럼**이라 포함되지
>     않는다 — 외부 `getStatus` 는 `stripAndRedact` 를 거는데 내부 REST 는 걸지 않아 같은
>     형태의 비대칭이 남아 있다. 둘 다 정본 트래커 등재.

### ② `secret-store.md §1` — `AuthConfig.config` 비대상 블록 **뒤**에 신설

> **비대상 — `Trigger.config.interaction.triggerToken`** (결정 2026-08-16): per-trigger
> interaction 토큰(`itk_*`)은 `Trigger.config` JSONB 에 **평문**으로 보관하며 `secret://` 통합
> 대상이 아니다.
>
> **위 `AuthConfig.config` 예외와 같은 종류가 아니다.** 그쪽은 *"다른 메커니즘으로 **동등하게
> 암호화**된다"* 가 근거지만, 이 필드는 **암호화 자체가 없다.** 근거를 따로 세운다 —
> (a) 요청마다 timing-safe 비교하는 **hot-path bearer 토큰**이라 매 요청 복호화 또는 별도
> 캐시 계층을 요구한다, (b) revoke 가 **값 교체(rotation)** 로 즉시 무효화되어 `secret_store`
> 의 버전 관리 이점이 작다, (c) 값 공간이 서버 발급 랜덤 hex(`itk_` + 32 bytes)로 닫혀 있고
> 발급 응답에 **1회만** 노출되므로, 사용자가 입력한 외부 서비스 자격증명과 위험 프로파일이
> 다르다(유출 시 영향 범위가 이 트리거 하나로 한정된다).
>
> **따라서 이 블록을 "평문 보관 일반의 선례" 로 인용하면 안 된다** — (a)~(c) 를 함께
> 만족하지 않는 세 번째 필드가 같은 문단을 근거로 예외를 얻는 것이 이 등재의 실패 모드다.
>
> **같은 `Trigger.config` 안의 `notification.signing.secretRef` 는 `SecretResolver` 를 경유한다** —
> 한 객체 안의 이 비대칭은 의도된 것이고, 위 (a)~(c) 가 그 사유다(그쪽은 사용자 입력 HMAC
> secret 이라 (c) 를 만족하지 않는다).

### ③ `14-external-interaction-api.md:910` — "향후 secret store 통합 검토" 문구 정정

의식적 예외로 **결정된** 이상 "검토 중" 은 거짓이 된다 → *"`secret-store.md §1` 비대상 등재
(결정 2026-08-16)"* 로 교체하고 그쪽을 가리킨다.

## 조치

- [x] `redactStoredErrorForResponse` 추가 (신규 파일 `shared/utils/redact-stored-error.ts`,
      형태 보존, `deepRedactSecrets` 위임)
- [x] 독립 표면 4곳 적용. **셋은 공통 관문으로 묶었다** — `stripPrivateRelations` 를
      `toResponseExecution` 으로 확장해 `findById`·`getChain`·`stop` 이 같은 문을 지난다.
      `toExecutionDto`(목록)는 엔티티가 아니라 DTO 조립이라 거기서 직접 부른다
      > **`stop` 은 `return` 문이 셋**이고(waiting · `affected=0` · 정상) 각각 `?? execution`
      > 폴백이 있어 나갈 수 있는 객체는 여섯 가지다 — 호출부 마스킹으로는 네 번째 반환이
      > 추가될 때 빠진다 → `stopInternal` 로 본체를 내리고 `stop` 을 관문으로 만들었다
      > (처음엔 "반환 지점 넷" 이라 썼는데 폴백을 별개 지점으로 잘못 센 것이다.
      > `18_14_50` documentation W1 이 잡았고, 소스 JSDoc 과 함께 여기도 정정한다)
- [x] 회귀 테스트 — 표면 4곳 각각 + 캐시 히트 경로 + `stop` 의 둘째 반환 지점 +
      "DB 원문 불변" + null 형태. 유틸 단위 테스트 7건 (**44 tests PASS**)
- [x] 판별력 — 표면별 뮤턴트 5종 **전부 RED**, 그리고 **죽는 테스트가 표면별로 갈린다**:

      | 뮤턴트 (해당 표면만 관문 우회) | 실패 |
      |---|---|
      | `findById` | **2** (상세 + 캐시 히트) |
      | `getChain` | **1** |
      | `stop` | **2** (정상 + `affected=0` 분기) |
      | `toExecutionDto`(목록) | **1** |
      | 관문 자체를 no-op | **5** (위 셋의 전부) |

      > 공통 관문을 쓰면 "한 번만 검증하면 된다" 고 생각하기 쉬운데, 그러면 **한 표면이
      > 관문을 안 지나게 바뀌어도 초록**이다. 위 표가 그렇지 않음을 보인다.
      > 뮤턴트는 python 으로 만들고 **치환 대상이 정확히 1건인지 선검증**했다 — 치환
      > 실패 뮤턴트의 RED 를 판별력으로 오독하는 것이 이 저장소의 기존 함정이다.
- [x] 기존 단언 1건 교체 — `stop` 테스트의 `expect(result).toBe(afterCancel)` 는 관문이
      **복사본**을 돌려주면서 깨진다. 원래 의도(*"stale lookup 이 아니라 재조회 결과"*)를
      내용 비교 + stale 배제 단언으로 **등가 교체**했다(약화 아님)
- [x] planner 턴 ⓐ — §R17 I1 캐비엇 flip (미결 선언 → 결정·범위·잔여 전부 명시)
- [x] planner 턴 ⓑ — `14-execution-history.md` R-5 **위**에 대상 범위 캐비엇 추가
      (`16_03_57` cross_spec W1-(b)). R-5 를 이 필드에 그대로 적용하면 *"error 도 write
      시점에 마스킹된다"* 는 잘못된 결론이 나온다 — 그 경계를 그 문서 안에서 못박았다
- [x] planner 턴 ⓒ — `secret-store.md` 비대상 등재(독립 근거 (a)(b)(c) + "선례로 인용 금지")
      + Overview 절대 문구에 예외 caveat + EIA `:910` "향후 검토" 문구 정정
- [x] planner 턴 ⓓ — `14-external-interaction-api.md` `code:` 에 `redact-stored-error.ts` ·
      `executions.service.ts` 추가, `14-execution-history.md` `code:` 에도 전자 추가
- [x] planner 턴 ⓔ — `6-websocket-protocol.md` `execution.snapshot` 행에 **관문 상속** 명시 +
      같은 소켓의 `execution.node.*` emit 은 아직 원문이라는 대비까지
- [x] planner 턴 ⓕ — `12-background.md` §8.2 `nodeExecutions.data` 행에 마스킹 교차 참조
- [x] 정본 트래커 **I1·D 닫기** (같은 diff 안에서 이미 `[x]` — 이 줄이 stale 이었다,
      `17_12_34` documentation W2)
- [x] 정본 트래커 **신규 잔여 등재** — 위 항목과 **분리했다** (`16_03_57` plan_coherence W1).
      한 체크박스로 묶여 있으면 I1·D 만 닫고 체크하는 순간 신규 등재가 조용히 "완료" 로
      읽힌다. 이 트래커가 이미 5회 "미래형 등재 약속 후 미이행" 을 자백한 파일이다.
      등재 실물: `NodeExecution.error`(→ 이번에 **해소**로 격상 정정) ·
      WS `execution.node.*` emit(신규 잔여) · `inputData`/`outputData`

## `16_32_42` **BLOCK: YES** — 내 "범위 밖" 판정이 틀렸다

`--spec` 이 CRITICAL 2건으로 막았고 **둘 다 맞다.**

**C1 (naming·convention)** — spec 에 실제 patch 될 초안 ① 텍스트에 폐기된 함수명
`redactExecutionErrorValue` 가 남아 있었다. `## 설계` 절에서는 이름을 바꿔 놓고 **정작 spec 에
들어갈 문장은 안 고쳤다** — 결정을 적어 두는 것과 그 결정이 산출물에 반영되는 것은 다르다.

**C2 (cross_spec) — 이쪽이 본질이다.** 내가 `NodeExecution.error` 를 *"다른 컬럼이고
`execution.node.*` 계약이 다르다"* 는 이유로 범위 밖에 뒀는데, **그 서술은 참이지만 결론이
틀렸다.** [데이터 모델 §2.14](../../spec/1-data-model.md) 가 `Execution.error` 를 *"최초
failed NodeExecution 의 에러 정보를 **복사**"* 로 못박는다 — **컬럼이 다른 것과 값이 같은
것은 다른 문제**고 여기서 문제는 후자다. 마스킹이 겨냥하는 바로 그 케이스(실행 실패)에서
같은 문자열이 같은 응답에 원문으로 병존해 방어가 통째로 우회됐다.

> **내가 판단을 멈춘 지점이 문제였다** — "다른 컬럼" 까지 확인하고 §2.14 의 원본/복사 표를
> 안 읽었다. 이 저장소의 *"방어의 정의를 한 칸 좁게 잡는다"* 가 정확히 이 형태다.

조치: 마스킹을 `nodeExecutions[].error` 와 자매 표면(`background-runs`)까지 확장했고,
잔여를 WS `execution.node.*` **emit** 경로로 좁혀 트래커 문구를 *"같은 클래스의 유출 가능성"*
에서 **"동일 값의 복사 원본"** 으로 격상했다(심각도가 다르다).

## `16_03_57` W1-(c) 는 실측으로 닫았다 — 동반 갱신 **불요**

checker 가 *"`3-workflow-editor/3-execution.md` §10.6.1 Run Results 드로어도 동일 필드 노출 시
동반 갱신"* 을 요구했다. 실측하니 §10.6.1(`:478`)은 **노드 레벨 서브 탭**(completed/failed/
cancelled/waiting 노드의 Input/Output/**Error** 탭)이고, 거기 Error 탭이 싣는 것은
`NodeExecution.error` 다 — 이번 결정의 `Execution.error` 와 **다른 컬럼**이다.

즉 조건절(*"동일 필드 노출 시"*)이 성립하지 않아 동반 갱신 대상이 아니다. **건너뛴 게 아니라
재서 아니었다** — 그리고 `NodeExecution.error` 는 아래 잔여 항목으로 트래커에 등재한다.

## 체크리스트

- [x] `--impl-prep` (`16_03_57`) **BLOCK: NO** — Critical 0 · WARNING 4 전부 반영:
      W1 은 spec 갱신 3건(ⓐⓑⓒ)을 **같은 PR 의 완료 조건**으로 승격(코드/spec 이 다른 PR 로
      갈라지면 "코드=닫힘, spec=미결" 역방향 drift), W2 는 `secret-store.md` 예외 근거를
      `AuthConfig.config` 문구 재사용이 아니라 **독립 근거**로 작성(둘은 예외의 *종류*가
      다르다 — 아래 §D), W3 는 체크박스 분리 + 선등재, W4 는 함수명 교체(단 제안된 대안
      3개가 전부 같은 부분 문자열을 갖는다는 점은 반영하지 않고 실제로 겹치지 않는 이름을 골랐다)
- [x] TEST WORKFLOW 4스테이지 — **리뷰 fix 반영 후 최종 재실측**: lint(50s) /
      unit(73s — **백엔드 427 suites · 8,774 passed**, 프런트 285 files) / build(145s) /
      **e2e 276 passed**(215s) 전부 PASS
      > 래퍼 마지막 줄의 `tests=14` 는 **내부 패키지 집계**다. 백엔드 수치는 로그 첫 블록에서
      > 읽었다 — 그 줄을 백엔드 수치로 적는 것이 기존 오독 형태다
- [x] `--spec` — `16_32_42` **BLOCK: YES**(CRITICAL 2) → 정정 후 `16_48_55` **BLOCK: NO**
      (WARNING 3 전부 반영: `spec_impact` 전수화 · WS snapshot ⓔ · background ⓕ)
- [x] `/ai-review` (`17_12_34`) **CRITICAL 0** · WARNING 6 — reviewer **14명 전원**
      (forced 7 ⊆ 14). 전 항목 조치 → `RESOLUTION.md`
      > WARNING 7(requirement)은 **고치려다 되돌렸다** — 처방을 적용하니 기존 테스트가 RED 였고
      > (`maskSensitiveFields` 의 `****9876` 접미 힌트가 값-패턴 마스킹에 덮인다), 테스트를
      > 내 변경에 맞춰 고치는 대신 트래커에 결정 항목으로 등재했다
- [x] `/ai-review` **2라운드** (`17_35_49`, forced 7 + performance) — **CRITICAL 0**,
      WARNING 3 + documentation 4 전부 조치 → `RESOLUTION.md`
      > 2라운드가 잡은 것 중 둘이 **내가 1라운드 fix 를 하면서 만든 것**이다 —
      > 고친 null-hiding 캐스트를 자매 자리에 재도입, 그리고 새 copy-on-change 가
      > **참조 동일성으로 검증되지 않음**(무조건 spread 뮤턴트가 GREEN). 후자는
      > `⑤-c` 를 추가하고 뮤턴트로 **RED 확인**했다
- [x] `--impl-done` (`17_35_13`) **BLOCK: NO** — WARNING 1(응답 DTO Swagger JSDoc)은
      `PROJECT.md` 의 "같은 turn 갱신 의무" 대로 이 PR 안에서 반영. INFO 2건도 함께 닫음
- [x] `/ai-review` **3라운드** (`17_56_15`, forced 7 + api_contract) — **CRITICAL 0 ·
      WARNING 1**, 그 하나(고아 JSDoc)는 **리포트 도착 전에 이미 고쳐져 있었다**
      → `RESOLUTION.md`. **수렴 판정**: 발견의 성격이 동작·구조 → 그 fix 의 검증 공백 →
      문서 배치로 계속 내려왔다
      > testing reviewer 가 내 뮤테이션 주장(`⑤-c` 가 RED)을 **독립 재현해 검증**했다 —
      > RESOLUTION 의 판별력 주장이 자기 증언이 아님이 확인됐다
      > ⚠️ 그 리뷰어가 `git checkout --` 로 원복했는데, 이 저장소엔 **병렬 리뷰어가 남의
      > 미커밋 작업을 되돌린 전례**가 있어 즉시 확인했다 — 손실 없음(당시 미커밋 편집 1건 존재)
- [x] TEST WORKFLOW **최종 재실측** — lint / unit(**백엔드 427 suites · 8,775 passed**,
      프런트 285 files) / build / **e2e 276 passed** 전부 PASS
      > build 가 1회 `no space left on device` 로 실패했다 — 코드 회귀가 아니라 Docker
      > 빌드 캐시 13GB. `docker builder prune -af` 후 통과(기록된 형태 그대로)
- [x] `/ai-review` **4라운드** (`18_14_50`, forced 7, **코드 동결 후**) — **CRITICAL 0 ·
      WARNING 1**(내가 센 `stopInternal` 반환 지점 수가 틀림) → `RESOLUTION.md`
      > `security` INFO 가 **내 근거의 논리 결함**을 짚었다 — `triggerToken` 근거 (a) 는
      > 해시+`timingSafeEqual` 반례로 무너진다. spec 을 정정했다(비용 근거로 격하 + 반례 명시)
- [x] `--impl-done` **재실행** (`18_20_34`, 코드 동결 후) — **BLOCK: NO**,
      CRITICAL 0 · **WARNING 0**. INFO 3건도 전부 반영
      > `17_35_13` 은 최종 코드 커밋보다 앞서 게이트가 stale 로 판정한다 —
      > **게이트는 세션 디렉토리 시각 vs spec-linked 코드의 커밋 author date 를 비교**한다
      > (소스 실측). 그래서 코드를 동결한 뒤 두 게이트를 다시 열었다
- [x] `/ai-review` **5라운드** (`18_33_52`, forced 7) — **CRITICAL 0 · WARNING 4** 전부 조치
      → `RESOLUTION.md`. 코드 품질 둘(중복 헬퍼 · 리뷰 이력이 소스 주석에 박제)은 **내가
      만든 것**이고, 수치 지적 하나는 **실측해 보니 내 값이 맞았다**(리뷰어 둘이 서로 다른
      값을 냈고 둘 다 `grep` 으로 코드블록 예시까지 셌다) — 대신 **세는 방법을 문서에 박았다**
- [x] `--impl-done` **재실행** (`18_33_59`) — **BLOCK: NO**, CRITICAL 0 · WARNING 2 조치
      (§R17 잔여 ③ 을 세 필드로 열거 · `spec_impact` 에 `1-data-model.md` 추가)
- [x] `/ai-review` **6라운드** (`18_58_22`, forced 7) — **CRITICAL 0 · WARNING 2** 조치
      → `RESOLUTION.md`. **내 커밋 메시지가 거짓**이었던 것을 잡혔다("전부 걷어냈다" 고 쓰고
      한 파일만 고침). 다만 조치는 실측으로 갈랐다 — 라운드 ID 인용은 **저장소 기존 관용**이라
      (선존 파일 다수가 같은 형태) 인용은 남기고 **장황한 자기정정 서사만** 걷어냈다
- [x] `--impl-done` **재실행** (`18_58_29`) — **BLOCK: NO**, CRITICAL 0 · WARNING 1 조치
      (`1-data-model.md` 무조건문 → 열거 + "어디서 나가든 마스킹" 오독 차단 캐비엇)
- [x] TEST WORKFLOW **최종** — lint / unit(**백엔드 427 suites · 8,776 passed**) / build /
      **e2e 276 passed**. 문서 가드 20파일 · 2,956 tests PASS
- [x] `/ai-review` **7라운드** (`19_16_28`, forced 7, **코드 동결**) — **CRITICAL 0 ·
      WARNING 1**. 유일한 WARNING(서술 DRY)은 **코드를 고치지 않고 트래커에 등재**했다 —
      전제를 실측하니 verbatim 복제가 아니었고(관용구 공유), 유효한 부분(수치 drift)만
      근거와 함께 남겼다. 기능 위험 0인 주석 정리를 위해 게이트를 한 바퀴 더 도는 것은
      비용이 이익을 넘는다 → `RESOLUTION.md`
      > 6명이 **NONE** — security 는 7라운드 연속이고, documentation 은 결함 0으로
      > `pending_plans`(17·4)를 파서로 독립 재현해 일치 확인까지 했다
- [ ] push 게이트 통과 → PR
