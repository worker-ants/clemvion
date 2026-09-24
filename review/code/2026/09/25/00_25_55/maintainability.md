# 유지보수성(Maintainability) 리뷰

## 발견사항

- **[WARNING]** `k8s_images` 의 4단 중첩 `.get()` 체인이 파일 내 다른 코드보다 눈에 띄게 읽기 어렵다
  - 위치: `.claude/tests/test_minio_image_parity.py:98-100`
    ```python
    containers = (
        ((matches[0].get("spec") or {}).get("template") or {}).get("spec") or {}
    ).get("containers") or []
    ```
  - 상세: `spec → template → spec → containers` 4단을 괄호 중첩 한 식으로 눌러 담아, 괄호 짝을 눈으로 추적해야 의미가 들어온다. 같은 파일의 다른 `or {}` 방어 체인(예: `compose_images` 의 `(services.get(svc) or {}).get("image")`, `k8s_images` 자체의 `(d.get("metadata") or {}).get("name")`)은 모두 1단이라 문제가 없고, 저장소 전반(`test_required_check_skip_jobs.py`, `test_workflow_run_inputs_covered.py` 등)의 관용구도 대부분 1~2단에서 멈춘다. 이 자리만 4단으로 깊어진 것은 k8s 매니페스트의 `spec.template.spec.containers` 경로 자체가 깊기 때문이지만, 코드가 그 깊이를 그대로 한 표현식에 반영해 국지적으로 가독성이 떨어진다. (다만 `test_k8s_missing_container_is_named` 가 이 경로를 실제로 exercise 하므로 정확성 위험은 낮다 — 순수 가독성 지적이다.)
  - 제안: 중간 단계를 이름 있는 변수로 쪼개거나(`pod_spec = matches[0].get("spec") or {}`; `template = pod_spec.get("template") or {}`; `containers = ((template.get("spec") or {}).get("containers")) or []`), 반복되는 "dict 안전 탐색" 자체를 작은 헬퍼(`_dig(d, *keys)`)로 뽑아 이 파일이 표방하는 "이름으로 실패를 말한다" 스타일과 통일한다.

- **[INFO]** `all_images()` 의 3줄이 근소하게 반복된다
  - 위치: `.claude/tests/test_minio_image_parity.py:108-113` (`all_images` 함수)
  - 상세: `images.update(...images(label, path.read_text(encoding="utf-8")))` 패턴이 compose 두 번, k8s 한 번 반복된다. 단, docstring(및 plan 문서)이 "새 매니페스트는 손으로 자리 목록·pathspec 에 추가"를 명시적 설계로 못박고 있어(발견을 자동화하지 않음 — 이 저장소의 다른 가드들도 "손 등록" 을 의도적으로 택하는 관용구), 3줄짜리 반복을 지금 추상화하면 오히려 그 의도(새 자리 추가를 명시적으로 강제)를 흐릴 수 있다. 결함이라기보다 참고 사항.

## 요약

신규 파일 `test_minio_image_parity.py` 는 이 저장소 `.claude/tests/` 의 기존 관례(모듈 레벨 상수로 대상 등록, `AssertionError` 서브클래스로 "어디서 실패했는지 이름을 댄다", `*BoundaryTest` 로 추출기를 실제 파일보다 먼저 injected text 로 고정, docstring 에 배경·회귀 형태·트리거 근거를 상세히 남기는 서술 스타일)을 정확히 따르고 있고, 함수는 짧고 단일 책임이며 네이밍도 명확하다. `harness-checks.yml`·`CHANGELOG.md`·`.claude/tests/README.md`·plan 문서의 변경도 각각 기존 포맷·인접 항목의 서술 밀도와 일관된다. 유일한 국지적 흠은 `k8s_images` 내부의 4단 중첩 `.get()` 체인으로, 같은 파일·같은 저장소의 다른 자리보다 한 단계 더 깊어 가독성이 떨어지지만 테스트로 실제 동작이 고정돼 있어 정확성 리스크는 낮다. 전반적으로 유지보수성 관점에서 이 변경은 양호하다.

## 위험도

LOW
