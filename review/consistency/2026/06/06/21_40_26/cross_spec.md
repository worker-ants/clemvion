# Cross-Spec 일관성 검토 결과

**대상 draft**: `plan/in-progress/spec-draft-kb-unsearchable-warning.md`
**검토 일시**: 2026-06-06

---

## 발견사항

### [WARNING] `ragDiagnostics.skipReason` 신규 값 `kb_unsearchable` 의 의미 범위 중첩
- **target 위치**: 변경 1 §4.2 — `skipReason` enum 에 `kb_unsearchable` 추가
- **충돌 대상**: `spec/5-system/9-rag-search.md §4.2`
- **상세**: 현행 spec 의 `skipReason` 는 "노드 전체 동작 수준"의 skip 원인을 나타낸다(`empty_kb_list` = KB 미설정으로 아예 tool 비노출, `no_results` = 모든 tool 호출이 0건). draft 가 추가하는 `kb_unsearchable` 는 "특정 KB 1개가 검색 불가"이므로, 나머지 KB 는 정상 검색이 가능한 혼합 상황에서 `attempted=true`, `resultCount>0` 이면서 `skipReason=kb_unsearchable` 이 함께 세팅되는 모호한 조합이 발생할 수 있다. `skipReason` 의 기존 의미("모든 검색이 없어서 skip")와 충돌 소지가 있다.
- **제안**: `skipReason` 에 추가하는 대신 `ragDiagnostics` 에 별도 `unsearchableKbs: string[]` (KB name 또는 ID 목록) 필드를 신설하는 방안을 검토한다. 이렇게 하면 "일부 KB 검색 불가 + 일부 정상" 케이스를 `attempted=true`, `resultCount≥0`, `unsearchableKbs=['요금제 안내']` 로 모순 없이 표현할 수 있다. 만약 `skipReason` 를 그대로 사용할 경우, 적용 조건("모든 호출 KB 가 unsearchable 인 경우에만 세팅")을 spec 에 명시해 기존 `no_results` 와 세팅 조건의 정확한 경계를 규정해야 한다.

---

### [WARNING] `tool_result` 의 `status` 필드 신규 추가 — 기존 봉투 shape 과의 병렬성 불일치
- **target 위치**: 변경 1 §2.2 — `status:"not_searchable"` 봉투 추가
- **충돌 대상**: `spec/5-system/9-rag-search.md §2.2`
- **상세**: 현행 spec 의 tool_result 봉투는 `error:"search_failed"`, `grounding:"none"` 두 패턴이 있으며, 두 패턴 모두 top-level 에 고유 키(`error`, `grounding`)를 사용한다. draft 가 추가하는 봉투는 `status:"not_searchable"` + `reason:"reembedding_required"|"reembedding_in_progress"` 복합 키 구조다. 이는 기존 봉투와 구조 패턴이 다르고(`status/reason` 2-필드 vs `error`/`grounding` 1-필드 식별자), 현행 spec §6 에러 처리 표는 이 구조를 인식하지 않아 소비 코드(LLM, `KbToolProvider`)가 어떤 top-level 키로 신호를 판별해야 하는지 불명확해진다.
- **제안**: 기존 `error` 키를 확장해 `error:"kb_unsearchable"` 단일 필드로 표현하고 `reason` 을 서브필드로 두거나, 아니면 `spec/5-system/9-rag-search.md §2.2` 에 "봉투 패턴 카탈로그" 표를 추가해 `status/reason` 구조가 의도적인 확장임을 명시하고 소비 코드 판별 규칙을 정의해야 한다.

---

### [WARNING] `spec/5-system/8-embedding-pipeline.md §line 249` — `idle + dimension NULL` 케이스 누락
- **target 위치**: 변경 3 §line 249 보강 (draft 의 변경 제안)
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md` line 249
- **상세**: 현행 `8-embedding-pipeline.md` line 249 는 "`reembed_status='in_progress'` 인 KB 는 `embedding_dimension` 이 NULL 이므로 RagSearchService 에서 자연스럽게 검색 대상에서 제외된다" 로만 기술한다. draft 가 지적하는 두 번째 케이스 — `reembed_status='idle'` + `embedding_dimension=NULL` (임베딩 모델 변경 후 재임베딩 미실행) — 는 `8-embedding-pipeline.md §7 (Service 변경 요약 구현 노트)` line 346 에서 "`KnowledgeBaseService.update` 시 embeddingModel 실제 변경 시 `embeddingDimension=null` 함께 reset" 으로 짤막하게 언급되나, 이 상태에서 `RagSearchService` 가 어떻게 동작하는지(silent 제외인지, 오류인지)를 `9-rag-search.md` 나 `8-embedding-pipeline.md` 어디에도 정의하지 않는다. 따라서 두 spec 모두 이 케이스를 "구멍"으로 남겨두고 있으며 draft 의 변경 3 이 올바르게 이를 채우려 한다. 단, 현행 `9-rag-search.md §3.1 SQL` 은 `vector_dims(dc.embedding) = <dim>` 조건으로 차원 불일치 청크를 배제하는데, `embedding_dimension=NULL` 인 KB 는 `<dim>` 이 미확정이므로 이 쿼리가 실행 자체를 거부하는지 또는 0건 반환을 내는지 spec 상 명시되지 않았다. draft 변경 1 과 변경 3 을 채택할 때 `9-rag-search.md §3.1` 의 "KB 필터링 선행 로직"(`embedding_dimension IS NULL` 시 tool 노출 전 사전 차단인지 쿼리 내 자연 배제인지)도 함께 명시해야 한다.
- **제안**: 변경 3 보강 시 "사전 차단 경로"(tool 정의 생성 전에 `embedding_dimension IS NULL` KB 를 제외해 `not_searchable` 봉투를 반환)와 "쿼리 내 자연 배제 경로" 중 어느 쪽인지를 `9-rag-search.md §2.1 또는 §3.1` 에 명시적으로 기술한다.

---

### [INFO] `reembedStatus` vs `reembed_status` — draft 의 프론트엔드 필드명 표기 혼용
- **target 위치**: 변경 2 §2.2.1 — "`reembedStatus==='in_progress'`", "`reembedStatus==='idle'`"
- **충돌 대상**: `spec/1-data-model.md §2.11 KnowledgeBase` (DB 컬럼명 `reembed_status`), `spec/2-navigation/5-knowledge-base.md §5 API` (`reembed_status`)
- **상세**: draft 변경 2 는 프론트엔드 코드에서 `reembedStatus` (camelCase) 를 사용하고, `embeddingDimension` (camelCase) 를 사용한다. 이는 API 응답 DTO 가 camelCase 로 직렬화됨을 전제한 것으로, 실제 구현 관행과 일치한다. 그러나 기존 `spec/2-navigation/5-knowledge-base.md §5 API` 는 DB 컬럼명(`reembed_status`) 표기를 그대로 써 프론트엔드 소비 시점의 camelCase 와 표기가 다르다. draft 가 `reembedStatus` camelCase 를 spec 에 명시함으로써 기존 spec 의 `reembed_status` 표기와 명명 비일관성이 생긴다.
- **제안**: 변경 2 를 최종 반영할 때 `spec/2-navigation/5-knowledge-base.md §5 API` 의 응답 필드 표기를 camelCase 로 통일하거나, 변경 2 본문에 "응답 DTO camelCase(`reembedStatus`) ← DB `reembed_status`" 주석을 달아 표기 의도를 명시한다. (기존 spec 의 전면 갱신이 범위를 초과한다면 변경 2 에서만 camelCase 임을 명시하는 인라인 노트로 충분하다.)

---

### [INFO] `spec/0-overview.md §3.4 Inline Alert` — KB 목록 검색 불가 경고의 토픽 적합성
- **target 위치**: 변경 2 §2.2.1 — 카드 경고 표시 (warning 색 Inline Alert 패턴 포함 가능)
- **충돌 대상**: `spec/0-overview.md §3.4 상태 표시 패턴`
- **상세**: `spec/0-overview.md §3.4` 는 KB 목록 카드의 검색불가 경고를 "현재 사용처" 목록에 포함하지 않는다. 경고가 warning 톤의 Inline Alert 패턴을 따른다면 0-overview.md §3.4 "현재 사용처" 열거에 이 케이스를 추가해야 cross-cutting 카탈로그가 완전해진다. 카드 내 배지/인디케이터 수준(Inline Alert 가 아닌 Badge 패턴)으로 처리한다면 충돌은 없지만, 변경 2 의 "경고색" 표현이 어느 패턴에 해당하는지 명확히 해야 한다.
- **제안**: 변경 2 최종 반영 시 UI 신호 패턴(Badge 상태 표시 vs Inline Alert)을 확정하고, Inline Alert 채택이라면 `spec/0-overview.md §3.4 현재 사용처` 목록에 KB 목록 카드 경고를 추가한다.

---

## 요약

draft 는 기존 spec 엔티티(KnowledgeBase, RAG search)를 대체하거나 삭제하지 않고 additive 하게 확장하는 구조이므로 직접적인 데이터 모델 충돌이나 API 계약 역전은 없다. 그러나 (1) `ragDiagnostics.skipReason` 의 기존 "전체 skip" 의미와 새 "개별 KB unsearchable" 의미의 범위 중첩, (2) 기존 1-키 봉투(`error`, `grounding`) 패턴과 신규 2-키 봉투(`status/reason`) 패턴의 구조 불일치가 소비 코드 모호성을 유발할 수 있어 WARNING 으로 분류된다. `8-embedding-pipeline.md §line 249` 의 `idle+NULL` 누락 보완은 draft 가 의도한 변경이지만, `9-rag-search.md §3.1` 의 선행 필터 로직이 함께 명시되어야 완전해지는 연동 구멍이 있다. 명명 비일관성(camelCase/snake_case)과 `0-overview.md §3.4` 사용처 목록 미갱신은 INFO 수준이다. CRITICAL 등급 발견사항은 없다.

---

## 위험도

MEDIUM
