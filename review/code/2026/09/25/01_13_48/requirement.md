# Requirement Review — MinIO 이미지 일치 가드

## 발견사항

- **[WARNING]** plan 체크리스트의 "측정된" 서브테스트 수가 3라운드 수정 뒤 갱신되지 않아 현재 거짓이다
  - 위치: `plan/in-progress/minio-image-parity-guard.md:110`–`111` ("1 · 2라운드 조치로 **15개**(2026-09-25, `pytest -q` 15 passed · 20 subtests …)")
  - 상세: 실측 — `python3 -m pytest .claude/tests/test_minio_image_parity.py -q` → **`15 passed, 25 subtests passed`** (테스트 개수 15는 맞으나 서브테스트는 20이 아니라 25). `git log`로 추적하면 "20 subtests"는 2라운드 RESOLUTION 커밋 `749ee1499`에서 기록됐고, 그 뒤 3라운드 W1 수정 커밋 `9d734571e`가 `test_pin_violation_edges`에 `registry:port` 관련 good/bad 케이스를 추가하면서 서브테스트가 5개 늘었다(9→14 등, 합계 20→25). 뒤이은 3라운드 RESOLUTION 커밋 `48bab62ca`는 `## D` 처분표만 갱신하고 `## C` 체크리스트의 이 숫자는 그대로 두어, 최신 코드 상태와 plan 서술이 어긋난 채 남았다.
  - 제안: 체크리스트 항목을 `pytest -q` 재실행 결과("15 passed · 25 subtests")로 갱신할 것. plan 서술은 최신 커밋 반영 여부를 매 RESOLUTION마다 함께 확인해야 한다(반복된 실패 패턴).

- **[INFO]** 이미지 pinning/버전 정책(latest 금지·digest 필수·distroless 금지)을 규정하는 `spec/` 문서가 없음
  - 위치: `.claude/tests/test_minio_image_parity.py` 전체(특히 `pin_violation`, `is_distroless`)
  - 상세: `spec/0-overview.md` §2.7(Object Storage)은 오브젝트 스토리지의 제품 요구사항(S3 호환·버킷 정책 등)만 다루고, 배포 이미지의 버전 고정 정책은 다루지 않는다. 이 가드는 `.claude/**` + `.github/workflows/**` + `plan/**` 범위의 harness 전용 변경으로 CLAUDE.md의 harness 소유권·리뷰 게이트 스코프 예외에 부합하며, spec 신설을 요구하는 제품 계약이 아니다. SPEC-DRIFT가 아니라 spec이 애초에 이 영역을 다루지 않는 회색지대.
  - 제안: 조치 불요(이전 라운드 `review/code/2026/09/25/00_56_30` INFO 5와 동일 결론, 재확인만).

- **[INFO]** `_PINNED` 정규식·`pin_violation`/`is_distroless` 술어의 엣지 케이스(빈 태그·digest-only·대문자 hex·63/65자리 hex)를 직접 실행해 재확인 — 전부 안전 방향(거부)으로 동작
  - 위치: `.claude/tests/test_minio_image_parity.py:74`–`76`(`_PINNED`), `:79`–`88`(`pin_violation`)
  - 상세: `python3 -c` 로 5개 경계 입력을 넣어 전부 `NO MATCH`(거부)임을 실측 확인. 3라운드 W1(포트 뒤 `latest` 거짓 음성)은 커밋 `9d734571e`로 수정되었고 현재 정규식은 마지막 경로 구성요소 뒤에서만 태그를 매칭해 재현 실패(정상 동작 확인).
  - 제안: 조치 불요(긍정 확인).

## 요약

핵심 가드 로직(`compose_images`/`k8s_images`/`pin_violation`/`is_distroless`/`_mapping`)은 docstring이 서술한 4개 회귀 형태(자리 목록 축소·값 불일치·미고정·distroless)를 정확히 구현하고 있고, `PlaceNotFound`로 모든 실패 경로에서 자리를 이름으로 특정해 반환하며 미완성 TODO/FIXME는 없다. `harness-checks.yml` pathspec 3줄, `.claude/tests/README.md` 카탈로그, CHANGELOG 항목, `plan/in-progress/self-hosting-deployment.md`의 교차 참조 체크박스(W3 처분)까지 모두 실재 파일에서 실측 확인됐고 트래커(`spec-draft-nullable-notation-followups.md`)로 옮겨졌다는 아바타 정책 항목도 실재한다. 유일한 실질 결함은 plan 체크리스트에 남은 "20 subtests"라는 stale 측정값(현재 실측은 25)으로, 3라운드 W1 수정 뒤 갱신이 누락된 문서 정합성 문제이며 코드 자체의 결함은 아니다. 관련 spec 영역(`spec/0-overview.md` §2.7)은 이미지 버전 정책을 다루지 않아 spec fidelity 위반은 없다(회색지대 INFO).

## 위험도
LOW
