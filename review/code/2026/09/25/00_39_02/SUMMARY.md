# Code Review 통합 보고서

## 전체 위험도
**LOW** — `codebase/**` 변경 없는 harness 전용 회귀 가드(MinIO 이미지 6곳 일치)로 Critical 은 없으나, testing·documentation 두 reviewer 가 각각 실측(뮤테이션/파일 대조)으로 WARNING 2건을 확인했다. forced(router_safety) 화이트리스트 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과가 확보되어 "강제 화이트리스트 미이행" 은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `k8s_images` 의 컨테이너 매칭 `len(images) != 1` 분기 중 "같은 파드 안 동일 이름 컨테이너 2개 이상"(중복) 케이스가 어떤 boundary test 로도 검증되지 않는다. 뮤테이션 실측(`!= 1` → `< 1`)으로 확인: 스위트 9개 테스트가 모두 그린으로 남고, 중복 컨테이너 입력 시 예외 없이 이미지 하나를 조용히 골라 통과시킨다. 1라운드에서 고친 "리소스 레벨 중복"(Warning 1)과 정확히 같은 클래스 결함이 한 단계 더 안쪽에 잔존. 부수: 원본 코드도 중복 시 에러 메시지가 "not found" 로 나와(둘 이상 찾아서 실패하는데) 원인 설명이 부정확 | `.claude/tests/test_minio_image_parity.py:112-113` | `ExtractorBoundaryTest` 에 `test_k8s_duplicate_container_is_named` 류 케이스 추가, 에러 메시지를 "found 0"/"found N" 으로 구분(리소스 레벨과 통일된 형태) |
| 2 | documentation | plan 체크리스트가 "새 테스트 7개는 이름으로 실행 확인(`-v` 7 passed)" 로 기록돼 있으나, 1라운드 수정(`c8a1a59b6`)으로 테스트가 2건(`test_k8s_duplicate_resource_is_named`, `test_compose_malformed_service_is_named_not_attribute_error`) 늘어 실제로는 9개(`grep -c "def test_"` = 9, `unittest discover` 실행 결과도 `Ran 9 tests ... OK`)다. `[x]` 완료 처리된 체크리스트 안에 stale 수치가 남음 | `plan/in-progress/minio-image-parity-guard.md:81` | "7 passed" → "9 passed" 로 정정하거나 "1라운드 조치로 2건 추가돼 9개" 구절 추가. `spec_impact: none` 이라 별도 게이트 없음 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `yaml.safe_load`/`safe_load_all` 만 사용(임의 역직렬화 회피), 하드코딩 시크릿·워크플로 인젝션 표면 없음, 태그+다이제스트 핀 고정은 오히려 공급망 보안 강화 방향 | `.claude/tests/test_minio_image_parity.py:83-115`, `.github/workflows/harness-checks.yml:92-98` | 조치 불요 |
| 2 | 성능 | `setUp` 이 테스트 메서드마다(4회) `all_images()` 를 재호출해 3개 YAML 파일을 세션당 총 12회 읽고 파싱한다. 파일이 작고 CI 하네스 전용이라 영향은 무시 가능 | `.claude/tests/test_minio_image_parity.py:175` | 급하지 않음. 원하면 `setUpClass` 로 1회만 계산하도록 전환 가능 |
| 3 | 아키텍처 | `PlaceNotFound` 가 `Exception` 이 아니라 `AssertionError` 를 상속해, 순수 파싱 로직(`compose_images`/`k8s_images`)이 테스트 프레임워크 타입에 결합됨. 현재 스코프(재사용 없는 단일 목적 가드)에서는 위험 없음 | `.claude/tests/test_minio_image_parity.py:72-73` | 조치 불요. 추출기가 이 파일 밖에서 재사용될 때 재검토 |
| 4 | 아키텍처 | `all_images()` 의 3줄 수동 반복(개방-폐쇄 원칙 의도적 포기)은 1라운드에서 이미 "의도된 설계"로 처분됨. plan 체크리스트가 확장 절차(신규 매니페스트 시 손으로 추가)를 명시해 안전장치 존재 | `.claude/tests/test_minio_image_parity.py:118-123` | 조치 불요 |
| 5 | 요구사항 | MinIO 이미지 태그·다이제스트 고정 같은 배포 인프라 세부는 `spec/` 어느 문서의 관할도 아님(SPEC-DRIFT 아니라 애초에 spec 이 다루지 않는 층) | `spec/data-flow/4-file-storage.md` | 조치 불요 |
| 6 | 유지보수성 | "비어있지 않은 문자열" 검증 로직이 `compose_images`/`k8s_images` 두 곳에서 형태만 다르게 반복 | `.claude/tests/test_minio_image_parity.py:88`, `:112` | 우선순위 낮음. 세 번째 자리가 생기면 `_nonempty_str()` 헬퍼로 통일 고려 |
| 7 | 유지보수성 | `_mapping()` 반환 타입이 파라미터화되지 않은 `dict` 로, 파일 나머지의 `dict[str, str]` 관례와 대비 | `.claude/tests/test_minio_image_parity.py:76` | 선택 사항. `dict[str, object]` 로 좁혀도 무방 |
| 8 | 문서화 | `.claude/tests/README.md` 의 "PyYAML 예외" 단락이 나열하는 파일 목록에 이번 PR 이 추가한 `test_minio_image_parity.py` 포함 실제 `import yaml` 사용 파일 6개가 빠져 있음(이번 PR 이전부터 있던 선재 drift, 이번 diff 는 그 단락을 건드리지도 않음) | `.claude/tests/README.md:19` | 이번 PR 범위 밖. 향후 이름 나열 대신 `grep -l '^import yaml'` 기반 서술로 전환 고려 |
| 9 | 부작용 | `harness-checks.yml` pathspec 3줄 추가로 `docker-compose.yml`/`docker-compose.e2e.yml`/`k8s/overlays/local/infra-minio.yaml` 에 대한 **모든** 수정(이미지와 무관한 것 포함)이 harness pytest 전체 스위트를 태우게 됨 — 문서화된 의도된 트레이드오프이며 다른 워크플로로는 번지지 않음(`_changed-paths.yml` 구조로 확인) | `.github/workflows/harness-checks.yml:92-98` | 조치 불요. 향후 스위트 실행시간이 문제되면 파일 단위보다 세밀한 필터 고려 |
| 10 | 스코프 | `self-hosting-deployment.md` 의 아바타 공개 정책 병기 항목은 1라운드 WARNING 이 지적한 세부 기술 내용이 삭제되고 기존 문서 포인터 + 백로그 참조로 축소됨(해소 확인). `spec-draft-nullable-notation-followups.md` 의 무관 백로그 항목(spec `§8` 넘버링 drift)은 CLAUDE.md 규약(developer 는 spec 변경 필요 시 planner 위임)에 따른 정상 절차 | `plan/in-progress/self-hosting-deployment.md:57-58`, `plan/in-progress/spec-draft-nullable-notation-followups.md:5860-5866` | 조치 불요 |
| 11 | 의존성 | 신규 테스트가 쓰는 PyYAML 은 신규 의존성이 아니라 harness CI 기존 pin(`pyyaml>=6,<7`) 재사용이며 이미 6개 테스트 파일이 동일 패턴 사용 중. 컨테이너 이미지(`pgsty/silo`) 자체는 이번 diff 에서 변경되지 않음(선행 결정) | `.claude/tests/test_minio_image_parity.py:52` | 조치 불요 |
| 12 | 테스트 | 작업 중 `git status --short` 에서 `plan/in-progress/spec-draft-__snapshot_selftest__.md` 가 일시적으로 나타났다 즉시 사라짐 — 이 세션이 만들거나 지운 것이 아니며(동시 실행 중인 다른 프로세스의 self-test 산출물로 추정) 재조사 불필요해 보이나 기록으로 남김 | (일시적, 현재 미존재) | 조치 불요 — 다음 사람 참고용 기록 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 취약점 없음, `safe_load` 만 사용, 공급망 보안 강화 방향 |
| performance | NONE | 규모 고정(파일 3개·자리 6개), 알고리즘 영향 없음(setUp 재파싱은 INFO) |
| architecture | NONE | 추출기/I/O 분리 양호, `PlaceNotFound` 타입 결합은 INFO |
| requirement | NONE | 6곳 이미지 실측 일치·스위트 1149 passed 확인, 1라운드 조치 재확인 |
| scope | LOW | 핵심 변경은 계획 범위와 정확히 일치, 1라운드 Warning(scope) 해소 확인 |
| side_effect | NONE | 새 부작용 없음(순수 함수·read-only), CI 트리거 확장은 의도된 트레이드오프 |
| maintainability | NONE | 1라운드 Warning(4단 체인) 적절히 해소, 잔여는 사소한 INFO |
| testing | LOW | 컨테이너 레벨 중복 미검증 (WARNING, 뮤테이션 실측) |
| documentation | LOW | plan 체크리스트 테스트 개수 stale (WARNING) |
| dependency | NONE | 신규 의존성 없음, PyYAML 기존 pin 재사용 |
| database | NONE | 해당 코드 없음 |
| concurrency | NONE | 해당 코드 없음 |
| api_contract | NONE | 해당 코드 없음 |
| user_guide_sync | NONE | doc-sync-matrix 21행 매칭 0건 |

## 발견 없는 에이전트

database, concurrency, api_contract, user_guide_sync — 전부 "해당 없음"/발견 0건으로 명시.

## 권장 조치사항

1. `k8s_images` 의 컨테이너 레벨 중복 매칭 분기(`len(images) != 1`)에 대한 boundary test(`test_k8s_duplicate_container_is_named` 류)를 추가하고, 에러 메시지를 "found 0"/"found N" 으로 구분해 리소스 레벨 메시지와 형태를 통일한다.
2. `plan/in-progress/minio-image-parity-guard.md:81` 의 "새 테스트 7개/`-v` 7 passed" 문구를 실제 9개로 정정한다(`spec_impact: none` — 별도 게이트 불요).
3. (선택, 이번 PR 범위 밖) `.claude/tests/README.md` 의 PyYAML 예외 단락을 이름 나열 대신 `grep` 기반 서술로 바꿔 향후 stale 재발을 막는다.

## 라우터 결정

- `routing=skipped` — 라우터 미사용, 전체 reviewer 14명 실행.
- **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(forced 미이행 없음).
- 제외된 reviewer 없음(0명).
