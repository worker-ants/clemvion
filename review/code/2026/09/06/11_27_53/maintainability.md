# 유지보수성(Maintainability) 리뷰

## 개요

이 diff 는 `User` 엔티티 컬럼 노출 방어(검출) 2축 신설(`user-entity-exposure-guard.ts`/`.spec.ts`,
`user-secret-absence.ts`/`.spec.ts`)과 그 소비 e2e, 그리고 이미 두 차례 리뷰 라운드
(`review/code/2026/09/06/10_13_22`, `10_53_48`)를 거쳐 Critical 1 · WARNING 다수를 처분한
결과물이다. `CREATOR_PROJECTION` 단일 상수 통합, e2e 라벨 유일성·순서 복구, `unwrap()` 캐스트
처리, `enclosingName` 메서드 우선순위 관측 가능화 등 직전 라운드의 WARNING 은 실제 코드로
확인한 결과 전부 해소돼 있었다. 이번 라운드에서 새로 발견한 것은 아래 한 건(테스트 설명 문자열의
카운트 드리프트)이다.

## 발견사항

- **[WARNING]** 가드 spec 의 테스트 설명이 "위반 10형태"라고 적지만 실제 fixture 는 11개 위반
  형태를 정의하고, 이 PR 자신의 `RESOLUTION.md` 도 "위반 11형태"라고 명시한다 — 카운트가
  드리프트됐다
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure.spec.ts:135`
    (`it('위반 10형태를 전부 잡는다 (한 함수 안 두 번은 두 건으로)', ...)`)
  - 상세: `codebase/backend/src/repo-guards/__tests__/fixtures/user-relation-load.fixture.ts` 를
    직접 열어 세면 `violationRelationsUser`~`violationSatisfiesRelations` 까지 주석에
    "위반 1"~"위반 11" 로 명시적으로 번호가 매겨진 **11개**의 서로 다른 위반 함수가 있다
    (그중 `violationTwiceInOneFunction` 하나가 2건을 내므로 `found` 배열 총 길이는 12이지만,
    "형태" 즉 구별되는 위반 케이스 수는 11이다). 같은 브랜치의
    `review/code/2026/09/06/10_53_48/RESOLUTION.md` 도 "가드 대조군은 이제 **위반 11형태** /
    준수 4형태다"라고 스스로 못 박아 뒀다. 그런데 `git log -p` 로 이 줄의 이력을 보면
    5→8→10 으로 세 번 갱신됐고, 마지막 갱신(이번 라운드에서 `violationViaIntermediateVariable`·
    `violationSatisfiesRelations` 두 형태를 추가하며 8→10으로 바꾼 것)이 실제로는 8→**11**이어야
    할 것을 8→10 으로 한 개 덜 올렸다. 이 저장소는 바로 이런 "실측 수치가 문서마다 따로 노는"
    실패 모드를 여러 차례 반복 지적해 온 이력이 있고(CHANGELOG·plan 자체가 "숫자를 지금 갱신하면
    또 낡는다"는 경고를 남길 정도), 이번 건은 그 경고가 코드 안의 테스트 설명 문자열에서도
    똑같이 재현된 사례다. 기능적으로는 무해하다 — 실제 단언(`toEqual([...12개 메서드명...])`)은
    번호에 의존하지 않고 전체 목록을 나열해 비교하므로 테스트 자체는 정확하다. 다만 이 설명
    문자열은 "이 가드가 몇 가지 위반 형태를 커버하는가"를 사람이 확인하는 유일한 요약 지점이라,
    다음에 위반 형태를 추가·제거하는 사람이 이 숫자를 신뢰하면 실제 커버리지를 한 개 적게(또는
    많게) 인식하게 된다.
  - 제안: `135`행의 "위반 10형태"를 "위반 11형태"로 정정한다. 재발 방지를 원하면 `found.length`
    또는 `new Set(found.map(f => f.method)).size` 를 별도로 단언해 설명 문자열의 숫자가 실제
    fixture 크기와 자동으로 맞는지 확인하는 낮은 비용의 보강도 가능하다(강제 사항 아님).

- **[INFO]** `findUserRelationLoads` 내부에 "점으로 구분된 경로의 마지막 세그먼트를 구한다"는
  동일 연산이 세 곳에 인라인 반복돼 있다 — 직전 라운드에서 이미 지적·저비용 defer 처리된 항목,
  재발 아님
  - 위치: `codebase/backend/src/repo-guards/__tests__/user-entity-exposure-guard.ts:95`
    (`isUserRelationPath` 내부 `value.split('.').pop() ?? value`), `:163`
    (`el.text.split('.').pop() ?? el.text`), `:296` (`first.text.split('.').pop() ?? ''`)
  - 상세: 세 자리 모두 폴백값만 다를 뿐 같은 표현식을 반복한다. `review/code/2026/09/06/10_53_48/maintainability.md`
    INFO#6 이 이미 이 패턴을 지적했고, 같은 라운드 `RESOLUTION.md` "남긴 것" 표가 "3곳 인라인,
    폴백이 달라 통합 시 오히려 분기가 는다"는 근거로 의도적으로 defer 했다 — 이번 라운드에서
    코드를 다시 확인한 결과 그 상태 그대로다(새로 늘거나 줄지 않음). 급하지 않은 사안이라
    재차 우선순위를 올릴 근거는 없다.
  - 제안: 기존 defer 결정 유지. 조치 불요.

## 요약

이 PR 은 이미 두 차례의 `/ai-review` 라운드를 거치며 실질적인 유지보수성 결함(보안 경계
리터럴의 4곳 손 복제, e2e 라벨 중복·순서 역전, 관측 불가능한 분기)을 전부 해소한 상태였고,
이번 라운드에서 코드를 직접 열어 그 수정들이 실제로 반영돼 있음을 확인했다. 새로 발견한 것은
가드 테스트의 설명 문자열이 "위반 10형태"라고 적어 실제 fixture(11개)·PR 자신의 RESOLUTION
문서(11개)와 어긋나는 카운트 드리프트 한 건뿐이다 — 이 저장소가 반복적으로 겪어 온 "실측
수치가 여러 문서에서 따로 노는" 실패 패턴이 테스트 설명 문자열 레벨에서 재현된 사례이며,
단언 자체는 정확해 기능적 위험은 없다. 그 외 가독성·네이밍·함수 길이·중첩 깊이·중복 코드
전반은 형제 가드(`swagger-dto-contract-guard.ts`, `nullable-type-lie-cast-guard.ts`)의
"순수 스캔 로직/소비 spec 분리" 관례를 일관되게 따르며 문제가 없다.

## 위험도

LOW
