# 문서화(Documentation) 리뷰 — `use-widget-eager-start.test.ts` 회귀 테스트 전제 고정 + 주석 정정 (2026-07-17 15_26_11)

**대상**: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`(테스트 2건에 전제 단언 추가 + 주석 2건 정정, **프로덕션 코드 0줄 변경** — 커밋 `e9dcb27c9` 자체가 diff 전체). 나머지 파일(`review/code/2026/07/17/{14_30_15,14_56_27}/*`)은 이전 라운드 리뷰 산출물이라 문서화 관점의 정식 리뷰 대상(공개 API·설정 문서)이 아니며, 본 라운드가 그 라운드들의 지적을 어떻게 반영했는지 확인하는 **근거 자료**로만 사용했다.

## 검증 방법론

- 셋 대조 확인: (1) 진행 중인 diff(prompt 내 hunk), (2) 현재 HEAD 의 `use-widget-eager-start.test.ts` 실제 내용(`Read` 도구, 워크트리 오염 없이 조회만), (3) `use-widget.ts` 의 `pendingResetRef` 선언부·JSDoc·SET/CONSUME 접점(코드 정독으로 계약 검증).
- `git log`/`git show e9dcb27c9`로 이번 델타가 정확히 prompt 의 diff 와 일치하며 프로덕션 파일은 건드리지 않았음을 확인.
- `grep -rn bootGenRef codebase/` 로 죽은 참조 잔존 여부 재확인.
- 코드 수정은 하지 않았다(읽기 전용 리뷰, 워크트리 위생 문제 없음).

## 발견사항

- **[INFO]** 직전 라운드(`14_56_27` testing) WARNING#2 — "유일한 가드" 주장 부정확 — 가 이번 diff 로 정확히 해소됨(코드 대조 확인)
  - 위치: `use-widget-eager-start.test.ts:2346-2358`(테스트 `"겹친 부팅에서 나중 진입이 차단으로 먼저 끝나도 먼저 진입한 쪽이 리셋을 이행한다"`, 舊 `:2350`) 상단 주석
  - 상세: 기존 "이 테스트만 잡는다. 네 번째 잘못된 설계의 재도입을 막는 유일한 가드다."라는 절대적 문구가 "**겹침 케이스 중에선** 이 테스트만 잡는다."로 스코프가 명시되고, 이어서 "단 스위트 전체로 보면 유일한 가드가 아니다 — 순차 케이스인 '차단된 부팅 중의 resetSession…'도 같은 mutation 을 독립적으로 잡는다 … **의도치 않은 이중 방어선이니 어느 쪽도 '중복'으로 지우지 말 것**"이 추가됐다. 이 서술은 `14_56_27` testing.md·RESOLUTION.md 가 mutation 실측으로 확인한 사실(bootGenRef 재도입 시 `:2103`+신규 정확히 2건 실패)과 정확히 일치하며, 향후 유지보수자가 "순차 테스트가 겹침 테스트와 중복돼 보인다"고 오판해 방어선 한쪽을 지우는 사고를 막는 명시적 경고를 코드에 남겼다는 점에서 이 hotspot 파일의 "주석이 RESOLUTION 류 문서에 증거로 인용되는 문화"에 맞는 적절한 조치다.
  - 제안: 없음(양호). 참고로 `grep -rn bootGenRef codebase/`는 파일 전체에서 이 한 곳(과거형·가정법 "재도입해도 통과한다" 문맥)만 잔존함을 확인했다 — 현재 코드에 `bootGenRef` 가 존재한다는 오독 위험 없음(죽은 참조 아님).

- **[INFO]** WARNING#1 — 신규 테스트의 거짓 음성 여지(2차 BLOCKED 도달 전제 미고정) — 도 정확히 해소됨(코드 대조 확인)
  - 위치: `use-widget-eager-start.test.ts:2333-2336`(`"겹친 부팅의 결과가 갈릴 때, 차단된 쪽이 살아있는 쪽의 리셋을 지우지 않는다"`, `:2275`), `:2417-2421`(`:2359` 신규 거울상 테스트)
  - 상세: 두 테스트 모두 `renderHook(() => useWidget())` → `const { result } = renderHook(() => useWidget())`로 캡처가 바뀌고, BLOCKED 를 유발하는 `embedResolvers[...]` resolve 직후 `expect(result.current.state.phase).toBe("blocked")` 전제 단언이 추가됐다. 두 주석 모두 "왜 필요한가"(document.referrer 부재 시 `detectHostOrigin` → null → `isEmbedAllowed` fail-open → "둘 다 ALLOWED"로 조용히 퇴화해도 `hookPosts===1`만으로는 구분 못 해 통과해버림)를 구체적으로 서술하고 `ai-review 2026-07-17 14_56_27 testing` 라운드를 정확히 인용한다. `use-widget.ts:51`의 `isEmbedAllowed` JSDoc("soft 컨트롤이므로 fail-open: 설정 조회 실패·enforce 꺼짐·호스트 origin 미탐지 시 허용한다")과 대조해도 "fail-open" 서술은 정확하다. `:2275` 쪽 주석은 "신규 거울상 테스트와 동형"이라 명시해 자매 테스트와의 대칭 관계까지 정확히 짚었고, 이 파일의 기존 컨벤션(`:2103`이 1차·2차 전제를 둘 다 명시 단언하는 패턴, 주석 "2차 전제 고정 — …")과 스타일이 일치한다.
  - 제안: 없음(양호).

- **[INFO]** 테스트 주석이 서술하는 "폐기 로직을 다시 넣지 말 것" 계약이 `use-widget.ts` 소스 코드와 완전히 일치함(교차 검증)
  - 위치: `use-widget.ts:162-193`(`pendingResetRef` JSDoc — 이번 diff 범위 밖, 프로덕션 코드 무변경), `use-widget-eager-start.test.ts:2271-2273`("이 테스트가 지키는 것은 … 폐기 로직의 완전한 부재다 … `use-widget.ts` 의 `pendingResetRef` JSDoc §계약 참조")
  - 상세: JSDoc 은 "**계약: 접수된 리셋은 다음 성공하는 부팅이 이행한다. 소비 외에는 아무도 지우지 않는다.**"(`:170`)와 "**폐기 로직을 다시 넣지 말 것**"(`:176`)을 명문화하고, 4회 연속 회귀 이력(유령 리셋→진입-시 일괄 폐기→BLOCKED 한정 폐기→부팅 세대 소유권)을 구체적으로 서술한다. 실제 코드를 추적하면 `pendingResetRef` 의 SET 은 `teardownSession`(`:255`, config 미확립 시 1곳)뿐이고 CONSUME 은 `applyConfig`(`:764-768`, `loadSession` 직전 1곳)뿐이며, `if (!allowed) { dispatch({type:"BLOCKED", …}); return; }`(`:750-753`) 분기에는 `pendingResetRef` 를 건드리는 코드가 전혀 없다 — "소비 외에는 아무도 지우지 않는다"는 계약이 코드로 정확히 성립하고, 이번 diff 가 정정한 테스트 주석들도 이 계약과 모순되지 않는다.
  - 제안: 없음.

- **[INFO]** (이월, 이번 diff 책임 범위 아님) "config 확립~리셋 소비 사이가 동기 구간이어야 한다"는 세 번째 불변식이 `pendingResetRef` JSDoc 에 아직 명문화되지 않음
  - 위치: `use-widget.ts:162-193`
  - 상세: `14_56_27` testing.md 가 신규 mutation(우발적 `await Promise.resolve()` 삽입, 44/44 여전히 PASS)으로 발견해 "이월" 처리한 항목과 동일하다. `configRef`(`:250-253`)·`triggerEndpointPath`(`:184-191`) 두 "불변식 의존 주의" 노트와 같은 형식의 문서화가 아직 없다. 오늘 기준 코드에 해당 `await` 가 없어 도달 불가(즉시 결함 아님)이고, 이번 diff 는 테스트 파일만 건드려 이 gap 을 만들지도 악화시키지도 않았다 — 참고용 재확인일 뿐 새 발견이 아니다.
  - 제안: 다음 라운드에서 `pendingResetRef` JSDoc 에 "SET~CONSUME 사이 동기 구간 불변식" 노트 추가 고려(비긴급, 이번 diff 필수 아님).

- **[INFO]** README·CHANGELOG·API 문서·설정 문서·예제 코드: 해당 사항 없음
  - 상세: 이번 델타는 테스트 파일의 단언 2건 추가 + 인라인 주석 2건 정정뿐이며 프로덕션 코드·공개 API·환경변수·설정 옵션·사용 패턴 변경이 전혀 없다(diff·`git show e9dcb27c9` 로 확인). `codebase/channel-web-chat/README.md` 갱신, spec 문서(`spec/7-channel-web-chat/1-widget-app.md` 등, 이미 `resetSession` coalesce 동작을 서술 중) 동기화, CHANGELOG 항목 모두 이번 라운드 기준 불필요하다고 판단한다.

## 요약

이번 델타는 프로덕션 코드 0줄 변경의 순수 테스트/주석 수정으로, 직전 라운드(`14_56_27` testing)가 지적한 두 WARNING—"이 테스트만 잡는다"는 단정이 실제로는 "겹침 케이스 중에선"이라는 암묵 스코프에서만 참이었던 부정확성, 그리고 신규 거울상 테스트가 `result`를 캡처하지 않아 "2차가 실제로 BLOCKED 에 도달했는가" 전제를 고정하지 못해 fail-open 퇴화를 놓칠 수 있었던 거짓 음성 여지—를 정확하고 완전하게 해소했다. 수정된 주석은 `use-widget.ts`의 실제 소스(`pendingResetRef` SET·CONSUME 정확히 2곳, BLOCKED 분기엔 폐기 코드 전무, `isEmbedAllowed`의 fail-open 명세)와 대조해도 사실과 정확히 일치하고, "폐기 로직을 다시 넣지 말 것"이라는 JSDoc 계약을 훼손 없이 재천명하며 향후 "중복 정리" 오판으로 의도치 않은 이중 방어선의 한쪽이 삭제되는 사고를 막는 명시적 경고까지 새로 추가했다. `bootGenRef` 등 죽은 참조도 파일 전체에서 과거형 문맥 1곳 외에는 없으며, README·CHANGELOG·API·설정 문서는 이 델타 성격상 해당 사항이 없다. 유일한 잔여 항목은 이미 이전 라운드에서 별도로 이월 처리된 "동기 구간 불변식 미문서화" 하나뿐이고, 이번 diff 의 책임 범위 밖이며 악화되지도 않았다. 종합하면 이번 델타는 문서 결함을 새로 만들지 않았을 뿐 아니라, 4라운드 연속 회귀가 난 hotspot 파일에서 이전에 발견된 문서 정확성 문제를 정확히 교정한 순수 개선이다.

## 위험도

NONE
