### 발견사항

- **[WARNING]** plan 문서가 작업 완료 후에도 체크리스트 미갱신 상태
  - 위치: `plan/in-progress/queue-payload-guard.md` — 모든 작업 항목이 `[ ]`
  - 상세: diff 내 파일들이 모두 구현되었으나 `job-payload.util.ts` 신규, 두 processor 수정, 두 service 가드, 테스트, 스크립트 항목이 미체크. CLAUDE.md 라이프사이클 규약("모든 항목 완료 시 complete/로 이동")을 위반.
  - 제안: 완료된 항목을 `[x]`로 갱신하고, TEST/REVIEW WORKFLOW 항목 완료 후 `plan/complete/`로 `git mv`

- **[WARNING]** processor 두 곳에 동일한 try-catch 로깅 패턴 반복
  - 위치: `document-embedding.processor.ts:47-58`, `graph-extraction.processor.ts:43-54`
  - 상세: `assertDocumentIdPayload` 호출을 감싸는 try-catch + `InvalidJobPayloadError` 타입가드 + 로그 구조가 두 processor에 동일하게 복제. 메시지 문자열만 다름("embedding job" vs "graph extraction job").
  - 제안: `job-payload.util.ts`에 `logAndRethrowPayloadError(logger, jobType, job, err)` 헬퍼를 추가하거나, `assertDocumentIdPayload` 자체가 logger를 선택적으로 받아 내부에서 처리하는 방식으로 DRY화

- **[WARNING]** 서비스 두 곳의 진입부 가드 주석이 4줄로 과도하게 장황
  - 위치: `embedding.service.ts:58-62`, `graph-extraction.service.ts:95-102`
  - 상세: CLAUDE.md 코딩 규약("multi-line comment blocks — one short line max")과 상충. 동일한 설명이 두 파일에 거의 그대로 복사되어 있음.
  - 제안: 각 서비스에서 1줄로 압축. `// service-layer guard: processor validation이 통과시킨 후에도 직접 호출 방어` 수준이면 충분

- **[INFO]** `embedding.service.spec.ts` 두 가드 테스트의 assertion 비대칭
  - 위치: `embedding.service.spec.ts:90-102`
  - 상세: `undefined` 케이스는 `findOne` + `update` + `increment` 셋 다 검증하지만, empty string 케이스는 `increment` 검증 누락. 동일한 코드 경로를 탐색하는데 검증 대상이 달라 혼선을 줌.
  - 제안: empty string 테스트에도 `expect(mockDocRepo.increment).not.toHaveBeenCalled()` 추가하거나 `it.each`로 두 케이스를 통합

- **[INFO]** `cleanup-invalid-queue-jobs.ts`의 블록 스코프 dotenv 로딩 패턴
  - 위치: `cleanup-invalid-queue-jobs.ts:28-33`
  - 상세: `{ const envPath = ...; const result = ...; }` 형태의 명시적 블록 스코프가 사용됨. 변수 누출 방지 의도는 이해되나 스크립트 파일에서 이 관용구는 생소하여 독자에게 "왜 중괄호가 있지?"라는 의문을 유발.
  - 제안: IIFE(`(() => { ... })()`) 또는 단순히 결과를 사용하지 않는 `dotenv.config({ path: ... })` 단일 호출로 변경

- **[INFO]** `Object.hasOwn` 도입 — 긍정적 변경
  - 위치: `variable-modification.handler.ts:121`
  - 상세: `Object.prototype.hasOwnProperty.call(...)` → `Object.hasOwn(...)` 현대화. ES2022+ 대상 프로젝트면 문제없음. tsconfig `lib`에 `es2022` 이상이 포함되어 있는지 확인 권장.

- **[INFO]** `typeof creds.value === 'string'` 타입 안전 변환 — 긍정적 변경
  - 위치: `integration-credentials.e2e-spec.ts:75`
  - 상세: `String(creds.value ?? '')` 패턴은 `value`가 숫자나 객체일 때 의도치 않은 문자열을 생성했음. 명시적 타입 체크 방식이 더 안전.

---

### 요약

전반적으로 변경사항은 명확한 목적(손상 job payload로 인한 부팅 로그 잡음 제거)을 잘 달성하고 있으며, `job-payload.util.ts`는 잘 설계된 재사용 가능 유틸리티다. 테스트 커버리지도 충분하다. 주요 유지보수성 우려는 두 processor에 걸친 try-catch 패턴 중복과 서비스 진입부 주석의 장황함이며, plan 문서가 작업 완료 상태를 반영하지 않아 팀 내 상태 추적에 혼선을 줄 수 있다.

### 위험도

**LOW**