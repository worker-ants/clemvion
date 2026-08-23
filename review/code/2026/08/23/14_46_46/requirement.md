# 요구사항(Requirement) 충족 리뷰 — masking-gate-consolidation (2차 라운드, 14_46_46)

## 스코프 및 검증 방법

이번 changeset 은 이전 라운드(`14_23_44`, CRITICAL 0 · WARNING 2)의 fix 커밋으로,
핵심은 `redact-stored-error.spec.ts` 에 신설 헬퍼 2개(`redactStoredFieldsForResponse`·
`redactNodeExecutionRow`) 전용 테스트를 추가한 것(WARNING #1 대응)과, plan/tracker 문서
정리다. 코드 3파일(`background-runs.service.ts`·`executions.service.ts`·
`redact-stored-error.ts`)은 이전 라운드 diff 와 실질적으로 동일하다.

프롬프트에 실린 코드가 큰 파일은 크기 제한으로 잘려 있어, 4개 소스 파일 전문을 `Read` 로
직접 열어 대조했고 `plan/`·`review/`·`spec/conventions/egress-masking.md` 주장은 `grep`으로
실측했다. 추가로 다음을 실행해 **claim 을 재현**했다(신뢰도를 위해):

- `npx tsc --noEmit` (backend) — 변경 파일 관련 타입 에러 0건.
- `npx jest redact-stored-error.spec.ts executions.service.spec background-runs.service.spec` —
  3 suite / 100 test 전부 GREEN.
- **M1**(헬퍼에서 `inputData` 마스킹 제거) → `redact-stored-error.spec.ts` 단독 2 RED,
  `tsc` 클린 — plan/SUMMARY 의 claim 과 일치.
- **M2**(`redactNodeExecutionRow` 무조건 spread, identity 보존 파기) → 2 RED, `tsc` 클린 — 일치.
- **M3**(`maskIfPresent` 를 부재-보존 없이 `mask()` 그대로 반환하도록 뭉갬, "두 헬퍼를 뭉갠 회귀")
  → 1 RED, `tsc` 클린 — SUMMARY WARNING #1 fix 표의 claim 과 일치.
- 세 뮤테이션 모두 `cp` 백업 후 적용, 확인 뒤 `cp` 로 원복(`git checkout`/`reset` 미사용).
  최종 `git diff`/`git status` 로 원복 확인 완료(현재 트리는 리뷰 산출물 디렉터리만 untracked).

(참고: 첫 `jest` 실행에서 `redactNodeExecutionRow` 부재-보존 테스트가 1건 FAIL 했으나
`--no-cache` 재실행으로 GREEN 전환 — stale jest 캐시 아티팩트였다. 실제 코드 결함이
아니므로 발견사항에 포함하지 않는다.)

## 발견사항

- **[정합 확인 — 문제 없음]** 4개 호출부(①③ `toResponseExecution` 공유 · ② `toExecutionDto` ·
  ⑤ 노드 레벨 루프 · ⑥ `BackgroundRunsService.toNodeExecutionDto`)가 EIA §R17 "적용 범위는
  총칭이 아니라 열거다"(표면 6·컬럼 2)와 line-level 로 정확히 일치.
  - 위치: `codebase/backend/src/modules/executions/executions.service.ts:1038`~`1045`
    (표면 표), `:623`(getChain)·`:724`(findById)·`:877`(stop) 모두 `toResponseExecution` 한
    관문(`:1069` `redactStoredFieldsForResponse(rest)`) 경유 확인, `:1005`
    (`toExecutionDto`), `:704`(`redactNodeExecutionRow(ne)`) /
    `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:302`
    (`redactStoredFieldsForResponse(row)`) / `spec/5-system/14-external-interaction-api.md:1532`~`1538`
  - 상세: `grep` 으로 `redactStoredDataForResponse`/`redactStoredErrorForResponse` 직접
    호출부가 `redact-stored-error.ts` 내부(헬퍼 자신) 외에는 코드베이스 전체에서 0건임을
    확인 — 4곳 손호출이 누락 없이 헬퍼로 흡수됐다. `getChain`/`findById`/`stop` 세 함수가
    모두 `toResponseExecution` 을 호출하는 것도 직접 확인(③표면이 한 관문을 공유한다는
    JSDoc 서술과 일치).

- **[정합 확인 — 문제 없음]** `maskIfPresent`/`redactNodeExecutionRow` 의 부재 보존·
  copy-on-change 계약이 코드·테스트·뮤테이션 실측 세 층에서 일관.
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts:127`~`159`
  - 상세: `value == null` 가드가 `undefined`/`null` 모두를 잡고(loose equality), 이미 그
    분기를 통과한 값에 대해서만 `mask()` 를 부르므로 `mask(value) ?? value` 의 `?? value`
    는 방어적이되 실질적으로 도달하지 않는 코드 경로다(never-null 보장) — 버그는 아니고
    관찰 사항. `redactNodeExecutionRow` 의 3중 참조 비교(`inputData === row.inputData && …`)
    는 위 M2 뮤테이션으로 실제 판별력이 확인됐다.

- **[정합 확인 — 문제 없음]** `spec/conventions/egress-masking.md §3` 의 취소선+정정 내용이
  실측과 일치(SPEC-DRIFT 아님 — developer 가 자기 예고를 반증한 사실 정정).
  - 위치: `spec/conventions/egress-masking.md:83`~`92`
  - 상세: 표 2행 소비처(`deepRedactSecrets`)가 `redactStoredDataForResponse` 내부에서
    그대로 호출됨(`redact-stored-error.ts:70`)을 확인, 표 5행 소비처(`stripExternalOnlyFields`)
    의 실호출부가 `websocket.service.ts`·`interaction.service.ts` 둘뿐임을 `grep` 으로 확인
    (`sanitize-error-message.ts` 는 주석에서만 그 이름을 언급, 실호출 아님) — 문서 정정
    내용이 사실과 정확히 일치한다. 이 spec 편집 자체의 권한 경계(developer 가 `spec/` 을
    직접 고친 절차 문제)는 이전 라운드 `scope` reviewer 가 WARNING #2 로 이미 지적했고
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 planner 판단 항목으로
    등재돼 트래킹 중이므로 본 리뷰에서 재차 올리지 않는다(내용 정확성만 검증 대상).

- **[정합 확인 — 문제 없음]** TODO/FIXME/HACK/XXX 부재, 모든 함수가 모든 경로에서 타입에
  맞는 값을 반환(엔티티 non-null 제약과 헬퍼 반환 타입의 정적 배정 가능성도 `tsc` 로 확인).
  - 위치: 변경된 4개 소스 파일 전체(`grep` 결과 0건).

## 이전 라운드 대비 델타

이전 라운드(`14_23_44`) requirement reviewer 는 CRITICAL/WARNING 없이 INFO 1건(신설 헬퍼
직접 테스트 부재)만 남겼다. 이번 diff 에서 그 INFO 는 `redact-stored-error.spec.ts` 에
`describe('redactStoredFieldsForResponse', …)`/`describe('redactNodeExecutionRow', …)` 12
케이스로 이미 해소됨을 실행으로 확인했다(위 검증 섹션). 새로 발견된 CRITICAL/WARNING 없음.

## 요약

`inputData`/`outputData`/`error` 세 컬럼 마스킹 게이트 4곳을 헬퍼 2개로 통합한 순수
리팩터이며, EIA §R17 이 정본으로 규정한 6표면·2컬럼 좌표계와 line-level 로 정확히
일치함을 코드 직독 + `grep` 실측 + `tsc`/`jest` 실행 + 3개 뮤테이션(M1/M2/M3) 재현으로
확인했다. 세 뮤테이션 모두 plan/SUMMARY 가 주장한 RED 건수와 정확히 일치했고 `tsc` 로
유효 뮤턴트임도 재확인했다. 이전 라운드의 유일한 실질 지적(신설 헬퍼 co-located 테스트
부재)은 이번 diff 에서 해소됐다. TODO/FIXME 없음, 모든 반환 경로가 적절한 값을 가지며,
null/undefined·빈 컬렉션 등 엣지 케이스도 두 헬퍼(부재→null 정규화 vs 부재 보존)가
계약대로 갈라 처리한다. CRITICAL/WARNING 급 결함을 발견하지 못했다.

## 위험도

NONE
