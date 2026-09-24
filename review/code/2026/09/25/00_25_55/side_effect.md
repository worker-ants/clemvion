# 부작용(Side Effect) 리뷰 — minio-image-parity-guard

## 발견사항

- **[INFO]** `_harness` import 가 트리거하는 `sys.path` 전역 변경은 이 diff 가 새로 만든 것이 아니라 기존 공유 모듈의 기존 동작이다
  - 위치: `.claude/tests/test_minio_image_parity.py:54` (`from _harness import REPO_ROOT`) → `.claude/tests/_harness.py:32-33` (`if str(HOOKS_DIR) not in sys.path: sys.path.insert(0, str(HOOKS_DIR))`)
  - 상세: 새 테스트 파일이 `_harness` 를 import 하면 모듈 최상단에서 `sys.path` 에 `.claude/hooks` 를 삽입하는 전역 부작용이 (다른 모든 `.claude/tests/test_*.py` 와 마찬가지로) 함께 실행된다. `if ... not in sys.path` 가드로 멱등이고, 이 스위트의 기존 관례(`_harness.py` 자체가 그 용도로 설계됨)이므로 이 PR 이 새로 도입한 위험은 아니다. 다만 "부작용 없음"으로 단정하지 않도록 기록.
  - 제안: 조치 불요 — 기존 컨벤션. 재발/확장(예: 새 테스트가 `sys.path` 를 추가로 조작)이 생기면 그때 검토.

- **[INFO]** `harness-checks.yml` pathspec 확장은 CI 트리거 표면을 넓히는 의도된 부작용이며 스코프가 파일 3개로 정확히 한정됨
  - 위치: `.github/workflows/harness-checks.yml:92-98` (신규 `docker-compose.yml` / `docker-compose.e2e.yml` / `k8s/overlays/local/infra-minio.yaml` 항목)
  - 상세: 이 세 파일을 손대는 PR 은 이제 harness unittest 잡을 추가로 태운다. `k8s/**` 처럼 광역이 아니라 파일 단위로 한정했다는 주석(93-95행)과 실제로 diff 도 정확히 그 세 파일만 등재해 의도-구현이 일치한다. 부수적으로 트리거되는 다른 워크플로/잡은 없음(같은 `changes` 잡의 `pathspecs` 블록에만 추가).
  - 제안: 조치 불요.

- **[INFO]** 새 테스트는 3개의 기존 인프라 파일을 읽기 전용으로만 접근하며, 파일시스템 쓰기·삭제·환경변수·네트워크 호출이 전혀 없음
  - 위치: `.claude/tests/test_minio_image_parity.py:110-113` (`all_images()` 의 `read_text` 3회 호출)
  - 상세: `compose_images` / `k8s_images` / `all_images` 모두 순수 함수이며 인자로 받은 텍스트만 파싱한다. `setUp()` 에서 `all_images()` 를 호출해 실제 저장소 파일(`docker-compose.yml` 등)을 읽지만 read-only이고, 전역 변수·환경변수를 읽거나 쓰지 않으며 외부 서비스 호출도 없다. 신규 공개 API(함수/클래스)는 모두 이 파일 내부에서만 쓰이므로 기존 호출자에 대한 시그니처/인터페이스 영향도 없다.
  - 제안: 조치 불요 — 긍정 관찰.

- **[INFO]** 이번 diff 에 포함된 `review/consistency/2026/09/25/00_08_35/**` 산출물이 로컬 워크트리의 절대경로를 그대로 커밋에 남김
  - 위치: `review/consistency/2026/09/25/00_08_35/_retry_state.json:2-4` 등 (`/Volumes/project/private/clemvion/.claude/worktrees/minio-image-parity-guard/...`)
  - 상세: 프로젝트 컨벤션상 일관성 검토 산출물은 `review/consistency/**` 에 보존되는 것이 맞고(`CLAUDE.md` 정보 저장 위치 표), 이 자체는 의도된 저장이지 코드의 부작용은 아니다. 다만 로컬 머신 경로가 git 히스토리에 영구히 남는 점은 참고용으로 기록한다 — 다른 세션/머신에서는 무의미한 경로가 되므로 재현·디버깅 시 혼동 가능성이 낮게 있다.
  - 제안: 조치 불요 (기존 관례와 동일한 패턴). 필요시 추후 harness 개선 백로그 항목으로만 고려.

## 요약

이번 변경은 신규 harness 단위 테스트(`test_minio_image_parity.py`), 그 테스트를 트리거하는 CI pathspec 3줄 추가, 관련 문서(README/CHANGELOG/plan) 갱신, 그리고 `/consistency-check --impl-prep` 산출물 커밋으로 구성된다. 실제 프로덕션 코드(`docker-compose.yml`, k8s 매니페스트)는 이번 diff 에서 전혀 수정되지 않았고, 새 테스트 코드는 순수 함수 + read-only 파일 접근만 수행하며 전역 상태·환경변수·네트워크·기존 시그니처에 대한 영향이 없다. 유일하게 짚을 만한 것은 `_harness` import 가 유발하는 `sys.path` 전역 변경인데, 이는 스위트 전체가 공유하는 기존 관례이며 이 PR 이 새로 만든 부작용이 아니다. CI pathspec 확장은 문서화된 의도대로 정확히 3개 파일에 한정되어 트리거 범위 과확장 우려도 없다. 부작용 관점에서 이 변경은 위험이 낮다.

## 위험도
NONE
