## 보안 코드 리뷰

### 발견사항

- **[INFO]** 프로세서 에러 로그에 페이로드 키 목록 노출
  - 위치: `document-embedding.processor.ts` / `graph-extraction.processor.ts` — `JSON.stringify(err.debug)` 호출
  - 상세: `err.debug.payloadKeys`에 `Object.keys(job.data)` 전체가 포함되어 로그로 출력됩니다. 현재 페이로드 키(`documentId`, `knowledgeBaseId` 등)는 민감하지 않으나, 향후 페이로드 스키마가 변경돼 키 이름 자체에 민감 정보(예: `userToken`, `apiKey`)가 들어오면 키 이름이 로그에 노출됩니다.
  - 제안: 로그 레벨을 `warn`으로 낮추거나, `payloadKeys`를 화이트리스트로 필터링하는 방어적 패턴을 고려하세요.

- **[INFO]** 서비스 가드의 `String(documentId)` 로깅
  - 위치: `embedding.service.ts:62`, `graph-extraction.service.ts:100`
  - 상세: `documentId`가 객체인 경우 `String(obj)` → `[object Object]`로 변환돼 실질적 정보 노출은 없습니다. 다만 `undefined`/`null`/숫자 등은 그대로 출력됩니다. 현재 코드는 안전합니다.
  - 제안: 현재 구현 유지 가능. 향후 로그 집계 시스템에서 이 메시지가 외부로 노출되는지 확인하세요.

- **[INFO]** 정리 스크립트의 전체 AppModule 로딩
  - 위치: `cleanup-invalid-queue-jobs.ts:71` — `NestFactory.createApplicationContext(AppModule)`
  - 상세: 1회성 유지보수 스크립트가 전체 애플리케이션 컨텍스트(DB 커넥션, 외부 서비스 연결 포함)를 로드합니다. 운영 환경에서 실행 시 해당 프로세스에 DB/Redis 자격증명이 메모리에 올라갑니다.
  - 제안: 운영 절차 문서(`plan/in-progress/queue-payload-guard.md`)에 최소 권한(read+delete on queues only) 환경 변수로 실행할 것을 명시하는 것이 좋습니다.

- **[INFO]** `Object.hasOwn()` 교체 — 긍정적 보안 변경
  - 위치: `variable-modification.handler.ts:124`
  - 상세: `Object.prototype.hasOwnProperty.call()` → `Object.hasOwn()`으로 교체는 프로토타입 오염(prototype pollution) 공격에 대한 저항성을 높이는 올바른 방향입니다.

- **[INFO]** `cleanup-invalid-queue-jobs.ts` 대용량 큐 메모리 위험
  - 위치: `sweepQueue()` — `queue.getJobs([...QUEUE_STATES])`
  - 상세: 모든 상태의 job을 메모리에 한번에 로드합니다. 큐에 수만 건 이상의 job이 누적된 경우 OOM 발생 가능성이 있습니다.
  - 제안: `getJobs(states, start, end)` 페이지네이션 파라미터를 사용하거나, 실행 전 `getJobCounts()`로 규모를 먼저 확인하는 안전 절차를 주석에 추가하세요.

---

### 요약

이번 변경은 BullMQ 큐 워커에서 손상된 job payload가 TypeORM의 `update(undefined)` 를 통해 예측 불가한 DB 부수효과를 일으키던 취약한 흐름을 차단하는 방어적 개선입니다. `assertDocumentIdPayload`를 통한 조기 검증, `InvalidJobPayloadError` 타입 구분, 서비스 계층의 이중 가드 모두 보안 측면에서 올바른 방향입니다. 파라미터화된 쿼리(`$1`, `$2`) 사용, credentials 마스킹 검증, 페이로드 값(value)이 아닌 키(key)만 로깅하는 원칙도 준수하고 있어 **중대한 취약점은 발견되지 않았습니다.** 로그에 포함되는 `payloadKeys` 필드와 정리 스크립트의 전체 AppModule 로딩은 추후 운영 환경 확장 시 점검이 권장되는 수준입니다.

### 위험도

**LOW**