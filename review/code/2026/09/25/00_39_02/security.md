# 보안(Security) 리뷰 — MinIO 이미지 일치 가드 (2라운드)

## 검토 범위

이번 diff 는 `codebase/**` 를 전혀 건드리지 않는 harness-only 변경이다:

- `.claude/tests/test_minio_image_parity.py` (신규) — object store 이미지 참조 6곳의 일치·핀 고정을 검증
- `.claude/tests/README.md` — 카탈로그 행 추가
- `.github/workflows/harness-checks.yml` — pathspec 3줄 추가 (`docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/overlays/local/infra-minio.yaml`)
- `CHANGELOG.md`, `plan/in-progress/minio-image-parity-guard.md`, `plan/in-progress/self-hosting-deployment.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서/계획
- `review/code/2026/09/25/00_25_55/**`, `review/consistency/2026/09/25/00_08_35/**` — 1라운드 리뷰 및 `--impl-prep` consistency-check 산출물(전부 기존 라운드의 report artifact, 재실행 대상 코드 아님)

1라운드(`00_25_55`) 이후 실제 소스에 반영된 변경은 `c8a1a59b6`(Warning 1~3, INFO 15 조치)뿐이며, 저장소의 현재 `.claude/tests/test_minio_image_parity.py` 를 직접 `Read` 로 열어 diff 와 대조 확인했다 — 일치한다.

## 발견사항

이 diff 범위에서 보안 취약점(CRITICAL/WARNING)은 발견되지 않았다.

- **[INFO]** YAML 파싱은 안전한 API만 사용, 입력은 저장소 내 고정 경로 3개뿐
  - 위치: `.claude/tests/test_minio_image_parity.py` — `compose_images` (83행), `k8s_images` (94행)
  - 상세: `yaml.safe_load`/`yaml.safe_load_all`만 쓰고 `yaml.load`(unsafe loader)는 쓰지 않는다. 임의 파이썬 객체 역직렬화(→ 코드 실행)로 이어지는 고전적 PyYAML 오용 패턴이 아니다. 읽는 경로 셋(`DEV_COMPOSE`/`E2E_COMPOSE`/`K8S_MINIO`, `REPO_ROOT` 기준 하드코딩 상수)은 외부·사용자 입력이 아니라 모듈 레벨 상수이므로 경로 탐색(path traversal) 공격 표면이 없다.
  - 제안: 없음.

- **[INFO]** 1라운드 수정(`c8a1a59b6`)이 보안 관점의 회귀를 만들지 않았다
  - 위치: `.claude/tests/test_minio_image_parity.py:76-80`(`_mapping`), `:94-115`(`k8s_images`)
  - 상세: `_mapping()` 헬퍼는 non-dict 값을 빈 dict 로 치환해 malformed YAML 이 `PlaceNotFound`(named)로 승격되도록 한 것으로, 이전에는 원시 `AttributeError` 로 죽던 경로다. 스택트레이스에 담기는 정보는 파일 라벨·서비스/컨테이너 이름·이미지 문자열뿐이며 이들 전부 이미 커밋된 비민감 정보라 노출 우려가 없다 — 오히려 에러 처리가 더 명시적으로 바뀐 쪽이다. `k8s_images`의 `len(matches) != 1` 경계(중복 리소스)에 새로 추가된 `test_k8s_duplicate_resource_is_named` 도 판별 로직 자체를 바꾸지 않고 커버리지만 넓혔다.
  - 제안: 없음.

- **[INFO]** `_PINNED` 정규식은 ReDoS 형태가 아니다
  - 위치: `.claude/tests/test_minio_image_parity.py:69`
  - 상세: `^[^:@\s]+:(?P<tag>[^@\s]+)@sha256:[0-9a-f]{64}$` — 중첩 정량자·서로 겹치는 문자클래스 반복이 없는 선형 매칭 패턴이다. 입력도 저장소 내 이미지 문자열 6개로 크기·출처 모두 고정이라 공격 표면이 없다.
  - 제안: 없음.

- **[INFO]** 태그+다이제스트 핀 고정·`latest` 금지·`-distroless` 배제는 공급망 보안을 강화하는 방향
  - 위치: `test_each_is_pinned_by_tag_and_digest`, `test_no_distroless_variant`
  - 상세: 뮤터블 태그로 인한 이미지 치환(supply-chain) 위험을 줄이는 회귀 방지 가드다. `-distroless` 배제는 compose 헬스체크가 이미지 내부 `curl`에 의존하기 때문인 운영상 트레이드오프이며 새 취약점을 도입하지 않는다(`#1392`에서 이미 결정된 상태를 고정할 뿐).
  - 제안: 없음.

- **[INFO]** 하드코딩된 시크릿 없음 / `.github/workflows/harness-checks.yml` 변경에 워크플로 인젝션 표면 없음
  - 위치: 전체 diff, `.github/workflows/harness-checks.yml:92-98`
  - 상세: 추가된 3줄은 `changes` job의 `pathspecs:` 블록 스칼라에 파일 경로 3개를 등재하는 것뿐이며, `${{ github.event.* }}` 같은 신뢰할 수 없는 컨텍스트를 `run:` 셸에 보간하는 패턴이 아니다. 이미지 참조 문자열·서비스/컨테이너 이름·경로 외 자격증명·토큰·키 패턴은 발견되지 않았다.
  - 제안: 없음.

## 요약

이번 diff 는 프로덕션 코드(`codebase/**`) 를 건드리지 않는 harness 전용 변경으로, 신규 Python 코드는 저장소 내 고정 경로 3개만을 `yaml.safe_load`/`safe_load_all`(안전한 API)로 읽어 이미지 문자열의 일치·다이제스트 핀 고정 여부를 검증할 뿐 외부 입력·네트워크 호출·셸 실행·동적 코드 평가가 없다. 1라운드 이후 반영된 수정(`_mapping` 헬퍼, `k8s_images` 가독성 개선, 중복 리소스 경계 테스트 추가)도 판정 로직을 바꾸지 않고 에러 처리를 더 명시적으로만 바꿔 보안 회귀가 없음을 직접 소스 대조로 확인했다. 오히려 태그+다이제스트 핀 고정과 `latest` 금지를 강제해 컨테이너 이미지 공급망 무결성을 개선하는 방향의 변경이다.

## 위험도
NONE
