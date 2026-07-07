# 보안(Security) Review — notif-followup-refactor (origin/main..HEAD)

## 리뷰 범위

- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `finalizeFailedExecution` private 헬퍼 추출 (behavior-preserving extract-method). `runExecution` catch(초기 세그먼트)와 `finalizeResumedExecutionOutcome`(재개 세그먼트)의 near-identical FAILED 종결 블록(상태 마킹·error 봉인·DB save·`EXECUTION_FAILED` WS emit·`execution_failed` dispatch)을 단일 메서드로 일원화.
- `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 위 헬퍼의 재개(rehydrated) 경로 회귀 가드 unit 테스트 신규 추가.
- `spec/5-system/4-execution-engine.md` §4.4 — 순환 DI 처리 기법(forwardRef / ModuleRef) 문서 구조화.
- `plan/**` 4개 파일 — plan lifecycle 갱신(체크박스 완료 표시, `worktree: TBD` → `(unstarted)` 오타 수정, 완료 plan 이동). 코드 변경 없음.

이 커밋셋은 순수 extract-method 리팩터링이다. 두 종결 경로에 각각 인라인돼 있던 동일 블록을 하나의 `private finalizeFailedExecution(savedExecution, error, opts)` 로 옮긴 것이며, 로직·분기·호출 순서·인자는 원본과 문자 그대로 동일하다(diff 대조로 확인). 새로운 사용자 입력 처리 경로나 신규 외부 노출 표면은 없다.

## 발견사항

- **[INFO]** 에러 메시지 새니타이징 유지 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4452` (`finalizeFailedExecution` → `dispatchExecutionFailedNotification` 호출), 4499 (`sanitizeErrorMessage(message)` 적용부)
  - 상세: 리팩터링 전후로 `dispatchExecutionFailedNotification`은 그대로 `sanitizeErrorMessage`를 통해 알림 메시지를 새니타이징한다(SECRET_LEAK_PATTERNS 기반, 커넥션 스트링/시크릿 redact). 헬퍼 추출이 이 호출 경로나 인자 순서를 변경하지 않았음을 diff 및 현재 소스로 확인했다. 관련 unit 테스트(`execution-engine.service.spec.ts:863-896` "알림 메시지의 원본 예외를 새니타이징한다")도 그대로 유지되어 회귀를 가드한다.
  - 제안: 없음 (현행 유지로 충분).

- **[INFO]** stack trace 비영속화 원칙 유지
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4413-4420` (`finalizeFailedExecution` 내부, "WARN #7 (Security)" 주석)
  - 상세: `error.stack`은 파일 경로·모듈명 등 내부 구조를 노출할 수 있어 DB(`Execution.error`)에 저장하지 않고 서버 로그로만 남기는 기존 정책 주석이 헬퍼로 그대로 이관됐다. `savedExecution.error`에는 `message`와 (해당 시) sentinel `code`만 담긴다 — 원본 로직과 동일.
  - 제안: 없음.

- **[INFO]** `Execution.error.code` 누수 방지 sentinel 타입 좁히기 유지
  - 위치: `execution-engine.service.ts:4429-4436`
  - 상세: `ErrorPortFallbackError`/`ExecutionTimeLimitError`인 경우에만 `.code`를 보존하고, 그 외 임의 `Error`의 우발적 `.code` 필드가 `Execution.error`로 누수되지 않도록 하는 기존 가드가 그대로 보존됐다.
  - 제안: 없음.

- **[INFO]** 신규 unit 테스트의 mock 범위 적절
  - 위치: `execution-engine.service.spec.ts:899-952`
  - 상세: 신규 테스트는 `finalizeFailedExecution`을 직접 호출해 재개(rehydrated) 경로가 status 마킹·save·WS emit·`execution_failed` dispatch를 모두 수행하는지 검증한다. 테스트 데이터에 실제 시크릿/자격증명이 하드코딩되지 않았고(`'boom'`, `'wf'`, `'owner'` 등 placeholder), `createMany` mock을 통해 dispatch 발생 여부만 검증하므로 시크릿 유출 위험 없음.
  - 제안: 없음.

- **[INFO]** spec 문서(§4.4) 변경은 순수 서술 재구조화
  - 위치: `spec/5-system/4-execution-engine.md` §4.4
  - 상세: `forwardRef` vs `ModuleRef(strict:false)` 순환 DI 해법의 적용 기준을 표로 정리한 문서 변경. 코드 동작에 영향 없음. `ModuleRef.get(X, {strict:false})`이 실패 시 조용히 `undefined`를 반환하고 (`getNotificationsService`) throw 시 catch해 no-op하는 기존 패턴은 이번 diff의 범위 밖(이미 병합된 PR #841)이며 본 변경에서 손대지 않았다.
  - 제안: 없음. (참고: `ModuleRef` 런타임 해석 실패를 조용히 삼키는 설계는 알림 dispatch가 best-effort 정책이므로 의도된 fail-open이며, 이번 리팩터링이 그 정책을 바꾸지 않았다.)

- **[INFO]** plan 파일 변경은 메타데이터/체크박스 갱신뿐
  - 위치: `plan/complete/spec-update-notifications-background-run-id.md`(신규, 이동), `plan/in-progress/manual-trigger-request-header-redaction.md`(frontmatter `worktree: TBD`→`(unstarted)` 오타 수정), `plan/in-progress/notif-followup-refactor.md`(신규), `plan/in-progress/notif-hardening-followups.md`(체크박스 갱신)
  - 상세: 코드/시크릿/설정값 변경 없음. `manual-trigger-request-header-redaction.md`는 Manual Trigger의 `output.request.headers`가 마스킹 없이 원본 저장되는 기존(선존) 갭을 별도 결정 대기 항목으로 추적 중임을 재확인했다 — 이번 커밋은 그 문서의 frontmatter 오타만 고쳤을 뿐 해당 갭 자체를 해소하지 않는다(범위 밖, 이미 별도 plan으로 분리되어 추적 중).
  - 제안: 해당 헤더 마스킹 갭은 이번 PR 범위가 아니므로 조치 불요. 별도 plan(`manual-trigger-request-header-redaction.md`)에서 후속 처리 예정임을 참고만.

## 요약

이번 delta는 `runExecution`(초기 세그먼트)과 `finalizeResumedExecutionOutcome`(재개 세그먼트)에 중복돼 있던 FAILED 종결 로직(상태 마킹, error 봉인, DB save, WS emit, 알림 dispatch)을 `finalizeFailedExecution` 단일 private 헬퍼로 추출한 behavior-preserving 리팩터링이다. diff 대조 결과 로직·분기·호출 순서에 실질적 변경이 없으며, 기존 보안 통제(에러 메시지 `sanitizeErrorMessage` 새니타이징, `error.stack` DB 비영속화, `.code` sentinel 타입 좁히기)가 헬퍼로 그대로 이관되어 유지된다. 신규 unit 테스트는 재개 경로의 알림 dispatch 누락(버그 A) 재발을 가드하는 회귀 테스트로 시크릿 노출이 없다. spec/plan 변경은 문서·메타데이터 성격이며 코드 동작에 영향을 주지 않는다. 인젝션, 인증/인가, 하드코딩 시크릿, 암호화 관련 신규 취약점은 발견되지 않았다.

## 위험도
NONE
