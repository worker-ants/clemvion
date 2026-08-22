# Cross-Spec 일관성 검토 — `eia-error-code-unify` plan draft

대상: `plan/in-progress/eia-error-code-unify.md` (검토 모드: `--plan`)

## 방법론 노트

`_prompts/cross_spec.md` 번들은 예산 초과로 `spec_impact` 6개 파일 전부가 **본문 절단**돼
있었다(`consistency --spec` 기본 예산이 conventions/system 문서를 통째로 떨구는 기존
결함과 동형). 번들 대신 저장소의 실제 파일(`spec/conventions/error-codes.md`,
`spec/5-system/{3-error-handling,12-webhook,13-replay-rerun,14-external-interaction-api}.md`,
`spec/4-nodes/7-trigger/1-manual-trigger.md`, `spec/data-flow/{10-triggers,11-workflow}.md`,
`plan/in-progress/spec-sync-external-interaction-api-gaps.md`, 관련 프런트/백엔드 코드)를
직접 읽어 대조했다. 현재 worktree HEAD(`3f7f72c3b`)는 target 문서가 기준점으로 삼은
`7b0e65aa8` 의 1커밋 뒤(plan 전용 변경)라 측정 기준점은 최신이다.

## 발견사항

- **[INFO]** §8.1 표에서 unify 후 코드가 형제 행들의 `RERUN_*` 도메인 prefix 패턴과 계속 어긋난다
  - target 위치: "동반 개정 표면" 표 — `5-system/13-replay-rerun.md` §8.1 표 (246행)
  - 충돌 대상: `spec/conventions/error-codes.md §1` "도메인 prefix (권장)" — 같은 절 사유가
    이미 있는 예외(`INVALID_TOOL_ARGUMENTS` 등)를 명시 서술로 정당화하는 관행
  - 상세: 통일 후 §8.1 표는 `RERUN_PERMISSION_DENIED` / `RERUN_EXECUTION_NOT_FOUND` /
    `RERUN_WORKFLOW_DELETED` / `RERUN_CHAIN_DEPTH_EXCEEDED` / `RERUN_DRY_RUN_NOT_APPLICABLE`
    5개 행과 `INVALID_TRIGGER_PARAMETERS` 1개 행이 나란히 선다. prefix 이탈은 **오늘도
    이미 존재**(현재 `INVALID_INPUT` 도 `RERUN_` 없음)하므로 target 이 새로 만드는 균열은
    아니지만, 코드 값 자체가 바뀌는 이 시점에 "왜 이 행만 `RERUN_` 이 없는가" 를 옆에
    한 줄 남기지 않으면 다음 독자가 "prefix 원칙 위반 아닌가" 로 재질문할 가능성이 높다.
    target 은 이미 "왜 반대 방향이 아닌가" 절에서 관련 근거를 서술했으나, 그 근거가
    §8.1 표 자체(또는 인접 Rationale)에는 아직 배치돼 있지 않다.
  - 제안: `13-replay-rerun.md §8.1` 표 각주 또는 인접 Rationale 에 "이 행은 의도적으로
    `RERUN_` prefix 를 쓰지 않는다 — Manual 실행/저장 경로와 코드를 공유하기 위함" 한 줄을
    같은 PR 에서 추가. 필수 차단 사유는 아님(내용 자체는 모순이 아니라 설명 누락).

- **[INFO]** `data-flow/10-triggers.md` · `data-flow/11-workflow.md` 는 re-run 경로를 언급하지
  않아 통일 후에도 "틀리지"는 않지만 정보가 낡아 보일 여지
  - target 위치: (target 문서에 없음 — target 의 spec_impact 6파일 밖)
  - 충돌 대상: `spec/data-flow/10-triggers.md:47,57`, `spec/data-flow/11-workflow.md:45`
  - 상세: 두 data-flow 문서는 `POST /:id/execute`/`POST /:id/save` 의
    `INVALID_TRIGGER_PARAMETERS` 만 시퀀스 다이어그램에 등장시키고 re-run 은 다루지 않는다.
    통일 후에도 이 문서들의 서술 자체는 거짓이 되지 않는다(re-run 을 언급 안 했을 뿐이므로
    모순 없음) — 다만 이제 세 엔드포인트가 같은 코드를 공유한다는 사실을 아는 상태에서 보면
    두 문서가 그 사실을 반영하지 않아 "왜 re-run 은 안 나오지" 로 읽힐 여지가 생긴다.
  - 제안: 필수 아님. spec_impact 확장 없이 현행 유지해도 무방 — 두 문서 모두 원래
    execute/save 시퀀스 전용이라 re-run 을 다룰 의무가 없었다.

- **[INFO]** target 이 스스로 식별한 3건(wrapper 함수명 미기재 · §R17 볼드 비대칭 ·
  `error-codes.md §4` 패턴 표 공백)은 실측 확인 결과 모두 사실과 일치
  - `grep -rn 'resolveTriggerParametersRejectingMasked' spec` = 0건 확인(`1-manual-trigger.md`
    `code:` frontmatter 에도 `reject-masked-resubmission.ts` 미등재)
  - `14-external-interaction-api.md` "닫는 조건" 표(1569~1574행)에서 4번째 행만 소비처
    셀이 볼드(`**서버 (Manual 실행 경로)**`)이고 나머지 3행은 평문 — 확인됨
  - `error-codes.md §4` 표(86~90행)는 Code 노드 내부 분류 코드 3건만 있고 trigger-parameter
    reason 계열(`missing_required`/`coerce_failed`/`invalid_schema`/`masked_value_resubmitted`)
    은 없음 — `12-webhook.md:313` 이 "[error-codes 규약 §4] 패턴" 을 참조하지만 그 표는
    다른 계열만 담고 있어 참조가 정확히 착지하지 않음, 확인됨
  - 새로 발견된 추가 충돌 없음 — target 의 자체 스코프가 이미 완전하다.

## 실측 교차검증 (결론에 영향 없는 확인 기록)

- 프런트: `rerun-modal.tsx` `ERROR_CODE_TO_KEY` 는 `RERUN_PERMISSION_DENIED` /
  `RERUN_CHAIN_DEPTH_EXCEEDED` / `RERUN_WORKFLOW_DELETED` / `RERUN_DRY_RUN_NOT_APPLICABLE`
  4종만 매핑(91~102행) — `INVALID_INPUT` 은 미매핑, generic fallback. target 주장과 일치.
- 프런트/위젯 전체: `INVALID_INPUT` 히트 = `triggers.mdx:33` · `triggers.en.mdx:22` (유저 가이드)
  뿐, 코드 0건. target 주장과 일치.
- 백엔드: `INVALID_INPUT` 히트 = `executions.service.ts:506`(발행) ·
  `executions.controller.ts:274`(Swagger) · `executions-rerun.service.spec.ts:330,422`(테스트)
  4곳뿐. target 주장과 일치.
- `INVALID_TRIGGER_PARAMETERS` / `INVALID_INPUT` 어느 쪽도 `codebase/backend/src/nodes/core/error-codes.ts`
  (`ErrorCode` enum)에 없음 — 둘 다 §1.3 계열 HTTP envelope 코드로, 노드 출력 레이어와
  레이어가 다르다는 error-codes.md 의 구조와 정합.
- `spec/` 전체에서 `INVALID_INPUT` 히트는 target 이 열거한 6개 지점(webhook §5.2 313행,
  replay-rerun §8.1 246행·§10.2 377행, error-handling 카탈로그 80행·details 노트 189행,
  manual-trigger §6 181행)이 전부이며 그 밖의 은닉 참조 없음.

## 요약

target 문서는 이례적으로 실측 밀도가 높은 plan draft다 — 소비 표면(프런트 분기·유저 가이드·
백엔드 발행처)을 코드 레벨까지 grep 으로 확인하고, `error-codes.md §5` 선례 3건의 예외 인정
조건("자사 클라이언트 미분기 + 문서 노출만")을 같은 방법으로 재현해 충족을 보였다. 이 리뷰가
`spec/` 전역(`data-model`·API 컨벤션·EIA·webhook·replay-rerun·data-flow·conventions 전체)을
대조한 결과, target 이 6개 spec_impact 파일 밖에서 손대야 할 숨은 참조나 데이터 모델/요구사항
ID/상태 전이/RBAC/계층 책임 충돌은 발견되지 않았다. target 이 스스로 이월시킨 3건의 문서
공백(wrapper 함수명·§R17 볼드·§4 패턴 표)도 실측 결과 정확히 그 상태였고 target 의 처리
계획과도 부합한다. 유일하게 남기는 것은 두 건의 INFO — §8.1 표에서 unify 후 코드가 형제
`RERUN_*` prefix 군과 계속 어긋나는 이유를 표 옆에 명시하면 향후 재질문을 줄일 수 있고,
data-flow 두 문서는 필수는 아니나 참고용으로 언급될 수 있다는 점이다. 둘 다 채택을 막을
사유가 아니다.

## 위험도

LOW
