# 아키텍처(Architecture) 리뷰 — repo-guard walker 통합(`collectTsFiles`) + 낡은 spec 캐스트 가드 (4R)

## 검증 절차

`codebase/backend/src/common/__test-utils__/source-scan.ts`(+`.spec.ts`)와 이를 소비하는
5개 repo-guard(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
`masked-reject-callers-guard.ts`·`nullable-type-lie-cast-guard.ts`·
`redis-fail-open-catalog-guard.ts`) 및 그 spec 을 `Read` 로 디스크 현재 상태 전문 확인.
이전 라운드 산출물(`review/code/2026/09/04/02_35_22/architecture.md`, `RESOLUTION.md` 3R)과
대조해 3R 에서 조치된 두 항목(W1: `widenedEntityFields` docstring 의 검증 안 되는 "20건"
제거, INFO#4: `isNullableType()` 분리로 `Date|null`/`null | Date` 표기 위음성 제거)이 실제
코드에 반영돼 있음을 확인했다. `grep` 으로 `common/__test-utils__` → `repo-guards` 방향
참조가 없음(순환 의존 없음)을 재확인. 저장소 파일은 읽기만 했고 쓰기/뮤테이션은 하지
않았다(`git status --short` 불필요 — 트리 변경 없음).

## 발견사항

- **[INFO]** (3R 부터 이월, 재확인) `nullable-type-lie-cast-guard.ts` 한 파일이 서로 다른
  층위의 검사 세 가지(① `findCastOffenders` 프로덕션 이중 캐스트 카운트, ②
  `findUntypedNullableColumns` TypeORM `design:type` 메타데이터 정합성, ③
  `findStaleSpecCasts` `.spec.ts` 잔재 캐스트)를 담고 있다. 셋 다 "엔티티가 nullable 로
  넓혀진 데서 파생되는 결함" 이라는 공통 뿌리가 있어 응집도는 방어 가능하지만, 배치를
  거듭할 때마다 책임이 누적되는 추세(파일 자신의 주석이 "배치 1~3 에서 이 잔재를 세 번
  손으로 찾았다" 고 기록)라 향후 네 번째 검사가 붙으면 god-module 경향이 뚜렷해질 수 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts`
    — `findCastOffenders`(43-52행), `findUntypedNullableColumns`(104-121행),
    `findStaleSpecCasts`(229-243행) 세 함수가 한 파일에 공존
  - 제안: 조치 불필요. 네 번째 관련 검사가 추가되는 시점에 "스캔 대상(prod/spec)" 축으로
    파일을 둘로 쪼개는 것을 고려. (2R/3R 에서도 같은 판단 — 유지)

- **[INFO]** (3R 부터 이월, 재확인) 필드 **이름**을 전역 키로 쓰는 매칭 설계가 이 저장소에서
  두 번째로 같은 결함 클래스(동명이인 오탐)를 냈다 — 자매 축(응답 DTO nullable 필드명
  매칭, 직전 PR)에서 48건 중 44건이 오탐이었던 것을 확인해 놓고, 이번 엔티티 간 매칭에도
  같은 설계를 썼다가 20건 충돌을 재현했다(리뷰 2R W1, 3R 에서 docstring 정리로 마무리).
  각 가드가 개별 사후 패치(비-null 이름 전역 제외)로 건전성은 확보했지만, **근본 원인**
  (소유자 컨텍스트 없는 문자열 키로 매칭)은 공유 유틸로 승격되지 않은 채 남아 있다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:185-198`
    (`widenedEntityFields` — `nonNull` 집합으로 동명 충돌을 걸러내는 로직이 이 파일에만 있다)
  - 상세: 세 번째로 "이름으로 A/B 를 매칭" 하는 술어가 생기면 이 충돌 제외 관용구를 처음부터
    다시 발견해야 한다. 다만 지금은 실피해가 없고, 3R RESOLUTION 이 이미 "세 번째 사례가
    생기기 전에 공용 헬퍼를 만드는 것은 두 사례로 추상화를 짓는 일" 이라고 판단해 미뤘다 —
    이 판단(rule of three)에 동의한다.
  - 제안: 조치 불필요(유지). 세 번째 이름-기반 매칭 술어가 생기면 그때
    `source-scan.ts` 에 공유 헬퍼로 승격.

## 긍정적으로 확인된 설계 (재확인)

- **DRY 회귀 없음, 순환 의존 없음**: `repo-guards/__tests__/` 5개 파일에 흩어져 있던 재귀
  디렉터리 워커가 `collectTsFiles` 하나로 통합됐고, `common/__test-utils__` → `repo-guards`
  방향 import 는 없다(`grep` 재확인, 주석 언급만 존재).
- **Facade 위임으로 파괴적 변경 없이 중복 제거**: 각 guard 는 기존 공개 함수 이름
  (`collectSourceFiles`/`listSourceFiles`/`collectScanTargets`/`listProductionSources`)을
  유지한 채 내부만 `collectTsFiles` 위임으로 바뀌어 호출부(각 `.spec.ts`)를 건드리지 않았다.
- **isNullableType 분리는 정당한 SRP 강화**: 3R 에서 `tsType.includes('| null')` 부분문자열
  매칭을 `isNullableType()` 이라는 이름 있는 순수 예측 함수로 분리했다(`nullable-type-lie-
  cast-guard.ts:178-183`). "TS 타입 표기가 nullable 인가" 라는 술어를 정규식 매칭 로직에서
  분리해 이름을 부여한 것은 가독성·테스트 용이성 양쪽에서 개선이다.
- **문서적 자기수정이 코드 품질로 이어짐**: `widenedEntityFields` docstring 이 검증되지 않는
  "20건" 을 박았다가 같은 파일의 `collectScanTargets` 가 이미 적어 둔 규칙("검증되지 않는
  숫자는 적지 않는다")을 스스로 어겼음을 3R 에서 인지하고 정정했다 — 판단 기록으로서의
  주석 관례가 실제로 자기 교정에 쓰였다.
- **옵션 표면의 YAGNI 유지**: `CollectTsFilesOptions` 는 실측으로 결과에 영향을 주는 축이
  `.spec.ts` 포함 여부뿐임을 확인한 뒤 그 축 하나만 노출한다. 확장 필요 시
  `CollectTsFilesOptions` 인터페이스에 필드를 추가하면 되는 구조라 확장성도 확보돼 있다.

## 요약

4라운드째 리뷰로, 이전 라운드(3R)에서 지적된 두 항목(검증 안 되는 개수 주장, 타입 표기
위음성)이 코드에 정확히 반영됐음을 이번 라운드에서 직접 재확인했다. 핵심 구조 — 5개
repo-guard 에 중복돼 있던 TS 파일 재귀 수집을 `source-scan.ts` 의 `collectTsFiles` 로
단일화한 리팩터, 기존 공개 API 를 보존한 Facade 위임, 순환 의존 없음, 옵션 표면의 YAGNI —
는 이전 라운드와 동일하게 건전하며 이번 diff 로 인한 회귀도 없다. 남은 관찰 사항은 전부
INFO 로 이월된 것들뿐이다: (1) `nullable-type-lie-cast-guard.ts` 가 배치를 거듭하며 세
가지 검사를 누적한 god-module 경향, (2) 이름 기반 매칭 오탐 패턴이 이 저장소에서 두 번째로
재발했는데도 공유 유틸로 승격되지 않은 점. 둘 다 즉각 조치가 필요한 구조적 결함이 아니라
"세 번째 사례가 생기면" 이라는 명시적 트리거를 가진 유예 판단이고, 이번 라운드에서도 그
판단을 뒤집을 새 근거는 없었다. Critical·Warning 없음.

## 위험도

LOW
