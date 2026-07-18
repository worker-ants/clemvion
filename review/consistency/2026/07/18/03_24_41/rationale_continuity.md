# Rationale 연속성 검토 — webchat-boot-single-flight

## 검증 방법

target(`spec/7-channel-web-chat/**`)은 이번 PR에서 **`2-sdk.md`의 `code:` frontmatter 4줄 추가**(증거 링크,
본문/Rationale 무변경) 외에 spec 본문이 전혀 바뀌지 않았다(`git diff origin/main..HEAD --stat -- spec/` 실측
확인). 즉 orchestrator가 지목한 두 되돌림/재설계(A-6, boot축→sessionEstablished)는 **spec 텍스트가 아니라
전적으로 코드(`codebase/channel-web-chat/src/widget/use-widget.ts`, `src/lib/widget-state.ts`)에서 일어났다.**
따라서 "target이 spec Rationale에서 기각된 대안을 재도입하는가"를 판정하려면 spec 문서만으로는 부족해,
①`git diff origin/main..HEAD`로 실제 순변경분을 확인하고 ②현재 HEAD 코드(주석 포함)를 직접 읽고
③`plan/in-progress/webchat-boot-single-flight.md` 진행기록·`review/code/2026/07/1{7,8}/**`의 SUMMARY/RESOLUTION
·관련 spec(`3-auth-session.md`, `1-widget-app.md`, `2-sdk.md`, EIA `14-external-interaction-api.md` Rationale)을
대조했다.

## 발견사항

- **[WARNING]** A-6(ERROR→teardownSession + 리듀서 ended 가드) 되돌림 — 결정은 타당하고 spec과 정합하나, 이 하드윈 불변식이 spec `## Rationale`에 없음
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` §3.1(특히 §3.1-2 "200+running→복원", §3.1-3 storage 정리 조건 열거) 및 동 문서 `## Rationale`(R3~R6) · `1-widget-app.md §2` Form 행 인접부
  - 과거 결정 출처: `3-auth-session.md` §3.1-3(storage 정리 조건을 SSE terminal·복원시 200+terminal·404·복구불가401·명령 410 **으로 닫힌 열거**, "그 외 명령 실패" 부재) + §3.1-2("200+running/waiting_for_input → SSE 재연결 → 복원" 명시)
  - 상세: 이 PR은 개발 도중 A-6(비-410 `sendCommand` 실패 시 `teardownSession()` 호출 + 리듀서 `RESTORED`/`BOOTED`에 `ended` 가드)을 도입했다가(`ca92a1b7f`, `c5d08c45d`), "일시적 500 직후 새로고침하면 살아있는 대화(서버는 계속 `200 {status:"running"}`)가 영구 소실된다"는 회귀를 자체 재현해 되돌렸다(`8b37e8bef`, 리뷰 근거 `review/code/2026/07/17/18_39_11/requirement.md` CRITICAL). 되돌림의 근거는 위 §3.1-2/§3.1-3을 정확히 인용하며 타당하다 — **이는 Rationale 위반이 아니라 스스로 위반을 교정한 사례다.** `git show origin/main:.../use-widget.ts`·`widget-state.ts`로 직접 대조해, `sendCommand`의 비-410 catch 분기(현재 `use-widget.ts:707-727`)와 리듀서 `RESTORED`/`BOOTED`(현재 `widget-state.ts:125-146`)가 **origin/main과 바이트 단위로 동일한 동작**(가드 없음)임을 확인했다 — A-6 전체가 이 PR의 shipped diff에는 순변경 0으로, CHANGELOG에서도 의도적으로 제외됐다. 다만 "왜 비-410 명령 실패가 종료가 아닌지"(§3.1-3을 닫힌 목록으로 취급해야 하는 이유, A-6이 실패한 구체적 근거)는 현재 코드 주석(`widget-state.ts:126-142`, `use-widget.ts:707-727`)과 테스트 주석(`widget-state.test.ts` 신규 `it.each`)·`plan/in-progress/webchat-boot-single-flight.md`(§"후속 18_39_11 처리" 310-329행)에만 남아 있고, 같은 spec 문서의 유사 비중 결정인 R7("로컬 우선 optimistic 종료" — 종료 명령 실패해도 로컬 종료 유지)·`1-widget-app.md` R9(서버측 execution 잔존 처리)는 spec Rationale로 승격돼 있어 비대칭이 생긴다. plan 문서는 완료 후 `plan/complete/`(궁극적으로 archive)로 이동해 "1회성 역사 문서"로 격하되는 반면, CLAUDE.md는 "결정의 배경·근거"의 SoT를 spec `## Rationale`로 명시한다. 이 클래스의 버그는 plan상 8번째 재발(과거 7회는 "가드를 어느 축에 다느냐", 이번은 "막으려는 게 진짜 막아야 할 것인지 spec에 안 물은 것")이라, Rationale 부재는 9번째 재발의 실질적 위험 요인이다.
  - 제안: `project-planner` 트랙 경량 후속으로 `3-auth-session.md §Rationale`(또는 `1-widget-app.md`)에 "비-410 명령 실패는 세션 종료가 아니다 — §3.1-3은 닫힌 목록" 항목을 신설. 이미 이 PR이 인접 사안(ERROR가 `phase:"ended"`로 보내는 것 자체가 Form "재제출" 약속과 어긋나는 pre-existing gap)을 위해 `plan/in-progress/webchat-command-failure-is-not-termination.md`(project-planner 트랙)를 분리해 뒀으므로, 그 결정(A/B/C)이 내려질 때 본 항목(비-410 실패 처리 원칙)을 함께 명문화하는 것이 자연스럽다.

- **[INFO]** 되감기 방어 재설계(boot축→`sessionEstablished`) — 새로 확립된 "활성 대화는 재전송으로 흔들리지 않는다" 계약이 spec 본문/Rationale 어디에도 없음
  - target 위치: `spec/7-channel-web-chat/2-sdk.md §3` "`wc:boot` 재전송(멱등 재설정)" 문단 및 `## Rationale`(R2~R6)
  - 과거 결정 출처: 없음(신규 계약 — 위반 아님). 단 동일 문서 R4·R6, `1-widget-app.md` R9의 확립된 관례상 이 정도 비중의 클라이언트 동시성 계약은 R 항목으로 명문화됨
  - 상세: `bootGenRef`/`unmountedRef`/`sessionEstablished()`는 origin/main에는 전혀 없던 신규 메커니즘이다(`git show origin/main:.../use-widget.ts | grep sessionEstablished` 결과 없음, 실측 확인). 목적 둘: (a) `2-sdk.md §3(재전송)`이 이미 명문화했으나 미구현이었던 "마지막 `wc:boot`의 config를 적용"(§3(재전송) 준수 — `bootGenRef` supersede), (b) 사용자 가시 flicker 버그 수정("재전송이 활성 대화를 방해하지 않는다", CHANGELOG 신규 항목) — 이 (b)는 spec이 사전에 요구한 적 없는 **새로 발견·보장된 계약**이다. 이 메커니즘은 개발 중 두 차례 구멍이 났다(9번째: `start()`의 지연 seed가 boot축 방어를 못 받음 `7cfbf2557`, 10번째: 그 fix가 no-op 재전송에 스피너 영구 고착 유발 `cffee0d28`)가, "스트림이 이미 열렸는가"(`sessionEstablished`) 단일 신호로 수렴해 11·12번째 라운드(이중 EventSource, 테스트 비대칭)까지 마감됐다(`review/code/2026/07/18/03_04_45/SUMMARY.md` — "코드버그 0, LOW"로 수렴 확인). 종료 확정 분기는 의도적으로 world 축만 보고(`use-widget.ts:506` JSDoc 표) `sessionEstablished`를 타지 않는데, 이는 EIA `R-replay-unavailable`(`spec/5-system/14-external-interaction-api.md:1247-1255` — 5분 버퍼 만료 구간에선 terminal SSE도 유실돼 재전송되지 않음)과 `1-widget-app.md §3.1`의 "스냅샷이 이미 terminal이면 종료로 확정한다" 예외를 정확히 보존한다(대조 확인 — 위반 없음). `R9`의 single-flight 코얼레스(webhook POST 중복 방지, `newChat`/`start` 가드)도 이 diff 밖에서 원문 그대로 유지됨을 확인했다. 즉 **기존 Rationale·invariant 위반은 없으나**, `2-sdk.md §3`는 여전히 "마지막 config 적용"·"중복 시작 안 함"만 서술할 뿐 "확립된(스트림 열린) 세션은 재전송으로 재조회·재렌더되지 않는다"는, 지금 코드가 실제로 보장하고 회귀 테스트로 고정한 계약을 담고 있지 않다.
  - 제안: `2-sdk.md §3` 본문에 한 줄("확립된 세션은 재전송으로 되감기지 않는다") 추가 + `## Rationale`에 신규 R(예 R7) "재전송 중 되감기 방어 — boot 세대 비교 대안의 기각(2차 구멍 이후 `sessionEstablished`로 수렴)" 신설을 project-planner 트랙 경량 후속으로 권고. 시급하지 않음 — 코드/테스트 계층 문서화가 이미 충실하고 리뷰가 수렴(LOW)했기 때문.

## 요약

target(spec 본문)은 이번 PR에서 사실상 변경되지 않았고, orchestrator가 지목한 두 사건(A-6 도입→되돌림, boot축→`sessionEstablished` 재설계)은 전부 코드 레이어에서 일어났다. 직접 대조한 결과 A-6 되돌림은 `git show origin/main`과 바이트 단위로 동일한 최종 상태로 수렴해 **shipped diff 기준 순변경 0**이며, 그 되돌림의 근거(`3-auth-session.md §3.1-2/§3.1-3`)도 정확하다 — 즉 이 사건은 spec Rationale을 위반한 것이 아니라 PR 내부에서 스스로 위반을 발견해 교정한 사례다. boot축→`sessionEstablished` 재설계도 EIA `R-replay-unavailable`·EIA-RL-07·`1-widget-app.md §R9`(single-flight coalesce) 등 관련 spec의 기존 invariant를 전부 보존하며, 명시적으로 기각된 대안을 재도입하거나 합의 원칙을 위반한 지점은 발견되지 않았다. 다만 두 결정 모두 **8~12차례의 반복 재발/재설계를 거친 하드윈 불변식**임에도 spec `## Rationale`에는 어떤 흔적도 남기지 않았다(코드 JSDoc·테스트 주석·plan 진행기록에만 존재) — 이는 CRITICAL이 아니라 향후 재발 방지 관점의 WARNING/INFO 수준 문서화 갭이며, 이미 인접 사안(ERROR phase 처리)은 project-planner 트랙 plan으로 적절히 분리돼 있어 그 결정 시점에 함께 명문화하는 경로가 자연스럽다.

## 위험도

LOW
