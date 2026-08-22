# 아키텍처(Architecture) 코드 리뷰

## 변경 개요

`masked-marker-mirror-guard` 크로스스택 CI 커버리지 갭(스택별 워크플로의 경로 게이팅이 저장소
전체를 훑어야 하는 가드를 무력화하는 문제)을 backend/frontend 두 사본으로 메우던 구조를 걷어내고,
**저장소 전체를 스캔 대상으로 삼는 전용 CI 잡**(`.github/workflows/repo-guards.yml`, 신설)으로
치환한다. backend 사본(`masked-marker-mirror-guard.ts`·`masked-marker-mirror.spec.ts`, 합계
354줄)을 삭제하고 frontend 사본을 유일한 정본으로 남긴 뒤, `repo-guards.yml`의 `mirror-guard` 잡이
그 spec 하나만 돌린다. 하네스 레지스트리 2파일(`test_required_check_skip_jobs.py`,
`test_workflow_yaml_structure.py`)이 신규 워크플로를 skip-job 계약(`paths:` 부재·`needs:
changes`·`if:` 게이팅·permissions 등)에 편입시킨다. 이 회차는 직전 리뷰 라운드(`14_02_49`)가 지적한
WARNING 2건(단일 소비처만 보고 `channel-web-chat` pathspec 제거 / 핵심 불변식이 1회성 수동 실측에만
의존)에 대한 수정(`997038e94`)도 포함한다 — 핵심 설계(전용 CI 잡으로 중복의 원인 자체 제거)는 그
라운드에서 이미 검토된 것과 동일하다.

## 발견사항

- **[INFO]** 중복 제거 방식으로 "공유 코드 추출" 대신 "중복을 유발한 원인(CI 경로 게이팅) 자체
  제거"를 택한 설계 — 계층에 맞는 해법
  - 위치: `.github/workflows/repo-guards.yml`(신규 파일, 헤더 주석 전체) `## 왜 별도 워크플로인가`
    절; `plan/in-progress/mirror-guard-single-copy.md` `## 왜 공유 패키지가 아닌가` 절
  - 상세: 원래 트래커 항목은 "탐지 로직을 공유 test-utility 패키지로 재추출"이었다. 그 안대로
    갔다면 **로직만 1본이 되고 러너(CI 잡)는 둘로 남아** 경로 게이팅 문제 자체는 그대로였을 것이다
    (backend·frontend 각자의 워크플로가 계속 각자 스택만 relevant 로 잡으므로). 채택된 안은 문제의
    본질이 "코드 위치"가 아니라 "트리거 범위"임을 정확히 짚어, CI 설정 계층에서 `codebase/**` 전체를
    보는 잡을 하나 만들어 문제를 해소했다. 그 결과 로직·러너 모두 1본이 된다. 등록 표면(8곳 vs
    5곳)과 자동 검증 비율(2/8 vs 5/5)을 실측 비교해 근거를 남긴 것도 설계 결정을 검증 가능하게
    만든다. 이 저장소가 같은 클래스 결함(라운드3·라운드6 비대칭 사고)을 두 번 겪은 뒤 얻은 결론이라
    근거가 탄탄하다.
  - 제안: 없음 — 설계 자체는 양호.

- **[INFO]** 크로스스택 거버넌스 로직이 `codebase/frontend/src/lib/repo-guards/__tests__/`(frontend
  앱 소스 트리) 안에 유일한 정본으로 위치 — 디렉터리 소유권과 실제 책임 범위의 불일치 (직전 라운드
  관찰의 연속, 이번 diff 로 새로 생긴 결합은 아님)
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:1`-`22`
    (`resolveScanDirs`가 `codebase/backend`·`codebase/packages`·`codebase/channel-web-chat` 를
    포함해 저장소 전체를 훑는 로직)
  - 상세: backend 사본이 있을 때도 frontend 사본은 이미 저장소 전체를 스캔했으므로 이 결합 자체는
    이번 PR 이 새로 만든 것이 아니다. 다만 backend 사본을 지우면서 "frontend 워크스페이스가
    크로스스택 불변식의 유일한 코드 소재지" 라는 사실이 더 선명해졌다. TypeScript AST 파서와
    vitest 를 이미 보유한 워크스페이스를 재사용한 실용적 선택이고, `internal-package-registration-
    guard.ts`·`typescript-toolchain-guard.ts` 등 형제 가드와 배치 컨벤션이 동일해 저장소 관례에는
    부합한다. 하지만 이 파일의 실제 책임(backend·packages·channel-web-chat 판정)은 "frontend 앱
    코드" 라는 디렉터리 이름이 암시하는 경계보다 넓다.
  - 제안: 현 시점 조치 불요(형제 가드와 일관, TS AST 필요성이 실용적 근거). 크로스스택 가드가 더
    늘어나면 `.claude/tests/`(이미 저장소 전체를 보는 관례적 소재지, Python) 또는 별도 tooling
    패키지로 재배치하는 편이 모듈 경계상 더 명확할 수 있다는 점만 후속 검토 항목으로 남긴다.

- **[INFO]** `repo-guards.yml`은 헤더에서 "저장소 전체를 스캔하는 가드 전부의 자리"로 스스로를
  정의하지만, 잡·스텝 골격은 일반화되지 않고 `mirror-guard` 잡 하나에 특화됨 — 두 번째 크로스스택
  가드 추가 시 잡 골격(checkout·pnpm-workspace 설치·no-op 안내 스텝)이 복제될 가능성
  - 위치: `.github/workflows/repo-guards.yml:62`-`86` (`mirror-guard:` 잡 전체, 특히 `84`-`86` 의
    하드코딩된 vitest 대상 spec 경로)
  - 상세: `changes` 잡은 이미 `_changed-paths.yml` 재사용 워크플로로 추출돼 판정 로직 중복은 없다.
    남은 것은 GitHub Actions 특성상 워크플로 파일마다 반복될 수밖에 없는 잡 레벨 골격(권한·
    concurrency·checkout·조건부 스텝)이며, 이는 `frontend-checks.yml`/`backend-checks.yml` 등
    형제 워크플로와 동일한 패턴으로 저장소가 "3번째 전환 시점에 추출한다"는 명시적 컨벤션을 이미
    적용해 온 영역이다(`_changed-paths.yml` 헤더 근거). 즉 새로운 결함은 아니지만, `mirror-guard`
    잡 이름 자체가 단일 가드에 특정돼 있어 향후 두 번째 저장소-전체 가드가 이 잡에 스텝을 얹을지
    새 잡을 만들지가 이름만으로는 드러나지 않는다. vitest 대상 spec 경로 하드코딩은 파일이
    이동/삭제되면 vitest 가 non-zero exit 로 실패하므로 fail-closed 이며 조용한 무력화 위험은
    없다.
  - 제안: 지금은 조치 불요(가드가 하나뿐이므로 과설계 방지가 더 중요). 두 번째 저장소-전체 가드가
    실제로 생기는 시점에 잡 명명·구조를 재검토.

- **[INFO]** (긍정적 관찰) 이 워크플로의 핵심 불변식("`codebase/**` pathspec 이 모든 스택을
  덮는다")을 1회성 수동 실측에서 자동 회귀 테스트로 전환 — vacuous 방지 이중 단언 포함
  - 위치: `.claude/tests/test_required_check_skip_jobs.py`의
    `DeadFilterTest.test_repo_guards_pathspec_covers_every_stack`(신규, `REPO_GUARDS_MUST_COVER`
    상수와 함께)
  - 상세: 기존 제네릭 `test_no_pathspec_is_a_dead_filter`는 pathspec 이
    `codebase/frontend/**` 하나로 좁혀져도 여전히 GREEN 을 내는 형태라(어떤 tracked 파일이든
    매치하면 통과) 이 워크플로의 존재 이유("모든 스택을 덮는다")를 지키지 못한다. 신규 테스트는
    스택별로 "①대상 스택에 tracked 파일이 존재하는가(먼저 vacuous 방지) → ②pathspec 이 그중
    최소 1개와 매치하는가"를 순서대로 확인해, 스택 자체가 비어 단언이 무의미해지는 경로까지 막는다.
    RESOLUTION.md 에 기록된 뮤테이션 실증(pathspec 을 `codebase/frontend/**` 로 좁히면 backend·
    packages·channel-web-chat 세 스택이 RED)도 이 테스트가 실제로 분기를 가른다는 근거다. 매칭
    헬퍼도 기존 `test_harness_checks_paths_coverage.filter_covers_file` 를 재사용해 4번째 독립
    구현을 만들지 않았다.
  - 제안: 없음 — 긍정적 변경.

## 요약

이 PR 은 "크로스스택 CI 가드를 스택별 워크플로 경로 게이팅에서 어떻게 실행할 것인가"라는 문제를,
증상(코드 사본을 늘려 어느 한쪽은 걸리게 하기)이 아니라 원인(트리거 범위가 스택별로 좁다)에서
해결한다. 트래커 원안(공유 devDep 패키지 추출)을 등록 표면·자동검증 비율 실측으로 기각하고 전용
CI 잡(`repo-guards.yml`)을 신설해 로직·러너 모두 1본으로 수렴시킨 결정은 근거가 탄탄하며, 하네스
레지스트리가 신규 워크플로를 skip-job 계약에 기계적으로 편입시켜 구조적 회귀(경로 필터 부재·
`needs`/`if:` 게이팅 누락)를 방지한다. 직전 라운드가 지적한 WARNING 2건(단일 소비처 판단·수동
실측 의존)도 근거를 갈아 끼우거나(pathspec) 자동 회귀 테스트로 전환해 정확히 해소했다. 순환
의존이나 레이어 위반은 없고, SRP·DIP 관점에서도 backend 트리 전용 가드(masked-reject-callers 등)는
그대로 두고 저장소 전체를 훑는 가드만 분리한 경계 설정이 합리적이다. 남은 관찰은 실질 결함이
아니라 향후 확장 시 참고할 설계 메모(크로스스택 로직의 frontend 소재지, `repo-guards.yml` 잡 골격의
일반화 여지)뿐이다.

## 위험도

LOW
