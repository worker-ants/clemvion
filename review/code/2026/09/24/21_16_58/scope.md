# 변경 범위(Scope) 리뷰 — docs-guard-trigger

## 검토 대상 요약

작업 의도(plan `plan/in-progress/docs-guard-trigger.md`): `.github/workflows/spec-link-checks.yml` 이
(1) `plan/**` 을 pathspec 에 추가하고, (2) 실행 커맨드를 `spec-link-integrity.test.ts` 단일 파일에서
`src/lib/docs/__tests__/` 디렉터리 전체로 넓혀, plan/spec 만 바꾼 PR 에서도 docs 가드 전부가 CI 에서
돌게 한다. 변경 파일은 총 11개: workflow 1 · `PROJECT.md` 1 · 신규 plan 1 · `/consistency-check
--impl-prep` 산출물 8(`review/consistency/2026/09/24/21_04_26/**`).

## 발견사항

- **[INFO]** `spec-link-checks.yml` 헤더에 12줄 분량의 신규 배경 주석 블록 추가
  - 위치: `.github/workflows/spec-link-checks.yml:18-29`
  - 상세: 2026-09-24 문단(«같은 갭의 셋째 판»)이 상당히 길다. 다만 같은 파일에 이미 2026-07·
    2026-08-27 자 동일 패턴의 히스토리 주석이 누적돼 있어(파일 자체의 기존 컨벤션), 이 저장소가
    "왜 이렇게 했는가" 를 헤더에 축적하는 방식을 이미 채택하고 있다. 새로 도입한 스타일이 아니라
    기존 컨벤션을 따른 것이므로 위반으로 보지 않는다.
  - 제안: 조치 불요 (기록용).

- **[INFO]** step `name:` 이 `spec-link-integrity guard` → `docs guards (src/lib/docs/__tests__ 전체)` 로 변경
  - 위치: `.github/workflows/spec-link-checks.yml:113` (구 `- name: spec-link-integrity guard`, 신규는 112-113행)
  - 상세: 표시용 step 이름이며 `test_workflow_yaml_structure.py` 가 고정하는 것은 **job id**
    (`spec-link-integrity`, 90행) 이지 step `name:` 이 아니다. `run:` 커맨드 자체가 단일 파일 → 디렉터리
    전체로 바뀌는 실질 변경과 짝지어진 이름 갱신이라 drive-by 리네이밍이 아니라 변경의 일부다.
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/2026/09/24/21_04_26/**` 8개 파일이 diff 에 포함
  - 위치: `review/consistency/2026/09/24/21_04_26/{SUMMARY,cross_spec,rationale_continuity,convention_compliance,plan_coherence,naming_collision}.md`, `meta.json`, `_retry_state.json`
  - 상세: CLAUDE.md 는 "developer 는 구현 착수 직전 `consistency-check --impl-prep` 의무" 라고 명시하고,
    그 산출물 저장 위치를 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 지정한다. 즉 이
    디렉터리는 스코프 외 부산물이 아니라 워크플로가 요구하는 필수 증적이며, plan 체크리스트에도
    해당 실행 결과가 인용돼 있다(`plan/in-progress/docs-guard-trigger.md` 체크리스트 79-83행).
    `meta.json` 의 `target_path` 가 저장소 밖 scratch 경로(`/private/tmp/.../prep-scope-2`)를 가리키는
    점은 흥미롭지만, 이는 이 checker 도구 자체의 부산물 포맷이지 이번 PR 이 스코프를 벗어났다는
    신호는 아니다.
  - 제안: 조치 불요.

- **[INFO]** `PROJECT.md` 의 문서 갱신은 처방된 것이지 자발적 확장이 아님
  - 위치: `PROJECT.md:378-388`
  - 상세: 이번 세션의 `/consistency-check --impl-prep` SUMMARY(`review/consistency/2026/09/24/21_04_26/SUMMARY.md`)가
    권장 조치 2번으로 "`spec-link-checks.yml` 변경과 같은 PR 에서 `PROJECT.md` §문서 링크 검증을
    디렉터리 전체 실행 기준으로 갱신" 을 명시적으로 요구했고, `PROJECT.md` diff 는 정확히 그 문구
    (가드 하나만 돈다 → docs 가드 전체가 돈다, 커맨드도 디렉터리 전체로 동기화)만 갱신한다. 인접
    서술(§검사 스코프 3가지, 자동 가드 표 등)은 건드리지 않아 스코프가 정확히 그 한 문단에 머문다.
  - 제안: 조치 불요.

의도 이상의 변경, 무관한 리팩토링/포맷팅, 기능 확장(over-engineering), 사용하지 않는 임포트, 의도치
않은 설정 변경은 발견되지 않았다. 변경된 파일 전부가 plan §B/§D 가 명시한 두 가지 처방
(pathspec 에 `plan/**` 추가, 가드 디렉터리 전체 실행)과 그로부터 직접 파생되는 문서 동기화·필수
워크플로 증적으로 좁게 묶여 있다.

## 요약

이 PR 은 plan 이 명시한 두 줄짜리 처방(`plan/**` pathspec 추가 + 디렉터리 전체 실행)에 정확히 대응하는
`.github/workflows/spec-link-checks.yml` 변경, 그 처방으로 stale 해지는 `PROJECT.md` 서술의 동기화,
필수 workflow 증적(plan 파일, `/consistency-check --impl-prep` 산출물)만 포함한다. 코멘트 블록이
다소 길지만 파일 자체의 기존 컨벤션과 일치하고, step 이름 변경은 실제 커맨드 변경과 짝지어져 있어
drive-by 가 아니다. 스코프 이탈, 불필요한 리팩토링, 기능 확장, 무관한 파일 수정은 관측되지 않았다.

## 위험도
NONE
