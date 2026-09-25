# 문서화(Documentation) 리뷰 — k8s-avatar-policy

## 발견사항

- **[WARNING]** `scripts/minio/README.md` 가 정책 적용 위치를 "두 compose" 로만 서술 — 이번 변경으로 k8s Job 도 같은 정책을 적용하게 됐는데 반영되지 않음
  - 위치: `scripts/minio/README.md:8-9` (`` `docker-compose.yml` · `docker-compose.e2e.yml` 의 `createbuckets` 가 이 파일을 마운트해 `mc anonymous set-json` 으로 적용한다. ``)
  - 상세: 이 README 는 새 가드(`test_minio_bucket_policy_parity.py` docstring "scripts/minio/README.md calls it a deployment PREREQUISITE")와 새 k8s Job 주석(`k8s/overlays/local/infra-minio.yaml:109` "아바타 공개 읽기 정책 — 아바타 업로드의 **배포 선행 조건**이다(`scripts/minio/README.md`)")이 둘 다 근거로 인용하는 문서다. 그런데 README 본문은 여전히 "두 compose 파일이 이 파일을 **마운트**해서 적용한다"고만 적어, 세 번째 적용 지점(k8s Job, 파일을 마운트하지 못해 heredoc 사본으로 적용)의 존재와 그 메커니즘 차이가 이 README 에서는 전혀 드러나지 않는다. `test_minio_image_parity.py`/`test_minio_bucket_policy_parity.py` 두 가드 모두 "손으로 적은 사본이 여러 곳에 있으면 부분 반영이 난다"는 것을 정확히 전제로 삼고 있는 저장소인데, 그 전제를 설명하는 README 자체가 세 번째 사본을 언급하지 않는 것은 같은 클래스의 작은 재발이다.
  - 제안: README 에 "k8s local 오버레이의 Job `minio-create-bucket` 은 이 파일을 직접 마운트하지 못해(kustomize 오버레이-루트 제약) 같은 정책을 heredoc 으로 복제해 적용한다 — 드리프트는 `test_minio_bucket_policy_parity.py` 가 고정한다" 한 문단 추가.

- **[INFO]** k8s Job 인라인 주석과 새 가드 docstring 간 서술은 서로 정확히 일치 — 별도 조치 불필요
  - 위치: `k8s/overlays/local/infra-minio.yaml:109-121`, `.claude/tests/test_minio_bucket_policy_parity.py:1-40`
  - 상세: kustomize 마운트 제약 문구(`security; file … is not in or below …`), `set -e` 필요성, `<<'EOF'` 치환 불가, `ListBucket` 배제 근거 등 4곳(Job 주석·가드 docstring·plan·CHANGELOG)이 표현은 다르지만 내용이 서로 어긋나지 않는다. `docker-compose.yml` 의 `exit 0` 이 실패를 삼킨다는 비대칭도 Job 주석·plan·consistency 리뷰(INFO2) 세 곳에서 일관되게 "별 갭"으로 명시돼 있어 최신 상태다.

- **[INFO]** `.claude/tests/README.md` 카탈로그 신규 행과 `harness-checks.yml` pathspec 주석 갱신은 `--impl-prep` W1 처분대로 정확히 반영됨 — 재확인만
  - 위치: `.claude/tests/README.md:49` (기존 `test_minio_image_parity.py` 행 바로 아래 배치), `.github/workflows/harness-checks.yml:92-100`
  - 상세: 신규 가드 docstring 첫 문단이 `test_minio_image_parity.py` 를 명시적으로 언급하며 "IMAGE 참조" vs "POLICY" 축 차이를 구분하고, `harness-checks.yml` 주석도 "두 가드가 **다른 축**으로 본다"는 문장으로 갱신됐다 — consistency-check WARNING 1건(naming_collision)의 제안 (a)(b)(c) 세 가지가 모두 적용됐다.

- **[INFO]** CHANGELOG 항목 — 형식·내용 모두 기존 관례와 일치
  - 위치: `CHANGELOG.md:3-17`
  - 상세: 증상(실측 403) → 원인 → 처방 → drift 가드 → pathspec 순서로, 바로 아래 있는 `#1392`(이미지 패리티) 항목과 같은 구조를 따른다. 이슈 번호(`#1258`) 인용도 유지됨. 별도 수정 불필요.

## 요약

이번 변경은 프로젝트 관례(측정된 근거를 docstring/주석/plan/CHANGELOG 네 곳에 일관되게 남기는 방식)를 충실히 따랐고, `--impl-prep` 단계에서 나온 유일한 WARNING(가드 이름 인접성으로 인한 스코프 혼동 우려)도 정확히 처분대로 반영됐다. 다만 이번 변경으로 정책 적용 지점이 "compose 둘"에서 "compose 둘 + k8s Job(heredoc 사본)"으로 늘었는데, 그 사실 관계의 SoT 역할을 하는 `scripts/minio/README.md` 자체는 갱신되지 않아 여전히 "두 compose 파일만 마운트해 적용한다"고 서술한다. 이는 이번 코드가 가드로 막으려는 "부분 반영/드리프트" 클래스와 정확히 같은 모양의 문서 갭이므로 WARNING 으로 표시한다. 나머지 문서화 표면(하네스 README 카탈로그, CI pathspec 주석, CHANGELOG, plan, k8s Job 인라인 주석)은 서로 정합하고 실측 근거가 명확하다.

## 위험도
LOW
