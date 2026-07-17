# RESOLUTION — ai-review 08_29_33 (worldGen 단일화 커밋 `3b54c8727`)

대상 범위: `7a9b4ce88..HEAD` (채널 웹챗 staleness 가드 통합). RISK CRITICAL / Critical 2 / Warning 7.

**요약**: Critical 1건은 **내가 만든 회귀로 확인**돼 수정했다. Critical 2건은 85회 재현 시도에도 재현되지 않아 **귀속을 반박**하되, 지적된 관용구 취약성 자체는 실재하므로 선제 제거했다. Warning 7건 중 W2·W5 는 리뷰어가 "잠재적"으로 분류했으나 **실측 결과 이미 활성 버그**여서 승격 처리했다.

## Critical

### C1 (side_effect) — 부팅 중 명령 → 위젯 영구 정지. **확인·수정**

리뷰어 지적대로 실재하는 회귀이며, **이번 커밋이 도입한 것**이다.

- **재현**: `embed-config` 왕복이 in-flight 인 동안 host `resetSession` 주입 → `applyConfig` 가 세대 검사에 걸려 조기 return → `config = null (영구 정지)`. 런처만 뜨고 패널은 영원히 열리지 않으며 콘솔 경고도 없다. `newChat` 의 후행 `start()` 도 `if (!cfg || !client) return` 으로 no-op 이라 자가 회복 경로가 없다.
- **귀속 A/B**: 부모 커밋(`7a9b4ce88`) 코드로 동일 시나리오 → **통과**. 즉 내 변경이 원인이다. 종전 `cancelled` 지역 플래그는 언마운트에서만 set 이라 이 경로가 **우연히** 안전했고, 세대 단일화가 그 우연을 깨뜨렸다.
- **수정**: `teardownSession()` 최상단에 `if (!configRef.current) return;` — 세계가 시작도 안 했으면 무효화할 것이 없다(리뷰어 제안과 동일). `configRef.current` 는 확립 후 null 로 되돌아가지 않으므로(할당 2곳·해제 0곳 전수 확인) 정상 경로는 무영향. 아래 `if (configRef.current) clearSession(...)` 은 이 가드로 죽은 코드가 돼 제거.
- **회귀 테스트**: `use-widget-eager-start.test.ts` "C1: embed-config in-flight 중 host resetSession → config 확립". 기존 `R9-A` 의 "booting" 은 config 확립 **후** webhook POST in-flight 라 이 창을 덮지 못했다.
- **mutation 검증**: 가드 제거 시 **C1 1건만** 실패.

#### C1-b — 이 fix 가 남긴 잔여 gap (재리뷰 `09_36_01` side_effect·security 독립 지적). **확인·수정**

C1 fix 의 근거("부팅 전엔 정리할 세션도 스트림도 타이머도 없다")는 **메모리에만 참**이고 `sessionStorage` 에는 이전 마운트/페이지 로드의 세션이 남아있을 수 있다. 그대로 조기 return 하면 그 값이 `applyConfig` 의 `loadSession` 으로 복원돼 **host 가 명시 요청한 "새 대화"가 조용히 무시되고 옛 대화가 이어진다**. 즉 C1 fix 는 "영구 정지"를 "리셋 무시"로 바꾼 셈이다(전체적으론 개선이나 새 gap).

- **재현**: 저장소에 `executionId: "OLD"` 세션을 심고 부팅 중 `resetSession` 주입 → `executionId = OLD | phase = streaming`, 저장소에 OLD 잔존. 두 리뷰어가 독립적으로 같은 경로를 지적했고 실측 일치.
- **수정**: `pendingResetRef` — `teardownSession` 이 config 미확립 시 **의도만 기록**하고, `applyConfig` 가 config 확립 직후 `loadSession` **직전**에 소비해 `clearSession()` 한다(리뷰어 제안과 동일).
- **회귀 테스트**: "C1-b: 저장 세션이 있는 채로 부팅 중 resetSession → 옛 대화가 부활하지 않는다". 기존 C1 테스트는 `beforeEach` 의 `sessionStorage.clear()` 로 시작해 이 창을 덮지 못했다(리뷰어 지적 정확).
- **mutation 검증**: `pendingReset` 소비 제거 시 40건 중 **C1-b 1건만** 실패.

### C2 (testing) — 전체 스위트 동시 실행 시 ≈13% 비결정 실패. **재현 실패 → 귀속 반박, 지적된 취약성은 선제 제거**

리뷰어는 `npx vitest run`(파일 인자 없음) 46회 중 6회(≈13%) 실패 + 부모 커밋 25회 0회 A/B 로 "이번 리팩터가 새 비결정성 도입"이라 판단했다. **동일 명령으로 총 85회 실행했으나 실패 0회**다.

| 상태 | 실행 | 실패 |
| --- | --- | --- |
| 리뷰 대상 커밋 `3b54c8727` 그대로 | 20회 | 0 |
| C1 픽스 적용 트리 | 37회 | 0 |
| CPU 부하 하(busy loop 8 / 10코어) | 8회 | 0 |
| 최종(전 수정 반영) | 20회 | 0 |

리뷰어가 제시한 13% 가 참이라면 85회 연속 무실패 확률은 ~10⁻⁵ 다. 리뷰어 자신도 격리 실행·CPU 부하 8회는 100% 안정이라 보고했고 내 부하 테스트가 그 음성 결과를 재현했다. **따라서 "리팩터가 비결정성을 도입했다"는 귀속은 지지되지 않는다.**

#### C2 원인 규명 — 재리뷰 `09_36_01` testing 이 확정 (당초 "미해결" 이월 → **종결**)

재리뷰의 testing 리뷰어가 결정적 실험을 했다:

| 환경 | 실행 | 실패 |
| --- | --- | --- |
| **격리 worktree**(다른 프로세스와 완전 분리) | 60회 | **0** |
| **공유 worktree**(리뷰 fan-out 진행 중) | 60회 | **9 (15%)** |

원인은 코드가 아니라 **리뷰 파이프라인 자신**이었다 — 병렬 sub-agent 들이 테스트가 도는 **바로 그 소스 파일을 동시에 편집**하고 있었다(`git status` 실시간 관찰, 타 프로세스가 만든 phantom 테스트 파일 오류 동반). 결정적 증거는 **순수 리듀서 함수가 "비결정" 실패**했다는 것 — JS 런타임상 코드 레이스로는 불가능한 증상이라 파일 레벨 간섭 외에는 설명이 안 된다. concurrency·requirement 리뷰어도 같은 간섭을 독립 목격했다(둘 다 line 인용을 `git show HEAD` 에 고정하거나 별도 worktree 로 우회했다고 보고).

즉 원 지적의 "6/46 ≈ 13%" 와 "부모 커밋 A/B 0건" 은 **측정 아티팩트**다 — A/B 의 부모 커밋 쪽은 별도 worktree 라 간섭을 받지 않았고, HEAD 쪽만 fan-out 이 편집 중인 공유 트리에서 측정돼 차이가 리팩터 탓으로 귀속됐다. 내 85회가 무실패였던 것도 정합적이다(그 시점엔 fan-out 이 끝나 아무도 파일을 건드리지 않았다).

**프로젝트 차원 함의**: `/ai-review` 의 flaky-test 측정은 공유 worktree 에서 신뢰할 수 없다. 향후 리뷰어가 "간헐 실패"를 보고하면 **격리 worktree 재현을 먼저 요구**해야 한다. testing 리뷰어가 이를 CRITICAL 로 올린 것도 코드가 아니라 이 방법론에 대한 것이다.

다만 리뷰어가 지목한 **근본 후보 중 하나는 코드에 실재**했다: 수동 resolve 직후의 `await Promise.resolve()` **고정 횟수 flush**(기존 **11개 지점** = 호출 14개의 연속 런 11개). 이는 프로미스 체인 길이에 대한 추측이라, 체인이 3틱 이상이면 단언이 먼저 실행돼 산발 실패한다 — 재현 여부와 무관한 취약성이므로 macrotask 1틱 flush(`flushAsync()`)로 교체했다. 현재 `flushAsync` 콜사이트 15 = 기존 치환 11 + 신규 테스트 4, 잔여 고정 flush 0. 파일 내 fake timer 는 전부 `shouldAdvanceTime: true` 라 `setTimeout` 이 정상 발화함을 확인.

> **정정(재리뷰 `09_36_01` scope 지적)**: 본 문서·커밋 메시지가 초기에 "12곳"이라 적은 것은 **내 C1 테스트를 추가한 뒤에 센 값**이었다(11 + 내가 새로 쓴 1). 기존 취약 지점은 **11곳**이 맞다. 커밋 `42e4346cf` 메시지의 "12곳" 표기도 같은 오차다.

*(초판은 "원인 미특정 → CI 재발 시 재개"로 이월했으나, 위 `09_36_01` testing 의 격리/공유 A/B 로 **원인이 확정돼 종결**한다.)*

## Warning

### W2 (동시성/부작용) — `applyConfig` 세대 재검증 비대칭. **활성 버그로 승격·수정**

리뷰어는 "현재는 활성 버그가 아니나 잠재 지뢰"로 분류했으나, **이미 활성이었다**. `seedWaitingFromStatus` 의 **catch(soft-fail) 분기가 세대 검사 없이 `"continue"` 를 반환**하기 때문이다:

1. 복원 seed 의 `getStatus` 가 네트워크 오류로 reject
2. 그 사이 새 대화 시작 → 세대 증가
3. catch → `"continue"` 반환 (세대 무시)
4. `outcome` 만 보는 `applyConfig` 통과 → 옛 세션으로 `openStream` + `scheduleRefresh` → **스트림 탈취 + 지운 storage 부활**

`start()` 는 뒤에 명시적 세대 재검사가 있어 우연히 무사했다 — **리뷰어가 지적한 그 비대칭이 곧 버그였다**. 네트워크 오류는 정상 조건이라 실제로 닿는 경로다.

- **수정**: (a) choke point 인 catch 분기에 `if (worldGenRef.current !== gen) return "stale";` (b) `applyConfig` 에도 `start()` 와 동형의 명시적 세대 재검증 추가.
- **회귀 테스트**: "W2: 복원 seed 가 network 오류로 soft-fail 해도 새 대화 스트림을 옛 세션이 탈취하지 않는다".
- **mutation 검증** (앵커 일치를 명시 assert 하고 치환 — 초회 시도는 조용히 매치 실패했다): **둘 다 없으면 실패**(버그 실재) → **(a)만 있으면 통과**(catch 픽스만으로 충분) → **(a)+(b) 통과**((b)는 오늘은 중복이지만 `seedWaitingFromStatus` 내부에 await 이 추가되는 순간을 대비한 defense-in-depth).

> **정정(재리뷰 `09_36_01` requirement 지적)**: 본 문서 초판은 위를 "gen 검사 7개/8개/9개" 표로 제시했으나 **수치가 전부 +1** 이었다 — `grep` 이 JSDoc 계약 설명문 **안의 예시 코드 조각**(`if (worldGenRef.current !== gen) return;`)까지 실제 검사로 셌다. 실제는 6→7→8 이다. 질적 결론(어느 조합에서 통과/실패하는지)은 그대로 유효하나, 검산되지 않은 정확한 수치를 표로 제시한 것이 잘못이라 **상태 서술로 대체**했다(그 사이 `isStale(gen)` 추출로 원래 카운트 자체가 무의미해지기도 했다). 교훈: 주석 속 예시 코드가 같은 패턴 문자열을 포함하면 grep 카운트가 오염된다 — 이 표가 스스로 "초회 시도는 조용히 매치 실패했다"고 적은 것과 같은 종류의 함정이다.

### W5 (유지보수성) — `useTokenRefresh` 의 4번째 독립 가드. **활성 버그로 승격·통합**

리뷰어 지적대로 `cancelledRef` 는 언마운트에서만 set 되고 `teardownSession()` 은 잡지 못했다. `refreshToken` in-flight 중 새 대화가 시작되면 `clearRefreshTimer()` 는 **이미 떠 있는 요청을 막지 못하고**, 지연 resolve 가 `sessionRef.current` 를 옛 세션으로 덮고 `saveSession()` 으로 방금 지운 storage 를 되살린다.

- **수정**: `TokenRefreshDeps` 에 `worldGenRef` 주입 → 요청 직전 세대 캡처 → `.then()` 에서 재검증. `cancelledRef` 는 제거(세대가 언마운트를 포함한 모든 무효화를 덮으므로 중복). 언마운트 effect 는 타이머 정리만 담당.
- **cross-hook 계약 위험**: 이 훅은 이제 "소유자가 언마운트 시 세대를 올린다"에 의존한다. 그 계약이 바로 **W3 가 미검증이라 지적한 지점**이라, W3 테스트를 먼저 추가해 보호했다.
- **회귀 테스트**: "W5: refresh in-flight 중 세대 변경(새 대화) → 지연 응답이 세션·storage 를 되살리지 않는다". mutation: 세대 검사 제거 시 11건 중 **W5 1건만** 실패.

### W3 (테스트) — 언마운트 세대 증가 미검증. **수정**

리뷰어 실증대로 해당 줄을 제거해도 364건 중 0건도 실패하지 않았다.

- **회귀 테스트**: "W3: webhook POST in-flight 중 언마운트 → 지연 응답이 storage·SSE 를 되살리지 않는다". 세대 증가가 없으면 지연 응답이 `persist()` 로 storage 를 쓰고 `openStream`/`scheduleRefresh` 로 스트림·타이머를 되살린다.
- **mutation 검증**: 언마운트 bump 제거 시 39건 중 **W3 1건만** 실패 (0건 → 1건).

### W4 (동시성/테스트) — 리듀서 defense-in-depth 부재. **수정**

plan 스스로 "직접 원인"이라 지목한 `widget-state.ts` `case "WAITING"` 의 무조건 전이에 가드 추가: `if (state.phase === "ended") return state;`. 대화 재개는 `ended` 를 먼저 벗어난 **뒤** WAITING 을 받으므로(`START`→`booting` / `NEW_CHAT`→`panel`), `ended` 인 채 도착한 WAITING 은 정의상 옛 세계의 것이다.

- **회귀 테스트**: "W4: ENDED 이후 WAITING → 무시"(유령 메시지가 스레드에 섞이지 않는 것까지 단언) + 재개 경로 `it.each` 2건(`START`·`NEW_CHAT` 각각 이후의 WAITING 이 정상 동작 — 가드가 재개를 막지 않음).
- **mutation 검증**: 가드 제거 시 W4 1건만 실패. 가드를 과잉(`panel` 도 차단)으로 바꾸면 `NEW_CHAT` 재개 케이스만 실패 — 양방향으로 고정됨.

> **정정(재리뷰 `09_36_01` documentation·maintainability 독립 지적)**: 본 문서 초판은 "`ended` 를 벗어나는 **유일한** 액션은 `START`(전수 확인)"이라 단언했으나 **틀렸다**. `NEW_CHAT`(대화 종료 후 새 대화라는 가장 흔한 흐름)도 벗어나고, 더 나아가 `RESTORED`/`BOOTED`/`USER_MESSAGE` 도 `state.phase` 를 검사하지 않고 무조건 전이한다 — 즉 그런 리듀서 레벨 불변식은 **애초에 없다**. 원인은 내 grep 이 `RESET` 을 찾고 `NEW_CHAT` 을 찾지 않은 것이고, "전수 확인"이라는 표현이 실제 검증 범위(당시엔 호출 그래프 일부)를 넘어섰다. **가드 자체의 안전성에는 영향 없음**(`NEW_CHAT` 은 `phase: "panel"` 로 먼저 벗어나므로 후속 WAITING 은 정상 통과 — 테스트로 고정). 리듀서 주석·테스트명·본 문서를 정정했다.
>
> **`RESTORED`/`BOOTED` 로의 가드 확대는 후속으로 남긴다** — 리뷰어는 "비용이 낮으니 확대해 문구를 참으로 만들라"고 제안했으나, 현재 호출부가 `ended` 에서 그 액션들을 디스패치하지 않아 **실패 사례가 없고**, 이번 라운드의 C1 이 바로 "명백히 안전해 보이는 가드가 영구 정지를 만든" 사례다. 재현된 표면(WAITING)만 막고, 확대는 근거가 생기면 한다.
- **미조치**: 리뷰어가 함께 지적한 `handleEiaEvent` 의 직접 SSE `waiting_for_input` 분기는 await 경계가 없어 세대 가드 대상이 아니다. 이제 위 리듀서 가드가 그 경로도 함께 덮는다.

### W1 (동시성/문서화) — JSDoc "무효화 지점 두 곳뿐" 부정확. **수정**

4개 리뷰어가 독립 지적. 실제 지점은 셋(`teardownSession()` / `start()` / 언마운트 cleanup)이라 JSDoc 을 셋으로 정정하고 각 지점의 역할·`teardownSession` 의 부팅 전 no-op 조건을 명시.

### W6 (문서화) — CHANGELOG 누락. **수정**

"Unreleased — 웹채팅 위젯" 에 항목 5(종료된 위젯 부활 버그 수정 + 세대 통합 + W2·W5 동형 결함 + 리듀서 방어선) 추가. 아울러 리뷰어 지적대로 **기존 항목 4 를 정정**했다 — "유령 표면을 그리지 않는다" 는 이 fix 이전엔 재현된 반례가 있어 성립하지 않던 문구였다. 이제 항목 4 는 세션 **교체**(오종료 방지)만 주장하고, **종료** 경로는 항목 5 가 담당한다.

### W7 (유지보수성) — 테스트 JSDoc 의 죽은 참조. **수정**

`use-widget-eager-start.test.ts:231` 의 `startGenRef`(현존하지 않는 식별자) → "세대 가드". `use-widget.ts:147` 의 동일 문자열은 "종전에는 …" 이라는 **의도적 과거 서술**이라 유지.

## 검증

- **TEST WORKFLOW**: lint PASS(57s) · unit PASS(72s, `tests=14 passed`) · build PASS(120s).
- **build 가 vitest 가 놓친 타입 오류 검출**: W4 테스트 픽스처의 `DisplayMessage.source` 누락 — vitest 는 타입체크를 하지 않으므로 `tsc` 가 authoritative 임을 재확인.
- **channel-web-chat**: 22 파일 **371건 전부 통과**. 신규 **7건**(vitest 실측, 리뷰 시점 커밋 `3b54c8727` 과 파일별 대조) — `use-widget-eager-start` 36→40(C1·C1-b·W2·W3), `use-token-refresh` 10→11(W5), `widget-state` 37→39(W4 + 재개 경로 `it.each` 2케이스).
- **신규 테스트 전부 mutation 검증** — 각각 대응 가드를 제거했을 때 **그 테스트만** 실패함을 확인.

> **정정(재리뷰 `09_36_01` documentation 지적)**: 본 문서 초판의 `widget-state` "31→33" 은 오기다(실측 **37→39**). 원인은 내가 `grep -cE "^\s+it\("` 로 센 것 — 그 정규식이 `it.each`·중첩 들여쓰기를 놓쳐 과소 계수했고, 같은 문서 다른 절이 인용한 vitest 실측치(39)와 자기모순이었다. **vitest 실행 결과가 authoritative** 이므로 전 수치를 그 기준으로 재산출했다.
- e2e: 본 변경은 channel-web-chat 클라이언트 단위 로직이며 백엔드 계약·마이그레이션 무변경.

## 이월

- **리듀서 `ended` 가드를 `RESTORED`/`BOOTED` 로 확대** — 실패 사례가 확인되면. 위 W4 절의 근거 참조.
- **세대 가드의 구조적 승격** — 이번엔 `isStale(gen)` named predicate 까지만 했다. `guardedAwait(gen, promise)` 로 "await 후 자동 재검증"을 캡슐화하면 관용구 누락 자체가 불가능해지나, 호출부 시그니처가 바뀌어 blast radius 가 크다(`09_36_01` maintainability 제안).
- **W2 회귀 테스트의 가드 독립성** — (a)·(b) 중 하나만 있어도 통과해 개별 가드를 독립적으로 고정하지 못한다(`09_36_01` testing 지적). 이는 defense-in-depth 의 의도된 중복이라 현 시점 조치 없이 기록만 한다.
- `fetchMock` 미사용 lint warning(`use-widget-eager-start.test.ts`)은 **기존 것**(리뷰 대상 커밋에도 존재)이라 스코프 밖으로 뒀다.

## 재리뷰 `09_36_01` 총평

이번 라운드 조치를 다시 8인 리뷰에 걸었고, **CRITICAL 1(코드 아님 — 위 C2 방법론)·WARNING 다수**가 나왔다. 실질 성과:

- **내 fix 가 남긴 gap 을 4인이 독립 발견**(side_effect·security·requirement·concurrency) → `pendingResetRef` 로 봉합. C1 fix 는 "영구 정지"를 "리셋 무시 + 옛 대화 부활"로 바꿨을 뿐이었고, 저장소가 비었을 땐 "패널만 열린 빈 화면"이 됐다(둘 다 재현). 이제 `newChat()` 재생으로 정상 경로를 탄다.
- **C2 원인 확정**(위) — 내 반박은 옳았으나 원인은 리뷰 파이프라인 자신이었다.
- **RESOLUTION 자체의 정량 오류 3건 적발**(flush "12곳"→11, `widget-state` "31→33"→37→39, W2 표 +1) — 전부 정정. 질적 결론은 모두 유지됐으나, **검산 없이 정확한 수치를 표로 제시한 것** 자체가 이 문서의 감사 신뢰도를 떨어뜨렸다. 세 오류 모두 원인이 같다: **grep/정규식 카운트를 실측으로 착각**(주석 속 예시 코드 오염, `it.each` 미포착, 내 테스트 추가 후 계수). vitest·git diff 실행 결과만 authoritative 로 삼는다.
- **"가드는 규율이지 구조가 아니다"를 스스로 어긴 점 적발** — 그 교훈을 plan 에 적어놓고 정작 관용구를 손으로 또 복제했다. `isStale(gen)` 로 승격(전 지점 grep 가능, mutation 으로 강도 보존 확인).
