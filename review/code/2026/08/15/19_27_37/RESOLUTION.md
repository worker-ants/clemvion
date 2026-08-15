# RESOLUTION — `19_27_37` (branch `claude/ws-event-types-extract`)

Critical **0** · Warning **5** · INFO 6. Warning 5건 전부 처리, INFO 는 2건 반영 + 3건 무조치 + 1건 후속 등재.

수정 커밋: `65da1a9d7` + 본 RESOLUTION 커밋.

---

## Warning

### W1 (architecture) — 순환의 두 노드 중 하나가 전환에서 빠졌다 · **반영**

지적이 옳고, **이 리뷰에서 유일하게 실제 결함이다.**

`websocket.gateway.ts:23` 이 `ExecutionEventType` 을 여전히 `./websocket.service` 에서
값으로 가져오고 있었다. gateway 는 방관자가 아니라 **순환의 당사자**다 —
`websocket.service.ts:3` 이 `WebsocketGateway` 를 import 하고 gateway 가 다시 service 를
import 하는 **직접 2-노드 순환**이다.

원인은 내 repoint 스크립트의 제외 규칙이다:

```python
if f.name.startswith("websocket."):
    continue   # ← gateway 가 통째로 빠졌다
```

같은 스크립트에 제외 규칙이 **두 개** 있었고 **둘 다 정확히 문제 파일을 들어냈다.**
다른 하나(`"WebsocketService" in names → skip`)는 역재현이 66 suites 실패로 잡아냈지만,
이건 못 잡았다 — gateway 의 사용처가 함수 본문 안(`:400`)이라 **지연 평가**되기 때문이다.
즉 오늘 안 터진 것이지 끊긴 것이 아니었다.

> **더 나쁜 건 내 검증이었다.** plan 에 "타입만 가져가는 곳 **0**" 이라고 썼는데, 그 grep 이
> **편집 스크립트와 똑같은 제외를 물려받았다.** 안 옮긴 파일을 세지 않는 자로 "다 옮겼다" 를
> 재고 있었으니 영원히 관측될 수 없었다. 재측정은 grep 이 아니라 **TS 파서로 1,230 파일 전수**.

- 조치: gateway import 를 `./websocket-events.types` 로 전환
- 재측정 (AST 전수): `websocket.service` 에서 `WebsocketService` 외의 것을 가져오는 문장 **1**
  — `websocket.service.spec.ts` 뿐이며, 이건 re-export facade 자체를 검증하는 **의도된 커버리지**다
- plan 의 거짓 완료 주장 정정 + ③ 항목으로 기록

### W2 (requirement, maintainability) — 클래스 JSDoc orphan · **반영**

`ExecutionEventEmitter` 클래스 JSDoc 과 `@Injectable()` 사이에 `TERMINAL_SHAPE` 의
JSDoc+선언이 끼어들어, TS 는 마지막 JSDoc 만 취하므로 클래스 설명이 어디에도 붙지 않았다.

`TERMINAL_SHAPE` 블록을 위로 올려 순서를 `[TerminalEventPayload] → [TERMINAL_SHAPE] →
[클래스 JSDoc] → [@Injectable() class]` 로 교정.

자매 파일(`websocket.service.ts`)이 `14_55_29` 에서 이미 겪은 패턴이라는 지적도 맞다.

### W3 (maintainability, documentation) — JSDoc 두 블록 연속 · **반영**

`NotificationEventType` 위에 원 설명(채널·SoT spec)과 disambiguation 경고가 **별도 블록**으로
연달아 있어 앞 블록이 tooling 에서 사라졌다. 한 블록으로 병합.

### W4 (documentation, security, maintainability) — orphan JSDoc · **반영하되 처분은 따르지 않음**

**결함 지적은 맞다** — WARN #10 (credential 마스킹) JSDoc 이 선언 없이 떠 있었다.
`sanitizePayloadForWs` 구현을 서비스로 되돌릴 때 문서만 타입 파일에 남긴 내 실수다.

**처분은 틀렸다.** 리뷰는 "동일 내용이 `websocket.service.ts:66-76`/`121-127` 에 이미 존재하니
삭제" 라고 했으나, 실측하면

```
grep -c "WARN #10" websocket.service.ts  → 0
```

저장소를 통틀어 **그 한 곳뿐**이다. 삭제했으면 `CREDENTIAL_KEY_PATTERN` 의 보안 근거
(왜 키 이름 패턴 매칭인가 · 왜 entropy 분석이 아닌가)가 통째로 사라졌다.

→ 삭제가 아니라 **구현 바로 위로 이동**했다.

### W5 (testing) — 불변식에 전용 회귀 테스트 부재 · **반영**

지적대로 보호가 "주석 서술 + 캐너리의 부수효과" 뿐이었다. 타입 파일에 import 한 줄을 더해도
컴파일·기존 테스트가 전부 통과하고, 순환 재편입은 한참 뒤 엉뚱한 suite 가 대량으로 터질 때에야
드러난다.

`websocket-events.types.spec.ts` 신설 (4 tests). **`^import` 만 세지 않는다** — 모듈 간선은
`export … from` · `import = require` · 동적 `import()` · `require()` 로도 생기므로 **TS 파서로**
전부 센다. 여기서 한 칸 좁게 잡는 것이 이 저장소에 반복 기록된 내 실패 형태다.

공허 방지 장치도 함께 넣었다 — 파일을 못 읽거나 선언이 딴 데로 옮겨가면 "간선 0" 이 자동으로
참이 되므로, 선언 12개의 존재와 allowlist 경로의 실재를 별도로 단언한다.

뮤테이션 **6/6 RED**, 원복 후 GREEN:

| 뮤턴트 | 결과 |
|---|---|
| M1 평범한 `import` 추가 | RED |
| M2 `export … from` 추가 (`^import` 로는 안 잡힘) | RED |
| M3 동적 `import()` 추가 | RED |
| M4 선언 하나 개명 (간선 0 이 공허해지는 경로) | RED |
| **M5 gateway import 를 W1 결함 상태로 되돌림** | **RED** |
| M6 allowlist 를 죽은 경로로 (예외가 공짜가 되는 경로) | RED |

M5 가 핵심이다 — 리뷰가 찾아낸 그 결함을 이 가드가 잡는다.

리뷰가 제안한 캐너리 주석도 `TERMINAL_SHAPE` JSDoc 에 추가했다(캐너리는 터진 뒤에야 말해 주고,
원인을 곧장 가리키는 쪽은 새 spec 이라는 점을 명시).

---

## INFO

| # | 처분 |
|---|---|
| 1 `10-graph-rag.md:552` 의 `KbEventType` 정본 위치 서술 | **후속 등재** — spec 본문은 developer 권한 밖. `plan/in-progress/ws-event-types-extract.md` 에 planner 턴 항목으로 기록 |
| 2 `payload.error` sanitize 미경유 가능성 | **무조치** — 리뷰도 "기존 설계, 이번 diff 무관" 으로 명시. 별도 턴 |
| 3 import type 문법 혼용 | **반영** — 저장소 실측 `import type {` **378** vs `import { type` **6**. 다수 스타일로 통일 |
| 4 re-export 가 순환 재유입 표면 | **실질 해소** — W5 가드의 3번째 테스트가 정확히 이걸 정적으로 막는다(`no-restricted-imports` 없이) |
| 5 식별자 4곳 수동 나열 | **무조치** — `tsc` 가 fail-closed 로 잡는다는 리뷰 판단에 동의 |
| 6 `TERMINAL_SHAPE` 모듈 스코프 복원 | **무조치** — 리뷰도 "계획된 캐너리, scope creep 아님" 으로 결론 |

---

## 검증

TEST WORKFLOW 4스테이지 전부 PASS (수정 후 재수행):

| 스테이지 | 결과 |
|---|---|
| lint | PASS (`--max-warnings 0`) |
| unit | PASS — **backend 426 suites / 8741 tests** (기준선 425/8737 대비 **+1 suite · +4 tests** = 새 가드) |
| build | PASS |
| e2e | PASS — 276 |

> unit 래퍼의 마지막 줄 `tests=14` 는 **내부 패키지 집계**다. backend 수치는 로그 첫 블록에서
> 읽어야 한다 — 래퍼 요약만 보고 커버리지를 판단하지 않는다(이 저장소의 기록된 교훈).
