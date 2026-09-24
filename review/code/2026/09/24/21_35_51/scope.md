# 변경 범위(Scope) 리뷰 — docs-guard-trigger (2라운드, RESOLUTION 반영 후)

## 검토 대상 요약

plan(`plan/in-progress/docs-guard-trigger.md`)의 처방은 `.github/workflows/spec-link-checks.yml` 을
(1) `plan/**` 도 트리거하게 pathspec 을 넓히고, (2) 단일 테스트 파일 대신 `src/lib/docs/__tests__/`
디렉터리 전체를 돌리는 것 두 가지다. 1라운드 리뷰(`review/code/2026/09/24/21_16_58/`)가 WARNING 4건을
냈고, `RESOLUTION.md` 가 전부 조치했다고 기록한 커밋(`32b97f944`)까지 포함해 이번 diff 는 총 33개
파일이다: 핵심 워크플로/문서/plan/테스트 6개, 1라운드 review 산출물 18개, 이번 세션(21_04_26)
consistency-check 산출물 8개, 그리고 **이전에 이미 머지된 PR(#1389)의 산출물 1개**.

## 발견사항

- **[WARNING]** 이번 PR 의 diff 가 이미 머지된 별개 PR(#1389)의 영구 기록을 수정한다 — plan 에는
  이 수정이 전혀 선언되지 않음
  - 위치: `review/consistency/2026/09/24/20_34_01/meta.json:3-4` (게이트 기준 — `"mode"`·`"target_path"`
    값을 scratch 절대경로에서 저장소 상대경로로 정정하는 두 줄)
  - 상세: 이 파일은 `index 0d600f1b3..2c8154d65` — 신규 생성이 아니라 **기존 커밋 파일의 수정**이다.
    `git log` 상 `1a8ddca8b fix(docs-guard): pending_plans 가드가 「그게 plan 인가」를 묻는다 (#1389)`
    가 이미 `main` 에 머지돼 있고, `RESOLUTION.md`(Warning 1 조치란)가 스스로 밝히듯 이 파일은 그
    **다른, 이미 완결된 PR 의 `--impl-done` 세션 산출물**이다. 이번 작업의 plan 문서
    (`plan/in-progress/docs-guard-trigger.md`)는 워크플로 pathspec·실행범위 확장, `PROJECT.md` 갱신,
    회귀 테스트 추가만 처방했을 뿐 이 파일은 어디에도 언급하지 않는다 — 이 수정은 순전히 이번
    라운드의 리뷰-수정(`RESOLUTION.md` Warning 1) 과정에서 "같은 결함을 발견했으니 같이 고친다"는
    판단으로 끼워 넣은 것이다("같은 방식으로 좁혔으니 같은 결함이다").
  - 정정 자체(scratch 절대경로 → 저장소 상대경로, `scope_note` 로 사실 보존)는 합리적이고 위험한
    변경은 아니다 — 게이트가 보는 `--impl-done` 토큰은 그대로 유지됨을 확인했다고 적혀 있고, 값도
    투명하게 `scope_note` 로 남겼다. 다만 **이미 머지되어 닫힌 다른 PR 의 산출물을 현재 작업의 diff
    안에서 고치는 것**은 "docs 가드가 검사하는 데이터가 그 가드를 트리거하게 한다"는 이번 plan 이
    선언한 스코프 밖이며, 두 관심사(이번 CI 트리거 수정 vs. 과거 PR 산출물의 메타데이터 정정)를 한
    diff 에 섞는다. 리뷰어·머지 담당자가 이번 PR 의 변경 이유를 파악할 때 무관한 파일이 하나 끼어드는
    형태다.
  - 제안: 이 정정은 별도의 작은 커밋(또는 별도 PR)으로 분리해 "왜 #1389 의 산출물을 지금 고치는가"를
    그 자체의 커밋 메시지로 설명하는 편이 낫다. 이미 병합돼 이 세션에서는 되돌리기 어렵다면, 최소한
    `RESOLUTION.md`/커밋 메시지에 "이번 작업 스코프 밖의 부수 수정"이라고 명시해 다음 리뷰어가 무관한
    파일로 오인해 재조사하지 않도록 한다.

## 점검한 나머지 항목 (문제 없음)

- 워크플로 핵심 변경(`pathspecs` 에 `plan/**` 추가, `run:` 을 디렉터리 전체 실행으로 변경, 관련 헤더/스텝
  주석 갱신)은 plan §B/§D 가 명시한 처방과 정확히 일치한다.
- `.claude/tests/test_spec_link_checks_scope.py`(신규 회귀 테스트)는 이번 처방이 막으려는 정확히 그
  두 가지 결함 형태(`plan/**` 누락, 단일 파일 실행)만 좁게 단언하고, pathspec 파서는
  `test_harness_checks_paths_coverage.parse_pathspecs_block` 을 재구현 없이 import 해서 쓴다 — 새 로직
  중복이나 기능 확장이 없다.
- `.claude/tests/README.md` 는 그 신규 테스트 파일에 대응하는 카탈로그 행 1개만 추가한다(다른 행은
  무변경) — 카탈로그 가드가 요구하는 필수 등재이며 drive-by 정리가 아니다.
- `CHANGELOG.md`·`PROJECT.md` 갱신은 이번 워크플로 변경으로 stale 해지는 문장만 정확히 겨냥해 고친다
  (선행 consistency-check 의 INFO 권고와 1:1 대응).
- `review/code/2026/09/24/21_16_58/**`(1라운드 리뷰 산출물 14개+메타)·`review/consistency/2026/09/24/
  21_04_26/**`(이번 작업 자신의 `--impl-prep` 산출물 6개+메타)는 CLAUDE.md 가 명시한 워크플로 필수
  증적이며 이번 작업 자신의 세션에 속한다 — 스코프 이탈이 아니다(위 WARNING 대상인 `20_34_01/` 과는
  달리 이 두 디렉터리는 모두 이번 `docs-guard-trigger` 작업 자신이 생성한 세션이다).
- 의도 이상의 리팩토링·기능 확장(over-engineering)·무관한 임포트·설정 변경·의미 없는 포맷팅은
  관측되지 않았다.

## 요약

핵심 워크플로 변경과 그에 직접 딸린 문서·테스트·필수 리뷰 증적은 plan 이 선언한 스코프 안에 정확히
머문다. 다만 1라운드 WARNING(#1) 을 고치는 과정에서, 이번 작업과 무관하게 **이미 머지된 별개
PR(#1389) 의 완결된 세션 산출물**(`review/consistency/2026/09/24/20_34_01/meta.json`)까지 diff 에
포함해 고쳤다 — 값 자체는 안전한 정정이지만 plan 에 선언되지 않은 범위 확장이며, 별도 커밋/PR 로
분리했어야 더 명확했다.

## 위험도
LOW
