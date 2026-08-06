# 유지보수성(Maintainability) Review — CI 백스톱 4R

## 재현 절차 (작업 트리 불변 — mktemp 격리)

```bash
WORK="/private/tmp/claude-501/.../scratchpad/ci-backstop-r4"
mkdir -p "$WORK"
cp -R "$SRC/.claude" "$WORK/.claude"
cp -R "$SRC/.github" "$WORK/.github"
cp -R "$SRC/scripts" "$WORK/scripts"
cd "$WORK" && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
```
→ 베이스라인: `Ran 18 tests in 2.814s / OK` (모두 green, 미변조).

변조 적용 — `.github/workflows/review-gate.yml`의 `jobs.gate` 바로 아래(스텝이 아니라
**job 레벨**)에 한 줄 추가:

```diff
   gate:
     runs-on: ubuntu-latest
     timeout-minutes: 5
+    continue-on-error: true
     if: github.actor != 'dependabot[bot]'
```

재실행:

```bash
cd "$WORK" && python3 -m unittest discover -s .claude/tests -p 'test_review_gate_ci.py' -v
```
→ `Ran 18 tests in 3.754s / OK` — **전부 green, 하나도 안 깨짐.**

추가로 이 워크플로 구조를 정적으로 검사하는 형제 스위트도 함께 돌렸다:

```bash
cd "$WORK" && python3 -m unittest discover -s .claude/tests -p 'test_workflow_yaml_structure.py' -v
```
→ `Ran 6 tests in 0.046s / OK` — 이것도 green(중복 키·run/uses 불변식과는 무관한 변경이라 당연함).

실제 저장소는 손대지 않았다 — 확인:

```bash
git status --porcelain=v1 -- .github .claude scripts plan   # 출력 없음
grep -n "continue-on-error" .github/workflows/review-gate.yml || echo "NOT PRESENT (repo clean, good)"
```
→ `NOT PRESENT (repo clean, good)`.

## 결론: SHIPPED BEHAVIOUR 를 바꿨다, 테스트는 전부 green 이었다

`jobs.gate.continue-on-error: true` (job 레벨)는 `--enforce` 를 켠 뒤 `check-review-gate.py`
가 exit 1 을 내도 GitHub Actions 가 그 job/workflow run 전체를 "성공"으로 표시하게 만든다 —
브랜치 보호가 요구하는 필수 체크가 계속 초록으로 통과한다. 이것은 정확히 4R 커밋이 스텝
레벨에서 막으려던 것과 **같은 실패 클래스**(실행은 되지만 실패가 삼켜진다)이고, 단지 트리의
한 단계 위(step dict → job dict)로 옮겨졌을 뿐이다.

## 발견사항

- **[CRITICAL]** `_NEUTERING_KEYS` 가드가 스텝 딕셔너리만 보고 job 딕셔너리는 전혀 검사하지 않아, job 레벨 `continue-on-error`(또는 기타 job 레벨 키)로 백스톱을 영구 무력화해도 전 스위트가 green 이다
  - 위치: `.claude/tests/test_review_gate_ci.py:423` (`_NEUTERING_KEYS` 정의), `:425-438` (`test_the_gate_step_cannot_be_skipped_or_have_its_failure_swallowed` — `step = self.steps[self._gate_step_index()]` 에서만 반복하고 `self.job` 은 건드리지 않음), 참고로 `self.job` 자체는 `:405`에서 파싱됨(`self.job = self.doc["jobs"]["gate"]`)이고 그 값에 대해 딱 하나(`:443`, `self.job.get("if", "")`)만 단언된다.
  - 상세: 이 클래스의 존재 이유(docstring, `:358-373`)는 "워크플로는 작고 안정적인 설정 파일이므로 기대값 **전체**를 적어두는 편이 유한하고 완전하다"는 것이다. 그런데 `_NEUTERING_KEYS` 가 실제로 닫는 표면은 **스텝** 딕셔너리 하나뿐이다. GitHub Actions 워크플로 스키마는 `continue-on-error`(그리고 `timeout-minutes`)를 **job 레벨에도** 허용한다 — 같은 저장소의 `.github/workflows/e2e.yml:114`가 이미 스텝 레벨로 이 키를 실사용 중이므로 파서·CI 러너 모두 이 키를 정상 인식한다. job 레벨에 두면 "이 job 은 실패해도 워크플로 전체는 성공"이 되어, `--enforce` 전환 이후 브랜치 보호가 보는 체크가 항상 초록이 된다. 위에서 실측한 대로, 이 한 줄만으로 `test_review_gate_ci.py` 18개·`test_workflow_yaml_structure.py` 6개 전부 green 을 유지한 채 백스톱을 죽일 수 있다. 3R 커밋 메시지가 인용한 "그 한 줄이면 백스톱이 모든 PR 에서 영구히 꺼지는데 15개 테스트가 전부 GREEN" 이라는 문장이 4R 이후에도 여전히, 다른 한 줄로 성립한다.
  - 제안: `_NEUTERING_KEYS` 순회를 `step` 뿐 아니라 `self.job` 에도 적용한다(`continue-on-error`는 최소 두 곳 다 검사). 더 근본적으로는 `OneJudgeTest` 가 이미 채택한 "닫힌 허용 목록" 전략을 `self.job` 최상위 키에도 적용하는 편을 검토할 만하다 — `job` 이 갖는 키를 `{runs-on, timeout-minutes, if, steps}` 로 닫아두면(허용 목록), 새 키가 생길 때마다 실패해 저자가 의식적으로 판단하게 된다. 지금의 금지 목록(`_NEUTERING_KEYS`, job 레벨 미적용)은 이 클래스가 스스로 세 번 폐기한 접근(부분 금지 목록)을 스텝 밖에서 그대로 반복하고 있다.

- **[INFO]** `_NEUTERING_KEYS` 가 값과 무관하게 키 존재 자체를 금지해, `timeout-minutes` 의 정당한 미래 사용(예: 느린 스텝에 별도 타임아웃)까지 막는다
  - 위치: `.claude/tests/test_review_gate_ci.py:423`
  - 상세: 실제 무력화 조건은 `continue-on-error: true` 또는 `timeout-minutes: 0` 처럼 **특정 값**이지만, 가드는 값을 안 보고 키의 존재만으로 실패시킨다(`assertNotIn(key, step)`). 이 파일의 다른 모든 단언이 "부분 패턴 금지 목록은 우회된다"는 교훈에서 정확 일치·행위 검증으로 의도적으로 넘어간 것과 결이 다르다 — 여기는 반대로 "값 무관 키 금지"라는 더 보수적인 형태를 택했다. 지금은 무해하지만(이 스텝에 타임아웃을 걸 이유가 아직 없음), 다음에 정당한 이유로 `timeout-minutes: 10` 같은 값을 넣으려는 저자가 이 테스트에서 막히는 이유를 (a) 알아채고 (b) "이 값은 안전한가" 를 스스로 판단해야 하는데, 실패 메시지(`:437`)는 "실행되지 않거나 실패가 삼켜진다"고만 말해 실제로는 무해한 값도 같은 경고로 뭉뚱그린다.
  - 제안: 현행 유지도 방어적으로는 합리적이다(저자가 갱신 시점에 판단하게 만드는 게 이 클래스의 설계 철학과 일치). 다만 실패 메시지에 "값과 무관하게 이 키 자체를 금지합니다 — 정말 필요하면 여기서 값을 검증하는 조건부 단언으로 바꾸세요" 같은 한 줄을 보태면, 다음에 이 테스트를 마주치는 사람이 "버그를 발견했다" 로 오독하는 시간을 아낀다.

- **[INFO]** `_NEUTERING_KEYS` 상수가 클래스 상단의 다른 `EXPECTED_*` 상수 그룹(`:377-390`)과 떨어져, 그것을 쓰는 테스트 메서드 바로 앞(`:423`)에 선언돼 있다
  - 위치: `.claude/tests/test_review_gate_ci.py:377-390` (기존 상수 그룹) vs `:423` (신규 상수)
  - 상세: `WorkflowWiringTest` 는 애초에 "바꾸려면 여기도 같이 바꿔야 한다"는 코멘트(`:374-375`)와 함께 기대값 상수를 클래스 맨 위에 모아두는 관례를 세웠다. `_NEUTERING_KEYS` 는 그 관례를 벗어나 소비하는 메서드 바로 위에 놓여, 클래스를 훑을 때 "이 클래스가 고정하는 기대값 전체"를 한눈에 보려면 두 위치를 봐야 한다. 코드 자체는 정상 동작하고, 상수를 소비 지점 근처에 두는 것도 합리적 스타일이지만 같은 클래스 안에서 두 가지 배치 규칙이 공존한다.
  - 제안: 사소하다. 굳이 고친다면 `_NEUTERING_KEYS` 를 다른 `EXPECTED_*` 옆으로 옮기거나, 반대로 기존 관례를 "간단한 스칼라/딕셔너리는 상단, 목적이 좁은 튜플은 소비 지점 근처"로 명문화하면 다음 상수를 추가하는 사람이 둘 중 뭘 따를지 고민하지 않는다.

## 요약

이번 라운드(커밋 `864b71a7b`, `.claude/tests/test_review_gate_ci.py` 19줄 추가/4줄 삭제)의 코드 자체는 가독성·네이밍·길이 모두 이 스위트의 기존 관례(장문 docstring 으로 "왜"를 남기고, 실패 메시지에 원인을 적는 스타일)를 그대로 따르며 간결하다. 그러나 유지보수성 관점에서 가장 무거운 발견은 그 코드가 스스로 주장하는 완전성이 실제로는 거짓이라는 점이다 — "워크플로는 작고 안정적이니 기대값 전체를 적어두면 유한하고 완전하다"는 설계 원칙을 이번 수정은 **스텝** 딕셔너리에만 적용했고 **job** 딕셔너리에는 적용하지 않았다. 그 결과 `jobs.gate.continue-on-error: true`(job 레벨) 한 줄로 4R 이 막으려던 것과 동일한 효과("게이트는 돌지만 실패가 삼켜진다")를 재현하면서도, `test_review_gate_ci.py`(18개)와 `test_workflow_yaml_structure.py`(6개) 전부가 green 을 유지함을 mktemp 격리 환경에서 실측했다. 이는 이 파일이 이미 세 번 겪은 "부분 검사는 뚫린다"는 교훈이 이번 라운드에서도, 다른 좌표에서 반복됐다는 뜻이며, 다음 라운드가 착수하기 전에 우선 처리할 항목이다. 나머지 두 건(INFO)은 사소한 스타일 일관성 문제로, 동작에는 영향이 없다.

## 위험도
CRITICAL

STATUS: SUCCESS
