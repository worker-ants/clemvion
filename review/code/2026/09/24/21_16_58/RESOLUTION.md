# RESOLUTION — `review/code/2026/09/24/21_16_58` (1라운드)

**Critical 0 · Warning 4 · INFO 8.** reviewer 14명 전원, forced 8/8. 넷 다 **내 것이고 전부 조치했다.
보류 0건.**

## 조치 항목

| SUMMARY # | 지적 | 조치 | commit |
| --- | --- | --- | --- |
| Warning 1 | impl-prep 세션 `21_04_26` 의 `meta.json` 이 `target_path`·`mode` 에 세션 전용 scratch 절대경로를 영구 기록으로 남김 | 저장소 상대경로(`spec/conventions/spec-impl-evidence.md`)로 정정하고, **사본으로 돌린 사실과 이유는 `scope_note` 로 보존**(기록을 지우지 않는다). **바로 앞 PR(#1389)의 impl-done 세션 `20_34_01` 도 같은 결함**이라 함께 고쳤다 — 같은 방식으로 좁혔으니 같은 결함이다. 게이트는 `mode` 의 `--impl-done` 토큰만 보므로 토큰을 유지했고, `_is_impl_done_session()` 이 여전히 `20_34_01` 을 True 로 인식함을 확인했다 | `32b97f944` |
| Warning 2 | 이 수정이 막으려는 결함을 고정하는 회귀 테스트가 없다 — `plan/**` 을 통째로 지워도 하네스 초록 | `test_spec_link_checks_scope.py` 신설. 두 회귀 형태를 **이름으로** 고정(`plan/**`·`spec/**` 존재 / 디렉터리 대상 · 단일 `.test.ts` 아님). pathspec 은 `test_harness_checks_paths_coverage.parse_pathspecs_block` 을 **import** 해 읽는다(재구현하면 진짜 파서를 못 따라간다). 카탈로그 가드가 `README.md` 등재를 요구해 함께 넣었다 | `32b97f944` |
| Warning 3 | 워크플로 헤더 2·11행이 «spec-link-integrity 가드로 검증» · «가드 하나만» 이라 확장 뒤 본문과 모순 | 두 줄을 «docs 가드 전체» 로 고치고 옛 범위는 괄호로 남겼다 | `32b97f944` |
| Warning 4 | CHANGELOG 항목 없음 — 선행 두 PR 은 같은 종류 변경에 항목을 냈다 | 선례 형태로 추가(무엇이 뚫려 있었고 무엇을 새로 강제하는가 + 판별력 실측) | `32b97f944` |

### W2 — 새 테스트가 공허하지 않음을 실증

| 뮤턴트(워크플로를 옛 형태로) | 예측 | 실측 |
| --- | --- | --- |
| `plan/**` 제거 — 옛 구멍 1 | pathspec 단언 RED | **1 failed**(plan subtest) |
| 단일 파일 실행으로 복귀 — 옛 구멍 2 | 디렉터리 단언 RED | **1 failed** |
| `spec/**` 제거 | pathspec 단언 RED — `subTest` 가 둘 다 도는지 | **1 failed**(spec subtest) |

원복은 `cp`, 원복 후 2 passed.

### W4 — 여섯 번째 CHANGELOG 누락

**바로 앞 PR 에서 «가드 신설·강화 = 항목» 이라고 기억에 적어 놓고 곧바로 또 빠뜨렸다.**
이번 변경은 CI 가드의 적용 범위를 넓히는 것이라 그 기준에 정확히 해당한다. 기억에 적는 것만으로는
작동하지 않는다는 뜻이다 — 구현 커밋을 만들 때 CHANGELOG 를 **같은 커밋에** 넣는 절차로 바꿔야 한다.

## INFO 처분

- **INFO 6** (no-op 안내 문구에 `plan` 없음) — W3 와 같은 자리라 함께 고쳤다.
- **INFO 1** (잡 이름이 실제 범위보다 좁게 읽힘) — 의도된 트레이드오프, 잡 주석·plan 에 근거가 있다.
- **INFO 2** (트리거 표면·실행시간 증가) — 의도된 트레이드오프, 실측(23파일 3567개, 수 초)이 있다.
- **INFO 3 · 4 · 5** (헤더 이력 누적 · «가벼운 트리거» 불변식 비강제 · 가드의 frontend 패키지 결합) —
  reviewer 스스로 «후속 검토» 로 분류. 이 PR 의 스코프(트리거 갭)를 넘는다.
- **INFO 7** (`PROJECT.md` 절 구조) — 선택 사항, 현 서술로 관계가 명시돼 있다.
- **INFO 8** («required check 없음» 은 시점부 사실) — 주석에 날짜를 박아 뒀고, 논지는 그 사실과
  무관하게 유효하다.

## TEST 결과

이 PR 은 `codebase/**` 를 건드리지 않는다(`.github/` · `.claude/tests/` · `PROJECT.md` · `CHANGELOG.md` ·
plan · review). CLAUDE.md 가 정한 대로 harness 계열 변경의 검증은 pytest 가 대신한다:

- 하네스 `python3 -m pytest .claude/tests -q` — **1140 passed**
- CI 와 같은 명령으로 docs 가드 디렉터리 실행 — 23파일 3567 passed
- CI 판정 스크립트로 plan-only 과거 커밋 판별 — 옛 `relevant=false` → 새 `true`

## 보류·후속 항목

없다.
