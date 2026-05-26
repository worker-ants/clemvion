# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-prep`  
대상: `spec/2-navigation/` (plan: `llm-model-select-only.md`)  
검토일: 2026-05-26

---

## 발견사항

### [WARNING] `spec/2-navigation/6-config.md §B.2 Fallback` vs `spec/5-system/7-llm-client.md §5.5` — select-only 전환 후 조회 실패 시 동작 불일치

- **target 위치**: `spec/2-navigation/6-config.md §B.2 기본 모델 선택 UX` "Fallback" bullet (현재 "목록에 없는 모델 ID를 직접 타이핑할 수 있으며, 조회 실패 시에도 자유 입력이 가능하다")
- **충돌 대상**: `spec/5-system/7-llm-client.md §5.5` — preview-models 엔드포인트 에러 처리 "30초 timeout 및 @Throttle(10/60s) Rate limit 적용", §6 에러 코드 `LLM_MODEL_LIST_FAILED` 정의
- **상세**: plan(`llm-model-select-only.md`)은 "Fallback bullet 삭제. 조회 실패 시 입력 자체 불가, error 메시지만 표시"로 명시하고 있다. 그러나 `spec/5-system/7-llm-client.md §5.5`는 조회 실패 경로를 `400 LLM_MODEL_LIST_FAILED`로 정의하며, 에러 발생 시 UI 가 어떻게 처리해야 하는지(사용자 입력 허용 vs 차단)는 UI spec(`6-config.md`)이 결정해야 하는 역할분리가 있다. plan 이 `6-config.md`에 새 Rationale 섹션을 추가하면서 "조회 실패 시 자유 입력 불가"를 명시할 예정인데, `7-llm-client.md §5.5`의 본문에는 이 제약이 반영되지 않아 "조회 실패 = 입력 허용(graceful degrade)"이라는 임플리케이션이 남아 있다(현재 `EmbeddingModelCombobox` 주석에도 "응답 실패 시에는 일반 텍스트 입력으로 graceful degrade"라 명시됨). spec 간 동작 기대치가 달라진다.
- **제안**: `spec/5-system/7-llm-client.md §5.5` 에서 "반환값은 저장된 설정용 … `ModelInfo[]`" 이후에 **UI 처리 계약**("조회 실패 시 select 비활성화 + 에러 메시지 표시 — `spec/2-navigation/6-config.md §B.2` 및 `5-knowledge-base.md §2.2` 참조")을 한 줄 추가한다. 또는 plan 의 `6-config.md` Rationale 에 `7-llm-client.md §5.5` 를 cross-reference 로 명시.

---

### [WARNING] AI Agent `config.model` "Expression 가능" vs LLM Config 화면 select-only 전환 범위 모호성

- **target 위치**: `spec/2-navigation/6-config.md §B.2` (LLM Config 관리 화면의 기본 모델 선택)
- **충돌 대상**: `spec/4-nodes/3-ai/1-ai-agent.md §1 설정` — `model | String (Expression 가능) | | — | 모델 ID (프로바이더별). {{ }} 템플릿 허용`
- **상세**: plan 은 `ModelCombobox` 컴포넌트(LLM Config 관리 화면)를 select-only 로 전환한다. 노드 설정 패널(`LlmConfigSelector`)은 이미 `<select>` 를 사용하고 있어 영향 없다. 그러나 `1-ai-agent.md`는 `model` 필드에 `{{ }}` Expression 을 허용한다 — 이는 노드 설정 패널에서 사용자가 모델 ID 를 표현식으로 동적 지정할 수 있음을 의미한다. plan 의 select-only 전환은 `6-config.md`(LLM Config 관리 페이지의 defaultModel 설정)에만 적용되는데, `0-common.md §1`이 "설정 UI는 LLM Provider 드롭다운 → Model 드롭다운 패턴을 공유한다"라고 기술하고 있어 노드 설정 패널의 model 필드도 select-only 인지 Expression 입력을 허용하는지 범위가 불명확하다.
- **제안**: `spec/2-navigation/6-config.md`의 변경 Rationale 에 "본 select-only 전환은 LLM Config 관리 화면(`/llm-configs`)의 `defaultModel` 필드에 한정하며, AI 노드 설정 패널의 `model` 필드(Expression 허용)에는 적용되지 않음"을 명시한다. 또는 `4-nodes/3-ai/0-common.md §1` 을 동기화해 "설정 UI 는 LLM Provider 드롭다운 → Model 드롭다운 (또는 Expression 입력)" 구분을 명확히 한다.

---

### [WARNING] `spec/2-navigation/5-knowledge-base.md §2.2` 임베딩 모델 — 기존 코드 주석 "graceful degrade" vs select-only 정책 충돌

- **target 위치**: `spec/2-navigation/5-knowledge-base.md §2.2 컬렉션 생성` "임베딩 모델" 행 (plan 변경 대상)
- **충돌 대상**: `codebase/frontend/src/components/knowledge-base/embedding-model-combobox.tsx` 주석 "Provider 가 embedding 모델을 노출하지 못하거나(예: 일부 custom provider) 응답 실패 시에는 일반 텍스트 입력으로 graceful degrade" — 현행 코드 동작과 `spec/5-system/7-llm-client.md §5.4 Local` 사용 패턴
- **상세**: plan 은 `EmbeddingModelCombobox` 를 select-only 로 전환하고 "조회 실패 시 입력 자체 불가"로 바꾼다. 그런데 Local(Ollama/vLLM) 프로바이더는 사설망 Ollama 에서 모델 목록을 가져오는데, 로컬 환경에서 Ollama 가 미기동이거나 API 응답이 없으면 목록 조회가 실패한다. `7-llm-client.md §5.4` 는 이 경우를 명시적으로 처리하지 않는다. select-only 로 전환하면 Local 프로바이더 사용자가 Ollama 서버를 잠시 내렸다 올린 직후 KB 생성이 블로킹될 수 있다 — graceful degrade 제거의 영향이 Local 프로바이더에서 특히 크다.
- **제안**: `spec/2-navigation/5-knowledge-base.md §2.2` 의 Rationale 에 "Local 프로바이더 조회 실패 시 동작(select 비활성 + 재시도 버튼 표시 vs 자유 입력 허용)" 을 명시적으로 결정해 기록한다. `spec/5-system/7-llm-client.md §5.4` 에 관련 UX 처리를 cross-reference 하거나, Local 프로바이더의 예외 정책(`모델 목록 조회 실패 시에도 자유 입력 허용 — select-only 의 예외`)을 Rationale 로 남긴다.

---

### [INFO] `spec/2-navigation/6-config.md §B.2` "기본 모델" 표 행 설명 vs `spec/5-system/7-llm-client.md §3.5 ModelInfo` `type` 필터 규칙 동기화

- **target 위치**: `spec/2-navigation/6-config.md §B.2` "목록 필터: 응답 중 `type === 'chat'` 모델만 노출한다 (임베딩 모델은 제외)"
- **충돌 대상**: `spec/5-system/7-llm-client.md §3.5` — `ModelInfo.type: 'chat' | 'embedding'`
- **상세**: 충돌 없음. 현재 `6-config.md`의 `type === 'chat'` 필터 명시가 `7-llm-client.md §3.5`의 `ModelInfo.type` 정의와 일치한다. 다만 plan 이 "목록 필터" bullet 을 유지하는지, 삭제하는지 명확하지 않다. "목록에 없는 모델 ID를 직접 타이핑" Fallback bullet 만 삭제되고 필터 규칙 bullet 은 유지되어야 일관성이 보장된다.
- **제안**: plan 의 spec 변경 기술에서 삭제 대상 bullet 을 명확히 한다. `type === 'chat'` 필터 bullet 은 반드시 보존.

---

### [INFO] `spec/2-navigation/5-knowledge-base.md §2.2` 임베딩 모델 — `GET /api/llm-configs/:id/models` API 와 `EmbeddingModelCombobox` 의 자동 fetch vs "모델 불러오기 버튼 신설" 결정 명시 필요

- **target 위치**: plan `llm-model-select-only.md §2 구현` — "임베딩 combobox: 모델 불러오기 버튼 신설 (현재는 페이지 로드 시 자동 fetch 만)"
- **충돌 대상**: `spec/2-navigation/5-knowledge-base.md §2.2` 현행 "임베딩 모델" 행에는 자동 fetch vs 버튼 트리거 동작이 기술되어 있지 않음. `spec/2-navigation/6-config.md §B.2`의 "모델 불러오기" 버튼 설명과 동작이 달라진다(KB 쪽은 현재 자동, Config 쪽은 버튼 트리거).
- **상세**: 두 화면의 UX 정책이 달라지는데 spec 에 해당 결정이 명시되지 않으면 향후 구현자가 혼동할 수 있다. Config 화면은 API Key 입력 → 버튼 클릭 흐름이 필요하지만(미저장 자격증명 사용), KB 화면은 이미 저장된 LLMConfig 에서 가져오므로 자동 fetch 가 더 자연스럽다.
- **제안**: `spec/2-navigation/5-knowledge-base.md §2.2` 임베딩 모델 행에 "LLMConfig 선택 변경 시 자동으로 임베딩 모델 목록 재조회(또는 버튼 트리거)" 동작 정책을 명시한다.

---

## 요약

`spec/2-navigation/` 영역 자체(대시보드·워크플로우 목록·트리거·인증·실행 내역 등)는 plan 의 변경 범위(`6-config.md §B.2`, `5-knowledge-base.md §2.2`)와 직접 충돌하지 않으며, 요구사항 ID 중복·상태 전이 모순·RBAC 충돌·계층 책임 충돌도 발견되지 않았다. 주요 위험은 plan 이 LLM Config 관리 화면에서 select-only 로 전환하면서 (a) 조회 실패 시 동작 기대치가 `7-llm-client.md §5.5` 및 기존 코드 주석("graceful degrade")과 어긋나는 점, (b) AI 노드 `model` 필드의 Expression 가능 여부와의 범위 모호성, (c) Local 프로바이더 사용자의 Ollama 미기동 시 KB 생성 블로킹 시나리오가 spec 에서 미결정 상태라는 점이다. 세 항목 모두 `6-config.md`와 `5-knowledge-base.md`의 Rationale 섹션에 결정을 명시하는 것으로 해소 가능하며, 별도 spec 개정 없이 plan 내 Rationale 기술로 충분하다.

---

## 위험도

MEDIUM
