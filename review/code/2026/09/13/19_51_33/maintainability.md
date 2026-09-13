# 유지보수성(Maintainability) 코드 리뷰

## 검토 범위

`error-code-emission-axis` 배치의 실질 코드 변경은 두 파일이다 — `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts`(발행 축 수집기 3종 + `GUIDE_NON_EMITTED_VOCABULARY`)와 `guide-identifier-existence.test.ts`(같은 축의 단언 다수). 이번 라운드는 직전 `/ai-review`(`review/code/2026/09/13/19_23_22`)의 maintainability WARNING(#7, 수집기 3종 근접 중복)이 `collectMatches` 공용 헬퍼로 실제로 해소됐는지 확인하고, 그 수정 커밋(`a397ccc55`)이 새로 들여온 코드를 별도로 검토했다. `CHANGELOG.md`·`PROJECT.md`·두 `logic.mdx`·`plan/**`·`review/**`는 문서/프로세스 산출물이라 코드 유지보수성 관점 대상에서 제외했다. 두 대상 파일은 전체를 `Read`로 직접 열어 확인했다(프롬프트의 diff 생략분 포함).

## 발견사항

- **[WARNING]** 직전 라운드에서 고친 것과 **같은 클래스의 근접 중복**이 한 계층 위(테스트 쪽)에서 재발했다 — "여전히 가이드에 인용된다(죽은 항목 방지)" 판정 로직이 두 목록에 그대로 복제됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:242-249`(`GUIDE_NON_EMITTED_VOCABULARY` 용), `:363-367`(`GUIDE_EXTERNAL_VOCABULARY` 용)
  - 상세: 두 `it()` 블록 모두 다음과 완전히 동일한 3줄짜리 몸체를 가진다 — `const cited = new Set(citations.map((c) => c.token)); const stale = <LIST>.filter((e) => !cited.has(e.token)); expect(stale.map((e) => e.token)).toEqual([]);`. 차이는 `<LIST>` 자리에 들어가는 배열 하나뿐이다. 같은 파일의 `guide-identifier-scan.ts`가 바로 이 배치에서 "정규식과 그룹 번호만 다르고 구조가 같은" 수집기 3종을 `collectMatches` 공용 헬퍼로 추출해 근접 중복을 없앴는데(WARNING#7 해소, `collectMatches` JSDoc 참조), 그 직후 같은 성격의 중복이 이 테스트 파일에 새로 생겼다. 이 저장소가 반복 기록해 온 "내 수정이 다음 결함이 된다"(같은 라운드에 새 결함을 만드는 패턴)의 재발이며, 목록이 세 번째로 늘어나면(예: 향후 또 다른 "거울상" 어휘 목록) 복제가 세 곳으로 늘어난다.
  - 제안: `const assertAllCited = (list: readonly { token: string }[]): void => { const cited = new Set(citations.map((c) => c.token)); const stale = list.filter((e) => !cited.has(e.token)); expect(stale.map((e) => e.token)).toEqual([]); };` 같은 지역 헬퍼로 추출해 두 `it()`가 `assertAllCited(GUIDE_NON_EMITTED_VOCABULARY)` / `assertAllCited(GUIDE_EXTERNAL_VOCABULARY)`만 호출하게 정리.

- **[INFO]** `where` 필드 검증 로직(정규식 파싱 + 트리 탐색 + 줄 포함 확인)이 이름 있는 헬퍼로 추출되지 않고 `it()` 블록 안에 30줄 그대로 인라인돼 있다 — 자매 파일과 관용구가 다르다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:202-231` (`it("\`where\` 의 \`파일:줄\` 이 **실제로 그 토큰을 담는다**...")`)
  - 상세: 같은 디렉터리의 `impl-anchor-existence.test.ts`는 유사한 "문자열에서 참조를 파싱해 실제 소스와 대조"하는 로직을 모듈 최상위의 이름 있는 함수(`extractRoutePath`, `trailingStaticSegment`)로 추출해 두었고, 각각을 독립적으로 단위 테스트한다(라인 29-45, 118행대). 이번에 추가된 `where` 검증은 정규식 매칭 → `walkTree` 로 파일 탐색 → 줄 번호 오프셋 조회 → 토큰 포함 여부 확인까지 같은 층위의 로직인데 `it()` 콜백 본문에 그대로 인라인돼 있어, 파싱 실패·다중 매치·토큰 불일치 세 분기 각각을 독립적으로 겨냥한 단위 테스트를 붙일 자리가 없다(현재는 실제 코퍼스 3건을 통과시키는 것으로만 간접 검증된다). 조치가 급한 결함은 아니고, 다음에 이 파일에 유사 검증이 하나 더 추가되면(예: env 변수 축에도 `where` 를 요구) 지금처럼 다시 인라인될 위험을 남긴다.
  - 제안: `parseWhereRef(where: string): { file: string; line: number } | null` 같은 이름 있는 함수로 분리하고, 그 함수만 겨냥하는 대조군 `it()`(파싱 실패·`hits.length !== 1`·토큰 불일치)을 자매 파일 패턴대로 추가.

- **[INFO]** 같은 `it()` 블록에서 `walkTree(root, ["codebase/backend/src"], ...)` 를 등록 항목 수만큼 루프 내부에서 반복 호출한다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:207-217` (`for (const entry of GUIDE_NON_EMITTED_VOCABULARY)` 루프 안의 `walkTree(...)` 호출)
  - 상세: `GUIDE_NON_EMITTED_VOCABULARY` 는 상한 5건(같은 파일 `NON_EMITTED_VOCABULARY_CAP`)으로 강제돼 있어 오늘은 실행 비용이 무시할 만하지만, 매 반복이 `codebase/backend/src` 전체를 basename 매칭으로 다시 훑는 구조 자체는 "루프 불변 연산을 루프 밖으로 뺀다"는 일반 원칙과 어긋난다. 목적(같은 파일 검색)이 등록 항목마다 달라질 수 있어(각 항목의 `where`가 다른 파일을 가리킴) 완전히 캐시하긴 어렵지만, 최소한 파일명별로 결과를 메모하면 같은 파일을 가리키는 항목이 늘어나도 중복 탐색을 피할 수 있다.
  - 제안: 급한 조치는 아님 — 상한이 있는 한 실질적 위험은 낮다. 참고로만 남긴다.

- **[INFO]** vacuity 하한값(`10`, `30`)이 자매 검사(`2`, `20`)와 다른데 그 차이의 근거가 주석에 없다 — 직전 라운드에도 지적됐고 이번 라운드에서도 그대로 남아 있음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts:197-198`(`entry.where...toBeGreaterThan(10)`, `entry.why...toBeGreaterThan(30)`) vs `:351-352`(`entry.system...toBeGreaterThan(2)`, `entry.why...toBeGreaterThan(20)`)
  - 상세: 이전 `/ai-review`(`19_23_22` maintainability INFO)가 이미 같은 지점을 지적했고 "실질적 위험(오독·오탐)은 낮다"고 판단해 조치를 요구하지 않았다. 이번 수정 라운드에서도 값은 그대로다(`why` 하한이 목록마다 20/30으로 다름). 새로 발견된 것은 아니며 교차 기록 목적으로만 다시 적는다.

- **확인 후 문제 없음**: 직전 라운드 WARNING#7(수집기 3종 근접 중복)은 `collectMatches(texts, rx, group)` 공용 헬퍼로 실제로 해소됐다 — `collectQuotedLiterals`/`collectMessagePrefixes`/`collectCatalogCodes` 세 함수 모두 이 헬퍼를 얇게 감쌀 뿐이고, 각자의 JSDoc(발행 위치·경계·탈출구 서사)은 그대로 남아 설명력을 잃지 않았다. `GUIDE_NON_EMITTED_VOCABULARY`/`GUIDE_EXTERNAL_VOCABULARY` 이름 유사성은 대조표(JSDoc)로 이미 방어돼 있어 재조치 불요. 새 함수들은 이름·중첩 깊이·길이 모두 기존 파일 관례를 따른다.

## 요약

직전 라운드가 지적한 실질적 중복(수집기 3종)은 `collectMatches` 추출로 깔끔히 해소됐다 — 그 자체는 모범적인 수정이다. 다만 같은 커밋이 그 수정 바로 옆(테스트 파일)에서 성격이 같은 근접 중복을 새로 만들었다("여전히 인용되는가" 판정이 두 목록에 그대로 복제됨) — 이 저장소가 이름 붙여 둔 "내 수정이 다음 결함이 된다" 패턴의 축소판이라 WARNING으로 분류한다. 나머지는 `where` 검증 로직이 자매 파일의 관용구(모듈 최상위 헬퍼 추출)를 따르지 않은 인라인 구현, 루프 내 반복 탐색, 이미 알려진 vacuity 상수 불일치로 모두 INFO 수준이며 조치 시급성은 낮다. 전체적으로 코드 범위가 좁고, 함수는 짧고 이름이 목적을 정확히 드러내며, 각 결정마다 근거·대조군·뮤테이션 검증이 이례적으로 충실하다.

## 위험도
LOW
