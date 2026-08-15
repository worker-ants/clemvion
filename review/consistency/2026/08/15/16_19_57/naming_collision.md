### 발견사항

없음.

target 변경분(`origin/main...HEAD`, `spec/5-system/` 스코프)을 실측한 결과, 신규 식별자를 도입하지
않는 구조적 변경이었다:

- **spec 변경**: `spec/5-system/4-execution-engine.md` 단 1줄(§7.1 "mid-operation stalled 트리거"
  단락)만 수정됐다. 추가된 문장 — *"이 마감은 단일 트랜잭션이다(2026-08-15) — Execution 을 `FAILED`
  로 쓰는 UPDATE 와 자식 RUNNING `NodeExecution` cascade UPDATE 가 `dataSource.transaction` 으로
  묶인다 … 자매 `cancelParkedExecution`/`markWebChatIdleTimeout` 은 이미 원자적이었고 이 경로만
  열려 있었다."* — 는 새 요구사항 ID·엔티티명·endpoint·이벤트명·ENV 변수를 하나도 신설하지
  않는다. 언급된 식별자(`finalizeStalledExhausted`, `cancelParkedExecution`,
  `markWebChatIdleTimeout`, `dataSource.transaction`, `WORKER_HEARTBEAT_TIMEOUT`)는 모두
  `origin/main` 시점에 이미 코드(`execution-engine.service.ts`)·다른 spec 문서
  (`spec/data-flow/3-execution.md`, `spec/conventions/error-codes.md`,
  `spec/2-navigation/0-dashboard.md`)에 동일한 의미로 존재했음을 `git grep … origin/main` 로 확인.
  기존 의미와 충돌 없이 그대로 재참조한다.
- **코드 변경**: `execution-engine.service.ts` 의 `finalizeStalledExhausted` 내부에서 두 개의
  독립 `createQueryBuilder().update()` 호출을 `this.dataSource.transaction(async (manager) => …)`
  블록으로 감싸고, 지역 변수 `finalized`/`stalledDurationMs` 를 추가했다. 이들은 함수 로컬 스코프
  변수이며 export/공개 API 표면이 아니라 이 checker 의 6개 관점(요구사항 ID·엔티티/타입명·API
  endpoint·이벤트/메시지명·환경변수·파일 경로) 중 어느 것과도 겹치지 않는다.
- **plan 신규 파일**: `plan/in-progress/eia-stalled-atomicity.md` 가 새로 생겼다. frontmatter
  `spec_impact: [spec/5-system/4-execution-engine.md]` 는 실제 diff 범위와 일치하고, 파일명은
  `plan/in-progress/<slug>.md` 컨벤션을 따르며 기존 파일과 겹치지 않는다(디렉토리 목록에
  동명 파일 없음).
- 신규 API endpoint, webhook/queue/SSE 이벤트명, ENV var/config key 는 이번 diff 에 전혀
  포함되지 않았다(diff stat 확인 — 변경 파일은 spec 1개, 코드 2개, plan 1개, review 산출물뿐).

### 요약

이번 target 변경은 기존에 이미 명명된 세 자매 함수(`finalizeStalledExhausted`,
`cancelParkedExecution`, `markWebChatIdleTimeout`) 중 하나에 트랜잭션 하드닝을 적용했다는
사실을 spec 본문 한 문장으로 기록한 것이며, 여기서 사용된 모든 식별자는 `origin/main` 시점에
이미 코드와 spec 양쪽에 동일한 의미로 정의돼 있었다(`git grep` 로 교차 확인). 새 요구사항 ID,
엔티티/DTO/인터페이스명, API endpoint, 이벤트명, 환경변수, spec 파일 경로 어느 것도 신설되지
않았으므로 신규 식별자 충돌 관점의 위험은 없다.

### 위험도

NONE
