# 데이터베이스(Database) 리뷰 결과

## 검토 대상 확인

리뷰 대상 8개 파일은 전부 harness(CI/테스트/워크플로/plan 문서) 영역이다:

1. `.claude/tests/README.md`
2. `.claude/tests/test_block_integrity.py`
3. `.claude/tests/test_review_gate_ci.py`
4. `.claude/tests/test_stop_guard_failopen.py`
5. `.github/workflows/harness-checks.yml`
6. `.github/workflows/review-gate.yml`
7. `plan/in-progress/harness-review-gate-ci-backstop.md`
8. `scripts/check-review-gate.py`

SQL 쿼리, ORM/마이그레이션 파일, 스키마 정의, 커넥션 풀 설정, 트랜잭션 코드 등 데이터베이스
관련 패턴(`SELECT/INSERT/UPDATE/DELETE`, `typeorm`, `prisma`, `knex`, `pg.`, `mysql`,
`postgres`, `.query(`, `repository.` 등)을 전수 grep 했으나 실제 매치는 없었다.
`migration-check.yml`(check-migration-versions.py) 언급이 1건 있으나, 이는
`harness-checks.yml` 의 주석에서 "scripts/ 하위 파일 중 harness unittest 가 커버하는 것을
명시 등재해야 하는 이유"를 설명하며 **다른 워크플로의 사례를 비교 참조**한 것일 뿐, 이번
변경에 포함된 코드가 아니다. `_retry_state.json` 관련 서술(plan 문서)도 JSON 상태 파일에
대한 lost-update 논의로, 관계형 DB 트랜잭션과는 무관하다.

변경 내용은 review-gate CI 백스톱(`scripts/check-review-gate.py` + `review-gate.yml`)의
라운드 4 하드닝(정적 패턴매칭 폐기 → 정확일치+행위검증 전환)과 그에 대한 harness self-test
들로, 데이터베이스 계층과 접점이 없다.

### 요약 (DB 관점)

이번 변경분은 GitHub Actions 워크플로/파이썬 harness 테스트/plan 문서로만 구성되어 있으며
데이터베이스 관련 코드(쿼리, 스키마, 마이그레이션, 트랜잭션, 커넥션 관리 등)를 전혀 포함하지
않는다. 데이터베이스 관점에서 검토할 대상이 없다.

### 위험도 (DB 관점)

NONE

---

## 부록: 라운드 4 레드팀 검증 ("SHIPPED BEHAVIOUR 를 바꾸면서 테스트를 전부 GREEN 으로
유지할 수 있는가")

DB 관점 검토와는 별개로, 호출자가 이번 세션에 명시적으로 요청한 작업(라운드 4 백스톱 하드닝에
남은 구멍이 있는지 실측)을 수행했다. 요약: **가능했다.** `continue-on-error` 를 게이트
**step** 이 아니라 **job**(`jobs.gate`) 레벨에 붙이면 `test_review_gate_ci.py` 18개 테스트가
전부 그대로 GREEN 이다.

### 재현 절차

작업 트리는 건드리지 않고 별도 클론에서 검증했다.

```bash
SCRATCH=$(mktemp -d)
git clone --quiet /Volumes/project/private/clemvion/.claude/worktrees/harness-review-ci-backstop-91f379 "$SCRATCH/repo"
cd "$SCRATCH/repo"

# 1) 베이스라인 — 18개 테스트 그린 확인
python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
#   Ran 18 tests in 2.455s
#   OK

# 2) 뮤테이션 — review-gate.yml 의 `gate:` JOB 에 continue-on-error: true 삽입
#    (step 이 아니라 job 레벨. 삽입 후 해당 블록:)
#      jobs:
#        gate:
#          runs-on: ubuntu-latest
#          continue-on-error: true
#          timeout-minutes: 5
#          ...
#          if: github.actor != 'dependabot[bot]'

# 3) 뮤테이션 후 재실행
python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
#   Ran 18 tests in 2.548s
#   OK   ← 전부 그대로 통과 (실패 0)
```

원본 작업 트리는 무변경으로 확인:

```bash
git status --short
# ?? review/code/2026/08/06/     (이번 리뷰 산출물 디렉토리뿐)
git diff --stat -- .github/workflows/review-gate.yml .claude/tests/test_review_gate_ci.py scripts/check-review-gate.py
# (출력 없음 — 변경 없음)
```

검증 후 스크래치 클론은 `rm -rf` 로 정리했다.

### 왜 뚫리는가

`WorkflowWiringTest._NEUTERING_KEYS = ("if", "continue-on-error", "timeout-minutes")` 는
**게이트 step 객체**(`self.steps[self._gate_step_index()]`)에만 적용된다
(`test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed`). 3R 에서 정확히
이 형태(step 의 `continue-on-error: true`)가 뚫렸던 것을 닫은 결과다. 그런데 GitHub Actions
는 **동일한 키 `continue-on-error` 를 job 레벨에도 지원한다**
(`jobs.<job_id>.continue-on-error: true` — "워크플로 실행이 이 job 의 실패로 실패 처리되지
않게 한다"). `job` 객체(`self.job`) 는 `test_the_job_condition_is_exactly_the_bot_exemption`
에서 `if` 키만 정확 일치로 검사하고, `continue-on-error`/`timeout-minutes` 는 job 레벨에서
전혀 검사되지 않는다.

`--enforce` 를 켠 미래 상태를 가정하면: 게이트 script 가 `exit 1` 을 내더라도 job 자체가
`continue-on-error: true` 라 워크플로/체크런 결론이 실패로 전파되지 않는다 — 즉 브랜치
보호 규칙이 이 워크플로를 required check 로 걸어도 늘 통과로 보인다. 정확히 라운드 3→4 에서
닫힌 구멍과 **같은 클래스**(step 이 실패를 못 내게 만드는 형제 키)가 검사 축을 하나 옮겨서
재발한 사례다. 프롬프트가 경고한 "Assume there are more of that shape" 가 실측으로
확인됐다.

### 제안

`WorkflowWiringTest` 에 `self.job` 레벨의 `continue-on-error`/`timeout-minutes` 부재를
검사하는 항목을 추가한다 (`_NEUTERING_KEYS` 를 step 뿐 아니라 job 객체에도 동일하게
적용하거나, job 전용 별도 assert 를 추가). 이 클래스의 "형제 키" 서치를 GitHub Actions
스펙에서 유사 의미를 갖는 **다른 레벨**(step vs job)까지 완전히 훑었는지 재검토 필요 —
예컨대 `jobs.<job_id>.strategy.fail-fast` + 인위적 matrix, 또는 워크플로 자체를
`workflow_call` 로 감싸 상위에서 결과를 무시하는 형태 등, 아직 실측하지 않은 인접 표면이
남아있을 수 있다.

---

STATUS=success ISSUES=1
