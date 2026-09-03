# 요구사항(Requirement) 리뷰 — `repo-guards` walker 통합 + 낡은 spec 캐스트 가드 (4R)

## 검증 방법

이 diff 는 같은 작업의 1R(`01_49_18`)·2R(`02_12_38`)·3R(`02_35_22`) 리뷰의 fix 를 모두 반영한
이후 상태다(3R fix 커밋 `df552e4c8` 은 이 리뷰 폴더와 같은 분 `02:57`에 커밋됨). 이전 라운드가
이미 검증을 마친 항목(정렬 뮤테이션 RED, 동명 충돌 제거 로직 뮤테이션 RED, `135→115` 수치
재현)은 재반복하지 않고, **3R 의 W1 fix 가 놓친 자리**를 중심으로 저장소를 직접 열어 확인했다
(저장소 트리에는 아무것도 쓰지 않음 — 확인용 스크립트는 `/private/tmp` 스크래치에 두고
`collectTsFiles`/`widenedEntityFields` 로직만 순수 함수로 복제해 실행, `git status --short` 로
확인해도 이 리뷰 폴더 자체 외 변경 없음):

- `npx jest --testPathPatterns="(source-scan|audit-action-binding|engine-error-code-anchor|masked-reject-callers|nullable-type-lie-cast|redis-fail-open-catalog)"` → **6 suites / 117 tests 전부 PASS**
- 8개 대상 파일에 `TODO|FIXME|HACK|XXX` grep → 0건
- `widenedEntityFields`/`collectTsFiles` 로직을 스크래치에서 재구현해 저장소 전수 실행 →
  raw 넓혀진 필드 **135**, 동명 충돌 **20**(`content`·`createdBy`·`userId`·`workflowId`·
  `triggerId`·`resourceType` 등), 충돌 제거 후 **115** — plan 문서·guard 코드 주석이 말하는
  숫자와 일치.
- `git log -p -- nullable-type-lie-cast-guard.ts` 로 3R fix 커밋(`df552e4c8`)의 diff 를 직접
  대조해, W1 fix 가 어느 자리를 고치고 어느 자리를 안 고쳤는지 확인.

## 발견사항

- **[WARNING]** 3R 에서 고친 "숫자를 적지 마라" 규칙이 같은 파일 안에서 다시 깨졌다 — 이번엔
  깨진 상호 참조까지 남겼다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:220`
    (`findStaleSpecCasts` JSDoc, `* 실측 20건은 그쪽 docstring 에 있다.` 줄)
  - 상세: 3R fix(`df552e4c8`)는 `widenedEntityFields` 의 JSDoc(216번째 줄
    `{@link widenedEntityFields}` 인용부 바로 위, 129~165행 구간)에서 "저장소 실측 **20건**"
    문구를 **의도적으로 제거**했다 — 커밋 메시지 자체가 "같은 파일 40줄 위에 '숫자를 적지
    마라' 가 적혀 있었다" 이고, 그 규칙은 `collectScanTargets` docstring(34행)이 "종전 이
    자리에 '실측 12건' 이라고 적어 뒀다가 곧바로 낡았다 … 검증되지 않는 숫자는 적지 않는다"
    라고 못박은 것이다. 그런데 **같은 커밋이 40행 아래(220행)의 다른 함수
    `findStaleSpecCasts` 의 JSDoc 은 손대지 않았고**, 거기엔 여전히 "그 근거와 **실측 20건은
    그쪽 docstring 에 있다**" 라고 적혀 있다. `git log -p` 로 확인한 결과 이 줄은
    `46f464583`(최초 feat 커밋)에서 쓰인 뒤 한 번도 수정되지 않았다. "그쪽 docstring" 이
    가리키는 자리(`widenedEntityFields`)엔 이제 그 숫자가 **없다** — 참조가 가리키는 대상이
    사라진 **깨진 상호 참조**이고, 동시에 이 줄 자체가 "20건" 이라는 하드코딩된 숫자를 여전히
    담고 있어 3R 이 고치려던 바로 그 문제(검증되지 않는/낡는 숫자)를 재도입한 셈이다.
    (숫자 자체는 지금은 정확하다 — 스크래치에서 재현해 충돌 20건을 직접 확인했다. 문제는
    "그쪽에 있다" 는 위치 주장이 거짓이라는 점이다.) 기능에는 영향이 없다(순수 JSDoc) — 다만
    이 파일 전체가 "판단 기록"으로 정교한 rationale 을 유지해 온 성격상, 3R 리뷰가 이미
    "이 세션에서 세 번째로 어긴 규칙" 이라고 부른 바로 그 패턴이 **네 번째**로, 그것도 3R 이
    고친 자리에서 40줄 떨어진 곳에 남아 있다는 점에서 다음 사람(또는 다음 리뷰 라운드)이
    또 발견할 항목이다.
  - 제안: 220행을 "그 근거는 위 {@link widenedEntityFields} docstring 참조" 로 바꾸고
    "실측 20건" 부분은 삭제(또는 위 예시처럼 이름 나열로 대체). 재발 방지를 원하면 두 자리를
    한 번에 고치는 대신 한쪽이 다른 쪽을 `{@link}` 로만 가리키게 해서 숫자가 한 곳에만
    존재하도록 만드는 편이 다음 라운드 재발을 막는다.

- **[INFO]** 같은 "20건" 문구가 소비 spec 에도 사실 진술로 남아 있다 — 사실은 맞지만
  guard.ts 가 스스로 선언한 "개수는 적지 않는다" 규칙과 다시 어긋난다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:312`
    (`## 이름 충돌 — 이 가드가 실제로 밟았던 오탐` 절, `* **20건** 실재한다` 줄)
  - 상세: 스크래치 재현으로 현재도 정확히 20건임을 확인했으나, guard.ts 가 명시적으로 채택한
    규칙("검증되지 않는 숫자는 적지 않는다")의 정신은 "지금 맞다" 가 아니라 "나중에 낡는다"
    는 것이다. 다음 배치에서 엔티티 필드가 추가/제거되면 이 숫자도 조용히 낡는다.
  - 제안: 필수 조치 아님(WARNING 대상인 220행과 달리 위치 주장 자체는 거짓이 아니다). 다음에
    이 구간을 만질 기회가 있으면 개수를 빼고 예시 필드명만 남기는 편이 guard.ts 의 자기 규칙과
    일관된다.

- **[정보성 확인, 결함 아님]** `isNullableType` 의 경계 동작을 직접 확인 — `split('|')` 후
  trim 비교이므로 `NullableThing`·`nullish` 같은 부분 문자열은 오매치하지 않는다(정확히
  `'null'` 전체 일치만 반환). 빈 문자열·공백만 있는 파이프 조각(`'T |  | null'` 류 기형
  타입)도 `.trim()` 이 `''` 로 남아 `'null'` 과 매치되지 않아 안전하다. 저장소에 그런 기형
  타입은 없다(엔티티 41개 전수 확인). 요구사항 위반 없음.

## 요약

3R 까지의 라운드가 처리한 항목(정렬 회귀 커버리지, `stripLiterals` 테스트, 헬퍼 중복, JSDoc
orphan, 동명 충돌 오탐, 표기 형태 위음성)은 이번 라운드에서 재확인한 결과 모두 코드에 실제로
반영돼 있고 뮤테이션·수치 재현으로 재검증했다. 이번 라운드의 유일한 새 발견은 3R 이 고친 규칙
위반과 **같은 클래스**지만 **다른 자리**에서 재발한 것 — `findStaleSpecCasts` JSDoc(220행)이
"실측 20건은 그쪽 docstring 에 있다" 고 가리키는데, 정작 그 "그쪽"(`widenedEntityFields`
docstring)에서는 같은 3R 커밋이 그 숫자를 이미 지워 놓아 참조가 깨졌다. 기능 동작에는 영향이
없는 순수 문서 결함이라 CRITICAL 은 아니지만, 이 파일이 "판단 기록"을 정교하게 유지해 온
성격과 3R 이 같은 문제를 "이 세션에서 세 번째 위반" 이라 부르며 강하게 정정한 이력을 감안하면
WARNING 으로 표시해 이번 라운드 안에서 함께 정리할 가치가 있다. 그 외 엣지 케이스(`split('|')`
빈 조각, 부분 문자열 오매치)는 직접 확인한 결과 안전하고, TODO/FIXME 류 미완성 표식은 없으며,
반환값은 모든 경로에서 빈 배열/Set 을 포함해 적절하다. 이 변경 영역을 직접 규정하는 `spec/`
문서는 여전히 없다(내부 test-tooling — 3R 과 동일 결론, 회색지대·결함 아님).

## 위험도

LOW
