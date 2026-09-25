# 문서화(Documentation) 리뷰 — k8s 아바타 정책 가드

## 검증 방법

프롬프트에 포함된 4개 파일(`test_minio_bucket_policy_parity.py`, `scripts/minio/README.md`,
`plan/in-progress/k8s-avatar-policy.md`, `k8s/overlays/local/infra-minio.yaml`) 외에, 이 변경이
문서화 교차 참조로 걸어 둔 대상들을 실제 저장소에서 직접 열어 대조했다(저장소에 아무것도 쓰지
않음 — `git status --short` 로 확인, 변경 없음):

- `git diff --stat origin/main...HEAD` 로 실제 변경 파일 전체 목록 확인 — `CHANGELOG.md`,
  `.claude/tests/README.md`, `.github/workflows/harness-checks.yml` 세 곳도 이번 diff에 포함됨
  (프롬프트에는 발췌되지 않았으나 plan 체크리스트가 언급하므로 대조 대상에 넣었다).
- `CHANGELOG.md` diff — 신규 Unreleased 항목 확인.
- `.claude/tests/README.md` diff — 신규 가드 카탈로그 행 확인, 이미지 가드 행 바로 아래 배치.
- `.github/workflows/harness-checks.yml` diff — pathspec 주석이 "두 가드·두 축"으로 갱신되고
  `scripts/minio/avatars-public-read.json` 이 새 항목으로 추가됨을 확인.
- `docker-compose.yml` / `docker-compose.e2e.yml` 의 `createbuckets` 블록, `scripts/minio/avatars-public-read.json`
  실제 내용, `k8s/base/configmap.yaml` 의 `S3_BUCKET` 값 — README·YAML 주석·테스트 docstring의
  구체적 주장(파일 마운트 방식, 버킷명, `set-json` 사용)과 모두 일치.
- `.claude/tests/test_minio_image_parity.py` — 신규 가드와 "다른 축" 관계를 설명한다는 주장 및
  클래스 독스트링 유무 컨벤션(주 parity 테스트 클래스 `MinioImageParityTest` 도 클래스 독스트링이
  없음)을 대조.

## 발견사항

이번 변경분에서 **CRITICAL/WARNING 등급의 문서화 결함은 발견되지 않았다.** 아래는 참고용 INFO 뿐이다.

- **[INFO]** 새 가드 클래스 `BucketPolicyParityTest` 에 클래스 독스트링이 없다.
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:162` (`class BucketPolicyParityTest(unittest.TestCase):`)
  - 상세: 같은 파일의 `ExtractorBoundaryTest`(162줄 이전, "Each failure is named by its reason…")는
    클래스 독스트링이 있는데 주 parity 테스트 클래스는 없다. 다만 이는 새로운 결함이 아니라
    형제 가드 `test_minio_image_parity.py` 의 `MinioImageParityTest` 도 동일하게 클래스 독스트링이
    없는 기존 컨벤션이며, 모듈 독스트링이 이미 각 assertion 을 1~7 번으로 상세히 서술하고 각
    테스트 메서드 이름 자체가 자기서술적이라 실질적 정보 손실은 없다.
  - 제안: 조치 불요(기존 컨벤션과 일관). 향후 형제 파일들을 함께 정리할 계획이 생기면 그때
    일괄 추가 검토.

- **[INFO]** `scripts/minio/README.md` 11~17줄 구간에서 "이 파일"이라는 대명사가 여러 문장에
  걸쳐 반복 사용되어(정책 JSON 파일을 가리킴), 마지막 문장("이 파일은 그 가드의 CI 트리거에
  등재돼 있어…")만 놓고 보면 직전에 언급된 `test_minio_bucket_policy_parity.py` 를 가리키는
  것으로 오독될 여지가 있다.
  - 위치: `scripts/minio/README.md:15-17`
  - 상세: 실제로는 `harness-checks.yml` pathspec 에 새로 등재된 것은
    `scripts/minio/avatars-public-read.json`(정책 파일) 이지 가드 파일 자신이 아니다(diff로 확인).
    문장 자체는 사실관계상 정확하지만, 문단이 길어 대명사 선행사 추적이 다소 어렵다.
  - 제안: "이 파일은" 대신 "정책 파일은" 처럼 명시적 명사로 바꾸면 오독 여지가 줄어든다.
    (선택 사항 — 리뷰 차단 사유 아님)

## 항목별 점검 결과

1. **독스트링/JSDoc** — 신규 모듈(`test_minio_bucket_policy_parity.py`)의 모듈 독스트링이
   매우 상세하다: 형제 가드와의 축 구분, 존재 이유, kustomize 제약, 7개 assertion 각각의 회귀
   형태, 초안 문구가 실측으로 반증된 이력까지 기록. 모든 공개 헬퍼 함수(`job_script`,
   `heredoc_policy`, `granted_actions`, `_job_yaml`)에 독스트링 있음. 결함 없음.
2. **README 업데이트** — `scripts/minio/README.md` 에 "세 번째 적용 지점"(k8s) 섹션이 정확히
   추가되어 있고, 실측 커맨드·응답까지 인용되어 있다. 결함 없음.
3. **API 문서** — 이 변경은 API 엔드포인트를 바꾸지 않는다(k8s 매니페스트 + 버킷 정책 + 하네스
   테스트). 해당 없음.
4. **주석 정확성** — `k8s/overlays/local/infra-minio.yaml` Job 컨테이너의 인라인 주석(109~121줄)이
   실제 스크립트 내용(heredoc, `set -e`, `set-json` 대상)과 정확히 일치함을 확인. compose 파일과의
   `exit 0` 비대칭도 주석에 명시(`--impl-prep` INFO 2 반영). 결함 없음.
5. **인라인 주석** — heredoc 안 정책 JSON 자체에는 별도 주석이 없지만 바로 위 블록 주석이
   목적·이유·연관 테스트를 모두 설명해 충분하다. 결함 없음.
6. **변경 이력** — `CHANGELOG.md` 에 신규 "Unreleased" 항목이 추가되어 있고, 근본 원인·실측·
   가드 방식이 요약돼 있다(diff로 확인). 결함 없음.
7. **설정 문서** — 새 환경변수는 없음(`$S3_BUCKET` 은 기존 base configmap 값 재사용,
   `k8s/base/configmap.yaml:29` 에서 확인). `harness-checks.yml` pathspec 갱신도 주석과 함께
   반영되어 있다. 결함 없음.
8. **예제 코드** — 새 사용자 대상 기능이 아니라 배포 인프라 정책이라 별도 사용 예제는 불필요.
   README 의 실측 `curl`/`mc` 커맨드가 사실상 예제 역할을 한다. 결함 없음.

## 요약

신규 하네스 가드(`test_minio_bucket_policy_parity.py`)와 이를 둘러싼 문서 4종
(`scripts/minio/README.md`, `plan/in-progress/k8s-avatar-policy.md`,
`k8s/overlays/local/infra-minio.yaml` 인라인 주석, 그리고 diff에 포함된 `CHANGELOG.md` ·
`.claude/tests/README.md` · `harness-checks.yml` 주석)은 서로 그리고 실제 코드/설정 파일과 모두
일치함을 확인했다. 모듈 독스트링은 회귀 형태별 근거와 초안이 실측으로 반증된 이력까지 정직하게
남기고 있어 이 프로젝트의 "측정된 주장" 관례를 잘 따른다. CHANGELOG·하네스 카탈로그·CI
pathspec 갱신도 누락 없이 함께 커밋되어 있다. 발견된 두 건은 모두 INFO 등급의 선택적 개선
사항(클래스 독스트링 부재는 기존 컨벤션과 일관, 대명사 참조 모호성은 문맥상 오독 위험이 낮음)
이며 병합을 막을 사유가 없다.

## 위험도

NONE
