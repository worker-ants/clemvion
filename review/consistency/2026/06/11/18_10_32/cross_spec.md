# Cross-Spec 일관성 검토 결과

**대상**: `spec/2-navigation/6-config.md` (draft — ModelConfig 단일 화면 통합 + max_tokens 기본값 정정)
**검토일**: 2026-06-11

---

## 발견사항

### WARNING — RBAC 매트릭스: `LLM Config` / `Rerank Config` 행이 `Model Config` 로 미갱신
- **target 위치**: §3 Model Config API — "mutation (POST / PATCH / DELETE) 은 Editor+ ([Spec 인증 §3.2](../5-system/1-auth.md#32-리소스별-권한-매트릭스))"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` §3.2 리소스별 권한 매트릭스
- **상세**: target 은 `/api/model-configs` 단일 엔드포인트로 통합됐다고 선언하면서 권한 참조를 `§3.2` 로 위임하고 있다. 그런데 `1-auth.md §3.2` 매트릭스는 여전히 `LLM Config | CRUD | CRUD | R | R` 과 `Rerank Config | CRUD | CRUD | R | R` 두 행으로 분리된 채 `Model Config` 단일 행이 없다. target 이 말하는 "Editor+" 가드는 실질적으로 기존 두 행의 합집합과 동일하지만, 참조 링크(`#32-리소스별-권한-매트릭스`)가 올바른 항목을 가리키지 않아 구현자가 `1-auth.md` 만 읽으면 통합 여부를 알 수 없다.
- **제안**: `1-auth.md §3.2` 에서 `LLM Config` / `Rerank Config` 행을 `Model Config` 단일 행(`CRUD | CRUD | R | R`)으로 교체. `§4.1 감사 로그` 의 `llm_config.*` · `rerank_config.*` 슬러그도 `model_config.*` 로 병기 또는 대체.

### WARNING — 감사 로그 액션 슬러그: `llm_config.*` / `rerank_config.*` 가 `model_config.*` 로 미갱신
- **target 위치**: target 에 직접 언급 없음 (통합 완료 주장에 의해 함의)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` §4.1 기록 대상 액션 "설정" 행: `llm_config.*, rerank_config.* (create/update/delete/set-default; reveal 미제공 — RerankConfig 는 평문 reveal 엔드포인트 없음)`
- **상세**: target 의 R-3 (번복) 결정에 따르면 ModelConfig 는 단일 리소스이다. 그러나 `1-auth.md §4.1` 은 여전히 `llm_config.*` 와 `rerank_config.*` 를 별개 슬러그로 정의하고 있다. 감사 로그 기록 코드가 이 spec 을 따를 경우 실제 기록 슬러그와 단일 ModelConfig 리소스 간 불일치가 발생한다.
- **제안**: `1-auth.md §4.1` "설정" 행을 `model_config.* (create/update/delete/set-default; reveal 미제공)` 로 교체. `llm_config.*` / `rerank_config.*` 슬러그는 마이그레이션 과도기 alias 임을 명시하거나 삭제.

### WARNING — LLM Client §5.5: preview-models 엔드포인트 경로가 구 `/api/llm-configs/preview-models` 로 잔존
- **target 위치**: §3 Model Config API 표 — `POST /api/model-configs/preview-models`
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/7-llm-client.md` §5.5 "경로: `POST /api/llm-configs/preview-models`"
- **상세**: target draft 는 통합 엔드포인트 `POST /api/model-configs/preview-models` 를 canonical 로 선언하고 구 경로는 deprecation alias 로 PR4 에 제거한다고 명시한다. 반면 `7-llm-client.md §5.5` 는 여전히 `POST /api/llm-configs/preview-models` 를 본문에 기술하고, 같은 절에서 `GET /api/llm-configs/:id/models` 도 canonical 인 것처럼 서술한다. target 의 deprecation 선언과 `7-llm-client.md` 의 canonical 경로 기술이 충돌한다.
- **제안**: `7-llm-client.md §5.5` 의 경로를 `POST /api/model-configs/preview-models` (및 `GET /api/model-configs/:id/models`) 로 갱신하고, 구 경로는 "(alias, `unified-model-management` PR4 에서 제거 예정)" 주석으로 처리.

### WARNING — AI Agent spec: `maxTokens` 예시값 2048 (target R-5 에서 4096 정정 주장, 미반영)
- **target 위치**: §B.4 모델 파라미터 기본값 표 `max_tokens = 4096`, R-5 "AI Agent 노드 설정 패널 예시(`spec/4-nodes/3-ai/1-ai-agent.md`)의 `maxTokens` 예시값도 동일하게 4096 으로 동반 갱신"
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/4-nodes/3-ai/1-ai-agent.md` 라인 124 (`Max Tokens: [2048__]`), 라인 665 (`"maxTokens": 2048`)
- **상세**: target R-5 는 max_tokens 기본값을 4096 으로 정정하면서 `1-ai-agent.md` 의 예시값도 동반 갱신해야 한다고 명시하고 있다. 그러나 실제 `1-ai-agent.md` 는 여전히 `2048` 을 사용 중이다. target spec 이 동반 갱신을 "이미 완료된 것"처럼 서술하지만(`제안: ... 동일하게 4096 으로 동반 갱신해 spec 내부 정합을 유지한다`) 해당 파일은 변경되지 않았다. target 을 그대로 채택하면 `6-config.md §B.4 = 4096` vs `1-ai-agent.md 예시 = 2048` 의 내부 spec 불일치가 생긴다.
- **제안**: `1-ai-agent.md` 의 ASCII 다이어그램(라인 124)과 JSON 예시(라인 665)의 `maxTokens` 값을 `2048` 에서 `4096` 으로 갱신. target 이 선언한 "동반 갱신"이 실제 파일에도 반영되어야 R-5 주장이 완결된다.

### INFO — R-1 Rationale: 범위 설명이 구 화면명(`/llm-configs`)을 참조
- **target 위치**: R-1 "범위 한정" 항목 — "본 변경은 Config > Models (Chat 탭)의 `defaultModel` 필드에만 적용된다."
- **충돌 대상**: 없음 (단순 명명 잔재)
- **상세**: target R-1 의 범위 설명은 "Config > Models (Chat 탭)" 로 올바르게 통합 화면을 가리키고 있으나, 같은 파일 내 worktree 의 이전 커밋에서 유래한 `spec/2-navigation/6-config.md` R-1(라인 282)은 "본 변경은 `/llm-configs` 화면의 `defaultModel` 필드에만 적용된다" 는 구 화면명을 사용한다. draft 버전은 이미 수정됐으므로 실제 충돌은 없으나, 다른 spec 이 6-config.md 의 구 버전 R-1 을 인라인 인용할 경우 오염 가능성이 있다.
- **제안**: 동기화 권장 없음 — target draft 는 이미 올바른 표현을 사용. 다른 spec 에서 구 R-1 문구를 직접 인용하는 곳이 있으면 갱신.

### INFO — `spec/5-system/1-auth.md §3.2` 매트릭스에 `Model Config` 단일 행 부재로 인한 명명 비일관성
- **target 위치**: §3 Model Config API (전체)
- **충돌 대상**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` §3.2
- **상세**: target 은 `Model Config` 라는 단일 리소스 이름을 사용하나, `1-auth.md §3.2` 는 `LLM Config` 와 `Rerank Config` 를 별개 행으로 유지하고 있다. 이는 위 WARNING 과 동일 근원이지만, 리소스 이름 자체의 비일관성(단수 `Model Config` vs 복수 레거시 이름)도 별도 명명 문제로 존재한다.
- **제안**: `1-auth.md §3.2` 를 ModelConfig 통합에 맞게 갱신 시 자연스럽게 해소됨 (상기 WARNING 처리와 동일).

---

## 요약

target draft(`spec/2-navigation/6-config.md`)가 ModelConfig 단일 화면 통합(R-3 번복)과 max_tokens 기본값 4096 정정(R-5)을 선언하고 있으나, 해당 변경의 파급 효과가 두 개의 다른 spec 파일에 반영되지 않아 2개의 WARNING 충돌이 존재한다. `spec/5-system/1-auth.md §3.2·§4.1` 은 여전히 `LLM Config` / `Rerank Config` 를 분리 리소스로 기술하고 있어 RBAC 참조와 감사 로그 슬러그가 불일치하며, `spec/5-system/7-llm-client.md §5.5` 는 preview-models 경로를 구 `/api/llm-configs/preview-models` 로 유지하고 있어 canonical 엔드포인트가 이중 정의된다. `spec/4-nodes/3-ai/1-ai-agent.md` 는 R-5 에서 동반 갱신을 약속한 `maxTokens` 예시가 아직 `2048` 로 남아 있어 spec 내부 정합이 깨진다. 이 세 파일을 target 과 함께 동기 갱신해야 충돌이 해소된다.

---

## 위험도

MEDIUM
