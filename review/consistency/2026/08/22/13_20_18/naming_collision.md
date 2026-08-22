STATUS=success naming_collision review complete — 0 CRITICAL, 0 WARNING

### 발견사항

- **[INFO]** 신규 워크플로 파일명이 기존 `<영역>-checks.yml` 패턴에서 벗어남
  - target 신규 식별자: `.github/workflows/repo-guards.yml`
  - 기존 사용처: `.github/workflows/{backend,frontend,packages,spec-link,web-chat,deps-security,harness}-checks.yml` (전부 `<영역>-checks.yml` 형태), 예외로 `migration-check.yml`(단수형)·`review-gate.yml`·`e2e.yml`·`_changed-paths.yml`(내부 재사용) 존재
  - 상세: 새 파일명 자체는 저장소 어디에도 존재하지 않아(git 이력·`origin/main` 확인 완료) 직접적인 경로 충돌은 없다. 다만 대다수 기존 CI 워크플로가 `<영역>-checks.yml` 명명을 따르는 반면 이 target 은 `repo-guards.yml`(복수형, `-checks` 접미사 없음)을 쓴다. 단, `migration-check.yml`·`review-gate.yml` 등 이미 그 패턴을 벗어난 선례가 있어 강제 컨벤션은 아니다. 오히려 `repo-guards.yml` 이라는 이름은 코드베이스의 기존 소스 디렉터리 `codebase/backend/src/repo-guards/`·`codebase/frontend/src/lib/repo-guards/`(가드 테스트가 실제로 위치한 곳)와 의미적으로 정확히 대응해 오히려 발견성이 좋다.
  - 제안: 강제 조치 불필요. 원한다면 `repo-guards-checks.yml` 로 통일할 수 있으나, 기존에도 예외가 있으므로 현재 이름 유지가 합리적이다.

### 확인한 항목 (충돌 없음)

- **요구사항 ID**: target 은 `spec_impact: none` 이며 신규 ND-*/EIA-* 등 요구사항 ID 를 전혀 도입하지 않는다. 순수 CI/테스트-인프라 재구성 plan.
- **엔티티/DTO/인터페이스명**: 신규 엔티티 없음. 기존 클래스/함수(`resolveScanDirs`/`findRedeclaredSymbols`/`findMirrorRedeclarations` 등, `masked-marker-shared-package.md` 의 후속 항목에서 유래)를 이관할 뿐 새 이름을 만들지 않는다.
- **API endpoint**: 신규 endpoint 없음.
- **이벤트/메시지명**: 신규 webhook/queue/SSE 이벤트 없음.
- **환경변수·설정키**: 신규 ENV var / config key 없음.
- **CI 워크플로 파일 경로**: `.github/workflows/repo-guards.yml` — git 전체 이력·`origin/main` 조회 결과 동일 경로 없음(신설). 다른 워크플로 파일 내 job id 와도 겹치지 않음(각 워크플로는 자기 파일 스코프 안에서만 job id 를 참조하므로 GitHub Checks 표시명이 `<workflow명> / <job명>` 으로 자동 네임스페이스됨).
- **하네스 레지스트리 4곳**: `test_required_check_skip_jobs.py` 의 `CONVERTED` 리스트(8개 기존 항목, `repo-guards.yml` 없음)·`test_workflow_yaml_structure.py` 의 `_PERMISSIONS` 딕셔너리(동일 8개 키, `repo-guards.yml` 없음) 등 실측 확인 — target 이 추가하려는 키는 기존에 존재하지 않는 새 키이므로 덮어쓰기·충돌 없음.
- **관련 plan 간 계보**: `plan/in-progress/masked-marker-shared-package.md` §후속 의 "미러 가드 탐지 로직을 공유 test-utility 로 재추출" 항목이 target 이 닫으려는 정본 트래커 항목과 동일 계보(target 이 이를 대체안으로 집행)로, 이름 충돌이 아니라 의도된 연속성.
- **삭제 대상 파일**: `codebase/backend/src/repo-guards/__tests__/{masked-marker-mirror-guard.ts,masked-marker-mirror.spec.ts}` — 기존 존재 확인, 신규 식별자 아님(삭제 대상이므로 충돌 대상 아님).

### 요약

target plan(`plan/in-progress/mirror-guard-single-copy.md`)은 신규 요구사항 ID·엔티티·API endpoint·이벤트명·환경변수를 전혀 도입하지 않는 순수 CI 인프라 재구성 작업이다. 유일한 신규 식별자는 `.github/workflows/repo-guards.yml` 파일 경로이며, 저장소 전체 git 이력과 관련 하네스 레지스트리(`test_required_check_skip_jobs.py::CONVERTED`, `test_workflow_yaml_structure.py::_PERMISSIONS`) 를 실측 대조한 결과 기존 항목과 충돌하지 않는다. 기존 워크플로 명명 패턴(`<영역>-checks.yml`)과 형태가 다르다는 점을 INFO 로만 기록했는데, 이미 `migration-check.yml`/`review-gate.yml` 같은 예외가 있어 강제 컨벤션 위반으로 볼 근거는 약하다. 신규 식별자 충돌 관점에서는 실질적 리스크가 없다.

### 위험도

NONE
