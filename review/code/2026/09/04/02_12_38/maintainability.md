# 유지보수성(Maintainability) 리뷰

## 스코프 메모

리뷰 대상 22개 파일 중 실제 소스/문서 변경은 파일 1~9(`codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}`,
5개 repo-guard 파일, `plan/in-progress/entity-nullable-column-type-mismatch.md`)이고, 파일 10~22는
`review/code/2026/09/04/01_48_39/`·`01_49_18/` 하위의 **이전 리뷰 라운드 산출물**(JSON 메타·리뷰 리포트 md)이다.
이 저장소 관례상 `review/` 는 gitignore 대상이 아니라 커밋되는 산출물이므로 신규/이상 상태는 아니다. 코드가 아니라
생성된 리포트이므로 가독성·네이밍 등 코드 유지보수성 기준을 적용할 대상이 아니라고 판단해 이번 리뷰에서 제외했다.

파일 1~9의 핵심은 `repo-guards/__tests__/` 5곳에 흩어져 있던(거의 동일한) 디렉터리 재귀 walker를
`source-scan.ts` 의 `collectTsFiles` 하나로 통합한 것과, 그 위에 "넓혀진 nullable 필드를 겨눈 낡은
`.spec.ts` 캐스트" 를 잡는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한 것이다.

## 발견사항

- **[INFO]** `WIDENED_DECL` 상수명이 실제 매칭 범위보다 좁게 읽힌다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:141-142`
  - 상세: 정규식 자체는 `@Column`/`@ManyToOne`/`@OneToOne` 데코레이터가 붙은 **모든** 필드 선언에
    nullable 여부와 무관하게 매치한다. "widened"(즉 `| null` 로 넓혀진) 필터링은 별도로 그 다음 줄
    `widenedEntityFields` 함수 내부의 `if (tsType.includes('| null')) out.add(field);` (라인 150)에서
    이뤄진다. 상수 자체의 이름만 보면 이미 필터링된 결과를 매치한다고 오인하기 쉽다. 이 항목은 인접
    docstring(라인 134-139)이 "추가 데코레이터 1개 제한" 한계는 문서화했지만, 상수명이 매칭 범위보다
    좁게 읽히는 문제 자체는 아직 정정되지 않았다.
  - 제안: 상수명을 `COLUMN_OR_RELATION_DECL` 등 실제 매칭 범위를 반영하는 이름으로 바꾸거나, 최소한
    상수 선언 바로 위에 "이 정규식 자체는 nullable 여부를 가리지 않는다 — 필터링은 호출부에서" 한 줄을
    추가한다.

- **[INFO]** DRY 통합 이후에도 `collectTsFiles` 를 그대로 위임하는 1줄 래퍼 함수가 4개의 서로 다른
  이름으로 남아 있고, 한 곳은 래퍼 없이 직접 호출한다
  - 위치: `audit-action-binding-guard.ts:47-48` (`collectSourceFiles`), `masked-reject-callers-guard.ts:48,51`
    (`listSourceFiles`), `nullable-type-lie-cast-guard.ts:38-40` (`collectScanTargets`),
    `redis-fail-open-catalog-guard.ts:93-94` (`listProductionSources`), `engine-error-code-anchor-guard.ts:157`
    (래퍼 없이 `collectTsFiles` 직접 호출)
  - 상세: 이번 diff가 "walker 로직" 자체의 중복(재귀 `readdirSync`)은 `collectTsFiles` 하나로 성공적으로
    제거했다. 다만 각 가드 파일에 남은 위임 함수의 이름은 통일되지 않아, 지금은 전부 `collectTsFiles`
    의 동의어인데도 다음 독자는 네 함수가 서로 다른 로직을 가진다고 오인하기 쉽다(실제로 리팩터 전에는
    미묘하게 달랐고, `source-scan.ts` docstring 이 그 차이를 실측 표로 남겨 뒀다). 각 가드의 spec 이 이미
    그 이름을 참조하고 있어 이번 diff 범위에서 통일하지 않은 것은 합리적인 판단으로 보이며, 실질적 위험은
    낮다(각 함수가 한 줄이고 바로 위에 `collectTsFiles` 위임임을 명시).
  - 제안: 지금 당장 고칠 필요는 없으나, 다음에 이 파일들을 만질 기회가 있으면 래퍼 이름도 하나로
    통일하는 후속 정리를 고려할 만하다.

## 요약

전반적으로 유지보수성 관점에서 우수하다. `repo-guards/__tests__/` 5곳에 거의 동일하게 흩어져 있던
재귀 디렉터리 walker(각 10~20줄)를 `source-scan.ts` 의 `collectTsFiles` 하나로 합쳤고, 리팩터 전후
동작 불변(파일 목록 집합 동일)을 실측으로 검증한 근거를 plan 문서와 함수 docstring에 남겼다. 신규
공개 함수(`collectTsFiles`, `stripLiterals`, `widenedEntityFields`, `findStaleSpecCasts`)마다 "왜
필요한가"·"왜 오탐이 없는가"·"한계" 절을 갖춘 JSDoc이 있어 이 파일군이 이미 확립한 문서화 관례를
일관되게 따른다. 이전 리뷰 라운드에서 지적됐던 항목들(테스트 픽스처 헬퍼 `withFixture`/`withFiles`
중복, `stripLiterals` 전용 테스트 부재, `collectTsFiles` 정렬 분기 미검증)은 현재 코드에서 이미
해소돼 있는 것으로 확인했다 — `withFixture` 는 `withFiles` 의 얇은 래퍼로 재작성됐고, `stripLiterals`
는 전용 `describe` 블록 6개 테스트를 갖췄으며, `collectTsFiles` 의 정렬 분기는 `nested-sibling.ts`
픽스처로 DFS 순서와 갈리도록 고정돼 있다. 함수 길이·중첩 깊이·순환 복잡도는 모두 낮은 수준이고, 남은
흠은 `WIDENED_DECL` 상수명이 실제 매칭 범위보다 좁게 읽히는 점과, 통합된 `collectTsFiles` 위에 남은
4개의 이름이 다른 1줄 래퍼가 다음 독자에게 혼동을 줄 수 있다는 점 — 둘 다 INFO 수준으로, 코드를
바꾸지 않고 넘어가도 무방하다.

## 위험도

LOW
