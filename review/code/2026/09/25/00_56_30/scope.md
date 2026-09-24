# 변경 범위(Scope) 리뷰

## 발견사항

- **[WARNING]** 무관한 별개 결함(아바타 공개 정책 누락)이 이번 작업 파일 편집에 편승해 추가됨
  - 위치: `plan/in-progress/self-hosting-deployment.md:57-58`
  - 상세: 이번 작업은 「MinIO 계열 이미지 참조 6곳의 일치를 하네스 테스트로 고정」이다. 그런데 같은 커밋에서
    `self-hosting-deployment.md` §3 의 "MinIO 부팅 후 버킷 자동 생성" 체크박스 바로 아래에 **아바타 공개
    정책 누락**이라는, 이미지 태그/다이제스트 일치와는 무관한 별개 결함을 새 체크박스로 추가했다
    (`- [ ] 버킷 생성과 함께 **아바타 공개 정책**도 적용 — 방법과 금지 프리셋은 scripts/minio/README.md`).
    이 항목은 이번 태스크의 `--impl-prep` 처분표(`plan/in-progress/minio-image-parity-guard.md` §D, W3 행)
    에 "같은 §3 의 «버킷 자동 생성» 줄이 아바타 공개 정책을 빠뜨린 것도 함께 적었다(k8s 누락과 같은 형태)"
    라고 스스로 명시해 투명하게 공개되어 있고, 실제 동작 변경은 없는 plan 문서(TODO 체크박스)일 뿐이라
    위험은 낮다. 그러나 순수하게 "요청된 변경" 기준으로 보면 이 작업(이미지 참조 일치 가드)의 스코프
    밖이며, 다른 미착수 태스크(`self-hosting-deployment`)의 계획에 발견한 김에 끼워 넣은 항목이다.
  - 제안: 이미 투명하게 처분표에 사유가 기록돼 있어 되돌릴 필요는 없어 보이지만, 향후에는 "지금 만지는
    파일에서 우연히 발견한 무관 결함"은 같은 diff 에 묶기보다 별도 plan 항목이나 커밋으로 분리하는 편이
    범위 추적을 더 깨끗하게 유지한다.

- **[INFO]** 같은 파일에 이번 가드에 대한 정방향 교차 참조를 추가 — 스코프상 정당함
  - 위치: `plan/in-progress/self-hosting-deployment.md:59-62`, `:73-74`
  - 상세: "이 파일이 오브젝트 스토리지 이미지를 쓰면 `test_minio_image_parity.py` 의 자리 목록과
    `harness-checks.yml` pathspec 에 추가" 라는 문구를 §3·§4 에 추가했다. 이는 신규 테스트 파일
    자신의 docstring("Scope is the places that exist TODAY... A new manifest ... must be added to the
    place lists below AND to the pathspecs")이 명시한 한계 — 가드는 자신에게 등록되지 않은 파일을
    발견할 수 없다 — 를 향후 실제로 새 매니페스트를 추가할 태스크에 미리 알리는 순수 문서화이며, 코드나
    동작 변경이 전혀 없다. `minio-image-parity-guard.md` §D W3 처분에서 명시적으로 근거를 남겼고
    (`--impl-prep review/consistency/2026/09/25/00_08_35 plan_coherence W3`), `#1325` 가 실제로 겪은
    "부분 반영" 실패 클래스를 재발 방지하려는 목적이 분명하다. 위 WARNING 항목과 달리 이 부분은 이번
    작업의 직접적 존재 이유(6곳 일치 가드)와 인과관계가 있어 범위 이탈로 보지 않는다.

- **[INFO]** `.github/workflows/harness-checks.yml` 변경은 정확히 필요한 3줄 + 근거 주석만 추가
  - 위치: `.github/workflows/harness-checks.yml:92-98` (pathspecs 블록, `pnpm-workspace.yaml` 다음)
  - 상세: 새 테스트 파일의 트리거 요구사항(`test_harness_checks_paths_coverage.py`)을 충족하기 위해
    `docker-compose.yml` · `docker-compose.e2e.yml` · `k8s/overlays/local/infra-minio.yaml` 세 파일을
    개별로 등재했다. 주석에서 "`k8s/**` 로 넓히지 않는다(무관한 매니페스트 변경마다 스위트가 돈다) —
    파일 단위로만" 이라고 명시해, 오히려 스코프를 의도적으로 좁게 유지하려는 근거까지 남겼다. 이 파일의
    다른 부분(타임아웃 주석, 다른 pathspec 항목 등)은 손대지 않았다 — diff 확인 결과 삽입 7줄이 전부다.
    스코프 이탈 없음.

- **[INFO]** `.claude/tests/test_minio_image_parity.py` 는 전량 신규 파일로, 범위 이탈 없음
  - 상세: docstring·추출기(`compose_images`/`k8s_images`)·판정 함수(`pin_violation`/`is_distroless`)·
    두 테스트 클래스 모두 "6곳 이미지 일치 검증" 이라는 단일 목적에 수렴한다. 불필요한 임포트, 미사용
    코드, 관련 없는 리팩토링, 포맷팅 잡음은 발견되지 않았다. 2·3라운드 커밋(`c8a1a59b6`, `647b60ad8`,
    `69a5e22b9`)에서 추가된 분기 경계 테스트들도 전부 이 파일 자체에 국한됐다(`git show --stat` 로 확인).

- **[INFO]** `plan/in-progress/minio-image-parity-guard.md` 는 이번 태스크 자신의 신규 plan 문서
  - 상세: frontmatter(`owner: developer`, `spec_impact: none`)·설계·뮤턴트 실측·체크리스트·
    `--impl-prep` 처분표로 구성된 신규 문서이며, 다른 목적의 내용이 섞여 있지 않다. 취소선 정정
    (§A 단언 1, §C "~~7개~~") 은 자기 반증형 소정정 관례를 따른 것으로 실측 근거(뮤턴트 M3, `pytest -q`
    15 passed)가 함께 적혀 있어 근거 없는 주장이 아니다.

## 요약

핵심 변경(신규 하네스 테스트 `test_minio_image_parity.py`와 `harness-checks.yml` pathspec 3줄)은 "MinIO
이미지 참조 6곳의 일치를 가드로 고정한다"는 요청 범위에 정확히 부합하며, 불필요한 리팩토링·포맷팅 잡음·
미사용 임포트·설정 오염이 없다. 유일한 스코프 이탈은 `self-hosting-deployment.md` 에 이번 가드와 무관한
"아바타 공개 정책 누락" 체크박스 한 줄을 발견한 김에 끼워 넣은 것인데, 이는 코드 변경이 아닌 TODO 항목이고
처분표에 사유가 투명하게 기록돼 있어 실질적 위험은 낮다. 같은 파일에 추가된 "새 매니페스트는 가드 목록에
수동 등록해야 한다"는 교차 참조는 이번 가드의 설계상 한계를 직접 겨냥한 것이라 범위 이탈로 보지 않는다.

## 위험도

LOW
