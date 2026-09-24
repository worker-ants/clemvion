# 요구사항(Requirement) 리뷰 — MinIO 이미지 일치 가드

## 검증 절차 (읽기 전용)
- `.claude/tests/test_minio_image_parity.py` 단독 실행: 7 tests OK.
- `.claude/tests/test_harness_checks_paths_coverage.py` 단독 실행: 26 tests OK (신규 pathspec 3줄 등재 확인).
- 전체 하네스 스위트 `python3 -m unittest discover -s .claude/tests -p 'test_*.py'`: 1147 tests OK — 회귀 없음.
- 실제 매니페스트 3파일에서 `pgsty/silo` 문자열을 직접 grep — 정확히 6곳(선언된 자리 수와 일치), 여섯 값 모두 동일 문자열(`pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb9f36d01bee221d34d1c7d7960f6a95c48b0b6c01d99cd13bdae51a46`).
- `test_harness_checks_paths_coverage.py` 의 `PRODUCT_PREFIXES`(`codebase/ spec/ plan/ review/`)를 확인 — `k8s/` 는 포함되지 않아, plan §A 의 "k8s 는 PRODUCT_PREFIXES 밖" 주장이 맞다.
- 저장소에 뮤테이션을 가하지 않았다(읽기·실행만 수행). 작업 종료 시 `git status --short` 는 이 리뷰 산출물 디렉터리(`review/code/2026/09/25/00_25_55/`)만 표시 — 잔여물 없음.

## 발견사항

- **[INFO]** `_PINNED` 정규식이 레지스트리 호스트에 포트가 포함된 참조(`host:5000/repo:tag@sha256:…`)를 잘못 분해할 수 있다.
  - 위치: `.claude/tests/test_minio_image_parity.py:69` (`_PINNED = re.compile(...)`)
  - 상세: `^[^:@\s]+:(?P<tag>[^@\s]+)@sha256:...`에서 이름부(`[^:@\s]+`)는 첫 `:` 앞까지만 허용하므로, 호스트에 포트가 있는 참조는 포트의 `:` 가 이름/태그 구분자로 잘못 소비되어 `tag` 그룹에 `5000/repo:실제태그` 가 통째로 들어간다. 현재 6개 값(`pgsty/silo:RELEASE...`)에는 포트가 없어 실제 오탐은 없다 — 오늘 시점 버그는 아니다.
  - 제안: 현재 스코프에서는 조치 불요(해당 형태 이미지가 없음). 향후 프라이빗 레지스트리(포트 포함) 이미지가 이 여섯 자리 중 하나로 바뀌면 재검토 필요.

- **[INFO]** 파일 부재/YAML 파싱 실패는 `PlaceNotFound` 로 포착되지 않는다.
  - 위치: `.claude/tests/test_minio_image_parity.py:108-113` (`all_images`, `read_text` 호출부) / `compose_images`·`k8s_images` 진입부의 `yaml.safe_load`
  - 상세: docstring·README·CHANGELOG 는 "자리가 파일 안에서 빠지면 `PlaceNotFound` 가 이름을 댄다"고만 약속하며, 파일 자체의 부재나 YAML 구문 오류까지 이름을 대겠다고 약속하지 않는다 — 그 약속과 구현은 정확히 일치한다. 다만 실제로 그런 상황이 오면 raw `FileNotFoundError`/`yaml.YAMLError` 트레이스백만 나오므로 실패 메시지의 친절함은 `PlaceNotFound` 대비 떨어진다.
  - 제안: 조치 불요(문서화된 보장 범위 밖). 필요하면 향후 `all_images()` 에서 이 두 예외를 잡아 `PlaceNotFound` 로 재포장하는 개선을 고려할 수 있다.

- **[INFO]** spec fidelity — 이번 변경 영역(하네스 테스트 + `docker-compose*.yml`/`k8s/` 이미지 문자열 일치 가드)을 규정하는 `spec/` 문서를 찾지 못했다.
  - 상세: `spec/0-overview.md` 는 Object Storage 를 "S3 호환(MinIO 등)" 수준으로만 언급하고, 특정 이미지 태그·다이제스트 고정 규칙은 규정하지 않는다. 이 배포 인프라 관심사는 `plan/in-progress/self-hosting-deployment.md` 에서 작업 항목으로만 추적되며, 이는 CLAUDE.md 상 "harness/plan" 축이지 "spec" 축이 아니다. 코드가 spec 을 위반하거나 spec 이 낡은 것이 아니라, 애초에 이 영역을 규정하는 spec 문서가 없다 — 단순 회색지대(INFO).
  - 제안: 조치 불요.

## 긍정 관찰 (요구사항 충족 확인)

- 4개 named assertion(자리 수 6 유지·값 일치·tag+digest 고정(비-latest)·비-distroless)이 CHANGELOG·plan·README·docstring·실제 코드 사이에 line-level 로 일치한다.
- plan §B 의 뮤턴트 M1~M5 실측 기록이 실제 코드 동작과 부합 — 특히 M3("추출은 `setUp`에 있어 한 곳 결손이 4개 단언 전체를 RED 로 만든다")은 실제 구조(`MinioImageParityTest.setUp`이 `all_images()`를 호출)와 일치하고, 그 반증이 단언 1의 문서화된 의미를 정확히 좁히는 방향으로 반영되었다(취소선 처리, 원문 보존).
- `plan_coherence W3`(신규 매니페스트가 가드 목록에 반영될 경로가 없다는 지적)의 처방이 `self-hosting-deployment.md` §3·§4 체크박스로 실제로 반영되어 있고, `convention_compliance W2`(spec §8 prefix 서술 stale)는 developer 가 직접 spec 을 고치지 않고 `spec-draft-nullable-notation-followups.md` 트래커에 planner 소관 항목으로 정확히 등재했다 — CLAUDE.md의 "developer 는 spec 을 고칠 수 없다" 경계를 지켰다.
- `harness-checks.yml` pathspec 3줄 추가는 `test_harness_checks_paths_coverage.py` 를 GREEN 으로 만들며, 세 파일 모두 실제로 `k8s/**` 가 아닌 파일 단위로 등재되어 있어(plan 의 "무관한 매니페스트 변경마다 스위트가 돈다" 회피 근거와 일치) 과다 트리거를 피한다.
- TODO/FIXME/HACK/XXX 계열 미완성 표시 없음. 모든 함수 경로에서 반환값 또는 예외(`PlaceNotFound`)가 명시적으로 정의되어 있다 — 반환 누락 경로 없음.

## 요약

새로 추가된 `.claude/tests/test_minio_image_parity.py`, `harness-checks.yml` pathspec 3줄, `.claude/tests/README.md` 카탈로그 항목, `CHANGELOG.md` 항목, 그리고 두 plan 문서(`minio-image-parity-guard.md`, `self-hosting-deployment.md`)의 후속 체크박스는 서로 line-level 로 일치하며, 실제 실행(신규 7개 테스트 + 전체 하네스 1147개 테스트 + 실제 매니페스트 3파일 대조)으로 기능이 의도대로 동작함을 직접 확인했다. `--impl-prep` 단계에서 나온 Warning 3건은 모두 적절히 처분되었다(2건은 이번 작업과 무관한 기존 drift 로 올바른 소유자(planner)에게 라우팅, 1건은 이번 plan 본문에 직접 반영). 발견된 사항은 모두 INFO 수준(현재 데이터에는 영향 없는 정규식 엣지 케이스, 문서화된 보장 범위 밖의 파일-부재 예외 처리, spec 문서 자체의 부재)이며 CRITICAL/WARNING 은 없다.

## 위험도

NONE
