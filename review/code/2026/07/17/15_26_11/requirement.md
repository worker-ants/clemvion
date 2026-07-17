# 요구사항(Requirement) 리뷰 — 회귀 테스트 2건 BLOCKED 전제 고정 + "유일한 가드" 문구 정정 (2026-07-17 15_26_11)

**대상**: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(commit `e9dcb27c9`, 18 insertions / 4 deletions, **프로덕션 코드 0줄**). 나머지 파일(`review/code/2026/07/17/{14_30_15,14_56_27}/*`)은 이전 라운드 리뷰 산출물이라 그 자체가 리뷰 "대상 코드"는 아니지만, 오케스트레이터가 명시적으로 그 RESOLUTION.md 주장의 표본 검증을 요청해 함께 확인했다(과거 `02_31_18` 라운드에서 RESOLUTION 과대 주장이 적발된 이력 때문).

## 검증 방법론

- `git show e9dcb27c9`로 실제 커밋 diff를 payload와 직접 대조 — 완전 일치, production 파일(`use-widget.ts`) 무터치 확인(stat: 테스트 파일 1개만).
- `git worktree add --detach <scratchpad>/mutation-wt-req HEAD`로 공유 워크트리 밖에 격리, `node_modules`(root·`channel-web-chat`·`codebase/packages/*`) 심링크로 vitest 부트스트랩. 두 건의 mutation을 독립 재현한 뒤 `git worktree remove --force` + 공유 워크트리 `git status --short`/`git diff --stat`로 무오염 확인(공유 워크트리 코드는 수정하지 않음).
- `spec/7-channel-web-chat/{1-widget-app,3-auth-session,4-security}.md`를 Read로 직접 열어 관련 §를 코드와 line-level 대조.

## 발견사항

- **[INFO]** RESOLUTION.md(`14_56_27`) W2 주장 — "referrer 제거 시 이제 실패(퇴화 탐지)" 독립 재현 확인
  - 위치: `use-widget-eager-start.test.ts:2359-2429`(신규 거울상 테스트 "겹친 부팅에서 나중 진입이 차단으로 먼저 끝나도...")
  - 상세: `document.referrer` 오버라이드(4줄)를 제거하는 mutation을 격리 워크트리에서 실행 — 수정 전이었다면 조용히 통과했을 시나리오가, 현재(수정 후) 코드에서는 `AssertionError: expected 'streaming' to be 'blocked'`(`:2417`)로 정확히 실패함을 실측했다. RESOLUTION의 주장과 완전히 일치.
  - 제안: 없음(주장 확인됨).

- **[INFO]** RESOLUTION.md(`14_56_27`)·testing.md 주장 — "`bootGenRef` 3줄 원본 재도입 시 정확히 2건(`:2103`+신규) 실패" 독립 재현 확인
  - 위치: `use-widget.ts`(격리 워크트리에 원 커밋 `f4785a953`의 3줄을 그대로 재도입 — `bootGenRef` 선언, `applyConfig` 진입부 `bootGen` 캡처, BLOCKED 분기의 `if (bootGenRef.current === bootGen) pendingResetRef.current = false;` 세대 게이팅), `use-widget-eager-start.test.ts` 44건 전체 재실행
  - 상세: 결과 `Tests 2 failed | 42 passed (44)` — 실패는 정확히 `"차단된 부팅 중의 resetSession 은 이후 성공하는 부팅이 이행한다"`(`:2103`, 순차)와 신규 거울상 테스트(겹침) 둘뿐이고, `"겹친 부팅의 결과가 갈릴 때..."`(`:2275`, 기존 "혼합 순서")와 `"겹친 부팅(boot 재전송)이..."`(`:2199`)는 통과 — RESOLUTION·SUMMARY·testing.md 세 문서가 공통으로 주장한 매트릭스와 완전 일치한다.
  - 제안: 없음(주장 확인됨). 이번 diff가 정정한 코멘트("**겹침 케이스 중에선** 이 테스트만 잡는다" + "의도치 않은 이중 방어선이니 어느 쪽도 지우지 말 것")도 이 실측과 정확히 부합해 정정 자체가 정확하다.

- **[INFO]** 베이스라인·구조적 주장 재현 — `use-widget-eager-start.test.ts` 44/44, `channel-web-chat` 전체 `npx vitest run` 실측 결과 `22 files / 376 tests` 전부 통과(자기보고 수치와 일치). `pendingResetRef` 참조는 선언 제외 정확히 2곳(`:255` SET, `:764-765` CONSUME)이고 BLOCKED 분기(`:750-753`)는 어느 쪽도 건드리지 않음(`grep` 확인) — concurrency.md(`14_30_15`)의 "네 방향 수렴" 주장과 일치. `bootGenRef`는 프로덕션 코드 전체에서 완전히 제거됐고 유일한 잔존 참조는 테스트의 반사실적(counterfactual) 코멘트 1건뿐(`grep -rn bootGenRef codebase/`) — `14_30_15` W3 수정이 이번 diff로도 재도입되지 않았음을 확인.
  - **표본 검증 결론**: 이번 두 RESOLUTION(`14_30_15`, `14_56_27`)의 핵심 기술 주장에서 과대 주장을 발견하지 못했다. 사용자가 우려한 과거 패턴(`02_31_18` 라운드에서 "3중 단언" 중 1건이 실제로는 fake timer 부재로 항상 통과하는 decorative 단언이었던 사례, `review/code/2026/07/17/02_31_18/RESOLUTION.md:9-12`)과 달리, 이번 라운드가 추가한 두 단언은 mutation에 대해 실질적 검출력을 갖는 것으로 실측 확인됐다.
  - 제안: 없음.

- **[INFO]** spec fidelity — `spec/7-channel-web-chat/1-widget-app.md §3.1/§3.2`, `3-auth-session.md §3.1`, `4-security.md §3-①` 대조 결과 코드와 line-level로 일치
  - (a) `blocked`는 `widget-state.ts`의 `WidgetPhase`에 정의된 정식 phase이고, `1-widget-app.md §3.2`("`blocked`(임베드 불허, 4-security §3-①)는... 복구 불가 — host `show`로도 해제되지 않는다")·`4-security.md §3-①`("host origin 미탐지... 시에도 통과(fail-open)")와 `isEmbedAllowed`/`detectHostOrigin`(`use-widget.ts:54-64`, `host-bridge.ts:93-108`) 구현이 정확히 일치한다. 신규 테스트의 "전제 고정" 단언(BLOCKED 도달 확인)이 지키는 시나리오가 정확히 이 fail-open 규칙의 조용한 퇴화다.
  - (b) 컨텍스트가 지목한 `3-auth-session.md §3.1`의 "200+종료 REST 분기 구현됨" 정정(commit `2a789a645`, 이번 리뷰 대상 diff 이전에 같은 branch에서 이미 반영됨)을 코드로 직접 재검증했다 — `seedWaitingFromStatus`(`use-widget.ts:394-431`, terminal 체크 `:407-416`)가 `TERMINAL_EVENTS` 매칭 시 `finalizeEnded`를 호출하는 분기가 실재하고, 이를 고정하는 회귀 테스트(`:240` "복원된 세션이 이미 terminal...", `:1278` 부근 "replay_unavailable 폴백에서 execution이 이미 종료됐으면...")도 실재해 44/44 통과 중이다. 반대 방향도 확인했다 — spec이 여전히 "미구현(Planned)"으로 남긴 404·401 REST 분기는 `EiaClient.getStatus`(`eia-client.ts:94-101`)에 상태코드별 분기가 전혀 없어(모든 비-2xx가 동일한 `EiaError`로 뭉뚱그려짐) 실제로 미구현임을 확인 — 정정이 과다·과소 어느 쪽으로도 치우치지 않고 정확한 범위로 이뤄졌다.
  - (c) 회색지대 1건(참고용, blocking 아님): `pendingResetRef`가 지키는 "차단된 부팅 중 접수한 리셋은 이후 성공하는 부팅이 이행한다" 계약은 곧 같은 마운트 인스턴스가 `blocked`에서 (그 자신이 아니라 **후속 `applyConfig` 호출**을 통해) 벗어나는 경로를 전제한다. spec `§3.2`의 "복구 불가 — host `show`로도 해제되지 않는다"는 문구는 `show` 경로만 명시적으로 배제할 뿐 "후속 성공 부팅"까지 다루지 않아 이 세부 구분에는 침묵한다 — 코드 JSDoc(`use-widget.ts:184-191`)이 이미 "재전송 호출부가 마운트를 유지한 채 endpoint를 바꾸지 않는다"는 오늘 기준 전제를 스스로 명시해 관리하고 있어 spec 갱신을 요하는 결함으로 보지 않는다.
  - 제안: 없음(spec 일치 확인). 정정 (b)는 이번 diff의 파일이 아니라 선행 커밋(`2a789a645`, consistency-checker 발견)이 수행했으므로 이번 requirement 리뷰의 조치 대상은 아니지만, 컨텍스트가 명시적으로 표본 검증을 요청해 함께 확인했다.

- **[INFO]** 잔여 이월 항목(신규 아님) — testing.md가 "이월"로 명시한 "config 확립~`pendingResetRef` 소비 사이 동기 구간 불변식 미테스트"(mutation E: 우발적 `await` 삽입 시 44/44 전부 통과, 탐지 못 함)는 이번 diff의 범위 밖으로 이미 정확히 스코프아웃됐고 JSDoc "불변식 의존 주의" 패턴 확장이 후속 후보로 명시돼 있다. 새로 발견한 문제가 아니라 기존 이월 상태를 재확인한 것이다.
  - 제안: 없음(다음 라운드 후보로 이미 계획됨).

- TODO/FIXME/HACK/XXX 마커: diff 전체 및 변경된 코멘트 블록에서 검색 결과 없음.

## 요약

이번 diff(`e9dcb27c9`)는 `use-widget-eager-start.test.ts`의 회귀 테스트 2건에 "BLOCKED 도달" 전제 단언을 추가하고 인접 코멘트의 부정확한 "유일한 가드" 문구를 정정한 순수 테스트 변경으로, `git show`로 확인한 프로덕션 코드 변경은 0줄이다. 컨텍스트가 요청한 대로 `14_30_15`·`14_56_27` 두 RESOLUTION.md의 핵심 기술 주장(신규 단언의 퇴화 탐지력, `bootGenRef` 재도입 시 정확한 실패 매트릭스, `pendingResetRef` 참조 2곳·BLOCKED 무영향, `bootGenRef` 완전 제거, 375→376 스위트 수치)을 격리 워크트리 mutation 실험과 `grep`/`git show`로 독립 재현·대조한 결과 전부 실측과 정확히 일치했고, 과거(`02_31_18`) 라운드에서 발견됐던 decorative 단언·과대 주장 유형은 이번 표본에서 재발하지 않았다. 관련 spec(`1-widget-app.md §3.1/§3.2`, `3-auth-session.md §3.1`, `4-security.md §3-①`)도 구현과 line-level로 일치했으며, 특히 컨텍스트가 지목한 "200+종료 REST 분기 구현됨" 정정은 구현됨/미구현 양쪽 경계를 모두 코드로 재확인해 정확한 범위임을 확인했다. TODO/FIXME류 미완성 마커는 없고, 유일한 미해결 항목(동기 구간 불변식 미테스트)은 이미 이월로 명시적 스코프아웃된 기존 사항이라 이번 라운드의 새로운 결함이 아니다.

## 위험도

NONE
