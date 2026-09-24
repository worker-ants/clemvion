# 유지보수성(Maintainability) Review

## 발견사항

- **[INFO]** k8s 픽스처 YAML 리터럴이 세 곳에 거의 그대로 중복된다
  - 위치: `.claude/tests/test_minio_image_parity.py:192`(`_k8s` 헬퍼의 StatefulSet 부분), `.claude/tests/test_minio_image_parity.py:224`(`test_k8s_duplicate_resource_is_named` 의 `sts`), `.claude/tests/test_minio_image_parity.py:242`(`test_k8s_missing_resource_is_named` 의 `sts_only`) — 세 곳 모두 `"kind: StatefulSet\nmetadata: {name: minio}\nspec: {template: {spec: {containers: [{name: minio, image: a}]}}}\n"` 를 그대로 반복. Job 쪽도 `:194`, `:228`, `:328`(`job_ok`) 세 곳에 `"kind: Job\nmetadata: {name: minio-create-bucket}\n...containers: [{name: mc, image: a}]..."` 형태가 반복된다.
  - 상세: 이 PR 의 핵심 서사는 "같은 검사를 자리마다 복제하면 그중 하나만 고치고 나머지를 놓친다"(docstring 102~106줄, plan §B-3)이다. 프로덕션 로직(`_dig`/`_seq`/`_expect_one`/`_image_value`)은 그 원칙대로 헬퍼 하나로 모았지만, 그 헬퍼들을 검증하는 **픽스처 문자열 자체**는 세 테스트 메서드에 하드코딩되어 반복된다. 예컨대 `metadata: {name: minio}` 의 스펠링이나 `containers` 스키마가 바뀌면 세 곳을 동시에 고쳐야 하고, 하나만 고치면 그 테스트가 조용히 다른 모양을 검증하게 된다.
  - 제안: `_sts_ok()` 같은 정적 헬퍼(또는 모듈 상수)로 "유효한 StatefulSet/Job YAML 조각"을 한 곳에서 만들고, 세 테스트가 그것을 재사용하도록 한다. 이미 `_k8s()` 가 Job 쪽을 파라미터화(`job_containers`)해 놓은 것과 같은 패턴을 StatefulSet 쪽에도 적용하면 된다.

- **[INFO]** `all_images()` 의 라벨 문자열이 경로 상수와 별도로 손으로 다시 적혀 있다
  - 위치: `.claude/tests/test_minio_image_parity.py:168`(`all_images` 함수) — `DEV_COMPOSE`/`E2E_COMPOSE`/`K8S_MINIO` 상수(`:56`~`:58`)가 이미 실제 경로를 담고 있는데, `compose_images("docker-compose.yml", ...)` 처럼 같은 파일명을 리터럴로 다시 적는다.
  - 상세: 두 값(경로 상수의 파일명, 라벨 리터럴)이 같은 사실을 두 군데서 표현한다. 파일을 옮기거나 이름을 바꿀 때 상수는 고치고 라벨 문자열은 깜박 잊어도 아무 것도 실패하지 않는다 — 실패 메시지의 place 문자열만 실제 경로와 어긋난 채로 남는다. 이 가드 자체가 "표시 이름이 실제와 어긋나도 아무도 못 챈다"는 종류의 drift 를 노리는 문서이니만큼(README 39~40줄, 부분 반영 누락 사례) 자기 자신의 라벨 문자열도 같은 리스크를 안고 있다는 점이 눈에 띈다.
  - 제안: `f"{DEV_COMPOSE.relative_to(REPO_ROOT)}"` 처럼 라벨을 경로 상수에서 파생시키면 이 중복이 사라진다. 다만 심각도는 낮다 — 세 곳뿐이고 오탐 시 영향은 에러 메시지 텍스트에 국한된다.

- **[INFO]** `_dig` 는 첫 실패 지점에서 조기 종료하지 않고 남은 키를 계속 순회한다
  - 위치: `.claude/tests/test_minio_image_parity.py:108`(`_dig` 함수 본문)
  - 상세: `node = node.get(key) if isinstance(node, dict) else None` 형태의 for 루프는, `node` 가 한 번 `None` 이 되면 이후 키들에 대해서도 `isinstance(None, dict)` 를 매번 평가하며 계속 `None` 을 대입한다. 결과는 정확하지만("첫 실패 이후는 항상 `{}`") 의도("매핑이 아니면 즉시 포기")를 코드가 명시적으로 말하지 않는다.
  - 제안: `if not isinstance(node, dict): return {}` 로 조기 반환하면 동작은 동일하되 "매핑이 아닌 순간 바로 포기한다"는 의도가 더 직접적으로 드러난다. 실질적 영향은 미미하다(k8s/compose YAML 은 키 깊이가 3~4 수준).

## 요약

`.claude/tests/test_minio_image_parity.py` 는 4라운드 리뷰를 거치며 "검사를 자리마다 복제하지 않는다"는 원칙을 프로덕션 추출 로직(`_dig`/`_seq`/`_expect_one`/`_image_value` + 각 헬퍼 전용 경계 테스트)에 일관되게 적용한, 이 저장소 기준으로도 상당히 공들인 가드다. 함수는 짧고 각자 단일 책임을 가지며, 중첩은 얕고, 매직 넘버(`SHA256_HEX_LEN`)는 이름을 얻었고, 정규식·헬퍼마다 "왜"를 설명하는 주석이 붙어 있어 가독성이 좋다. 남은 지적은 모두 부수적이다 — 프로덕션 코드가 없앤 "자리마다 복제" 패턴이 테스트 픽스처 YAML 문자열 세 군데에는 여전히 남아 있고, `all_images()` 의 표시용 라벨이 경로 상수와 별도로 손으로 다시 적혀 있으며, `_dig` 의 순회가 조기 종료하지 않는다. 세 건 모두 정확성에는 영향이 없고 발견 난이도도 낮아 INFO 수준이며, 이 변경을 막을 이유는 없다. `plan/in-progress/minio-image-parity-guard.md` 는 코드가 아닌 작업 로그로, 뮤턴트 예측·실측을 표로 투명하게 남겨 앞으로 같은 파일을 만지는 사람이 "왜 이렇게 짜여 있는지" 되짚기 쉽게 해 준다.

## 위험도

LOW
