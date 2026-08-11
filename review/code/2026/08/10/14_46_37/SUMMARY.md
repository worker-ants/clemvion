# Code Review 통합 보고서 — 배치 거짓 PASS 제거 (3라운드)

- 대상: `claude/harness-review-batch-false-pass` · diff-base `origin/main` · `--route=all`
- forced 7명 **전원** 리포트 확보.

## BLOCK: NO

**Critical 0** · WARNING 4 — 전부 반영 (`RESOLUTION.md`).

## 전체 위험도

**LOW**.

## 경고

| # | reviewer | 발견사항 | 조치 |
|---|---|---|---|
| 1 | side_effect | **2026-08-06 사고 뒤 만든 `_harness.git_in()` 하드닝을 신규 픽스처가 안 씀** — 사고 당시와 같은 미보호 `cwd=` 패턴의 세 번째 복제 | **반영** — 추출한 `_new_repo()` 에서 한 곳으로 적용(형제 픽스처도 함께 닫힘) |
| 2 | maintainability | 픽스처 보일러플레이트가 형제와 바이트 단위 동일 | **반영** — 셋업만 추출(커밋 시퀀스는 고유하므로 남김) |
| 3 | requirement | 뮤테이션 "7/7" 목록에 **다른 파일·다른 커밋**의 뮤턴트를 끼워 넣음 | **반영** — 6/6 + 별건으로 분리 |
| 4 | documentation | "남는 이유는 **셋**" 이 이번 diff 자신의 종결로 stale | **반영** — 둘로 정정 |
| 5 | scope | `14_09_31/RESOLUTION.md` 의 검증 표가 `08_32_48` 을 조건 없이 "#1125 ✅" 로 확정한 채 남음 | **반영** — 원문 보존 + 반증 인용구 |
| — | testing | (INFO) `unseen` 호출부의 `>20` 절단 미검증 | **반영** — 25개 fixture 로 고정 |

## 0/0 을 낸 reviewer

| reviewer | 비고 |
|---|---|
| security | NONE — delta 가 문서·테스트 전용임을 `git diff` 로 확인, 신규 실행 코드는 list-argument `subprocess.run` 뿐 |
| requirement | 지시한 재판정 2건("17→19", 상위 체크박스)이 **이미 정확히 반영**됨을 실측 확인 |
| scope | `08_32_48` 처분을 `git cat-file`·`merge-base --is-ancestor`·`for-each-ref` 로 **독립 재실측**해 타당 판정. 나머지 8개 회수 세션도 `meta.json` × 병합 diffstat 1:1 대조로 새 오귀속 없음 |
| testing | 내 뮤테이션 주장 2종을 **직접 재현**해 검증 |

## 이 라운드의 성격 — 수렴

발견 5건이 전부 **문서·테스트 위생**이고, 동작·구조 결함은 0이다. 라운드별로 내려왔다:

| 라운드 | 발견의 성격 |
|---|---|
| `14_09_31` | 동작·구조 (오귀속 CRITICAL, 호출부 미관측, 중복 2) |
| `14_32_02` | 검증 누락 (가드 재현 부재, 서술 4곳 stale) |
| `14_46_37` | **문서·테스트 위생만** |

그리고 이번 라운드는 **세 reviewer 가 내 주장을 독립 재실측**했다 — scope 는 처분 근거를,
testing 은 뮤테이션을, requirement 는 개수 정정을. 셋 다 확인됐고, 그 과정에서 남은
위생 문제만 나왔다.

## 반복된 형태 — 이름을 붙여 둔다

이 브랜치에서 같은 뿌리가 여러 번 나왔다: **부분을 전체로 적기**(9개 중 6개 확인 → "전부
머지"), **다른 것을 하나로 세기**(다른 파일 뮤턴트를 한 목록에), **개수 주장이 조치를 안
따라가기**(17/19, 셋/둘), **하드닝을 자매에 미적용**(픽스처 3번째 복제).

넷 다 "센 집합이 주장한 집합과 다른데 그 사실을 확인하지 않았다" 로 환원된다.

## 검증

- harness **1055 tests / OK**
- 문서 가드 19파일 **2872 passed**
- 뮤테이션: `test_review_prepare_single_session.py` 6/6 · `test_line_anchors.py` 2/2 RED
