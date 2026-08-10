# 유지보수성(Maintainability) Review

### 발견사항

- **[WARNING]** `started` 날짜 검증 로직이 두 파일에서 서로 다른 안전 수준으로 중복 구현됨 — 한쪽은 이미 고친 결함이 다른 쪽엔 남아있다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:27-34` (`startedDate`) vs `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:196-225` (`rawScalar`/`isIsoDate`)
  - 상세: `plan-scan.ts` 의 `isIsoDate`(212-225줄) 는 "js-yaml 이 잘못된 날짜(`2026-13-32`, `2026-02-30` 등)를 **조용히 굴려 유효한 `Date`** 로 만든다"는 것을 실측하고, 이를 막기 위해 **원문 텍스트**(`rawScalar` 로 frontmatter block 에서 직접 추출)와 파싱 결과를 라운드트립 비교한다(206-210줄 주석에 전후 사례까지 명시). 반면 `spec-plan-completion.test.ts` 의 `startedDate` 는 이미 파싱된 `data.started` 를 받아 `s instanceof Date` 이면 검증 없이 그대로 반환한다(29줄). `started:` 값이 따옴표 없는 잘못된 날짜(예: `2026-13-32`)로 적히면 js-yaml 이 그 시점에 이미 롤오버한 `Date` 객체가 `data.started` 에 들어있고, `startedDate`/`isGateCEnforced` 는 그 뒤틀린 날짜를 그대로 컷오프 비교에 사용한다 — `isIsoDate` 가 명시적으로 방어한 바로 그 클래스의 문제가 재발한다. 문자열 경로의 정규식(30줄, `/^\d{4}-\d{2}-\d{2}$/`)도 `plan-scan.ts` 209줄 주석이 "자리수만 보는 것도 부족하다"며 명시적으로 불충분하다고 지적한 옛 검사와 동일한 패턴이다.
  - 제안: `startedDate`/`isGateCEnforced` 도 raw frontmatter block 을 받아 `isIsoDate`(또는 그 등가 로직)를 재사용하도록 바꾸거나, 최소한 두 검증이 왜 다른 안전 수준을 가져도 되는지(예: Gate C 컷오프 판정은 "대략적인 날짜"면 충분하다는 근거) 주석으로 명시할 것.

- **[WARNING]** `hasValidSpecImpact` 순수 predicate 가 실제 강제 경로에서 쓰이지 않고, 동일 로직이 per-plan `it()` 블록에 별도로 재구현됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:43-57` (`hasValidSpecImpact`) vs `118-146` (per-plan `it()` 3개)
  - 상세: `hasValidSpecImpact` 는 "string→NONE_VALUES 매칭" + "array→length>0 && every exists" 조합을 한 곳에 담고 있지만, 실제 강제 로직(118-146줄의 세 `it()`)은 이 함수를 호출하지 않고 같은 조건을 각각 인라인으로 다시 쓴다(문자열 존재 검사는 `NONE_VALUES.has(...)` 재호출, 배열 존재 검사는 `hasValidSpecImpact` 가 아니라 별도 함수인 `danglingSpecImpact` 를 사용). 그 결과 `hasValidSpecImpact` 는 168-176줄의 합성 테스트에서만 소비되는 사실상 미사용 코드이고, 두 로직 표현(“exists” 판정을 `specExists` 콜백으로 하는 버전과 `fs.existsSync` 로 직접 하는 `danglingSpecImpact` 버전)이 독립적으로 유지된다. 이 파일 자체가 62-65줄 주석에서 "동일 판정이 두 군데 있으면 한쪽만 고쳤을 때 조용히 갈린다"는 것을 정확히 경계하고 있는데, 그 경계 대상과 같은 모양의 중복이 이 함수 쌍에 남아 있다.
  - 제안: per-plan `it()` 들이 `hasValidSpecImpact`(또는 `danglingSpecImpact` 를 기반으로 파생시킨 동일 함수)를 직접 호출하도록 리팩터링하거나, `hasValidSpecImpact` 를 제거하고 `danglingSpecImpact` 하나로 일원화.

- **[INFO]** 파일 상단 스펙 주석이 실제 허용 어휘(`NONE_VALUES`)보다 좁게 문서화됨
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:9-16` (헤더 주석) vs `25` (`NONE_VALUES`)
  - 상세: 헤더 주석은 `spec_impact: none` 만 예시로 들지만 실제 `NONE_VALUES` Set 은 `"none" | "없음" | "n/a" | "na"` 네 값을 인정한다. `n/a`/`na` 는 168-176줄 합성 테스트에도 커버되지 않는다. 이 코드베이스가 어휘 확장에 신중해야 한다는 원칙을 `plan-scan.ts` 의 `TERMINAL_PLAN_STATUSES` 주석(어휘를 늘리는 것은 판단이 필요한 일)에서 명시하는 만큼, 여기서도 문서와 실제 허용 값이 어긋나 있는 점은 향후 혼란의 소지가 있다.
  - 제안: 헤더 주석에 `n/a`/`na` 도 명시하거나, 합성 테스트에 해당 값 커버리지를 추가.

- **[INFO]** 범용 유틸리티 `rawScalar` 가 정규식 특수문자 이스케이프 없이 `key` 를 `RegExp` 에 그대로 삽입
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:196-200`
  - 상세: `new RegExp(\`^[ \\t]*${key}:[ \\t]*(.*)$\`, "m")` 은 현재 `"started"` 리터럴로만 호출되어 안전하지만, 함수 시그니처(`key: string`)는 범용을 암시한다. 향후 다른 호출부가 정규식 메타문자가 포함된 키를 넘기면 조용히 잘못된 패턴이 만들어질 수 있다.
  - 제안: 호출부가 리터럴만 쓴다는 걸 문서화하거나, `key` 를 이스케이프하는 방어 코드를 추가.

- **[INFO]** 유사한 YAML frontmatter 빌더 헬퍼가 같은 파일에 두 벌 존재
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:29-30` (`fm`) vs `207-208` (`frontmatter`)
  - 상세: 둘 다 `["---", ...필드..., "---", "", "# Doc", ""].join("\n")` 형태로 frontmatter 블록을 조립하는 동일한 패턴이나, 시그니처가 달라(전자는 `status?` 하나, 후자는 필드 map) 별도로 정의돼 있다. 파일 전반이 "동일 로직이 두 곳에 있으면 갈린다"는 교훈을 강조하는 것과 대비된다.
  - 제안: `fm`을 `frontmatter({status})` 로 위임하거나 하나의 빌더로 통합.

- **[INFO]** `mkdtempSync` + `afterAll(rmSync)` 임시 디렉터리 보일러플레이트가 한 파일 안에서 3회 반복
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:35-36, 71-72` / `190-197` / `336-337, 346-348`
  - 상세: 동일한 "임시 루트 생성 → 테스트 → 정리" 패턴이 서로 다른 `describe` 블록에서 매번 손으로 반복된다. 로직 자체는 단순해 위험도는 낮지만, 헬퍼로 뽑으면 각 블록의 의도(“이 describe 가 무엇을 세팅하는지”)가 더 선명해진다.
  - 제안: `withTempRepoRoot(setup: (root: string) => void)` 류의 공용 헬퍼 추출 (선택적, 테스트 전용 코드라 우선순위 낮음).

- **[INFO]** `spec-plan-completion.test.ts` 내 exported 함수들의 문서화 스타일이 일관되지 않음
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:38-41` (`isGateCEnforced`, JSDoc 없음), `43-57` (`hasValidSpecImpact`, JSDoc 없음) vs `59-70` (`danglingSpecImpact`, 상세 JSDoc)
  - 상세: 같은 파일 안에서 export 되는 세 판정 함수 중 하나만 JSDoc 블록을 갖고 나머지 둘은 상단 // 주석(36-37줄)이 뭉뚱그려 커버한다. 사소하지만 세 함수 모두 "게이트 로직"이라는 비슷한 무게를 가지므로 문서화 밀도를 맞추면 좋다.
  - 제안: `isGateCEnforced`/`hasValidSpecImpact` 에도 짧은 JSDoc 추가.

### 요약

전반적으로 코드는 잘 조직되어 있고, 주석이 "왜 이렇게 했는가"를 상세히 남겨 의도 파악이 쉬우며(특히 js-yaml 날짜 롤오버·gray-matter 캐시 우회 등 함정에 대한 실측 기반 설명), 순수 함수 추출을 통해 fixture 로 negative-path 를 검증하려는 태도가 일관적이다. 다만 이 PR 이 스스로 반복해서 경계하는 "같은 판정 로직이 두 곳에 있으면 조용히 갈린다"는 원칙이, 정작 `spec-plan-completion.test.ts` 의 날짜 검증(`startedDate`)과 `hasValidSpecImpact`/per-plan enforcement 사이에는 완전히 지켜지지 않아 향후 드리프트 위험이 남아 있다. 그 외에는 테스트 헬퍼 중복·문서화 밀도 불일치 등 경미한 항목뿐이다.

### 위험도
LOW
