# 테스트(Testing) 리뷰 — `.claude/tests/test_minio_image_parity.py` / `plan/in-progress/minio-image-parity-guard.md`

## 발견사항

- **[INFO]** `is_distroless()` 는 태그가 아니라 전체 이미지 문자열에 대한 부분 문자열 검사라 레지스트리/네임스페이스 세그먼트에 "distroless" 가 우연히 들어가면 오탐(false positive)할 수 있다.
  - 위치: `.claude/tests/test_minio_image_parity.py:94-95` (`is_distroless` 정의), 경계 테스트는 `:334-337` (`test_distroless_is_detected`)
  - 상세: `is_distroless(image)` 는 `"distroless" in image` 로 구현되어 있다. 실측:
    ```
    "pgsty-distroless-mirror/silo:tag@sha256:<64 hex>" → is_distroless 판정 True
    ```
    즉 실제로는 distroless 변형이 아닌데 경로 세그먼트 이름에 우연히 그 단어가 들어가면 가드가 거짓으로 실패한다. 반대 방향(진짜 distroless 태그를 놓치는 거짓 음성)은 없으므로 안전 쪽으로 치우친 결함이지만, `test_distroless_is_detected` 는 태그에 접미사로 붙은 경우/부재 경우만 검증하고 이 오탐 형태는 다루지 않는다. 현재 실제 파일(`pgsty/silo`)에서는 발생하지 않는 가상의 케이스라 실사용 리스크는 낮다.
  - 제안: `pin_violation` 이 이미 정규식으로 추출하는 `tag` 그룹을 재사용해 태그 성분에만 `"distroless"` 검사를 적용하거나, 최소한 이 오탐 경계를 명시하는 테스트 한 줄(`test_distroless_is_detected`에 서브케이스 추가)을 붙여 의도를 문서화한다.

- **[INFO]** `_render()` 헬퍼(실패 메시지 포맷터)는 전용 테스트가 없다.
  - 위치: `.claude/tests/test_minio_image_parity.py:176-177`
  - 상세: `test_all_six_places_found` / `test_all_places_use_one_image` 의 실패 메시지 생성에만 쓰인다. 버그가 있어도 판정 자체(`len(...)` 비교)는 영향받지 않고 실패 시 메시지만 깨지므로 거짓 음성 위험은 없다 — 우선순위는 낮다.

- **[INFO]** `_PINNED` 정규식의 "레지스트리 포트 뒤 latest" 회귀(3라운드 W1)를 고정한 경계 테스트(`test_pin_violation_edges`)가 2단계 경로(`registry.example:5000/pgsty/silo`)까지만 다루고, 3단계 이상 네임스페이스(`registry:5000/org/name:tag@sha256:…`)는 다루지 않는다.
  - 위치: `.claude/tests/test_minio_image_parity.py:312-332` (`test_pin_violation_edges`)
  - 상세: 직접 프로브해 보니 정규식 자체는 다단 네임스페이스에서도 올바르게 매칭한다(`registry.example:5000/org/pgsty/silo:tag@sha256:<64 hex>` → tag `"tag"` 정상 추출) — 기능 결함은 아니다. 다만 "포트 뒤 latest" 버그가 났던 자리이므로, 재발 방지 목적상 3단 이상 네임스페이스 케이스를 명시적으로 고정해 두면 향후 이 정규식을 손댈 때 회귀를 더 빨리 잡는다. 현재는 순수 커버리지 완결성 이슈다.

- **[WARNING]** (리뷰 대상 파일과는 무관 — 저장소 뮤테이션 관측 보고 의무) `python3 -m pytest .claude/tests -q` 전체 실행 시, 이 변경과 무관한 기존 테스트 2건이 실패한다: `test_consistency_bundle_priority.py::TheDocumentBeingEditedIsNeverOmittedTest::test_the_probe_leaves_no_residue`, `...::TheDiffOutranksTheFolderDumpTest::test_a_branch_plan_named_file_also_counts_as_on_topic`. 전자는 자신의 프로브가 실제 저장소 추적 파일 `spec/5-system/7-llm-client.md` 에 `<!-- uncommitted probe -->` 잔여물 3줄을 남기는 것을 스스로 검출해 실패하는 것으로, **그 테스트 자신의 cleanup 버그가 실제로 repo 파일을 오염시켰다**(`git status`에 `M spec/5-system/7-llm-client.md`로 관측). 원인이 `test_minio_image_parity.py` 나 이 plan 문서와는 무관함을 확인했다.
  - 처리: 뮤테이션 규약에 따라 `git show HEAD:spec/5-system/7-llm-client.md` 로 원본을 scratch(`mktemp -d`)에 뜬 뒤 `cp` 로 되돌렸다(`git checkout`/`restore` 미사용). 되돌린 후 `git status --short` 는 이 리뷰 세션의 산출물 디렉터리(`review/code/2026/09/25/01_31_05/`) 외에 깨끗함을 확인했다.
  - 이 plan 의 체크리스트 항목 `- [ ] python3 -m pytest .claude/tests -q 전체` 를 개발자가 나중에 체크할 때, 이 두 실패가 남아 있다면 "전체 GREEN" 으로 잘못 체크하거나 반대로 이 PR 자체가 깨졌다고 오판할 수 있다 — 어느 쪽이든 이 무관한 선행 결함을 별도로 인지해야 한다.

## 요약

`.claude/tests/test_minio_image_parity.py` 자체는 테스트 품질이 매우 높다. 순수 함수(`pin_violation`, `is_distroless`, `_dig`, `_seq`, `_expect_one`, `_image_value`)로 구조를 쪼개 각 헬퍼를 전용 `HelperBoundaryTest` 로, 배선(추출기)을 `ExtractorBoundaryTest` 로 별도 고정하는 설계는 테스트 용이성 관점에서 모범적이며, plan 문서(§B/§B-2/§B-3)가 4라운드에 걸쳐 뮤테이션 테스트로 분기 전수(16개, 전부 KILLED)를 실측·기록한 점도 신뢰도를 뒷받침한다. Mock 은 쓰지 않고 주입 텍스트(YAML 문자열)로 경계를 고정하며 실제 파일은 통합 성격의 `MinioImageParityTest` 에서만 읽어 격리가 잘 되어 있고, `None` 이 두 절 모두를 통과해 아무것도 증명 못한다는 점을 인지하고 `''`/`5` 를 따로 넣는 등 엣지 케이스 설계도 꼼꼼하다. 남은 갭은 `is_distroless` 의 경로-세그먼트 오탐 가능성과 `_render`/다단 네임스페이스 경계 미검증 정도로 전부 INFO 수준이다. 다만 리뷰 중 무관한 기존 테스트(`test_consistency_bundle_priority.py`)가 실제 저장소 파일을 오염시키는 것을 관측해 되돌렸으며, 이는 이 PR 의 결함은 아니지만 plan 의 "전체 테스트 통과" 체크 항목을 완료 처리하기 전에 개발자가 인지해야 할 선행 이슈다.

## 위험도

LOW
