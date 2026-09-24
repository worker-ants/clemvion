# 보안(Security) 리뷰

## 검토 범위

- `.claude/tests/test_minio_image_parity.py` (신규) — MinIO 계열 이미지 참조 6곳의 일치·핀 고정을 검증하는 harness 자체 테스트
- `.claude/tests/README.md` — 위 테스트 카탈로그 항목 추가
- `.github/workflows/harness-checks.yml` — pathspec 3줄 추가(`docker-compose.yml`, `docker-compose.e2e.yml`, `k8s/overlays/local/infra-minio.yaml`)
- `CHANGELOG.md`, `plan/in-progress/minio-image-parity-guard.md`, `plan/in-progress/self-hosting-deployment.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` — 문서/계획 갱신
- `review/consistency/2026/09/25/00_08_35/**` — 선행 `--impl-prep` consistency-check 산출물(읽기 전용 참고 자료)

이 변경 세트는 harness(CI 자체 테스트) 영역에 한정되며, 프로덕션 코드(`codebase/`)나 사용자 요청 경로에는 손대지 않는다.

## 발견사항

이 diff 범위에서 보안 취약점(CRITICAL/WARNING)은 발견되지 않았다. 참고로 남기는 관찰(INFO) 만 있다.

- **[INFO]** YAML 파싱은 안전한 API만 사용
  - 위치: `.claude/tests/test_minio_image_parity.py` — `compose_images` (76행대), `k8s_images` (88행대)
  - 상세: `yaml.safe_load` / `yaml.safe_load_all` 만 사용하고 `yaml.load`(unsafe loader)는 사용하지 않는다. 임의 파이썬 객체 역직렬화(코드 실행)로 이어지는 클래식 PyYAML 오용 패턴이 아니다. 입력도 저장소에 커밋된 고정 경로 3개(`DEV_COMPOSE`, `E2E_COMPOSE`, `K8S_MINIO`, 각각 `REPO_ROOT` 기준 하드코딩 상수)뿐이라 외부 입력이나 사용자 제어 경로가 없다 — 경로 탐색·역직렬화 공격 표면이 없다.
  - 제안: 없음 (현행 유지 권장).

- **[INFO]** 이미지 다이제스트 핀 고정 요구는 공급망 보안을 강화하는 방향
  - 위치: `.claude/tests/test_minio_image_parity.py:69` (`_PINNED` 정규식), `test_each_is_pinned_by_tag_and_digest`
  - 상세: 여섯 자리 모두 `name:tag@sha256:<64 hex>` 형태를 강제하고 `latest` 태그를 금지한다. 이는 태그 재바인딩(뮤터블 태그로 인한 supply-chain 치환) 위험을 줄이는 방어적 조치로, 새로운 취약점이 아니라 기존 상태(`#1392`에서 이미 핀 고정됨)를 회귀로부터 지키는 가드다.
  - 제안: 없음.

- **[INFO]** `-distroless` 배제 조건은 보안-편의 트레이드오프이지 취약점 아님
  - 위치: `.claude/tests/test_minio_image_parity.py` `test_no_distroless_variant`
  - 상세: distroless 이미지가 일반적으로 공격 표면이 더 작다는 점에서 "보안 강화"로 보일 수 있으나, 여기서는 compose 헬스체크가 이미지 내부 `curl` 실행에 의존하기 때문에 배제하는 것으로, 순수 운영상의 이유다. 이 판단 자체가 보안 회귀를 만들지는 않는다(런타임 이미지에 `curl` 이 포함되는 것은 공격 표면을 미세하게 늘리지만, 이미 `#1392`에서 결정된 기존 상태를 이 테스트가 고정할 뿐 새로 도입하는 변경이 아니다).
  - 제안: 없음. 향후 헬스체크를 `curl` 비의존 방식(TCP 체크 등)으로 바꾸면 distroless 채택을 재검토할 수 있다는 점만 참고.

- **[INFO]** 하드코딩된 시크릿 없음
  - 위치: 전체 diff
  - 상세: 이미지 참조 문자열(`pgsty/silo:...@sha256:...`), 서비스/컨테이너 이름, 파일 경로 외에 자격증명·토큰·키 패턴은 발견되지 않았다(`password|secret|token|api[_-]?key|private[_-]?key|-----BEGIN` grep 결과 모두 무관한 계획 문서의 일반 서술 — 예: `plan/in-progress/self-hosting-deployment.md`의 `.env.example` / `JWT_SECRET` 언급은 미래 작업 항목일 뿐 실제 값이 아님).
  - 제안: 없음.

- **[INFO]** 에러 메시지에 민감 정보 노출 없음
  - 위치: `.claude/tests/test_minio_image_parity.py` `PlaceNotFound` 예외 메시지, `_render`
  - 상세: 실패 메시지는 파일명·서비스/컨테이너 이름·이미지 문자열만 포함하며, 이들은 이미 공개 저장소에 커밋된 비민감 정보다. CI 로그에 노출돼도 문제 없음.
  - 제안: 없음.

## 요약

이번 diff는 프로덕션 애플리케이션 코드가 아니라 CI harness 자체 테스트(`test_minio_image_parity.py`)와 그 트리거 배선(`harness-checks.yml` pathspec), 문서/계획 파일로 구성된다. 새로 추가된 Python 코드는 고정된 저장소 내부 경로 3개만을 `yaml.safe_load`/`safe_load_all`(안전한 API)로 읽어 이미지 문자열의 일치·다이제스트 핀 고정 여부를 검증하며, 외부/사용자 입력, 네트워크 호출, 셸 실행, 동적 코드 평가가 전혀 없다. 하드코딩된 시크릿이나 민감 정보 노출도 발견되지 않았고, 오히려 태그+다이제스트 핀 고정과 `latest` 금지를 강제해 컨테이너 이미지 공급망 무결성을 개선하는 방향의 변경이다. 함께 포함된 `plan/*.md` 문서들은 향후(미구현) 셀프호스팅 배포 작업의 체크리스트일 뿐 실행 코드가 아니다.

## 위험도
NONE
