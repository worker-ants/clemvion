## 문서화 리뷰

### 발견사항

---

**[INFO]** `retry-with-backoff.util.ts` — 모듈 수준 JSDoc이 우수함
- 위치: `retry-with-backoff.util.ts:1-19`
- 상세: 사용 예제 포함, 백오프 공식(1s/4s/16s) 명시, `RetryOptions` 인터페이스에 각 필드 설명. 공개 유틸 파일로서 기대 이상의 수준.
- 제안: 현행 유지.

---

**[INFO]** `StuckDocumentRecoveryService` — 클래스 수준 JSDoc 충실
- 위치: `stuck-document-recovery.service.ts:14-40`
- 상세: 왜 이 서비스가 필요한지, 커버하지 못하는 케이스 3가지, 10분 임계 산정 근거까지 기록. 향후 유지보수자에게 필요한 맥락이 잘 담겨 있음.
- 제안: 현행 유지.

---

**[WARNING]** `embedding.service.ts` — 메서드 헤더 주석이 너무 길고 중복 존재
- 위치: `embedding.service.ts:42-57` (`processDocument` 상단 블록 주석)
- 상세: 재시도 정책 4줄이 `spec/5-system/8-embedding-pipeline.md §9`에 이미 정의되어 있으며, 동일 내용이 `plan/in-progress/rag-kb-retry-failure-recovery.md` 에도 반복됨. spec 파일과 코드 주석이 장기적으로 drift할 위험이 있음.
- 제안: 코드 주석을 `// 재시도 정책: spec/5-system/8-embedding-pipeline.md §9` 한 줄로 줄이고, 상세는 spec 파일 한 곳에만 유지.

---

**[WARNING]** `graph-extraction.service.ts` — `doExtract` 메서드에 JSDoc 부재
- 위치: `graph-extraction.service.ts` (새로운 `private async doExtract` 메서드)
- 상세: `processDocument` 클래스 헤더 주석에 재시도 정책은 설명되어 있으나, `doExtract`가 별도 메서드로 분리된 이유(idempotency 보장을 위한 chunk_entity DELETE 재실행)가 메서드 직전에 한 줄 주석만 있고 JSDoc 형식이 아님. `private`이라 외부 API 문서 문제는 아니지만, 메서드 분리 의도가 코드 독자에게 즉시 명확하지 않을 수 있음.
- 제안: 현행 주석(`// 본 추출 본체 — retryWithBackoff 안에서 idempotent 하게 호출됨.`)으로 충분함. 현행 유지.

---

**[WARNING]** `llm.service.ts` — `opts?.timeoutMs` 추가 시 인라인 주석이 오해 소지 있음
- 위치: `llm.service.ts:84-88` (chat 메서드 내 `withTimeout` race 주석)
- 상세: `// LLMClient.chat 은 아직 AbortSignal 을 받지 않으므로 race 만 적용` — "race 만 적용"이 백그라운드 소켓 leak 가능성을 암시하는 주석(`// 백그라운드 소켓은 provider HTTP 클라이언트가 자체 keep-alive 풀로 GC`)과 함께 있어 좋음. 단, `embed` 메서드의 동일 패턴(line ~167)에는 `// batch 단위로 timeout 적용 — 한 batch 가 hang 되면 race 로 즉시 reject.` 만 있고 소켓 leak 주석이 없어 일관성이 없음.
- 제안: `embed` 메서드 쪽에도 `// AbortSignal 전파는 후속 PR — 현재는 race 만 적용` 한 줄 추가하거나, 두 주석 모두 간결하게 통일.

---

**[INFO]** `use-kb-events.ts` — 훅 수준 JSDoc 충실
- 위치: `use-kb-events.ts:8-27`
- 상세: 구독 채널 명명 규약, 이벤트 12종 목록, 5s polling fallback 관계, documentIds 배열 변경 시 재계산 등 소비자가 알아야 할 모든 맥락을 포함. `eslint-disable-next-line react-hooks/exhaustive-deps` 와 함께 우회 이유(`.join(",")` 최적화)도 명시.
- 제안: 현행 유지.

---

**[WARNING]** `plan/in-progress/rag-kb-retry-failure-recovery.md` — PR 체크리스트가 실제 커밋 상태와 불일치
- 위치: `plan/in-progress/rag-kb-retry-failure-recovery.md:20-25`
- 상세: PR1~PR5 모두 `[ ]` (미완) 로 표시되어 있으나 이번 diff에 PR1~PR4 해당 파일이 모두 포함되어 있음. plan 문서가 실제 구현 진행 상태를 반영하지 못하고 있음.
- 제안: 완료된 PR 항목을 `[x]`로 업데이트하거나, PR5(문서) 완료 후 `plan/complete/`로 이동. CLAUDE.md 규약에 따라 `plan/` 문서는 구현 진행과 동기화 유지 필요.

---

**[WARNING]** `prd/9-graph-rag.md` — KB-GR-EX-05 의 API 경로 수정 표기 불명확
- 위치: `prd/9-graph-rag.md:65`
- 상세: `POST /knowledge-bases/:id/documents/:docId/re-extract` 로 경로가 수정됐는데, 변경 이유(이전 경로 `/knowledge-bases/:id/graph/documents/:docId/re-extract` 에서의 변경)가 PRD 내에 설명 없이 조용히 바뀜. 기존 경로가 deprecated 된 것인지 typo 수정인지 독자가 파악하기 어려움.
- 제안: PRD 또는 CHANGELOG 에 "경로 정규화" 맥락을 한 줄 추가. 실제 사용 중인 경로가 맞는지 컨트롤러 코드와 교차 검증 필요.

---

**[INFO]** `spec/5-system/8-embedding-pipeline.md` — §9 신규 섹션 구성 우수
- 위치: `spec/5-system/8-embedding-pipeline.md:220-271`
- 상세: 상태 전이 다이어그램(`pending → processing → …`), 재시도 임계 SQL, 일괄 재시도 API 인터페이스가 하나의 절에 집약되어 있음. 개발자와 QA 모두 활용 가능한 수준.
- 제안: 현행 유지.

---

**[INFO]** `spec/1-data-model.md` — 6개 신규 컬럼 문서화 완비
- 위치: `spec/1-data-model.md:317-322`
- 상세: `embedding_status` enum 의미 분화(`error` vs `failed`)가 명확하게 기술됨. nullable(`?`) 표기도 일관함.
- 제안: 현행 유지.

---

**[INFO]** `V037__kb_retry_failed_status.sql` — DOWN 스크립트 주석 포함
- 위치: SQL 파일 상단 주석 블록
- 상세: DOWN 마이그레이션 SQL을 주석으로 포함한 것은 Flyway 환경에서 롤백 절차를 명확히 전달하는 좋은 관행. 변경 요약 4항목도 간결하게 기술됨.
- 제안: 현행 유지.

---

**[INFO]** i18n 키 `retryAttemptInfo`, `lastError` — 사용처 미확인
- 위치: `en.ts:1698-1699`, `ko.ts:1698-1699`
- 상세: `retryAttemptInfo: "Retry {{count}}/3"`, `lastError: "Last error"` 가 추가됐으나, 이번 diff 내 어떤 컴포넌트에서도 해당 키를 사용하는 코드가 보이지 않음(아마 `embedding-progress-box.tsx` 또는 문서 행 tooltip 에서 사용 예정). 데드 i18n 키인 경우 유지보수 혼란 초래.
- 제안: 실제 사용 컴포넌트 파일이 이번 PR에 포함되어 있는지 확인. plan 문서에도 `embedding-progress-box.tsx` 가 신규 파일로 언급되어 있으나 diff에서 누락 — 해당 파일에서 사용 중인지 검증 필요.

---

**[WARNING]** 환경변수/설정 문서화 누락 — timeout/stuck threshold
- 위치: `embedding.service.ts:15-17`, `graph-extraction.service.ts:29-31`, `stuck-document-recovery.service.ts:48`
- 상세: `EMBED_TIMEOUT_MS=60_000`, `GRAPH_CHUNK_TIMEOUT_MS=90_000`, `STUCK_THRESHOLD_MS=10 * 60 * 1000` 이 하드코딩됨. `stuck-document-recovery.service.ts` JSDoc에 "향후 env 외부화 검토 가능"이라 언급되어 있으나, README나 `.env.example` 에 현재 값과 변경 방법이 안내되어 있지 않음.
- 제안: `.env.example` 에 주석 형태로 현재 기본값과 변경 시나리오를 문서화하거나, README의 KB 섹션에 단락 추가. plan 문서의 "후속" 항목에도 이미 env 외부화가 등재되어 있어, 최소한 그 항목이 언제 처리될지 milestone을 추가.

---

### 요약

전반적으로 이번 변경은 문서화 품질이 높습니다. SQL 마이그레이션의 DOWN 스크립트 주석, `StuckDocumentRecoveryService`의 배경 설명, `retryWithBackoff` 유틸의 사용 예제, spec 문서의 상태 전이 다이어그램 모두 수준 이상입니다. 주요 개선 여지는 두 곳입니다: (1) plan 문서의 PR 체크리스트가 실제 구현 완료 상태와 동기화되지 않아 CLAUDE.md 규약을 위반하고 있고, (2) `retryAttemptInfo`·`lastError` i18n 키의 사용처 컴포넌트(`embedding-progress-box.tsx`)가 이번 diff에 빠져 있어 해당 키가 실제로 연결되는지 확인이 필요합니다. 하드코딩된 timeout/stuck threshold 값의 env 외부화 미흡도 추후 운영 환경 튜닝을 위한 문서화가 권장됩니다.

### 위험도

**LOW**