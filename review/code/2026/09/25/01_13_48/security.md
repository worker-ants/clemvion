# 보안(Security) 리뷰 — minio-image-parity-guard

## 리뷰 범위

- `.claude/tests/test_minio_image_parity.py` (신규 하네스 테스트 — CI 전용, 프로덕션 코드 아님)
- `plan/in-progress/self-hosting-deployment.md` (계획 문서)
- `plan/in-progress/minio-image-parity-guard.md` (계획 문서)

세 파일 모두 **애플리케이션 런타임 코드가 아니라 CI 하네스 테스트 + 작업 계획 문서**다. 공격자가 직접 도달할 수 있는 입력 경로(HTTP 요청, 사용자 입력 등)가 없고, 검증 대상인 YAML 세 파일도 저장소 커밋 권한이 있는 개발자만 편집 가능하다는 것이 전제된 신뢰 경계다. 이 점을 감안해 분석했다.

### 발견사항

- **[INFO]** YAML 로딩에 `yaml.safe_load` / `yaml.safe_load_all` 사용 — 안전
  - 위치: `.claude/tests/test_minio_image_parity.py:107`, `.claude/tests/test_minio_image_parity.py:121`
  - 상세: PyYAML 의 `yaml.load()` 를 기본 `Loader` 없이 호출하면 임의 Python 객체 역직렬화(RCE) 취약점(CVE-2017-18342 계열)에 노출될 수 있다. 이 코드는 처음부터 `safe_load`/`safe_load_all` 만 사용해 그 위험을 피하고 있다. 이는 결함이 아니라 **올바른 선택**임을 확인하는 차원의 기록.
  - 제안: 없음 (현행 유지).

- **[INFO]** 이미지 핀 정규식의 `$` 앵커는 `re.MULTILINE`/`\Z` 가 아니라 문자열 끝(또는 끝의 단일 개행 직전)에서만 매치
  - 위치: `.claude/tests/test_minio_image_parity.py:74`-`76` (`_PINNED` 정의)
  - 상세: `^(?:[^/@\s]+/)*[^/:@\s]+:(?P<tag>[^/:@\s]+)@sha256:[0-9a-f]{64}$` 는 `re.MULTILINE` 없이 컴파일되어 있어, Python 정규식 의미상 `$` 는 문자열 끝 또는 "끝에 있는 단일 개행 직전"에서만 매치한다. 실제로 검사해 보면 이 상황에서 뒤에 추가 문자가 붙은 문자열(`"...@sha256:" + "a"*64 + "\nEXTRA"`)은 매치되지 않으므로 **악용 가능한 우회는 없다** — 다만 값 끝에 단일 trailing `\n` 만 있는 경우는 통과한다(무해). 참고용으로만 남긴다.
  - 제안: 방어적 엄격함을 원하면 `$` → `\Z` 로 바꿔 trailing-newline 관용도 제거할 수 있으나, 현재 신뢰 경계(저장소 내부 YAML, 공격자 비도달)를 고려하면 우선순위는 낮다.

- **[INFO]** 시크릿 하드코딩 없음
  - 위치: 세 파일 전체
  - 상세: `test_minio_image_parity.py` 의 이미지 참조(`pgsty/silo:RELEASE.…@sha256:…`, 테스트 픽스처의 더미 다이제스트 `"0"*64`/`"a"*64`)는 공개 컨테이너 레지스트리 태그·다이제스트이며 시크릿이 아니다. `self-hosting-deployment.md` 에 등장하는 `JWT_SECRET`/`ENCRYPTION_KEY` 는 **변수 이름**이지 실제 값이 아니다. 실제 시크릿 값 노출 없음.
  - 제안: 없음.

- **[INFO]** 이 변경 자체는 공급망 보안을 강화하는 방향
  - 위치: `.claude/tests/test_minio_image_parity.py` 전체 (특히 `pin_violation()` — `latest` 태그 거부, digest pin 요구)
  - 상세: 이 가드는 이미지 참조가 `name:tag@sha256:<64 hex>` 형태로 다이제스트까지 고정되어 있고 태그가 가변적인 `latest` 가 아님을 강제한다. 이는 Docker Hub/레지스트리의 태그 가변성(mutable tag)을 이용한 이미지 치환·공급망 공격 표면을 줄이는 적절한 방어 조치다. 새로운 취약점을 만들지 않으며 오히려 기존 리스크(부분 업데이트로 인한 불일치, `:latest` 참조)를 줄인다.
  - 제안: 없음 — 현행 방향 유지 권장.

- **[INFO]** `self-hosting-deployment.md` 의 "MinIO 버킷 자동 생성 권한 — root credential 노출 위험" 은 이미 문서 자신이 인지·기록한 기존 리스크
  - 위치: `plan/in-progress/self-hosting-deployment.md` — "의존성·리스크" 섹션 (`- **리스크**:` 하위 "MinIO 버킷 자동 생성 권한…" 항목)
  - 상세: 새로 발견한 결함이 아니라 계획 문서가 스스로 "별도 service account 권장" 이라고 완화책까지 적어 둔 미착수(TODO) 항목이다. 이번 diff 가 도입한 문제가 아니므로 재분류하지 않는다.
  - 제안: 해당 plan 의 구현 단계(§3 Docker Compose 풀 번들)에서 실제로 MinIO root credential 대신 스코프가 좁은 service account 를 쓰도록 구현 시점에 검증할 것 — 지금은 계획 문서 단계라 조치 대상 코드가 없음.

- **[INFO]** 에러 메시지에 민감정보 노출 없음
  - 위치: `.claude/tests/test_minio_image_parity.py` `PlaceNotFound` 발생 지점들 (예: `compose_images` 112번째 줄, `k8s_images` 129/136/141번째 줄)
  - 상세: 예외 메시지는 파일 라벨·서비스/컨테이너 이름 등 저장소 내부 구조 정보만 담고, 자격증명·토큰·경로 밖 시스템 정보를 노출하지 않는다. 이 테스트는 CI 로그에만 출력되므로 노출 대상도 제한적이다.
  - 제안: 없음.

- **[INFO]** 커맨드/경로 인젝션 표면 없음
  - 위치: `.claude/tests/test_minio_image_parity.py` 전체
  - 상세: `subprocess`/`os.system`/`eval`/`exec` 호출이 전혀 없고, 파일 경로는 `REPO_ROOT` 기준 고정 상수(`DEV_COMPOSE`, `E2E_COMPOSE`, `K8S_MINIO`)로만 구성되어 사용자 입력이나 외부 변수로 조립되지 않는다. 경로 탐색(path traversal) 표면이 없다.
  - 제안: 없음.

### 요약

이번 변경은 프로덕션 런타임 코드가 아니라 CI 전용 하네스 테스트(`test_minio_image_parity.py`)와 두 개의 계획 문서(`self-hosting-deployment.md`, `minio-image-parity-guard.md`) 로 구성되어 있으며, 공격자가 도달 가능한 입력 경로가 없다. YAML 파싱은 처음부터 `safe_load`/`safe_load_all` 만 사용해 PyYAML 의 대표적 역직렬화 위험을 피했고, 정규식 기반 이미지 핀 검증(`_PINNED`)도 문자열 끝 앵커 관련 이론적 여지를 제외하면 실질적 우회가 없다. 하드코딩된 시크릿·자격증명은 발견되지 않았고, 계획 문서에 언급된 `JWT_SECRET`/`ENCRYPTION_KEY` 는 변수명일 뿐 실제 값이 아니다. 오히려 이 가드는 컨테이너 이미지를 다이제스트로 고정하고 `latest` 태그를 거부해 공급망 무결성을 개선하는 방향의 변경이다. `self-hosting-deployment.md` 에 이미 스스로 기록해 둔 "MinIO root credential 노출 위험" 항목은 새로 발견된 결함이 아니라 기존에 인지된 TODO 이므로 이번 리뷰의 신규 발견사항으로 잡지 않는다. Critical/Warning 급 보안 결함은 발견되지 않았다.

### 위험도

NONE
