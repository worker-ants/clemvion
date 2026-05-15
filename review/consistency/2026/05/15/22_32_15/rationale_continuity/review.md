# Rationale 연속성 검토 — spec/5-system/8-embedding-pipeline.md

검토 모드: 구현 착수 전 (--impl-prep)
검토 대상: `spec/5-system/8-embedding-pipeline.md`
검토 일시: 2026-05-15

---

## 발견사항

- **[WARNING]** `§6.2` pgvector 인덱스 설정이 IVFFlat 을 명시하나 Rationale 은 HNSW 로 전환했음을 기록
  - target 위치: `spec/5-system/8-embedding-pipeline.md` §6.2 "pgvector 설정" — `CREATE INDEX ... USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`
  - 과거 결정 출처: 동 문서 `## Rationale` → "후속 적용 (2026-05-02)" 항 — V022 로 차원별 partial HNSW 인덱스(`CREATE INDEX CONCURRENTLY`)를 IVFFlat 대신 도입했고, V023 에서 halfvec 인덱스까지 추가했음을 명시
  - 상세: spec 본문의 DDL 예시가 IVFFlat 을 보여주는데, Rationale 은 이미 HNSW 전환을 완료한 상태다. 구현자가 §6.2 DDL 을 참조해 IVFFlat 인덱스를 신규 생성하거나 마이그레이션을 작성하면 Rationale 에서 폐기된 인덱스 전략을 재도입하게 된다.
  - 제안: §6.2 DDL 예시를 V022/V023 에 맞게 partial HNSW 인덱스(차원별, `vector_cosine_ops` / `halfvec_cosine_ops`)로 갱신하고, IVFFlat 이 교육 목적 예시가 아닌 운영 스키마를 반영하는 것임을 명확히 표시한다. 또는 "실제 인덱스는 마이그레이션 V022/V023 참조" 주석을 DDL 예시에 추가해 혼동을 차단한다.

- **[WARNING]** Rationale 의 "후속 검토(별도 PR 권장)" 항이 이미 완료된 항목을 미해결로 방치
  - target 위치: `spec/5-system/8-embedding-pipeline.md` `## Rationale` → "후속 검토(별도 PR 권장)" 목록 4개 항목
  - 과거 결정 출처: 동 Rationale 의 "후속 적용 (2026-05-02)" 항 — V024 로 "reEmbedAll fire-and-forget → BullMQ 큐 + DB 컬럼으로 교체", "Worker concurrency=3 이 EmbeddingService MAX_CONCURRENT 폴링을 대체" 가 완료되었음을 기록
  - 상세: "후속 검토" 목록에 `reEmbedAll fire-and-forget → BullMQ 같은 지속형 큐 + reEmbedStatus 상태 컬럼`과 `EmbeddingService 폴링 동시성(MAX_CONCURRENT) → 세마포어 패턴 교체` 항이 그대로 남아 있다. 구현자가 이를 미해결 과제로 오인해 중복 작업을 시도하거나, 반대로 "이미 완료됐지만 문서가 부정확하다"는 신뢰도 저하가 생긴다.
  - 제안: 이미 V024 로 완료된 항목에 완료 표시(또는 삭제)를 하거나, 항목별로 "→ V024 에서 완료" 주석을 달아 Rationale 내 완료 이력과 동기화한다. 나머지 미완료 항목(`인라인 모달 3개 → 공용 ConfirmModal 추출`, `allEmbeddings 메모리 누적 → 배치 임베딩 직후 스트리밍 INSERT`, `다중 인스턴스 reEmbedAll 분산 잠금`)은 현재 구현 스코프에 영향을 주는지 확인하고, 영향이 있으면 plan 에 명시한다.

- **[INFO]** `§9.2` 상태 전이 다이어그램과 §9.1 재시도 설명의 `error` 의미 충돌 가능성
  - target 위치: `spec/5-system/8-embedding-pipeline.md` §9.2 상태 전이 다이어그램 및 §9.1 자동 재시도 설명
  - 과거 결정 출처: 동 문서 §8 WebSocket 알림 표 — `document:embedding_error` 이벤트 설명에 "(의미 변경, 2026-05-11) in-flight 일시 오류 — `document:embedding_retry` 또는 `embedding_failed` 가 곧 따라온다. **영구 실패 신호로 사용하지 말 것**" 명시
  - 상세: §9.2 의 상태 전이 다이어그램에서 `error` 상태는 "in-flight 재시도 중 일시 오류"로 정의되어 §8 의 의미 변경과 일치한다. 그러나 두 섹션이 서로를 명시적으로 참조하지 않아 구현자가 WebSocket 이벤트 명칭(`embedding_error`)과 Document.embedding_status(`error`) 가 같은 변경 맥락에 있음을 놓칠 수 있다. 영구 실패를 `embedding_error` 이벤트로 처리하는 프론트엔드 코드가 이미 있다면 회귀가 발생한다.
  - 제안: §9.2 또는 §8 에 상호 교차 참조("§8 WebSocket 이벤트 의미 변경 2026-05-11 참조" 혹은 그 역방향)를 한 줄 추가해 명시적 연결을 만든다.

---

## 요약

`spec/5-system/8-embedding-pipeline.md` 는 전반적으로 Rationale 의 결정 흐름을 충실히 따르고 있으며, BullMQ 전환·재시도 정책·HNSW 인덱스 도입 등의 주요 결정이 Rationale 에 명확히 기록되어 있다. 다만 §6.2 DDL 예시가 이미 폐기된 IVFFlat 인덱스를 보여주고 있어 구현자가 Rationale 에서 이미 완료된 전환을 역방향으로 재도입할 위험이 있다(WARNING). 또한 Rationale 내 "후속 검토" 목록이 V024 로 완료된 항목을 미해결로 방치해 오인을 유발할 수 있다(WARNING). 두 경우 모두 Rationale 자체는 올바른 결정을 담고 있으나 spec 본문과의 동기화가 이루어지지 않은 상태다. CRITICAL 등급의 기각된 대안 재도입이나 합의된 invariant 직접 위반은 발견되지 않았다.

---

## 위험도

LOW
