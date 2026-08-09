# 보안(Security) 코드 리뷰

## 리뷰 범위

- `.claude/tests/README.md` (문서 갱신)
- `.claude/tests/test_required_check_skip_jobs.py` (신규 테스트)
- `.claude/tests/test_workflow_yaml_structure.py` (등재 상수 갱신)
- `.github/workflows/deps-security-checks.yml` (`paths:` 필터 → skip-job 패턴 전환)
- `.github/workflows/frontend-checks.yml` (`paths:` 필터 → skip-job 패턴 전환)
- `scripts/ci-paths-changed.sh` (신규 — 변경 경로 판정 스크립트)

핵심 변경은 GitHub Actions `required status check` 데드락(무관 PR 에서 `paths:` 필터로 워크플로가
아예 실행되지 않아 체크가 영구 대기 상태로 남는 문제)을 해소하기 위해, 워크플로 트리거의
`paths:` 필터를 제거하고 신설 `changes` 잡 + `scripts/ci-paths-changed.sh` 로 관련성을 판정해
각 잡의 **스텝**을 `if:` 로 게이팅하는 구조로 바꾼 CI 인프라 변경이다.

## 발견사항

- **[INFO]** GitHub Actions 스크립트 인젝션 클래스는 올바르게 회피됨 (확인 사항, 결함 아님)
  - 위치: `.github/workflows/deps-security-checks.yml:55-57`, `.github/workflows/frontend-checks.yml:39-41`, `scripts/ci-paths-changed.sh:54-55`
  - 상세: `github.event.pull_request.base.sha` / `head.sha` 같은 신뢰할 수 없는(PR 제출자 통제하) 컨텍스트 값을 `run:` 블록 문자열에 `${{ }}` 로 직접 보간하지 않고, `env:` 매핑을 거쳐 셸 변수로 전달한 뒤 스크립트 내부에서 항상 큰따옴표로 인용해(`"$BASE_SHA"`, `"$HEAD_SHA"`) 사용한다. 이는 GitHub Actions 의 대표적인 "script injection" 패턴(`run: echo "${{ github.event.pull_request.title }}"` 류)을 피하는 정석적인 방어다. 값 자체도 git 커밋 SHA(해시 출력)라 임의 텍스트를 주입할 수 없고, `git merge-base "$BASE_SHA" "$HEAD_SHA"` / `git diff --name-only "$MERGE_BASE" "$HEAD_SHA" -- "$@"` 호출도 모두 인용된 변수라 옵션 인젝션(`--` 로 시작하는 값이 플래그로 해석되는 부류) 여지도 없다.
  - 제안: 없음 — 현 구현 유지 권장.

- **[INFO]** 신설 `changes` 잡에 명시적 `permissions:` 블록 없음
  - 위치: `.github/workflows/deps-security-checks.yml:43-67` (changes 잡), `.github/workflows/frontend-checks.yml:28-49` (changes 잡)
  - 상세: 두 워크플로 모두 파일 전체에 `permissions:` 키가 없어(diff 밖에서도 부재 — 이 PR 이 새로 만든 갭이 아니라 기존 관례), 신설된 `changes` 잡은 리포지토리/조직 기본 `GITHUB_TOKEN` 권한을 그대로 상속한다. `pull_request` 이벤트(⚠️ `pull_request_target` 아님)라 포크 PR 에서는 GitHub 이 강제로 read-only + 시크릿 미주입을 적용하므로 실질 위험은 낮고, 이 잡이 하는 일도 `actions/checkout` + 로컬 셸 스크립트뿐이라 토큰을 능동적으로 사용하지 않는다. 다만 OWASP CICD-SEC-2(최소 권한) 관점에서 최선의 실천은 아니다.
  - 제안: 여유가 있다면 `permissions: contents: read` 를 워크플로 최상위 또는 `changes` 잡에 명시해 최소 권한을 문서화. 이번 PR 의 스코프(스킵-잡 계약)와는 무관하므로 강제 요구는 아님.

- **[INFO]** 액션이 major 태그로 핀됨 (SHA 핀 아님) — 기존 관례, 이번 diff 가 새로 만든 문제 아님
  - 위치: `.github/workflows/deps-security-checks.yml:50` (`- uses: actions/checkout@v7`, changes 잡), `.github/workflows/frontend-checks.yml:35` (`- uses: actions/checkout@v7`, changes 잡)
  - 상세: `actions/checkout@v7` 등은 movable 태그이며 커밋 SHA 로 고정되어 있지 않다. 태그가 재지정되면 공급망 공격에 노출될 수 있다. 그러나 저장소 전역에 이미 동일 패턴(`actions/setup-python@v7`, `pnpm/action-setup@v6.0.9` 등)이 광범위하게 존재하므로 이 PR 이 도입한 회귀가 아니라 저장소 전체의 기존 컨벤션을 새 잡에도 그대로 반영한 것.
  - 제안: 전사적 SHA 핀 전환은 별도 트래킹 항목으로(이번 PR 스코프 아님).

`ci-paths-changed.sh` 의 fail-safe 방향(불확실하면 항상 `relevant=true`, 즉 검사를 **더** 도는
쪽으로 기울임 — schedule/workflow_dispatch, base/head SHA 부재, shallow-clone 으로 인한
merge-base 계산 실패, git diff 실패 전부 동일)은 보안 검사(`pnpm audit`, `check-override-floors.py`
등)를 조용히 생략하는 방향이 아니라 과도하게 도는 방향으로 설계되어 있어 안전하다. 두
워크플로의 `changes` 잡이 비교하는 pathspec 목록도 기존 `paths:` 필터와 동일 집합을 유지하며
오히려 `scripts/ci-paths-changed.sh` 자기 자신의 경로를 추가해(회귀 방지 테스트
`test_converted_workflows_pass_the_script_its_own_path` 로 고정) 커버리지가 축소되지 않았음을
확인했다. 새 `.claude/tests/test_required_check_skip_jobs.py` 는 `needs: changes` 누락, 스텝
`if:` 누락, `paths:` 부활의 세 가지 회귀를 모두 테스트로 고정해 "체크는 초록인데 아무 검사도
하지 않는" CI 무결성 실패(공급망/보안 게이트가 조용히 무력화되는 클래스)를 구조적으로 차단한다.
하드코딩된 시크릿, SQL/커맨드/경로 인젝션, 인증/인가 우회, 안전하지 않은 암호화, 민감정보 노출
에러 처리 등 다른 점검 관점에서는 해당 사항이 없었다 (본 diff 는 애플리케이션 코드가 아닌
CI 워크플로/하네스 테스트만 다룬다).

## 요약

이번 변경은 애플리케이션 코드가 아닌 GitHub Actions 워크플로 트리거 구조와 그 회귀 방지
테스트로, required status check 데드락을 해소하면서 보안 검사(`pnpm audit`,
`check-override-floors.py`, `check-pnpm-security-config.py`)의 실행 커버리지를 축소하지 않고
오히려 fail-safe 방향(불확실하면 실행)으로 설계했다. `github.event.pull_request.*.sha` 처리도
`env:` 간접화 + 인용을 통해 GitHub Actions 의 대표적 스크립트 인젝션 클래스를 정확히 회피했고,
`pull_request_target` 이 아닌 `pull_request` 트리거를 사용해 포크 PR 에 시크릿/쓰기 권한이
새어 나가지 않는다. Critical/Warning 급 결함은 발견되지 않았으며, 최소 권한 `permissions:`
블록 부재와 액션 태그 핀(SHA 미고정)은 저장소 전역의 기존 관례이자 낮은 실질 위험의
INFO 수준 개선 여지로만 기록한다.

## 위험도

NONE
