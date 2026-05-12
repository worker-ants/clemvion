## 발견사항

### [WARNING] 정리 스크립트가 BullMQ 워커를 활성화시킴
- **위치**: `cleanup-invalid-queue-jobs.ts:71` — `NestFactory.createApplicationContext(AppModule)`
- **상세**: 전체 `AppModule`을 부팅하면 `@Processor` 데코레이터가 붙은 `DocumentEmbeddingProcessor`와 `GraphExtractionProcessor`가 NestJS DI 컨테이너에 등록되고, `WorkerHost` 라이프사이클에 의해 즉시 Redis 큐 소비를 시작한다. 스크립트가 `getJobs([...QUEUE_STATES])`로 손상 job을 조회하는 동안 워커가 동일 큐에서 동시에 job을 꺼내 처리한다. Dry-run 중에도 정상 pending job이 실제로 처리될 수 있으며, `active` 상태 job은 `QUEUE_STATES` 목록에 포함되지 않아 조회 자체가 누락된다.
- **제안**: 전체 AppModule 대신 Redis 연결과 큐 모듈만 포함하는 슬림 컨텍스트를 사용하거나, BullMQ의 `Queue` 클래스를 직접 인스턴스화하여 워커 없이 큐를 조작하는 방식으로 변경.

---

### [WARNING] `assertDocumentIdPayload` throw 시 문서 상태가 갱신되지 않음
- **위치**: `document-embedding.processor.ts:47-60`, `graph-extraction.processor.ts:43-56`
- **상세**: 이전에는 `documentId=undefined`가 서비스까지 전달되어 catch 블록에서 `documentRepository.update(undefined, { embeddingStatus: 'failed' })`를 시도했다(TypeORM이 거부하여 결국 실패했지만). 변경 후 processor가 `InvalidJobPayloadError`를 throw하면 BullMQ `failed` 이벤트가 발생하고 `onFailed` → `maybeFinalizeKbBatch`가 실행되지만, 문서 레코드의 `embeddingStatus`/`graphExtractionStatus`는 `pending` 또는 `processing` 상태로 남는다. `isKbBatch=true`인 경우 KB 배치 finalize는 정상 실행되므로 그 경로는 안전하다.
- **제안**: 기존 동작이 TypeORM 오류로 인해 어차피 상태 갱신에 실패했으므로 실질적 회귀는 없다. 다만 손상 job으로 인해 문서가 영구적으로 `pending` 상태에 머물 수 있으므로, `onFailed` 핸들러에서 `InvalidJobPayloadError` 여부를 확인하여 문서 상태를 `failed`로 마킹하는 것을 고려.

---

### [WARNING] `Object.hasOwn` — Node.js 버전 의존성
- **위치**: `variable-modification.handler.ts:124`
- **상세**: `Object.hasOwn`은 Node.js 16.9.0 / V8 9.3 이상에서만 사용 가능하다. 프로젝트가 Node 14를 지원하면 런타임에 `TypeError: Object.hasOwn is not a function`이 발생한다. 기능적으로는 `Object.prototype.hasOwnProperty.call()`과 완전히 동일하다.
- **제안**: `package.json`의 `engines.node` 또는 `.nvmrc`에서 Node 16+ 이상이 보장된다면 무시해도 된다. 확인이 되지 않는다면 이전 방식으로 되돌린다.

---

### [INFO] 서비스 가드와 processor 가드 간 공백 문자열 처리 불일치
- **위치**: `embedding.service.ts:61`, `graph-extraction.service.ts:99` vs `job-payload.util.ts:36`
- **상세**: `assertDocumentIdPayload`는 `.trim() === ''`으로 공백만 있는 문자열을 거부한다. 반면 서비스 진입부 가드 `!documentId`는 공백 문자열(`'   '`)을 truthy로 평가하여 통과시킨다. 공백 documentId로 서비스가 직접 호출되면 DB에서 해당 ID를 가진 문서를 찾지 못해 `Document '   ' not found` 오류가 발생하고 `embeddingStatus='failed'`로 마킹된다. 정상 큐 흐름에서는 processor가 이미 차단하므로 실제 경로는 없다.
- **제안**: 서비스 가드 조건을 `!documentId?.trim()` 또는 `typeof documentId !== 'string' || !documentId.trim()`으로 통일.

---

### [INFO] dotenv 로딩 순서 (컴파일 후 동작 확인)
- **위치**: `cleanup-invalid-queue-jobs.ts:26-31`
- **상세**: TypeScript → CommonJS 컴파일 시 모든 static import가 require()로 변환되고 상단에 위치한다. 그러나 `AppModule`의 require는 클래스 정의만 로드하며 실제 NestJS 컨텍스트 생성은 `main()`의 `createApplicationContext()` 시점에 발생한다. dotenv.config()는 `{}` 블록에서 요구(require) 이후 `main()` 호출 이전에 실행되므로, 런타임 연결 초기화 시에는 환경변수가 이미 적용되어 있다. 실질적 문제는 없다.

---

## 요약

이번 변경은 BullMQ 큐에 누적된 손상 payload job이 TypeORM 오류를 증폭시키던 회귀를 `assertDocumentIdPayload` (processor 레이어)와 서비스 진입부 가드 (service 레이어)의 이중 방어선으로 깔끔하게 차단한다. 공개 API 시그니처 변경, 전역 상태 변조, 의도치 않은 네트워크 호출은 없다. 핵심 주의사항은 두 가지: 정리 스크립트가 전체 AppModule을 부팅하여 실제 워커가 활성화된다는 점(운영 실행 전 확인 필요), 그리고 무효 payload job이 문서 상태를 `failed`로 마킹하지 않고 `pending`/`processing`으로 방치될 수 있다는 점이다. 나머지는 낮은 위험도의 개선 제안이다.

## 위험도

**LOW** — 기능 로직 자체의 안전성은 높으나, 정리 스크립트의 워커 활성화 부작용을 운영 실행 전 반드시 인지해야 한다.