### 발견사항

---

**[WARNING] 재임베딩 시 그래프 추출 묵시적 연쇄 실행**
- 위치: `document-embedding.processor.ts` — `onCompleted` → `maybeChainGraphExtraction`
- 상세: 사용자가 graph 모드 KB에서 임베딩 모델 변경으로 전체 재임베딩(`re-embed`)을 실행하면, 임베딩이 완료된 모든 문서에 대해 그래프 추출 잡도 자동으로 큐에 추가됩니다. 사용자 입장에서는 임베딩만 재실행했는데 LLM 추출 비용이 추가로 발생하는 예상치 못한 부작용입니다. UI나 API에서 이 동작에 대한 안내가 없습니다.
- 제안: `re-embed` API 응답 또는 문서에 "graph 모드 KB는 재임베딩 시 그래프 추출도 함께 트리거됩니다" 경고를 추가하거나, 명시적 파라미터(`skipGraphExtraction`)로 제어할 것

---

**[WARNING] `reExtractDocument` 가 `reExtractAll` 진행 중 `reextract_status` 를 영구 잠금 상태로 만들 수 있음**
- 위치: `knowledge-base.service.ts` — `reExtractDocument` / `graph-extraction.processor.ts` — `maybeFinalizeKbBatch`
- 상세: `reExtractAll` 진행 중(`reextract_status = 'in_progress'`)에 `reExtractDocument`가 호출되면, 해당 문서의 상태가 `pending`으로 리셋됩니다. 배치의 마지막 잡이 완료될 때 `maybeFinalizeKbBatch`가 이 문서를 pending으로 보고 finaliz를 건너뜁니다. 이후 단건 재추출 잡이 완료될 때는 `isKbBatch=false`이므로 finalize를 호출하지 않아 `reextract_status`가 `in_progress`로 영구 고착됩니다.
- 제안: `reExtractDocument`에서 `reextract_status = 'in_progress'` 체크 후 409를 반환하도록 추가 (현재 `reExtractAll`에는 CAS 잠금이 있지만 단건에는 없음)

---

**[WARNING] 서버 크래시 시 `reextract_status` 복구 불가**
- 위치: `knowledge-base.service.ts` — `reExtractAll`
- 상세: CAS로 `reextract_status = 'in_progress'` 설정 후 `addBulk` 전에 서버가 크래시되면 상태가 영구 고착됩니다. 다른 곳에서 `reExtractAll`을 다시 호출해도 `reextract_status = 'idle'` 조건이 만족되지 않아 409만 반환됩니다. 재임베딩(`reembedStatus`)도 동일한 패턴이지만, 그래프 추출은 LLM 비용이 수반되어 사용자가 수동 복구를 원할 가능성이 더 높습니다.
- 제안: 관리용 강제 리셋 엔드포인트(`PATCH /knowledge-bases/:id/graph-lock?force=true`) 또는 스케줄된 상태 정리 로직 추가

---

**[WARNING] `extractionLlmConfigId`를 null로 되돌릴 수 없음**
- 위치: `update-knowledge-base.dto.ts` — `extractionLlmConfigId`, `knowledge-base.service.ts` — `update`
- 상세: `@IsUUID()` 검증으로 인해 빈 문자열/null을 전달할 수 없습니다. 한번 특정 LLMConfig를 지정하면 워크스페이스 기본값으로 되돌릴 수 없습니다. UpdateDTO에는 null 허용이 없고, 서비스 레이어도 `undefined` 체크만 합니다.
- 제안: `@IsUUID() @IsOptional() @ValidateIf((o) => o.extractionLlmConfigId !== null)` 조합으로 null 전달을 허용하고, 서비스에서 `null` 값을 명시적으로 처리할 것

---

**[WARNING] `maybeFinalizeKbBatch` 에서 worker 프로세스 강제 종료 시 문서가 `processing` 상태로 잔류**
- 위치: `graph-extraction.processor.ts` — `onFailed` / `graph-extraction.service.ts` — `extractDocument`
- 상세: `extractDocument`는 내부에서 예외를 catch하고 상태를 `error`로 변경한 후 rethrow하지 않습니다. 따라서 bullmq 잡은 항상 `completed`로 처리됩니다. Worker 프로세스가 `processing` 상태 변경 직후 강제 종료되면 문서가 `processing` 상태로 잔류하고, `maybeFinalizeKbBatch`의 카운트 조건이 절대 0이 되지 않아 `reextract_status`가 영구 고착됩니다.
- 제안: bullmq의 stalled job timeout 설정 또는 별도 상태 정리 스케줄러 도입

---

**[INFO] `refreshKbStats` 로직 중복**
- 위치: `graph-extraction.service.ts:~160행`, `graph-query.service.ts:~310행`
- 상세: 동일한 SQL이 두 서비스에 복제되어 있습니다. 주석에서 의도적임을 명시했으나, 변경 시 두 곳을 동시에 수정해야 하는 유지보수 부담이 있습니다.
- 제안: `GraphStatsHelper` 같은 공용 서비스나 DB 함수로 추출

---

**[INFO] TypeORM 엔티티에 누락된 인덱스 선언**
- 위치: `entity.entity.ts`, `chunk-entity.entity.ts`
- 상세: SQL 마이그레이션에서 생성하는 `idx_entity_kb_mention (knowledge_base_id, mention_count DESC)`, `idx_chunk_entity_entity (entity_id)` 인덱스가 TypeORM 엔티티의 `@Index` 데코레이터에 없습니다. Flyway가 DDL을 담당하므로 실제 동작에는 영향 없지만, TypeORM sync 모드나 entity 기반 마이그레이션 도구 사용 시 누락됩니다.
- 제안: `@Index('idx_entity_kb_mention', ['knowledgeBaseId', 'mentionCount'])` 추가

---

**[INFO] SVG 컨텍스트에서 CSS 변수 미해석 가능성**
- 위치: `graph-visualization.tsx` — `toEdges` 함수
- 상세: `labelStyle: { fill: "var(--muted-foreground)" }` 은 react-flow가 SVG `<text>` 요소의 인라인 스타일로 렌더링할 때 CSS 변수가 SVG 스코프에서 해석되지 않아 투명/기본값으로 표시될 수 있습니다.
- 제안: 실제 색상값(`#6b7280` 등) 또는 `getComputedStyle`로 런타임 해석값을 사용할 것

---

**[INFO] API 응답 이중 언래핑 패턴의 취약성**
- 위치: `knowledge-bases.ts` — `reExtractAll`, `getGraphStats`, `getEntityDetail` 등 다수
- 상세: `(data as { data?: unknown })?.data ?? data` 패턴이 여러 메서드에 반복됩니다. 응답 구조가 일관되지 않음을 시사하며, 향후 응답 구조 변경 시 타입 시스템이 실패를 감지하지 못합니다.
- 제안: `apiClient` 인터셉터 레벨에서 래퍼 언래핑을 통일하거나, 각 엔드포인트의 실제 응답 구조를 일관되게 정의할 것

---

### 요약

전체적으로 마이그레이션, 엔티티, DTO 간 정합성은 잘 유지되어 있고, CAS 기반 잠금·CASCADE 설계·dedup UPSERT 등 동시성 안전성에 신경을 쓴 흔적이 보입니다. 그러나 **재임베딩 시 그래프 추출이 묵시적으로 연쇄 실행되는 부작용**(LLM 비용 발생)과 **`reExtractDocument`가 배치 진행 중 호출될 때 `reextract_status`가 영구 고착되는 레이스 컨디션**이 실 운영 환경에서 고객 노출 버그로 발전할 가능성이 가장 높습니다. 서버 크래시로 인한 잠금 잔류 문제도 복구 메커니즘 없이는 관리자 개입이 필요한 상황을 만들 수 있습니다.

### 위험도

**MEDIUM**