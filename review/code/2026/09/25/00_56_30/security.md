# 보안(Security) 리뷰

## 리뷰 범위

- `.claude/tests/test_minio_image_parity.py` (신규 하네스 테스트 — MinIO 계열 이미지 참조 6곳 일치·핀 고정 가드)
- `.github/workflows/harness-checks.yml` (pathspec 등재 diff)
- `plan/in-progress/minio-image-parity-guard.md`, `plan/in-progress/self-hosting-deployment.md` (계획 문서, 비코드)

## 발견사항

- **[INFO]** `_PINNED` 정규식이 소문자 hex(`[0-9a-f]{64}`)만 허용
  - 위치: `.claude/tests/test_minio_image_parity.py:69` (`_PINNED = re.compile(...)`)
  - 상세: sha256 다이제스트에 대문자 hex 를 쓰면(관례상 드물지만 표준상 허용) `pin_violation` 이 "not name:tag@sha256:<64 hex>" 로 **거부**한다. 이는 fail-closed 방향(가드가 더 엄격해지는 쪽)이라 보안 결함은 아니고, 오탐으로 인한 CI 실패 가능성만 있는 견고성 이슈다. 보안 관점에서 문제되지 않는다(공급망 무결성 검사 실패는 안전한 방향의 오류).
  - 제안: 필요 시 `[0-9a-fA-F]{64}` 로 확장 검토(선택 사항, 보안상 필수 아님).

- **[INFO]** 이 변경은 순수하게 보안을 강화하는 방향의 하네스 테스트다
  - 위치: `.claude/tests/test_minio_image_parity.py` 전체 (`pin_violation`, `is_distroless`, `MinioImageParityTest`)
  - 상세: `latest` 태그 거부, digest 필수(태그 변조/재태깅에 의한 이미지 스와핑 방지), 6곳 값 일치 강제, distroless 변형 거부(헬스체크 무결성)는 모두 공급망(supply-chain) 무결성을 개선하는 조치다. YAML 파싱도 `yaml.safe_load`/`safe_load_all` 만 사용해 임의 파이썬 객체 역직렬화(`yaml.load` 의 알려진 위험, 예: CVE-2017-18342 계열)를 피했다 — 올바른 선택이다.
  - 제안: 조치 불요.

- **[INFO]** CI 워크플로 권한이 최소 권한(`contents: read`)으로 스코프됨
  - 위치: `.github/workflows/harness-checks.yml:24-25` (`permissions: contents: read`)
  - 상세: `pull_request` 트리거이며 `pull_request_target` 이 아니고, secrets 참조가 전혀 없다. PR 코드(테스트 자신 포함)를 실행하지만 쓰기 권한·시크릿 노출이 없어 악의적 PR 이 이 잡을 통해 저장소 상태를 변경하거나 시크릿을 탈취할 표면이 없다. 기존 자매 워크플로(`review-gate.yml`)와 동일한 패턴이라는 주석도 일치한다.
  - 제안: 조치 불요.

- **[INFO]** `self-hosting-deployment.md` 가 "MinIO 버킷 자동 생성 권한 — root credential 노출 위험" 을 이미 리스크 항목으로 기록
  - 위치: `plan/in-progress/self-hosting-deployment.md` (`## 의존성·리스크` 절, "MinIO 버킷 자동 생성 권한" 항목)
  - 상세: 이 항목은 아직 미착수(`[ ]`) 설계 단계 TODO 이고, 이번 diff 가 구현하는 범위가 아니다. 계획 문서 자체가 이미 root credential 노출을 리스크로 인지하고 "별도 service account 권장" 을 적어 두었으므로 별도 지적 불요. 실제 구현 PR 에서 checklist 항목으로 추적하면 된다.
  - 제안: 조치 불요(향후 구현 PR 에서 재확인).

발견된 인젝션·하드코딩 시크릿·인증/인가 우회·암호화 취약점·에러 메시지 정보 노출·알려진 취약 의존성 사용은 없다. 정규식(`_PINNED`)은 중첩 정량자가 없는 선형 패턴이라 ReDoS 위험도 없다. 대상 파일이 사용자 입력이 아닌 저장소 자체의 정적 매니페스트(docker-compose/k8s YAML)만 읽으므로 인젝션 공격 표면 자체가 없다.

## 요약

이번 변경은 신규 코드가 아니라 기존 인프라 이미지 참조의 일치·핀 고정을 검증하는 하네스 테스트와 CI pathspec 등재이며, 공급망 무결성(태그 변조 방지, digest 강제, distroless 변형 차단)을 강화하는 방향의 안전한 변경이다. YAML 파싱은 `safe_load` 계열만 사용하고, CI 워크플로는 이미 최소 권한(`contents: read`)으로 스코프되어 있으며 시크릿 참조가 없다. 계획 문서에 언급된 root credential 노출 리스크는 아직 미구현 단계 항목으로 이미 문서에 인지·기록되어 있어 별도 조치가 필요 없다. Critical/Warning 급 보안 결함은 발견되지 않았다.

## 위험도

NONE
