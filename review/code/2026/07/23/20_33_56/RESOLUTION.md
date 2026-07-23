# RESOLUTION — 3라운드 (rebase 후)

리뷰: `review/code/2026/07/23/20_33_56/SUMMARY.md` — RISK=**CRITICAL**, Critical 1, Warning 3.
forced 7명 전원 확보. Critical 1건은 **이 diff 가 만든 것이 아니라 내가 2라운드에서 발견해
§J 로 등록한 기존 결함**이며, 리뷰어도 "은폐·회귀는 아니나 미해결 기간의 리스크" 로 판정했다.

## Critical (1) — 별건 유지, 단 포인터를 결함 지점으로 이동

`_GIT_PUSH` 의 따옴표 env 접두 우회. 이 PR 에서 고치지 않는 판단은 유지한다: 해당 패턴은
`test_push_guard_allowlist.py` 가 byte-for-byte 고정하고 차등 코퍼스(legacy ⇒ new)가 걸려 있어,
핀 갱신 + 코퍼스 확장 + 뮤테이션을 동반한 별 PR 이 맞다. **이 PR 직후 최우선으로 착수한다.**

리뷰어의 "임시 완화책(탐지 실패 시 관측 로그)" 은 채택하지 않는다 — 탐지가 실패했다는 것은
그것이 push 인지 모른다는 뜻이라, 그 지점에서 남길 수 있는 신호가 없다. 논리적으로 불가능한
완화책이다. (W2 로 포인터 위치는 고쳤다.)

## Warning (3) — 전부 반영

### W1 SPEC-DRIFT — 정책 문서만 5종 구분자에 멈춰 있음

`worktree-policy.md:73` 이 단일 `&` 를 빠뜨렸다. **내가 같은 PR 에서 코드에 `&` 를 추가하면서
그 문서 줄만 갱신하지 않은** 것이다(코드·docstring·plan·테스트는 6종으로 일관). 따옴표 env 값
언급도 함께 누락돼 있어 같이 보강했다.

### W2 — §J 주석이 결함 지점이 아닌 곳에 붙어 있었다

`_SEGMENT_IS_GIT`(release 경로, 미매치 = 안전) 옆에 두고 "the `\S+` above" 라고 썼는데, 실제
결함은 `_GIT_PUSH` 다. §J 를 고치러 오는 사람이 **엉뚱한 정규식을 고칠** 위험이 실재했다.
→ 포인터를 `_GIT_PUSH` 정의 바로 위로 옮기고(측정된 증상·정확한 수정식·핀 갱신 필요성 포함),
`_SEGMENT_SPLIT` 쪽에는 "§J 결함은 위쪽 `_GIT_PUSH` 에 있다" 만 남겼다.

### W3 — `test_line_anchors.py` 가 HEAD 커밋 크기에 결속

실측 재현: 현재 HEAD(plan 전용 소커밋)에서 `AssertionError: 13 not greater than 20`.
**내 앞선 "529건 OK" 는 그 커밋 직전 수치라 최종 HEAD 기준으로는 낡은 주장이었다.**

리뷰어 권고는 "코드 조치 불필요 — 이후 커밋이 얹히면 자연 치유 + 백로그 등록" 이었으나
채택하지 않았다. "자연 치유" 는 곧 **RED/GREEN 이 측정 대상과 무관한 상태로 결정된다**는 뜻이고,
그건 다음 사람에게 같은 지뢰를 남긴다. 임계값을 낮추는 것도 반대 방향의 무의미(어떤 커밋에서든
GREEN)라 택하지 않았다.

→ `_prepare_commit()` 이 HEAD 를 고정하는 대신 **최근 40커밋 중 변경 라인 ≥80 인 첫 커밋**을
fixture 로 고른다. `--numstat` 로 싸게 선별하고 선택된 1건만 `--prepare` 를 지불한다. 이 파일의
규약("fixture 가 아니라 실제 git 이력을 replay") 은 그대로 지키면서 결속만 끊는다.
비-vacuity: 임계값을 0 으로 되돌린 뮤턴트에서 **원래 에러가 그대로 재현**(13 not greater than 20).

## INFO 반영

- **#5** docstring 문법(`that opens` → `this opens`).
- **#3** env 값 미탐지 2종(빈 값 `VAR= git commit`, 닫히지 않은 따옴표)을
  `test_malformed_env_values_stay_unmatched` 로 명시 pin + docstring 에 사유 기록.

## INFO 미반영(사유)

- **#1** 두 파일의 `_SEGMENT_SPLIT` 동명이역 → 개명은 순수 churn 이고, W2 로 옮긴 주석이
  "역할이 반대" 를 명시하므로 오해 위험은 그 주석이 직접 겨냥한다. 리뷰어도 "차단 사유 아님".
- **#2** `_already_warned` 를 `_is_mutating` 보다 먼저 — 동작 동일한 순서 바꾸기이고 리뷰어
  자신이 "프로세스 재기동 비용에 묻히는 수준" 으로 판정. diff 밖 drive-by 는 피한다.
- **#4** `main()` 오케스트레이션 테스트 — 이 PR 스코프는 분류기다(리뷰어도 "스코프상 타당").
- **#6** 과거 라운드 산출물의 STATUS 헤더 — 사후 수정 실익 없음.
- **#7/#8** §J 신설·완료문서 forward-reference — 둘 다 "기록만" 이고 리뷰어가 조치 불필요 판정.

## 검증

- 하네스 전체 **530건 OK** (이번엔 최종 HEAD 기준으로 재확인). 신규 분류기 테스트 13건.
- plan-frontmatter 105건 OK.
- 뮤테이션: W3 fix 비-vacuity 확인. 2라운드의 뮤턴트 7종은 코드 무변경이라 유효.

## 한계

GitHub Actions 가 저장소 전체에서 비활성이라 위 수치는 **전부 로컬 실행** 결과다.
