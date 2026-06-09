# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)
Target: `spec/5-system` (KB 검색 불가 신호화 변경 — `9-rag-search.md`, `8-embedding-pipeline.md` 및 연관 `spec/2-navigation/5-knowledge-base.md`)
Diff base: origin/main

---

## 발견사항

### INFO: `skipReason` 필드 용어 공간 분리 — 명시는 됐으나 AI Agent spec 미동기화
- target 위치: `spec/5-system/9-rag-search.md §4.2` — `skipReason` 열거에 `kb_unsearchable` 추가
- 충돌 대상: `spec/4-nodes/3-ai/1-ai-agent.md §9.1` 표 row  
  ```
  | meta.ragDiagnostics | … skipReason? …  
  — 스키마는 [RAG 검색 §4.2] 참조
  ```
- 상세: `1-ai-agent.md` 는 `skipReason` 존재를 언급하되 가능 값을 직접 열거하지 않고 §4.2 를 링크로 위임한다. 링크 참조 구조상 target 갱신(9-rag-search §4.2)만으로 소비자가 올바른 정의에 도달한다. 직접 모순은 없다. 단, `1-ai-agent.md §9.1` 의 `skipReason?` 주석이 구버전 값(`empty_kb_list`/`no_results`)을 inline 예시로 들고 있다면 최신화가 필요하나, 현재 텍스트는 단순히 "스키마는 §4.2 참조"만 있어 모순이 없다.
- 제안: 동기화 필요 없음 (링크 위임으로 충분). 다만 `1-ai-agent.md §9.1` 에 `kb_unsearchable` 예시를 추가하면 가독성 향상.

### INFO: `skipReason` 단어 공간 — MCP `skipReason` 와 RAG `skipReason` 는 별개 네임스페이스
- target 위치: `spec/5-system/9-rag-search.md §4.2` — `skipReason: 'kb_unsearchable'`
- 충돌 대상: `spec/5-system/11-mcp-client.md §6.2` — `serverSummaries[].skipReason` (`expired_install_timeout` 등 `lower_snake_case`)
- 상세: `ragDiagnostics.skipReason` (RAG 진단, 9-rag-search §4.2)와 `mcpDiagnostics.serverSummaries[].skipReason` (MCP 진단, 11-mcp-client §6.2)는 JSON 경로가 다른 별개 필드다. 두 필드 모두 `lower_snake_case` 값을 사용하며 의미 공간이 완전히 분리되어 있다. 9-rag-search §4.2 는 새 값 `kb_unsearchable` 을 RAG 진단 전용으로 추가하고 있으며 MCP 필드에는 영향 없다.
  - MCP `skipReason` 어휘: `expired_install_timeout`, `expired_refresh_failed`, `expired_no_refresh_token`, `error`, `pending_install`, `lookup_failed`, `not_capable`
  - RAG `skipReason` 어휘: `empty_kb_list`, `kb_unsearchable`, `no_results`
  - 의미 중복·충돌 없음.
- 제안: 충돌 없음. 주석 추가가 필요하다면 9-rag-search §4.2 에 "이 `skipReason` 은 RAG 진단 전용, MCP §6.2 와 네임스페이스 분리" 한 줄 추가 가능하나 강제 아님.

### INFO: tool_result content 봉투 `status` 키 — 기존 봉투 패턴과의 정합
- target 위치: `spec/5-system/9-rag-search.md §2.2` — `status: "not_searchable"` 신규 봉투
- 충돌 대상: `spec/5-system/9-rag-search.md §2.1` 기존 봉투(`error: "search_failed"`, `grounding: "none"`)
- 상세: 기존 봉투는 `error` 키(§2.1 첫 번째 형태)와 `grounding` 키(§2.1 두 번째 형태)를 판별 키로 사용한다. 신규 봉투는 `status` 키를 판별 키로 추가한다. §2.2 본문에 명시된 판별 우선순위(`error` → `status` → `grounding` → 정상 `results`)는 세 형태를 일관되게 정의하며, 한 tool_result content 에 판별 키가 하나만 존재한다는 규칙도 명시되어 있다. 이는 기존 봉투 구조와 상충하지 않는다.
- 제안: 충돌 없음. 기존 §2.1 봉투 형태와의 판별 우선순위가 target 본문에 이미 명시됨.

### INFO: `8-embedding-pipeline.md §7.3` 서술 확장 — 기존 "in_progress KB 자연 제외" → "명시 신호"로 갱신
- target 위치: `spec/5-system/8-embedding-pipeline.md §7.3` — "제외는 silent 가 아니라 명시 신호로 전달"
- 충돌 대상: `spec/5-system/8-embedding-pipeline.md §7.3` 구버전 서술("in_progress KB 는 자연스럽게 검색 제외")
- 상세: target 은 구버전 "자연스럽게 검색 제외" 서술을 "명시 신호(`status:"not_searchable"` + `skipReason="kb_unsearchable"`)로 전달" 로 갱신했다. 이는 동일 파일 내의 자기일관성 갱신이며, RAG 검색 spec 과의 외부 충돌이 아니다. 두 spec 간 교차 참조 링크도 양방향으로 추가되어 있다.
- 제안: 충돌 없음.

### INFO: `spec/2-navigation/5-knowledge-base.md §2.2.1` 목록 카드 경고 — RBAC / 권한 관점 충돌 없음
- target 위치: `spec/2-navigation/5-knowledge-base.md §2.2.1` 신규 경고 배지
- 충돌 대상: `spec/5-system/1-auth.md §3.2` RBAC 권한 매트릭스 (Knowledge Base: CRUD for Owner/Admin/Editor, R for Viewer)
- 상세: 신규 경고 배지는 KB 목록 **조회** 화면의 시각 요소다. KB 목록 조회는 Viewer 포함 모든 역할에 허용되어 있으며(Read 권한), 경고 배지 표시는 읽기 전용 UI 패턴으로 별도 권한이 필요하지 않다. `embeddingDimension`·`reembedStatus` 필드는 이미 KB 목록 API 응답에 포함되어 있다(기존 필드, 신규 컬럼 아님).
- 제안: 충돌 없음.

### INFO: `data-model §2.11 KnowledgeBase` — `reembed_status` 필드 기존 정의와 일치
- target 위치: `spec/5-system/9-rag-search.md §3.1` — `reembedStatus` 를 `KbRow` 에 추가 조회
- 충돌 대상: `spec/1-data-model.md §2.11` — `reembed_status Enum: idle / in_progress`
- 상세: target 코드/spec 이 사용하는 `reembed_status='idle'|'in_progress'` 값은 data-model §2.11 에 이미 정의된 Enum과 완전히 일치한다. 신규 컬럼이 아닌 기존 컬럼을 읽기에만 사용하는 것이므로 충돌 없음.
- 제안: 충돌 없음.

---

## 요약

`spec/5-system` 의 KB 검색 불가 신호화 변경(9-rag-search §2.2/§3.1/§4.2/§6, 8-embedding-pipeline §7.3)은 기존 spec 영역과 직접적인 모순이 없다. 신규 `status:"not_searchable"` 봉투는 기존 `error`/`grounding` 봉투와 판별 키가 다르고 우선순위 규칙이 target 본문에 명시되어 있다. `skipReason='kb_unsearchable'` 는 MCP 진단의 동명 필드와 JSON 경로가 달라 네임스페이스 충돌이 없다. `reembed_status` 필드 사용은 data-model §2.11 기존 정의에 부합하며, `1-ai-agent.md` 는 `skipReason` 어휘를 인라인 열거하지 않고 §4.2 링크로 위임하므로 스키마 동기화 충돌이 없다. `spec/2-navigation/5-knowledge-base.md` 경고 배지 추가도 기존 RBAC 매트릭스와 충돌하지 않는다. 발견사항 전체가 INFO 등급으로, 채택을 차단하는 CRITICAL·WARNING 항목이 없다.

## 위험도

NONE

---

STATUS: SUCCESS
