# Code Review 통합 보고서 — 06 C-2 재개 원자 claim

## 위험도: HIGH (Critical 1)

## Critical
1. [requirement/architecture] `claimResumeEntry` 는 NodeExecution.status 만 원자 UPDATE 하고
   Execution→RUNNING 은 driveResumeAwaited(L1810)에서 별도 트랜잭션. spec §1.1 L81·§7.5 L975 는
   "짝 상태(Execution·NodeExecution) 단일 트랜잭션 갱신"이라 확정 서술 → 불일치.
   crash-after-claim 시 NodeExecution=RUNNING·Execution=WAITING 잔존, recoverStuckExecutions 는
   Execution 만 대상이라 NodeExecution=RUNNING 영구 stuck(재claim affected=0). 
   해소: (a) claim 이 Execution 도 같은 tx 로 WFI→RUNNING 전이(linkedNodeExec) + 크래시 회수 경로,
   또는 (b) spec 을 NodeExecution-only claim 으로 정정. → 페어링(a) 채택 예정(spec 정합 + 회수 가능).

## Warning
1. [requirement] claimResumeEntry legacy 우회가 빈 문자열('')까지 통과 — 도달 가능성 근거 주석 필요.

## INFO (요약)
- #7 동시성 unit 은 mock 순차 배선일 뿐 실제 DB row-level 레이스 미검증 → dockerized e2e 담당(환경 차단).
- #8 L680 stale 주석 isNodeExecutionWaiting → claimResumeEntry 갱신.
- #4 JSDoc 중복, #5 테스트 makeClaimQb 재사용 가능 (사소).
- #9/#10 리네이밍·쿼리 안전성 우수.

## 재시도 필요 (파일 유실)
security·scope·side_effect·testing·documentation (status=success 이나 디스크 부재) — 재실행 권장.

## 라우터
실행 10 / 제외 4(performance·dependency·api_contract·user_guide_sync).
