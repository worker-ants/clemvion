# 문서화(Documentation) 리뷰

## 개요

이 브랜치(`origin/main...HEAD`, 9개 커밋)는 이미 8차례의 `/ai-review`(10_13_22 → 14_59_48)와
2차례의 `/consistency-check` 라운드를 거쳤고, 그 결과 지적된 문서화 결함(JSDoc orphan 블록,
경계 리터럴 손 복제, e2e 라벨 충돌, CHANGELOG 누락 등)은 이미 코드에 반영되어 있음을
`git log`/`git show`로 직접 대조해 확인했다. 이번 라운드는 가장 마지막 커밋
(`0fd4d2f29`, "방금 만든 것이 세 자리에서 한 칸씩 좁았다" — 직전 라운드 `14_59_48`의
WARNING 1·2·3·5·6을 처분)만이 아직 문서화 관점에서 리뷰되지 않은 신규 변경분이므로,
이 델타를 중심으로 분석했다.

`14_59_48/SUMMARY.md`의 WARNING #1(`pg-error.ts` SoT 우회) · #2(`USER_SECRET_KEYS` 소스 대조
부재) · #5(`listMembers` 단위 테스트 부재) · #6(CHANGELOG 누락)은 이번 커밋에서 실제로
해소됐고, `pg-error.ts`/`pg-error.spec.ts`/`user-secret-absence.spec.ts`/
`workspaces.service.spec.ts`의 신규 JSDoc·주석은 "왜 이 방식인가"·"이전에 무엇이 좁았는가"를
리뷰 라운드 인용과 함께 정확하게 서술하고 있다. CHANGELOG의 "회귀 테스트 7건" 서술도
직접 커밋 두 개(`a185846a5`의 트레일링 주석 테스트 4건 + `0fd4d2f29`의 인용 스칼라 테스트
3건)를 대조해 정확함을 확인했다.

WARNING #3(`_strip_comment`의 quoted 스칼라 갭)은 코드로는 해소됐으나, 그 수정 과정에서
기존 docstring이 새 분기를 반영하지 못하게 된 새로운 문제를 발견했다(아래).

## 발견사항

- **[WARNING]** `_strip_comment`의 docstring이 "따옴표 없는 스칼라"만 다룬다고 적고 있는데, 이번 커밋이 추가한 분기는 정확히 그 반대(따옴표 있는 스칼라)를 처리한다
  - 위치: `.claude/hooks/_lib/review_guard.py` — `_strip_comment` 함수 (Read로 확인한 실제 줄 번호: 626~641, docstring은 627~630)
  - 상세: 이번 커밋이 `_strip_comment`에 `if quote:` 분기(636~640행)를 새로 추가해 인용 스칼라(`"a.ts"  # note`)의 닫는 따옴표 뒤를 잘라내도록 했다. 그런데 함수 맨 위 docstring은 여전히 `"""따옴표 없는 스칼라의 트레일링 YAML 주석(` #` 이후)을 잘라낸다.` 로 시작한다 — 이는 새로 추가된 분기(따옴표 **있는** 스칼라 처리)를 정반대로 요약한다. `_strip_comment`는 `_clean`(644행)과 인라인 리스트 파싱(655행) 두 호출부 모두에서 따옴표 유무와 무관하게 호출되는 단일 진입점이므로, docstring 요약만 읽는 다음 유지보수자는 "이 함수는 unquoted만 처리하니 quoted 트레일링 주석은 여전히 안 잘린다"고 오판할 수 있다. 이 파일은 같은 결함 클래스(트레일링 주석 처리)가 이미 세 번(줄 전체 주석 → 트레일링 주석 → 인용 스칼라) 연속으로 한 칸씩 좁게 닫혀 온 이력이 있고(`review/code/2026/09/06/14_59_48` W3, CHANGELOG.md:127-137), 그 이력 자체가 "다음 리뷰어가 정규식을 직접 돌려야 다음 형태를 찾는다"는 패턴을 지적하고 있다 — 진입점 함수의 docstring이 실제 분기 커버리지를 정확히 요약하지 않으면 같은 패턴이 4번째로 재발할 위험을 키운다.
  - 제안: docstring 첫 줄을 "따옴표 유무에 따라 갈라 처리한다 — 언쿼트는 ` #` 이후를, 인용 스칼라는 닫는 따옴표 뒤를 자른다"처럼 두 분기를 모두 요약하도록 고친다. 인용 스칼라 처리에 대한 상세 설명은 이미 636~638행 인라인 주석에 있으므로, docstring에는 요약 한 줄만 추가해도 충분하다.

- **[INFO]** (검증 완료, 조치 불요) 이전 라운드 WARNING #1·#2·#5·#6이 실제로 해소됐다
  - 위치: `codebase/backend/src/common/db/pg-error.ts`(`pgErrorConstraint` 신설) · `codebase/backend/src/modules/triggers/triggers.service.ts`(`isEndpointPathUniqueViolation`이 SoT 재사용으로 교체) · `codebase/backend/src/shared/testing/user-secret-absence.spec.ts`(엔티티 컬럼 대조 테스트 3건 신설) · `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts`(`listMembers` 단위 테스트 2건 신설) · `CHANGELOG.md:127-137`
  - 상세: 각 파일을 직접 열어 대조한 결과, `14_59_48/SUMMARY.md`가 지목한 위치·제안과 정확히 일치하는 수정이 들어가 있고, 새로 작성된 JSDoc/주석 모두 "무엇이 왜 좁았는지"를 실측(예: `expect(entityColumnNames()).toHaveLength(23)`)과 함께 남겼다. 재발 없음.

## 요약

이번 델타(`0fd4d2f29`)의 문서화 품질은 전반적으로 높다 — PG 에러 SoT 통합·`USER_SECRET_KEYS` 엔티티 대조·`listMembers` 단위 테스트·CHANGELOG 보충 네 가지 모두 "왜 이전 판이 좁았는가"를 리뷰 라운드 인용과 실측 수치로 정확히 남겼고, 새로 등재된 두 planner 항목(에러 세부 코드 표현 정식화, `2-trigger-list.md:106` botToken 마스킹 서술 자기모순)도 CLAUDE.md의 spec 쓰기 권한 경계를 지키며 근거와 함께 적절히 위임됐다. 유일하게 새로 발견한 결함은 `review_guard.py`의 `_strip_comment` docstring이 이번 커밋이 추가한 인용 스칼라 분기를 반영하지 못해 요약이 실제 동작과 반대 방향으로 좁아진 것으로, 이 파일이 같은 결함 클래스를 세 번 좁게 닫아온 이력을 감안하면 사소하지만 재발 방지 관점에서 정정할 가치가 있다.

## 위험도

LOW
