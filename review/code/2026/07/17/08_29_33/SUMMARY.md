# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — 병합 전 반드시 확인·조치가 필요한 CRITICAL 2건(부팅 중 명령 호출 시 위젯 영구 정지 가능성, 전체 테스트 스위트 동시 실행 시 간헐적 비결정 실패)이 발견됨. WARNING 7건은 대부분 이 리팩터가 스스로 표방한 "단일 진실(worldGenRef)·모든 await 뒤 재검증" 계약 자체의 내부 불일치(JSDoc 부정확·`applyConfig()` 비대칭·리듀서 defense-in-depth 부재)에 관한 것.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 부작용 | `worldGenRef` 단일화로 `teardownSession()`(→`newChat()`/`resetSession`/`endConversation()`)이 무조건 `worldGenRef.current++` 를 실행. `applyConfig()` 의 최초 부팅(`isEmbedAllowed` 네트워크 왕복 대기, `configRef`/`clientRef` 미확립) 도중 이 호출이 들어오면 나중에 resolve 되는 `applyConfig()` 가 `if (worldGenRef.current !== gen) return;` 에 걸려 `configRef`/`clientRef`/`setConfig()` 를 영원히 실행하지 않고 조용히 종료됨. `newChat()` 이 마지막에 부르는 `void start()` 도 `if (!cfg \|\| !client) return;` 로 즉시 no-op — 재시도 메커니즘 없음. `expanded = visible && state.open && !!config` 가 `config===null` 로 고정되어 런처만 뜨고 패널이 영원히 안 열리는 **영구 정지(silent hang, 콘솔 경고 없음)**. `host-bridge.ts` 가 `hostOrigin` 미확정 상태에서도 `wc:command` 를 origin 검증 없이 처리하므로 "boot 직후 빠른 연속 command"(라이브 프리뷰 등)가 이 레이스를 트리거할 개연성이 있음. 기존 회귀 테스트(36 passed)는 모두 config 확립 **후**에 `newChat`/`resetSession` 을 호출하는 패턴이라 이 경로 미커버(grep 확인). | `codebase/channel-web-chat/src/widget/use-widget.ts` — `teardownSession()`(L178), `newChat()`(L556-579, 특히 L563-566), `endConversation()`(L593-628), `applyConfig()` 부팅 분기(L656-691, 특히 L660-663); `codebase/channel-web-chat/src/host-bridge.ts` L58 | 가장 국소적 수정: `teardownSession()` 최상단에 `if (!configRef.current) return;` 가드 추가(아직 아무것도 확립 안 된 상태에서는 `closeStream`/`clearRefreshTimer`/`clearSession` 이 이미 no-op 이므로 `worldGenRef` 증가만 함께 건너뛰어도 안전) — choke point 1곳만 수정하면 `newChat`/`endConversation`/`applyConfig` 개별 수정 불요. `fetchEmbedConfig` in-flight 중 `resetSession`/`newChat` 호출 후 이후 config 가 정상 확립되는지(`not.toBeNull()`) 단언하는 회귀 테스트 추가. |
| 2 | 테스트 | 전체 테스트 스위트를 동시 실행(`npx vitest run`, 파일 인자 없이 22개 파일 동시)하면 `use-widget-eager-start.test.ts` 가 간헐적으로 실패(46회 반복 중 6회, ≈13%). 실패 유형 중 하나는 신규 "유령 표면 회귀" 테스트 자신이 `expect(phase).toBe("ended")` 에서 **`Received: "awaiting_user_message"`** 를 받아, 막으려던 바로 그 버그 증상을 재현. 부모 커밋(`7a9b4ce88`, 본 diff 직전)을 별도 worktree 로 동일 방법론(25회 반복)으로 A/B 비교한 결과 **실패 0건** — 이번 `worldGenRef` 리팩터가 새 비결정성을 도입했다는 정황. 격리 실행(파일 단독/`src/widget/` 전체/CPU 부하 하 8회 반복)은 항상 100% 안정이라, 근본 원인이 테스트 하네스의 고정 2회 `await Promise.resolve()` 관용구 부족인지, `worldGenRef` 캡처/증가 지점 사이의 실제 프로덕션 코드 race 인지는 정적 분석만으로 완전히 배제되지 않음. | `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:1487-1562`(신규 "유령 표면 회귀" 테스트), `:1645-1720`(기존 "세션 교체 후 도착한 옛 명령의 410" 테스트) | 병합 전 CI 환경에서 반복 실행(예: 20회 loop)으로 재현율 확정. 재현되면 `--reporter=verbose`+중간 상태 로깅으로 정확한 인터리빙 확인. 근본 원인이 하네스측이면 "resolve 후 고정 횟수 microtask flush" 패턴을 더 견고한 flush(`setTimeout(r,0)` 또는 공용 `flushMicrotasks()`)로 교체. 프로덕션측이면 `worldGenRef` 캡처/증가 지점 사이 재진입 가능 경로 재검토. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/문서화 | `worldGenRef` JSDoc "계약"이 "무효화 지점은 두 곳뿐 — `teardownSession()` 과 언마운트 cleanup"이라 명시하지만, 실제로는 `start()` 자신도 `const gen = ++worldGenRef.current;` 로 세대를 증가시켜 실질 지점은 세 곳. 이 refactor 의 존재 이유 자체가 "가드가 흩어져 대칭이 깨진 것"을 "신뢰 가능한 단일 계약"으로 정리하는 것인데, 계약 문서 자체가 부정확하면 향후 유지보수자가 "gen 변경은 teardown/unmount 뿐"이라 잘못 가정할 위험. (requirement·side_effect·documentation·concurrency 4개 reviewer 독립 지적) | `codebase/channel-web-chat/src/widget/use-widget.ts:140-142`(JSDoc) vs `:402`(`start()` 내부 증가) | JSDoc 을 "세 곳"(`teardownSession()` · `start()`의 세계 교체 · 언마운트)으로 정정. |
| 2 | 동시성/부작용 | `start()` 는 `seedWaitingFromStatus()` await 이후 `outcome` 체크에 더해 별도로 `if (worldGenRef.current !== gen) return;` 를 명시적으로 재검증하지만, `applyConfig()` 의 동일 지점(세션 복원 분기)은 `outcome !== "continue"` 체크만 있고 `worldGenRef` 재검증이 없어 "모든 await 뒤 재검증" 계약과 비대칭. 현재는 `seedWaitingFromStatus` 내부에 추가 `await` 이 없어 활성 버그는 아니나(문서화되지 않은 암묵적 불변식에 의존), `scheduleRefresh()`(`use-token-refresh.ts`)가 `worldGenRef` 를 전혀 인지하지 못한다는 점을 고려하면 향후 `seedWaitingFromStatus` 내부 구조가 바뀌는 순간 이 refactor 가 고치려 한 것과 동형의 "종료 세션 storage 부활" 이 재발할 잠재 지뢰. (security·side_effect·maintainability·concurrency 4개 reviewer 독립 지적, maintainability 는 "`start()`와 대칭" 이라는 기존 주석 자체가 부정확하다는 점도 함께 지적) | `codebase/channel-web-chat/src/widget/use-widget.ts:682-689`(`applyConfig`, outcome 체크만) vs `:425-430`(`start()`, outcome+gen 이중 체크) | `applyConfig()` 에도 `openStream(saved, "0")` 직전 `if (worldGenRef.current !== gen) return;` 추가(현재는 사실상 no-op 이나 비용이 매우 낮은 방어적 일관성). 불필요하다고 판단되면 "대칭" 주석을 지우고 "outcome 체크만으로 충분한 이유"를 정확히 기록. |
| 3 | 테스트 | 커밋 메시지/plan 문서는 "언마운트 세대 증가로 리뷰 W6(unmount-after-await SSE leak)도 함께 해소"라 명시하지만, 이를 직접 검증하는 회귀 테스트가 없음. mutation 테스트로 실증: 마운트 effect cleanup 의 `worldGenRef.current++;` 를 제거해도 채널-웹챗 전체 22개 파일·364개 테스트 중 **0건도 실패하지 않음**. plan 문서 자신의 mutation 검증 목록(choke-point 제거→3건, seed gen 검사 제거→3건, sendCommand gen 검사 제거→1건)에도 언마운트 지점은 없어, 작성자 스스로도 이 지점을 mutation-검증하지 않았음이 확인됨. (requirement·testing 2개 reviewer, 각각 독립 mutation 실증) | `codebase/channel-web-chat/src/widget/use-widget.ts:735-750`(마운트 effect cleanup, `worldGenRef.current++`) | `renderHook()`+RTL `unmount()` 패턴(`use-token-refresh.test.ts` 의 "언마운트 후 타이머 미발화" 테스트와 대칭)으로, in-flight `getStatus`/webhook 응답을 수동 resolve 가능하게 설정 → `unmount()` → 이후 resolve → 새 `EventSource` 미생성을 단언하는 회귀 테스트 1건 추가. |
| 4 | 동시성/테스트 | plan 문서 스스로 이번 버그의 "직접 원인"을 "`widget-state.ts` 의 `WAITING` 이 `ended` 가드 없이 무조건 전이하는 것"이라 명시했음에도, 채택된 fix 는 리듀서를 건드리지 않고 4개 호출부(`start`/`seedWaitingFromStatus`/`sendCommand`/`applyConfig`)의 caller-side `worldGenRef` 가드에만 전적으로 의존(defense-in-depth 부재). `handleEiaEvent` 의 `execution.waiting_for_input` 직접 SSE 분기(await 경계 없음, `worldGenRef` 가드 대상 아님)는 여전히 `dispatch(WAITING)` 을 무조건 실행하며 "`closeStream()` 이후 브라우저 `EventSource` 는 이벤트를 발화하지 않는다"는 런타임 불변식에만 의존 — 테스트 더블(`ControllableEventSource.close()` 는 no-op)로는 이 경로를 실증할 수 없음. 이 실패 유형(비대칭/무방비 가드) 자체가 4라운드 연속 재발한 이력이 있어 순수 리듀서 단위테스트 부재가 특히 아쉬움(async mock 불필요, 작성 비용 매우 낮음). (requirement·testing WARNING, concurrency INFO — 3개 reviewer 공통 지적) | `codebase/channel-web-chat/src/lib/widget-state.ts:129-137`(`case "WAITING"`, 이번 diff 밖); `codebase/channel-web-chat/src/widget/use-widget.ts:217-226`(`handleEiaEvent` 직접 SSE 분기) | `widgetReducer` 의 `WAITING`(및 필요 시 유사 재활성화형 액션)에 `if (state.phase === "ended") return state;` 형태의 최소 가드 추가 검토(이번 diff 필수는 아님). `widget-state.test.ts` 에 `ENDED` 이후 `WAITING` 수신 시 동작을 명시적으로 고정하는 순수 리듀서 단위테스트 추가. |
| 5 | 유지보수성 | 이미 분리된 `useTokenRefresh` 훅이 이번 `worldGenRef` 통합 대상에서 빠진 **4번째 독립 staleness 가드**(`cancelledRef`)를 여전히 쓰고 있음. `cancelledRef` 는 언마운트에서만 true 가 되고 `teardownSession()`(새 대화·대화 종료·SSE terminal 공유 choke point) 호출로는 세팅되지 않음 — 토큰 갱신 `setTimeout` 이 발화해 `refreshToken()` 이 in-flight 인 동안 "새 대화"가 시작되면, teardown 이 그 요청을 막지 못해 뒤늦게 resolve 시 `sessionRef.current` 를 옛 세션으로 덮어쓰고 방금 지운 storage 를 `saveSession()` 으로 되살릴 수 있음 — 이번 diff 가 webhook POST·getStatus·interact 세 경로에서 고친 것과 동형의 "종료 세션 storage 부활" 이 4번째 경로(토큰 갱신)에 남아있을 가능성. diff 직접 대상 파일 밖이라 확정 결함은 아니며 별도 동시성 검토 필요. | `codebase/channel-web-chat/src/widget/use-token-refresh.ts:41,90-97`(`cancelledRef`) — 이번 diff 비대상 파일 | `useTokenRefresh` 가 `worldGenRef`(또는 동등 세대값)를 주입받아 `refreshToken().then()` 진입 시 재검증하도록 확장하거나, 최소한 `endedRef` 처럼 "왜 이 가드는 통합 대상에서 제외했는지"를 plan 문서/JSDoc 에 명시적으로 기록. |
| 6 | 문서화 | 직전 커밋(`7a9b4ce88`)이 "사용자 가시 변경의 CHANGELOG 누락" ai-review 지적을 반영해 `CHANGELOG.md` 의 "웹채팅 위젯" Unreleased 섹션을 신설했음에도, 그 바로 다음 커밋인 이번 변경(명백히 사용자 가시적인 "종료된 위젯이 stale seed 응답으로 부활" 버그 fix, 커밋 메시지에 "실측 재현 확인"이라 명시)이 `CHANGELOG.md` 를 전혀 수정하지 않음(`git show` 로 무변경 확인). 기존 항목 4("옛 세션의 지연 응답이... 유령 표면을 그리지 않는다")는 이 fix 이전엔 실제로 성립하지 않던(재현된 반례가 있는) 문구가 되어 있어, 방치 시 독자에게 부정확한 보장을 전달. 동일 패턴이 연속 커밋에서 반복. | `CHANGELOG.md` L3-L12(`## Unreleased — 웹채팅 위젯...`) | "Unreleased — 웹채팅 위젯" 섹션에 5번째 항목 추가: "seed in-flight 중 SSE terminal 도착 시 종료된 위젯이 부활하던 버그 수정 + `worldGenRef` 단일화(4종 staleness 가드 → 1종)". 항목 2 와 같은 "(사용자 가시 버그 수정)" 표기 패턴 재사용. 필요 시 항목 4 문구도 갱신. |
| 7 | 유지보수성 | production 코드(`use-widget.ts`) 전역에서는 "`start()` 는 `startGenRef` 로 우연히 보호됐으나 이 경로는 무방비였다" 류 주석이 이번 diff 에서 "세대 가드"로 꼼꼼히 갱신됐으나, 정확히 동일한 문구가 테스트 파일에는 갱신되지 않고 남아 이제 코드베이스에 존재하지 않는 식별자(`startGenRef`)를 가리키는 죽은 참조가 됨. 기능·테스트 정확성에는 영향 없는 사소한 건이나, 다른 곳에서는 동일 문구를 꼼꼼히 맞췄기에 누락이 도드라짐. (requirement·maintainability·documentation 3개 reviewer 공통 지적) | `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts:216` | 해당 JSDoc 의 "startGenRef" → "세대 가드"(또는 `worldGenRef`)로 교체. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 범위 | 스테일니스 가드 3종(`startGenRef`/`sessionRef` 동일성/`cancelled` 지역 플래그) 통합이 원인이 된 특정 함수만 고치는 최소 패치보다 넓은 리팩터(파일 전역 5개 호출부 변경). 다만 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 결정 배경(4라운드 반복 실패 → `useEiaStream` 분리 검토 후 기각 → 통합 채택)·재현 확인·mutation 테스트 3종·전 스택 테스트 결과가 상세히 기록되어 "관련 없는 사전 정리"가 아니라 이번 라운드의 명시적 조사·수정 대상임이 뒷받침됨. | `codebase/channel-web-chat/src/widget/use-widget.ts`(`worldGenRef` 관련 8개 diff hunk) | 문제 없음 — 향후 유사한 "국소 버그 fix → 구조적 원인 추적 → 통합 리팩터" 패턴에서도 이 문서화 관행(재현 확인·mutation 테스트·plan 기록) 유지 권장. |
| 2 | 범위/부작용 | 마운트 effect 언마운트 cleanup 의 `cancelled = true;` → `worldGenRef.current++;` 교체는 단순 rename 을 넘어 언마운트를 새로운 무효화 지점으로 승격시키는 동작 확장(신규 `eslint-disable-next-line react-hooks/exhaustive-deps` 동반, 근거 주석 명확 — "cleanup 은 stale snapshot 이 아니라 최신 값을 증가시켜야 함"). 코드 주석·plan 문서 모두 이를 "리뷰 W6(unmount-after-await SSE leak)" 기존 지적의 이행으로 명시. | `use-widget.ts` 마운트 `useEffect` cleanup(~L745-752) | 별도 조치 불요(문서화 충분) — 단, CRITICAL #2(위 W6 회귀 테스트 부재)와 연계해 후속 조치. |
| 3 | 유지보수성/테스트 | 신규 테스트를 포함해 파일 내 5~6개 이상의 테스트가 embed-config reject·webhook POST 202 envelope 등 거의 동일한 `fetchMock` 보일러플레이트를 인라인 반복. 이번 diff 가 새로 만든 패턴이 아니라 파일 전체의 기존 관행을 답습한 것. (maintainability·testing 공통 지적) | `use-widget-eager-start.test.ts` 전역(신규 테스트는 `:1487-1521`) | 선택 사항: `installFetchWithStatusSequence(responses)` 류 공유 헬퍼 도입 시 반복 축소 가능. 급하지 않음. |
| 4 | 유지보수성/동시성 | "아무 일도 안 일어남"을 단언하는 세 테스트(신규 유령표면 테스트 포함)가 `await Promise.resolve()` 를 정확히 2회 반복하는 매직넘버 패턴을 무설명으로 사용 — `seedWaitingFromStatus` 내부 await 홉 수에 암묵 결합되어, 향후 구현의 await 체인 깊이가 바뀌면 조용히 검출력을 잃을 수 있음. 파일 내 기존 관행의 연장(신규 도입 안티패턴 아님). (maintainability·concurrency 공통 지적) | `use-widget-eager-start.test.ts:1557-1558` 외 2곳(구 410 응답 테스트, in-flight 명령 dedup 테스트) | 선택 사항: 최초 등장 지점에 왜 2틱인지 짧은 주석 추가, 또는 의도를 이름으로 드러내는 공용 `flushMicrotasks(n)` 헬퍼 도입. |
| 5 | 유지보수성 | `useWidget()` 훅 자체가 여전히 큼(774줄, 함수 본문 약 630줄, `useCallback` 20개 이상) — 이번 diff 는 구조를 바꾸지 않고 가드 3종을 1종으로 치환하는 국소 리팩터. plan 문서에 "지금 당장 `useEiaStream` 분리는 해법이 아니며, 가드 정리 후 `useEiaSession`(≈300/735줄) 분리를 후속 진행"이라는 근거 있는 트레이드오프가 이미 기록됨. | `use-widget.ts` 전체 | 조치 불요(추적 문서 존재) — 후속 분리 착수 시 재평가 권장. |
| 6 | 테스트 | 신규 "유령 표면" 회귀 테스트의 최종 단언이 `state.phase` 하나뿐. stale 페이로드에 식별 마커(`waitingNodeId: "ghost"`)가 있으나 검증하지 않음 — 현재 구현상 `phase` 단언만으로도 이 버그 클래스는 충분히 잡히지만, `pending` 필드도 함께 단언하면 실패 시 진단 메시지가 테스트 의도("유령 표면")와 더 직접 일치하고 향후 dispatch 순서 변경에도 강건해짐. | `use-widget-eager-start.test.ts:1561` | `expect(result.current.state.pending).toBeNull();`(또는 `?.nodeId`) 단언 1줄 추가. |
| 7 | 동시성 | `bridge.onBoot` 콜백과 URL query-param fallback 이 둘 다 조건을 만족하면 `applyConfig()` 가 사실상 동시에 두 번 실행될 수 있음(상호배제 부재). `applyConfig` 자신은 `worldGenRef` 를 증가시키지 않아 두 인스턴스가 서로를 무효화하지 못함. 리팩터 이전의 `cancelled` 불리언 플래그도 동일하게 이중 호출을 막지 못했으므로 본 diff 가 새로 만든 문제는 아니나, "모든 비동기 경로의 staleness 를 단일 진실로 통합"이라는 이번 리팩터의 표방 범위 밖에 남아있는 축으로 기록할 가치가 있음. | `use-widget.ts:693-733`(`bridge.onBoot` 핸들러 + query-param fallback) | 차단 사유 아님. 필요 시 `applyConfig` 진입부에 `configuredRef` 류 1회성 가드 추가를 후속 검토 후보로만 기록. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | `applyConfig()` 세션 복원 경로의 gen 재검증 누락(구조적 비대칭, 현재는 이론상 무해로 평가) |
| requirement | MEDIUM | JSDoc 계약 불일치(2곳↔3곳), W6 회귀테스트 부재, 리듀서 defense-in-depth 부재 — 모두 직접 실행·변이테스트로 실증 |
| scope | LOW | 리팩터 범위가 최소 패치보다 넓으나 plan 문서의 근거·검증 기록으로 충분히 정당화됨 |
| side_effect | HIGH | **CRITICAL**: 부팅 중 `newChat`/`resetSession`/`endConversation` 호출 시 위젯 영구 정지 가능 |
| maintainability | MEDIUM | `applyConfig` 비대칭 주석 부정확, `useTokenRefresh` 의 4번째 독립 가드 미통합 |
| testing | HIGH | **CRITICAL**: 전체 스위트 동시 실행 시 간헐적(≈13%) 비결정 실패를 실측 재현(A/B 검증 포함), W6/리듀서 테스트 공백 |
| documentation | MEDIUM | CHANGELOG 누락(직전 커밋 지적 패턴 반복), JSDoc "두 곳뿐" 부정확 |
| concurrency | MEDIUM | `applyConfig` 비대칭이 `scheduleRefresh` 미인지 경로와 결합 시 잠재 회귀 가능 |
| user_guide_sync | NONE | 문서 동기화 trigger 21개 전수 점검, 매칭 0건 |

## 발견 없는 에이전트

- **user_guide_sync**: `.claude/config/doc-sync-matrix.json` 21개 trigger 행 전수 점검 결과 매칭 0건(순수 내부 훅 리팩터, `.tsx` 미포함, 신규 사용자 가시 문자열/노드/필드/에러코드/문서 섹션 없음). 해당 없음.

## 권장 조치사항

1. **[CRITICAL, 병합 차단 후보]** `teardownSession()` 최상단에 `if (!configRef.current) return;` 가드 추가 — 부팅(`isEmbedAllowed` 대기) 도중 `newChat()`/`resetSession`/`endConversation()` 호출 시 위젯이 `config=null` 로 영구 정지하는 결함 차단. `fetchEmbedConfig` in-flight 중 해당 명령 호출 → 이후 config 정상 확립을 확인하는 회귀 테스트 추가.
2. **[CRITICAL, 병합 차단 후보]** 전체 테스트 스위트 동시 실행 시 간헐적 비결정 실패(≈13%, A/B 로 이번 diff 신규 도입 정황 확인)를 CI 환경에서 반복 실행해 재현율 확정하고, 근본 원인(테스트 하네스의 고정 2회 microtask flush vs 프로덕션 `worldGenRef` 경합)을 규명 후 조치.
3. `applyConfig()` 의 `seedWaitingFromStatus` await 직후에도 `start()` 와 동일하게 `if (worldGenRef.current !== gen) return;` 추가해 "모든 await 뒤 재검증" 계약을 문자 그대로 대칭화(4개 reviewer 독립 지적, 비용 매우 낮음).
4. `worldGenRef` JSDoc "무효화 지점은 두 곳뿐" → "세 곳"(`teardownSession()` · `start()` 의 세계 교체 · 언마운트)으로 정정.
5. W6(언마운트-중-in-flight SSE leak) fix 를 직접 검증하는 회귀 테스트 추가(현재 mutation 테스트로 커버리지 공백이 실증됨 — 해당 줄 제거해도 364건 중 0건 실패).
6. `widget-state.ts` 리듀서의 `WAITING` 케이스에 `ended` 이후 무시하는 defense-in-depth 가드 추가 검토 + 순수 리듀서 단위테스트 추가(async mock 불필요, 저비용).
7. `useTokenRefresh` 의 독립 `cancelledRef` 를 `worldGenRef`(또는 동등 세대값) 통합 대상에 포함하거나, 제외 이유를 plan 문서/JSDoc 에 명시적으로 기록.
8. `CHANGELOG.md` "Unreleased — 웹채팅 위젯" 섹션에 이번 유령 표면 부활 버그 fix + `worldGenRef` 단일화 항목 추가.
9. 테스트 파일(`use-widget-eager-start.test.ts:216`)의 잔존 `startGenRef` 식별자 주석을 "세대 가드"로 갱신.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, concurrency, user_guide_sync (9명)
  - **제외**: 아래 표 (5명) — 개별 제외 사유는 라우터 출력에 세부 텍스트로 포함되지 않음. diff 특성(channel-web-chat 클라이언트 훅 리팩터 1건, 신규 의존성·DB 스키마·API 계약·성능 민감 경로·아키텍처 재구성 없음)에 비춰 타당해 보이나, 정확한 판단 근거는 이 요약 작성 시점에 확인 불가.
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing, concurrency (8명) — `user_guide_sync` 만 router 자체 선별, 나머지 8명은 router_safety 로 강제 포함됨.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 비적용 판단(세부 사유 미제공) |
  | architecture | 라우터 비적용 판단(세부 사유 미제공) |
  | dependency | 라우터 비적용 판단(세부 사유 미제공) — 이번 diff 는 패키지/의존성 변경 없음(security 리뷰로 교차 확인) |
  | database | 라우터 비적용 판단(세부 사유 미제공) — 이번 diff 는 DB/마이그레이션 무관(클라이언트 훅 리팩터) |
  | api_contract | 라우터 비적용 판단(세부 사유 미제공) — 공개 인터페이스(`useWidget()` 반환 형태, 콜백 시그니처) 변경 없음(side_effect 리뷰로 교차 확인) |