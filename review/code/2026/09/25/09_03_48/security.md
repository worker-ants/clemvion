# 보안(Security) 코드 리뷰 — k8s 아바타 정책 가드

리뷰 대상: `.claude/tests/test_minio_bucket_policy_parity.py`, `scripts/minio/README.md`,
`plan/in-progress/k8s-avatar-policy.md` (3라운드 fan-out). 비교를 위해 참조된 실 정책
파일(`scripts/minio/avatars-public-read.json`)과 k8s 매니페스트(`k8s/overlays/local/infra-minio.yaml`)도
컨텍스트 확인 목적으로 열람했으나(위치 인용은 하지 않음, 이번 리뷰 대상 파일 목록 밖), 정책
자체(`s3:GetObject` 만 허용, `Principal: {"AWS": ["*"]}`, `Resource`를 `avatars/*` 프리픽스로 한정,
`s3:ListBucket` 미부여)는 설계상 건전하다.

## 발견사항

이번 3개 파일 범위에서 CRITICAL/WARNING 급 보안 결함은 발견하지 못했다. 다음은 INFO 수준 관찰이다.

- **[INFO]** 익명 공개 읽기의 유일한 방어선은 UUID 추측 불가능성(security-through-obscurity)이며, 이는 코드가
  아니라 설계 트레이드오프로 README 에 명시적으로 인지·기록돼 있다.
  - 위치: `scripts/minio/README.md:39` (`## 왜 ... 실측으로 기각했다` 절 하단, "목록이 열리면 이 기능의
    접근 통제가 통째로 무너진다" 문단)
  - 상세: `s3:ListBucket` 을 절대 부여하지 않는다는 불변식이 지켜지는 한 열거 공격은 막히지만, 방어 자체가
    "키를 모르면 못 연다"는 한 겹 구조다. 이번 변경은 그 불변식을 코드(heredoc)·문서(README)·테스트
    (`test_no_list_bucket_anywhere`) 세 곳에서 동시에 고정해 drift 를 능동적으로 막는 설계라 현재로선
    적절하다.
  - 제안: 별도 조치 불요. 향후 더 강한 통제가 필요해지면(예: 만료가 있는 signed URL) 그 시점에 별도
    plan 으로 논의할 사안이며 이번 PR 스코프는 아니다.

- **[INFO]** 가드 테스트(`_HEREDOC`/`_SET_JSON`/`_ARN_BUCKET`)는 정규식으로 셸 heredoc 문법을 파싱한다.
  - 위치: `.claude/tests/test_minio_bucket_policy_parity.py:64-69` (`_HEREDOC`, `_SET_JSON`, `_ARN_BUCKET` 정의)
  - 상세: 정규식 기반 파서는 표현이 조금만 달라져도(따옴표 스타일, 공백) 매치에 실패할 수 있다. 다만 이는
    보안 취약점이 아니라 **fail-closed** 방향의 브리틀함이다 — 매치 실패 시 `_expect_one` 이
    `PlaceNotFound` 를 던져 테스트가 실패하므로, 정책이 조용히 우회되는 대신 CI 가 시끄럽게 막는다. 캡처 그룹
    `(?P<q>['\"]?)` 로 heredoc 구분자 인용 여부를 정확히 판별해 `${S3_BUCKET}` 미확장(assertion 3, 테스트
    `test_heredoc_delimiter_is_unquoted`) 회귀를 명시적으로 잡는 점도 확인했다 — 이 축이 실제로 배포 시점에
    "서버가 정책을 거부해 Job 이 실패"하는 결함(plan §C-2 실측)과 정확히 대응한다.
  - 제안: 현행 유지. ReDoS 관점에서도 `.*?`(lazy, `re.S`) 단일 구간이라 중첩 정량자로 인한 파국적 백트래킹
    소지가 없고, 입력도 공격자가 아니라 저장소 자신의 YAML/JSON 이므로 공격 표면이 아니다.

- **[INFO]** 하드코딩된 시크릿/자격증명 없음을 확인.
  - 위치: 3개 파일 전체(grep `password|secret|token|api[_-]?key|aws_access` 등)
  - 상세: `plan/in-progress/k8s-avatar-policy.md:53` 의 "env 는 overlay secret · base configmap 값" 은 값이
    아니라 출처를 서술한 문장이며, `.claude/tests/test_minio_bucket_policy_parity.py:32` 의 "secret" 은
    "UUID 는 비밀이 아니다"라는 주석 문맥이다. 실제 자격증명 리터럴은 없다.
  - 제안: 조치 불요.

## 요약

이번 라운드에서 리뷰한 세 파일(테스트 가드, README, plan 문서)은 코드 자체가 아니라 "k8s 로컬 오버레이도
compose 와 동일한 아바타 공개-읽기 버킷 정책을 적용해야 한다"는 배포 불변식을 문서화·테스트로 고정하는
성격이다. 핵심 보안 설계(익명 `s3:GetObject` 만 허용, `s3:ListBucket` 명시적 배제, `avatars/*` 프리픽스로
`Resource` 제한, 이미지 다이제스트 고정, 자격증명은 `secretKeyRef` 로만 주입)는 문서·테스트 양쪽에서
일관되게 반영돼 있고, 그 반대 방향 회귀(정책 누락·`ListBucket` 재유입·heredoc 인용부호로 인한 변수 미확장)를
각각 이름 붙은 테스트로 방지한다. 인젝션·하드코딩 시크릿·인증/인가 우회·안전하지 않은 암호화·민감정보
노출 등 CRITICAL/WARNING 급 문제는 발견하지 못했다.

## 위험도

LOW
