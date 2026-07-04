# Plan 정합성 검토 — exec-limits 리팩터 묶음 (ARCH#4/6 + MAINT#9)

## 페이로드 노트

`_prompts/plan_coherence.md` 에 채워진 target 문서 payload 는 `spec/5-system/1-auth.md`(인증/인가 spec) 및
chat-channel 시각형 노드 plan 등 **본 작업과 무관한 내용**으로 채워져 있었다(orchestrator 측 mis-scope —
grep 결과 payload 전체에 `exec-limits`/`ARCH#`/`MAINT#`/`exec-intake-followups` 문자열 0건). 지시에 따라
`plan/in-progress/exec-limits-refactor.md`·`plan/in-progress/exec-intake-followups.md` 및 관련 in-progress
plan 을 직접 읽어 분석했다.

## 발견사항

- **[INFO]** 부모 tracker(`exec-intake-followups.md`)가 스코프 분리를 아직 반영하지 않음
  - target 위치: `plan/in-progress/exec-limits-refactor.md` "## 스코프 결정: ARCH#5 는 별도 후속으로 분리" (라인 13-15)
  - 관련 plan: `plan/in-progress/exec-intake-followups.md` 라인 15-19, "곁들임 INFO 리팩터 묶음" 미해결 체크박스 — ARCH#4/ARCH#5/ARCH#6/MAINT#9 네 항목이 여전히 **하나의 미체크 불릿**으로 뭉쳐 있음
  - 상세: `exec-limits-refactor.md` 는 이 네 항목 중 ARCH#4·ARCH#6·MAINT#9 만 이번 작업 스코프로 가져오고 ARCH#5(에러코드 레이어 분리)는 명시적으로 후속 분리했다고 선언하지만, 그 선언의 대상인 `exec-intake-followups.md` 자체에는 아직 분리가 반영되지 않았다 — 즉 두 문서가 "분리했다"/"분리 안 됨" 으로 어긋난 상태다. 결정 자체(ARCH#5 를 분리한다)에 대한 충돌은 없다 — `exec-intake-followups.md` 어디에도 "ARCH#4/5/6/MAINT#9 는 반드시 한 번에 처리해야 한다"는 선행 제약이 없으므로 CRITICAL 이 아니다. 다만 exec-limits-refactor 완료 후 `exec-intake-followups.md` 를 갱신하지 않으면, 이후 그 tracker 를 읽는 사람이 "ARCH#4/6/MAINT#9 도 아직 미완료"로 오인하거나 ARCH#5 가 별도 후속임을 놓칠 수 있다.
  - 제안: `exec-limits-refactor.md` 완료(PR 이후) 시 `exec-intake-followups.md` 라인 15-19 를 체크(완료 3건 + ARCH#5 단독 잔여 항목으로 재작성)하도록 체크리스트에 반영. 현재 `exec-limits-refactor.md` 체크리스트에는 이 후속 tracker 갱신 단계가 없으므로, "PR" 단계 다음에 "exec-intake-followups.md 동기화" 항목을 추가하는 것을 권고.

- **[INFO]** ARCH#5 deferral 이 참조하는 `error-codes.ts` 를 동시에 건드리는 다른 in-progress plan 존재 — 직접 충돌은 없음
  - target 위치: `exec-limits-refactor.md` 라인 15 (ARCH#5 분리 근거: `nodes/core/error-codes.ts` 의 공용 `ErrorCode` 재편)
  - 관련 plan: `plan/in-progress/http-ssrf-all-auth-followups.md`(`DB_HOST_BLOCKED` 신설·`HTTP_BLOCKED` enum 참조화 완료), `plan/in-progress/node-output-redesign/{text-classifier,send-email}.md`(`error-codes.ts` 의 `truncateForErrorDetails`/`maskEmailForErrorDetails` helper 재사용)
  - 상세: 이 plan 들은 `nodes/core/error-codes.ts` 파일에 엔트리를 추가/재사용하지만, ARCH#5 가 우려하는 "모듈 경계 재편(파일 분리 vs in-file 그룹핑)" 자체를 시도하지 않는다. 따라서 `exec-limits-refactor.md` 의 이번 스코프(ARCH#4/6/MAINT#9, `error-codes.ts` 비접촉)와는 충돌하지 않는다. 다만 ARCH#5 가 실제 착수될 시점에는 그 사이 추가된 `DB_HOST_BLOCKED` 등 신규 엔트리까지 재편 대상에 포함해야 함을 유의해야 한다 — 후속 착수 시 재확인 필요.
  - 제안: 조치 불필요(현재 스코프 무관). ARCH#5 후속 착수 시 `exec-intake-followups.md` 에 "그 사이 추가된 error-codes.ts 엔트리 재검증" 메모를 추가하면 좋음.

- **[INFO]** 대상 파일·함수가 계획 서술과 코드 실측 일치 확인
  - target 위치: `exec-limits-refactor.md` 라인 19 (ARCH#4 이관 대상)
  - 관련 plan: 없음(코드 실측)
  - 상세: `resolveExecutionRunWorkerConcurrency`/`DEFAULT_EXECUTION_RUN_WORKER_CONCURRENCY` 는 현재 `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts` 에 존재하고, `system-status.constants.ts` 가 이를 import 해 사용 중임을 확인했다(코드 grep 일치). MAINT#9 가 언급하는 `resolveContinuationWorkerConcurrency` 도 이미 canonical resolver 로 존재. plan 서술과 실코드 간 drift 없음 — 선행 조건 문제 없음.

## 요약

`exec-limits-refactor.md` 는 `exec-intake-followups.md` "곁들임 INFO 리팩터 묶음" 4항목 중 저위험 3건(ARCH#4/6, MAINT#9)만 이관하고 ARCH#5(에러코드 레이어 재편)를 명시적으로 후속 분리한다는 스코프 결정 자체는 정합적이며, 코드 실측과도 어긋나지 않는다. 다만 그 스코프 분리 사실이 원본 tracker(`exec-intake-followups.md`)에는 아직 반영되지 않아 두 문서 간 서술 시차가 있다(완료 후 동기화 필요, 체크리스트에 없음). ARCH#5 가 다룰 `error-codes.ts` 를 현재 동시에 편집 중인 다른 in-progress plan(http-ssrf, node-output-redesign 계열)이 있으나 모듈 경계 재편 자체를 건드리지 않아 실질 충돌은 없다. 미해결 결정 우회나 선행 조건 미해소는 발견되지 않았다. 참고로 이번 호출의 payload 파일은 orchestrator 측에서 무관한 내용(auth spec 등)으로 채워져 있었고, 이를 무시하고 plan 파일을 직접 읽어 검토했다.

## 위험도

LOW
