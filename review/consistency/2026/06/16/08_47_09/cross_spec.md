# Cross-Spec 일관성 검토 결과

**Target**: `spec/2-navigation/6-config.md`
**검토일**: 2026-06-16
**모드**: spec draft 검토 (--spec)

---

## 발견사항

### 1. **[WARNING]** `RERANK_CONFIG_INVALID` 에러 코드 레이어 불일치
- **target 위치**: §B.6.2 Base URL 필드 설명 ("사설망/loopback baseUrl 은 SSRF 가드로 400 `RERANK_CONFIG_INVALID`"), R-4 rationale 동일 언급
- **충돌 대상**: `spec/5-system/9-rag-search.md §6` — "에러 레이어 구분: `RERANK_CONFIG_INVALID` 은 검색 실행(rerank 호출) 레이어 전용 에러이고, `MODEL_CONFIG_INVALID` / `MODEL_CONFIG_NOT_FOUND` 은 설정 CRUD(`/api/model-configs`) 레이어 전용이다."
- **상세**: target 은 `RERANK_CONFIG_INVALID` 를 rerank ModelConfig 를 저장(create/update)할 때 SSRF 가드가 발동하는 400 에러로 사용한다. 그러나 RAG 검색 spec §6 은 이 코드를 검색 실행(rerank 호출) 레이어 전용으로 명시하고, 설정 CRUD 레이어는 `MODEL_CONFIG_INVALID` 를 쓴다고 명확히 경계를 그어 놓았다. `spec/5-system/7-llm-client.md §5.5·§6` 도 SSRF 차단에 `MODEL_CONFIG_INVALID` 를 사용한다. SSRF guard 응답에 `RERANK_CONFIG_INVALID` 를 쓰면 두 레이어의 에러 코드 경계가 교차 오염된다.
- **제안**: target §B.6.2 표와 R-4 의 SSRF 에러 코드를 `MODEL_CONFIG_INVALID` 로 정정한다. `RERANK_CONFIG_INVALID` 는 런타임 검색 경로 전용(rerank endpoint 호출 실패, 미구성/미지원 provider)으로 유지한다.

---

### 2. **[WARNING]** SSRF 예외 provider 표현 불일치 — §B.6.2 표 vs R-4
- **target 위치**: §B.6.2 Base URL 필드 표 ("`tei` 외 provider 의 사설망/loopback baseUrl 은 SSRF 가드로 400") vs R-4 rationale ("`tei`/local 만 예외")
- **충돌 대상**: target 문서 내부 불일치 (동일 파일 두 위치 간); `spec/5-system/7-llm-client.md §2.1` — rerank `local` provider 를 2026-06-05 결정으로 Dropped 로 확정
- **상세**: §B.6.2 표는 `tei` 만 예외로 읽히고, R-4 는 `tei`/`local` 둘 다 예외로 읽힌다. `local` rerank provider 는 2026-06-05 결정으로 drop 됐으므로 R-4 의 `local` 언급은 낡은 잔재다. 일관된 표현은 "`tei` 만 예외" 여야 한다.
- **제안**: R-4 에서 "`tei`/local 만 예외" → "`tei` 만 예외" 로 수정해 §B.6.2 표 및 `spec/5-system/7-llm-client.md §2.1` 의 local drop 결정과 일치시킨다.

---

### 3. **[INFO]** `spec/1-data-model.md §2.16` ModelConfig `provider` 컬럼 rerank Planned 표기 미갱신
- **target 위치**: target(`6-config.md`)이 rerank provider 를 `tei`/`cohere` 로 명시해 `7-llm-client.md §2.1` 과 정합하므로 target 자체는 올바르다.
- **충돌 대상**: `spec/1-data-model.md §2.16` — `provider` 컬럼 설명에 "rerank Planned(후속): `jina` / `voyage` / `local` / `builtin`" 표기 잔존. `spec/5-system/7-llm-client.md §2.1` 은 이 확장을 "Dropped (2026-06-05 결정)"으로 현행화했으나 데이터 모델이 미동기화 상태다.
- **상세**: target 자체의 버그는 아니지만, 데이터 모델 spec 을 읽는 독자가 jina/voyage/local/builtin 이 아직 Planned 상태라고 혼동할 수 있다.
- **제안**: `spec/1-data-model.md §2.16` 의 `provider` 컬럼 rerank Planned 표기를 "Dropped (2026-06-05, `7-llm-client.md §2.1` 참조)" 또는 단순 삭제로 갱신한다. target 은 수정 불필요.

---

### 4. **[INFO]** Model Config API `set-default` 엔드포인트 권한 명시 누락
- **target 위치**: §3 Model Config API 표 — `PATCH /api/model-configs/:id/set-default` 행에 권한 표기 없음
- **충돌 대상**: `spec/5-system/1-auth.md §3.2` — "Model Config | CRUD | CRUD | CRUD | R" (Owner/Admin/Editor = CRUD, Viewer = R)
- **상세**: target §3 도입부에 "mutation (POST / PATCH / DELETE) 은 Editor+" 를 명시했으나 개별 엔드포인트 표에서 `set-default` 만 권한 레이블이 없다. Authentication API 표의 각 mutation 행에 `**(Admin+)**` 를 명시한 패턴과 불일치하며, 독자가 `set-default` 의 권한 요건을 별도로 추론해야 한다. 실제 충돌은 없다.
- **제안**: target §3 Model Config API 표의 `PATCH /api/model-configs/:id/set-default` 행에 `**(Editor+)**` 표시를 추가한다. `1-auth.md` 는 수정 불필요.

---

## 요약

`spec/2-navigation/6-config.md`(target)는 `spec/5-system/1-auth.md §3.2`(RBAC), `spec/1-data-model.md §2.16–2.17`(데이터 모델), `spec/5-system/7-llm-client.md`(LLM Client), `spec/5-system/9-rag-search.md`(RAG 검색) 과 대체로 일관성 있게 기술되어 있다. 단 두 가지 WARNING 이 발견됐다. 첫째, rerank config 저장 경로의 SSRF guard 에서 `RERANK_CONFIG_INVALID` 를 사용하는데 이 코드는 RAG 검색 spec §6 이 검색 실행 레이어 전용으로 정의했으며 설정 CRUD 레이어는 `MODEL_CONFIG_INVALID` 를 써야 한다. 둘째, target 내부 R-4 의 "`tei`/local 만 예외" 표현이 §B.6.2 표("tei 만")와 불일치하고 `local` rerank provider 는 2026-06-05 결정으로 Dropped 됐으므로 R-4 를 수정해야 한다. INFO 항목으로는 `spec/1-data-model.md §2.16` 의 rerank Planned 표기가 `7-llm-client.md §2.1` 의 Dropped 결정과 동기화되지 않았음(target 수정 불필요)과 `set-default` 엔드포인트 권한 명시 누락이 있다.

---

## 위험도

MEDIUM
