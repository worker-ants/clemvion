# 아키텍처(Architecture) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드 (8R)

## 검증 방법

이 changeset(`origin/main..HEAD`, 9커밋)은 이미 7라운드(`01_48_39`~`03_37_37`)의 아키텍처 리뷰를
거쳤다. `source-scan.ts`·`nullable-type-lie-cast-guard.ts`·4개 소비 가드(`audit-action-binding-guard.ts`·
`engine-error-code-anchor-guard.ts`·`masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`)를
`Read` 로 HEAD 기준 전체 내용을 직접 열어 확인했고, 직전 라운드(`03_37_37`) 이후의 유일한 코드
변경인 6R 커밋(`d44a8b637`)의 diff 를 `git show` 로 대조했다 — `masked-reject-callers.spec.ts` 에
배선 검증 테스트 2건 추가 + plan 문서 표 수정뿐이며, 구조에 영향을 주는 프로덕션/가드 코드
변경은 없다. `git log -- <file>` 로 `nullable-type-lie-cast-guard.ts` 가 이 브랜치에서 신규
도입된 파일임을 확인했다. 저장소 트리에는 아무것도 쓰지 않았다 — `git status --short` 결과 이
리뷰 산출 디렉터리(`review/code/2026/09/04/03_58_32/`) 외 변경 없음.

## 발견사항

- **[INFO]** `nullable-type-lie-cast-guard.ts` 한 파일이 층위가 다른 세 검사를 담고 있다 — 파일명이 가리키는 책임보다 넓다 (7R 이전부터 반복 관찰, 이번 라운드도 코드 변화 없음 — 재확인만)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` — `findCastOffenders`(프로덕션 이중 캐스트 카운트), `findUntypedNullableColumns`(TypeORM `design:type` 메타데이터 정합성), `findStaleSpecCasts`(`.spec.ts` 잔재 캐스트)
  - 상세: 세 함수 모두 "엔티티가 `| null` 로 넓혀진 데서 파생되는 결함" 이라는 공통 뿌리가 있어 응집도는 방어 가능하지만, 파일 자신의 docstring 이 "배치 1~3 에서 이 잔재를 세 번 손으로 찾았다" 고 이미 기록할 만큼 배치를 거듭할 때마다 검사 축이 누적되는 추세다. 6R 에서도 이 파일 구조 자체는 건드리지 않았다.
  - 제안: 지금 분리할 필요는 없다(246줄, 함수 8개 — 아직 관리 가능). 네 번째 관련 검사가 추가되는 시점에 "스캔 대상"(prod-source vs spec) 축으로 파일을 둘로 쪼개는 것을 고려.

- **[INFO]** 같은 guard 계열 안에서 정적 분석 방식이 갈린다 — `WIDENED_DECL`/`COLUMN_DECL` 은 정규식으로 TS 데코레이터·필드 선언을 파싱하는데, 형제 가드 3개(`masked-reject-callers-guard.ts`·`audit-action-binding-guard.ts`·`redis-fail-open-catalog-guard.ts`)는 전부 TS 컴파일러 AST 를 쓴다 (반복 관찰, 트레이드오프가 코드에 명시돼 있어 재확인만)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:168-169`(`WIDENED_DECL`) vs `masked-reject-callers-guard.ts:100-131`(`importsBaseFn`, `ts.createSourceFile` 기반)
  - 상세: `masked-reject-callers-guard.ts` 자신의 docstring(§"정규식을 버리고 AST 로 갔다")이 "표면을 하나씩 덧대다 네 번째 우회 형태가 나왔다" 는 실측을 근거로 정규식→AST 전환 이력을 명시적으로 남겨 뒀다. 같은 저장소·같은 디렉터리에 그 반면교사가 있는데도 신규 `WIDENED_DECL`(데코레이터·타입 표기를 다루는, 정규식으로는 상대적으로 복잡한 축)은 여전히 정규식이다. `nullable-type-lie-cast-guard.ts:160-166` docstring 이 "추가 데코레이터 1개까지만 본다" 는 한계와 "AST 비용(spec 443개 파싱)을 지금 치를 근거가 없다" 는 판단을 이미 명시하고 있어 **의도된 트레이드오프**이지만, 계열 전체의 일관성 관점에서는 같은 부류의 재발 위험(형태를 하나씩 놓치며 표면이 점진적으로 넓어짐)을 안고 있다는 점은 여전히 유효하다.
  - 제안: 조치 불필요. 데코레이터 2개 이상 스택 형태가 저장소에 실재하는 날(docstring 이 이미 재개 트리거로 명시) AST 전환 재고.

- **[INFO]** `source-scan.ts` 가 "세는 축의 단일 출처"에서 파일 I/O(`collectTsFiles`)까지 포함하는 4개 관심사(문자열 전처리·범용 카운팅·가드 전용 카운팅·디렉터리 순회)의 공유 커널로 계속 확장 중 (반복 관찰, 크기 변화 없음 — 재확인만)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:1-22`(모듈 헤더 "왜 공유하나"), 전체 export
  - 상세: 각 추가는 개별적으로 근거가 뚜렷하고(사본 5개 walker 제거, 가드 자기 spec 오탐 방지) 이 저장소가 반복 겪은 "한쪽만 하드닝" 결함 클래스에 대한 합리적 대응이지만, "세 번째 가드가 생기면 여기로 모은다" 는 확장 원칙이 계속 적용되면 이 파일이 사실상 `repo-guards` 전체의 God Module 이 될 잠재 위험이 있다. 현재(271줄, 함수 9개)는 문제 아님.
  - 제안: 다음 프리미티브 추가 시 "여러 가드가 공유하는 범용 축" 인지 "가드 한 개 전용 로직" 인지 구분해, 후자가 늘면 관심사별 파일 분리 고려.

- **[INFO]** 6R 에서 추가된 `masked-reject-callers.spec.ts` 의 옵션-배선 검증 테스트가 대상 함수(`listSourceFiles`)를 거치지 않고 `collectTsFiles` 를 직접 호출하는 자매 "저장소 전수" 테스트(`nullable-type-lie-cast.spec.ts:396-400`)와 같은 패턴을 반복하지 않는지 확인차 대조함 — 실제로는 정확히 `listSourceFiles(dir)` 를 호출해 그 함수를 통과한다는 점에서 배선 검증이라는 목적에 맞게 짜여 있다. 구조적 결함 아님, 조치 불요.
  - 위치: `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts:42-53`

## 긍정적으로 확인된 설계 (재확인)

- **DRY 회귀 없음 + Facade 마이그레이션**: `repo-guards/__tests__/` 5곳에 흩어져 있던 사실상 동일한 재귀 디렉터리 워커가 `collectTsFiles(root, { includeSpec })` 하나로 통합됐다. 4개 가드는 기존 공개 함수 이름(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)을 유지한 채 내부만 위임하는 얇은 래퍼로 바뀌어 호출부(각 `.spec.ts`)의 공개 계약을 건드리지 않았다. `engine-error-code-anchor-guard.ts` 는 래퍼 없이 `collectTsFiles` 를 직접 호출해(`:157`) 불필요한 간접 계층을 만들지 않았다.
- **의존 방향이 단방향**: `common/__test-utils__/source-scan.ts` → `repo-guards/__tests__/*` 로 가는 참조는 없다(반대 방향만 다수 import). 순환 의존 없음.
- **레이어 분리 일관**: 가드마다 "순수 파서/판정 로직 파일"(`*-guard.ts`)과 "소비 spec 파일"(`*.spec.ts`)을 분리하는 관례를 그대로 따른다. `findStaleSpecCasts(specFiles, widened: ReadonlySet<string>)` 처럼 판정 함수가 구체적 계산 방식이 아니라 `ReadonlySet<string>` 이라는 좁은 인터페이스에 의존하도록 만든 것도 인터페이스 분리 관점에서 적절하다.
- **옵션 표면의 YAGNI**: `CollectTsFilesOptions` 는 실측(507/818/1261/818/818 대조)으로 "결과에 영향을 주는 축은 `.spec.ts` 포함 여부뿐" 임을 확인한 뒤 그 축 하나만 노출한다. 검증 없이 표면을 넓히지 않았다.
- **오탐 방지가 허용목록이 아니라 구조적 제외**: `widenedEntityFields` 가 동명 충돌 필드를 판정 대상에서 빼는 방식(`nonNull` 집합 차집합)은 개별 필드를 하드코딩한 허용목록이 아니라 "왜 그 필드가 제외되는가" 라는 술어로 표현돼 있어, 형제 가드 `masked-reject-callers-guard` 가 반면교사로 남긴 "허용목록으로 오판을 은폐" 안티패턴을 반복하지 않는다.
- **6R 의 픽스처 중복 제거가 아키텍처 관점에서도 건전**: `nullable-type-lie-cast.spec.ts` 의 `withFiles`/`withFixture` 는 다중 파일 헬퍼를 단일 구현으로 두고 단일 파일 헬퍼를 그 얇은 래퍼로 재구성했다(이전 라운드 W3 조치, 이번에 코드로 재확인) — 새 axis(`옵션-배선 검증 테스트`)를 추가하면서 그 통합 구조를 다시 깨지 않았다.

## 요약

핵심 변경은 `repo-guards/__tests__/` 5곳에 중복돼 있던 디렉터리 재귀 walker 를 `source-scan.ts`
의 `collectTsFiles(root, { includeSpec })` 로 단일화한 것과, `nullable-type-lie-cast-guard.ts` 에
`widenedEntityFields`/`findStaleSpecCasts` 를 추가해 "넓혀진 nullable 필드를 겨눈 낡은
`.spec.ts` 캐스트" 탐지 축을 붙인 것이다. 기존 공개 API(각 가드의 함수 이름)를 보존하는 Facade
위임 방식이라 결합도·응집도 관점에서 건전하고, 의존 방향은 단방향(guard → source-scan)이며
순환 의존이 없다. 이번 8R 의 유일한 신규 코드는 6R 이 추가한 `masked-reject-callers.spec.ts`
의 배선 검증 테스트 2건뿐이며, 대상 함수를 실제로 통과하는 형태로 짜여 있어 구조적 문제가
없다. 이전 라운드가 이미 짚은 세 지점(단일 가드 파일의 책임 누적·guard 계열 내 정규식/AST
비일관·`source-scan.ts` 의 공유 커널 확장 추세)은 코드 상태 변화 없이 그대로 유효하며, 셋 다
트레이드오프가 docstring 에 판단 기록으로 이미 남아 있고 실피해가 없어 즉각 조치가 필요한
구조적 결함이 아니다. 새로 도입되는 CRITICAL/WARNING 급 아키텍처 결함은 이번 라운드에서도
발견되지 않았다.

## 위험도

LOW
