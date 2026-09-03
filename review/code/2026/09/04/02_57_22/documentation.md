# 문서화(Documentation) 리뷰

## 검증 방법

실제 소스 변경분(9개 파일: `source-scan.{ts,spec.ts}`, 5개 repo-guard, `nullable-type-lie-cast-guard.ts`/`.spec.ts`, plan 문서)을 `Read`로 저장소의 현재 실제 내용 전문을 확인했다. `git diff origin/main...HEAD --stat`로 diff 범위가 이 9개 파일뿐임을 재확인했고, 의심 지점은 `git blame`/`git show <commit>`로 어느 커밋이 어떤 줄을 넣었는지 추적했다. 저장소 트리에는 아무것도 쓰지 않았다 — `git status --short`는 이번 리뷰 세션 산출 디렉터리(`review/code/2026/09/04/02_57_22/`, untracked) 하나만 보여준다.

이번은 (이 리뷰 계보상) 4번째 라운드다. 1R~3R에서 나온 WARNING(정렬 커버리지 봉인 오판·`stripLiterals` 무테스트·픽스처 중복·JSDoc orphan·동명 필드 오탐·"실측 20건" 하드코딩)이 실제로 코드에 반영됐는지 재확인했고, 대부분 확인됐다. 다만 **직전 라운드(3R)의 수정 자체가 새 결함을 남겼다** — 아래 WARNING 참조.

## 발견사항

- **[WARNING]** 3R에서 제거했다고 한 "검증 안 되는 하드코딩 개수(20건)"가 실은 같은 커밋 묶음 안 **다른 두 자리에 그대로 남아 있고, 그중 하나는 이제 존재하지 않는 곳을 가리키는 거짓 참조가 됐다**
  - 위치:
    - `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:220` (`findStaleSpecCasts` docstring, "## 오탐 없음은 {@link widenedEntityFields} 가 이름 충돌을 뺀 덕이다" 절)
    - `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:312` (`describe('넓혀진 필드를 겨눈 낡은 spec 캐스트', …)` 내부, "[대조군] 다른 엔티티에서 non-null 인 동명 필드는 판정에서 뺀다" 테스트 바로 위 docstring, "## 이름 충돌 — 이 가드가 실제로 밟았던 오탐" 절)
  - 상세: 3R의 W1 수정(커밋 `df552e4c8`, "리뷰 3R — 같은 파일 40줄 위에 '숫자를 적지 마라' 가 적혀 있었다")은 `widenedEntityFields` 자신의 docstring에서 "저장소 실측 **20건**"이라는 검증 안 되는 개수를 뺐다 — 같은 파일 `collectScanTargets` docstring이 이미 "종전 이 자리에 '실측 12건'이라고 개수를 박아 뒀다가 곧바로 낡았다 … 검증되지 않는 숫자는 적지 않는다"고 적어 둔 규칙을 어긴 것이었기 때문이다. 그런데 이 "20건"은 **바로 앞 커밋(`79bce075e`, 2R)이 동시에 심어 놓은 다른 두 자리**에는 손대지 않았다:
    1. `guard.ts:220`은 "충돌을 안 뺐을 때 **오탐이 재현된다** — 그 근거와 실측 20건은 **그쪽 docstring**에 있다"라고 적는다. "그쪽"은 `widenedEntityFields`의 docstring을 가리키는데, 방금 그 문서에서 정확히 "20건"이 삭제됐다 — 즉 이 문장은 **더 이상 참이 아니다.** 이 문장을 근거로 `widenedEntityFields`의 docstring을 열어 "20건"을 찾으려는 다음 사람은 아무것도 못 찾는다. 검증 안 된 숫자였던 것이 이제는 **가리키는 대상 자체가 사라진 거짓 포인터**로 격이 나빠졌다.
    2. `nullable-type-lie-cast.spec.ts:312`는 "저장소에 그런 충돌이 **20건** 실재한다"라고, 3R의 커밋 메시지가 "이 세션에서 내가 쓴 규칙을 어긴 세 번째"라고 자인한 바로 그 패턴(날짜 표기 없음·재현 명령 없음·이 숫자를 고정하는 테스트 없음)을 **그대로** 담고 있다. `git blame`으로 확인하면 이 줄도 `79bce075e`(2R)에서 들어와 `df552e4c8`(3R)에서 건드려지지 않았다.

    세 자리(구 `widenedEntityFields` docstring·`findStaleSpecCasts` docstring·spec.ts 테스트 docstring) 모두 같은 PR, 같은 커밋(`79bce075e`)에서 함께 심어졌던 값인데, 3R의 fix가 그중 리뷰가 직접 지목한 한 자리만 고치고 나머지 둘을 놓쳤다. 엔티티에 nullable 필드가 하나 늘거나 줄면(이 저장소는 지금도 nullable 배치 리팩터를 계속하고 있다) 이 숫자는 조용히 틀려지고, `guard.ts:220`은 이미 지금 시점에 틀려 있다.
  - 제안: `widenedEntityFields`에 적용한 처방(날짜 없는 확정 개수 대신 낡지 않는 예시 + 재현 방법)을 나머지 두 자리에도 그대로 적용한다. 특히 `guard.ts:220`은 개수 문제와 별개로 **가리키는 대상이 실재하지 않는 참조 자체를 고쳐야** 한다("그 근거는 그쪽 docstring 에 있다" 정도로 개수 언급을 빼거나, 근거를 이 자리에 직접 재서술). `spec.ts:312`는 테스트 목적상 "그런 충돌이 실재한다"는 사실만 전달하면 충분하므로 개수를 빼도 대조군 테스트 자체의 의미는 그대로 유지된다.

## 확인된 정상 항목 (재검증)

- `withFixture`/`withFiles` 통합(1R W3), `stripLiterals` 전용 7-테스트(1R W2), `sort()` 판별력을 위한 `nested-sibling.ts` 픽스처(1R W1), `countCalls`/`stripLiterals` JSDoc이 각자 제 위치에 있음(1R W4), 동명 필드 충돌을 제외하는 `widenedEntityFields`의 `nonNull` 로직과 대조군 2건(2R W1), `isNullableType()`으로 분리된 순서/공백 무관 판정과 `it.each` 캐너리(3R INFO#4) — 전부 코드를 직접 열어 실제로 반영돼 있음을 확인했다.
- `masked-reject-callers-guard.ts`의 `listSourceFiles` 바로 위 한 줄 주석(`` `src/` 하위 `.ts` 전수 (node_modules·dist 제외). ``)은 3R에서 이미 지적된 대로 여전히 `.d.ts` 항상-제외라는 새 동작을 반영하지 않는다. 3R이 이를 INFO로 "급하지 않음"이라 명시적으로 유예했고 이번 라운드에도 코드 변경이 없어 판단을 유지한다(재조치 요구 아님, 기록만).
- README·API 문서·CHANGELOG: 이 diff는 내부 테스트 인프라(`repo-guards` walker 통합 + 신규 정적 가드)와 plan 문서 갱신뿐이다. 저장소 `CHANGELOG.md`는 API/DTO/스키마 계약이 실제로 바뀐 변경만 기록하는 관례이고 이번 diff는 그런 외부 계약 변경이 없다 — 이전 세 라운드의 판단과 동일하게 갱신 대상이 아니다.
- 신규 환경변수·배포 설정 없음(`CollectTsFilesOptions.includeSpec`은 소스 레벨 옵션).
- `plan/in-progress/entity-nullable-column-type-mismatch.md`의 "판정 대상 135 → **115**"(동명 충돌 20건 차감) 서술은 같은 문단 안에서 산술이 자기 일관적이고(135-115=20), 이 plan 문서가 이미 확립한 "시점 기록"류 서술(`507/818/1261/818/818` 표 등)과 같은 장르라 `collectScanTargets`가 경고하는 "라이브 불변식처럼 읽히는 하드코딩"과는 성격이 다르다고 판단해 별도 결함으로 잡지 않았다.

## 요약

이번 diff는 신규 공개 함수마다 "왜 필요한가/한계/오탐 여부" 절을 갖춘 JSDoc을 일관되게 달고, 이전 세 라운드의 WARNING이 실제로 코드에 반영됐음을 재확인할 수 있었다는 점에서 문서화 규율이 여전히 높다. 다만 직전 라운드(3R)가 "검증 안 되는 개수를 하드코딩하지 말라"는, 같은 파일이 스스로 세 번째로 어겼다고 자인한 규칙을 고치면서, 같은 커밋 묶음이 함께 심어 놓았던 동일 값의 다른 두 자리(`findStaleSpecCasts` docstring의 교차 참조, `nullable-type-lie-cast.spec.ts`의 테스트 docstring)는 손대지 않았다. 그중 `guard.ts:220`은 이제 실제로 존재하지 않는 근거를 "그쪽 docstring 에 있다"고 가리키는 **거짓 참조**가 됐다는 점에서, 단순한 "낡을 수 있는 숫자" 문제보다 한 단계 더 나쁘다. 기능·게이트 통과 여부에는 영향이 없지만, 이 저장소가 이 PR 안에서만 세 차례 지적하고도 완전히 닫지 못한 동일 결함 클래스이므로 WARNING으로 남긴다.

## 위험도

LOW
