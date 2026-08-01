# 변경 범위(Scope) 리뷰 — deps-guard-hardening (7차 라운드)

## 검토 방법

이번 라운드 페이로드(21개 파일)는 (1) 직전 두 리뷰 라운드(`review/code/2026/08/01/03_47_10`=5차,
`review/code/2026/08/01/04_09_43`=6차)의 산출물 20개(SUMMARY.md·`_retry_state.json`·meta.json·
reviewer `.md` 7종 × 2라운드)와 (2) 그 두 라운드가 지적한 WARNING/INFO 를 조치한
`scripts/check-override-floors.py` 델타 1개로 구성된다. 프롬프트 텍스트만이 아니라
`git log`/`git diff`/`Read` 로 실제 저장소 상태를 직접 대조해 검증했다:

- `git log --oneline origin/main..HEAD --stat` — 이 브랜치(`claude/deps-guard-hardening`, origin/main
  대비 10개 커밋)의 전체 파일 변경 이력 확인.
- `git diff 1f21c9d24..HEAD` (4차 리뷰 SUMMARY 기록 커밋 → HEAD) — 이번 라운드가 실제로 다루는
  "5차+6차 조치" 순델타 확인.
- `git diff 1f21c9d24..HEAD -- scripts/check-override-floors.py` — 스크립트 자체의 순수 코드 델타.
- `plan/in-progress/deps-guard-hardening.md` 전문 직접 열람 — §1 원 요청 범위·"개발 중 실측으로
  드러난 것" 절의 근거 기록 대조.

## 발견사항

- **[INFO]** 리뷰 산출물 동봉(파일 1~20, `review/code/2026/08/01/{03_47_10,04_09_43}/*`)은 이
  저장소의 확립된 관례이며 범위 이탈이 아님
  - 위치: N/A(신규 파일 20개 전체 — `review/code/2026/08/01/03_47_10/*`, `review/code/2026/08/01/04_09_43/*`)
  - 상세: `git log --oneline origin/main..HEAD --stat` 로 확인한 결과, 이 브랜치의 10개 커밋 중
    "N차 리뷰 조치" 성격의 커밋(`3ff26348c`·`c019a3e1b`·`99f6110c0`·`652f6cc78`·`68e9064d3`·`1598f542f`)
    전부가 예외 없이 같은 패턴을 따른다 — 코드 수정과 그 직전 라운드의 `review/code/**` 산출물을
    같은 커밋에 동봉. 이번 라운드가 다루는 두 커밋(`68e9064d3`=5차 조치, `1598f542f`=6차 조치)도
    동일하다. 직전 두 라운드의 scope 리뷰어(`review/code/2026/08/01/03_47_10/scope.md`,
    `review/code/2026/08/01/04_09_43/scope.md`)도 각각 이를 "무관한 파일 수정 없음"/LOW 로 판정한
    바 있다.
  - 제안: 조치 불요. 기록 목적.

- **[INFO]** 실제 코드 델타(`scripts/check-override-floors.py`)는 직전 두 라운드가 지적한
  WARNING/INFO 항목에 정확히 국한되고, 무관한 함수·임포트·포맷팅 변경이 섞이지 않음
  - 위치: `scripts/check-override-floors.py:77`(`_AUDIT_TIMEOUT_SEC` 상수 신설),
    `:119-148`(`load_override_targets()` 재작성), `:172-188`(`run_audit()` 의
    `try/except subprocess.TimeoutExpired` 블록 신설)
  - 상세: `git diff 1f21c9d24..HEAD -- scripts/check-override-floors.py` 로 5차+6차 조치의 순수
    델타를 직접 대조했다. 변경은 상수 1개 추가와 두 함수(`load_override_targets`/`run_audit`)의
    본문에만 정확히 국한된다 — 5차 WARNING #2(`overrides` 키 완전 부재 미검출)·6차 WARNING #1
    (`overrides` 값 타입 미검증)·6차 WARNING #3(`yaml.safe_load` 예외 미처리)가
    `isinstance(overrides, dict)` 단일 조건으로 통합 조치됐고, 5차 INFO #3·6차 WARNING #2(각각
    timeout 부재 지적)가 `timeout=_AUDIT_TIMEOUT_SEC` + `except TimeoutExpired` 로 조치됐다.
    `classify_vulnerable()`·`main()`·`_report_widened()`·`_report_eroded()`·`chain_segments()`·
    `override_target()` 은 이 델타에서 단 한 줄도 변경되지 않았다. 5차 WARNING #1(returncode
    불변식 미검증)은 스크립트 본체가 아니라 테스트 스텁(`.claude/tests/test_override_floors.py`,
    이번 리뷰 스코프 밖)에서만 조치가 필요한 항목이라 이 파일에 대응 변경이 없는 것이 맞다.
  - 제안: 조치 불요.

- **[INFO]** `widened`/`eroded` 2축 설계 — plan 원문 직접 대조로 범위 이탈 아님 재확인(직전 두
  라운드 scope 판정과 일치)
  - 위치: `scripts/check-override-floors.py:241-268`(`classify_vulnerable()` 의 `widened`/`eroded`
    분류), `plan/in-progress/deps-guard-hardening.md` "개발 중 실측으로 드러난 것" 절
  - 상세: plan 문서를 직접 열람해 대조한 결과, "가드가 자기 실패 모드를 그대로 재현하고 있었다
    (리뷰가 잡음)" 단락이 `ignoreCves` 전역 억제로 인한 가드 자신의 사각(취약 버전이 실제 설치된
    상태에서도 무수정 프로브로 OK 를 낸 실측 사례)을 명시적으로 기록하고 있다. `widened` 축은
    plan §1 원문("오버라이드 하한 < 알려진 패치 하한" 한 축)보다 넓어 보이지만, 이 실측 근거가
    plan 문서에 남아 있어 §1 목적(침식 검출) 달성에 필요한 보강이지 임의 기능 확장이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 같은 커밋에서 함께 바뀐 `plan/in-progress/deps-guard-hardening.md`·
  `.claude/tests/test_override_floors.py` 가 이번 라운드 페이로드에는 없음(router 파일 선별
  결과 — 스코프 확장이 아니라 축소 방향이라 문제로 분류하지 않음)
  - 위치: N/A — router 선별 결과, 이번 프롬프트 페이로드(21개 파일) 밖의 사실 확인
  - 상세: `git diff 1f21c9d24..HEAD --stat` 로 확인한 결과, 이 두 파일도 이번 라운드가 검토하는
    두 커밋(`68e9064d3`: plan 17줄·테스트 68줄, `1598f542f`: plan 18줄·테스트 77줄)에서 함께
    수정됐으나 21개 파일 목록에는 없다. `.claude/**` 제외는 5차 라운드 testing 리뷰어
    (`review/code/2026/08/01/03_47_10/testing.md`)가 "코드 리뷰 게이트 스코프에서 제외하는 기존
    정책"으로 이미 확인한 바 있고, `plan/**` 는 진행 로그 문서(developer 권한표상 `plan/**` 쓰기
    허용이나 코드가 아님)라 같은 성격의 제외로 보인다. `plan/in-progress/deps-guard-hardening.md`
    를 직접 열어 5·6차 라운드 서술("`/ai-review` 5차 (`03_47_10`) — Critical 0 · Warning 2 ...",
    "`/ai-review` 6차 (`04_09_43`) — Critical 0 · Warning 3 ...")과 실제 코드 변경을 대조한 결과
    불일치는 없었다. 이번 델타 자체의 범위 이탈은 아니며, router 커버리지에 대한 참고 사항일 뿐이다.
  - 제안: 조치 불요(낮은 우선순위 참고). router 의 코드 리뷰 게이트 파일 선별 정책이 `.claude/**`
    외에 `plan/**` 도 의도적으로 제외하는지 명문화해두면 향후 리뷰어의 재확인 비용을 줄일 수 있다.

## 범위 내 확인 사항 (문제 없음)

- **무관한 파일 수정 없음**: 저장소 전체 diff(`origin/main..HEAD`, 12개 파일 클러스터)가
  `scripts/check-override-floors.py`·`.claude/tests/**`·`.github/workflows/**`·`.github/dependabot.yml`·
  `pnpm-workspace.yaml`·`PROJECT.md`·`plan/in-progress/deps-guard-hardening.md`·`review/code/**` 로만
  구성되며, 전부 plan 문서의 §1/§2/§3 세 항목과 그 review-fix 사이클에 직접 연결된다.
  `codebase/**`(frontend/backend) 등 무관 영역 변경은 없다.
- **불필요한 리팩토링 없음**: 이번 델타(`1f21c9d24..HEAD`)가 건드린 두 함수 모두 리팩토링이 아니라
  직전 라운드가 지적한 구체적 결함(fail-closed 누락·timeout 부재)에 대한 최소 수정이다.
- **기능 확장(over-engineering) 없음**: CLI 플래그·설정 파일 인터페이스·범용화 시도 없음.
  `_AUDIT_TIMEOUT_SEC` 도 리뷰가 지적한 단일 문제(무한 대기)에 대응하는 상수 하나일 뿐이다.
- **임포트 변경 없음**: 이 델타는 신규/제거 임포트가 없다(기존 `yaml`/`subprocess` 재사용).
- **설정 변경 없음**: 이번 21개 파일 페이로드 안에는 `.yml`/`pnpm-workspace.yaml` 등 설정 파일이
  없다(그 파일들의 변경은 더 이전 커밋 `6b55b0f48`/`99f6110c0` 등에 속하며 이미 이전 라운드들이
  검토했다).
- **포맷팅과 뒤섞인 실질 변경 없음**: `git diff` 로 확인한 순델타에 공백/줄바꿈만의 변경은 없다.

## 요약

이번 라운드가 검토하는 21개 파일은 직전 두 리뷰 라운드(5차·6차)의 산출물 20개와, 그 두 라운드가
지적한 WARNING 을 조치한 `scripts/check-override-floors.py` 델타 1개로 구성된다. `git log`/`git diff`
로 직접 대조한 결과 리뷰 산출물 동봉은 이 브랜치 10개 커밋 전부가 예외 없이 따르는 확립된 관례이고,
스크립트 델타는 두 라운드가 지적한 정확히 그 지점(overrides 값 타입·YAML 예외 통합 처리, audit
timeout 신설)에만 국한되며 무관한 함수·임포트·포맷팅 변경은 없다. `widened` 축의 plan 원문 대비
확장도 plan 문서에 실측 근거가 명시돼 있어 범위 이탈이 아님을 재확인했다. 유일한 참고 사항은 같은
커밋에서 함께 바뀐 `plan/in-progress/deps-guard-hardening.md`·`.claude/tests/test_override_floors.py`
가 이번 페이로드에 없다는 점인데, 이는 스코프 확장이 아니라 router 의 기존 파일 선별 정책(제외
방향)이며 직접 대조 결과 서술과 코드 간 불일치도 없어 조치 대상이 아니다. Critical·Warning 없음.

## 위험도

LOW
