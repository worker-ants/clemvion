# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 발견이 있어 호출자가 차단해야 합니다.

검토 대상: `plan/in-progress/spec-draft-unified-model-management.md`
검토 일시: 2026-06-10

---

## 전체 위험도
**HIGH** — plan frontmatter 완전 누락(build guard 위반)이 CRITICAL 1건이며, WARNING 9건이 구현 시 혼동·race 유발 위험을 내포한다.

---

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Convention Compliance | `plan/in-progress` 파일 필수 frontmatter(`worktree`·`started`·`owner`) 완전 누락 — `plan-frontmatter.test.ts` build guard 위반 확실 | 파일 최상단 (현재 `# Spec Draft — …` 로 바로 시작) | `.claude/docs/plan-lifecycle.md §4` + `spec/conventions/spec-impl-evidence.md §4.2` | 파일 최상단에 `---\nworktree: unified-model-mgmt-5af7ee\nstarted: 2026-06-10\nowner: project-planner\n---` 블록 추가 |

---

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | Cross-Spec | `spec/1-data-model.md §2.11 KnowledgeBase` FK 타깃 텍스트 `FK → LLMConfig` 가 테이블 rename 후 거짓이 됨 (`rerank_llm_config_id`, `extraction_llm_config_id`) | 변경 1 §2.16.1 "영향 없음(확인)" 절 | `spec/1-data-model.md §2.11` | 변경 3 표에 해당 컬럼 FK 타깃 설명 `FK → ModelConfig (kind=chat)` 텍스트 갱신 추가 |
| 2 | Cross-Spec | `spec/1-data-model.md §2.20 AssistantSession.llm_config_id` 및 `llm_usage_log.llm_config_id` FK 타깃 텍스트 `FK → LLMConfig` 잔존 | 변경 1 "영향 없음(확인)" 절 | `spec/1-data-model.md §2.20` + llm_usage_log 참조 기술 | 변경 3 갱신 목록에 §2.20 및 llm_usage_log FK 설명 `FK → ModelConfig kind=chat` 갱신 추가 |
| 3 | Cross-Spec | deprecation alias 완전 목록(서브경로 포함) 및 제거 시점 미정의 — `POST /api/llm-configs/preview-models` 가 alias 범위인지 미명시 | 변경 2 §3 API — "구 endpoint alias 로 한시 유지, 후속 PR에서 제거" | `spec/2-navigation/6-config.md §3 LLM Config API / Rerank Config API` | 변경 2 §3 에 alias 완전 목록과 후속 PR 을 특정 plan/in-progress 파일 참조로 연결; `spec/2-navigation/6-config.md §3` 을 `/api/model-configs` SoT 로 갱신 |
| 4 | Cross-Spec | `spec/5-system/7-llm-client.md §4` 에 kind 기반 팩토리 dispatch 흐름 미기술 — target 이 "§4 에 명시"를 선언하나 초안 본문에 구체 흐름 없음 | 변경 3 — "7-llm-client §4: 팩토리 선택 ModelConfig.kind 기반 명시" | `spec/5-system/7-llm-client.md §4 LLMClientFactory` | 변경 3 적용 시 `kind='chat'|'embedding'` → `LLMClientFactory`, `kind='rerank'` → `RerankClientFactory` dispatch 다이어그램 또는 서술 추가 |
| 5 | Cross-Spec | `spec/5-system/1-auth.md §4.1` 감사 로그 액션명 전환 정책 누락 | 변경 3 — "§3.2 Rerank Config → model_config(kind=rerank) 갱신" 선언만 있음 | `spec/5-system/1-auth.md §4.1` `llm_config.*`/`rerank_config.*` 감사 로그 | 변경 3 갱신 목록에 §4.1 감사 로그 행 추가 — "llm_config.*/rerank_config.* → model_config.*(create/update/delete/set-default)" 명시 |
| 6 | Convention Compliance | 마이그레이션 번호 V088~V092 고정 기술 — 구현 시 race 및 번호 충돌 위험 | `## 변경 0 — 마이그레이션 보강` 항목 전체 | `spec/conventions/migrations.md §2·§5` (max+1 동적 할당 절차) | Draft 에서 V088~V092 를 상대 표기(`V<max+1>` 등)로 변경하거나, "구현 착수 시 §5 절차에 따라 당시 max+1 재할당" 주의 문구 명시 |
| 7 | Convention Compliance | `PATCH /api/model-configs/:id/set-default` 동사형 sub-path 패턴 — REST 명사형 관용(`/default` + `PUT/PATCH`)과 거리감 | 변경 2 §3 API 표 | `spec/conventions/swagger.md §2-1~2-4` | `/api/model-configs/:id/default` + `PUT` 명사형 변경 검토, 또는 기존 spec 선례임을 draft 에 1줄 명시 |
| 8 | Rationale Continuity | `spec/5-system/7-llm-client.md Rationale` "별개 DB 테이블 → 별도 팩토리" 논리 전제가 무너졌으나 대체 서술 문안이 초안에 없음 | 변경 3 표 — "§4: 팩토리 분리 유지, 테이블만 통합" 선언 | `spec/5-system/7-llm-client.md ## Rationale` "왜 LLMClientFactory 에 통합하지 않았나" 항 | 변경 3 반영 시 Rationale 항을 직접 수정 — "테이블 통합됐음에도 API shape 차이(rerank(query,docs[])·스코어 배열·스트리밍 없음) 로 분리 유지" 로 교체 |
| 9 | Rationale Continuity | `spec/5-system/9-rag-search.md Rationale` "왜 RerankConfig 를 LLMConfig 와 분리했나" 항 갱신 방향만 제시, 대체 문안 없음 — 단순 삭제 시 분리 유지 근거 소실 | 변경 3 — "갱신/폐기" 1줄 지시 | `spec/5-system/9-rag-search.md ## Rationale` | 변경 3 에 구체 대체 문안 제시 — "ModelConfig 단일 테이블 통합, 그러나 API shape 차이로 RerankClient/RerankClientFactory 분리 유지" 취지 명문화 |
| 10 | Rationale Continuity | `spec/5-system/8-embedding-pipeline.md Rationale` — `listModels type='embedding'` → `kind='embedding'` 조회 전환 근거 문안 미비 | 변경 3 — "Rationale 에 전환 근거 추가" 지시 | `spec/5-system/8-embedding-pipeline.md ## Rationale` V021 결정 항 | 변경 3 에 전환 근거 문안 명시 — "kind='embedding' ModelConfig 1급화로 별도 type 필터 불필요, dimension SoT 일원화" |
| 11 | Naming Collision | `spec/2-navigation/_layout.md` 내비게이션 URL `/llm-configs` 갱신 목록 누락 — URL↔API prefix 불일치 가능성 | 변경 3 갱신 목록 | `spec/2-navigation/_layout.md` line 66 내비게이션 항목 7 URL `/llm-configs` | 변경 3 에 `spec/2-navigation/_layout.md` 항목 7 갱신(URL 변경 또는 "URL 불변, API prefix 만 전환" 명시) 추가 |
| 12 | Naming Collision | `spec/2-navigation/6-config.md §3 API` 표의 `POST /api/llm-configs/preview-models` 행 갱신 누락 — 두 spec 파일 간 endpoint 명 충돌 | 변경 3 — `spec/5-system/7-llm-client.md §5.5` 경로 갱신만 명시 | `spec/2-navigation/6-config.md §3 API 표` preview-models 행 | 변경 3 갱신 목록에 `spec/2-navigation/6-config.md §3 API 표 — preview-models 행` 갱신 명시 추가 |
| 13 | Naming Collision | 감사 로그 액션명 `llm_config.*`/`rerank_config.*` → `model_config.*` 대체 여부 미명시 (Cross-Spec WARNING 5 와 동일 위배, 통합) | 변경 3 §3.2 갱신 | `spec/5-system/1-auth.md` line 348 | Cross-Spec WARNING 5 제안과 동일 — §4.1 갱신 및 append-only 보존 정책 명시 |
| 14 | Naming Collision | `ModelConfig` 엔티티명 vs `ModelInfo` DTO — 동일 LLM 모듈 내 공존, `type`/`kind` 값 집합 겹침. INFO 급에서 WARNING 으로 격상 필요 | 변경 4 Naming INFO-7 (INFO 분류) | `spec/5-system/7-llm-client.md §3.5 ModelInfo` | 변경 4 를 WARNING 급으로 격상; `spec/5-system/7-llm-client.md §3.5 ModelInfo` 정의 상단에 구분 주석 추가 |

> 참고: WARNING 11·12·13 은 Cross-Spec WARNING 3·(중복)·5 와 각각 동일 위배를 다른 각도로 발견한 것. 구체 조치는 합산 1건씩으로 처리.

---

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | Cross-Spec | `spec/1-data-model.md §1` ERD 트리에 `LLMConfig`, `RerankConfig` 잔존 | `spec/1-data-model.md §1 ASCII ERD` | 변경 1 적용 시 ERD 를 `ModelConfig (1:N)` 단일 행으로 통합 |
| 2 | Cross-Spec | `spec/data-flow/6-knowledge-base.md §2.1` 표의 V029 마이그레이션 참조 — V091 갱신 필요 | `spec/data-flow/6-knowledge-base.md §2.1` | 변경 3 적용 시 해당 행 마이그레이션 버전을 V091 로 갱신 |
| 3 | Cross-Spec | `POST /api/model-configs/:id/test` 가 `chat/embedding` 만 지원함을 Rationale 에서 R-3 "rerank 연결 테스트 미제공" 정책과 연결하지 않음 | 변경 2 §3 API 표 비고 | Rationale 에 "rerank kind 연결 테스트 미제공 — 기존 R-3 정책 유지" 주석 추가 |
| 4 | Cross-Spec | `spec/5-system/7-llm-client.md §5.5` 경로 갱신 시 보안 계약(SSRF 가드·Rate limit·apiKey 미로깅) 동일 유지 명시 부재 | 변경 3 §5.5 갱신 | 변경 3 §5.5 갱신 내용에 "보안 계약 동일 유지" 한 문장 추가 |
| 5 | Cross-Spec | `kind='embedding'` ModelConfig `listModels` 결과에서 `ModelInfo.type='embedding'` 필터 흐름 명시 부재 | 변경 3 embedding-pipeline §5.2/§5.3 | 변경 3 에 "임베딩 모델 조회 소스가 `kind='embedding' ModelConfig.listModels()` 로 전환" 한 문장 추가 |
| 6 | Rationale Continuity | `spec/2-navigation/6-config.md R-3` 텍스트 전체 삭제·대체 확인 필요 (형식 요건은 충족) | 변경 2 Rationale 개정 (R-3 번복) | spec 반영 시 기존 R-3 텍스트 전체를 target 번복 근거 텍스트로 대체 (체크리스트 포함 권장) |
| 7 | Rationale Continuity | `spec/5-system/9-rag-search.md Rationale` "폐기한 대안" — 노드 단위 리랭크 설정 기각 항 유지 무방 | `spec/5-system/9-rag-search.md ## Rationale` | 해당 없음 (통합과 무관, 그대로 유지) |
| 8 | Convention Compliance | `spec/data-flow/6-knowledge-base.md` frontmatter 가드 면제 경로 여부 미확인 | 변경 3 `spec/data-flow/6-knowledge-base.md` 참조 | 구현 전 frontmatter 상태 확인; 면제 경로라면 draft 에 노트 추가 |
| 9 | Convention Compliance | `rerank_llm_config_id` 필드명에 `_llm_` 잔존 — 의미 오해 가능성 (호환성상 유지는 합리적) | 변경 1 §2.16.1 컬럼명 불변 선언 | Draft 에 "코드 JSDoc 에서 'chat kind FK' 명시 예정" 1줄 추가 (선택) |
| 10 | Naming Collision | 마이그레이션 번호 V088~V092 선점 충돌 가능성 (현시점 V087 이후 없음) | 변경 0 마이그레이션 보강 항목 | PR 착수 직전 `ls codebase/backend/migrations/ | sort | tail -5` 로 최신 버전 재확인 |
| 11 | Naming Collision | `model_config.dimension` (SoT) vs `knowledge_base.embedding_dimension` (파생 캐시) 관계 명시 필요 | 변경 3 8-embedding-pipeline.md §5.2/§5.3 | §5.2 갱신 시 "ModelConfig.dimension = 모델 고유 출력 차원(SoT), KB.embedding_dimension = 파생 캐시" 관계 1줄 명시 |
| 12 | Naming Collision | `model_config.kind` DB 컬럼 vs 기존 JSONB 필드 동명 — 스코프 다름, 실제 충돌 없음 | `model_config.kind` 컬럼 | 별도 조치 불요 |

---

## Plan Coherence

| Checker | 상태 | 비고 |
|---------|------|------|
| plan_coherence | **재시도 필요** | output 파일(`plan_coherence.md`) 없음 — 세션 디렉터리에서 파일 미생성 확인됨. 결과 반영 불가. |

---

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | MEDIUM | FK 타깃 텍스트 rename 미반영(§2.11/§2.20), alias 범위 미정의, kind→팩토리 dispatch 흐름 미기술, 감사 로그 액션명 전환 정책 누락 |
| Rationale Continuity | MEDIUM | 7-llm-client·9-rag-search·8-embedding-pipeline Rationale 대체 문안 미비 — 기존 전제 붕괴 후 근거 공백 위험 |
| Convention Compliance | HIGH | plan frontmatter 완전 누락(CRITICAL·build guard), 마이그레이션 번호 고정(race 위험), set-default 동사형 경로 |
| Plan Coherence | N/A (재시도 필요) | output 파일 미생성 |
| Naming Collision | MEDIUM | _layout.md 내비게이션 URL 갱신 누락, preview-models endpoint 이중 기술, ModelConfig vs ModelInfo 혼동 위험 격상 필요 |

---

## 권장 조치사항

1. **(BLOCK 해소 필수)** `plan/in-progress/spec-draft-unified-model-management.md` 최상단에 frontmatter YAML 블록(`worktree`, `started`, `owner`) 추가 — build guard 통과 전제.
2. **(WARNING 해소 — spec 반영 전)** 변경 3 갱신 목록 보강:
   - `spec/1-data-model.md §2.11` `rerank_llm_config_id`/`extraction_llm_config_id` FK 타깃 텍스트 `FK → ModelConfig (kind=chat)` 갱신
   - `spec/1-data-model.md §2.20` AssistantSession + llm_usage_log FK 타깃 텍스트 갱신
   - `spec/5-system/1-auth.md §4.1` 감사 로그 액션명 `llm_config.*`/`rerank_config.*` → `model_config.*` 전환 정책 명시 + append-only 보존
   - `spec/2-navigation/_layout.md` 항목 7 URL 처리 방향(변경 또는 불변) 명시
   - `spec/2-navigation/6-config.md §3 API 표` `preview-models` 행 갱신
3. **(WARNING 해소 — Rationale 대체 문안)** 변경 3 내 아래 3개 Rationale 갱신을 지시 1줄에서 구체 문안으로 확장:
   - `spec/5-system/7-llm-client.md ## Rationale` "별개 DB 테이블" 전제 → "API shape 차이" 근거로 교체
   - `spec/5-system/9-rag-search.md ## Rationale` 분리 이유 항 대체 문안 명문화
   - `spec/5-system/8-embedding-pipeline.md ## Rationale` `type='embedding'` → `kind='embedding'` 전환 근거 추가
4. **(WARNING 해소 — 마이그레이션)** Draft 내 V088~V092 고정 표기를 상대 표기 또는 "착수 시 §5 절차에 따라 재할당" 주의 문구로 교체.
5. **(WARNING — 격상 검토)** 변경 4 `ModelConfig` vs `ModelInfo` 혼동 위험을 INFO → WARNING 급으로 격상하고 §3.5 구분 주석 추가.
6. **(재시도 권장)** `plan_coherence` checker output 파일 미생성 — 해당 checker 단독 재실행 후 결과 통합 권장.