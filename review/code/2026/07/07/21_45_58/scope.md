# 변경 범위(Scope) Review

대상: `origin/main..HEAD` (5 커밋, notif-followup-refactor)

```
421264d27 test(execution-engine): finalizeFailedExecution 재개 경로 dispatch 회귀 가드 unit
99d15ca50 fix(plan): manual-trigger-request-header-redaction worktree (unstarted) sentinel (사전 breakage)
99819a0e5 docs(plan): notif-followup-refactor 항목 완료 체크
ee540383a chore(plan): notif-hardening followup 완료 반영 + spec-update-bg-run-id complete 이동
4a1550e12 refactor(execution-engine): finalizeFailedExecution 헬퍼 추출 + §4.4 ModuleRef 문서화
```

## 사전 확인 사항

오케스트레이터 지시문에 "2개 커밋은 main 기존 breakage 에 대한 courtesy fix (graph-warning-rules dist,
worktree:TBD plan)" 라 명시됐으나, 실제 `origin/main..HEAD` 델타에는 **`graph-warning-rules`/dist 관련
파일이 전혀 없다** (`git log --name-only`, `grep -i graph-warning` 전수 확인 — 무결과). 확인되는 courtesy
fix 는 `99d15ca50` (plan frontmatter `worktree: TBD` → `(unstarted)` sentinel) 1건뿐이다. 지시문의
"2개 courtesy fix" 서술과 실제 델타가 불일치하지만, 이는 review 대상 코드 자체의 문제가 아니라 오케스트레이터
전달 정보의 오차로 판단해 실존하는 델타만을 근거로 이하 평가한다.

## 발견사항

- **[INFO]** courtesy fix (`99d15ca50`) 는 본 작업(notif-followup-refactor) 의도와 무관한 별도 plan 파일 수정
  - 위치: `plan/in-progress/manual-trigger-request-header-redaction.md` (1줄, `worktree: TBD` → `worktree: (unstarted)`)
  - 상세: 커밋 메시지가 "본 PR 범위 밖 courtesy fix" 임을 스스로 명시하고 있어 은폐된 무관 변경이 아니라
    의도적으로 격리된 1-line 수정이다. `plan-frontmatter.test.ts` 게이트가 `worktree: TBD` 를 무효
    placeholder 로 실패시키는 사전 breakage 를 교정하는 목적이며, 실제로 이 파일은 본 작업(`notif-followup-refactor`)
    이 다루는 execution-engine FAILED 종결 리팩터·§4.4 문서화와 완전히 별개 트랙(`manual-trigger-request-header-redaction`,
    아직 미착수 plan)이다. 별도 커밋으로 분리돼 diff 병합·리뷰 노이즈는 최소화됐지만, 엄밀히는 별도 PR/커밋으로
    분리하는 편이 "PR 범위=관련 변경 단위" 원칙에 더 부합한다. 단, 사전 CI 차단(pre-existing breakage)을
    풀지 않으면 본 PR 의 gate(lint/build/test)가 통과하지 못하는 구조적 이유가 있다면 실용적으로 허용 가능한
    관행이다.
  - 제안: 이런 courtesy fix 는 커밋 메시지에 이미 명시된 것처럼 앞으로도 별도 커밋으로 격리하고, 가능하면
    PR 설명에도 "본 PR 과 무관한 사전 breakage 수정 포함" 을 명기해 리뷰어가 diff stat 만으로 오인하지 않게 한다.

- **[INFO]** 오케스트레이터 지시문의 "graph-warning-rules dist" courtesy fix 미확인
  - 위치: N/A — 실제 델타 부재
  - 상세: 위 "사전 확인 사항" 참고. 검토 대상 코드에는 해당 변경이 없으므로 scope 위반 여부를 판정할 근거
    자체가 없다. 오케스트레이터/이전 세션의 정보 전달 오차로 추정.
  - 제안: 실제로 별도 파일/커밋이 존재한다면 이 리뷰 범위(`origin/main..HEAD`) 밖에 있는 것이므로, 존재
    여부와 위치를 재확인해 필요 시 별도 리뷰 요청.

- **[INFO]** `finalizeFailedExecution` 헬퍼 추출은 명시된 계획(plan 항목1)과 정확히 일치, 범위 이탈 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
  - 상세: `runExecution` catch(초기 세그먼트, 라인 4416~)와 `finalizeResumedExecutionOutcome`(재개 세그먼트,
    라인 2480~)의 near-identical FAILED 종결 블록(status 마킹·error 봉인·`finishedAt`/`durationMs`·
    `executionRepository.save`·`EXECUTION_FAILED` WS emit·`execution_failed` dispatch)을 단일 private
    헬퍼로 병합한 순수 extract-method 리팩터다. diff 를 라인 단위로 대조한 결과 두 호출부 모두 원래 로직을
    한 글자도 바꾸지 않고 그대로 헬퍼 안으로 옮겼으며(`opts.rehydrated` 플래그로 로그 라벨 한 곳만 분기),
    새로운 조건 분기·기능 추가·정책 변경은 없다. `plan/in-progress/notif-followup-refactor.md` 항목1이
    "behavior-preserving" 을 명시적으로 요구했고 구현이 정확히 그 범위 안에 머문다.
  - 제안: 없음 (해당 없음).

- **[INFO]** spec §4.4 문서화 변경은 사전 계획·consistency-check 승인 범위와 일치
  - 위치: `spec/5-system/4-execution-engine.md` §4.4 (순환 의존 처리 문단)
  - 상세: `forwardRef` 단일 서술을 `forwardRef`/`ModuleRef(strict:false)` 2종 + 적용 기준 표로 구조화한
    변경으로, 신규 정책을 도입하는 것이 아니라 이미 코드에 구현·병합된 PR #841 의 `getNotificationsService`
    ModuleRef 패턴을 spec 에 뒤늦게 반영하는 drift-closing 문서화다. `--impl-prep` consistency-check
    (`review/consistency/2026/07/07/07_56_47/`)가 사전에 이 범위를 검토해 BLOCK:NO 판정 + INFO 4건(문서
    구조 제안 등)을 남겼고, 실제 diff 는 그 INFO 제안(forwardRef vs ModuleRef 를 표로 분리)을 그대로 반영한
    형태다. 계획에 없는 추가 spec 섹션 변경은 없음.
  - 제안: 없음.

- **[INFO]** 신규 unit 테스트(`421264d27`)는 헬퍼 추출의 회귀 가드로만 한정, 범위 확장 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (+55줄, 단일
    `describe` 블록 추가)
  - 상세: `finalizeFailedExecution` 을 직접 호출해 `rehydrated:true` 옵션 경로에서 status·save·WS
    emit·`execution_failed` dispatch 4가지가 모두 수행되는지 검증하는 단일 테스트다. PR #841 버그 A(재개
    경로 dispatch 누락)의 재발 가드 목적이 명확하며, 기존 테스트 파일의 다른 부분은 건드리지 않았다(diff
    가 순수 추가분).
  - 제안: 없음.

- **[INFO]** plan/lifecycle 커밋(`99819a0e5`, `ee540383a`)은 본 작업의 정식 마무리 단계, 무관한 변경 아님
  - 위치: `plan/in-progress/notif-followup-refactor.md`, `plan/in-progress/notif-hardening-followups.md`,
    `plan/complete/spec-update-notifications-background-run-id.md`(새 파일, `plan/in-progress/`에서 이동)
  - 상세: CLAUDE.md/plan-lifecycle 규약이 요구하는 "완료 항목 체크 + complete 이동" 을 반영한 정상적인
    plan 관리 커밋이다. `notif-hardening-followups.md` 의 체크박스 갱신도 본 작업이 실제로 완료시킨 항목
    (FAILED 종결 헬퍼·§4.4 문서화)에 한정돼 있고, 무관한 backlog 항목(DI 순환 근본 축소)은 `[ ]` 로 유지돼
    임의로 완료 처리되지 않았다.
  - 제안: 없음.

- **[INFO]** 포맷팅/주석/임포트 변경 없음
  - 상세: `execution-engine.service.ts` diff 는 순수 코드 이동(추출)이며 무관한 라인의 재포맷팅이나
    import 정리는 관찰되지 않았다. spec/plan 문서 diff 도 대상 섹션에 국한된다.

## 요약

핵심 코드 변경(`finalizeFailedExecution` 헬퍼 추출, 회귀 가드 unit, spec §4.4 문서화, plan lifecycle 갱신)은
`plan/in-progress/notif-followup-refactor.md` 에 명시된 계획과 정확히 일치하며 behavior-preserving 이 실제로
지켜졌다 — 요청 범위를 벗어난 리팩터링·기능 확장·무관한 파일 수정은 발견되지 않았다. 유일하게 주목할 점은
`plan/in-progress/manual-trigger-request-header-redaction.md` 의 1-line courtesy fix(`99d15ca50`)로, 이는
본 작업과 무관한 사전(main) breakage 교정이지만 별도 커밋으로 명확히 격리되고 커밋 메시지에 스스로 "본 PR
범위 밖" 임을 명시하고 있어 은폐된 scope creep 이 아니다. 다만 오케스트레이터가 언급한 "graph-warning-rules
dist" 관련 courtesy fix 는 실제 `origin/main..HEAD` 델타에서 확인되지 않아 — 그 항목이 실재한다면 본 리뷰
범위 밖에 있거나 이미 별도로 처리된 것으로 보인다.

## 위험도

NONE
