# 신규 식별자 충돌 검토 — k8s-avatar-policy (--impl-prep)

## 대상 범위

`plan/in-progress/k8s-avatar-policy.md` — `k8s/overlays/local/infra-minio.yaml` 의 Job
`minio-create-bucket` 스크립트에 아바타 공개 버킷 정책(heredoc + `mc anonymous set-json`)을
추가하고, drift 가드 `.claude/tests/test_minio_bucket_policy_parity.py` 를 신설하는 계획.
`spec_impact: none` — 신규 spec 문서·요구사항 ID·엔티티·API endpoint·이벤트·ENV var 는
계획에 없다. 번들에 포함된 `0-overview.md`/`9-user-profile.md` 는 기존 spec(참조용)이고
target 이 새로 쓰는 문서가 아니다.

## 발견사항

- **[WARNING]** 신규 드리프트 가드 파일명이 기존 이미지 패리티 가드와 "minio_*_parity" 패턴을 공유해 스코프 혼동 소지
  - target 신규 식별자: `.claude/tests/test_minio_bucket_policy_parity.py` (§B "drift 가드")
  - 기존 사용처: `.claude/tests/test_minio_image_parity.py` (커밋 `643813935`, `.claude/tests/README.md:48`, `harness-checks.yml:92-98` 주석) — 같은 대상 파일 `k8s/overlays/local/infra-minio.yaml` 의 같은 리소스(Job `minio-create-bucket`, 컨테이너 `mc`)를 이미 다룬다.
  - 상세: 이름 충돌은 아니다(두 파일명이 다르고 정확히 매칭됨). 다만 두 가드가 **같은 파일·같은 Job 을 서로 다른 축**(이미지 태그/다이제스트 동일성 vs 버킷 정책 JSON 의미 동일성)으로 검사하므로, `test_minio_*_parity.py` 로 알파벳 정렬되면 인접해 나열되고 `harness-checks.yml` 의 기존 주석(92번째 줄, "오브젝트 스토리지 이미지 참조 6곳(test_minio_image_parity.py)")이 새 가드를 포함하는 것으로 잘못 읽힐 수 있다. 다음 사람이 "이 파일 하나가 이미 parity 를 다 본다"고 오인해 새 가드의 트리거 pathspec(원본 정책 파일 `scripts/minio/avatars-public-read.json`) 등재를 빠뜨릴 위험이 실재한다 — 정확히 이 프로젝트가 반복해서 겪은 "가드의 데이터가 가드를 트리거하지 못하는" 클래스(`#1390`, 두 가드 모두의 존재 이유).
  - 제안: 이름 자체는 유지해도 된다(`test_minio_*_parity.py` 컨벤션은 오히려 발견성에 도움). 대신 (a) 새 가드의 모듈 docstring 첫 줄에서 `test_minio_image_parity.py` 를 명시적으로 언급하고 "이미지 태그가 아니라 버킷 정책을 본다"고 구분해 적을 것, (b) `harness-checks.yml` 의 기존 주석(92-95번째 줄)을 새 가드 등재 시 함께 갱신해 "이미지 참조" 로 스코프가 좁혀져 있음을 명확히 할 것, (c) `.claude/tests/README.md` 카탈로그에 신규 행을 추가할 때 기존 `test_minio_image_parity.py` 행과 인접 배치해 "무엇이 다른가"를 한 문장으로 대비시킬 것.

- **[INFO]** `harness-checks.yml` pathspec 트리거 대상 파일이 두 가드에 걸쳐 중첩됨
  - target 신규 식별자: 신규 pathspec 등재 대상 `scripts/minio/avatars-public-read.json` (§D 체크리스트 "drift 가드 테스트 + harness-checks.yml pathspec")
  - 기존 사용처: `k8s/overlays/local/infra-minio.yaml` 은 `.github/workflows/harness-checks.yml:98` 에 이미 `test_minio_image_parity.py` 트리거용으로 등재되어 있다.
  - 상세: 충돌은 아니다 — 같은 파일이 두 가드 모두를 트리거해도 무방하다(파일이 바뀌면 두 가드 다 도는 것이 맞는 동작). 다만 `scripts/minio/avatars-public-read.json` 은 아직 어떤 pathspec 에도 등재돼 있지 않으므로(grep 결과 없음) 신규 항목으로 순수 추가이며 기존 항목과 이름/의미가 겹치지 않는다.
  - 제안: 별도 조치 불요. 계획대로 신규 pathspec 줄을 추가하면 된다.

## 요약

이 target 은 spec 을 건드리지 않는 순수 harness/k8s 변경(spec_impact: none)이며, 새로 도입하는 요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·config key 가 전혀 없다 — `$S3_BUCKET`, `avatars-public-read.json`, Job `minio-create-bucket` 등은 모두 기존 식별자를 그대로 재사용한다. 검토 결과 진짜 "충돌"(같은 이름이 다른 의미로 이미 쓰이는 경우)은 발견되지 않았다. 유일한 주목할 지점은 신설 예정 테스트 파일명 `test_minio_bucket_policy_parity.py` 가 같은 대상 파일을 다루는 기존 `test_minio_image_parity.py` 와 이름 패턴이 인접해, 문서·주석 갱신을 누락하면 스코프 혼동으로 이어질 수 있다는 것(WARNING 1건, INFO 1건). 구현 착수를 막을 사유는 없다.

## 위험도

LOW
