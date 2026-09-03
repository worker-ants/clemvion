# 테스트(Testing) 리뷰

이 diff 는 4라운드째 리뷰다. 1R~3R 에서 나온 testing 관점 WARNING(정렬 커버리지 오판·
`stripLiterals` 무테스트·동명 필드 오탐·`isNullableType` 위음성)은 전부 코드·테스트 양쪽에
반영됐고, 직접 실행해 재확인했다(`source-scan.spec.ts`+`nullable-type-lie-cast.spec.ts` **60
passed**, `repo-guards/__tests__` 전체 **8 suites / 142 passed** — 3R RESOLUTION 이 적은 수치와
일치). 저장소 트리에는 아무것도 쓰지 않았다(`git status --short` 확인, 이 세션 산출물
`review/code/2026/09/04/02_57_22/` 외 변경 없음).

이번 라운드는 직전 커밋(`df552e4c8`, "리뷰 3R — 같은 파일 40줄 위에 '숫자를 적지 마라' 가
적혀 있었다")이 손댄 두 파일을 집중적으로 재검증했다.

## 발견사항

- **[WARNING]** 3R 이 지운 하드코딩 "실측 20건" 이 **같은 파일 안의 다른 두 자리**엔 그대로
  남아, 그중 하나는 이제 존재하지 않는 것을 가리키는 깨진 상호 참조가 됐다
  - 위치:
    - `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:218`
      (`findStaleSpecCasts` docstring — `그 근거와 실측 20건은 그쪽 docstring 에 있다.`)
    - `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:312`
      (`넓혀진 필드를 겨눈 낡은 spec 캐스트` describe 블록 docstring —
      `저장소에 그런 충돌이 **20건** 실재한다(...)`)
  - 상세: `df552e4c8` 은 `widenedEntityFields` 바로 위 docstring(129~165줄)에서만 "저장소
    실측 **20건**" 을 지우고 "개수는 적지 않는다 — 같은 이유로 `collectScanTargets` 가 이미
    정한 규칙이다(종전 '실측 12건' 이 같은 PR 안에서 곧바로 낡았다)" 로 바꿨다. 그런데 **같은
    파일의 아래쪽** `findStaleSpecCasts` docstring(218줄)은 여전히 "그 근거와 실측 20건은
    **그쪽 docstring 에 있다**" 라고 적혀 있다 — 그런데 그쪽(=`widenedEntityFields`
    docstring)엔 이제 그 숫자가 없다. 즉 이 문장은 지금 **존재하지 않는 것을 가리키는
    상호 참조**다. 그리고 형제 파일 `.spec.ts` 의 `describe('넓혀진 필드를 겨눈 낡은 spec
    캐스트', ...)` 바로 위 docstring 도 여전히 "**20건** 실재한다" 를 그대로 갖고 있다 —
    이쪽은 날짜 헤딩도, 재현 명령(`collectScanTargets` 가 준 `grep -rn 'null as unknown as'
    --include='*.spec.ts'` 같은)도 없어 3R 이 새로 정한 관례(개수 대신 낡지 않는 예시+세는
    방법을 남긴다)를 따르지 않는다.

    이건 이 세션이 이미 세 번 반복한 실패 모드의 네 번째 사례다 — "정정은 그 문장에
    국한하되, 그 문장을 전제로 삼은 인접 서술이 거짓이 되면 그것도 함께 고치는 것까지가
    조치다." `widenedEntityFields` 의 개수를 지우면서 그 개수를 **참조하는** 두 자리를 안
    고쳤다. 기능적 회귀는 아니다(테스트는 전부 GREEN, 판정 로직 자체는 안 바뀌었다) — 그러나
    테스트 파일의 존재-이유 서술(왜 이 대조군 테스트가 필요한지 설명하는 docstring)이 자기
    모순을 담고 있으면, 다음에 이 가드를 만지는 사람이 "20건" 을 검증된 사실로 믿고 pinning
    단언을 추가하거나(그러면 3R 이 막으려던 바로 그 실수가 재발한다), 반대로 `widenedEntityFields`
    docstring 을 다시 열었을 때 "20건이 어디 있지" 하고 헛돌게 된다.
  - 제안: `nullable-type-lie-cast-guard.ts:218` 의 "그 근거와 실측 20건은 그쪽 docstring 에
    있다" 를 "그 근거는 그쪽 docstring 에 있다"(개수 언급 삭제)로 고친다.
    `nullable-type-lie-cast.spec.ts:307-312` 의 "**20건** 실재한다" 도 `collectScanTargets`/
    `widenedEntityFields` 가 이미 택한 관례(개수 삭제 + 낡지 않는 예시 유지, 필요하면 날짜
    헤딩 + 재현 명령)로 맞춘다. 세 자리(원래 자리 + 이 두 자리)를 한 번에 grep
    (`grep -rn '20건' codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast*`)으로
    잡아 재발을 막을 것.

## 회귀 확인

- `npx jest src/common/__test-utils__/source-scan.spec.ts src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` → **60 passed**(3R 이후 `isNullableType` `it.each` 3건 포함, 회귀 없음).
- `npx jest src/repo-guards` (가드 8스위트) → **142 passed** — 3R RESOLUTION 수치와 일치.
- `source-scan.ts` 의 모든 export(`stripComments`·`stripLiterals`·`countCalls`·
  `countRawUpdateReturning`/`hasRawUpdateReturning`·`countNullAsUnknownAsCasts`/
  `hasNullAsUnknownAsCast`·`collectTsFiles`)에 전용 양성/음성 테스트가 있다 — 1R W2 가
  잡았던 "export 했는데 무테스트" 비대칭은 재발하지 않았다.
- 3R 에서 `isNullableType` 을 분리하며 추가한 `it.each`(공백 없음·순서 반대·표준 표기)는
  private 함수라 `widenedEntityFields` 를 통한 간접 테스트만 가능한데, 세 표기 모두 **참**
  방향만 캐너리로 고정했다. **거짓** 방향(`notWidened: string;` 처럼 `null` 이 전혀 없는
  타입)은 같은 파일의 다른 대조군 테스트(`대조군` describe, `widenedEntityFields` 가
  `notWidened` 를 결과에서 빼는 것을 단언)로 이미 간접 커버돼 있어 공백은 아니다.

## 요약

핵심 테스트 인프라(`collectTsFiles` 통합·`stripLiterals`·`widenedEntityFields`/
`findStaleSpecCasts`·`isNullableType`)는 4라운드에 걸쳐 실질적 커버리지 갭이 거의 모두
닫혔고, 이번 라운드에서 직접 재실행해도 202건(60+142) 전부 GREEN 이다. 다만 직전 커밋이
"검증되지 않는 숫자는 적지 않는다" 는 규칙을 **같은 파일의 다른 두 자리**엔 적용하지 않아
— 그중 하나는 이제 실존하지 않는 것을 가리키는 상호 참조가 됐다 — 이 PR 자신이 세 번째로
자책했던 실수의 네 번째 재발이다. 기능 회귀는 없으나(테스트는 전부 통과), 테스트 파일의
근거 서술이 자기모순을 담고 있으면 다음 사람이 검증 안 된 숫자를 신뢰하거나 되짚어 찾는
비용을 치른다. WARNING 하나로 판정한다.

## 위험도

LOW
