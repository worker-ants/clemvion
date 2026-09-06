# 유지보수성(Maintainability) 리뷰

## 검토 범위 메모

`origin/main...HEAD` 는 이미 9차례의 `/ai-review` 라운드(`10_13_22`→`14_59_48`)를 거친
`User` 컬럼 노출 방어 3축(`user-entity-exposure-guard.ts`/`dto-jsdoc-citation-guard.ts`/
`user-secret-absence.ts`)과, 그 라운드들이 지적한 매직값·JSDoc orphan·검출력 0건·fixture
경로 중복·e2e 라벨 충돌·`it.each` 중복 호출 등을 실제 파일을 열어 재확인했다 — 전부
반영되어 재발이 없다.

- `dto-jsdoc-citation.spec.ts`: `CITATION_FIXTURE` 상수로 통합돼 `13_39_20` WARNING(경로
  3곳 인라인 중복) 해소.
- `user-entity-exposure-guard.ts`: `findEagerUserRelations`/`collectUserRelationNames`
  각각 제 위치에 JSDoc 이 붙어 `11_55_36` WARNING(orphan JSDoc) 해소.
- `workspace-rbac.e2e-spec.ts`/`workflow-crud.e2e-spec.ts`: 라벨이 `J.`/`H.` 로 유일하고
  순서대로다 — `10_13_22` WARNING(라벨 충돌) 해소.
- `triggers.service.spec.ts`: `it.each` 블록이 `const rejected = call();` 로 프라미스를
  한 번만 만들어 재사용 — 직전(`14_59_48`) INFO(같은 호출 두 번 실행) 해소.

이번 라운드에서 새로 검토할 것은 직전(`14_59_48`) 라운드 **이후** 추가된 최신 커밋
`0fd4d2f29`(15:30:50) 뿐이다 — `common/db/pg-error.ts` 에 `pgErrorConstraint` 신설(+
`pg-error.spec.ts` 신설), `triggers.service.ts`/`.spec.ts` 가 손으로 짠 duck-typing 을 그
SoT 호출로 교체, `review_guard.py` 의 인용 스칼라 트레일링 주석 처리(+ 회귀 테스트 3건),
`user-secret-absence.spec.ts` 에 엔티티 대조 테스트(패턴 부분집합 + 컬럼 수 카나리아) 신설,
`workspaces.service.spec.ts` 에 `listMembers` 수동 투영 단위 테스트 2건 신설로 구성된다.
저장소에 뮤테이션은 가하지 않았다(`git status --short` — 세션 산출물 디렉터리만 untracked,
확인 완료).

## 발견사항

새로 지적할 결함을 찾지 못했다. 이번 커밋이 다루는 두 가지 결함 클래스 모두 근본 처방
쪽으로 정리됐다:

- **PG 에러 duck-typing 4번째 사본** — `isEndpointPathUniqueViolation` 이 `pg-error.ts` 의
  기존 SoT(`pgErrorCode`)를 재사용하지 않고 손으로 다시 짰던 것을, 그 SoT 에
  `pgErrorConstraint` 를 추가하는 방향으로 되돌렸다. 이제 `TriggersService` 는 필드
  추출 로직을 갖지 않고 이름(인덱스명) 비교만 한다 — 새 코드가 새 사본을 늘리지 않고
  기존 단일 진실로 수렴한 것으로 판단한다.
- **YAML 파서 트레일링 주석 3연속 협소화** — 줄 전체 주석 → 트레일링 주석 → 인용 스칼라
  순으로 세 번에 걸쳐 닫혔는데, 이번 판은 인용 부호 안/밖을 명시적으로 갈라 처리하고
  반대 방향 대조군(따옴표 안의 `#`·미종료 따옴표)을 테스트로 고정해, 다음 형태가 나와도
  최소한 이 세 형태의 회귀는 재현되지 않게 했다.

## 요약

이번 라운드에서 실질적으로 새로 검토할 코드는 소량(diff 약 200줄)이며, 전부 이 브랜치
전체를 관통하는 패턴 — 함수명이 역할을 정확히 말하고, 매직 값 대신 이름 있는 상수로
고정하며, "왜 이 형태인가"·"왜 이전 시도가 부족했는가"를 실측과 함께 인접 주석에 남기는
패턴을 유지한다. 특히 이번 커밋은 스스로 만든 결함(SoT 우회 사본, 파서 협소화)을 다음
라운드로 미루지 않고 같은 턴에서 근본 처방으로 되돌렸다는 점이 눈에 띈다 — 예를 들어
`pgErrorConstraint` 신설로 필드 추출 로직이 한 곳(`pg-error.ts`)에만 남았고, `triggers`
쪽 테스트는 `driverError`/top-level 두 wrap 표면을 `surface` 매개변수로 각각 관측 가능하게
만들어 "한쪽 표면만 보고 초록이었다"는 재발 형태를 구조적으로 막는다. 함수 길이·중첩
깊이·중복 코드·네이밍 일관성 모두 통상 수준이며 새로 지적할 만한 결함은 찾지 못했다.

## 위험도

LOW
