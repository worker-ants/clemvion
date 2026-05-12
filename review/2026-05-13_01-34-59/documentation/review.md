### 발견사항

- **[WARNING]** Plan 문서 체크리스트가 실제 구현 상태를 반영하지 않음
  - 위치: `plan/in-progress/queue-payload-guard.md` 작업 항목 전체
  - 상세: `job-payload.util.ts` 신규, 두 processor 가드, 두 service 가드, 테스트, cleanup 스크립트 — 이 PR 에서 모두 구현됐으나 체크박스가 `[ ]` 로 남아 있음. CLAUDE.md 의 PLAN 라이프사이클 규약("작업 단계가 끝날 때마다 plan 문서를 갱신")에 위반. 미체크 항목이 없으면 `plan/complete/` 로 `git mv` 이동 대상이기도 함.
  - 제안: 완료된 항목을 `[x]` 로 갱신하고, TEST WORKFLOW / REVIEW WORKFLOW 진행 후 모든 항목이 완료되면 `git mv plan/in-progress/queue-payload-guard.md plan/complete/queue-payload-guard.md`

---

- **[INFO]** cleanup 스크립트의 "1회성" 성격이 파일 내 주석에만 명시됨
  - 위치: `backend/scripts/cleanup-invalid-queue-jobs.ts` 파일 상단 JSDoc
  - 상세: 운영 절차 3단계(`1) dry-run → 2) 검토 → 3) --apply 1회 정리`)는 잘 문서화됐으나, "스크립트 실행 완료 후 이 파일은 유지/삭제 여부"에 대한 결정이 plan 어디에도 없음. 향후 같은 회귀가 발생할 경우 재사용 여부가 불분명.
  - 제안: plan 문서의 "결정 사항" 섹션에 "스크립트는 회귀 재발 대비용으로 `scripts/` 에 보존" 또는 "1회 사용 후 삭제" 한 줄 추가

---

- **[INFO]** `embedding.service.ts` / `graph-extraction.service.ts` 가드 주석이 processor 구현에 교차 의존
  - 위치: `embedding.service.ts:61-64`, `graph-extraction.service.ts:98-101`
  - 상세: "정상 흐름은 DocumentEmbeddingProcessor 가 assertDocumentIdPayload 로 이미 검증" — processor 의 검증 로직이 변경되거나 service 가 다른 caller 로 진입 경로가 늘어날 경우 이 주석이 오해를 유발할 수 있음.
  - 제안: "processor layer 에서 이미 검증" → "큐 워커 경로에서는 processor 가 검증. 본 가드는 테스트/컨트롤러 등 **직접 호출 경로** 방어용" 으로 caller 중립적 표현으로 교체

---

- **[INFO]** `InvalidJobPayloadError` JSDoc 의 BullMQ `attempts=1` 가정이 queue 설정과 결합
  - 위치: `job-payload.util.ts:8-10`
  - 상세: "큐는 `defaultJobOptions` 가 비어 있어 BullMQ 기본 attempts=1" — 실제 queue 파일(`document-embedding.queue.ts` / `graph-extraction.queue.ts`)의 `defaultJobOptions` 가 변경되면 이 주석의 근거가 깨짐. 현재는 정확하나 유지보수 중 불일치 위험.
  - 제안: 해당 설명을 queue 설정 파일 쪽 주석으로 이동하거나, `job-payload.util.ts` 주석에 "설정 위치: `document-embedding.queue.ts`" 처럼 파일 참조를 추가

---

### 요약

전반적으로 문서화 수준이 높다. `job-payload.util.ts` 의 JSDoc, cleanup 스크립트의 사용법/운영 절차, 두 service 가드의 TypeORM 오류 재현 경로 설명은 모두 충실하다. 주요 갭은 plan 문서의 체크리스트가 구현 완료 상태를 반영하지 않은 점으로, CLAUDE.md 의 PLAN 라이프사이클 규약 위반이자 이후 작업자에게 혼란을 줄 수 있다. 나머지는 미래 유지보수 시 오해 가능성을 줄이기 위한 소규모 개선 사항이다.

### 위험도

**LOW**