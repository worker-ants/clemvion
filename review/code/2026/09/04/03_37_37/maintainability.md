# 유지보수성(Maintainability) 리뷰

## 검증 방법

diff 로 제시된 8개 TS 파일(`source-scan.ts`/`.spec.ts`, 4개 소비 가드, `nullable-type-lie-cast-guard.ts`/`.spec.ts`)을 저장소에서 직접 열어 현재 상태(HEAD)로 확인했다. 이 changeset 은 이미 리뷰 1R(`01_49_18`, 7명 forced)을 한 차례 거쳐 W1~W4 가 조치된 뒤의 상태이므로, 그 조치가 실제로 반영됐는지(문서 위치 W4, 픽스처 중복 제거 W3 등)와 새로 도입된 코드에 남은 문제를 함께 확인했다. 저장소 파일은 읽기만 했고 아무것도 쓰지 않았다(`git status --short` 로 확인 — 이 리뷰의 출력 디렉터리만 untracked).

## 발견사항

- **[INFO]** `collectTsFiles` 하나로 통합됐는데 소비 파일마다 감싸는 한 줄 래퍼 이름이 4가지로 갈린다
  - 위치: `codebase/backend/src/repo-guards/__tests__/audit-action-binding-guard.ts` (`collectSourceFiles`), `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts` (`listSourceFiles`), `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` (`collectScanTargets`), `codebase/backend/src/repo-guards/__tests__/redis-fail-open-catalog-guard.ts` (`listProductionSources`) — `engine-error-code-anchor-guard.ts` 는 래퍼 없이 `collectTsFiles` 를 직접 호출한다.
  - 상세: walker 로직 자체의 중복(`readdirSync` 재귀 5벌)은 이번 diff 로 완전히 제거됐지만, 각 가드에 남은 한 줄짜리 위임 함수는 지금 전부 동의어인데 이름만 다르다. 각 가드의 `.spec.ts` 가 이미 그 이름을 참조하므로 이번 diff 범위에서 통일하지 않은 것 자체는 합리적이나, 다음에 이 파일들을 보는 사람은 네 함수가 서로 다른 필터 로직을 가진다고 오인하기 쉽다(실제로 통합 전에는 미묘하게 달랐다 — `source-scan.ts` 의 "다섯 사본의 차이" 표가 그 사실을 기록해 뒀다).
  - 제안: 지금 당장 강제할 필요는 없다(각 파일 docstring 이 `collectTsFiles` 위임임을 이미 명시해 실질 위험은 낮다). 다음에 이 가드 파일들을 개별적으로 만질 기회가 있으면 래퍼 이름을 하나로 통일하는 후속 정리를 고려할 만하다.

- **[INFO]** `WIDENED_DECL` 정규식이 파일 안에서 가장 복잡한 단일 표현식이고, 판정 축(이름 매칭 → 동명 충돌 제거)까지 포함하면 함수 세 개(`widenedEntityFields` 본체 + `isNullableType` + 정규식 리터럴)에 걸쳐 있다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` — `WIDENED_DECL` 상수 선언과 `widenedEntityFields` 함수
  - 상세: 순수 코드 복잡도 관점에서만 보면 이 축은 이 diff 전체에서 가장 읽기 어려운 지점이다(정규식 하나로 `@Column`/`@ManyToOne`/`@OneToOne` + 옵션 데코레이터 1개 + 필드 선언을 한 번에 매치하고, 그 뒤 `isNullableType` 으로 표기 변형을 흡수하고, 다시 `nonNull` 집합으로 동명 충돌을 뺀다). 다만 이 정규식의 매치 범위·한계(추가 데코레이터 1개까지만, 위음성 방향)는 리뷰 1R 에서 이미 INFO 로 지적됐고 현재 docstring(158~166줄 부근, "한계 — 추가 데코레이터는 1개까지만 본다")에 반영돼 있다 — 코드 복잡도 자체는 남아 있지만 "왜/한계가 뭔지"는 판단 기록으로 고정돼 있어 유지보수 부담이 크게 완화된 상태다.
  - 제안: 코드 변경 불필요. 복잡도가 더 올라갈 계기(데코레이터 조합 확장 등)가 생기면 그때 정규식을 AST 판정으로 옮기는 것을 고려(이미 형제 가드 `masked-reject-callers-guard.ts` 가 같은 이유로 정규식→AST 전환 선례를 갖고 있다).

## 요약

이번 diff 는 `repo-guards/__tests__/` 5곳에 흩어져 있던 디렉터리 재귀 walker(`readdirSync` 기반)를 `source-scan.ts` 의 `collectTsFiles(root, { includeSpec })` 하나로 통합하고, 그 위에 "넓혀진(nullable 화된) 엔티티 필드를 겨눈 낡은 `.spec.ts` 캐스트"를 잡는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한다. 이미 1R(7명 forced) 리뷰를 거쳐 유지보수성 관점 WARNING(픽스처 헬퍼 중복 `withFiles`/`withFixture`)과 documentation 관점 WARNING(JSDoc 삽입 위치로 인한 `countCalls` orphan)이 조치됐음을 코드에서 직접 확인했다 — `withFixture` 는 이제 `withFiles` 의 얇은 래퍼이고, `stripLiterals` 의 JSDoc 은 `stripComments`/`countCalls` 사이에서 자기 자리로 옮겨져 있다. 새로 도입된 함수마다 "왜 필요한가/왜 오탐이 없는가/한계는 무엇인가" 절을 갖춘 JSDoc 을 일관되게 달아 이 파일들이 이미 확립한 "주석이 판단 기록" 관례를 유지하고, 함수 길이·중첩 깊이도 대체로 관리 가능한 수준이다(가장 복잡한 지점인 `WIDENED_DECL` 축도 한계가 문서화돼 있다). 남은 항목은 전부 경미한 INFO 두 건(4개 래퍼 함수의 이름 불일치, `WIDENED_DECL` 축의 잔존 복잡도)이며 코드를 바꾸지 않고 다음 기회로 미뤄도 무방하다.

## 위험도

LOW
