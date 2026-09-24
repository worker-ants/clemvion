# 부작용(Side Effect) 리뷰 — minio-image-parity-guard (2라운드)

## 검토 범위 및 방법

diff 26개 파일 중 실행 코드는 `.claude/tests/test_minio_image_parity.py` 하나뿐이고 나머지는
`harness-checks.yml` pathspec, `CHANGELOG.md`/`README.md`/plan 문서, 그리고 1라운드
`review/code/**` + `review/consistency/**` 산출물이다. 저장소 파일은 수정하지 않고
`Read`/`Bash`(read-only: `sed -n`, `awk`, `grep -n`, `git log`)로만 확인했다 — 뮤테이션 없음,
`git status --short` 로 별도 확인할 잔여물도 없다.

직접 대조한 것:
- `.claude/tests/test_minio_image_parity.py` 실물(206줄) — 프롬프트에 실린 diff 와 바이트 단위로 일치.
  1라운드 fix 커밋(`c8a1a59b6`)이 반영된 최종 상태(`_mapping()` 헬퍼, `pod_template` 명명,
  `test_k8s_duplicate_resource_is_named`)를 diff 가 이미 담고 있다(diff base 가 `origin/main...HEAD`
  이라 세 커밋이 합쳐져 보임 — 새 side-effect 는 없다).
- `.claude/tests/_harness.py:24-31` — `sys.path` 삽입이 `if str(HOOKS_DIR) not in sys.path:` 가드로
  멱등이고, 이 스위트의 모든 `test_*.py` 가 공유하는 기존 동작임을 재확인.
- `.github/workflows/harness-checks.yml` 전체 — 신규 pathspec 3줄이 정확히 그 세 파일에만 걸리고
  중복 등재나 다른 워크플로(`frontend-checks`/`backend-checks`)로의 누출이 없음을 확인.
- `.github/workflows/_changed-paths.yml` — `pathspecs` 는 `workflow_call` 의 문자열 입력으로,
  호출부(`harness-checks.yml`)마다 독립적으로 넘겨진다. 따라서 이번 추가는 그 워크플로 자신의
  `changes` 잡 판정에만 영향을 주고 다른 재사용 호출부로 번지지 않는다.

## 발견사항

- **[INFO]** `sys.path` 전역 변경은 이 diff 가 새로 만든 것이 아니라 스위트 공유 모듈의 기존 동작
  - 위치: `.claude/tests/test_minio_image_parity.py:54` (`from _harness import REPO_ROOT`) →
    `.claude/tests/_harness.py:29-31` (`if str(HOOKS_DIR) not in sys.path: sys.path.insert(0, str(HOOKS_DIR))`)
  - 상세: 새 테스트가 `_harness` 를 import 하면 그 모듈이 로드 시점에 `sys.path` 앞에
    `.claude/hooks` 를 끼워 넣는다. 가드가 멱등이라 반복 import 로 중복 삽입되지 않고, 이 파일이
    처음 도입한 패턴도 아니다(`.claude/tests/` 하위 다른 테스트 전부가 같은 경로를 탄다). 이 PR 이
    새로 넓힌 전역 영향면은 아니다.
  - 제안: 조치 불요.

- **[INFO]** `harness-checks.yml` CI 트리거 표면 확장은 파일 3개로 정확히 한정되고, 다른 워크플로로
  번지지 않음(교차 확인 완료)
  - 위치: `.github/workflows/harness-checks.yml` — `changes` 잡의 `pathspecs:` 블록 스칼라에
    `docker-compose.yml` · `docker-compose.e2e.yml` · `k8s/overlays/local/infra-minio.yaml` 3줄 추가
  - 상세: `_changed-paths.yml` 은 `workflow_call.inputs.pathspecs` 를 호출부마다 독립된 문자열로
    받으므로(재사용 워크플로이지만 상태 공유 없음), 이번 추가는 `harness-checks.yml` 자신의 relevance
    판정에만 영향을 준다. 다만 **실질 효과**로는: 지금까지 `docker-compose.yml`(예: 볼륨 마운트·포트
    변경처럼 이미지 문자열과 무관한 수정)만 건드리던 PR 도 이제 harness pytest 전체 스위트(1100여 개)를
    함께 태우게 된다. 이는 "이미지 patiry 만" 이 아니라 그 파일 전체에 대한 트리거이므로, 가드가 의도한
    범위(이미지 6곳 일치)보다 CI 실행 트리거 범위가 넓다. plan·주석 모두 이 트레이드오프를 "무관한
    변경마다 스위트가 돈다"(k8s 를 `k8s/**` 로 넓히지 않는 이유)는 표현으로 이미 인지하고 최소화했으므로
    의도된 설계이지 새로운 위험은 아니다.
  - 제안: 조치 불요 — 의도-구현 일치. 향후 harness 스위트 실행 시간이 문제가 되면 이 3파일 트리거를
    "이미지 관련 변경만" 으로 더 좁히는 방안(예: 파일 diff hunk 기반 필터)을 고려할 수 있으나 현재
    git pathspec 메커니즘으로는 파일 단위가 최선이다.

- **[INFO]** 신규 함수(`compose_images`/`k8s_images`/`all_images`/`_render`/`_mapping`)는 순수 함수 +
  read-only 파일 접근만 수행 — 전역 상태·환경변수·네트워크·파일 쓰기 없음(긍정 관찰, 독립 재확인)
  - 위치: `.claude/tests/test_minio_image_parity.py:83-127` (`compose_images`/`k8s_images`/`all_images`/`_render`),
    `:76-80`(`_mapping`)
  - 상세: `all_images()` 가 `setUp()`(`:175-176`)에서 매 테스트 메서드마다 재호출되며 3개 고정 경로만
    `read_text(encoding="utf-8")` 로 읽는다. 인자로 받은 텍스트만 파싱하는 순수 함수 설계라 프로세스
    상태에 남는 것이 없다(클래스 변수·모듈 변수 캐시 없음 — 매 테스트가 파일을 다시 읽으므로 약간
    비효율적일 수 있으나 부작용 관점에서는 오히려 테스트 간 격리가 깨끗하다는 뜻). `os.environ` 읽기·
    쓰기, `subprocess`/`socket`/`requests` 류 호출은 파일 전체에 없음(grep 으로 재확인:
    `import (os|subprocess|socket|requests|urllib)` 없음).
  - 제안: 조치 불요.

- **[INFO]** 신규 클래스/함수는 이 파일 내부에서만 소비되어 기존 호출자에 대한 시그니처·인터페이스
  영향이 없음
  - 위치: `.claude/tests/test_minio_image_parity.py` 전체(신규 파일)
  - 상세: `PlaceNotFound`, `compose_images`, `k8s_images`, `all_images`, `_render`, `_mapping`, `_PINNED`,
    `K8S_PLACES`, `COMPOSE_SERVICES` 모두 이 모듈 최초 도입이며 다른 파일에서 import 되지 않는다
    (`grep -rn "test_minio_image_parity\|from test_minio_image_parity import" .claude` 결과 이 파일
    자체 외 참조 없음 확인). 기존 공개 API 변경 없음.
  - 제안: 조치 불요.

- **[INFO]** `review/consistency/**`·`review/code/**` 산출물이 로컬 워크트리 절대경로를 커밋에 남김
  (1라운드와 동일 패턴, 재확인)
  - 위치: `review/consistency/2026/09/25/00_08_35/_retry_state.json:2-7`,
    `review/code/2026/09/25/00_25_55/_retry_state.json:2-7` 등
  - 상세: `/Volumes/project/private/clemvion/.claude/worktrees/...` 형태의 로컬 경로가 git 히스토리에
    영구히 남는다. CLAUDE.md 규약상 이 산출물의 보존 자체는 의도된 것이고, 코드가 유발하는 부작용은
    아니다(harness 도구가 세션마다 절대경로를 그대로 기록하는 기존 관례) — 참고로만 재기재.
  - 제안: 조치 불요.

## 요약

이번 라운드에서 diff 실물(`test_minio_image_parity.py`, `_harness.py`, `harness-checks.yml`,
`_changed-paths.yml`)을 직접 열어 1라운드 side_effect 리뷰의 결론을 독립적으로 재검증했고, 새로
도입된 부작용은 발견되지 않았다. 실행 코드는 3개 고정 경로만 읽는 순수 함수 조합으로 전역 상태·
환경변수·네트워크·파일 쓰기가 전혀 없고, `sys.path` 변경은 스위트 전체가 공유하는 기존 관례를 그대로
따른다. CI pathspec 확장은 `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml`
3개 파일에 정확히 한정되고 다른 워크플로로 번지지 않는 것을 `_changed-paths.yml` 구조까지 추적해
확인했다 — 다만 그 3파일에 대한 **모든** 수정(이미지와 무관한 것 포함)이 harness pytest 전체를
태우게 되는 트레이드오프는 문서화된 의도된 설계다. 시그니처·인터페이스 변경, 이벤트/콜백 변경도
없다(신규 파일이라 기존 호출자가 없음). 위험도는 NONE 이 타당하다.

## 위험도
NONE
