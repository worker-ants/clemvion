# RESOLUTION — `17_15_21`

CRITICAL 0 / WARNING 2. **WARNING 2건 모두 조치**했고, INFO 는 1건(#9 docstring)만
같은 커밋에서 처리한 뒤 나머지는 근거를 적어 넘겼다.

## WARNING 1 — 하드닝을 자매 지점에 미적용 (requirement)

**조치: 세 자리 전부 가드 적용** (`b3782f562`).

이건 이 저장소에서 내가 반복한 실패 형태다 — "방어의 정의를 한 칸 좁게 잡는다".
그래서 유예하지 않고 폈다. 다만 **셋을 같은 것으로 취급하지 않고 실패 방향을 각각 쟀다**:

| 지점 | 가드 없을 때 실제로 벌어지는 일 | 성격 |
|---|---|---|
| `computeChainDepth`<br>(`executions.service.ts`) | `rows[0]` undefined → `?? 1` → **depth 1** → 호출부 `depth >= RERUN_CHAIN_DEPTH_LIMIT` **통과** → 재실행 허용 | **fail-open — 정확성 결함.** RR-PL-05 체인 깊이 제한이 조용히 무력화된다. 셋 중 유일 |
| `updateExecutionStatus`<br>(`execution-engine.service.ts`) | `persisted = false`. 이 값은 "동시 cancel 이 이미 terminal 로 옮겼으니 **종결 이벤트를 내지 말라**" 는 뜻이다 → DB 는 UPDATE 됐는데 `execution.completed`/`failed` 가 **영영 발행되지 않는다** | 관측 불가능한 유실. 이 UPDATE 는 애플리케이션 트랜잭션 **밖**이라 throw 가 롤백을 부르진 못한다 — 목적은 **조용한 유실을 시끄러운 실패로** 바꾸는 것 |
| `lockNonTerminalExecutionRow`<br>(`execution-engine.service.ts`) | `live.length` undefined → `> 0` 이 false → "live 아님" 으로 호출부 중단 | **이미 fail-closed.** 가드는 진단용(조용한 중단과 진짜 중단을 구분). 트랜잭션 `manager` 를 받으므로 throw 는 admission 과 같은 이유로 롤백 |

> 리뷰어는 세 자리를 동질로 묶었지만 실측하면 아니다. `computeChainDepth` 만 방향이
> 열려 있어 여기가 진짜 결함이고, 나머지 둘은 이미 닫혀 있되 조용했다. **적용은 셋 다
> 하되 이유는 각각 다르게 기록**한다 — "전부 같은 위험" 이라고 적으면 다음 사람이
> `computeChainDepth` 의 특수성을 못 본다.

`.query(` 는 이 두 파일에서 **총 4곳**(engine 3 + executions 1)이고 전수를 셌다
(`grep -n '\.query<\|\.query('`). advisory-lock 호출 1곳은 반환값을 안 쓰므로 대상 아님.

## WARNING 2 — admission throw 시 routing context 미해제 (testing)

**조치: release 후 재전파 + 테스트 추가** (`b3782f562`).

`admitExecutionOrDefer` 호출이 `try/catch` **밖**이라, throw 하면 그 직전 등록한
`registerExecutionRouting` 이 남았다. 바로 아래 `deferred` arm 은 이미 명시 release 하는데
이 경로만 비어 있었다 — 대칭이 깨진 자리다.

트랜잭션 롤백으로 execution 은 `pending` 에 남고 BullMQ 재배달 시 재등록(덮어쓰기)되므로
대개 자가 치유되지만, **재시도가 소진되면 in-memory map 에 영구 잔류**한다. release 후
`throw err` 로 **그대로 재전파** — 삼키면 BullMQ 가 job 을 성공으로 보고 재배달하지 않는다.

테스트 갭의 원인은 `admitStub` 이 resolve 3값만 지원한 것이었다. `Error` 를 받으면
`mockRejectedValue` 를 세우도록 넓혔다.

## 검증 — GREEN 은 증거가 아니다

가드 4개를 **각각 무력화**해 대응 테스트만 실패하는지 확인했다 (뮤턴트는 구문 유효한
최소 치환, 치환 대상 개수를 assert 로 선검증, 원복은 `cp` + 절대경로):

| 뮤턴트 | 결과 |
|---|---|
| baseline | engine 444 passed / rerun 17 passed |
| M1 `updateExecutionStatus` 가드 제거 | **1 failed** / 443 passed → 사살 |
| M2 `lockNonTerminalExecutionRow` 가드 제거 | **1 failed** / 443 passed → 사살 |
| M3 admission throw 시 release 제거 | **1 failed** / 443 passed → 사살 |
| M4 `computeChainDepth` 가드 제거 | **1 failed** / 16 passed → 사살 |

4/4 사살, 각각 정확히 1건이 잡았다 — vacuous 없음. 원복 후 바이트 동일 확인.

그 외: `pnpm --filter backend lint --max-warnings 0` 통과, `tsc --noEmit` **199** (기존
baseline 동일 — 회귀 없음).

## INFO 처분

| # | 처분 |
|---|---|
| 9 | **조치** — `admitExecutionOrDefer` docstring 에 throw 계약 명시("반환 3값 + shape 이상 시 throw, 트랜잭션 롤백, 호출자는 routing release 후 재전파") |
| 1, 2, 3, 12 | 조치 불요로 리뷰어가 스스로 결론 — 동의 |
| 5, 6, 7, 8 | `chat-channel.dispatcher.spec.ts` 의 스타일 항목 4건. **이번엔 넘긴다** — 이 PR 의 diff 는 이미 리뷰 2라운드를 거쳤고, 스타일만 만지면 3라운드째 changeset 이 다시 열린다. 실동작 영향 0 |
| 10, 11 | **이전 라운드(`14_01_46`)가 이미 지적하고 의식적으로 유예한 항목의 재확인**이다. 판단을 뒤집을 새 근거가 없어 그대로 유지 |
