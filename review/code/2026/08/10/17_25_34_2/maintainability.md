# Maintainability Review — `17_25_34_2`

본 라운드의 diff 는 대부분 `review/code/**` 하위 자동 생성 리뷰 산출물(JSON/MD, `_retry_state.json`·`meta.json`·`RESOLUTION.md`·`SUMMARY.md`·직전 라운드 리뷰 리포트 사본)과 `spec/7-channel-web-chat/3-auth-session.md` 문서 갱신이다. 이들 자체는 사람이 손으로 짠 애플리케이션 코드가 아니라 harness 가 쓴 프로세스 로그/문서라 가독성·네이밍·중첩·매직넘버 등 코드 체크리스트가 실질적으로 적용되지 않는다. 지시에 따라 이번 리뷰의 핵심은 `RESOLUTION.md` §3 가 서술하는 **`shouldAbortAfterSeed` 추출**과 **동등 뮤턴트 판단**의 타당성 검증이므로, 실제 소스 `codebase/channel-web-chat/src/widget/use-widget.ts` 를 직접 열어 대조했다.

## 검증 방법

`review/code/2026/08/10/17_25_34_2/_prompts/maintainability.md` 에는 `use-widget.ts` 의 diff 가 포함돼 있지 않아(이번 라운드는 리뷰 산출물 자체를 리뷰하는 라운드), `Read`/`Grep` 으로 현재 HEAD 의 `codebase/channel-web-chat/src/widget/use-widget.ts` 를 직접 열어 확인했다.

## 발견사항

- **[INFO]** 추출이 두 호출부 모두에 정확히 반영됐고 새 중복은 생기지 않았다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:120-122` (`function shouldAbortAfterSeed`), 호출부 `:716`(`start()` 내부)과 `:1073`(`applyConfig` 내부)
  - 상세: 두 호출부 모두 `if (shouldAbortAfterSeed(outcome)) return;` 로 통일돼 있고, 예전에 리터럴로 복제돼 있던 `outcome !== "continue" && outcome !== "refresh_deferred"` 형태는 파일 전체에서 더 이상 검색되지 않는다(`grep '"continue"\|"refresh_deferred"'` 로 전수 확인). `outcome !== "refresh_deferred"`(`:732`)·`outcome === "refresh_deferred"`(`:1074`) 는 남아있지만 이는 "중단할지" 가 아니라 "스트림만 건너뛸지" 를 판정하는 **별개의 단일 조건**이라 `shouldAbortAfterSeed` 로 흡수할 대상이 아니다(흡수하면 오히려 "abort" 와 "defer-stream-only" 두 의미가 한 헬퍼에 뭉개진다). 헬퍼는 module scope 순수 함수로, 타입 `SeedOutcome` 바로 아래 위치해 타입-가드 관계가 시각적으로도 붙어 있다.
  - 제안: 없음 — 현재 형태가 적절하다.

- **[INFO]** 화이트리스트→블랙리스트 뮤테이션이 "동등 뮤턴트" 라는 판단은 현재 코드 기준으로 옳다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:84-106`(`type SeedOutcome`), `:120-122`(`shouldAbortAfterSeed`)
  - 상세: `SeedOutcome` 은 `"ended" | "stale" | "continue" | "refresh_deferred"` 4개 리터럴로 닫힌 union 이고, `shouldAbortAfterSeed` 로 흘러드는 `outcome` 은 두 호출부 모두 `await seedWaitingFromStatus(...)` 의 반환값(`Promise<SeedOutcome>`, `:424`/`:569` 시그니처)이라 타입이 강제된다. 따라서 `outcome !== "continue" && outcome !== "refresh_deferred"` (화이트리스트) 와 `outcome === "ended" || outcome === "stale"` (블랙리스트) 는 **현재 4개 갈래에 한해** 진리표가 완전히 일치 — 진짜 동등 뮤턴트가 맞다. 두 형태가 갈라지는 지점은 5번째 `SeedOutcome` 갈래가 추가되는 미래 시점뿐이고, 그건 컴파일 타임 테스트로는 표현할 수 없는 "구조적" 보증이다(화이트리스트를 유지해야 새 갈래가 자동으로 fail-closed 된다는 JSDoc 의 설명과 일치). reviewer 의 "테스트가 아니라 구조로 막는다" 는 결론에 동의한다.
  - 제안: 없음 — 판단 자체는 타당하다.

- **[WARNING]** `RESOLUTION.md` 가 "생존이 정상임을 JSDoc 에 남겼다" 고 적었지만, 실제 JSDoc 에는 뮤테이션/동등성에 대한 언급이 없다.
  - 위치: `review/code/2026/08/10/17_15_33_2/RESOLUTION.md` 34행("그 사실을 JSDoc 에 남겼다(생존이 정상임을 기록)") vs. `codebase/channel-web-chat/src/widget/use-widget.ts:108-119`(`shouldAbortAfterSeed` JSDoc 전문)
  - 상세: 실제 JSDoc(`:108-119`)은 "왜 화이트리스트인가"(fail-closed 설계 의도)와 "왜 헬퍼로 뽑았는가"(두 호출부 리터럴 중복)만 설명한다. `grep -n "동등\|생존\|블랙리스트\|mutant\|뮤턴트\|뮤테이션" use-widget.ts` 와 동일 파일의 테스트(`use-widget-eager-start.test.ts`)를 전수 확인했으나 "화이트리스트→블랙리스트 뮤테이션은 동등/생존이 정상" 이라는 문구는 코드 어디에도 없다. 설계 의도(fail-closed)는 문서화돼 있어 숙련된 독자는 유추할 수 있지만, `RESOLUTION.md` 의 문구는 "그 사실(생존이 정상)을 JSDoc 에 남겼다" 고 단정해 실제보다 더 강하게 기록됐다고 주장한다. 이 갭은 향후 뮤테이션 커버리지 도구를 돌리는 사람이 이 survivor 를 보고 (근거 문서를 못 찾아) 결함으로 오인해 재조사할 여지를 남긴다.
  - 제안: `shouldAbortAfterSeed` JSDoc 에 한 줄 — 예: "이 화이트리스트를 블랙리스트(`outcome === "ended" || outcome === "stale"`)로 바꾸는 뮤테이션은 현재 4개 갈래에서는 진리표가 동일해 생존한다(동등 뮤턴트, 정상) — 갈리는 지점은 5번째 `SeedOutcome` 갈래 추가 시점뿐이다." 를 덧붙이면 `RESOLUTION.md` 의 서술과 실제 코드가 일치하고, 향후 리뷰어가 같은 생존을 재조사하는 비용을 없앤다.

- **[INFO]** 네이밍·스타일 일관성은 기존 파일 컨벤션과 부합한다.
  - 위치: `codebase/channel-web-chat/src/widget/use-widget.ts:120`
  - 상세: 같은 파일의 다른 boolean predicate(`isStale`, `isAttemptStale`, `cannotApplyConfig`, `sessionEstablished`)와 마찬가지로 `shouldAbortAfterSeed` 도 의도가 이름에서 바로 읽히는 동사구 형태이고, export 하지 않는 module-scope 순수 함수로 둔 것도 `configFromQuery` 등 기존 비공개 헬퍼 패턴과 일치한다.

## 요약

이번 라운드의 diff 자체는 리뷰 산출물·spec 문서라 애플리케이션 코드 체크리스트가 거의 적용되지 않지만, 지시받은 핵심 질문(직전 지적으로 추출한 `shouldAbortAfterSeed` 의 타당성)은 실제 소스를 열어 검증했다. 두 호출부 모두 헬퍼로 통일돼 리터럴 중복이 완전히 제거됐고 새로운 중복은 생기지 않았으며, "화이트리스트→블랙리스트" 뮤테이션이 동등 뮤턴트라는 reviewer 의 판단도 `SeedOutcome` 이 4개 리터럴로 닫힌 union 이라는 사실에 비춰 정확하다. 다만 `RESOLUTION.md` 가 "생존이 정상임을 JSDoc 에 남겼다" 고 적은 것과 달리 실제 JSDoc 에는 그 문장이 없어, 산출물 서술과 코드 사이에 작은 괴리가 있다 — 기능적 결함은 아니지만 향후 뮤테이션 커버리지 재실행 시 불필요한 재조사를 유발할 수 있는 문서 정확도 이슈다.

## 위험도

LOW
