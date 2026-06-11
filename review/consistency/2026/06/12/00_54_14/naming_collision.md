# 신규 식별자 충돌 검토 결과

검토 모드: --impl-done, scope=spec/5-system, diff-base=origin/main

---

## 발견사항

### [CRITICAL] `ragSources` 항목의 텍스트 필드명 충돌 — `"chunk"` vs `"content"`
- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §4.3` 출력 메타데이터 예시에서 `ragSources[]` 항목 필드로 `"chunk"` 를 사용
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/9-rag-search.md` §4.1 (ragSources 스키마 정의, 단일 SoT) 및 `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` 에서 동일 필드를 `"content"` 로 정의
- **상세**: `9-rag-search.md §4.1` 이 `ragSources` 배열의 구조를 canonical 정의하며 텍스트 필드를 `"content"` 로 명시한다. `1-ai-agent.md` 도 `"content"` 를 사용한다. `10-graph-rag.md §4.3` 은 동일한 `ragSources` 구조를 graph 모드 예시로 보여주면서 텍스트 필드를 `"chunk"` 로 다르게 표기했다. 두 spec 이 같은 JSON 필드를 다른 이름으로 보여주고 있어 구현 시 어느 이름을 써야 하는지 모호하다. 프론트엔드/백엔드가 각각 다른 spec 을 참조하면 런타임 파싱 오류 또는 References UI 의 텍스트 미표시가 발생한다.
- **제안**: `10-graph-rag.md §4.3` 의 예시를 `"chunk"` → `"content"` 로 수정해 `9-rag-search.md §4.1` 의 canonical 정의와 일치시킨다. `ragSources` 스키마의 단일 SoT 는 `9-rag-search.md §4.1` 이며 graph 모드 전용 확장 필드(`origin`, `graphTraversal`)는 그 문서에서 참조하는 `10-graph-rag.md §4.3` 로 교차 참조한다.

---

### [WARNING] `spec/2-navigation/5-knowledge-base.md` 의 WebSocket 이벤트 목록에 `document:graph_error` 포함
- **target 신규 식별자**: `spec/5-system/10-graph-rag.md §6` 에서 graph WebSocket 이벤트로 `document:graph_started / _progress / _completed / _retry / _failed` 5종을 정의하고, `document:graph_error` 는 dead-declared(emit 없음)로 명시
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md` 182행에서 이벤트 목록을 `document:graph_started / _progress / _completed / _error / _retry / _failed` 6종으로 열거(즉 `_error` 포함). `/Volumes/project/private/clemvion/spec/5-system/6-websocket-protocol.md` 723행도 `_error` 를 포함한 6종 목록을 나열
- **상세**: `10-graph-rag.md` 는 `document:graph_error` 를 dead-declared 로 선언하고 실제로 emit 하지 않는다고 못박았다. 그러나 `5-knowledge-base.md` 와 `6-websocket-protocol.md` 는 여전히 `_error` 를 유효 이벤트인 것처럼 열거하고 있다. 클라이언트 코드가 `5-knowledge-base.md` 를 참조해 `_error` 핸들러를 붙이면 실제로 발사되지 않는 이벤트를 기다리는 데드 코드가 생긴다. `data-flow/6-knowledge-base.md` 289행은 이미 `graph_error` 제거를 반영했으나 navigation·websocket spec 문서가 아직 동기화되지 않았다.
- **제안**: `spec/2-navigation/5-knowledge-base.md` 182행과 `spec/5-system/6-websocket-protocol.md` 723행에서 `_error` 를 목록에서 제거하거나 "(dead-declared, 미emit)" 주석을 달아 `10-graph-rag.md §6` 의 정의와 일치시킨다.

---

### [WARNING] `spec/5-system/1-auth.md` §5 API 표에 `POST /api/auth/resend-verification` 경로가 `/auth/` 와 `/api/auth/` 를 혼용
- **target 신규 식별자**: `spec/5-system/1-auth.md §1.1` 표에서 인증 메일 재발송 endpoint 를 `POST /auth/resend-verification` (prefix `/api/` 없음) 으로 기재
- **기존 사용처**: 동일 파일 §5 API 엔드포인트 표에서는 다른 모든 엔드포인트에 `/api/` prefix 를 사용(`POST /api/auth/register`, `POST /api/auth/login` 등). `spec/2-navigation/10-auth-flow.md` 139행, `spec/data-flow/2-auth.md` 228행에서도 `POST /api/auth/resend-verification` 으로 표기
- **상세**: `1-auth.md §1.1` 의 표 한 줄만 `/api/` 없이 작성되어 있어 일관성이 없다. 실제 구현 및 다른 spec 문서 모두 `/api/auth/resend-verification` 을 사용하므로 단순한 표기 오류로 보이지만, spec 을 최초 참조하는 독자에게 혼선을 줄 수 있다.
- **제안**: `1-auth.md §1.1` 표의 `POST /auth/resend-verification` → `POST /api/auth/resend-verification` 으로 수정해 §5 표 및 다른 문서와 통일.

---

### [INFO] `10-graph-rag.md §6` WebSocket 이벤트 채널 명칭 표기 불일치
- **target 신규 식별자**: `10-graph-rag.md §6` 주석에서 채널을 `kb:{documentId}` 로 표기
- **기존 사용처**: `spec/5-system/8-embedding-pipeline.md` §8 에서 채널을 `` `kb:${documentId}` `` (템플릿 리터럴 스타일) 로 표기. `spec/5-system/2-api-convention.md` 267행에서도 `document:embedding_*, document:graph_* (채널 kb:{documentId})` 표기 사용
- **상세**: 채널 이름 표기가 `kb:{documentId}` 와 `` `kb:${documentId}` `` 두 스타일로 혼용된다. 실제 채널 이름은 같으나, 백틱 없이 `$` 기호가 들어가면 표기 규약 불일치로 가독성에 영향을 준다. 단일 표기 스타일을 정하는 것이 바람직하다.
- **제안**: 채널 명세는 `kb:{documentId}` (plain placeholder 표기) 으로 통일하되, 모든 spec 문서에서 동일하게 사용한다. 템플릿 리터럴 스타일은 코드 예시 전용으로 제한한다.

---

## 요약

`spec/5-system` 내 세 개의 신규/현행 spec 문서(`1-auth.md`, `10-graph-rag.md`, `11-mcp-client.md`)에서 식별자 충돌을 검토했다. 가장 심각한 충돌은 **`ragSources` 배열 항목의 텍스트 필드명** 으로, `10-graph-rag.md §4.3` 이 `"chunk"` 를 사용하는 반면 canonical SoT 인 `9-rag-search.md §4.1` 과 `1-ai-agent.md` 는 `"content"` 를 사용한다. 이는 동일한 JSON 구조를 참조하는 프론트엔드·백엔드 코드가 서로 다른 필드명을 기대하게 만드는 CRITICAL 충돌이다. 그 외에 `document:graph_error` 이벤트가 일부 spec 문서에 여전히 유효 이벤트로 표기되어 있으나 실제로 emit 되지 않는 WARNING 이 있다. 환경변수·API endpoint·요구사항 ID·엔티티명 등 다른 식별자 범주에서는 새로 도입된 식별자(`WEBAUTHN_*`, `MCP_MAX_CONCURRENT_CONNECTIONS`, `KB-GR-*`, `NF-GR-*`, `auth_config.*`, `model_config.*` 감사 액션 등)가 기존 사용처와 다른 의미로 충돌하는 사례는 발견되지 않았다.

## 위험도

MEDIUM
