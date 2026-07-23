# 보안(Security) 리뷰 — reap-merged-worktrees.sh `gh pr list` 배치화

## 리뷰 범위

- `.claude/tools/reap-merged-worktrees.sh` — `gh_state()` 를 순차 `gh pr view` N+1 호출에서
  1회 `gh pr list --state all --limit N --json headRefName,state` 배치 조회 + 배치 미스/실패 시
  단건 `gh pr view` 폴백으로 전환.
- `.claude/tests/test_reap_merged_worktrees.py` — gh stub 이 `pr list`/`pr view` 양쪽을 모델링하도록
  갱신, 호출 로깅 기반 신규 테스트 5건.
- `plan/in-progress/harness-guard-followups.md` — 위 작업 완료 체크박스 갱신 (문서만).

로컬 개발자 워크플로 도구(SessionStart 훅에서 동기 실행)이며, 원격 공격면(웹/네트워크 서비스)이
아니라 이미 인증된 `gh` CLI 를 감싸는 셸 스크립트라는 점을 전제로 분석했다.

## 발견사항

- **[INFO]** awk 필드 비교가 문자열 등가(`==`)이며 정규식(`~`) 이 아님
  - 위치: `reap-merged-worktrees.sh` `gh_state()`, `hit=$(printf '%s\n' "$_pr_states" | awk -F'\t' -v b="$branch" '$1==b{print $2; exit}')`
  - 상세: 브랜치 이름을 `-v` 로 awk 변수에 바인딩하고 `==` 로 비교하므로, 브랜치 이름에 정규식
    메타문자(`.`, `*` 등)가 있어도 리터럴 매칭만 일어난다. 인젝션·오탐 매치 가능성이 배제된
    안전한 패턴이다. `git for-each-ref` 로 열거되는 이름은 `refs/heads/claude/` 아래로 한정되어
    있어 실질적으로 통제된 입력이기도 하다.
  - 상세(2): 다만 이 매칭이 성립하려면 브랜치 이름에 탭/개행 문자가 없어야 하는데(tab-delimited
    레코드 파싱), git ref 이름 문법 자체가 제어문자를 금지하므로 이 가정은 항상 성립한다.
  - 제안: 없음 — 현재 구현으로 충분히 안전. 참고용 기록.

- **[INFO]** `GH_PR_LIMIT`/`MIN_INTERVAL` 값 검증이 인젝션이 아닌 산술 오류만 방지
  - 위치: `reap-merged-worktrees.sh:64` `case "$GH_PR_LIMIT" in ''|*[!0-9]*|0) GH_PR_LIMIT=200 ;; esac`
  - 상세: 숫자가 아니면 기본값(200)으로 되돌리는 가드가 있어 `--limit` 인자에 임의 문자열이
    전달되는 경로가 없다. env var 로만 제어되므로(로컬 프로세스 환경, 원격 사용자 입력 아님)
    커맨드 인젝션 표면도 아니다. 안전.

- **[INFO]** `gh` 실패를 모두 `2>/dev/null` 로 흡수 후 폴백 — fail-safe 이지만 관측성 저하
  - 위치: `_load_pr_states()`, `gh_state()` 양쪽
  - 상세: 인증 만료·API 에러가 조용히 폴백 경로로 흘러 스크립트는 항상 exit 0(설계 의도, 헤더
    주석에 명시). 삭제 대상 판정이 "증명된 MERGED만 제거"라는 기존 fail-safe 정책을 그대로
    유지하므로 **보안적으로는 안전한 방향(fail-closed on deletion)** 이다. 다만 인증이 장기간
    깨져도 사용자에게 신호가 없어 폴백 성능 저하(N+1 재발)를 알아채기 어렵다 — 이는 보안 결함이
    아니라 운영 가시성 이슈이며, 이미 plan 문서(§B)에도 알려진 트레이드오프로 기록돼 있다.
  - 제안: (선택) stderr 진단 한 줄 추가는 고려 가능하나 이번 diff 스코프는 아님.

- **[INFO]** 테스트 stub(`_GH_STUB`)의 `${1:-} ${2:-} ${3:-}` 로깅은 테스트 전용 코드
  - 위치: `.claude/tests/test_reap_merged_worktrees.py` `_GH_STUB`
  - 상세: 임시 디렉터리(`tempfile.mkdtemp()`)에서만 실행되는 테스트 픽스처이고 셸 변수 전개가
    커맨드라인 인자 로깅에만 쓰인다(eval 없음). 프로덕션 코드 경로가 아니므로 위험 없음.

- **[INFO]** `git branch -d/-D -- "$branch"` 의 `--` 가드는 diff 이전부터 존재, 이번 변경으로 유지됨
  - 위치: `reap-merged-worktrees.sh` pass 2
  - 상세: 브랜치 이름이 `-`로 시작해도 옵션으로 오인되지 않도록 하는 기존 안전장치가 이번
    리팩터링(배치 조회 추가)으로 훼손되지 않았음을 확인. 회귀 없음.

Critical/Warning 수준 발견 없음. 인젝션·시크릿 하드코딩·인증 우회·안전하지 않은 암호화·민감정보
에러 노출·취약 의존성 사용 — 해당 없음(이번 diff 범위 내에서는 신규 도입 없음. 별건 §F 에서
mermaid-lint npm 취약점은 이미 해소된 것으로 plan 문서에 기록되어 있고 이번 diff 대상이 아님).

## 요약

이번 변경은 로컬 워크트리 정리 스크립트의 `gh` CLI 호출을 순차 N+1 에서 배치 1회 + 안전한
폴백으로 최적화한 성능 개선이며, 인젝션 벡터(커맨드/정규식/셸 메타문자)를 새로 열지 않았다.
숫자 입력값(`GH_PR_LIMIT`)은 기존 패턴과 동일하게 비수치 시 기본값으로 안전하게 대체되고,
브랜치 이름 비교는 리터럴 문자열 매칭이라 정규식 인젝션 여지가 없다. 배치 실패/미스 시 기존
단건 조회로 폴백해 "증명된 MERGED만 삭제"라는 원래의 fail-safe 삭제 정책을 그대로 보존한다.
테스트 stub 은 임시 디렉터리 안에서만 동작하는 비프로덕션 코드다. 전반적으로 보안 관점에서
문제되는 패턴은 발견되지 않았다.

## 위험도
NONE
