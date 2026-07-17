# 요구사항(Requirement) Review — 08_29_33 후속 조치(C1/W2/W3/W4/W5) 검증 (2026-07-17 09_36_01)

대상 커밋: `42e4346cf`(fix C1·W2·W5 + W4·W1·W7·W6) + `31a7ce4fc`(RESOLUTION/SUMMARY 등 review 산출물 커밋).
검증 방법: 정적 리뷰 + **직접 mutation 테스트**(가드 라인을 제거/치환 후 vitest 실행 → 원상복구, 매 회 `git diff --stat` clean 확인) +
`spec/7-channel-web-chat/1-widget-app.md §3.1` 대조 + 리듀서 단위 스크래치 테스트(작성 후 삭제).

## RESOLUTION.md 표본 검증 결과 (요청받은 4개 단언)

| 단언 | 판정 | 근거 |
|---|---|---|
| "신규 테스트 6건 전부 mutation 검증" | **대체로 사실, 근소한 표현 과장** | C1·W2(a+b)·W3·W4·W5 5개 가드를 직접 제거 후 재실행 — 각각 **정확히 그 테스트만** 실패함을 5/5 확인(아래 표). 다만 6번째 테스트("START 는 ended 를 벗어나는 유일한 경로")는 제거할 "대응 가드"가 없는 정상 경로 고정 테스트라 "전부 mutation 검증"이라는 표현이 이 테스트에는 엄밀히 맞지 않음(아래 발견사항 참고). |
| "85회 재현 실패" | **불일치 증거 없음, 완전한 독립재현은 불가** | 표 자체(20+37+8+20=85)는 내부적으로 일관. 본 리뷰에서도 동일 방법(`npx vitest run` 전체 스위트) **20회 추가 실행 → 실패 0건**으로 결과 방향은 일치. 다만 원 46회/85회 실행의 로그·아티팩트가 저장돼 있지 않아 정확한 횟수 자체는 감사(audit) 불가능 — RESOLUTION 도 이를 "미해결로 남김"이라 스스로 밝혀 투명함. |
| "W2 는 활성 버그였다" | **사실 — 직접 재현 확인** | catch 분기의 세대검사(a, L380)와 `applyConfig` 재검증(b, L718)을 모두 제거하면 신규 W2 테스트가 **`getEs()` 가 새 EventSource 로 바뀌는 실제 스트림 탈취**로 실패(아래 표). "잠재 지뢰"가 아니라 실제 도달 가능한 경로였다는 RESOLUTION 의 주장은 코드로 뒷받침됨. |
| "리듀서 `ended` 를 벗어나는 유일한 액션은 START" | **사실이 아님 — 반증됨** | 아래 [발견사항 2] 참조. `widget-state.ts` 의 `BOOTED`/`RESTORED` 케이스도 `state.phase` 와 무관하게 무조건 `"streaming"` 으로 전이한다. 순수 리듀서 테스트로 직접 재현(`ENDED`→`BOOTED`⇒`streaming`, `ENDED`→`RESTORED`⇒`streaming`). RESOLUTION.md 는 이 문장에 "(전수 확인)" 이라는 명시적 한정어까지 붙였으나 전수가 아니었다. |

### 직접 수행한 mutation 검증 (5/5 일치)

| 대상 | 제거한 가드 | 결과(전체/실패) | RESOLUTION 주장과 일치 |
|---|---|---|---|
| W4 | `widget-state.ts` `if (state.phase === "ended") return state;` | 39개 중 W4 1건만 실패 | 일치 |
| W3 | `use-widget.ts` 언마운트 cleanup `worldGenRef.current++;` | 370개 중 W3 1건만 실패(369 passed) | 일치 |
| C1 | `use-widget.ts` `teardownSession()` 의 `if (!configRef.current) return;` | C1 테스트 실패(널 참조 예외로 죽음 — 가드가 실질적으로 load-bearing 임을 증명) | 일치 |
| W2 | `seedWaitingFromStatus` catch 의 세대검사(a) + `applyConfig` 재검증(b) 모두 제거 | W2 테스트 실패(스트림 탈취 재현) / (a)만 복원 시 통과 | 일치("(a)만으로 충분" 주장까지 정합) |
| W5 | `use-token-refresh.ts` `.then()` 의 `if (worldGenRef.current !== gen) return;` | 11개 중 W5 1건만 실패 | 일치 |

## 발견사항

- **[WARNING]** C1 픽스(부팅 전 `teardownSession()` no-op)가 크래시는 막았지만, 그 창(config 미확립 구간)에 도착한 `newChat()`/host `resetSession` 의 **"새 대화" 의도 자체가 조용히 소실**될 수 있음 — §3.1 spec 계약과 어긋나는 잔여 갭
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts` — `teardownSession()` no-op guard(L198), `newChat()`(L583-606, 특히 L590 `resetSessionRefs()`→L594 `dispatch({type:"NEW_CHAT"})`→L606 `void start()`), `applyConfig()` 세션 복원 분기(L683-722, 특히 L699 `loadSession`/L703 `dispatch({type:"RESTORED"...})`); host 트리거 경로: `host-bridge.ts` L51-56(`wc:boot` 즉시 `hostOrigin` pin) + `use-widget.ts` L753-755(`case "resetSession": apiRef.current.newChat();`).
  - 상세: `applyConfig()` 의 첫 `await isEmbedAllowed(...)` 가 아직 끝나지 않은 상태(=`configRef.current` 가 여전히 `null`)에서 host 가 `wc:command {action:"resetSession"}` 을 보내면(코드 주석 자신이 "라이브 미리보기 등" 이라 명시하는, boot 직후 빠른 연속 메시지가 실제로 나올 법한 시나리오) 다음이 순서대로 일어난다: (1) `newChat()` 은 `startedRef.current` 가 아직 `false` 라 A분기(coalesce)를 타지 않고 B-1 분기로 진입 → `resetSessionRefs()` 호출 → `teardownSession()` 은 C1 가드로 **no-op**(스트림 정리도, `clearSession()` 도, 세대 증가도 전혀 일어나지 않음) → `dispatch({type:"NEW_CHAT"})` 로 UI 는 일단 "panel"(빈 새 대화 화면)로 잠깐 바뀜 → `void start()` 호출은 `cfg` 가 여전히 `null` 이라 즉시 no-op(아무 재시도 예약 없음). (2) 잠시 후 `isEmbedAllowed()` 가 resolve 되면, `worldGenRef` 가 전혀 바뀌지 않았으므로(1) 의 어떤 단계도 이를 건드리지 않음) `applyConfig()` 는 gen 재검증을 그대로 통과해 정상 진행 — `configRef.current = cfg`, `clientRef.current = new EiaClient(...)` 세팅 후 `loadSession(cfg.triggerEndpointPath)` 를 호출한다. **이 시점에 storage 가 전혀 지워지지 않았으므로**(위 (1)에서 `clearSession()` 이 스킵됨), 만약 이전에 저장된(만료 전) 세션이 있었다면 그 **옛 세션이 그대로 `RESTORED` 로 복원**되어 SSE 재오픈·토큰 갱신 예약까지 정상 진행된다 — 사용자/host 가 명시적으로 요청한 "새 대화"가 UI 상 잠깐 깜빡였다가 곧바로 **원래 대화로 조용히 되돌아간다**. 저장된 세션이 없는 경우에도, `newChat()` 이 호출한 `void start()` 는 그냥 버려지고 어떤 자동 재시도도 없어 "새 대화 시작" 의도가 소실된 채 위젯이 `panel` 에 머문다(사용자가 다시 open 을 눌러야 실제로 시작됨). 두 갈래 모두 `spec/7-channel-web-chat/1-widget-app.md §3.1` 표의 "새 대화(restart)" 행 — 트리거 `host resetSession`, 기대 동작 "저장 세션/스트림 정리 후 새 `POST /api/hooks/:path` → 새 executionId/token" — 을 이행하지 못하는 사례다. RESOLUTION.md 의 C1 절("`configRef.current` 는 확립 후 null 로 되돌아가지 않으므로... 정상 경로는 무영향")은 "크래시가 안 난다"는 의미에서는 맞지만(직접 확인: `configRef.current =` 대입은 정확히 2곳(L670, L695)뿐, 해제 0곳), "새 대화 요청이 항상 이행된다"는 것까지는 보장하지 않는데 그 구분이 RESOLUTION 문서에 드러나 있지 않다.
  - 제안: `teardownSession()` 의 no-op 분기에서 "요청은 있었다"는 사실을 (예: `pendingResetRef` 류 플래그로) 남겨 두고, `applyConfig()` 가 config 확립 직후 그 플래그를 소비해 `clearSession()` + 새 `start()` 를 대신 수행하도록 한다(즉 "지금 당장 처리할 대상이 없으면 요청을 지연시켜 나중에 반드시 이행" — 현재의 "요청을 그냥 버림"과 대비). 최소한 이 잔여 갭을 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 의 C1 서술에 명시적으로 이월해 둘 것.

- **[WARNING]** 리듀서 defense-in-depth 가 `WAITING` 케이스에만 적용되고 동일한 취약 구조(무조건 전이)를 가진 `BOOTED`/`RESTORED` 는 방치됨 — 코드 주석·RESOLUTION.md 의 "`ended` 를 벗어나는 유일한 액션은 `START`(전수 확인)" 단언이 반증됨
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.ts` L125-128(`case "RESTORED"`/`case "BOOTED"` — 둘 다 `state.phase` 무관하게 `phase: "streaming"` 무조건 대입) vs L129-138(`case "WAITING"`, 이번 diff 로 `if (state.phase === "ended") return state;` 추가); 주석은 L136-137; `review/code/2026/07/17/08_29_33/RESOLUTION.md` L76(`### W4` 절, "`ended` 를 벗어나는 유일한 액션은 `START`(→`booting`) 이므로(**전수 확인**) `ended → WAITING` 이 정당한 경우는 없다"); `use-widget-eager-start.test.ts` L131(테스트 제목 "START 는 ended 를 벗어나는 유일한 경로").
  - 상세: `widgetReducer` 를 직접 단위 실행해 확인한 결과(스크래치 테스트, 작업 후 삭제) — `reduce([WAITING, ENDED])` 로 `phase:"ended"` 를 만든 뒤 `BOOTED`(또는 `RESTORED`) 를 디스패치하면 두 경우 모두 `phase` 가 **`"streaming"`으로 되돌아간다**(`ended → streaming`). 즉 "`ended` 를 벗어나는 유일한 액션은 `START`" 라는 문장은 리듀서 코드 자체로 반증된다 — `BOOTED`/`RESTORED` 도 벗어난다. 이 라운드가 스스로 정의한 defense-in-depth 의 근거("리듀서는 모든 경로가 반드시 통과하는 단일 지점이므로 여기서 한 번 더 막는다")는 `BOOTED`/`RESTORED` 에도 문자 그대로 적용돼야 하는데, 실제로는 `WAITING` 하나에만 적용됐다. 현재 코드베이스의 모든 `BOOTED`/`RESTORED` 디스패치 지점(`use-widget.ts` L438, L703)은 직전에 동기적으로(중간 `await` 없이) `if (worldGenRef.current !== gen) return;` 재검증을 거치므로 **오늘 당장 이 경로로 도달 가능한 실제 버그는 확인되지 않았다**(caller 규율이 현재는 완전함) — 다만 이 프로젝트 파일이 정확히 "caller 규율은 지켜지다가 특정 분기 하나에서 조용히 깨진다"(W2 가 그 예)는 패턴으로 4라운드 이상 반복 재발한 이력이 있고, 이번 라운드의 `SUMMARY`/`plan` 문서 스스로 "가드는 규율이지 구조가 아니다" 를 이 라운드의 교훈으로 명문화했다는 점에서, 그 교훈을 `WAITING` 에만 적용하고 구조적으로 동일한 `BOOTED`/`RESTORED` 에는 적용하지 않은 것은 이 라운드 자신의 논리와 내적으로 일관되지 않는다. 또한 위 첫 번째 발견사항([C1 잔여 갭])이 실제로 재현하는 것은 정확히 "`RESTORED` 가 (가상이 아니라) 실제 `applyConfig` 재개 경로를 통해 `ended` 상태를 덮어쓰는" 시나리오다 — 다만 그 경로에서는 `ended` 전이가 아직 일어나지 않은 시점(가드가 no-op 이라 `ENDED` 디스패치 자체가 없었던 케이스, 즉 `newChat()` 경로)이라 이 리듀서 항목과는 별개의 메커니즘으로 유효한 사례다.
  - 제안: (a) `widgetReducer` 의 `BOOTED`/`RESTORED` 케이스에도 `WAITING` 과 동일한 `if (state.phase === "ended") return state;`(또는 대화가 이미 종료된 뒤에는 새 실행으로 대체되지 않는다는 취지에 맞는 표현)를 추가해 defense-in-depth 를 대칭화. (b) 그것이 의도적으로 불필요하다고 판단되면, 코드 주석과 RESOLUTION.md 의 "유일한 액션은 START" / "(전수 확인)" 문구를 "현재 caller 규율 하에서는 BOOTED/RESTORED 도 도달하지 않지만 구조적으로는 가능하다"로 정정할 것 — 최소한 반증 가능한 절대적 단언("유일한", "전수 확인")은 근거가 없는 한 쓰지 않는다.

- **[WARNING]** RESOLUTION.md 자체 검증 수치가 두 군데에서 동일한 패턴(off-by-one)으로 부정확 — 정성적 결론은 유효하나 정량적 정밀도는 신뢰도 낮음
  - 위치: `review/code/2026/07/17/08_29_33/RESOLUTION.md` `### W2` 절의 mutation 표("7개/8개/9개") 및 `### C2` 절의 "고정 횟수 `await Promise.resolve()` 12개 지점".
  - 상세: (1) W2 표는 "가드 없음=7개, (a)만=8개, (a)+(b)=9개" 라 적었으나, `worldGenRef.current !== gen` 실제 코드 발생 지점을 직접 grep 으로 세면 부모 커밋(`3b54c8727`, 두 fix 이전) **6개**, 현재(HEAD, 두 fix 모두 적용) **8개** — 즉 6→7(a)→8(a+b) 이 맞고 문서 수치는 전부 +1 이 되어 있다(JSDoc 계약 설명문 안의 예시 코드 조각 `if (worldGenRef.current !== gen) return;` 한 줄을 실제 검사로 같이 카운트했을 가능성이 높음 — 그 줄도 문자 그대로 동일 패턴이라 grep 이 함께 잡는다). (2) C2 절의 "12개 지점"도 실제로는 `git diff 3b54c8727..42e4346cf`에서 `-await Promise.resolve();` → `+await flushAsync();` 로 치환된 **기존 테스트 내 자리 수는 11개**(2회 연속 호출이 1개 `flushAsync()` 로 합쳐진 3곳 포함, 신규 테스트 4곳의 `flushAsync()` 사용은 "치환" 이 아니라 신규 작성이므로 별도)임을 diff 라인 카운트로 직접 확인했다 — "12" 는 1개 많다. 두 사례 모두 **결론(질적 주장: "(a) 만으로 충분하다", "고정 횟수 flush 관용구가 실재한다")은 코드로 뒷받침되어 옳다** — 문제는 곁들인 정확한 숫자가 신뢰할 수 없다는 점이다. 과거 라운드에서 지적된 "안 한 일을 했다고 기록"하는 과대주장과는 성격이 다르지만(작업 자체는 실재), 정밀 수치를 자신 있게 표로 제시하면서 검산이 안 된 점은 이 문서의 감사 신뢰도를 낮춘다.
  - 제안: 두 수치 모두 실제 grep/diff 라인 카운트로 재확인해 정정. 앞으로 이런 "정확한 개수"를 표로 제시할 때는 JSDoc/주석 안의 예시 코드 스니펫이 동일 패턴 문자열을 포함해 카운트를 오염시키지 않는지 앵커를 좁혀 확인할 것(W2 표 자체가 "초회 시도는 조용히 매치 실패했다" 고 밝힌 것과 같은 종류의 함정).

- **[INFO]** "신규 테스트 6건 전부 mutation 검증" 표현이 6번째 테스트에는 엄밀하게 맞지 않음
  - 위치: `codebase/channel-web-chat/src/lib/widget-state.test.ts` L131("START 는 ended 를 벗어나는 유일한 경로 — 이후 WAITING 은 정상 동작"); `RESOLUTION.md` "## 검증" 절 "신규 테스트 6건 전부 mutation 검증 — 각각 대응 가드를 제거했을 때 그 테스트만 실패함을 확인."
  - 상세: 이 테스트는 W4 가드가 정상 재시작(START→WAITING)을 과잉 차단하지 않는지 확인하는 **회귀 안전판**(false-positive 방지 테스트)이지, "제거하면 실패하는 가드"를 갖고 있지 않다 — `START` 케이스 자체는 이번 diff 로 변경되지 않았다(원래도 무조건 `"booting"` 전이). 따라서 "그 테스트만 실패함을 확인"이라는 mutation 검증 대상은 실질적으로 5건(C1·W2·W3·W5·W4-가드 자체)이고, 6번째는 성격이 다른 정상성 검증이다. 기능·품질에 문제는 없으며 순수 서술 정확도 문제.
  - 제안: 없음(정보용) — 필요 시 "5건은 가드-제거 mutation 검증, 1건은 정상 경로 회귀 고정" 으로 구분해 서술하면 더 정확함.

## 확인된 정합 사항 (참고)

- `spec/7-channel-web-chat/1-widget-app.md §3.1`(L84-116)이 이미 "스냅샷 terminal 시 세션 정리+`[ended]`+host 통지, 같은 판정은 세션 복원 시점에도 적용, 종료 확정 시 SSE 재오픈/토큰 갱신 예약 금지" 를 명문화하고 있고, 이번 diff(C1/W2/W3/W4/W5)는 그 이미 명세된 계약을 실제로 지키도록 구현 허점을 닫는 순수 구현 정합화다 — spec 본문 자체의 갱신은 불필요(SPEC-DRIFT 아님, line-level 불일치 없음). 위 [C1 잔여 갭] 발견사항은 spec §3.1 "새 대화" 행과의 **구현 쪽** 잔여 불일치이며 spec 결함이 아니다.
- `configRef.current` 는 코드 전체에서 대입 2곳(L670 `updateProfile`, L695 `applyConfig`)·해제 0곳으로, 한 번 확립되면 다시 `null` 로 돌아가지 않는다는 RESOLUTION 의 전제는 grep 으로 직접 확인됨(정확).
- `use-widget-eager-start.test.ts:231` 의 `startGenRef` 잔존 문구는 이번 diff 로 "세대 가드"로 정정되어 죽은 식별자 참조가 남아있지 않음을 확인(W7 claim 정확). `use-widget.ts:147` 의 `startGenRef` 언급은 "종전에는" 이라는 의도적 역사 서술로 남겨둔 것이 맥락상 타당.
- 변경 대상 6개 소스/테스트 파일에 TODO/FIXME/HACK/XXX 주석 없음.
- `channel-web-chat` 전체 스위트 `npx vitest run` 재실행 결과 **22 files / 370 tests 전부 통과**(RESOLUTION 의 "370 passed" 주장과 일치) — 모든 mutation 테스트 종료 후 `git status`/`git diff --stat` 로 소스 원상복구 확인.
- C2("전체 스위트 동시 실행 시 간헐 실패")를 재현하려는 자체 20회 반복 실행에서도 실패 0건 — RESOLUTION 의 "재현 안 됨" 결론과 방향 일치(다만 위에서 밝힌 대로 원 85회의 완전한 독립 재현은 불가).

## 요약

이번 diff(C1/W2/W3/W4/W5 fix + 6개 신규 회귀 테스트 + RESOLUTION/SUMMARY 문서화)가 주장하는 핵심 서사 — "부팅 중 crash 회귀(C1)는 실제 회귀였고 고쳤다", "W2·W5 는 잠재가 아니라 활성 버그였다", "W3(언마운트) 는 실제로 미검증이었고 이제 검증된다" — 는 본 리뷰가 직접 수행한 5건의 gate-removal mutation 테스트로 전부 정합함이 확인됐고, `channel-web-chat` 전체 스위트(370)·spec §3.1 대조에서도 새로운 불일치가 발견되지 않았다. 다만 정확히 대조 검증을 요청받은 4개 단언 중 "리듀서 `ended` 를 벗어나는 유일한 액션은 `START`(전수 확인)" 는 리듀서 직접 실행으로 반증됐다 — `BOOTED`/`RESTORED` 도 동일하게 `ended` 를 무조건 벗어난다. 오늘 당장 이 경로에 도달하는 caller 는 없어 활성 버그는 아니지만, 이 라운드가 스스로 "가드는 규율이지 구조가 아니다" 라 결론짓고 `WAITING` 에 최후 방어선을 추가한 논리를 구조적으로 동일한 두 케이스에는 적용하지 않은 비대칭이며, "전수 확인"이라는 표현은 근거가 없다. 더 실질적으로는, C1 이 선택한 "부팅 전 no-op" 설계가 부팅 중 도착한 `newChat()`/host `resetSession` 의 "새 대화" 의도를 조용히 소실시켜(저장된 세션이 있으면 그 옛 세션이 그대로 복원됨) `spec §3.1` "새 대화" 행의 계약을 이 좁은 race window 에서 어길 수 있음을 코드 추적으로 확인했다 — RESOLUTION 은 "크래시 없음"만 검증했고 이 잔여 갭은 문서화되지 않았다. 부가적으로 RESOLUTION.md 의 자체 mutation-count 표와 flush-지점 개수는 같은 패턴(off-by-one)으로 두 군데 모두 실측과 어긋나며(질적 결론은 옳음), "6건 전부 mutation 검증"이라는 표현도 6번째 테스트에는 엄밀히 맞지 않는다. 종합하면 이번 라운드에 실제로 착수된 수정 자체는 코드·테스트로 뒷받침되는 진짜 개선이지만, RESOLUTION.md 의 "확인·완결" 서술은 한 곳에서 반증 가능한 과장(전수 확인)을 포함하고 있고, 이번 수정이 새로 열어놓은 인접 잔여 갭(부팅-중 새 대화 소실)이 하나 더 있다.

## 위험도

MEDIUM
