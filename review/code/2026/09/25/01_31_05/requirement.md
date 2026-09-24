# 요구사항(Requirement) 리뷰 — MinIO 이미지 일치 가드

## 검증 방법

- `.claude/tests/test_minio_image_parity.py` 를 단독 실행 → `20 passed, 45 subtests passed`. plan §C 의
  "`5f8c1c472` 20 passed · 45 subtests" 스냅샷과 정확히 일치.
- `.claude/tests/test_harness_checks_paths_coverage.py` 단독 실행 → 통과. `harness-checks.yml`
  `changes.with.pathspecs` 에 `docker-compose.yml` · `docker-compose.e2e.yml` ·
  `k8s/overlays/local/infra-minio.yaml` 세 줄이 개별 등재돼 있음을 직접 확인.
  (AST 기반 `REPO_ROOT / ...` 체인 해석기가 `DEV_COMPOSE`/`E2E_COMPOSE`/`K8S_MINIO` 를 추출하는
  코드도 읽어 트리거 메커니즘 자체를 확인 — docstring 의 "트리거" 주장은 과장이 아님.)
- 실제 세 매니페스트 파일에서 `image:` 값 6곳을 직접 grep — 전부
  `pgsty/silo:RELEASE.2026-09-16T00-00-00Z@sha256:635197cb…a46`(64-hex 확인)로 동일, `latest`
  아님, `distroless` 아님. 가드가 검증한다고 주장하는 실제 상태와 일치.
- `.claude/tests/README.md`, `CHANGELOG.md` 에 이 가드의 카탈로그·변경 항목이 실재함을 확인
  (plan §C 체크리스트 항목과 대응).
- `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 해당 백로그 항목·
  `plan/in-progress/self-hosting-deployment.md` 의 §3/§4 체크박스를 grep 으로 대조 — plan §D W3
  처분("반영했다")이 실제로 반영돼 있음을 확인.
- `python3 -m pytest .claude/tests -q` 전체 실행(1159 passed / 1 failed 공존, 아래 발견사항 참고).

## 발견사항

- **[INFO]** 저장소 오염 관측 및 원복(뮤테이션 규약 §4 고지) — 이 diff 와 무관.
  - 위치: `spec/5-system/7-llm-client.md` (리뷰 대상 파일 아님), 원인 코드는
    `.claude/tests/test_consistency_bundle_priority.py:628-747`
    (`_rank_of_an_uncommitted_edit` / `TheDocumentBeingEditedIsNeverOmittedTest.test_the_probe_leaves_no_residue`)
  - 상세: `python3 -m pytest .claude/tests -q` 전체 실행 중
    `test_the_probe_leaves_no_residue` 가 FAIL 했고, 원인은 `spec/5-system/7-llm-client.md`
    끝에 `<!-- uncommitted probe -->` HTML 주석이 **세 번** 남아 있던 것(그 테스트가 쓰고
    지우는 자기 자신의 프로브 파일). 이 리뷰가 만든 diff(`test_minio_image_parity.py`,
    `plan/in-progress/minio-image-parity-guard.md`)와는 무관한 파일이며, 이 세션은 해당 파일을
    한 번도 Edit/Write 하지 않았다 — 동시에 같은 워킹트리를 쓰는 다른 프로세스(다른 리뷰어
    세션이나 이 정확히 같은 테스트의 동시 실행)가 남긴 잔여물로 보인다(프롬프트가 경고한
    "병렬 fan-out 이 저장소를 오염" 시나리오).
  - 조치: `git diff HEAD -- spec/5-system/7-llm-client.md` 로 변경이 그 3줄 추가뿐임을 확인한
    뒤, `git show HEAD:spec/5-system/7-llm-client.md` 를 scratch 로 받아 앞 478줄이 원본과
    바이트 단위로 동일함을 `diff` 로 검증하고 나서 `cp` 로 원복(= `git checkout`/`restore` 는
    쓰지 않음). 원복 후 `git status --short` 는 이 리뷰 산출물 디렉터리(`review/code/...`)만
    남기고 clean. 이 이상 상태 자체는 리뷰 대상 diff 의 결함이 아니므로 판정에는 반영하지
    않지만, `test_consistency_bundle_priority.py` 의 자기 원복 로직이 동시 실행(또는 이전 실행)에
    취약할 수 있다는 신호이니 harness 소유자가 별도로 확인할 가치가 있다.
  - 제안: 이번 diff 의 fix 대상 아님 — 별도 관찰 사항으로만 기록.

리뷰 대상 diff(`test_minio_image_parity.py`, `plan/in-progress/minio-image-parity-guard.md`) 자체에서는
Critical/Warning 급 결함을 찾지 못했다. 점검한 구체 항목:

- **기능 완전성 / 반환값**: `_dig`·`_seq`·`_expect_one`·`_image_value`·`compose_images`·
  `k8s_images`·`all_images`·`pin_violation`·`is_distroless` 모든 경로가 값을 반환하거나
  이름 붙은 `PlaceNotFound` 를 던진다. `AttributeError`/`KeyError` 로 새는 경로 없음(경계
  테스트로 실제 확인 — 리스트/스칼라/매핑 오형 입력 전부 named failure).
- **엣지 케이스**: 빈 문자열, 비문자열(숫자), `None`, 리소스/컨테이너 0개·중복, 개행 포함
  digest, 대문자 hex, 짧은 digest, digest-only(태그 없음), 포트를 태그로 오인하는 사례(3라운드
  W1 수정분) — 전부 전용 서브테스트로 커버.
- **TODO/FIXME/HACK/XXX**: 없음.
- **의도-구현 일치**: docstring 이 서술하는 "네 단언(자리 목록 유지·값 일치·pin·non-distroless)"
  과 실제 `MinioImageParityTest` 의 4개 테스트가 정확히 대응. `_expect_one` 이 "0 AND 중복 모두
  `PlaceNotFound`" 라는 docstring 그대로 동작함을 `HelperBoundaryTest` 로 확인.
- **비즈니스 로직**: 6곳 값 동일·`@sha256:<64 lower-hex>` pin·`latest` 금지·`-distroless` 금지
  네 규칙이 실제 세 매니페스트 파일의 6개 값과 부합(위 grep 결과).
- **데이터 유효성**: `_PINNED` 정규식이 "레지스트리 포트 뒤 태그" 문제(3라운드 W1)를
  `fullmatch` + "마지막 path 컴포넌트만 태그를 가질 수 있다" 규칙으로 실제로 해결함을
  별도 스크립트로 재현 확인 (`registry.example:5000/...:latest@sha256:...` → `"tag is latest"`,
  이전 버전이었다면 놓쳤을 사례).
- **spec fidelity**: `spec/` 에 이 세 매니페스트의 이미지 pin·YAML 구조를 규정하는 문서가 없다
  (관련 spec, 예: `spec/data-flow/4-file-storage.md`, `spec/0-overview.md` §2.7 은 MinIO 를
  기능적 오브젝트 스토리지로만 서술하고 Docker/K8s 이미지 태그·다이제스트 값은 다루지
  않는다). 이 가드는 제품 요구사항이 아니라 CI/인프라 하네스 불변식이므로 `spec_impact: none`
  은 타당 — CLAUDE.md 의 "harness 변경은 spec 소유가 아니다" 원칙과 일치. INFO 로만 기록
  (spec 누락이 아니라 스코프 밖).
- **체크리스트 잔여**: `python3 -m pytest .claude/tests -q 전체`·`/ai-review`·`트래커 항목 닫기`
  세 항목이 미체크 상태 — 이 리뷰 자체가 그 흐름의 일부이므로 결함 아님(문서가 실제 진행
  상태를 정확히 반영).

## 요약

리뷰 대상 diff(신규 하네스 테스트 `test_minio_image_parity.py`와 그 작업 plan)는 6곳에 손으로
적힌 MinIO 계열 이미지 문자열의 일치·pin·non-latest·non-distroless 를 YAML 파서 기반으로
검증한다는 의도된 기능을 완전하고 정확하게 구현한다. 헬퍼 단위 구조·경계 테스트·16개
뮤턴트 전량 KILLED 기록·`harness-checks.yml` pathspec 3줄 등재·CHANGELOG/README 카탈로그가
plan 문서의 서술과 실제 코드·설정 상태에서 모두 line-level 로 일치함을 직접 실행·grep 으로
재확인했다. 관련 spec 문서는 이 인프라 세부사항을 규정하지 않으므로 spec_impact: none 판단은
타당하다. 리뷰 대상 diff 자체에는 Critical/Warning 이 없다. 다만 전체 하네스 스위트 실행 중
diff 와 무관한 `spec/5-system/7-llm-client.md` 에서 다른 프로세스가 남긴 것으로 보이는 테스트
잔여물(`<!-- uncommitted probe -->` 3줄)을 발견해 원본과 대조 검증 후 `cp` 로 원복했다(뮤테이션
규약에 따른 고지, INFO).

## 위험도

NONE
