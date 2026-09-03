# 아키텍처(Architecture) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드

## 검증 방법

diff 대상 9개 파일 중 코드 8개(`source-scan.ts`/`.spec.ts`, 4개 소비 가드, `nullable-type-lie-cast-guard.ts`/`.spec.ts`)를 저장소에서 `Read` 로 현재 전체 내용(HEAD)을 직접 열어 확인했다(프롬프트가 크기 제한으로 생략한 파일 1·6·7 포함). `grep` 으로 형제 가드의 AST/정규식 사용 여부를 대조했고, 이 changeset 이 이미 여러 라운드(01_48_39 ~ 03_17_44)의 리뷰·조치를 거친 상태임을 `review/code/2026/09/04/*/architecture.md`·`SUMMARY.md`·`RESOLUTION.md` 를 읽어 확인한 뒤, 이전 라운드가 이미 짚은 지점과 겹치지 않는 관찰만 남겼다. 저장소 트리에는 아무것도 쓰지 않았다 — `git status --short` 결과 이 리뷰 산출 디렉터리(`review/code/2026/09/04/03_37_37/`) 외 변경 없음.

## 발견사항

- **[INFO]** `nullable-type-lie-cast-guard.ts` 한 파일이 층위가 다른 세 검사를 담고 있다 — 파일명이 가리키는 책임보다 넓어졌다 (이전 라운드에서 이미 관찰, 이번 diff 로 상태 변화 없음 — 재확인만)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:43-52`(`findCastOffenders` — 프로덕션 이중 캐스트 카운트), `:104-121`(`findUntypedNullableColumns` — TypeORM `design:type` 메타데이터 정합성), `:231-245`(`findStaleSpecCasts` — `.spec.ts` 잔재 캐스트)
  - 상세: 세 함수 모두 "엔티티가 `| null` 로 넓혀진 데서 파생되는 결함" 이라는 공통 뿌리가 있어 응집도 자체는 방어 가능하지만, 파일이 배치(batch)를 거듭할 때마다 검사 축이 누적되는 추세다(파일 자신의 docstring 이 "배치 1~3 에서 이 잔재를 세 번 손으로 찾았다" 고 이미 기록). 이번 diff 는 세 번째 축(`findStaleSpecCasts`)을 이 파일에 추가하는 선택을 유지했다 — 파일을 스캔 대상(prod-source vs spec) 축으로 분리하는 대신 기존 파일에 계속 얹는 방향이다.
  - 제안: 지금 분리할 필요는 없다(파일 245줄, 함수 6개 — 아직 관리 가능한 크기). 네 번째 관련 검사가 추가되는 시점에 "스캔 대상" 축으로 파일을 둘로 쪼개는 것을 고려.

- **[INFO]** 같은 guard 계열 안에서 정적 분석 방식이 갈린다 — 신규 `WIDENED_DECL`/`COLUMN_DECL` 이 정규식으로 TS 데코레이터·필드 선언을 파싱하는데, 형제 가드 3개는 전부 TS 컴파일러 AST 를 쓴다 (이전 라운드에서 이미 관찰, 트레이드오프가 코드에 명시돼 있어 재확인만)
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:168-169`(`WIDENED_DECL` 정규식) vs `codebase/backend/src/repo-guards/__tests__/masked-reject-callers-guard.ts:105`(`ts.createSourceFile` 기반 `importsBaseFn`), `audit-action-binding-guard.ts:62`(`findAuditHelpers`), `redis-fail-open-catalog-guard.ts:34,110`(두 곳 모두 AST)
  - 상세: `masked-reject-callers-guard.ts` 는 반복된 정규식 우회 끝에 AST 로 전환한 선례를 갖고 있고, `stripLiterals` 의 도입 근거(`source-scan.ts:60-68`)도 "허용목록으로 덮는 것은 오판을 은폐하는 것" 이라며 그 실수를 명시적으로 반면교사로 든다. 그런데 정작 새 가드의 파싱 자체(`WIDENED_DECL`)는 여전히 정규식이다. `nullable-type-lie-cast-guard.ts:160-166` 의 docstring 이 "추가 데코레이터 1개까지만 본다" 는 한계와 "AST 비용을 지금 치를 근거가 없다" 는 트레이드오프를 이미 명시하고 있어 **의도된 선택**이지만, `masked-reject-callers-guard` 를 AST 로 옮기게 만든 압력(정규식이 형태를 하나씩 놓치다 표면이 점진적으로 넓어짐)과 구조적으로 같은 부류의 위험이라 계열 전체의 일관성 관점에서는 여전히 유효한 관찰이다.
  - 제안: 조치 불필요. 데코레이터 2개 이상 스택 형태가 저장소에 실재하는 날(이미 docstring 이 재개 트리거로 명시) AST 전환을 함께 고려.

- **[INFO]** `source-scan.ts` 가 "세는 축의 단일 출처"에서 파일 I/O(`collectTsFiles`)까지 포함하는 4개 관심사(문자열 전처리·범용 카운팅·가드 전용 카운팅·디렉터리 순회)의 공유 커널로 계속 확장 중 (이전 라운드에서 이미 관찰, 크기 변화 없음 — 재확인만)
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:1-22`(모듈 헤더 "왜 공유하나"), 전체 export(`stripComments`·`stripLiterals`·`countCalls`·`countRawUpdateReturning`·`countNullAsUnknownAsCasts`·`hasNullAsUnknownAsCast`·`hasRawUpdateReturning`·`collectTsFiles`)
  - 상세: 각 추가는 개별적으로 잘 근거돼 있고(사본 5개 제거, 자기 spec 오탐 방지) 이 저장소가 반복적으로 겪은 "한쪽만 하드닝" 결함 클래스에 대한 합리적 대응이지만, "세 번째 가드가 생기면 여기로 모은다" 는 확장 원칙이 계속 적용되면 이 파일이 사실상 `repo-guards` 전체의 God Module 이 될 잠재 위험이 있다. 현재(271줄, 함수 9개)는 문제가 아니다.
  - 제안: 지금 당장 분리 불요. 다음 프리미티브 추가 시 "여러 가드가 공유하는 범용 축" 인지 "가드 한 개 전용 로직" 인지 구분해, 후자가 늘어나면 그 시점에 관심사별 파일 분리를 고려.

## 긍정적으로 확인된 설계

- **DRY 회귀 없음 + Facade 마이그레이션**: `repo-guards/__tests__/` 5개 파일에 흩어져 있던 사실상 동일한 재귀 디렉터리 워커가 `collectTsFiles` 하나로 통합됐다(`readdirSync` 잔존 0, 직접 grep 확인). 4개 가드는 기존 공개 함수 이름(`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)을 유지한 채 내부만 위임하는 얇은 래퍼로 바뀌어(`audit-action-binding-guard.ts:47-49`, `masked-reject-callers-guard.ts:48-52`, `redis-fail-open-catalog-guard.ts:93-95`, `nullable-type-lie-cast-guard.ts:38-40`) 호출부(각 `.spec.ts`)의 공개 계약을 건드리지 않았다 — 파괴적 리네임 없이 중복만 제거했다. `engine-error-code-anchor-guard.ts` 는 래퍼 없이 `collectTsFiles` 를 직접 호출해(`:157`) 불필요한 간접 계층을 만들지 않았다.
- **의존 방향이 단방향**: `common/__test-utils__/source-scan.ts` → `repo-guards/__tests__/*` 로 가는 참조는 없다(반대 방향만 5곳 import). 순환 의존 없음.
- **레이어 분리 일관**: 5개 가드 전부 "순수 파서/판정 로직 파일"(`*-guard.ts`) 과 "소비 spec 파일"(`*.spec.ts`) 을 분리하는 관례를 그대로 따른다. `findStaleSpecCasts(specFiles, widened: ReadonlySet<string>)` 처럼 판정 함수가 구체적 계산 방식이 아니라 `ReadonlySet<string>` 이라는 좁은 인터페이스에 의존하게 만든 것도 인터페이스 분리 관점에서 적절하다.
- **옵션 표면의 YAGNI**: `CollectTsFilesOptions` 는 실측(507/818/1261/818/818 대조)으로 "결과에 영향을 주는 축은 `.spec.ts` 포함 여부뿐" 임을 확인한 뒤 그 축 하나만 노출한다(`.d.ts` 제외·vendor skip 은 방어적으로 항상 켜 두되 옵션화하지 않음, `source-scan.ts:210-219`). 검증 없이 표면을 넓히지 않았다.
- **오탐 방지가 허용목록이 아니라 구조적 제외**: `widenedEntityFields` 가 동명 충돌 필드를 판정 대상에서 빼는 방식(`nonNull` 집합 차집합, `:187-200`)은 개별 필드를 하드코딩한 허용목록이 아니라 "왜 그 필드가 제외되는가" 라는 술어로 표현돼 있어, 형제 가드 `masked-reject-callers-guard` 가 반면교사로 남긴 "허용목록으로 오판을 은폐" 안티패턴을 반복하지 않는다.

## 요약

핵심 변경은 `repo-guards/__tests__/` 5곳에 중복돼 있던 디렉터리 재귀 walker 를 `source-scan.ts` 의 `collectTsFiles(root, { includeSpec })` 로 단일화한 것과, `nullable-type-lie-cast-guard.ts` 에 `widenedEntityFields`/`findStaleSpecCasts` 를 추가해 "넓혀진 nullable 필드를 겨눈 낡은 `.spec.ts` 캐스트" 탐지 축을 붙인 것이다. 기존 공개 API(각 가드의 함수 이름)를 보존하는 Facade 위임 방식이라 결합도·응집도 관점에서 건전하고, 의존 방향은 단방향(guard → source-scan)이며 순환 의존이 없다. 이 changeset 은 이미 여러 라운드의 아키텍처 리뷰를 거쳤고, 이번 라운드에서 코드를 직접 재확인한 결과 이전에 관찰된 세 지점(단일 가드 파일의 책임 확장·guard 계열 내 정규식/AST 비일관·`source-scan.ts` 의 공유 커널 확장 추세) 모두 코드 상태 변화 없이 그대로 유효하며, 셋 다 이미 트레이드오프가 docstring 에 판단 기록으로 남아 있고 실피해가 없어 즉각 조치가 필요한 구조적 결함이 아니다. 새로 도입되는 CRITICAL/WARNING 급 아키텍처 결함은 발견되지 않았다.

## 위험도

LOW
