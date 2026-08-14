# RESOLUTION — `22_55_51`

ai-review **CRITICAL 1 / WARNING 10**. CRITICAL 포함 전부 조치. 리뷰어 제안 중 **둘은
실측 후 채택하지 않았고**, 한 건은 **리뷰어 주장이 절반만 맞았다**.

## 🔴 CRITICAL — wire 를 바꾸면서 프런트엔드 소비자를 안 셌다

**지적이 정확했고, 이번 브랜치에서 같은 클래스의 실수를 또 했다.**

`execution.failed` 의 `error` 를 string → object 로 바꿨는데, **같은 payload 를 내부 에디터
WS 채널이 소비한다.** `use-execution-events.ts` 는 `data as { error?: string }` 로 받아
스토어에 넣고, `ConversationInspector` 의 `ToolDetail` 이 `{item.error}` 를 **JSX child 로
직접 렌더**한다 → `Objects are not valid as a React child`.

**타입체커가 침묵한 이유**: `as` 는 **캐스팅이지 검증이 아니다**. 백엔드가 형태를 바꿔도
프런트 캐스팅은 그대로 컴파일된다. (이 세션에서 같은 교훈을 `updateReturningRows<T>` 로
한 번 겪었다 — 제네릭 인자도 단언이지 검증이 아니었다.)

**조치**: 경계에서 정규화. 같은 파일의 `node.failed` 핸들러가 **이미 쓰던 관용구**
(`typeof x === 'string' ? x : x?.message`)로 통일했다. 스토어·렌더 지점은 계속 `string` 을
받으므로 하류를 건드리지 않는다.

**회귀 테스트 + 판별력 확인**: 객체 fixture 로 "스토어에 객체가 들어가지 않는다" 를 고정.
fix 를 되돌린 뮤턴트에서 **RED** 확인 — 기존 프런트 테스트가 문자열만 전제해 이 계약
불일치를 못 잡았던 것이 결함이 통과한 이유다.

> **교훈**: 직전 PR 에서 `llmCalls` 출구를 셋 세다 하나씩 놓쳤고, 그 PR 에서 *"내부 WS
> 채널은 full payload 를 유지해야 한다"* 고 **내가 직접 적었다**. 그 채널이 이 payload 를
> 읽는다는 걸 알면서도 백엔드 출구만 셌다. **wire 를 바꿀 때 세어야 하는 것은
> "백엔드 소비자" 가 아니라 "그 wire 를 읽는 전부" 다.**

## 채택하지 않은 제안 2건 (실측 근거)

### W6 — `EiaFailedEvent.error.nodeId` 의 `?` 제거 → **미채택**

리뷰어: `toTerminalErrorPayload` 가 항상 채우니 optional 은 실제 불변식보다 약하다.

**해 보니 13개 fixture 가 타입 오류를 냈고, 그게 옳은 신호였다.** 이 타입은 producer 가
아니라 **consumer 쪽 계약**이다 — 배포 경계에서 재생되는 레거시 이벤트와 dispatcher 의
문자열 흡수 경로는 `nodeId` 를 갖지 않는다. 필수로 만들면 **타입이 현실보다 넓은 보장을
주장한다**. optional 유지 + 근거를 타입 옆에 기록.

다만 리뷰어의 나머지 절반(세 곳 독립 선언)은 받았다 — dispatcher 로컬 타입을
`EiaFailedEvent['error']` 재사용으로 바꿔 선언을 셋에서 둘로 줄였다.

### W2 — `message`/`details` 에 secret 마스킹 → **이번 PR 미적용, 근거 기록**

리뷰어: `error.message` 는 임의 예외 원문이고 WS/SSE 경로는 키-이름 마스킹만 통과한다.

**노출이 이 PR 로 넓어지지 않는다** — 종전에도 같은 `errMessage` 문자열이 같은 fanout 을
탔다. 형태만 바뀌었지 내용과 경로는 동일하다. 따라서 이건 **선존 갭**이고, 이 PR 에
얹으면 `durationMs` 를 "비용이 다르다" 고 떼어낸 판단과 앞뒤가 안 맞는다.
`spec-sync-external-interaction-api-gaps.md` 에 등재한다.

## 리뷰어가 절반만 맞은 건 (W8)

"`finalizeStalledExhausted` 와 `finalizeFailedExecution` 두 곳 다 `error` 값 단언이 없다"

- `finalizeStalledExhausted` — **맞다.** `toHaveBeenCalled()` 로 호출 여부만 봤다. 값 단언
  추가(DB 와 같은 문구가 나가는지가 이 변경의 요점이다)
- `finalizeFailedExecution` — **틀리다.** 이번 diff 로 내가 갱신한 단언이 이미 덮는다.
  **뮤테이션으로 확인**(`error: null` 로 바꾸니 RED)

## 나머지 WARNING (조치 완료)

| # | 조치 |
|---|---|
| W3 | JSDoc 이 "시스템 `execution.cancelled` 도 커버" 라 주장했는데 호출부는 전부 `FAILED` 였다 → 범위를 실제 구현으로 좁히고 cancelled 통일이 `durationMs` 와 같은 비용 그룹임을 명시. **문서한 보장이 구현보다 넓으면 안 된다** |
| W4 | §6 표 `error` 행의 *"일부 경로는 string"* 캐비엇이 이 PR 로 거짓이 됐다 → 갱신. `cancelled` 캐비엇은 **유지**(그쪽은 실제로 아직 손으로 만든다) |
| W5 | breaking change 를 CHANGELOG 에 명시(버전 신호가 없는 저장소라 문서가 유일한 통지 경로) |
| W7 | `stalledError` 를 도입한 이유(손으로 반복하면 갈린다)가 30줄 아래 자식 cascade 에서 그대로 재현되고 있었다 → `stalledError.code` 참조 |
| W9 | `bigint` 분기가 뮤테이션에서 조건을 지워도 GREEN — 세 `typeof` 를 한 줄에 묶고 하나만 재고 있었다 → 케이스 추가 |
| W10 | CHANGELOG 신설 |
| W11 | plan 체크리스트 갱신 + CRITICAL 의 교훈을 그 자리에 기록 |

## INFO 넘김

| # | 처분 |
|---|---|
| 12·13·17 | positive finding (fail-closed 유지·prototype pollution 없음·입력 미변형) |
| 14 (dispatcher 내러티브 주석) | 유지. 없는 plan 을 가리키던 포인터를 방금 걷어낸 자리라, **왜 걷어냈는지**가 남아야 같은 주석이 다시 생기지 않는다 |
| 15 (dispatcher object 분기 런타임 미검증) | pre-existing, 동일 프로세스 참조 전달이라 실질 위험 낮음 |
| 16 (warn 로그 `code` 값 변화) | 저장소 내 소비자 0건 확인. 외부 대시보드가 있다면 영향 — CHANGELOG 에 기재 |
| 18 (스칼라 분기 과설계) | `no-base-to-string` lint 대응으로 나뉜 것이고, 나눈 뒤 테스트를 붙였다 |

## 검증

- 백엔드 **424 suites / 8674 passed** · lint `--max-warnings 0` · 타입 오류 **199**(래칫 동일)
- 프런트엔드 WS + spec 가드 **27 files / 3115 passed**
- CRITICAL fix 판별력: fix 되돌린 뮤턴트에서 RED
- W8 판정: `finalizeFailedExecution` 뮤턴트가 죽는 것을 확인해 리뷰어 주장 절반을 반증
