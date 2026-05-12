### 발견사항

---

**[WARNING] 화이트스페이스 documentId 검증 불일치 — processor 레이어와 service 레이어 간**
- 위치: `job-payload.util.ts:38` vs `embedding.service.ts:61`, `graph-extraction.service.ts:100`
- 상세: `assertDocumentIdPayload`는 `documentId.trim() === ''` 조건으로 공백만 있는 문자열(`'   '`)을 거부한다. 반면 service 진입부 가드(`!documentId || typeof documentId !== 'string'`)는 `'   '`를 truthy로 평가해 통과시킨다. 결과적으로 processor를 경유한 `'   '`는 차단되지만, service를 직접 호출한 경우에는 `findOne({ where: { id: '   ' } })` → Document not found → retry 경로를 거쳐 최종 `failed`로 기록된다. 두 경로가 동일 입력에 대해 다른 에러 메시지와 상태 전이를 만들어낸다.
- 제안: service 가드를 `!documentId?.trim() || typeof documentId !== 'string'`으로 통일하거나, `assertDocumentIdPayload`와 동일한 `typeof documentId !== 'string' || documentId.trim() === ''`로 맞춘다. 테스트(`returns early on empty documentId`)에 `'   '` 케이스를 추가한다.

---

**[WARNING] plan 문서 체크박스 미갱신**
- 위치: `plan/in-progress/queue-payload-guard.md` 작업 항목 전체
- 상세: diff에 `job-payload.util.ts` 신규, 두 processor 적용, 두 service 가드, 테스트, cleanup 스크립트가 모두 구현되어 있음에도 `[ ]`로 남아 있다. CLAUDE.md 규약상 "작업 단계가 끝날 때마다 plan 문서를 갱신"해야 하며, 모든 항목이 완료되면 `plan/complete/`로 `git mv`해야 한다. TEST WORKFLOW와 REVIEW WORKFLOW 항목이 진짜 미완인지, 단순 누락인지 구분이 안 된다.
- 제안: 구현 완료된 항목은 `[x]`로 갱신한다. TEST WORKFLOW / REVIEW WORKFLOW가 실제로 완료되면 `git mv plan/in-progress/queue-payload-guard.md plan/complete/`로 이동한다.

---

**[INFO] cleanup 스크립트가 `active` 상태를 제외함**
- 위치: `cleanup-invalid-queue-jobs.ts:42-47`
- 상세: `QUEUE_STATES`에 `active`가 없다. active 상태의 손상 job은 스크립트 실행 시점에 이미 worker가 처리 중이므로 제거 불가한 것은 맞다. 하지만 스크립트 실행 전에 worker가 active로 가져간 손상 job은 패치 배포 후 service 가드에서 조용히 return되어 DB 상태 변경 없이 BullMQ `completed`로 끝난다(service가 void를 정상 반환하므로). 이는 DB에서 해당 document의 `embeddingStatus`가 변경되지 않아 사용자에게 영구 pending처럼 보일 수 있다.
- 제안: 스크립트 주석 또는 운영 절차에 "active job은 서비스 재시작 또는 BullMQ stalledInterval에 의해 재처리 대상이 됨"을 명시한다. service 가드 return 이전에 document 상태를 `failed`로 갱신하는 것도 검토할 수 있다(단, 이 경우 정상 경로의 "직접 호출" 케이스에도 영향).

---

**[INFO] `InvalidJobPayloadError` attempts=1 의존성이 코드에 강제되지 않음**
- 위치: `job-payload.util.ts:9-12` (docstring)
- 상세: 문서에 "큐는 defaultJobOptions가 비어 있어 BullMQ 기본 attempts=1"이라고 설명하지만, 이 가정은 큐 등록 설정에 의존한다. `DOCUMENT_EMBEDDING_QUEUE`나 `GRAPH_EXTRACTION_QUEUE`의 `defaultJobOptions`가 나중에 변경되면 retry 폭주 방지가 무력화된다.
- 제안: 큐 등록 시 `defaultJobOptions: { attempts: 1 }` 또는 `InvalidJobPayloadError` throw 시 `{ disableRetry: true }` 옵션을 명시적으로 설정한다.

---

**[INFO] `Object.hasOwn` 사용 — 런타임 환경 호환성**
- 위치: `variable-modification.handler.ts:124`
- 상세: `Object.hasOwn`은 Node.js 16.9+ / ECMAScript 2022 도입. 기존 `Object.prototype.hasOwnProperty.call`과 동일하게 동작하며, 리팩토링 자체는 올바르다.
- 제안: `tsconfig.json`의 `lib`/`target` 또는 CI Node.js 버전을 확인해 호환성을 검증한다. 별도 조치 불필요할 가능성이 높다.

---

### 요약

이번 변경의 핵심 요구사항(BullMQ 손상 job이 worker 부팅 시 TypeORM "Empty criteria(s)" 에러를 연쇄적으로 유발하던 회귀 차단)은 세 계층(processor 검증 → service 진입부 가드 → 운영 cleanup 스크립트)으로 충분히 방어되어 있다. `assertDocumentIdPayload`의 유효성 검사 범위와 두 service 가드의 화이트스페이스 처리 간 경미한 불일치가 있으나, 실제 UUID는 공백만으로 구성되지 않으므로 운영상 위험은 낮다. 계획 문서 체크박스 미갱신은 프로젝트 규약 위반으로 별도 정리가 필요하다.

### 위험도
**LOW**