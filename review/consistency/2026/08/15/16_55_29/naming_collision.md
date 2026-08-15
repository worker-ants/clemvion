# 신규 식별자 충돌 검토 — naming_collision

## 검토 범위 요약

prompt_file 에 첨부된 target 문서 본문·diff 는 컨텍스트 예산 초과로 대부분 생략되어 있었다.
지시에 따라 "여기 없다 = 없다" 로 판단하지 않고, 절대경로 워크트리
(`/Volumes/project/private/clemvion/.claude/worktrees/eia-r8-cache-scope-4ae434`)에서
`git diff origin/main...HEAD` 를 직접 재현해 실제 변경분을 확인했다.

이번 diff(`origin/main...HEAD`, 7 커밋)의 코드/spec 실질 변경은 매우 좁다:

- `spec/5-system/4-execution-engine.md` — 기존 §7.1/§Rationale 서술에 "dead-letter 마감의
  원자성 (2026-08-15 원자화)" 각주 추가 (9줄)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
  기존 함수 `finalizeStalledExhausted` 내부의 두 `UPDATE`(Execution, NodeExecution)를
  `this.dataSource.transaction(...)` 으로 묶는 리팩터. 새 export·클래스·인터페이스·
  컨트롤러·엔드포인트·이벤트 없음
- 대응 `*.spec.ts` — 새 테스트 헬퍼 `installStalledTx` 추가
- `CHANGELOG.md` — 신규 `## Unreleased` 항목 1개
- `plan/in-progress/eia-stalled-atomicity.md` 신설 + 자매 트래커
  (`spec-sync-external-interaction-api-gaps.md`) 체크박스 동기화 + `eia-db-wire-invariant.md`
  가 `plan/complete/` 로 이동에 따른 링크 경로 갱신 2곳

## 발견사항

해당 diff 가 도입하는 신규 식별자를 6개 관점 전수로 대조했다. 신규 요구사항 ID, 신규
엔티티/DTO/인터페이스명, 신규 API endpoint, 신규 이벤트/메시지명, 신규 ENV var/config key,
신규 spec 파일 경로 — **어느 것도 이번 변경으로 새로 생기지 않았다.**

- 코드 변경은 기존 함수 `finalizeStalledExhausted`(선존, `Execution`/`NodeExecution` 엔티티도
  선존) 내부를 `dataSource.transaction` 으로 감싸는 리팩터뿐이다. 새 클래스/인터페이스/DTO/
  컨트롤러/엔드포인트/이벤트 emit 이름 없음(`git diff` 에서 `class |interface |@Injectable|
  @Controller|@Get|@Post|@Put|@Delete|@EventPattern|@MessagePattern` 패턴 매치 0건).
- 새 로컬 변수 `finalized`(함수 스코프 내부), 새 테스트 헬퍼 `installStalledTx` 는 도입됐으나
  둘 다 전역 노출 식별자가 아니다. `installStalledTx` 는 자매 헬퍼 `installCancelTx` 와 같은
  네이밍 컨벤션(`install<Scope>Tx`)을 따르고 이름이 겹치지 않는다(같은 파일 3265줄
  `installCancelTx` vs 4879줄 `installStalledTx` — grep 확인, 충돌 없음).
- `spec/5-system/4-execution-engine.md` 신규 각주 제목 "dead-letter 마감의 원자성" 은 이
  문서에서 이미 확립된 "dead-letter"/"DLQ" 용어(§9.3 `ContinuationDlqMonitorService`,
  `ExecutionRunDlqMonitorService`, `CONTINUATION_DLQ_ALARM_THRESHOLD` 등, 총 9곳)를 같은
  의미로 재사용할 뿐 새 개념·새 ID 를 얹지 않는다.
- `CHANGELOG.md` 신규 헤딩 `## Unreleased — stalled 마감의 부분 커밋 (자식 NodeExecution
  영구 RUNNING 잔류)` 은 기존 21개 `## Unreleased` 헤딩과 grep 대조 결과 중복 없음.
- 신규 plan 파일 `plan/in-progress/eia-stalled-atomicity.md` 는 기존 `plan/in-progress/*.md`
  네이밍 컨벤션(kebab-case, 동사구 없는 주제명)을 따르고 기존 파일과 경로 충돌 없음.
  `plan/complete/eia-db-wire-invariant.md`(선행 PR 이 이관)와도 이름이 다르다.
  `spec-sync-external-interaction-api-gaps.md`·`update-returning-tuple-shape.md` 의 상대
  링크 2곳이 `./eia-db-wire-invariant.md` → `../complete/eia-db-wire-invariant.md` 로
  갱신된 것도 파일 이동을 뒤따르는 정상 동기화이지 신규 식별자 충돌이 아니다.
- ENV var/config key 신규 도입 없음 — 이번 diff 는 기존 `EXECUTION_RUN_DLQ_*`,
  `STUCK_RECOVERY_STALE_MS` 등 어떤 env var 도 추가·변경하지 않는다.

발견된 CRITICAL/WARNING 없음.

## 요약

이번 target(`spec/5-system/`, impl-done 스코프)의 실질 diff 는 `finalizeStalledExhausted`
의 트랜잭션 원자화 리팩터 하나로 좁혀지며, 새 요구사항 ID·엔티티/DTO/인터페이스명·API
endpoint·이벤트/메시지명·환경변수/설정키·spec 파일 경로 중 어느 것도 신규 도입되지 않았다.
유일한 신규 이름(`installStalledTx` 테스트 헬퍼, `finalized` 로컬 변수, 신규 plan 파일
`eia-stalled-atomicity.md`)은 모두 기존 자매 명명 컨벤션을 그대로 따르며 충돌 없이 검증됐다.

## 위험도
NONE
