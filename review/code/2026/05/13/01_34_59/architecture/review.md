### 발견사항

**[WARNING]** 서비스 계층 가드가 컨트롤러 계층의 입력 검증 부재를 보완
- 위치: `embedding.service.ts:58-68`, `graph-extraction.service.ts:97-109`
- 상세: 주석에서 "테스트/컨트롤러"가 직접 호출할 수 있다고 명시. 컨트롤러가 서비스를 직접 호출하면서 documentId를 검증 없이 전달한다면, 이 가드는 아키텍처 결함을 패치하는 형태. 컨트롤러 계층에서 DTO/pipe 레벨 검증이 선행되어야 서비스가 도메인 로직에만 집중 가능
- 제안: 컨트롤러가 서비스를 직접 호출하는 경로가 실제로 존재하는지 확인. 존재한다면 NestJS `ParseUUIDPipe` 또는 DTO class-validator로 컨트롤러 진입부에서 차단하고, 서비스 가드는 제거하거나 `assert`로 교체

**[WARNING]** 정리 스크립트의 과도한 부트스트랩
- 위치: `cleanup-invalid-queue-jobs.ts:73-76`
- 상세: `NestFactory.createApplicationContext(AppModule)`은 DB 연결, 마이그레이션 체크, 모든 프로바이더 초기화까지 포함. 손상 job 정리라는 단순 목적에 비해 실패 표면이 넓음. DB가 오프라인이거나 AppModule 초기화 실패 시 스크립트 자체가 죽음
- 제안: BullMQ `Queue` 인스턴스를 Redis URL로 직접 생성하면 AppModule 의존 없이 동작 가능. 단, `getQueueToken` 패턴 포기가 필요하므로 큐 이름 상수만 import하여 `new Queue(DOCUMENT_EMBEDDING_QUEUE, { connection: { host, port } })`로 경량화

**[WARNING]** 이중 가드로 인한 레이어 책임 모호성
- 위치: Processor (`assertDocumentIdPayload`) + Service (`if (!documentId || ...)`) 중복
- 상세: Processor가 항상 assertDocumentIdPayload로 차단하면 Service 가드는 도달 불가. 반대로 Service 가드가 필요하다면 Processor 가드가 불완전하거나, Service가 큐 외 경로로 호출됨을 의미. 두 레이어의 책임 경계가 불명확
- 제안: 아키텍처적으로 Processor(인프라 계층)는 `throw`로 job을 failed 처리, Service(도메인 계층)는 `throw new Error()`로 호출자에게 위임하는 것이 정석. 현재 Service가 `return`(무음 종료)하는 것은 도메인 계층이 인프라 손상을 은폐하는 형태

**[INFO]** `job-payload.util.ts` 위치가 큐 소비자로 한정
- 위치: `queues/job-payload.util.ts`
- 상세: 유틸이 `queues/` 하위에 위치해 임베딩/그래프 두 큐가 공유. 향후 다른 큐 모듈이 동일 패턴을 필요로 할 때 `common/` 또는 `shared/queue/`로 이동 필요
- 제안: 현 규모에서는 적절. 세 번째 큐가 추가될 때 이동 검토

**[INFO]** `InvalidJobPayloadError` 재시도 방지가 전역 BullMQ 설정에 의존
- 위치: `job-payload.util.ts:9-17`, 두 processor의 throw 경로
- 상세: 주석에서 "BullMQ 기본 attempts=1"에 의존해 즉시 failed 큐로 이동한다고 설명. 큐 설정이나 `defaultJobOptions`가 변경되면 손상 job이 재시도 폭주할 수 있음
- 제안: `InvalidJobPayloadError`에 BullMQ의 `UnrecoverableError`를 상속하거나, processor에서 `throw new UnrecoverableError(err.message)` 로 래핑하면 attempts 설정에 무관하게 즉시 failed 처리 보장

**[INFO]** `Object.hasOwn` 마이그레이션
- 위치: `variable-modification.handler.ts`
- 상세: `Object.prototype.hasOwnProperty.call()` → `Object.hasOwn()` 교체. Node.js 16+, TypeScript 4.5+ 이상에서 지원. 아키텍처 무관한 코드 품질 개선

---

### 요약

변경의 핵심 구조인 `job-payload.util.ts → Processor 계층 차단 → Service 계층 방어 가드`의 3계층 방어는 즉각적인 로그 잡음 문제를 해결하는 실용적 패치다. 그러나 Processor(인프라)와 Service(도메인)가 동일한 payload 검증 책임을 중복 보유하면서 레이어 경계가 흐려졌고, Service 가드의 주석이 "컨트롤러 직접 호출"을 언급하는 것은 컨트롤러-서비스 간 입력 검증 체인에 결함이 있음을 시사한다. 정리 스크립트가 AppModule 전체를 부트스트랩하는 것도 단순 Redis 작업 대비 과도하다. 전체적으로 즉각적 회귀 방지 효과는 충분하나, 컨트롤러 계층 검증 강화와 `UnrecoverableError` 적용으로 설계를 보완하면 각 레이어가 자신의 책임에만 집중하는 구조로 정리된다.

### 위험도
**LOW** — 기능적 결함 없음. 레이어 책임 모호성과 설정 의존성이 향후 유지보수 부담으로 잔류