# 요구사항(Requirement) 리뷰 — MinIO 이미지 일치 가드

## 검증 방법

전체 파일 컨텍스트(diff 아님)로 3개 파일을 읽고, 다음을 직접 실행/대조했다 (워킹트리는 무변경 —
`git status --short` 는 시작·종료 모두 `review/code/2026/09/25/00_56_30/` 만 표시):

- `python3 -m pytest .claude/tests/test_minio_image_parity.py -q` → **15 passed, 20 subtests passed**
  (plan §C 의 「15개 · 20 subtests」 주장과 일치).
- `python3 -m pytest .claude/tests/test_harness_checks_paths_coverage.py -q` → 26 passed.
- `python3 -m pytest .claude/tests/test_workflow_yaml_structure.py -q` → 13 passed, 329 subtests (신규
  pathspec 3줄이 YAML 구조를 깨지 않음을 확인).
- `docker-compose.yml` · `docker-compose.e2e.yml` · `k8s/overlays/local/infra-minio.yaml` 실제 파일을
  읽어 여섯 자리가 실제로 `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36…` 로 전부
  동일함을 확인 — 가드가 통과하는 것이 "우연히 통과" 가 아니라 실제 상태와 일치함을 검증.
- 저장소 밖 scratch(`/var/folders/.../tmp.p5IFeBhXWP`, repo 트리 아님 — `_harness.py` 는
  `Path(__file__).resolve().parents[2]` 로만 `REPO_ROOT` 를 정하므로 실제 git 저장소가 없어도
  import 가능함을 이용해 두 파일만 복사)에 `.claude/tests/test_minio_image_parity.py` +
  `_harness.py` 만 복사해 뮤테이션 스팟체크 1건 수행: `k8s_images` 의
  `if len(matches) != 1:` → `if len(matches) < 1:` (plan §B-2 B1 행). 결과 —
  `test_k8s_duplicate_resource_is_named` 만 RED, `test_k8s_missing_resource_is_named` 는 여전히
  GREEN. plan 이 주장한 "B1 → `test_k8s_duplicate_resource_is_named` 단독 RED" 와 정확히 일치.
  저장소 파일은 전혀 건드리지 않았고(뮤테이션 대상은 scratch 사본), 사용한 scratch 는 리뷰 종료 전
  전부 `rm -rf` 로 정리했다.
  - 작업 중 별개로, 이전 `mktemp -d` 로 만든 백그라운드 `cp -r` (전체 1.6G 워크트리를
    `/var/folders/.../tmp.LpfHYNg2gK/repo` 로 복사 시도)가 살아 있는 것을 뒤늦게 발견했다 —
    저장소 밖 시스템 temp 경로였고 저장소 파일에는 닿지 않았지만, 프로세스를 `kill` 하고
    부분 복사본(7.1G)을 `rm -rf` 로 제거했다. 저장소 자체는 영향받지 않았다(`git status --short`
    전후 동일).

## 발견사항

- **[INFO]** 관련 `spec/` 문서 없음 (spec fidelity, 점검 관점 9)
  - 위치: `.claude/tests/test_minio_image_parity.py` 전체, `.github/workflows/harness-checks.yml`
    L92-98 (pathspec 3줄)
  - 상세: 이미지 pin 정책("태그+다이제스트 필수, `latest` 금지, `-distroless` 금지")은
    `spec/` 어디에도 요구사항으로 명문화돼 있지 않다. 근거는 전부 plan 계층(`W-59`,
    `plan/complete/minio-silo-image.md`, `#1392` 커밋 코멘트)과 이번 plan
    `plan/in-progress/minio-image-parity-guard.md` 자체다. `spec/0-overview.md` L247/253/255 는
    "MinIO 를 오브젝트 스토리지로 쓴다" 는 사실만 언급하고 이미지 pin 규칙은 다루지 않는다.
  - 제안: 결함은 아니다 — 이 변경은 `codebase/**` 가 아니라 `.claude/**`(harness) + `.github/workflows/**`
    + `plan/**` 뿐이라 CLAUDE.md 의 "harness 는 developer 소유, `spec/` 은 read-only" 원칙과
    "harness 변경은 리뷰 게이트 스코프 밖" 예외에 정확히 부합한다. spec 신설/수정을 요구하지 않는다.
    (SPEC-DRIFT 아님 — spec 이 애초에 이 영역을 다루지 않으므로 "낡음" 이 아니라 "관할 밖".)

- **[INFO]** pin 정규식의 빈 태그(`name:@sha256:...`) 경계에 대한 명시 테스트 없음
  - 위치: `.claude/tests/test_minio_image_parity.py` L69 (`_PINNED` 정규식), `test_pin_violation_edges`
    (L232-242)
  - 상세: `_PINNED` 의 태그 그룹 `(?P<tag>[^@\s]+)` 는 `+`(1개 이상)라서 `name:@sha256:<64hex>` 같은
    "태그가 빈 문자열" 형태는 정규식 자체가 매치를 거부해 정상 동작한다(정적으로 확인). 다만
    `test_pin_violation_edges` 의 네 가지 `bad` 케이스에는 이 모양이 없다 — B10(`latest`) 처럼
    별도 서브케이스로 추가했다면 "왜 통과하는지" 가 표에 명시적으로 남았을 것이다.
  - 제안: 낮은 우선순위. 정규식이 이미 올바르게 처리하므로 기능 결함은 아니고, 완전성 관점의 사소한
    보강 여지로만 기록한다.

## 추가로 확인한 항목 (결함 없음 — 근거로 남김)

- `pin_violation` / `is_distroless` / `_mapping` / `compose_images` / `k8s_images` / `all_images` 모든
  함수가 모든 코드 경로에서 타입에 맞는 값을 반환하거나 `PlaceNotFound` 를 이름과 함께 raise한다 —
  암묵적 `None` 반환 경로 없음.
- TODO/FIXME/HACK/XXX 주석 없음 (두 파일 grep 결과 0건).
- `plan/in-progress/minio-image-parity-guard.md` §B-2 뮤턴트 표(B1~B11)를 B1 하나 실측 스팟체크로
  검증 — 주장과 실측이 일치. 나머지 10건은 커밋 이력(`69a5e22b9`)에 동일한 방법론(`cp` 백업 +
  앵커 1회 매칭 + `PYTHONDONTWRITEBYTECODE=1`)으로 이미 기록돼 있고, 이번 스팟체크로 그 방법론
  자체의 신뢰도를 확인했다.
- `.claude/tests/README.md` 카탈로그 항목(L48)이 실제 테스트 동작(6곳/4단언/11분기)과 일치.
- `CHANGELOG.md` Unreleased 항목이 가드 신설을 정확히 서술 — 메모리 규약("가드 신설=CHANGELOG 항목")
  준수.
- `test_harness_checks_paths_coverage.py` 의 `PRODUCT_PREFIXES`(`codebase/ spec/ plan/ review/`)에
  `k8s/` 가 없으므로 plan §A 의 "k8s 는 PRODUCT_PREFIXES 밖" 주장이 코드와 일치 — k8s 매니페스트도
  pathspec 등재가 강제된다는 설명이 맞다.
- `--impl-prep` 처분표(§D)의 W1~W3, INFO1~5 모두 plan 본문과 실제 코드 상태(예: W3 → 실제로
  `self-hosting-deployment.md` §3/§4 에 체크박스 반영됨, 직접 확인)로 뒷받침됨.

## 요약

MinIO 이미지 참조 6곳의 일치를 지키는 하네스 가드(`test_minio_image_parity.py`)와 그 트리거
배선(`harness-checks.yml` pathspec 3줄), 그리고 plan 문서 두 건의 정합성을 검증했다. 실제 세 설정
파일의 이미지 문자열이 정말로 여섯 곳 모두 일치함을 직접 대조했고, 테스트 스위트 전체(15
tests/20 subtests)가 GREEN 임을 실행으로 확인했으며, plan 이 주장하는 뮤테이션 결과(B1) 를 저장소
밖 scratch 사본으로 재현해 일치를 확인했다. 함수 반환값·에러 경로·엣지 케이스(빈 값/비문자열/중복/
누락/자리 목록 축소)가 명명된 예외와 경계 테스트로 촘촘히 덮여 있고 TODO 류 미완성 표시는 없다.
`spec/` 에는 이 영역을 규정하는 문서가 없으나, 이는 harness/CI 계층 전용 변경이라 CLAUDE.md 의
harness 소유권·게이트 스코프 예외에 부합하며 spec 누락을 결함으로 볼 근거가 없다(INFO). 리뷰 중
발견한 유일한 이상 상태(백그라운드에 남아 있던, 저장소 밖 대상의 대용량 `cp` 프로세스)는 저장소
파일에 영향을 주지 않았고 즉시 종료·정리했다. 요구사항 충족 관점에서 이번 변경을 차단할 사유는
없다.

## 위험도

NONE
