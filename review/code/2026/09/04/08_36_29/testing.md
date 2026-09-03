# 테스트(Testing) 리뷰

## 검증 절차

- `codebase/backend`에서 `npx jest src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 직접
  실행 → **31/31 GREEN** (읽기 전용, 저장소 파일 뮤테이션 없음. `git status --short` 로 확인).
- 신규 테스트 2건(`372~415` 관계끼리 충돌 / `417~444` `@Column`+관계 혼재)의 소스를 직접 열어
  이전 라운드(`08_18_51`) RESOLUTION.md 가 주장한 "INFO#2 수정(`findStaleSpecCasts` 단언 추가)"이
  실제로 반영됐는지 대조 — **반영 확인**. 두 테스트 모두 `b.spec.ts` fixture + `findStaleSpecCasts`
  단언을 갖는다(현재 소스 `417~441`).
- `nullable-type-lie-cast-guard.ts` 의 `WIDENED_DECL` 정규식(`168~169`)과
  `grep -n OneToOne src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 결과를 대조 —
  `@OneToOne` 은 docstring 문구(게이트 376)에만 등장하고 실제 fixture 는 여전히 없음.

## 발견사항

- **[INFO]** `@OneToOne` 분기는 이번에도 fixture 로 검증되지 않는다 — 이전 라운드(1R) 3개
  reviewer(requirement/documentation/testing)가 동일하게 지적했고 RESOLUTION.md 가 "저장소에
  `@OneToOne` 실충돌 0건이라 픽스처를 만들면 실재하지 않는 형태를 고정하게 된다"는 근거로
  명시적으로 유예했다. 이번 라운드에서 재확인해도 그 전제(실충돌 0건, `WIDENED_DECL` 세 번째
  alternation 미검증)는 그대로 유효하다 — 유예 판단을 뒤집을 근거 없음.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:372-376`
    (docstring 이 `@OneToOne` 언급), 신규 테스트 `:387`·`:417` (둘 다 `@ManyToOne` 만 사용)
  - 상세: 저장소 전수 `grep`으로도 `@OneToOne` fixture 가 이 파일에 전무함을 재확인했다. 기능적
    결함이 아니라 완결성 갭이며, 실재 사례가 생기기 전까지는 캐너리를 만들 대상 자체가 없다.
  - 제안: 조치 불요(이미 3회 검토·유예 확정). `@OneToOne` 충돌이 저장소에 생기면 그때
    `it.each` 로 추가한다는 plan 의 방침을 유지.

- **[INFO, 확인 완료 — 결함 아님]** 이전 라운드(1R) INFO#2 — 두 번째 신규 대조군이 형제 테스트
  대비 `findStaleSpecCasts` 검증을 생략했던 비대칭 — 이번 diff 에서 이미 수정 반영됨을 직접
  소스 대조로 확인했다.
  - 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts:434-441`
    (`b.spec.ts` fixture + `findStaleSpecCasts([...], w)).toHaveLength(0)` 단언 존재)
  - 상세: RESOLUTION.md(`review/code/2026/09/04/08_18_51/RESOLUTION.md`)가 "새 단언은 확실히
    문다"고 주장한 것을, 이 단언을 없애는 방향 뮤테이션 없이도 정적 대조로 재확인했다 — 세
    대조군(`userId`/`target`/`mixed`) 모두 `widenedEntityFields` → `findStaleSpecCasts` 2단계를
    동일하게 검증하는 구조로 수렴했다.
  - 제안: 없음 — 조치 완료 확인.

- **[INFO]** 뮤테이션 근거("충돌 배제 제거 시 3건 RED / 관계 데코레이터만 `WIDENED_DECL`에서
  빼면 2건 RED")는 이번 라운드에서 내가 직접 재현하지 않았다 — 이전 라운드 requirement
  reviewer 가 실제 저장소 파일 뮤테이션(`cp` 백업 후 원복, `git show HEAD:<path>` 대조로 원복
  검증)으로 이미 두 수치를 독립 재현·확인했고(RESOLUTION.md·requirement.md 교차 일치), 같은
  세션에서 병렬 충돌 사고(백업 오염)까지 투명하게 기록·원복 완료된 상태다. 이번 라운드에서
  재현을 반복하면 다른 fan-out reviewer 와의 워크트리 충돌 위험만 추가되고 새 정보는 없다고
  판단해 재현하지 않았다.
  - 위치: `plan/in-progress/entity-nullable-column-type-mismatch.md:241-243`
  - 제안: 없음 — 이미 독립 재현·교차검증된 수치이므로 이번 라운드의 재검증은 불요.

## 회귀 · 격리 · 테스트 용이성 (문제 없음, 확인 완료)

- **회귀**: 기존 29개 테스트 + 신규 2건 = 31/31 GREEN. 새 테스트가 기존 테스트의 순서·상태에
  의존하지 않는다(각 `it` 가 독립적으로 `withFiles` 호출).
- **격리**: `withFiles` 헬퍼가 `mkdtempSync` 로 테스트별 격리된 tmpdir 을 만들고
  `try/finally` 로 항상 정리한다 — 두 신규 테스트도 동일 패턴을 그대로 재사용해 전역 상태·
  파일시스템 잔존이 없다.
- **Mock 적절성**: mock/stub 없음 — `widenedEntityFields`/`findStaleSpecCasts` 순수 함수를
  합성 fixture 로 직접 호출한다. 실제 동작과의 괴리 없음.
- **테스트 용이성**: 대상 함수가 파일 경로 배열을 인자로 받는 순수 함수라 의존성 주입 없이도
  테스트가 쉽다 — 구조적 문제 없음.
- **가독성**: `[대조군]` 접두사로 "버그 수정이 아니라 정상 동작 고정"이라는 의도를 테스트
  이름에서부터 드러내고, docstring 이 왜 필요한지(리뷰 10R INFO#12)·저장소 실재 근거(3건)·
  뮤테이션 결과를 함께 적어 다음 독자가 맥락을 재구성할 필요가 없다.

## 요약

이번 라운드의 diff 는 이전 리뷰(1R, `08_18_51`)가 지적한 유일한 실질 갭(INFO#2, 검증 깊이
비대칭)을 정확히 그 자리만 고쳐 반영했음을 직접 소스 대조로 확인했다 — 세 대조군
(`userId`/`target`/`mixed`) 모두 이제 `widenedEntityFields`→`findStaleSpecCasts` 2단계 검증으로
수렴한다. 남은 유일한 갭인 `@OneToOne` 미검증은 이미 3라운드에 걸쳐 검토되고 "실재 사례 0건"
근거로 일관되게 유예된 낮은 우선순위 항목이라 이번에도 유지하는 것이 타당하다. 새 테스트는
기존 `withFiles` tmpdir 격리 패턴을 재사용해 격리·정리가 보장되고, mock 없이 순수 함수를
직접 검증하며, 31/31 GREEN 으로 회귀가 없음을 직접 실행으로 재확인했다. Critical/Warning 없음.

## 위험도

LOW
