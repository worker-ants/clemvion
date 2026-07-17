# RESOLUTION — ai-review 09_36_01 (직전 라운드 `08_29_33` 조치 커밋 재검토)

대상 범위: `3b54c8727..HEAD`(`42e4346cf` 코드 fix + `31a7ce4fc` 리뷰 산출물). RISK MEDIUM / Critical 1 / Warning 7 / INFO 8. 8인 reviewer 실행.

**요약**: Critical 1건은 **코드 결함이 아니라 리뷰 파이프라인의 측정 방법론** 문제로, 오히려 직전 라운드 C2 의 원인을 확정해줬다. Warning 7건 중 6건 조치·1건 문구 정정으로 종결, INFO 2건 추가 반영. 이 라운드의 최대 성과는 **내 C1 fix 가 남긴 gap 을 4인이 독립 발견**한 것이다.

**진행 특성 주의**: 이 파이프라인은 SUMMARY 확정 이전에 개별 reviewer 산출물을 근거로 fix 착수가 가능하다. 실제로 아래 조치 대부분이 SUMMARY 작성 시점에 이미 커밋(`61cf83608`·`591350e10`)돼 있었고, summary agent 가 이를 "사후 확인"으로 교차검증했다.

## Critical

### C1 (테스트 인프라) — C2 비결정 실패의 원인은 리뷰 파이프라인 자신. **코드 조치 불요·직전 라운드 종결**

testing 리뷰어의 격리/공유 A/B 가 결정적이었다:

| 환경 | 실행 | 실패 |
| --- | --- | --- |
| 격리 worktree(`git worktree add --detach`) | 60회 | **0** |
| 공유 worktree(fan-out 진행 중) | 60회 | **9 (15%)** |

병렬 sub-agent 들이 **테스트가 도는 바로 그 소스 파일을 동시 편집**하고 있었다. 결정적 증거는 **순수 리듀서 단위테스트(비동기·타이머 없음)가 "타이밍"으로 실패**한 것 — 코드 레이스로는 불가능하므로 파일 레벨 간섭 외 설명이 없다. concurrency·requirement 리뷰어도 같은 간섭을 독립 목격했다.

- **직전 라운드 C2 의 오귀속 메커니즘도 설명된다**: A/B 의 부모 커밋 쪽은 별도 worktree 라 간섭이 없었고 HEAD 쪽만 fan-out 이 편집 중인 공유 트리에서 측정돼, 그 차이가 통째로 리팩터 탓이 됐다. 내 85회가 무실패였던 것도 정합적이다(fan-out 종료 후 측정).
- **조치**: `08_29_33/RESOLUTION.md` §C2 를 "원인 미특정 이월" → **"원인 확정·종결"** 로 갱신(커밋 `591350e10`). 코드 변경 없음.
- **프로젝트 차원**: `/ai-review` 의 flaky 판정은 공유 worktree 에서 신뢰할 수 없다. 향후 리뷰어가 간헐 실패를 보고하면 **격리 worktree 재현을 먼저 요구**한다. 세션 메모리에 기록했다.

## Warning

### W1 — C1 fix 가 남긴 부팅-리셋 소실 gap (**4인 독립 발견**). **확인·수정**

side_effect·security·requirement·concurrency 가 각자 도달한 이 라운드의 핵심 발견. C1 fix 의 근거("부팅 전엔 정리할 게 없다")는 **메모리에만 참**이고 `sessionStorage` 의 이전 세션은 놓친다. 실측 재현 2종:

| 사전 상태 | 증상 |
| --- | --- |
| 저장 세션 **있음** | `applyConfig` 의 `loadSession` 이 복원 → **옛 대화가 이어짐**(`executionId=OLD`, `phase=streaming`, 저장소에 OLD 잔존) — host 의 "새 대화" 요청이 조용히 무시 |
| 저장 세션 **없음** | 패널만 열리고 **대화 미시작**(`phase=panel`, `open=true`, webhook POST **0**) |

즉 C1 fix 는 "영구 정지"를 "리셋 소실"로 바꿨을 뿐이었다(전체적으론 개선이나 gap).

- **수정**: `pendingResetRef` — `teardownSession` 이 config 미확립 시 **의도만 기록**하고, `applyConfig` 가 config 확립 직후 `loadSession` **전에** `apiRef.current.newChat()` 을 **재생**해 정상 경로(정리 → 저장소 삭제 → 세대 증가 → NEW_CHAT → start)를 전부 태운다. 복원 분기는 의미가 없으므로 조기 return.
  - 리뷰어 제안(`clearSession` 만)보다 한 걸음 더 갔다 — 저장소만 지우면 위 표의 **두 번째 행(빈 패널)** 이 남기 때문이다. 그 사실도 실측 후 확인했다.
- **회귀 테스트**: "저장 세션이 있는 채로 부팅 중 resetSession → 옛 대화가 부활하지 않는다" — config 확립(C1 유지)·옛 세션 미복원·**새 대화 실제 시작**(webhook POST 1회) 3단 단언.
- **mutation 검증**: (a) `newChat()` 재생만 제거(저장소 삭제만) → 실패 / (b) 소비 전체 제거 → 실패 / 원복 → 40/40 통과. SUMMARY 권장조치 #1("mutation 검증까지 통과하는지 재확인")을 충족한다.

### W2 — "`ended` 를 벗어나는 유일한 액션은 `START`" 단언 반증 (**3인 독립 발견**). **정정**

`NEW_CHAT`(가장 흔한 재개 흐름)도 벗어나고, `RESTORED`/`BOOTED`/`USER_MESSAGE` 도 `state.phase` 검사 없이 무조건 전이한다 — **그런 리듀서 레벨 불변식은 애초에 없다**. 내 grep 이 `RESET` 만 찾고 `NEW_CHAT` 을 안 찾은 결과이며, "(전수 확인)" 이 실제 검증 범위를 넘어섰다.

- **가드 안전성에는 영향 없음** — `NEW_CHAT` 은 `phase: "panel"` 로 먼저 벗어나므로 후속 WAITING 은 정상 통과한다.
- **수정**: 리듀서 주석을 "가드 범위는 WAITING 뿐 — RESTORED/BOOTED/USER_MESSAGE 도 무조건 전이하므로 그 불변식은 아직 없다"로 정정. 테스트명·`08_29_33/RESOLUTION.md` 도 정정. 재개 경로 2케이스(`START`·`NEW_CHAT`)를 `it.each` 로 고정.
- **mutation 검증**: 가드를 과잉(`panel` 도 차단)으로 바꾸면 `NEW_CHAT` 재개 케이스만 실패 → 양방향 고정.
- **`RESTORED`/`BOOTED` 확대는 후속으로 보류** (SUMMARY 권장조치 #2). 리뷰어는 "비용 낮으니 하라"고 했으나 **실패 사례가 없고**, 이번 라운드의 C1 이 바로 "명백히 안전해 보이는 가드가 영구 정지를 만든" 사례다. 근거 없이 넓히지 않는다 — 이 판단과 근거를 코드 주석·plan·`08_29_33/RESOLUTION.md` 이월 절에 고정했다.

### W3 — RESOLUTION 정량 오류 3건 (**3인 독립 발견**). **정정**

| 내가 쓴 값 | 실제 | 원인 |
| --- | --- | --- |
| flush "12곳" | **11곳** | 내 테스트를 추가한 **뒤에** 셌다 |
| `widget-state` "31→33" | **37→39** | 정규식이 `it.each`·중첩 들여쓰기 미포착 |
| W2 mutation 표 "7/8/9" | **6/7/8** | **JSDoc 주석 속 예시 코드**를 실제 검사로 카운트 |

- 질적 결론은 3건 모두 유지됐다 — 문제는 **검산 없이 정확한 수치를 표로 제시한 것** 자체다.
- **수정**: 세 수치 정정 + W2 표는 아예 **상태 서술로 대체**(그 사이 `isStale` 추출로 원 카운트가 무의미해지기도 했다). "vitest·git diff 실행 결과만 authoritative" 원칙을 명문화하고 세션 메모리에 기록.
- maintainability 가 W2 표를 재계산해 "정확하다"고 교차검증했으나 그쪽이 오판이었다(requirement 가 맞음) — **교차검증도 항상 신뢰할 수 없다**는 사례로 기록해 둔다.

### W4 — 테스트 라벨 `"C1"` 이 spec 불변식 ID 와 충돌. **수정**

`C1` 은 이미 **공식 spec 불변식**("보류 메시지 큐 게이팅", `spec/7-channel-web-chat/1-widget-app.md`, 5개 파일 참조)이고 같은 테스트 파일에 그 의미의 `"C1:"` 테스트가 2건 있었다. 내 `W2`/`W3`/`W5` 라벨도 같은 병이었다(이 파일의 기존 `W5`/`W7`/`W8` 은 **다른 라운드** 지적).

- **수정**: 신규 테스트 제목을 전부 서술형으로 바꾸고, 라운드 참조는 파일 기존 관례대로 리드 주석에만 뒀다(`(ai-review 2026-07-17 08_29_33 W3)` 형식).

### W5 — 세대 가드 관용구 손복제 (내가 적어둔 교훈을 내가 어김). **수정**

plan 에 **"가드는 규율이지 구조가 아니다"** 라 적어놓고, 정작 이번 fix 는 recheck 를 2곳 **또** 손으로 추가했다. W2(catch 분기 누락) 자체가 이 복제 누락에서 나온 버그였다.

- **수정**: `const isStale = useCallback((gen: number) => worldGenRef.current !== gen, [])` 로 승격, 전 지점 치환. 의도가 이름으로 드러나고 `isStale` grep 하나로 전 지점을 센다.
- **mutation 검증**: `isStale` 을 항상 `false` 로(=전 가드 무력화) → **7건 실패**, 원복 → 40/40. 리팩터가 가드 강도를 보존했음을 확인.
- **더 나아간 구조화(`guardedAwait(gen, promise)`)는 이월** — 호출부 시그니처가 바뀌어 blast radius 가 크다.

### W6 — W2 회귀 테스트가 두 가드를 **개별로** 고정하지 못함. **문구 정정으로 종결**

(a) catch 분기 세대검사 / (b) `applyConfig` 재검증이 동일 `gen` 을 비교하는 중복이라 **어느 하나만 제거해도 통과**한다(둘 다 제거해야 실패).

- 이는 **의도된 defense-in-depth 중복**이다. `08_29_33/RESOLUTION.md` §W2 는 이미 이를 정확히 서술한다 — "(a)만으로 충분", "(b)는 오늘은 중복이지만 `seedWaitingFromStatus` 내부에 await 이 추가되는 순간을 대비한 defense-in-depth", 그리고 3단 상태 서술(둘 다 없으면 실패 → (a)만 통과 → (a)+(b) 통과). 리뷰어가 요구한 "상호 대체 가능한 중복 방어" 표현과 동치다.
- `seedWaitingFromStatus` 단위 테스트 분리는 하지 않았다 — 훅 내부 클로저라 직접 호출이 어렵고, (b) 는 설계상 오늘 중복인 것이 맞다. **이월** 절에 기록.

### W7 — W5 테스트가 없애자던 관용구를 새로 도입. **수정**

"고정 횟수 microtask flush 는 취약하니 제거" 라 해놓고 같은 커밋의 W5 테스트(`use-token-refresh.test.ts`)에 `await Promise.resolve()` 를 새로 넣었다. 정확한 지적이다.

- **수정**: 이 파일은 fake timer(`shouldAdvanceTime: true`)를 쓰므로 파일 관례에 맞춰 `await vi.advanceTimersByTimeAsync(0)` 로 교체(0ms 전진이 대기 microtask 를 전부 배출). 교체 후 mutation 재확인 — 세대 검사 제거 시 여전히 W5 만 실패.

## INFO 반영

- **INFO#2 (JSDoc "3종")** — 이번에 통합된 4번째 축(`useTokenRefresh` 의 `cancelledRef`)을 반영해 **"4종"** 으로 정정. "앞의 3종은 이 파일 안, 4번째는 이미 분리된 훅 안이라 더 눈에 안 띄었다"는 맥락도 함께 남겼다.
- **INFO#7 (`configRef` null 불변식 의존)** — 조기 return 이 "부팅 전"을 뜻하는 근거가 "확립 후 null 로 안 돌아간다"(대입 2곳·해제 0곳)라는 **수작업 감사**에만 의존한다는 지적. 향후 `configRef.current = null` 을 도입하면 정상 세션의 teardown 이 조용히 no-op 이 되므로, 그 경고를 조기 return 주석에 고정했다.
- **INFO#1 (unmount + refreshToken in-flight 종단 테스트 부재)** — concurrency 리뷰어가 **cleanup 순서 무관 안전**을 증명했다(두 cleanup 모두 동기 함수라 JS run-to-completion 에 의해 `.then()` microtask 실행 전 항상 완료). 구성요소는 각각 고정돼 있어(W3=실제 unmount, W5=세대 변화 감지) 종단 테스트는 추가하지 않았다. **이월**.
- INFO#3(서사 4중 반복)·#4(6건 중 1건은 mutation 성격 아님)·#5(`AI_MESSAGE` 가드)·#6(host-bridge pre-boot origin)·#8(85회 로그 미보존) — 기록만. #4 는 `08_29_33/RESOLUTION.md` 에서 "가드-제거 mutation"과 "가드-과잉 mutation"을 구분 서술하는 것으로 반영했다.

## 검증

- **TEST WORKFLOW**(최종): lint PASS(58s) · unit PASS(71s, `tests=14 passed`) · build PASS(120s).
- **channel-web-chat**: 22 파일 **372 passed**(vitest 실행 기준 — 이번 라운드 §W3 의 교훈대로 grep 카운트를 쓰지 않는다).
- 신규 회귀 테스트는 각각 mutation 검증(대응 가드 제거 시 **그 테스트만** 실패). §W1 의 fix 는 두 절반(저장소 삭제 / `newChat` 재생)을 **각각** 무력화해 양쪽 다 검증했다.
- **워크트리 위생**: 리뷰어들이 진단용으로 남길 수 있던 scratch 테스트 파일·`console.log` 잔재 없음을 커밋 전 확인(리뷰어 스스로 복원 보고와 일치).

## 이월

- **`RESTORED`/`BOOTED` 로의 `ended` 가드 확대** — 실패 사례 확인 시. 근거는 §W2.
- **`guardedAwait(gen, promise)` 로의 구조 승격** — `isStale` 까지만 했다. 관용구 누락 자체를 불가능하게 하나 blast radius 가 크다.
- **W2 가드의 개별 회귀 고정** — 의도된 중복이라 현 시점 조치 없음(§W6).
- **`useTokenRefresh` 종단 테스트**(unmount + refresh in-flight) — 안전성은 증명됨(INFO#1).
- **리뷰 파이프라인 정책** (SUMMARY 권장조치 #4) — flaky 판정의 격리 worktree 절차화, SUMMARY 확정 전 fix 착수 레이스의 정책 정리. 본 저장소 코드가 아니라 `.claude/` 오케스트레이션 영역이라 별도 트랙.
