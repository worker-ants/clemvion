# 요구사항(Requirement) 리뷰 — `repo-guards` walker 통합 + 낡은 spec 캐스트 가드 (3R, 최종 확인)

## 검증 방법

이 diff 는 같은 작업의 1R(`01_49_18`)·2R(`02_12_38`) 리뷰가 이미 지적한 항목의 fix 를 포함한
최종 상태다. 과거 라운드의 서술을 그대로 믿지 않고, 두 핵심 fix 주장을 저장소에서 직접
재현했다(저장소 트리에는 아무 것도 남기지 않음 — 매 단계 뒤 `cp` 원복 + `git status --short`
로 확인):

- **1R W1 fix 재검증** — `source-scan.ts:270`(`return out.sort();`)를 `return out;`로 뮤테이션 →
  `source-scan.spec.ts` **2 failed**(`nested-sibling.ts` 픽스처가 DFS/정렬 순서 차이를 실제로
  관측). RESOLUTION 이 적은 "예측 RED, 실측 2 failed" 와 **일치**. 원복 확인.
- **2R W1 fix 재검증** — `nullable-type-lie-cast-guard.ts` 의 동명 충돌 제거 루프
  (`for (const f of nonNull) widened.delete(f);`)를 삭제 → `nullable-type-lie-cast.spec.ts`
  의 `[대조군] 다른 엔티티에서 non-null 인 동명 필드는 판정에서 뺀다` 가 **1 failed / 22
  passed**로 RED. RESOLUTION 이 적은 "예측 RED, 실측 1 failed / 22 passed" 와 **일치**. 원복
  확인.
- **plan 문서의 수치 주장 재검증** — 임시 spec(`_tmp-verify.spec.ts`, 실행 후 삭제)으로
  `widenedEntityFields(entities)` 를 저장소 전수에 직접 돌려 `size === 115` 확인 — plan
  "판정 대상 135 → **115**" 와 **일치**.
- 전체 스위트 재실행: `source-scan` 34, `nullable-type-lie-cast` 23,
  `audit-action-binding`/`engine-error-code-anchor`/`masked-reject-callers`/
  `redis-fail-open-catalog` 4개 합쳐 57 — **전부 PASS**.
- `tsc --noEmit` 대상 8개 파일 관련 에러 0.
- `grep -rn 'TODO\|FIXME\|HACK\|XXX'` 대상 8개 파일 — 0건.
- `grep -n 'fs\.' ` 로 4개 소비 가드의 `fs` import 잔존이 실제 사용과 일치하는지 확인
  (`audit-action-binding-guard.ts` 는 `fs` import 자체가 제거돼 있고 실제로 미사용).

## 발견사항

- **[INFO]** `WIDENED_DECL` 은 추가 데코레이터를 최대 1개까지만 허용한다(`?` 이지 `*` 가
  아니다) — 1R·2R 에서 이미 3명의 리뷰어가 공통 지적했고 docstring 에 한계로 명시돼 있다.
  이번 라운드에도 저장소 전수에 2단 이상 스택된 조합은 없다(기존 실측 유지, 방향은
  위음성이라 무해). 코드 변경 불필요 — 문서화된 알려진 한계.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:162-163`
    (`WIDENED_DECL` 정의)

- **[INFO]** 이 diff 가 구현하는 두 후속 항목(`collectTsFiles` 통합, `widenedEntityFields`/
  `findStaleSpecCasts` 신설)을 직접 규정하는 `spec/` 본문은 없다. `spec/conventions/
  raw-query-results.md:7` 이 `source-scan.ts` 를 spec-impl-evidence 코드 링크로만 참조하고
  (`countRawUpdateReturning` 축, 이번 diff 로 안 바뀜), `1-manual-trigger.md`/
  `14-external-interaction-api.md` 는 `masked-reject-callers-guard.ts` 를 동작 서술 없이
  참조만 한다. 내부 CI 정적 가드/테스트 인프라라 spec 회색지대이며 spec fidelity 위반은
  아니다.

- **[INFO]** plan 문서(`entity-nullable-column-type-mismatch.md`)의 두 개 별도 후속 항목
  (`spec/1-data-model.md §2.9 next_run_at` 표기 정정, `2-api-convention.md §2.2` `/api/auth/*`
  예외 조항)은 이번 diff 범위 밖으로 올바르게 `[ ]`(미완료·planner 턴 대기)로 유지돼 있다 —
  developer 권한 밖 항목을 developer 가 임의로 완료 처리하지 않은 것은 올바른 처분이다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:182-194,233-242`

## 요약

이번 diff 는 `plan/in-progress/entity-nullable-column-type-mismatch.md` 에 등재된 두 후속
항목(① `repo-guards/__tests__/` 5개 walker 사본을 `common/__test-utils__/source-scan.ts` 의
`collectTsFiles(root, { includeSpec })` 하나로 통합, ② `| null` 로 넓혀진 엔티티 필드를 겨눈
`.spec.ts` 의 낡은 `null as unknown as` 캐스트를 잡는 `widenedEntityFields`/
`findStaleSpecCasts` 신설)을 완결한 최종 상태다. 앞선 두 라운드(1R·2R)가 지적한 W1~W4
전부 — "sort() 회귀를 이 환경에서 원리적으로 못 잡는다"던 반증된 docstring 단언, `stripLiterals`
무테스트, `withFiles`/`withFixture` 중복, JSDoc orphan, 그리고 가장 심각했던 2R W1(필드
이름만으로 판정해 서로 다른 엔티티의 동명 충돌에서 정당한 캐스트를 오탐하는 실패 모드 재도입)
— 이 현재 코드에 실제로 반영돼 있음을 재현 뮤테이션으로 직접 확인했다: `sort()` 제거 시 RED
2건, 충돌 제거 로직 삭제 시 RED 1건(예측과 정확히 일치), plan 이 주장하는 "판정 대상 135 →
115" 도 저장소에서 직접 재현해 일치를 확인했다. 새 함수들은 모든 경로에서 적절한 값(빈
Set/배열 포함)을 반환하고, 에러 시나리오는 정적 스캐너 성격상 파일시스템 예외를 그대로
전파하는 것으로 충분하며, TODO/FIXME 류 미완성 표식은 없다. 이 변경 영역을 직접 규정하는
`spec/` 문서가 없어 spec fidelity 위반도 없다(회색지대, INFO). CRITICAL/WARNING 급 결함은
발견되지 않았다 — 이전 라운드에서 이미 처분됐던 저위험 INFO(데코레이터 스택 1개 한계) 하나만
그대로 남아 있고, 이는 위음성 방향의 알려진 한계로 이미 docstring 에 정확히 문서화돼 있다.

## 위험도

NONE
