# 아키텍처(Architecture) 리뷰 — repo-guard walker 통합 + 낡은 spec 캐스트 가드

## 검증 방법

정적 diff 판독 + `Read`/`Grep`/`git diff origin/main...HEAD` 로 각 파일의 현재 전체 내용을
직접 열어 대조. 저장소 트리에는 아무것도 쓰지 않았다 — `git status --short` 결과 이번
리뷰 산출 디렉터리(`review/code/2026/09/04/03_17_44/`) 외 변경 없음.

## 발견사항

- **[INFO]** `stripLiterals` 원칙이 같은 패턴("`null as unknown as`")을 세는 두 함수 사이에
  비대칭으로 적용된다 — 문서화된 다른 한계들과 달리 이 비대칭은 어디에도 근거가 적혀 있지
  않다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:192-197`
    (`countNullAsUnknownAsCasts` — `stripComments` 만 적용) vs
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:237`
    (`findStaleSpecCasts` — `stripLiterals(stripComments(...))` 적용) 및 `:43-52`
    (`findCastOffenders`, 전자를 호출)
  - 상세: `stripLiterals` 의 도입 근거(`source-scan.ts:60-68`)는 "리터럴 안의 코드 모양은
    코드가 아니다 — 그건 술어의 참인 성질" 이라고 **일반 원칙**으로 서술한다. 그런데 실제
    적용은 `findStaleSpecCasts`(신규, `.spec.ts` 를 스캔) 한 곳뿐이고, 같은 파일 안에서 같은
    문자열 패턴(`null as unknown as`)을 프로덕션 소스 대상으로 세는 자매 함수
    `countNullAsUnknownAsCasts`/`findCastOffenders` 는 여전히 `stripComments` 만 적용한다.
    이 모듈 자신의 헤더 docstring(`source-scan.ts:14-21`, "왜 공유하나")이 "한쪽만 하드닝하면
    나머지에 같은 결함 클래스가 남는다" 고 명시적으로 경고하는 바로 그 형태의 비대칭이다.
    직접 실측(`grep -rn "null as unknown as" codebase/backend/src --include='*.ts' | grep -v
    spec`)한 결과 오늘은 주석·정규식 리터럴 자기 언급뿐이라 **위험이 잠복 상태**다 —
    `findCastOffenders` 의 스캔 대상이 `.spec.ts` 를 구조적으로 제외하므로, 리터럴로 코드
    모양을 담는 파일(대부분 `.spec.ts` fixture)과 겹치지 않기 때문이다. 그러나 그 안전은
    "프로덕션 `.ts` 파일은 코드 스니펫을 문자열 리터럴로 담지 않는다" 는 **테스트되지도
    문서화되지도 않은 암묵적 불변식**에 기대고 있다 — 이 파일의 다른 모든 한계(`WIDENED_DECL`
    데코레이터 1개 제약, `.d.ts` 필터 축, 표기 순서, 중첩 백틱)는 전부 "## 한계" 절이나
    인라인 주석으로 명시돼 있는데 이 비대칭만 예외다.
  - 제안: 코드를 바꿀 필요는 없다(위험이 잠복해 있고, `findCastOffenders` 가 스캔하는 집합이
    구조적으로 안전을 보장한다) — 다만 `countNullAsUnknownAsCasts` 또는 `findCastOffenders`
    docstring 에 "이 함수는 `stripLiterals` 를 적용하지 않는다, 스캔 대상이 `.spec.ts` 를
    제외해 리터럴-코드 오탐 표면과 겹치지 않기 때문이다" 를 한 줄 추가해 다음 사람이 재발견할
    필요를 없앤다. 이 파일의 다른 모든 한계가 이미 그렇게 하고 있는 관례를 그대로 따르면 된다.

- **[INFO]** `source-scan.ts` 가 "세는 축의 단일 출처"에서 "가드가 필요로 하는 아무 정적
  분석 프리미티브의 공유 커널"로 서서히 넓어지고 있다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:1-22` (모듈 헤더,
    "왜 공유하나"), 전체 export 목록(`stripComments`·`stripLiterals`·`countCalls`·
    `countRawUpdateReturning`·`countNullAsUnknownAsCasts`·`collectTsFiles`)
  - 상세: 이번 diff 로 이 모듈에 세 번째 축(디렉터리 walker 통합, `collectTsFiles`)과 네 번째
    프리미티브(`stripLiterals`)가 추가됐다. 각 추가는 개별적으로 잘 근거돼 있고
    (사본 5개 제거, 자기 spec 오탐 방지), 공유 커널 패턴 자체는 이 저장소가 반복적으로
    겪은 "한쪽만 하드닝" 결함 클래스에 대한 합리적 대응이다. 다만 지금 이 파일은 (a) 문자열
    전처리(`stripComments`/`stripLiterals`), (b) 범용 카운팅(`countCalls`), (c) 가드
    한 개 전용 카운팅(`countRawUpdateReturning`·`countNullAsUnknownAsCasts` — 각각 raw SQL
    가드·nullable 캐스트 가드에만 쓰인다), (d) 파일시스템 순회(`collectTsFiles`) 네 가지
    관심사를 한 파일에 담고 있다. 지금 크기(272줄, 함수 8개)는 문제가 아니지만, 다음
    "세 번째 가드가 생기면 여기로 모은다" 확장이 계속되면 이 파일이 실질적으로
    `repo-guards` 전체의 God Module 이 될 위험이 있다.
  - 제안: 지금 당장 분리할 필요는 없다. 다음에 프리미티브를 더 추가할 때, 그것이 "여러 가드가
    공유하는 범용 축"(예: `collectTsFiles`)인지 "가드 한 개만 쓰는 특화 로직"(예:
    `countRawUpdateReturning`)인지를 구분해 후자가 늘어나면 그 시점에 관심사별 파일 분리를
    고려할 만하다.

## 요약

이번 diff 의 아키텍처 핵심은 두 가지다. (1) `repo-guards/__tests__/` 5곳에 흩어진 디렉터리
재귀 walker 사본을 `common/__test-utils__/source-scan.ts` 의 `collectTsFiles(root,
{ includeSpec })` 하나로 통합 — 옵션 객체 패턴으로 "지금 살아있는 축 하나"만 표면에 노출하고
사문화된 필터(`.d.ts`·`node_modules`/`dist`)는 항상 켜 두는 설계는 YAGNI 와 안전
(fail-closed) 를 동시에 satisfy 하는 좋은 판단이다. (2) `nullable-type-lie-cast-guard.ts` 에
`widenedEntityFields`/`findStaleSpecCasts` 를 추가해 두 번째 탐지 축(넓혀진 nullable 필드를
겨눈 낡은 `.spec.ts` 캐스트)을 붙였다 — 공유 프리미티브(`collectTsFiles`·`stripComments`·
`stripLiterals`)는 `source-scan.ts` 에, 가드 특화 판정 로직은 개별 가드 파일에 두는 계층
분리가 일관되게 지켜진다. SOLID 관점에서 눈에 띄는 결함은 없다 — 순환 의존은 없고
(guard → source-scan 단방향), 모듈 경계는 "순수 파서/판정 로직 파일" vs "소비 spec 파일"
관례를 4개 형제 가드 전부가 동일하게 따른다. 유일하게 실질적인 관찰은 이 모듈 자신이
경계하는 "비대칭 하드닝" 이 `stripLiterals` 적용 범위에서 한 번 더 재현됐다는 점인데, 스캔
대상 분리(`.spec.ts` 제외) 덕에 오늘은 무해하다 — 문서화 갭이지 구조적 결함은 아니다.
CRITICAL/WARNING 급 아키텍처 결함은 발견되지 않았다.

## 위험도

LOW
