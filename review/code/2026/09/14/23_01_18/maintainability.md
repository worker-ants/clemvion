# 유지보수성(Maintainability) 리뷰 — trigger-config-lost-update (2026-09-14 23:01 라운드)

## 검토 범위

이 PR 은 이미 8라운드의 `/ai-review` 를 거쳤다(`18_17_44` ~ `22_24_35`). 이번 라운드는 직전
라운드(`22_24_35`) 이후 새로 커밋된 마지막 커밋 `bcba1dc5d`(1라운드에 적어 둔 함정을
7라운드에 반복한 것을 닫는 커밋 — `mergeIntoFreshSubKey` 도입, schedules 뮤테이션 테스트
보강, 테스트 헬퍼 `at()` 중복 해소, CHANGELOG 자기모순 정정)를 실제 파일 대조로 확인했다.
전체 diff(`git diff origin/main...HEAD -- codebase/`)도 함께 훑어 직전 라운드가 남긴 INFO
항목들의 현재 상태를 재확인했다.

## 발견사항

- **[WARNING]** `mergeIntoFreshSubKey` 삽입이 기존 JSDoc 을 자기 함수에서 떼어내 다시
  orphan 으로 만들었다 — 이 PR 이 이미 두 번 겪은 결함 클래스의 재발
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:361`~`367` (orphan 이
    된 JSDoc 블록), `:386`(`mergeIntoFreshSubKey` 선언 — 새 JSDoc 은 이 함수를 정확히
    설명함), `:400`(`throwTriggerNotFound` — 이제 JSDoc 이 없음)
  - 상세: `git log -S`로 확인하면 `«없다» 를 그대로 던진다 — 검증할 행이 아예 없는 자리용.`
    로 시작하는 JSDoc(361-367번 줄)은 커밋 `bf2becd0c`(*"내가 만든 orphan JSDoc 을
    되돌린다"*)가 정확히 `throwTriggerNotFound()` 바로 위에 복원해 둔 것이다. 그런데 이번
    라운드의 커밋 `bcba1dc5d` 가 그 JSDoc 과 `throwTriggerNotFound()` 사이에
    `mergeIntoFreshSubKey`(새 JSDoc 38줄 포함)를 그대로 끼워 넣었다 — diff 자체가
    `+  /**\n+   * 락 안에서 재읽은 ...` 를 기존 JSDoc 의 `*/` 바로 다음 줄에 추가하고,
    `throwTriggerNotFound(): never {` 는 그 뒤로 밀려났음을 보여준다. 결과: (a) 361-367
    JSDoc 은 이제 바로 아래(368번 줄)에 시작하는 또 다른 `/**` 블록과 빈 줄 없이 붙어 있어
    무엇을 설명하는지 read 시점에 헷갈리고, (b) `mergeIntoFreshSubKey` 를 실제로 설명하는
    JSDoc(368-385)은 정확하지만 그 위에 무관한 JSDoc 이 한 겹 더 얹힌 모양이 됐고,
    (c) `throwTriggerNotFound()` 자신은 이제 설명이 전혀 없다. 이 PR 은 정확히 같은 결함
    클래스(orphan JSDoc)를 `hooks.service.ts` 의 `CCH-NF-03` 자리에서 이미 한 번 만들었고
    (`review/code/2026/09/14/21_18_21/maintainability.md` WARNING), `bf2becd0c` 가 그것과
    이 `throwTriggerNotFound` 자리를 함께 정정했다(커밋 메시지 자체가 "내가 만든 orphan
    JSDoc 을 되돌린다"). 이번 커밋의 메시지("1라운드에 적어 둔 함정을 7라운드에 그대로
    밟았다")가 다루는 결함(하위 키 재작성)과는 다른 결함이지만, **같은 아이러니** —
    새 코드를 기존 문서 블록과 그 대상 함수 "사이"에 끼워 넣는 편집 습관이 이 PR 에서
    최소 두 번째로 같은 종류의 결함을 냈다.
  - 제안: 361-367 JSDoc 블록을 `mergeIntoFreshSubKey` 아래, `throwTriggerNotFound()`
    바로 위로 옮긴다(즉 삽입 순서를 "새 함수 + 새 JSDoc 먼저, 기존 JSDoc+함수 그대로 뒤에"
    로 바꾸면 된다). 이번이 이 PR 에서 이 결함 클래스가 두 번째로 나타난 것이므로, 세
    번째부터는 이 저장소 규율대로 "새 private 헬퍼는 항상 그 파일의 맨 끝(혹은 관련
    함수 바로 옆)에 추가하고, 기존 함수 사이에 끼워 넣지 않는다"는 편집 규칙을 코드
    리뷰 체크리스트에 명시하는 편이 산문으로 반복 지적하는 것보다 싸다.

- **[INFO]** `mergeIntoFreshSubKey` JSDoc 이 `@param freshConfig` 를 누락했다
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts:382`-`384`
  - 상세: `@param key`·`@param patch`·`@param fallback` 세 개는 문서화됐지만 첫 인자
    `freshConfig` 는 JSDoc 본문(369번 줄)에서 산문으로만 언급되고 `@param` 태그가 없다.
    함수 시그니처를 IDE 툴팁으로 볼 때 첫 인자 설명만 비게 된다. 사소한 누락이며 차단
    사유는 아니다.
  - 제안: `@param freshConfig 락 안에서 재읽은 최신 config.` 한 줄 추가.

- **[INFO]** `trigger-config-lock.spec.ts` 의 이중 JSDoc — 3라운드 연속 미병합, 이번 라운드도
  변경 없음(재확인 차원)
  - 위치: `codebase/backend/src/modules/triggers/trigger-config-lock.spec.ts:27`-`33`
    (`function makeManager` 바로 위)
  - 상세: `review/code/2026/09/14/21_50_09/maintainability.md`, `22_24_35/maintainability.md`
    가 이미 지적한 자리로, 이번 커밋(`bcba1dc5d`)이 이 파일을 건드리지 않아 여전히 두
    JSDoc 블록이 병합되지 않은 채 남아 있다(`git diff origin/main...HEAD --stat` 에
    이 파일 없음으로 확인). 동작 영향 없는 사소한 가독성 흠이라 이번 라운드가 새로
    만든 결함은 아니고, 계속 유예돼도 무방하지만 plan 후속 표에 아직 등재되지 않았다는
    점은 동일하다.
  - 제안: 두 블록을 하나로 합친다. 급하지 않음.

## 긍정적으로 확인한 점 (참고)

- `mergeIntoFreshSubKey(freshConfig, key, patch, fallback)` 은 이번 라운드가 지적된
  "산문으로 세 번째 반복될 뻔한 결함"(스냅샷 하위 객체 통째 대입)을 실제로 시그니처로
  막는다 — 호출부가 스냅샷 객체를 통째로 넘길 자리가 타입상 사라졌다. 세 호출부
  (`:868`, `:1148`, `:1419`)가 모두 같은 형태로 이 헬퍼를 거치게 바뀌어, 이전에 있던
  `(freshConfig) => ({ ...freshConfig, X: snapshot })` 패턴의 반복이 사라졌다.
- 테스트 헬퍼의 provider 검색 인라인 중복(3라운드 연속 WARNING)이 이번 커밋에서
  실제로 해소됐다 — `at()` 선언을 `ChannelListenerRegistry` 교체보다 앞으로 옮겨 세
  provider 교체가 모두 같은 형태를 쓴다(`triggers.service.spec.ts:3757-3773`).
- `schedules.service.spec.ts` 에 추가된 대조군 테스트("name 만 바꾸면 patch 에 name 만
  실린다")는 기존 단언이 in-memory 재부착만 보고 있어 `update`→`save` 뮤턴트에도
  GREEN 이었다는 사실이 실제로 드러난 뒤 추가된 것으로, 커밋 메시지의 뮤테이션 실측과
  코드가 일치한다.
- CHANGELOG 의 자기모순("`save(entity)` 자리가 한 곳도 남지 않는다" vs "저장 동사는
  그대로 둔다")이 "컬럼만 고치려던 자리가 **의도치 않게** 엔티티 전체를 저장하던 경로는
  한 곳도 남지 않는다"로 정정되어 두 문장이 더 이상 충돌하지 않는다.

## 요약

이번 라운드의 실질 변경(`bcba1dc5d`)은 직전 라운드가 지적한 4개 Critical(하위 키 미보존,
관측되지 않는 방어 게이트 둘, CHANGELOG 자기모순)을 코드·테스트·문서 세 층 모두에서
실제로 닫았고, `mergeIntoFreshSubKey` 로의 추출은 "산문 대신 시그니처로 막는다"는 저장소
규율을 정확히 지킨 좋은 리팩터다. 다만 그 삽입 과정에서 `throwTriggerNotFound()` 를
설명하던 JSDoc 이 다시 orphan 이 됐다(WARNING) — 이 PR 이 같은 결함 클래스를 `hooks.service.ts`
자리에서 이미 한 번 만들고 고친 적이 있어(`bf2becd0c`), 이번이 이 PR 안에서 사실상 두 번째
재발이다. 기능 회귀는 아니고 국소 수정으로 바로 해소되지만, "새 헬퍼를 기존 JSDoc+함수
사이에 끼워 넣는" 편집 습관이 반복되고 있다는 신호로 다음 편집 때 참고할 가치가 있다.
그 외에는 `@param` 누락 1건과 3라운드째 미병합인 이중 JSDoc 1건 등 사소한 INFO 뿐이며,
차단 사유는 없다.

## 위험도

LOW
