---
worktree: spec-followups-drain-08e637
started: 2026-08-30
owner: project-planner
status: complete
priority: P2
spec_impact:
  - spec/5-system/14-external-interaction-api.md
  - spec/data-flow/15-external-interaction.md
  - spec/conventions/egress-masking.md
  - spec/5-system/6-websocket-protocol.md
---

# spec draft — developer 턴이 밀어 둔 4건 드레인

## 왜 planner 턴인가

2026-08-29 의 세 PR(`#1236`·`#1237`·`#1238`)이 구현 중 **spec 결함 4건**을 실측으로 찾았지만
전부 `spec/` 쓰기라 developer 권한 밖이었다. 우회하지 않고 각 트래커에 실측과 함께 등재만
해 두었고, 이 draft 가 그 넷을 한 번에 처분한다.

**하나는 단순 후속이 아니라 트래커를 막고 있다** — §3 을 처리해야
`ws-event-types-extract.md` 가 `complete/` 로 갈 수 있다(내용상 이미 100% 완료).

---

## 1. §R8 Rationale 의 `statusCode` 서술이 **태어날 때부터 거짓이었다**

**대상**: `spec/5-system/14-external-interaction-api.md:1264` (§R8 Rationale,
"fail-open 의 원인은 두 축이다" 문단)

**현재 문장**:

> `statusCode` 는 현재 **타입만** 검사한다(`typeof === 'number'`) — 값 범위는 아직 보지 않는
> **선재 갭**이다. `-1`·`600` 같은 값이 통과하면 `res.status(-1)` 이 전송 시점 `RangeError` 로
> 같은 500 을 만든다. 범위 검사는 `readKey`/`hashBody` 경계값 항목과 함께 닫는다.

**실측 (2026-08-30 재확인)**:

| 대상 | 값 |
| --- | --- |
| 실제 코드 | `idempotency.interceptor.ts:471` `isHttpStatusCode()` — `Number.isInteger` + `MIN_HTTP_STATUS_CODE`(100) ~ `MAX_HTTP_STATUS_CODE`(599) |
| 갭을 닫은 커밋 | `4b1f899b7` (`#1159`, 2026-08-13) |
| 문장을 쓴 커밋 | `1e9f3f238` (`#1162`, 2026-08-13) |
| 순서 | `git merge-base --is-ancestor 4b1f899b7 1e9f3f238` → **참** |

**요점은 "낡았다" 가 아니라 "쓰일 때 이미 거짓이었다" 는 것이다.** 보통 spec 낡음은 코드가
앞서가서 생기는데, 이 문장은 갭을 **닫은 PR 이 머지된 뒤에** 그 갭이 아직 열려 있다고 새로
적었다. `#1162` 는 같은 문단의 fail-open 경로 수를 정정하던 PR 이라, **"인접 서술은 건드리지
않는다" 를 지키다가 인접 서술의 거짓을 승계한** 형태로 보인다.

**변경안** — 그 세 문장을 완료형으로 교체:

> `statusCode` 는 **타입과 값 범위를 모두** 검사한다 — `isHttpStatusCode()` 가
> `Number.isInteger` + `100`~`599` 를 본다(`#1159`). 이 검사가 없으면 `-1`·`600` 같은 값이
> 통과해 `res.status(-1)` 이 전송 시점 `RangeError` 로 같은 500 을 만든다.

> **왜 취소선으로 남기지 않는가**: 이 저장소는 폐기된 *결정* 을 취소선으로 남기지만, 이건
> 결정이 아니라 **한 번도 참이 아니었던 상태 서술**이다. 남겨 두면 "한때 그랬다" 로 읽혀
> 오히려 이력이 왜곡된다. 대신 경위는 이 draft 와 커밋 메시지에 남긴다.

---

## 2. §4 Redis 각주가 "어느 표" 를 생략해 오독을 만든다

**대상**: `spec/data-flow/15-external-interaction.md:310` (§4 외부 의존 표, Redis 행)

**현재 문장 끝**: *"키 **형태**는 [실행 엔진 §9.1] 참고 — 다만 EIA 계열 키는 그 표에 아직
미등재다(별도 항목)"*

**실측**: 그 문장은 **참이다** — `interaction:idempotency` 는 `4-execution-engine.md` 에
없다(grep 0건). 그런데 **같은 문서 255행**이 *"키 형태 규칙과 저장소 전역 인벤토리는
`conventions/redis-keys.md` 가 SoT"* 라고 말하고, 거기엔 **등재돼 있다**
(`redis-keys.md:59` — `iext:blacklist:<jti>` · `interaction:idempotency:<executionId>:<route>:<key>`).

즉 **주어("그 표")를 생략한 부재 서술**이라, 두 문장을 나란히 읽으면 "EIA 키는 어디에도
등재 안 됐다" 로 읽힌다. 인접 문서가 그 부재를 메운 순간 이런 문장은 거짓처럼 작동한다.

**변경안** — 주어를 명시하고 정식 등재처를 함께 가리킨다:

> 키 **형태**는 `conventions/redis-keys.md §3` 에 등재돼 있다(전역 인벤토리 SoT — 위 §2.2 와
> 같은 출처). `실행 엔진 §9.2` 의 표는 **엔진이 소유한 키 전용**이라 EIA 계열은 거기 없는
> 것이 정상이다.
>
> (링크 target — spec 파일 기준 상대경로: 앞은 `../conventions/redis-keys.md` +
> 앵커 `#3-전역-인벤토리-포인터`, 뒤는 `../5-system/4-execution-engine.md` +
> 앵커 `#92-용도별-키-정의-및-ttl`.)

> ⚠️ **위를 마크다운 링크로 적었다가 `plan-frontmatter` 가드에 걸렸다** — 그 상대경로는
> **spec 파일 기준**인데 이 draft 는 `plan/in-progress/` 에 있어 해석이 깨진다(실측: 2건 RED).
> 그래서 target 을 코드 스팬으로 떼어 놓았다. **plan 안에 다른 위치의 링크를 예시로 실을 때
> 반복되는 함정**이다.

> ⚠️ **§9.1 이 아니라 §9.2 다** (`10_25_39` plan_coherence W5 가 잡음). 실측: `§9.1 키 패턴`은
> **표가 0행**인 산문이고, `키 패턴/용도/TTL` 표 9행은 `§9.2 용도별 키 정의 및 TTL` 에 있다.
>
> **이 오기의 경로가 나쁘다.** 원 spec 문장이 §9.1 을 가리키고 있었고 나는 그걸 그대로 베꼈다 —
> 즉 **고치려던 부정확을 새 문장에 다시 심었다.** 게다가 2026-08-29 에 내가 트래커에 적어 둔
> 원 항목은 **`§9.2` 로 정확했다**. 손에 있던 옛 실측을 버리고 고칠 대상을 베낀 셈이다.
> **정정 대상 문장은 인용의 출처로 쓰지 않는다.**

> **"(별도 항목)" 을 지우는 근거**: 그 별도 항목은 "EIA 키를 어딘가에 등재한다" 였는데
> `redis-keys.md §3` 등재로 **이미 해소됐다**. 남겨 두면 없는 작업을 쫓게 한다.

---

## 3. `egress-masking.md` 캐비엇 — 트리거가 발동했고, 트래커 하나가 여기 막혀 있다

**대상**: `spec/conventions/egress-masking.md:89`

**현재 문장**:

> 이 순서 계약이 확인된 범위는 `toFanoutEnvelope` 경로다. `TerminalErrorPayload` 를 채우는
> 호출부들이 전부 `sanitizeErrorMessage` 를 경유하는지는 **아직 전수 확인되지 않았다**
> ([`ws-event-types-extract.md`] 미체크 항목). 그 확인이 끝나면 이 캐비엇을 걷는다.

**그 확인은 끝났다** (2026-08-29, 해당 항목 `[x]`). 답은 **"경유하지 않는다, 그리고 그게
의도다"** 였다. 2026-08-30 재확인:

| 확인 | 결과 |
| --- | --- |
| `toTerminalErrorPayload` 프로덕션 호출부 | **5곳** — `chat-channel.dispatcher.ts:551` · `execution-engine.service.ts:668·3400·5030` · `retry-turn.service.ts:1001` (전부 emit 쪽, DB write 0) |
| 마스킹 경유 | `sanitizeErrorMessage` 가 **아니라** `redactTerminalError` → `deepRedactSecrets` (`terminal-error-payload.ts:3,110`) |
| `sanitizeErrorMessage` 의 실제 범위 | 알림 경로 전용 |

**변경안** — 캐비엇을 **걷되 빈자리로 두지 않고 결과로 교체**한다:

> **`TerminalErrorPayload` 는 이 순서 계약의 대상이 아니다** (2026-08-29 전수 확인).
> 그 페이로드를 채우는 5개 호출부는 전부 emit 쪽이고, 마스킹은 `sanitizeErrorMessage` 가
> 아니라 **`redactTerminalError` → `deepRedactSecrets`** 라는 **별도 egress 초크포인트**로
> 걸린다(`shared/utils/terminal-error-payload.ts`). 두 경로는 방어 강도가 다르므로
> 하나의 "전 경로 불변식" 으로 묶지 않는다.

**이 캐비엇에 딸린 §1 좌표계 표도 함께 갱신한다** (`10_25_39` convention_compliance W3).
`redactTerminalError` 는 `deepRedactSecrets` 를 쓰므로 **표 2행의 소비처**인데 목록에 없다.
이 문서 §3 이 스스로 "좌표계 표는 **사람이 갱신해야 한다**" 고 적어 둔 자리다 — 새 소비처를
확인해 놓고 표를 안 고치면 그 규율을 이 PR 이 어긴다.

- 표 2행 소비처 열에 `TerminalErrorPayload` emit(`redactTerminalError` 경유) 추가
- frontmatter `code:` 에 `codebase/backend/src/shared/utils/terminal-error-payload.ts` 등재

### ⚠️ `complete/` 이동은 이번 PR 에서 하지 않는다 (초안 철회)

초안은 "캐비엇 회수와 이동은 같은 PR 이어야 한다(따로 하면 링크 가드가 RED)" 였다.
**그 전제가 틀렸다** (`10_25_39` cross_spec W1 이 다른 각도에서 짚어 재검토하다 발견):

- 링크 가드가 RED 였던 이유는 `egress-masking.md:89` 가 `plan/in-progress/…` 를 가리키는데
  파일이 옮겨가서였다. **그런데 이번 변경은 그 문단(=그 링크)을 통째로 걷어낸다.**
  링크가 사라지므로 **이동 여부와 무관하게 DEAD 링크가 생기지 않는다.** 두 작업은 애초에
  묶일 필요가 없었다.
- 그리고 묶으면 **안 된다**: `ws-event-types-extract.md` 에는 아직 **미체크 항목이 하나
  남아 있다**(`#1238` 이 등재한 facade 재수출 커버리지 비대칭). `plan-lifecycle.md §3` 은
  "모든 체크박스 `[x]` + 미해결 follow-up 0건" 을 이동 조건으로 못 박는다.
- 그 잔여 항목의 fix 는 **`codebase/**` 편집**(테스트 한 줄)이라 **planner 턴에서 할 수
  없다.** 여기서 이동을 강행하면 살아 있는 항목을 품은 채 `complete/` 로 봉인하는 것이고,
  이 저장소가 이미 두 번 겪은 유실 패턴이다.

**⇒ 이 PR 은 캐비엇만 회수한다.** 이동은 그 한 줄을 닫는 developer 턴이 같은 PR 에서 한다.
`spec_impact` 값(`#1175`+`#1176` 합집합 7개)은 `ws-event-types-extract.md` 본문에 이미
적혀 있으므로 여기서 중복 보관하지 않는다 — 그 문서가 SoT 다.

---

## 4. `<도메인>EventType` 명명 규칙이 어디에도 없다

**실측**: `grep -rn "EventType" spec/conventions/` → **0건**.

`websocket-events.types.ts` 의 다섯 enum 이 전부 그 형태다 — `ExecutionEventType` ·
`NodeEventType` · `BackgroundRunEventType` · `KbEventType` · `InAppNotificationEventType`.

**그냥 누락이 아닌 이유**: `#1238` 이 `NotificationEventType` → `InAppNotificationEventType`
개명을 정당화한 근거의 **절반이 이 규칙**이었다("도메인 접두는 이 모듈 규칙 안이다").
즉 **문서에 없는 규칙을 근거로 결정이 내려졌다.** 다음 사람이 같은 판단을 하려면 다섯 파일을
열어 패턴을 귀납해야 한다.

**변경안** — **신설하지 않고** `spec/5-system/6-websocket-protocol.md` 의 `## Rationale` 에
**`###` 서브섹션**으로 얹는다. 그 문서의 기존 Rationale 항목이 전부 `###` 헤딩이라 최상위
blockquote 로만 두면 형식이 어긋난다 (`10_25_39` convention_compliance W4):

```markdown
### WS 이벤트 enum 명명 — `<도메인>EventType` (2026-08-30, `#1238` 후속)
```

본문:

> **WS 이벤트 enum 명명 — `<도메인>EventType`**. `websocket-events.types.ts` 의 이벤트 enum 은
> 도메인을 접두로 갖는다(`Execution`·`Node`·`BackgroundRun`·`Kb`·`InAppNotification`).
> 도메인 없는 일반명(`NotificationEventType` 등)은 **다른 영역의 동명 타입과 충돌**하므로 쓰지
> 않는다 — 실제로 `triggers/dto/notification-config.dto.ts`(outbound webhook 구독
> 화이트리스트)와 이름이 겹쳐 `#1238` 에서 개명했다. 그때까지는 disambiguation JSDoc 으로만
> 막고 있었는데, **주석은 오import 를 막지 못한다**(자동완성이 두 심볼을 같은 이름으로 보여
> 주면 잘못 고른 쪽도 컴파일된다).
>
> 코드 쪽 근거: `websocket-events.types.ts` 의 `InAppNotificationEventType` JSDoc
> (`10_25_39` naming INFO 3 — 같은 규칙이 두 곳에 살게 되므로 상호 포인터로 drift 를 잡는다).

> **왜 `spec/conventions/` 신설이 아닌가**: 이 규칙의 적용 범위가 **WS 이벤트 enum 한 모듈**
> 이다. `conventions/` 는 여러 영역이 참조하는 규약의 자리이고, 한 파일에만 걸리는 규칙을
> 거기 올리면 이 저장소가 방금 네 PR(`#1188`~`#1191`)을 들여 걷어낸 **미러를 문서 레이어에
> 되살린다**(`#1194` 가 같은 판단을 기록했다). 적용 범위가 넓어지면 그때 승격한다.

---

## 5. 원 출처 트래커 체크박스 동기화 (`10_25_39` W2 — 3 checker 중복 지적)

§1·§2 를 집행하면 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 대응
항목 둘이 **해소되는데도 미체크로 남는다**:

| 절 | 트래커 항목 | 조치 |
| --- | --- | --- |
| §1 | `## §R8 Rationale 의 statusCode 선재 갭 서술이 태어날 때부터 거짓이었다` 아래 항목 | `[x]` + 처분 한 줄 |
| §2 | `## 15-external-interaction.md §4 Redis 각주가 redis-keys.md 등재를 반영 못 한다` 아래 항목 | `[x]` + 처분 한 줄 |

**이 트래커가 스스로 기록한 실패 패턴의 재발이라 특별히 짚는다** — *"자기를 닫은 PR 이
자기 이름을 부르지 않으면 영영 미체크로 남는다"*. 내가 이 두 항목을 **직접 등재해 놓고**
그것을 닫는 draft 에서 닫는 지시를 빠뜨렸다. 세 checker 가 같은 것을 지적했다.

## Rationale

**왜 넷을 한 PR 로 묶나**: 넷 다 **developer 가 실측으로 찾았지만 권한 밖이라 등재만 해 둔**
같은 성격이고, §3 은 트래커 하나를 막고 있어 지연 비용이 실재한다. 그리고 측정값이 지금
전부 손에 있다 — 나중에 하면 다시 재야 한다.

**넷의 공통 형태**: 전부 **"부재·미완 서술이 그 사이 참이 아니게 된" 것**이다.
1·3 은 트리거가 이미 발동했고, 2 는 인접 문서가 부재를 메웠고, 4 는 규칙이 실재하는데 적힌
곳이 없다. 이 저장소가 반복해 겪는 클래스라 각 변경에 **무엇이 그것을 참이 아니게 만들었는지**
(커밋·등재처)를 함께 남긴다.

**기각한 대안**:

- **§1 을 취소선으로 남기기** — 폐기된 *결정* 이 아니라 **한 번도 참이 아닌 상태 서술**이라
  남기면 이력이 왜곡된다. 본문에서 지우고 경위는 커밋에.
- **§4 를 `spec/conventions/websocket-events.md` 로 신설** — 적용 범위가 한 모듈이라 과하다.
  `#1194` 가 "신설이 자동으로 옳지 않다" 를 같은 근거로 기록했다.
- **§3 의 캐비엇을 그냥 삭제** — 확인 결과(별도 초크포인트)가 사라져 다음 사람이 같은 전수
  확인을 반복한다. 걷되 **결과로 교체**한다.
