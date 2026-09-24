# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** `CHANGELOG.md`에 이번 PR과 무관한 다른(이미 머지된) PR(`#1387`)의 백필 항목이 같은 커밋(`d644263cd`)에 동봉됨
  - 위치: `CHANGELOG.md:28-47` (`## Unreleased — jest 가 ESM 의존성을 네이티브로 로드한다 (#1387 CHANGELOG 누락 backfill)`)
  - 상세: 이 PR의 목적은 `pending_plans` 가드가 「plan 인가」를 검사하게 하는 것이다(`plan/in-progress/pending-plan-is-plan.md` 제목). 그런데 같은 커밋이 `CHANGELOG.md`에 **완전히 다른, 이미 origin/main에 머지된** `#1387`(jest ESM 네이티브 로드, `0b5b226b3`)의 CHANGELOG 누락을 소급 기재하는 두 번째 `## Unreleased` 섹션을 추가한다. `RESOLUTION.md`(§W2)에 따르면 이 PR 자체의 리뷰 라운드 1에서 "이 가드 변경의 CHANGELOG가 없다"(Warning 2)를 지적받았고, 그 판정 기준을 다시 세우다가 `#1387`이 "143개 항목이 전부 제품 동작 변경"이라는 틀린 전제로 CHANGELOG를 건너뛰었음을 재발견해 여기서 함께 백필했다. 인과관계는 이해되지만, 결과적으로 **다른 PR의 코드 변경(jest 설정·`esm-native-load.spec.ts`)에 대한 문서 부채를, 그 코드를 전혀 건드리지 않는 이 PR의 diff 안에서** 갚는 형태다. `git blame`/`git log -S`로 `#1387`의 실제 동작을 추적하는 사람은 이 커밋(`pending_plans` 가드 PR)에서 그 설명을 찾게 된다.
  - 제안: 이번 PR을 막을 사안은 아니다 — 이 저장소는 "CHANGELOG 누락 발견 시 그 턴에 백필"을 명시적 관행으로 삼고 있고(선례 `#1373`, 사용자 메모 "CHANGELOG 항목은 수정의 일부다"), 발견 경위도 RESOLUTION.md에 투명하게 기록돼 있다. 다만 두 관심사(이 PR 자체의 CHANGELOG + 남의 PR 백필)를 한 커밋에 묶기보다, 별도의 `docs(changelog): #1387 backfill` 커밋으로 분리했다면 `git log`/리뷰 히스토리에서 두 변경의 소속이 더 명확했을 것이다.

- **[INFO]** (round 1에서 이미 검토·수렴됨, 재확인만) `plan/in-progress/spec-draft-nullable-notation-followups.md`에 핵심 수정과 무관한 트래커 항목(`0-common.md` 6개의 `id: common` 중복, planner 위임)이 여전히 포함돼 있음
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (diff 후반부, `- [ ] **spec/4-nodes/*/0-common.md 6개가 전부 id: common …**`)
  - 상세: round 1 scope 리뷰(`review/code/2026/09/24/19_57_00/scope.md`)가 동일 항목을 이미 INFO로 검토했고, `--impl-prep` Warning 등재 의무 이행이라는 절차적 근거로 조치 불요 판정이 났다(`RESOLUTION.md` INFO 6과 일치). 이번 라운드에서 새로 추가된 내용은 아니므로 재지적하지 않고 기록만 남긴다.
  - 제안: 조치 불요.

## 핵심 변경 평가

`codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`(신규 `isPendingPlanPath` 순수 함수, 라인 85-105 추가), `spec-frontmatter-parse.test.ts`(import 확장 + 신규 `describe` 블록), `spec-pending-plan-existence.test.ts`(헤더 주석 갱신 + 신규 `it` 블록)는 round 1에서 이미 "순수 가산적 diff, 목적에 정확히 부합"으로 검증됐고, 이번 라운드의 추가 diff(`d644263cd`, `0dd160297`)는 이 세 파일을 전혀 건드리지 않는다 — SoT 절 인용 정정(`§3`→`§2.1`)은 이 세 파일의 **주석 문자열**에만 적용됐고 로직 변경은 없다.

`review/code/2026/09/24/19_57_00/**`(RESOLUTION.md·SUMMARY.md·14개 reviewer 산출물·retry_state.json)와 `review/consistency/2026/09/24/19_35_41/**`는 각각 이 저장소의 표준 리뷰/consistency-check 워크플로 산출물이며(`CLAUDE.md` "코드 리뷰 산출물" 표, `review/**`는 developer 쓰기 권한), round 1 scope 리뷰가 이미 "절차적 산출물, 스코프 이탈 아님"으로 판정한 범위와 동일하다.

`git diff --stat origin/main...HEAD`(32개 파일, +1616/-18)와 프롬프트에 제시된 파일 목록이 정확히 일치함을 확인했다 — 프롬프트 밖의 숨은 변경은 없다.

## 요약

핵심 기능 변경(`isPendingPlanPath` 술어 신설 3파일)은 이번 라운드에서 추가로 손대지 않았고 목적에 정확히 부합한 상태를 유지한다. 이번 라운드(round 2)에서 새로 편입된 내용 중 가장 눈에 띄는 스코프 사안은 `CHANGELOG.md`에 이 PR과 무관한 이미 머지된 `#1387`의 CHANGELOG 백필 항목이 같은 커밋에 동봉된 것이다 — 저장소 관행(누락 발견 시 그 턴에 백필)과 투명한 문서화(RESOLUTION.md §W2)로 뒷받침되지만, 순수하게 "이 PR의 diff에 다른 PR의 문서 부채가 섞여 있다"는 사실 자체는 스코프 관점의 정당한 지적이다. 그 외 나머지 신규 파일(리뷰 산출물, consistency-check 산출물, plan 문서)은 절차적 요구사항이며 임의의 기능 확장·무관한 리팩토링·포맷팅 혼입은 발견되지 않았다.

## 위험도

LOW
