# 부작용(Side Effect) 리뷰 — 2026-07-17 15_26_11

**대상**: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(회귀 테스트 2건에 BLOCKED 전제 단언 추가 + 주석 정정 1건, 프로덕션 코드 0줄). 나머지 파일(`review/code/2026/07/17/{14_30_15,14_56_27}/*`)은 이전 라운드 리뷰 산출물(md/json)이라 §발견사항 6 에서 별도로 짧게 다룬다.

이번 라운드 orchestrator 의 핵심 질의("신규 전제 단언이 기존 탐지력을 약화시키지 않는가")는 `testing`(14_56_27)의 보고를 그대로 인용하지 않고, 격리 워크트리에서 독립 mutation 으로 재현해 검증했다.

## 검증 방법론

- `git worktree add --detach <scratchpad>/mutation-wt-side-effect HEAD` 로 공유 워크트리 밖에 격리. `node_modules`(root·`channel-web-chat`·`codebase/packages/*`)는 공유 워크트리 실디렉터리 symlink 로 부트스트랩(vitest 전용).
- 베이스라인(HEAD, mutation 없음)을 먼저 `npx vitest run src/widget/use-widget-eager-start.test.ts --reporter=verbose` 로 직접 실행 — 44/44 pass, 이번 델타가 건드린 두 테스트 각각 8~9ms(느리거나 불안정하지 않음).
- `bootGenRef` 소유권 설계(원본 커밋 `f4785a953`)의 정확한 3줄(`const bootGenRef = useRef(0)` 선언 · entry 캡처 `const bootGen = ++bootGenRef.current` · BLOCKED 분기 게이팅 `if (bootGenRef.current === bootGen) pendingResetRef.current = false`)을 현재 HEAD `use-widget.ts` 위에 surgical 재도입(`git diff --stat` 으로 의도한 3줄만 바뀌었음을 대조), 44건 재실행.
- 실패 시 스택트레이스를 개별 확인해 **어느 단언에서 실패했는지**(신규 전제 단언 vs 기존 최종 단언)까지 대조.
- 종료 후 `git worktree remove --force`, 공유 워크트리는 `git status --short`·`git diff --stat -- codebase/`(빈 결과)로 무오염 재확인.

## 발견사항

- **[INFO]** 프로덕션 코드 0줄 변경 — 부작용 표면 자체가 부재
  - 위치: commit `e9dcb27c9`(`test(web-chat): 회귀 테스트 2건의 BLOCKED 전제 고정 + "유일한 가드" 문구 정정`) 전체
  - 상세: `git show --stat e9dcb27c9` 직접 대조 — 변경 파일은 `use-widget-eager-start.test.ts` 단 1개(18 insertions, 4 deletions), `use-widget.ts`(프로덕션)는 diff 에 등장하지 않는다. 변경 내용도 `renderHook()` 반환값 캡처(2곳) + `expect().toBe("blocked")` 전제 단언 추가(2곳) + 주석 텍스트 정정(1곳)뿐이며, 신규 mock·신규 전역 stub·신규 fetch 분기는 0건. 점검 관점 8개(상태변경/전역변수/파일시스템/시그니처/인터페이스/환경변수/네트워크/이벤트) 전부 해당 없음.
  - 제안: 없음(확인됨).

- **[INFO]** `renderHook()` 반환값 캡처는 런타임 부작용 없음
  - 위치: `use-widget-eager-start.test.ts:2321`, `:2405`
  - 상세: `renderHook(() => useWidget())` → `const { result } = renderHook(() => useWidget())` 변경은 호출자 측 destructuring 일 뿐, `@testing-library/react` 의 `renderHook` 내부 동작(렌더 횟수·effect 스케줄링·언마운트 시점)에 어떤 영향도 주지 않는다 — 반환값을 버리든 잡든 훅 실행은 동일하다. `result` 는 각 `it()` 콜백의 독립 클로저에 선언되어 다른 테스트의 동명 바인딩과 충돌하지 않음을 실제 파일로 확인(각 테스트가 자기 완결적 fetch mock·`embedResolvers` 를 갖는 기존 패턴과 동일 스코프 규율).
  - 제안: 없음.

- **[INFO]** 신규 전제 단언은 동기·read-only — 타이밍/부수효과 없음
  - 위치: `use-widget-eager-start.test.ts:2336`, `:2421`
  - 상세: `expect(result.current.state.phase).toBe("blocked")` 는 `await` 도 `act()` 도 쓰지 않는 순수 동기 read 다. 직전의 `await act(async () => { ...; await flushAsync(); })` 가 이미 그 시점까지의 microtask 를 전부 배출한 뒤이므로, 이 read 는 추가 tick·추가 렌더·추가 `fetch` 호출을 유발하지 않는다 — 뒤따르는 `hookPosts`/`interactCalls` 카운트 단언의 타이밍에 영향 없음. RTL 컨벤션상 상태 변경 없는 read 는 `act()` 밖에서 안전(경고 없음).
  - 제안: 없음.

- **[INFO]** 독립 mutation 재현 — 신규 전제 단언이 기존 결함 탐지 경로를 가리거나 대체하지 않음(직교적 부가 관계)
  - 위치: 격리 워크트리에서 `use-widget.ts` 에 `bootGenRef` 소유권 mutation 재도입(위 §검증 방법론)
  - 상세: mutation 적용 후 44건 중 **정확히 2건 실패** — `"차단된 부팅 중의 resetSession 은 이후 성공하는 부팅이 이행한다"`(순차)와 `"겹친 부팅에서 나중 진입이 차단으로 먼저 끝나도 먼저 진입한 쪽이 리셋을 이행한다"`(신규 거울상, 이번 델타가 전제 단언을 추가한 테스트). `"겹친 부팅의 결과가 갈릴 때..."`("혼합 순서" 테스트, 이번 델타가 같은 패턴을 물려받아 함께 정정한 테스트)는 여전히 **통과**. `testing`(14_56_27)·`concurrency`(14_30_15) 의 기존 보고 수치(설계 c → 2건 실패)와 정확히 일치.
    - **핵심 관찰**: 두 실패의 스택트레이스를 직접 확인한 결과, 실패 지점은 신규 전제 단언(`toBe("blocked")`)이 아니라 **원래부터 있던 최종 단언**(`await waitFor(() => expect(hookPosts).toBe(1))`, `AssertionError: expected +0 to be 1`)이었다. 즉 이 mutation 시나리오에서 신규 전제 단언은 정상적으로 **통과**한다(BLOCKED 도달 자체는 이 mutation 과 무관하게 그대로 성립하기 때문) — 실제 결함 탐지는 여전히 기존 메커니즘이 전담한다. 신규 단언이 기존 탐지 흐름을 가로막거나(조기 abort 로 뒤쪽 단언 미실행) 대체하는 관계가 아니라, "premise 가 거짓이 되는 별개의 실패 모드"만 추가로 커버하는 순수 monotonic 확장임을 실측으로 확인했다 — 탐지력 약화 부작용 없음.
  - 제안: 없음(주장 확인, 추가 조치 불요).

- **[INFO]** 주석 정정 자체가 향후 잠재적 side effect(오삭제 리스크)를 선제 차단
  - 위치: `use-widget-eager-start.test.ts:2349-2358`
  - 상세: 이전 문구("이 테스트만 잡는다. 네 번째 잘못된 설계의 재도입을 막는 유일한 가드다")는 스코프를 명시하지 않아, 향후 유지보수자가 "순차 케이스(`:2103` 테스트)는 겹침 케이스(신규 거울상)와 중복돼 보인다"고 오판해 순차 테스트를 삭제할 경우 **의도치 않게 회귀 탐지 커버리지가 줄어드는 부작용**을 유발할 수 있었다(두 테스트가 서로 다른 시나리오로 같은 결함을 잡는 이중 방어선이기 때문 — 위 mutation 재현에서도 실제로 둘 다 독립적으로 실패함을 확인). 이번 델타는 스코프를 "겹침 케이스 중에선" 으로 명시하고 "의도치 않은 이중 방어선이니 어느 쪽도 중복으로 지우지 말 것"을 명문화해 그 잠재적 미래 side effect 경로를 닫는다. `grep -rn "유일한 가드" codebase/` 로 코드베이스 전수 확인한 결과 정정된 문구만 남아 있고 stale 잔존 참조가 없다.
  - 제안: 없음(이미 조치됨).

- **[INFO]** payload 에 포함된 파일 2–7(`review/code/2026/07/17/{14_30_15,14_56_27}/*`)은 이전 라운드 산출물 — 이번 델타의 부작용 표면과 무관
  - 위치: `review/code/2026/07/17/14_30_15/{RESOLUTION.md,concurrency.md,meta.json,side_effect.md,_retry_state.json}`, `review/code/2026/07/17/14_56_27/{RESOLUTION.md,SUMMARY.md,_retry_state.json,meta.json,testing.md}` (전부 `new file mode 100644`)
  - 상세: 전부 이전 두 라운드에서 이미 생성·커밋된 리뷰 산출물(문서/오케스트레이터 상태 JSON)이며 실행 코드가 아니므로 8개 점검 관점 어디에도 해당하지 않는다. 경로도 프로젝트 컨벤션(`review/code/<YYYY>/<MM>/<DD>/<hh_mm_ss>/`)을 따른다. `_retry_state.json`/`meta.json` 에 로컬 절대경로(`/Volumes/project/...`)가 노출되지만 이미 diff 전반에 반복 등장하는 로컬 개발 워크트리 경로일 뿐 비밀정보가 아니다.
  - 제안: 없음(참고용 확인).

## 요약

이번 델타(`e9dcb27c9`)는 `use-widget-eager-start.test.ts` 단일 테스트 파일에 `renderHook()` 반환값 캡처 2건 + `expect(phase).toBe("blocked")` 전제 단언 2건 + 주석 정정 1건을 추가한 것이 전부이며, 프로덕션 코드(`use-widget.ts`)는 `git show --stat`/`git diff --stat` 직접 대조로 0줄 변경임을 확인했다. 8개 점검 관점(의도치 않은 상태 변경·전역 변수·파일시스템·시그니처·인터페이스·환경 변수·네트워크·이벤트/콜백) 전부 해당 사항이 없다 — 신규 단언은 동기 read-only 이고 `act()` 가 불요하며, 신규 fetch·전역 stub·타이밍 변화가 전혀 없다. orchestrator 가 지목한 핵심 질문("전제 단언이 기존 탐지력을 약화시키는지")은 격리 워크트리(생성 후 `--force` 제거로 위생 유지)에서 `bootGenRef` 소유권 설계(원본 3줄)를 surgical 재도입해 독립 재현했으며, 결과는 정확히 2건 실패(순차 테스트 + 신규 거울상 테스트, "혼합 순서" 테스트는 통과)로 `testing`(14_56_27)·`concurrency`(14_30_15) 의 기존 보고치와 정확히 일치했다. 나아가 실패 스택트레이스를 직접 대조해 두 실패 모두 **신규 전제 단언이 아니라 기존 최종 단언**(`hookPosts` 카운트)에서 발생함을 확인했다 — 신규 단언은 이 mutation 시나리오에서 정상 통과하며 기존 탐지 메커니즘을 가리거나 대체하지 않는 순수 부가(monotonic) 관계다. 오히려 이번 델타의 주석 정정("이중 방어선이니 어느 쪽도 지우지 말 것" 명문화)은 향후 유지보수자가 부정확한 옛 문구("유일한 가드")를 신뢰해 순차 테스트를 오삭제할 잠재적 미래 side effect 경로를 선제적으로 닫는 효과가 있다. payload 에 포함된 나머지 파일(2–7)은 이전 라운드의 리뷰 산출물(md/json)로 실행 코드가 아니며 부작용 표면이 존재하지 않는다.

## 위험도

NONE
