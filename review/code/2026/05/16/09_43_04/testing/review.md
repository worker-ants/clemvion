# 테스트(Testing) 리뷰

리뷰 대상: commit `39c869c5` — `docs(infra): README/CHANGELOG/Makefile follow-up + docs-consolidation 사전 결함 동반 해소`

---

### 발견사항

- **[INFO]** plan 문서에 TEST WORKFLOW 미완료 항목이 명시되어 있음
  - 위치: `plan/in-progress/e2e-makefile-followup-2026-05-16.md` L346 — `- [ ] TEST WORKFLOW`
  - 상세: 이번 커밋은 plan 의 `TEST WORKFLOW`·`REVIEW WORKFLOW` 체크박스가 미완료인 상태에서 생성되었다. plan 라이프사이클 규약상 `in-progress/` 에 있는 것은 적절하나, "이미 e2e 12/12 suites 통과" 를 commit message 에서 주장하면서 정작 plan 의 TEST WORKFLOW 가 `[ ]` 인 점이 불일치한다. TEST WORKFLOW 는 developer SKILL.md 의 정식 절차인데, 이번 변경이 순수 문서 수정이라 실질적 테스트 실행이 불필요한 경우 그 근거를 plan 에 명시하거나 항목을 제거하는 것이 명확하다.
  - 제안: 변경 내용이 소스 코드 변경 없는 순수 문서·Makefile 텍스트 수정임을 plan 에 기록하고 TEST WORKFLOW 항목을 "해당 없음(문서 전용 변경)" 으로 닫거나, 기존 e2e 통과 결과(12/12 suites, 66/66 tests)를 근거로 체크하고 명시한다.

- **[INFO]** `e2e-test-full` 의 exit code 캡처 로직(`runner1 && runner2; STATUS=$$?`)에 대한 단위 테스트 또는 통합 검증 없음
  - 위치: `Makefile` L36–44 (`e2e-test-full` 타겟)
  - 상세: 새로 추가된 주석은 `runner1 && runner2; STATUS=$$?` 의 동작(short-circuit, exit code 전파)을 상세히 설명한다. 그러나 이 동작을 검증하는 자동화된 수단이 없다. runner1 이 실패하면 STATUS 가 runner1 의 exit code 를 가지고, runner2 는 실행되지 않는다는 동작은 현재 주석 설명에만 의존한다. Makefile 자체 테스트(`make --dry-run`, bats 등)나, 의도적으로 실패하는 mock runner 를 사용해 exit code 전파를 확인하는 smoke test 가 없다.
  - 제안: 현재 순수 문서 변경 범위이므로 즉시 수정이 필요한 결함은 아니다. 다만 향후 Makefile 을 변경할 때 exit code 전파 동작을 회귀 검증하기 어렵다. 필요하다면 간단한 bash 스크립트(`scripts/test-makefile-exit.sh`)로 mock 컨테이너를 이용한 smoke test 를 작성해 두는 것이 유지보수에 유리하다.

- **[INFO]** 커밋 메시지의 e2e 통과 주장이 자동화된 CI 결과로 검증되는지 불확실
  - 위치: commit message `e2e (\`make e2e-test\`) 12/12 suites, 66/66 tests 통과 유지`
  - 상세: commit message 에 e2e 통과 결과가 기재되어 있으나, 이번 변경된 파일(CHANGELOG.md, README.md, Makefile 주석·help 텍스트, plan/review 산출물)은 테스트 대상 소스 코드가 아니다. 이미 통과 중이던 결과를 기재한 것으로 해석되며 회귀 위험은 없다. 그러나 향후 동일 패턴에서 소스 코드 변경이 포함된다면 CI 파이프라인에서 `make e2e-test` 를 자동 실행하지 않는 경우 이 주장이 수동 확인에 의존하게 된다.
  - 제안: CI 워크플로우(GitHub Actions 등)에 `make e2e-test` 가 포함되어 있는지 확인한다. 포함되어 있다면 현재 구조로 충분하다. 포함되어 있지 않다면 e2e pass 주장이 수동 실행 의존이므로 CI 통합이 권장된다.

---

### 요약

이번 변경은 전적으로 문서·Makefile help 텍스트·주석·plan/review 산출물 수정으로 구성되며, 실질적인 소스 코드 변경이 없다. 따라서 신규 테스트 코드 작성의 필요성은 없고, 기존 e2e 66개 테스트가 회귀 없이 통과하는 것이 확인된 상태다. 테스트 관점에서 주목할 사항은 두 가지다. 첫째, plan 의 `TEST WORKFLOW` 항목이 미체크 상태인데 commit message 에서 e2e 통과를 이미 주장하는 불일치가 있어 plan 상태 정리가 필요하다. 둘째, `e2e-test-full` 의 exit code 전파 동작(`runner1 && runner2; STATUS=$$?`)이 주석으로만 설명되고 자동 검증 수단이 없어 향후 Makefile 수정 시 회귀 탐지가 어렵다. 두 항목 모두 즉각적인 결함이 아닌 개선 권고 수준이며, 현재 변경의 위험도는 낮다.

### 위험도

LOW
