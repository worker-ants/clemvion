# 변경 범위(Scope) 리뷰

## 발견사항

- **[INFO]** `collectTsFiles` 통합이 "순수 추출"을 살짝 넘어 동작을 넓힌다 — `masked-reject-callers-guard.ts` 의 `listSourceFiles`
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:48` (구현부, 게이트 47~52)
  - 상세: 원래 이 파일의 walker(diff 삭제분)는 `.ts` 로 끝나기만 하면 담았다 — `.d.ts` 배제 로직도, `sort()` 도 없었다. 새 `collectTsFiles(rootDir, { includeSpec: true })` 로 교체하면서 `.d.ts` 배제와 정렬이 **덤으로** 따라붙는다. 하위 호출부(`findUnexpectedCallers`)가 결과를 다시 `.sort()` 하므로 정렬 차이는 무해하고, `.d.ts` 배제도 plan 문서가 "src 하위 `.d.ts` 0개" 라고 실측·기재해 실질 영향이 없다고 밝혀 놓았다. 다만 이 변경이 "5개 walker 를 그대로 대체"가 아니라 **가장 느슨했던 walker 하나에는 필터를 새로 얹는** 것이라는 사실은 diff 만 보면 드러나지 않고, plan 문서의 507/818/1261/818/818 대조표가 정확히 이 walker 를 가리키는지도 diff 만으로는 확인이 안 된다. scope 위반은 아니다 — 저자가 이 확장을 의도적으로 결정하고 근거를 남겼다(source-scan.ts 의 "다섯 사본의 차이" 표, plan 문서의 동일 표). 다만 "walker 추출은 동작 불변" 이라는 절대적 읽기를 할 경우 오해할 수 있는 지점이라 기록해 둔다.
  - 제안: 조치 불필요. 정확성 관점(다른 리뷰어)에서 507/818/1261/818/818 대조표가 `listSourceFiles` (masked-reject-callers) 케이스까지 포함하는지 재확인해 볼 가치는 있음.

- **[INFO]** `stripComments` 가 module-private → `export` 로 공개 API 표면이 넓어짐
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:53` (구현부)
  - 상세: `findStaleSpecCasts` (신규 스테일-캐스트 가드)가 주석 스트리핑을 재사용해야 해서 export 로 바꿨다. diff 자체에 "export 인 이유" 문단을 덧붙여 근거를 명시하고 있어 임의 확장이 아니다. 두 번째 follow-up 항목(넓혀진 필드를 겨눈 낡은 spec 캐스트 가드)을 완성하는 데 직접 필요한 변경이라 범위 안이다.
  - 제안: 없음(정보성 기록).

## 요약

이 diff 는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 명시적으로 등재돼 있던 두 개의 후속(follow-up) 항목 — ① `repo-guards/__tests__/` 5개 가드에 중복돼 있던 디렉터리 walker(`readdirSync` 기반)를 `common/__test-utils__/source-scan.ts` 의 `collectTsFiles` 로 추출·통합, ② `.spec.ts` 안에 남아 있는 "넓혀진(nullable 화된) 엔티티 필드를 겨눈 낡은 `null as unknown as` 캐스트"를 잡는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`) 추가 — 를 그대로 수행한다. 9개 파일이 바뀌었지만 전부 이 두 항목에 직접 결속돼 있다: 코어 유틸(`source-scan.ts`/`.spec.ts`), 그 유틸을 소비하도록 고쳐진 4개 가드(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·`masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`), 신규 가드가 붙은 파일(`nullable-type-lie-cast-guard.ts`·`.spec.ts`), 그리고 완료 체크박스·근거를 기록하는 plan 문서. import 정리(불필요해진 `fs` 제거·필요해진 `collectTsFiles` 추가)도 전부 실제 사용 여부와 일치하고, 무관한 포맷팅·주석·설정 변경은 발견되지 않았다. 유일하게 기록할 만한 지점은 통합된 `collectTsFiles` 가 walker 하나(masked-reject-callers)에는 `.d.ts` 배제·정렬을 부수적으로 새로 적용한다는 점인데, 이는 저자가 의도적으로 결정하고 근거(축별 실측표)를 남긴 변경이라 scope 위반으로 보지 않는다.

## 위험도

NONE
