# 테스트(Testing) 리뷰

이 diff 는 (a) `repo-guards/__tests__/` 5개 walker 사본을 `common/__test-utils__/source-scan.ts`
의 `collectTsFiles(root, { includeSpec })` 로 통합하고, (b) 그 위에 "넓혀진 nullable 필드를
겨눈 낡은 `.spec.ts` 캐스트" 새 가드(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한
것이다. 이미 4라운드 리뷰를 거친 상태라, 이번 라운드는 (i) 새로 크립한 갭이 있는지, (ii) 앞
라운드가 처방한 조치가 실제로 반영·유효한지를 직접 실행·뮤테이션으로 재검증하는 데 집중했다.

## 검증 방법 (직접 실행)

- `npx jest --testPathPatterns="(source-scan|audit-action-binding|engine-error-code-anchor|masked-reject-callers|nullable-type-lie-cast|redis-fail-open-catalog)"`
  → **6 suites / 117 tests 전부 PASS**
- `npx jest src/repo-guards` → **8 suites / 142 tests 전부 PASS** (4R RESOLUTION 수치와 일치)
- `grep -rn "20건" codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast*` →
  코드 쪽 히트 **0** (4R W1 이 고친 3자리가 실제로 반영됐음을 재확인. plan 문서의 남은 2개
  히트는 "4번이 났다"를 기술하는 이력 서술이라 정당함)
- **뮤테이션 직접 실행** (저장소 트리 안에서 원본을 scratch 로 `cp` 해 둔 뒤 수정 → 테스트 →
  `cp` 로 원복, `git status --short` 로 확인 완료 — 다른 reviewer 산출물 외 잔여물 없음):
  `widenedEntityFields` 의 동명-충돌 제거 줄(`for (const f of nonNull) widened.delete(f);`)을
  주석 처리하니 `[대조군] 다른 엔티티에서 non-null 인 동명 필드는 판정에서 뺀다` 테스트가
  정확히 그 자리에서 **RED**(`expect(w.has('userId')).toBe(false)` 실패)로 죽었다. RESOLUTION
  이 "탐지 능력을 뮤테이션으로 실증했다" 고 적은 주장을 내가 직접 재현해 확인했다 — 이 대조군
  테스트는 vacuous 하지 않다.

## 발견사항

- **[INFO]** (3라운드 연속 재확인, 기존 유예 결정 유지) `WIDENED_DECL` 의 "추가 데코레이터
  최대 1개" 한계에 pinning 테스트가 없다
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts:168-169`
    (`WIDENED_DECL` 정의) — 대응 테스트는
    `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:231` 부근
    (`@ManyToOne` + `@JoinColumn` 1개 추가 데코레이터 케이스만 존재, 2개 이상 스택 케이스 없음)
  - 상세: 이 파일의 다른 알려진 한계(`stripLiterals` 의 `${}` 중첩 백틱, `hasRawUpdateReturning`
    의 CTE 접두·2단 중첩 제네릭 등)는 전부 "고칠 버그가 아니라 경계" 로 **RED 방향 테스트로
    고정**하는 관례를 따르는데, `WIDENED_DECL` 의 데코레이터 2개 이상 스택 케이스만 docstring
    서술만 있고 그 관례를 따르지 않는다. 01_49_18·02_12_38·02_35_22 세 라운드에서 각각
    독립적으로 지적됐고, 매 라운드 "실피해 없음(저장소 전수에 그 형태 없음), 급하지 않음" 으로
    **의도적으로 유예**됐다 — 재개 트리거(그 조합이 실재하는 날)가 이미 명시돼 있다. 새 결함이
    아니라 기존 유예 결정을 재확인한 것이다.
  - 제안: 조치 불필요(이미 처분됨). 참고로만 남긴다.

## 회귀 확인

- 4라운드에 걸쳐 처리된 testing WARNING(정렬 회귀 커버리지 오판 · `stripLiterals` 무테스트 ·
  동명 필드 오탐 · "20건" 깨진 상호 참조) 전부 코드·테스트에 반영돼 있고, 이번 라운드의 직접
  실행에서도 회귀가 관측되지 않았다.
- `source-scan.ts` 의 모든 export(`stripComments`·`stripLiterals`·`countCalls`·
  `countRawUpdateReturning`/`hasRawUpdateReturning`·`countNullAsUnknownAsCasts`/
  `hasNullAsUnknownAsCast`·`collectTsFiles`)에 전용 양성/음성 테스트가 있다 — export 했는데
  무테스트인 비대칭은 없다.
- `collectTsFiles` 의 4개 필터 축(`.spec.ts` 포함/제외·`.d.ts` 배제·`node_modules`/`dist`
  skip·정렬)이 각각 독립적으로 단언돼 있고, 정렬 축은 `nested-sibling.ts` 픽스처로 DFS 순서와
  실제로 갈리게 만들어 판별력이 확보돼 있다(1R 이 반증한 "이 환경에서 원리적으로 못 잡는다"는
  거짓 주장이 픽스처 보강으로 올바르게 정정됐다).
- 4개 가드 파일(`audit-action-binding-guard.ts`·`engine-error-code-anchor-guard.ts`·
  `masked-reject-callers-guard.ts`·`redis-fail-open-catalog-guard.ts`)의 한 줄 래퍼는 별도
  단위 테스트가 없지만, 각 가드의 기존 spec 이 실제 저장소를 스캔해 end-to-end 로 그 래퍼를
  호출하므로(예: `masked-reject-callers.spec.ts` 의 캐너리 fixture 테스트가 `includeSpec: true`
  경로를 실제로 태운다) 사각지대는 아니다. 다만 실패 시 원인이 "래퍼 자체" 인지 "위임 대상
  `collectTsFiles`" 인지 진단 메시지가 즉시 구분해 주지는 않는다 — 이미 `collectTsFiles`
  자체의 전용 테스트가 충분해 실질적 위험은 낮다(조치 불필요 수준).
- `nullable-type-lie-cast.spec.ts` 의 "저장소 전수" 대조 테스트는 `[전제]` 단언
  (`entities.length > 30`, `specs.length > 300`, `widenedEntityFields(entities).size > 100`)을
  먼저 두어 스캔 대상이 비면 본 단언이 공허해지는 것을 막는다 — vacuous 하지 않다.
- 테스트 격리: `withFiles`/`withFixture`/`collectTsFiles` 테스트 전부 `os.tmpdir()` 에
  `mkdtempSync` 로 매번 새 디렉터리를 만들고 `try/finally` 로 정리한다. 실제 소스 트리를
  변형하는 이전 패턴(리뷰 이력에 적힌 "복원 실패 시 서비스 파일이 변조된 채 남는다" 문제)이
  이번 diff 에서 전부 걷혔다 — 병렬 실행·순서 무관 안전성이 확보돼 있다.

## 요약

이미 4라운드에 걸쳐 실질적 테스트 갭(정렬 회귀 오판·`stripLiterals` 무테스트·동명 필드
오탐·상호 참조 깨짐)이 전부 코드·테스트 양쪽에 반영됐고, 이번 라운드에서 직접 재실행
(6/117, 8/142 전부 GREEN)과 독립적인 뮤테이션 재현(동명-충돌 제거 로직을 무력화하니 대조군
테스트가 정확히 RED)으로 그 주장들이 실제로 유효함을 확인했다. 저장소 트리에는 검증 과정에서
일시적으로 한 파일만 수정했고 즉시 `cp` 로 원복해 `git status --short` 로 잔여물 없음을
확인했다. 새로 발견된 결함은 없으며, 유일하게 남은 항목(`WIDENED_DECL` 데코레이터 2개 이상
스택 케이스의 pinning 테스트 부재)은 세 라운드 연속 검토 끝에 이미 의도적으로 유예된 저위험
INFO 로, 이번에도 결론을 바꿀 근거가 없다.

## 위험도

LOW
