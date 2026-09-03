# 아키텍처(Architecture) 리뷰 — repo-guard walker 통합(`collectTsFiles`) + 낡은 spec 캐스트 가드

## 검증 절차

`codebase/backend/src/common/__test-utils__/source-scan.ts`(+`.spec.ts`)와 이를 소비하는
5개 repo-guard(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
`masked-reject-callers-guard.ts`·`nullable-type-lie-cast-guard.ts`·
`redis-fail-open-catalog-guard.ts`)를 `Read`로 현재 디스크 상태 전문 확인. `plan/in-progress/
entity-nullable-column-type-mismatch.md`와 이전 라운드 산출물(`review/code/2026/09/04/
02_12_38/RESOLUTION.md` 등)을 대조해, 이전 라운드 testing 리뷰어가 지적한 "필드 이름 전역
Set 오탐" 이슈가 **이미 `02_12_38` RESOLUTION에서 수정 완료**된 상태(코드에 `nonNull.delete`
동명 충돌 제거 로직 + 대조군 테스트 존재)임을 직접 확인했다. 저장소 파일은 읽기만 했고
쓰기/뮤테이션은 하지 않았다(`git status --short` 불필요 — 트리 변경 없음).

## 발견사항

- **[INFO]** 필드 이름을 전역 키로 쓰는 매칭 설계가 이 저장소에서 **두 번째로 같은 결함
  클래스**(동명이인 필드 오탐)를 냈다 — 자매 축(DTO nullable 필드 매칭, 직전 PR)에서 48건 중
  44건이 이름 매칭 오탐이었던 것을 확인해 놓고, 이번 엔티티-대-엔티티 매칭에도 같은 설계를
  썼다가 20건 충돌을 재현했다. 현재는 두 사례 모두 사후 패치(비-null 이름 전역 제외)로
  건전성을 확보했지만, **근본 원인**(소유자 컨텍스트 없는 문자열 키)은 그대로 남아 있고
  패치도 각 가드에서 개별 구현됐다 — `source-scan.ts`가 스스로 "세는·모으는 축을 한 곳에
  모아 세 번째 가드가 같은 결함을 반복하지 않게 한다"고 선언한 원칙이 이 축(이름 충돌 방지)
  에는 아직 적용되지 않았다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:165-178`
    (`widenedEntityFields` — `nonNull` 집합으로 동명 충돌을 걸러내는 로직이 이 파일에만 있다)
  - 상세: 세 번째 가드가 "필드 이름으로 A/B 를 매칭"하는 유형의 술어를 또 만들면, 이 충돌
    제외 관용구를 처음부터 다시 발견해야 한다(혹은 발견하지 못하고 다시 오탐/오검출을 낼
    위험이 있다). 지금은 실피해가 없어 급하지 않다.
  - 제안: 조치 불필요(급하지 않음). 다음에 유사한 "이름 기반 매칭" 술어가 생기면
    `source-scan.ts`에 `excludeAmbiguousNames(matches)` 류의 공유 헬퍼로 승격을 고려 —
    지금 바로 추출할 근거(세 번째 사례)는 아직 없다.

- **[INFO]** `nullable-type-lie-cast-guard.ts`가 이번 diff로 세 번째 책임(`findStaleSpecCasts`
  — `.spec.ts`의 낡은 캐스트 탐지)을 얻어, 한 파일이 서로 다른 층위의 세 가지 검사(①
  프로덕션 이중 캐스트 카운트, ② TypeORM `design:type` 메타데이터 정합성, ③ `.spec.ts`
  잔재 캐스트)를 담게 됐다. 세 함수 모두 "엔티티가 nullable 로 넓혀진 데서 파생되는 결함"
  이라는 공통 뿌리가 있어 응집도 자체는 방어 가능하지만, 파일이 배치를 거듭할 때마다
  기능이 누적되는 추세(주석에 "배치 1~3에서 이 잔재를 세 번 손으로 찾았다"고 스스로 기록)
  라 향후 네 번째 검사가 추가되면 god-module 경향이 뚜렷해질 수 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:43-52`
    (`findCastOffenders`), `:104-121`(`findUntypedNullableColumns`), `:209-223`
    (`findStaleSpecCasts`) — 세 함수가 한 파일에 공존
  - 제안: 지금은 분리 불필요. 네 번째 관련 검사가 추가되는 시점에 "스캔 대상(prod/spec)"
    축으로 파일을 둘로 쪼개는 것을 고려.

- **[INFO]** 같은 guard 계열 안에서 정적 분석 방식이 갈린다 — `masked-reject-callers-guard.ts`
  는 반복된 정규식 우회(4번째 결함 클래스 재발) 끝에 AST(`typescript` 컴파일러) 로 전환했고
  주석에 그 전환 배경을 상세히 남겼다. 반면 `nullable-type-lie-cast-guard.ts`의
  `WIDENED_DECL`/`COLUMN_DECL`/`SPEC_CAST`는 여전히 정규식으로 TS 선언을 파싱한다. 이
  모듈 docstring이 이미 "AST 비용을 지금 치를 근거가 없다"며 트레이드오프를 명시하고 있어
  **이미 검토되고 의도된 선택**이지만, `masked-reject-callers-guard`를 AST로 옮기게 만든
  압력(정규식이 형태를 하나씩 놓치다 결국 표면이 무한해짐)이 구조적으로 동일한 부류의
  위험이라 계열 전체의 일관성 관점에서 기록해 둔다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:162-163`
    (`WIDENED_DECL` 정규식) vs `codebase/backend/src/repo-guards/__tests__/
    masked-reject-callers-guard.ts:100`(`importsBaseFn` — AST `ts.createSourceFile` 기반)
  - 제안: 조치 불필요. 데코레이터 2개 스택 형태가 저장소에 실재하는 날(이미 INFO로 추적
    중) AST 전환을 함께 고려하면 된다.

## 긍정적으로 확인된 설계

- **DRY 회귀 없음**: `repo-guards/__tests__/` 5개 파일에 흩어져 있던 사실상 동일한 재귀
  디렉터리 워커(`collectSourceFiles`·`walkTsFiles`·`listSourceFiles`·`collectScanTargets`·
  `listProductionSources`)가 `common/__test-utils__/source-scan.ts`의 `collectTsFiles`
  하나로 통합됐다(`readdirSync` 잔존 0, `grep` 확인). 각 guard는 기존 공개 함수 이름을
  유지한 채 내부만 위임하는 얇은 래퍼로 바뀌어(`audit-action-binding-guard.ts:47-48`,
  `engine-error-code-anchor-guard.ts:154-157`, `masked-reject-callers-guard.ts:48-51`,
  `redis-fail-open-catalog-guard.ts:92-94`) 호출부(각 `.spec.ts`)를 건드리지 않는
  Facade 패턴으로 마이그레이션했다 — 파괴적 리네임 없이 중복만 제거한 점이 좋다.
- **의존 방향이 단방향**: `common/__test-utils__` → `repo-guards/__tests__` 로 가는 참조는
  없다(`grep -rn repo-guards codebase/backend/src/common/__test-utils__/` 는 주석 언급
  2건뿐, import 없음). 순환 의존 없음.
- **불필요해진 import 정리**: `audit-action-binding-guard.ts`는 `walk` 로직 제거와 함께
  이제 쓰이지 않는 `import * as fs from 'node:fs'`도 함께 제거했다(diff 확인) — 죽은
  import 잔존 없음.
- **옵션 표면의 YAGNI**: `CollectTsFilesOptions`가 실측으로 "결과에 영향을 주는 축은
  `.spec.ts` 포함 여부뿐"임을 확인한 뒤 그 축 하나만 노출한다(`.d.ts` 제외·vendor skip은
  방어적으로 항상 켜 두되 옵션화하지 않음). 검증 없이 표면을 넓히지 않은 절제된 설계다.
- **결정론 개선**: 기존 5개 walker 중 2개만 `sort()`를 했는데(plan 문서 실측 표 참조),
  통합 후 전부 정렬된 결과를 받는다 — 가드 실패 메시지의 파일 순서가 이제 전 가드에서
  결정적이다. 집합 동일성은 5개 walker 전수(507/818/1261/818/818) 리팩터 전후 캡처로
  실측 확인됐다고 plan 문서(`entity-nullable-column-type-mismatch.md`)가 기록한다.

## 요약

핵심 변경은 5개 repo-guard에 중복돼 있던 "TS 파일 재귀 수집" 로직을 `source-scan.ts`의
`collectTsFiles`로 단일화한 리팩터이며, 기존 공개 API(각 guard의 함수 이름)를 보존한
Facade 위임 방식이라 결합도·응집도 관점에서 건전하다. 순환 의존 없음, 죽은 import 없음,
옵션 표면은 실측된 축 하나만 노출해 과도한 추상화를 피했다. `nullable-type-lie-cast-guard.ts`
에 새로 추가된 `widenedEntityFields`/`findStaleSpecCasts`(넓혀진 엔티티 필드를 겨눈 낡은
`.spec.ts` 캐스트 탐지)는 이전 라운드에서 지적된 "필드 이름 전역 매칭 오탐"이 이미
`02_12_38` RESOLUTION에서 수정 완료된 상태로 확인됐다(동명 충돌 제외 로직 + 대조군 테스트
존재). 남은 관찰 사항은 전부 INFO 수준 — (1) 이름-기반 매칭 오탐이라는 결함 클래스가 이
저장소에서 두 번째로 재발했는데도 공유 유틸로 승격되지 않은 점, (2) 세 가지 서로 다른
검사가 한 파일에 누적되는 추세, (3) 같은 guard 계열 안에서 정규식/AST 선택이 갈리는 점 —
이며 모두 즉각 조치가 필요한 구조적 결함이 아니라 향후 유사 패턴이 다시 나타날 때 참고할
관찰이다.

## 위험도

LOW
