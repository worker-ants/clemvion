# 아키텍처(Architecture) 코드 리뷰

## 변경 개요

`masked-marker-mirror-guard` CI 커버리지 갭(스택별 워크플로의 경로 게이팅이 크로스스택 가드를
무력화하는 문제)을, backend/frontend 두 사본을 두는 대신 **저장소 전체를 스캔 대상으로 삼는
전용 CI 잡**(`.github/workflows/repo-guards.yml`)으로 해소한다. backend 사본
(`masked-marker-mirror-guard.ts` · `masked-marker-mirror.spec.ts`) 을 삭제하고 frontend 사본을
유일한 정본으로 남긴 뒤, `repo-guards.yml` 의 `mirror-guard` 잡이 그 spec 하나만 돌린다. 하네스
레지스트리(`.claude/tests/test_required_check_skip_jobs.py`, `test_workflow_yaml_structure.py`)
가 신규 워크플로를 skip-job 계약(`paths:` 부재·`needs: changes`·`if:` 게이팅 등)에 편입시킨다.

## 발견사항

- **[INFO]** 크로스스택 가드 로직을 별도 공유 패키지로 추출하지 않고 "중복의 원인(경로 게이팅)을
  없애는 전용 CI 잡" 으로 해결한 설계 선택
  - 위치: `plan/in-progress/mirror-guard-single-copy.md` `## 왜 공유 패키지가 아닌가` 절;
    `.github/workflows/repo-guards.yml:1`-`23` (헤더 comment)
  - 상세: 트래커 원안(`@workflow/repo-guard-utils` devDep 패키지)과 실제 채택안(전용 CI 잡)을
    등록 표면(8곳 vs 5곳)·자동 검증 비율(2/8 vs 5/5)·프로덕션 배포 경로(Dockerfile) 오염 여부로
    실측 비교하고 근거를 `Rationale`/`## 왜 공유 패키지가 아닌가` 에 남겼다. 로직·러너 모두 1본이
    되는 안을 선택해 "판정 분기가 바뀔 때마다 사람이 대칭을 재보증해야 하는 구조"(트래커의 근본
    결함)를 실제로 제거한다. 이 저장소가 같은 클래스 결함(라운드3·라운드6 비대칭 사고)을 두 번
    겪은 뒤 얻은 결론이라 근거가 탄탄하다.
  - 제안: 없음 — 설계 자체는 양호. 다만 `.github/workflows/repo-guards.yml` 이라는 이름이 향후
    "저장소 전체를 스캔하는 가드" 를 담는 **일반 컨테이너**로 의도돼 있으므로(헤더 `## 범위` 절),
    새 크로스스택 가드가 추가될 때 `mirror-guard` 잡 하나만 보고 "이미 이 워크플로가 존재한다" 고
    오인해 skip-job 계약(`needs: changes`, `if: !cancelled()`, no-op 안내 스텝)을 빠뜨리지 않도록
    — 이 부분은 이미 `test_every_step_is_gated`/`test_each_job_announces_the_no_op_path` 가 잡 단위로
    강제하므로 실질 위험은 낮다.

- **[INFO]** 크로스스택 거버넌스 로직이 `codebase/frontend/src/lib/repo-guards/__tests__/` (frontend
  앱 소스 트리) 안에 유일한 정본으로 자리잡음
  - 위치: `codebase/frontend/src/lib/repo-guards/__tests__/masked-marker-mirror-guard.ts:1`-`14`
    (신설 헤더 주석 — "이 파일이 유일한 사본이다")
  - 상세: `resolveScanDirs`/`findMirrorRedeclarations` 는 `codebase/backend/**`·
    `codebase/packages/**`·`codebase/channel-web-chat/**` 를 포함해 저장소 전체를 훑는다. 이
    책임은 원래도 frontend 사본이 지고 있었으므로(양쪽 다 전체를 스캔) 이번 PR 이 새로 만든 결합은
    아니지만, backend 사본을 지우면서 "frontend 워크스페이스가 크로스스택 불변식의 유일한 코드
    소재지가 된다" 는 사실이 더 선명해졌다. TypeScript AST 파서(`typescript` 패키지)와 vitest 를
    이미 보유한 워크스페이스를 재사용한 실용적 선택이고, `internal-package-registration-guard.ts`
    등 형제 가드와 배치 컨벤션이 동일해 저장소 관례에는 부합한다. 다만 이 파일의 실제 책임 범위
    (backend·packages·channel-web-chat 판정)는 "frontend 앱 코드" 라는 디렉터리 이름이 암시하는
    범위보다 넓다 — 향후 가드가 더 늘면 `.claude/tests/`(Python, 이미 저장소 전체를 보는 관례적
    소재지)로 재배치하는 편이 모듈 경계상 더 명확할 수 있다.
  - 제안: 현 시점에서는 조치 불요(형제 가드와 일관된 배치, TS AST 필요성이 실용적 근거). 크로스스택
    가드가 추가로 늘어나면 전용 위치(예: `.claude/tests/` 또는 별도 tooling 패키지) 재검토를 후속
    항목으로 고려.

- **[INFO]** 동일 가드 spec 이 frontend PR 에서 두 워크플로(`frontend-checks.yml` 의 전체 vitest,
  `repo-guards.yml` 의 `mirror-guard`)에서 중복 실행됨 — 의도적으로 문서화된 트레이드오프
  - 위치: `.github/workflows/repo-guards.yml:21`-`23` (헤더 "> 미러 가드는 frontend vitest
    스위트에도 그대로 포함된다 — 즉 frontend 를 건드리는 PR 에서는 두 번 돈다")
  - 상세: 로컬 `run-test.sh unit` 이 별도 배선 없이 가드를 실행하게 하려는 목적으로 중복 실행을
    수용했다. 비용(수 초)이 낮아 실질적 문제는 아니지만, "전용 CI 잡으로 로직·러너를 1본화했다"
    는 Rationale 의 주장과 "잡(실행 인스턴스)은 여전히 조건부로 2곳" 이라는 사실이 약간 어긋나
    보일 수 있어 다음에 이 rationale 을 재사용할 때 오독 소지가 있다.
  - 제안: 조치 불요 — 근거와 트레이드오프가 이미 명문화돼 있다.

## 요약

이 변경은 CI 경로 게이팅으로 인해 크로스스택 불변식 가드가 스택별로 사본화되며 두 차례 실제
비대칭 결함(한쪽만 고치고 "양쪽 다 고쳤다"고 기록)을 유발한 근본 원인을 제거한다. 공유 devDep
패키지 추출안을 등록 표면 실측(8곳 vs 5곳, 자동검증 2/8 vs 5/5, Dockerfile 오염 여부)으로 기각하고
전용 CI 잡(`repo-guards.yml`)을 신설해 로직·러너를 각 1본으로 수렴시킨 결정은 근거가 탄탄하고
하네스 레지스트리(`test_required_check_skip_jobs.py`, `test_workflow_yaml_structure.py`)가 신규
워크플로를 skip-job 계약(경로 필터 부재·`needs`·`if:` 게이팅·no-op 안내)에 자동으로 편입시켜
구조적 회귀를 방지한다. `frontend-checks.yml` 에서 더는 근거가 없는
`codebase/channel-web-chat/**` pathspec 을 함께 제거해 모듈 경계(스택별 워크플로가 자기 스택만
본다)도 정리됐다. 남은 것은 실질적 결함이 아니라 향후 확장 시 참고할 설계 관찰(크로스스택 로직의
frontend 소재지, 의도적 중복 실행)뿐이다.

## 위험도

LOW
