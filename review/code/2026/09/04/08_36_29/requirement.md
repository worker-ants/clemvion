# Requirement Review — 관계 데코레이터 동명 충돌 대조군 (2R)

대상: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` (신규 대조군 2건,
INFO#2 수정 포함) + `plan/in-progress/entity-nullable-column-type-mismatch.md` (체크박스 완료 갱신) +
`review/code/2026/09/04/08_18_51/*` (1R 산출물, 신규 파일로 diff 에 포함).

diff base: `origin/main`(`origin/main..HEAD` = `242c3d5de`, `6dada6b16` 2 커밋). 실제 코드 변경분은
spec.ts +74/-9, plan.md +22/-9 로 프롬프트 diff 와 일치함을 확인.

## 검증 방법

저장소 3건의 관계 충돌(`integration`/`trigger`/`user`) 실재 여부와, plan 이 적은 뮤테이션 결과
("충돌 배제를 빼면 3건 RED", "`WIDENED_DECL` 에서 관계 데코레이터만 빼면 2건 RED(관계 대조군만)")를
독립 재현했다. 뮤테이션은 저장소 밖 scratch(`nullable-type-lie-cast-guard.ts.orig`)에 원본을 `cp`
해 둔 뒤 `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 를 직접 고쳐
`jest` 를 돌리고, 매 라운드 끝에 `cp` 로 원복했다(`git checkout` 미사용). 최종 `git status --short`
로 저장소가 깨끗함(세션 산출물 디렉터리 외 변경 없음)을 확인했다.

## 발견사항

- **[WARNING]** plan 의 뮤테이션 정확성 주장("두 축을 정확히 가른다")이 재현 결과와 다르다 —
  두 번째 뮤테이션이 실제로 잡는 것은 새로 추가된 대조군이 아니라 기존 테스트다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:241-242`
  - 상세: 문서는 "`WIDENED_DECL` 에서 관계 데코레이터만 빼면 **2건 RED**(관계 대조군만)" 이라고
    적었다. `WIDENED_DECL` 정규식에서 `ManyToOne|OneToOne` 을 제거하는 뮤테이션을 독립 재현하니
    실제로 **2건 RED** 인 것은 맞지만, 실패한 테스트는 신규 `[대조군]` 2건이 **아니라**
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 의 기존(이 PR 이전부터
    있던) 테스트 두 개다 — `넓혀진 필드명을 전수로 뽑는다 — 관계(@ManyToOne + @JoinColumn)도 포함`
    (파일 내 "넓혀진 필드를 겨눈 낡은 spec 캐스트" describe 블록, ENTITY 픽스처의 `parent` 필드
    검사)와 `관계 필드를 겨눈 캐스트도 잡는다`. 신규 대조군 2건(`관계 데코레이터끼리의 동명 충돌`,
    `@Column 과 관계가 섞인 충돌`)은 이 뮤테이션에서 **그대로 GREEN** 이다 — 정규식이 관계
    데코레이터를 아예 안 보게 되면 `target`/`mixed` 필드가 애초에 `widened` 집합에 들어가지 않아,
    "판정에서 뺀다"(`w.has(...).toBe(false)`) 단언이 **공허하게 참**이 되기 때문이다(충돌 배제
    로직이 작동해서가 아니라, 넣을 필드 자체가 없어서 통과한다).
    재현 로그(요지): 뮤테이션 적용 후 `jest` 결과 `2 failed` — 실패 테스트명이
    `넓혀진 필드명을 전수로 뽑는다 — 관계(@ManyToOne + @JoinColumn)도 포함`,
    `관계 필드를 겨눈 캐스트도 잡는다`. `[대조군]` 이라는 표기가 붙은 테스트는 실패 목록에 없다.
    한편 첫 번째 뮤테이션 주장("충돌 배제를 빼면 3건 RED — Column 대조군 포함")은 정확히 재현됐다
    (실패 3건: 기존 `userId` 대조군 + 신규 `target`/`mixed` 대조군 2건).
  - 판정: 코드 결함이 아니다 — 신규 대조군 2건은 **뮤테이션 1(충돌 배제 제거)** 로 이미 정상
    작동이 확인됐다(3건 RED 안에 둘 다 포함). 문제는 plan 문서가 **뮤테이션 2 의 결과를 잘못
    귀속**시켜 "두 축을 정확히 가른다"고 쓴 것 — 실제로는 뮤테이션 2 가 신규 대조군을 전혀 운동시키지
    않는다. 같은 문서가 §"이 작업에서 세 번 반복된 실패"에서 "완료·추적 주장은 쓰기 전에 검증 명령을
    돌린다"는 규칙을 스스로 세워 둔 자리라, 이번 건이 그 규칙이 다시 어긴 사례로 보인다(개수(2)는
    맞았지만 **어느 테스트가 실패했는지는 확인하지 않고** 썼다).
  - 제안: `241-242` 줄의 "관계 대조군만" 문구를 정정한다 — 예: "`WIDENED_DECL` 에서 관계 데코레이터를
    빼면 2건 RED 이지만, 이는 신규 대조군이 아니라 기존 `parent` 관련 테스트다. 신규 대조군은
    뮤테이션 1(충돌 배제 제거) 만으로 이미 검증된다." 또는 해당 두 줄을 삭제하고 뮤테이션 1 결과만
    남긴다.

- **[INFO]** 저장소 실재 충돌 3건(`integration`/`trigger`/`user`) 및 `workflow` 6곳 전부 non-null
  이라는 부수 관측은 소스와 대조해 전부 정확함을 확인했다(3건 모두 직접 grep 으로 재확인 — 1R
  requirement reviewer 의 확인과 일치).
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:379-381`,
    `plan/in-progress/entity-nullable-column-type-mismatch.md:244-245`
  - 상세: `integration_oauth_state.integration`(nullable) ↔ `integration_usage_log.integration`
    (non-null), `execution.trigger`(nullable) ↔ `schedule.trigger`(non-null),
    `login_history.user`(nullable) ↔ `audit_log.user`(non-null) 전부 실측과 일치. `workflow` 필드는
    `node`/`trigger`/`workflow-assistant-session`/`workflow-version`/`execution`/`edge` 6개 엔티티
    전부 non-null — plan 의 "6곳 전부 non-null" 주장과 일치.
  - 제안: 조치 불요 — 정확성 확인 기록.

- **[INFO]** INFO#2(1R) 수정이 실제로 반영·검증됨을 확인했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:435-441`
  - 상세: 두 번째 신규 대조군에 `b.spec.ts` fixture 와 `findStaleSpecCasts([...]).toHaveLength(0)`
    단언이 추가돼 형제 테스트와 검증 깊이가 맞춰졌다. `RESOLUTION.md` 가 주장한 "가르는 뮤턴트"
    (`findStaleSpecCasts` 가 `widened` 를 무시하게 함 → 5 failed, 그중 `[대조군] @Column 과 관계가
    섞인 충돌도 뺀다` 포함)를 독립 재현해 정확히 일치함을 확인했다(5 failed, 실패 목록에 해당
    테스트명 포함).
  - 제안: 조치 불요.

- **[INFO]** 이 가드를 정의하는 spec 문서가 `spec/` 에 없다 — plan 이 스스로 "코드 전용, spec
  미변경" 이라 명시한 것과 일치하며, 이번 diff 의 대상(테스트 확장 + 이미 옳던 코드의 캐너리)은
  제품 요구사항이 아니라 내부 개발 가드이므로 spec 부재가 자연스럽다.
  - 위치: N/A
  - 제안: 해당 없음.

## 요약

이번 diff 는 이미 옳던 동작(관계 데코레이터끼리·`@Column`+관계 혼재 이름 충돌 배제)을 캐너리로
고정하는 대조군 테스트 2건과, 1R 리뷰가 지적한 검증 깊이 비대칭(INFO#2)을 메우는 3줄, plan 체크박스
갱신로 구성된다. 신규 테스트 2건은 독립 재현한 뮤테이션(충돌 배제 로직 제거 → 3건 RED, 그 안에 신규
대조군 2건 모두 포함)으로 실제로 회귀를 잡는다는 것을 확인했고, INFO#2 수정도 별도 뮤테이션으로
검증됐다 — 기능적으로는 완결돼 있다. 다만 plan 문서가 추가한 두 번째 뮤테이션 서술("관계 데코레이터
만 빼면 2건 RED — 관계 대조군만")은 재현 결과 신규 대조군이 아니라 기존의 무관한 두 테스트를 잡는
것으로 드러나, 문서 자신이 다른 절에서 세워 둔 "쓰기 전에 검증 명령을 돌린다" 규칙을 이번에도
어겼다. 코드·테스트 자체의 결함은 아니므로 WARNING 1건(문서 정정)만 보고한다.

## 위험도
LOW
