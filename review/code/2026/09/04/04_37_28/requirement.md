# 요구사항(Requirement) 리뷰 — `repo-guards` walker 통합 + 낡은 spec 캐스트 가드 (9R)

## 검증 방법

이 changeset 은 이미 8라운드 리뷰-수정 루프(`01_49_18`~`04_18_01`)를 거친 최종 상태다.
과거 라운드의 서술을 그대로 믿지 않고, 현재 저장소의 실제 코드를 직접 열어 핵심 주장을
재확인했다:

- `nullable-type-lie-cast-guard.ts` — `findUntypedNullableColumns`(:104-121)과
  `widenedEntityFields`(:192-205) 양쪽이 모두 `isNullableType()`(:185-190, `split('|')` 기반)을
  쓰는 것을 직접 확인 — 8R WARNING("자매 중 하나만 하드닝")이 실제로 반영돼 있다.
  `widenedEntityFields` 의 동명 충돌 제거 로직(`for (const f of nonNull) widened.delete(f);`,
  :203)도 그대로 있다 — 2R W1(엔티티 비귀속 오탐)의 수정이 유지됨.
- `source-scan.ts` — `stripLiterals`(:77-82)와 `countCalls`(:90-93)이 각자 자신의 JSDoc을
  정확히 갖고 있다(1R W4, 7R JSDoc orphan 회귀 없음).
- 대상 스위트 3개(`source-scan.spec.ts`·`nullable-type-lie-cast.spec.ts`·
  `masked-reject-callers.spec.ts`)를 직접 재실행 — **80/80 PASS**.
- 8개 파일 전수 `grep -n 'TODO\|FIXME\|HACK\|XXX'` — **0건**.
- `.github/workflows/backend-checks.yml` 이 `paths:` 필터 없이(의도적으로) 전 PR 에서 돈다는
  spec docstring(`nullable-type-lie-cast.spec.ts:15-20`)의 주장을 워크플로 파일에서 직접 확인.

## 발견사항

- **[WARNING]** plan 체크박스가 이 diff 가 신설한 가드로 이미 닫힌 항목을 여전히 미완료로 표시한다 — 이 plan 문서가 스스로 "여섯 번 반복했다" 고 적은 바로 그 실패 모드의 일곱 번째 사례
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:491`(`- [ ] **가드 사각지대 — `.spec.ts` 의 낡은 캐스트**`, 배치 2 리뷰 W2·W3 항목), 대조: `:264`(`- [x] **후속 — 넓혀진 필드를 겨눈 낡은 `.spec.ts` 캐스트 가드** — **완료.**`)
  - 상세: `:491` 항목은 "가드(`findCastOffenders`)가 `.spec.ts` 를 의도적으로 제외해서, 넓혀진
    필드를 겨눈 낡은 캐스트를 구조적으로 못 본다"는 배치 2 리뷰 지적을 추적한다. 그 본문은
    "배치가 끝날 때마다 `grep 'as unknown as' --include='*.spec.ts'` 로 훑는 것이 현실적이다"
    라고 **수동 워크어라운드**를 처방하고, 인용 블록(`:498-505`, `git blame` 확인 —
    2026-09-03 19:41, 이 diff 이전 커밋 `562d3119f9`)은 "배치 3 에서 수행"했다고 적는다.
    그런데 바로 이 diff(커밋 `46f4645833`, `git blame` 확인 — 2026-09-04 01:47)가 추가한
    `:264` 항목은 **바로 그 구조적 사각지대를 영구히 닫는 자동 가드**
    (`widenedEntityFields`+`findStaleSpecCasts`, CI 에 상시 배선)다. `:264` 가 이미 완료로
    체크됐고, `:511`(`배치 3 기준 — "잔여 전량"으로 확정... 축 종결`)이 배치가 더 없음을
    확정한 이상, `:491` 이 처방한 "배치가 끝날 때마다 수동으로 훑는다"는 워크플로 자체가
    이제 무의미하다 — 자동 가드가 매 CI 실행마다 그 일을 대신한다. 즉 `:491` 의 근본 우려
    ("가드가 구조적으로 못 본다")는 이 diff 로 실질적으로 해소됐는데 체크박스만 갱신되지
    않았다. 이 plan 문서 자신이 `:289-330`("한 자리만 고치는 버릇 — 이 plan 에서 여섯 번
    반복했다")에서 정확히 이 형태의 결함(어떤 조치가 다른 자리의 서술/상태를 stale 하게
    만드는데 그 자리를 안 고친다)을 여섯 번 나열하며 "절차로 바꾼다: 서술을 고칠 때는 그
    문구를 grep 해서 나온 전부를 고친다"고 스스로 규칙을 세웠는데, 이번이 (문서화되지 않은)
    일곱 번째 사례다. 8라운드의 리뷰 어느 곳도 이 특정 체크박스 불일치를 잡지 못했다.
  - 제안: `:491` 을 `[x]` 로 전환하고, 짧은 후기를 덧붙여 "구조적 사각지대는 수동 배치말
    훑기가 아니라 `:264` 의 자동 가드(`findStaleSpecCasts`)로 최종 닫혔다"는 것을 명시한다.
    코드 변경은 불필요 — plan 문서 1줄 + 후기 정도의 소정정.

- **[INFO]** 이 diff 가 구현하는 두 후속 항목(walker 통합, 신규 spec-cast 가드)을 직접
  규정하는 `spec/` 본문은 없다
  - 위치: `spec/conventions/raw-query-results.md:7`(코드 링크로만 `source-scan.ts` 참조,
    `countRawUpdateReturning` 축 — 이번 diff 로 안 바뀜), `spec/4-nodes/7-trigger/
    1-manual-trigger.md:201`·`spec/5-system/14-external-interaction-api.md:1591`
    (둘 다 `masked-reject-callers-guard.ts` 를 "이 규칙을 강제하는 가드" 로 인용만 함,
    동작 서술 없음)
  - 상세: 세 문서 모두 이 가드 파일들을 **증거 링크**로만 인용하고, walker 구현 방식이나
    `collectTsFiles`/`widenedEntityFields`/`findStaleSpecCasts` 의 판정 규칙 자체를 규정하지
    않는다. 이번 diff 는 세 참조 지점의 인용 대상 파일 경로·존재 여부를 바꾸지 않았다
    (grep 으로 직접 확인). 내부 CI 정적 가드/테스트 인프라 리팩터라 spec 회색지대이며
    spec fidelity 위반은 아니다.
  - 제안: 조치 불필요.

- **[INFO]** plan 문서의 다른 두 `planner 턴` 대기 항목은 이번 diff 범위 밖으로 올바르게
  미완료 유지돼 있다
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:182`(`spec/1-data-model.md
    §2.9 next_run_at` 표기 정정), `:190`(`2-api-convention.md §2.2` `/api/auth/*` 예외 조항),
    `:233`(§5.4 `field?:` 표기 정정)
  - 상세: 셋 다 developer 권한 밖(spec 본문 변경 필요) 항목이라 `[ ]` 로 남아 있고, 이번 diff
    는 그 서술을 건드리지 않았다. `spec_impact` frontmatter(`:6-9`)에도 대응 문서가 이미
    등재돼 있어 `complete/` 이동 시 Gate C 가 이 항목들을 놓치지 않는다.
  - 제안: 조치 불필요.

## 요약

핵심 로직 — `collectTsFiles` 로의 walker 5-사본 통합, `widenedEntityFields`/
`findStaleSpecCasts` 신설, 그리고 8라운드에 걸쳐 지적된 항목(정렬 회귀 커버리지·
`stripLiterals` 무테스트·픽스처 헬퍼 중복·JSDoc orphan·엔티티 비귀속 오탐·표기 변형
위음성·자매 함수 비대칭 하드닝)의 수정 — 을 코드에서 직접 열어 재확인했고 전부 반영돼 있다.
대상 스위트 80/80 PASS, TODO/FIXME 류 미완성 표식 0건, 모든 신규 함수가 모든 경로에서
적절한 값(빈 Set/배열 포함)을 반환한다. 이 변경 영역을 직접 규정하는 `spec/` 문서는 없어
spec fidelity 위반도 없다(회색지대, INFO). 유일한 신규 발견은 코드가 아니라 plan 문서의
체크박스 동기화 결함이다 — 이번 diff 가 `:264` 에서 신설한 자동 가드가 `:491` 이 추적하던
"가드 구조적 사각지대"를 실질적으로 영구히 닫았는데도 `:491` 체크박스는 갱신되지 않았다.
이 plan 문서 자신이 "한 자리만 고치는 버릇"을 여섯 차례 자기반성으로 기록해 온 문서라는
점에서 사소하지 않은 반복이지만, 코드 동작에는 영향이 없고 조치는 plan 문서 1줄 수준이다.

## 위험도

LOW
