### 발견사항

- **[INFO]** 트랜잭션 롤백(진짜 원자성)은 mock 으로 검증되지 않음 — 새 테스트는 "두 UPDATE 가 같은 트랜잭션 manager 를 탄다"는 전제만 확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` `installStalledTx` 헬퍼 및 `Execution·NodeExecution 두 UPDATE 가 같은 트랜잭션 manager 를 탄다` 테스트 (테스트 자체 주석이 이 한계를 명시)
  - 상세: 보안 결함은 아니다 — 무결성/가용성 관점의 커버리지 갭이며, 저장소의 기존 관례(자매 함수 `cancelParkedExecution`/`markWebChatIdleTimeout` 도 동일하게 unit-mock 한정)와 일치한다. 부분 커밋(둘째 UPDATE 실패 시 첫째 미롤백)로 인한 데이터 불일치가 공격 벡터로 악용될 표면은 없음(사용자 입력 미개입, 상태 전이만 영향).
  - 제안: 조치 불요(선택 사항). 실 DB 기반 e2e 로 둘째 UPDATE 강제 실패 → 첫째 UPDATE 미커밋 확인을 추가하면 좋음.

### 요약

핵심 변경은 `finalizeStalledExhausted`(BullMQ stalled 재배달 소진 시 Execution/NodeExecution 종결 마킹)의 두 UPDATE 를 `dataSource.transaction`으로 원자화한 것이다. `executionId`는 HTTP 요청이 아니라 BullMQ job data(`ExecutionRunProcessor.onFailed`)에서 내려오며, 두 UPDATE 모두 TypeORM 쿼리빌더의 파라미터 바인딩(`:id`, `:executionId`, `:running`)만 사용하고 문자열 결합이 없어 SQL 인젝션 표면이 없다. 하드코딩된 시크릿·자격증명 없음. 인증/인가 경계 변경 없음(내부 워커 이벤트 핸들러, 신규 엔드포인트 아님). 에러 페이로드(`error.code`/`error.message`)는 고정된 정적 문자열만 담아 스택트레이스·내부 경로·민감정보 노출이 없다. 트랜잭션 도입 자체는 부분 커밋으로 인한 데이터 무결성 결함(좀비 RUNNING 상태)을 줄이는 방향이라 오히려 공격 표면을 줄인다. 신규 의존성 추가 없음. 함께 커밋된 CHANGELOG/plan/review 아카이브 산출물에도 시크릿이나 민감정보 유출은 없음(grep 확인). 전반적으로 신규 보안 결함 없음, INFO 1건(테스트 커버리지 한계 — 보안이 아닌 무결성 관점)만 존재.

### 위험도
NONE
