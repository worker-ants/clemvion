# RESOLUTION — 6R (harness-review-ci-backstop)

리뷰어 14/14 성공. **CRITICAL 5 / WARNING 8.** RISK=CRITICAL.
전부 격리 sandbox 에서 재현 확인됐고, main 이 각각 다시 재현했다.

## 여섯 라운드째 — 한 파일을 닫으면 우회는 그 파일 밖으로 간다

5R 에서 `harness-checks.yml` 의 job 조건·스위트 호출을 닫았다. 6R 은 그 **옆**으로 갔다.

| # | 우회 | 왜 통과했나 |
|---|---|---|
| C1 | `harness-checks.yml` 의 `on.pull_request` 에 `types`/`branches` 형제 키 | PR 트리거 **키 집합** 불변식이 `review-gate.yml` 에만 걸려 있었다. 831개를 실어 나르는 진입점이 영구·침묵 무력화 |
| C2 | **step** 레벨 `if:` | 등재제가 **job 레벨만** 봤다. step 이 skip 돼도 job 은 success — 로그는 초록. 3명 독립 확인 |
| C3 | `from os import environ as _E` → `_E["GITHUB_WORKFLOW"]` | 모듈 `os` 는 허용 목록에 있으므로 import 검사를 통과하고, 접근이 `Attribute` 가 아니라 `Name`+`Subscript` 라 금지도 비껴간다 |
| C4 | **게이트 본체**(`review_guard.py`)에 `GITHUB_JOB == "gate"` 분기 | "판정자는 하나" 가 **스크립트 한 파일만** 지켰다. 행위 테스트는 `review_guard.py` 를 스텁으로 통째로 교체해 실물을 한 번도 안 돌린다 |
| C5 | 같은 `name:`·job id 를 참칭하는 "always green" 워크플로 추가 | 파일 **간** identity 유일성을 보는 것이 없었다. required-status-check 은 파일이 아니라 체크 이름으로 매칭된다 |

## 처분

- **C1** — `on.pull_request` 키 집합을 **전 워크플로 등재제**로. 9개 워크플로 전부 등재했고,
  가드가 곧바로 미등재 6개를 잡아 실제 값으로 채웠다. 죽은 등재도 실패시킨다.
- **C2** — step 조건도 등재제로. 실제 조건 4건(전부 e2e 의 진단 수집 step)을 등재했다.
- **C3** — `ImportFrom` 의 **이름**도 검사한다. 이름을 바꿔 들여와도 환경 접근이다.
- **C4** — 게이트 본체의 환경 읽기를 **(파일, 변수) 등재제**로. 정당한 사용은 하나뿐이다
  (`review_guard.py` 의 `CLAUDE_PROJECT_DIR`). 새 접근이 생기면 거기서 마주친다.
  더해 `_HOSTILE_ENV` 를 5개 → **14개**로 확대했다 — 초판에 `GITHUB_WORKFLOW`/`GITHUB_JOB` 이
  없어서 리뷰어가 정확히 그 둘로 우회했다.
- **C5** — `(name, job id)` 유일성을 `Counter` 로 강제.

## WARNING

| # | 내용 | 처분 |
|---|---|---|
| W2 | `review-gate.yml` 의 `paths` 가 `_lib` 모듈을 **손으로 나열** — 세 번째 모듈이 생기면 같은 갭 | `.claude/hooks/_lib/**` 글롭으로. 문서 전체 고정 기대값도 동반 갱신 |
| W7 | plan §배선 가드 표가 4R 에 멈춤 | 5R·6R 행 추가 + "닫은 층" 요약 |
| W1 | 프롬프트 번들이 `ReviewArtifactsStayTrackedTest` 를 **절단 표시 없이** 누락 | 별도 범위(번들 조립기) — 다음 라운드에 그 클래스가 노출되도록 changeset 은 동일 유지 |
| W3~W6 | 스텁 중복 · 테스트 메서드 책임 과다 · `ap` 변수명 결합 · README stale | 미처분(구조/문서, 별도 범위) |
| W8 | 리뷰 중 HEAD 가 `8ce96e72b`→`e46f5382c` 로 전진 | **의도된 것**이다 — main 이 같은 라운드에 한 층 밖을 먼저 찾아 커밋했다(전제 가드). 리뷰어 6명이 관측하고 손대지 않고 보고만 했으며, 각 CRITICAL 은 신·구 HEAD 양쪽에서 재현됐다 |

## 검증

- harness 스위트 **835 tests OK**.
- mutation **5종 전부 RED** (전부 격리 사본):
  `pull_request types` · step `if: false` · `from os import environ as _E` ·
  게이트 본체 env 분기 · 워크플로 identity 참칭.
