# 부작용(Side Effect) 리뷰

## 발견사항

- **[INFO]** 새 테스트가 매 테스트 메서드마다 3개 파일을 디스크에서 다시 읽는다 (설계상 의도, 부작용 아님)
  - 위치: `.claude/tests/test_minio_image_parity.py:266-267` (`MinioImageParityTest.setUp`)
  - 상세: `setUp`이 매 테스트마다 `all_images()`를 새로 호출해 `docker-compose.yml`·`docker-compose.e2e.yml`·`k8s/overlays/local/infra-minio.yaml` 세 파일을 다시 `read_text()`한다. 파일시스템 접근은 반복되지만 읽기 전용이고 순수 함수(`compose_images`/`k8s_images`)로 매번 새 `dict`를 만들어 반환하므로 테스트 간 공유 상태 오염은 없다. 부작용 관점에서는 문제 없음(성능 관점의 참고 사항일 뿐).
  - 제안: 조치 불요.

- **[INFO]** `_harness.REPO_ROOT` import가 프로세스 전역 `sys.path`를 변경하는 기존 동작에 편승
  - 위치: `.claude/tests/test_minio_image_parity.py:54` (`from _harness import REPO_ROOT`) → `.claude/tests/_harness.py`의 모듈 최상단 `sys.path.insert(0, str(HOOKS_DIR))`
  - 상세: 이번 diff가 `_harness.py` 자체를 수정한 것은 아니며, 다른 harness 테스트들도 이미 같은 방식으로 import해 `sys.path`를 공유 변경하는 기존 관례다. 새 테스트가 이 관례에 새로 편승한 것뿐이라 이번 변경이 도입한 새로운 전역 부작용은 아니다.
  - 제안: 조치 불요 — 기존 harness 관례이며 이번 review 스코프(3개 대상 파일) 밖.

## 스코프 확인 메모

`git diff --stat origin/main...HEAD`로 확인한 결과, 이번 변경은 리뷰 대상 3개 파일 외에도 `.github/workflows/harness-checks.yml`(pathspec 3줄 추가), `CHANGELOG.md`, `.claude/tests/README.md`를 함께 건드린다. 이 파일들은 이번 side-effect 리뷰의 "리뷰 대상 파일" 목록에 포함되지 않아 상세 분석 대상에서 제외했다(다른 reviewer 스코프로 추정). `harness-checks.yml`의 pathspec 추가는 CI 트리거 표면을 넓히는 변경이지만, plan 문서(`minio-image-parity-guard.md` §A "트리거")에 그 의도와 근거가 명시되어 있어 의도된 변경으로 보인다 — 저장소 파일은 건드리지 않고 확인만 했다(`git status --short` 결과 미변경, review 산출물 디렉터리만 untracked).

## 요약

리뷰 대상 3개 파일 중 `.claude/tests/test_minio_image_parity.py`는 순수하게 읽기 전용인 신규 테스트 파일이다 — 세 매니페스트 파일을 `read_text()`로 읽어 YAML로 파싱할 뿐 파일 생성·수정·삭제, 전역 변수 변경, 환경 변수 접근, 네트워크 호출, 이벤트/콜백 변경이 전혀 없다. 모든 함수(`pin_violation`, `is_distroless`, `compose_images`, `k8s_images`, `all_images`, `_mapping`, `_render`)는 새로 도입된 것으로 기존 시그니처를 바꾸지 않으며 외부 호출자에게 영향을 줄 공개 API 변경도 없다. 나머지 두 파일(`self-hosting-deployment.md`, `minio-image-parity-guard.md`)은 순수 문서(plan) 변경으로 실행 코드에 어떠한 영향도 주지 않는다. 부작용 관점에서 이 변경 세트는 안전하다.

## 위험도

NONE
