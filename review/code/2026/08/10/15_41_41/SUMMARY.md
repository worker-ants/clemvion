# Code Review 통합 보고서 — peer 게이트 §1 (3라운드, 수렴)

- 대상: `claude/deps-peer-gating` · diff-base `origin/main` · `--route=all`
- forced 7명 **전원** 리포트 확보.

## BLOCK: NO

**Critical 0** · WARNING 4 — 전부 반영 (`RESOLUTION.md`).

## 전체 위험도

**LOW** (반영 후).

## 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | side_effect · testing (독립 재현) | **`git grep` 이 untracked 를 못 봐서 가드가 정확히 실수하는 시점에 침묵** — 새 install 지점을 만들고 `git add` 전이면 조용히 통과 | **반영** — `--untracked`. 프로브로 실증(미추적 파일 → RED 2건, 이전 판은 초록) |
| 2 | documentation · maintainability (독립 수렴) | **"유일한 소재지" 4번째 인스턴스** — 같은 파일의 모듈 docstring. 직전 정정이 **리터럴 grep** 이라 파라프레이즈를 놓쳤고, 한 파일 안에서 두 문장이 서로를 반박하는 상태가 새로 생겼다 | **반영** — 의미 축으로 재검색 |
| 3 | maintainability | 두 테스트가 `git grep` 블록 10줄 복제 | **반영** — `setUp` 추출. **추출 후 같은 프로브로 RED 2건 유지 확인** |
| 4 | scope (INFO) | CLAUDE.md 권한표(`review/**` 는 `RESOLUTION.md` 만)와 실제 관례 불일치 | **plan 에 등재** — 어느 쪽이 옳은지가 **결정 사항**이라 임의로 정하지 않았다 |

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE — delta 가 테스트·문구 전용임을 파일까지 열어 확인 |
| scope | NONE — §2 파일 일절 미포함, 경계 유지 |
| requirement | 0/0 — **가드의 검색 범위보다 넓게** 저장소 전체 재검색해 6번째 호출부 부재 확인. 비-vacuity 자가검증이 "grep 무결과 시 조용히 통과" 를 실제로 차단함도 검증 |

## 이 라운드의 성격 — 수렴

발견 4건이 전부 **가드 자신의 결함과 문서 위생**이고, 게이트 동작 결함은 0이다.

| 라운드 | 발견의 성격 |
|---|---|
| `15_11_16` | **동작** — 게이트가 5곳 중 1곳에만 (CRITICAL) |
| `15_23_40` | **검증 누락 + 문구 뿌리** — 4곳 무가드, "유일한 소재지" ×3 |
| `15_41_41` | **가드 자신의 사각지대 + 문구 4번째** |

## "전수로 셌다" 가 다섯 번 틀렸고, 매번 축이 달랐다

| 라운드 | 센 축 | 놓친 축 |
|---|---|---|
| — | 소스 파일 범위 | spec·plan 문서 |
| — | 두 용어(리터럴) | `status` 축 |
| `15_11_16` | composite action | 나머지 install 호출부 4곳 |
| `15_23_40` | 리터럴 문자열 | **파라프레이즈** |
| `15_41_41` | 추적 파일 | **미추적 파일** |

축을 넓힐 때마다 다음 축이 드러났다. **"전수로 셌다" 는 선언이 신호가 아니고, 어느 축으로
셌는지가 신호다.**

## 검증

- harness **1036 tests / OK**
- 뮤테이션: Dockerfile 플래그 제거 · SITES 목록 삭제 · 주석 필터 무력화 · 미추적 파일 탐지 —
  **testing reviewer 가 격리 저장소에서 전부 독립 재현**
- side_effect 가 Docker COPY 패턴 재현 실행(직전 라운드) / requirement 가 호출부 전수 재검색
