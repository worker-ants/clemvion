# 문서화(Documentation) 리뷰

## 검증 방법

- `spec/conventions/spec-impl-evidence.md` §2.1 `pending_plans` 행을 직접 Read 로 대조 — 이전
  라운드(`19_57_00`)가 지적한 §3→§2.1 오인용 WARNING 이 실제로 정정됐는지 확인.
- `grep -rn "pending_plans" ... | grep "§3"` 로 4개 코드/plan 파일 전수 재검사 — 잔여 오인용 0건.
- `npx vitest run` 으로 `spec-frontmatter-parse.test.ts`·`spec-pending-plan-existence.test.ts` 를
  독립 실행해 plan 문서·CHANGELOG 가 주장하는 테스트 개수를 재현.
- `git show c288c7aaf:...` 로 최초 구현 커밋 시점의 테스트 개수를 별도로 재구성해 plan 체크리스트
  숫자의 출처(어느 시점 스냅샷인지)를 추적.

## 발견사항

- **[WARNING]** `plan/in-progress/pending-plan-is-plan.md` 의 테스트 개수 claim 이 stale —
  같은 커밋에서 다른 절은 고쳤는데 이 숫자는 안 고쳤다
  - 위치: `plan/in-progress/pending-plan-is-plan.md:76`, `:107` (`(원복 후 단위 13 통과 · 가드 55
    통과 ...)`, `- [x] 구현 → GREEN (단위 13 · 가드 55)`)
  - 상세: "단위 13"은 최초 구현 커밋(`c288c7aaf`) 시점의 스냅샷이다 — 그때
    `spec-frontmatter-parse.test.ts`는 기존 `isApplicable` 7개 + 신규 `isPendingPlanPath` 6개
    = 13개였다(`git show c288c7aaf:.../spec-frontmatter-parse.test.ts` 로 확인). 그런데 후속
    수정 커밋 `d644263cd`("SoT 절 인용 정정, CHANGELOG, 그리고 틀렸던 전제")가 리뷰
    INFO 3·4(비-string 방어, look-alike 캐너리)에 대응해 테스트 2개를 **같은 파일**에
    추가했고, `RESOLUTION.md`도 "새 단언 2개"로 정확히 기록했다. 그런데 `d644263cd`는
    **바로 이 plan 파일의 19·88행**(§2.1 인용 정정)도 손댔으면서 76·107행의 "단위 13"은
    갱신하지 않았다. 실측 결과 현재 `spec-frontmatter-parse.test.ts`는 15개(`npx vitest run` →
    `Tests 15 passed (15)`), 가드 파일 55개(`Tests 55 passed (55)`)로 **합 70**이다 — plan
    문서가 여전히 주장하는 "13+55=68"과 어긋난다. (참고: 직전 라운드 `19_57_00`의 여러
    리뷰어(`requirement.md`, `testing.md`)가 "68 tests passed" 로 이 숫자를 재현했는데, 그건
    그 리뷰 시점(수정 전 상태)엔 정확했다 — stale 이 된 건 그 이후 `d644263cd` 때문이다.)
  - 제안: 76·107행을 "단위 15 · 가드 55"(합 70)로 갱신하거나, 최소한 "(RESOLUTION 이후 비-string·
    look-alike 캐너리 2건 추가 — 현재 15)" 라는 각주를 달 것. 이 문서는 트래커 항목을 닫고
    `plan/complete/`로 이동할 예정인 **종결 기록**이라, 숫자가 stale 인 채로 굳으면 다음
    사람이 "이 PR 의 테스트 안전망 크기"를 실측보다 작게(2건 적게) 신뢰하게 된다 —
    이 PR 자체가 지적하는 "문서한 것이 실제보다 좁다/다르다" 클래스와 형태가 같다.

- **[INFO]** `CHANGELOG.md`의 "판별의 부담은 단위 테스트 15개가 진다"는 숫자는 현재 파일
  전체 테스트 수와는 일치하지만, 실제로 `isPendingPlanPath`의 회귀를 판별하는 테스트는 그중
  8개뿐이다
  - 위치: `CHANGELOG.md:25-26`
  - 상세: `spec-frontmatter-parse.test.ts`의 현재 테스트 15개 중 7개는 `isApplicable`
    테스트(이번 PR과 무관, 미변경)이고, `isPendingPlanPath`를 직접 판별하는 것은 8개뿐이다
    (plan 문서 §D의 M5 뮤테이션도 "단위 5 RED"라고만 언급해 8개 중 일부만 언급). "판별의
    부담은 단위 테스트 15개가 진다"는 문장은 파일의 총 테스트 수(15)와 우연히 일치하지만,
    그 15개 전부가 이 술어의 판별력에 기여하는 것은 아니다 — `isApplicable` 7개는
    `isPendingPlanPath`가 항상 `true`를 반환하는 뮤턴트가 들어와도 전혀 RED 가 되지 않는다.
  - 제안: 필수 수정 아님. 다음에 이 CHANGELOG 항목을 손볼 기회가 있으면 "단위 테스트
    15개"보다 "`isPendingPlanPath` 전용 단위 테스트 8개(파일 전체 15개 중)"처럼 구체화하면
    다음 사람이 안전망의 실제 범위를 오해하지 않는다.

## 참고 — 리뷰 중 관측한 일시적 상태 (조치 불요, 투명성 목적으로 기록)

리뷰 중 `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`를 처음 열람했을 때
`isPendingPlanPath`의 본문이 `return true;` 로 바뀌어 있었고(`npx vitest run`이 7건 실패로
재현됨), 이는 plan 문서 §D 가 기록한 M5 뮤턴트(술어가 항상 true)와 정확히 같은 형태였다.
직후 재확인(`git diff` → 빈 결과, 파일 내용 → 정상 구현으로 원복됨)한 결과 저장소는 현재
HEAD와 정확히 일치하며 워킹트리에 잔여 변경이 없다(`git status --short` 확인). 본 세션이
직접 만든 변경이 아니며, 병렬로 실행 중인 다른 reviewer 가 자신의 판별 뮤테이션 검증을
수행하다 지나간 것으로 보인다(프로토콜이 허용·경고하는 바로 그 상황). 코드 자체에 대한
조치는 불필요하지만, "관측한 이상 상태는 보고" 규약에 따라 기록한다.

## 요약

핵심 코드(`isPendingPlanPath` + 3개 테스트 파일)의 인라인 주석·SoT 인용은 직전 라운드가
지적한 §3→§2.1 오류가 5곳 모두 정확히 정정되어 현재 SoT(`spec-impl-evidence.md` §2.1)와
line-level 로 일치한다. CHANGELOG 항목도 사고·처방·회귀 검증을 잘 기록하고 있고, 이전
PR(`#1387`)의 CHANGELOG 백필도 거짓 전제를 인용문으로 투명하게 남겼다. 다만 plan 문서
`pending-plan-is-plan.md`의 테스트 개수 claim("단위 13 · 가드 55")이 같은 커밋에서 추가된
테스트 2건(비-string·look-alike 캐너리)을 반영하지 못해 stale 하며(실측 15+55=70), 이 문서가
곧 `plan/complete/`로 이동할 종결 기록이라는 점에서 갱신 가치가 있다. CHANGELOG의 "단위
테스트 15개" 표현도 무관한 기존 테스트까지 포함한 총계라 판별력을 다소 과장하지만
경미하다.

## 위험도

LOW
