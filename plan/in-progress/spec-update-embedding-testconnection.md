---
worktree: fix-embedding-test-dimension-a3d42a
started: 2026-06-11
owner: resolution-applier
spec_impact:
  - spec/2-navigation/6-config.md
  - spec/5-system/7-llm-client.md
  - spec/1-data-model.md
---
# Spec Update Draft — embedding testConnection dimension + kind-agnostic design + frontend UX

## 분류
SPEC-DRIFT (코드 개선을 spec 에 반영) — PR #541 후속 회귀 수정(브랜치 `claude/fix-embedding-test-dimension`)이 3가지 영역에서 spec 을 앞서나가 있다. 코드가 SoT 이고 spec 이 따라온다.

## 핵심 구분 (consistency-check Critical 해소)

본 변경의 자동 저장 대상은 **`ModelConfig.dimension`**(모델 출력 차원 SoT)이다. 이는 KB 영역의
**`KnowledgeBase.embedding_dimension`**(파생 캐시)과 **다른 필드**이며 서로 상보 관계다:

| 트리거 | 엔드포인트 | 대상 필드 | 쓰기 여부 |
|--------|-----------|----------|-----------|
| Models 화면 "연결 테스트" (본 변경) | `POST /api/model-configs/{id}/test` | `ModelConfig.dimension` (모델 출력 차원 SoT) | **자동 저장** (probe embed 감지값) |
| KB 폼 "임베딩 테스트" (기존, 불변) | `POST /api/knowledge-bases/embedding-probe` | `KnowledgeBase.embedding_dimension` (파생 캐시) | **저장 안 함** (read-only 인라인 표시) |

`KnowledgeBase.embedding_dimension` 은 종전대로 실제 적재 경로(`EmbeddingService`)만 race-free 하게 채운다
([5-knowledge-base 생성 폼](../../spec/2-navigation/5-knowledge-base.md), [9-rag-search §5·Rationale "왜 probe 차원을 미리 저장하지 않나"](../../spec/5-system/9-rag-search.md)). 두 probe 는 대상 필드가 달라 충돌하지 않는다.

## 레이어 구분 (consistency-check Warning 해소)

- `LLMClient.testConnection(): Promise<boolean>` **인터페이스는 불변**(7-llm-client §3.1). StubLlmClient 계약도 불변.
- 서비스 레이어 `LlmService.testConnection(configId, workspaceId)` 가 kind 에 따라:
  - `chat`: `client.testConnection()` 호출 → `{ success: true }`
  - `embedding`: `client.embed(['connection test'], defaultModel)` 호출 → 반환 배열 첫 요소 길이(`vectors[0].length`)를 `dimension` 으로 추출 → `{ success: true, dimension? }` (벡터 길이 0 이면 omit)
- 설정 조회는 `ModelConfigService.findEntity(configId, workspaceId)`(kind 무관)를 사용한다. 구 `LlmConfigService.findEntity`(chat 고정)를 거치지 않는다. 이는 embedding 설정이 조회되지 않아 연결 테스트·모델 로드가 실패하던 회귀를 해소한 의도적 결정이다. 모듈 의존은 `LlmModule → ModelConfigModule`(상호 forwardRef). 순환 의존 정리는 백로그 `plan/in-progress/unified-model-management.md §7 W4`.
- `rerank` 는 표준 model-list/test API 부재로 **연결 테스트 미제공**(§B.6.2). 본 probe 표는 제공 kind(chat/embedding)만 기술한다.

---

## 제안 변경

### 1. `spec/5-system/7-llm-client.md` — §8.3 서비스 레이어에 testConnection probe 전략 추가

§8.3("서비스 레이어")에 다음을 추가(인터페이스 §3.1 은 불변 유지):

```
**LlmService.testConnection(configId, workspaceId)** — 저장된 설정으로 연결을 검증한다.
설정 조회는 `ModelConfigService.findEntity`(kind 무관)로 한다(구 chat 고정 경로 대체).
kind 별 probe 전략:

| kind | probe | 반환 |
|------|-------|------|
| chat | `client.testConnection()` (모델 목록 조회 등 경량 호출) | `{ success: true }` |
| embedding | `client.embed(['connection test'], defaultModel)` — 실제 embed 로 연결·모델 유효성 동시 검증 | `{ success: true, dimension? }` — `vectors[0].length` 를 dimension 으로 포함(0 이면 omit) |

`LLMClient.testConnection(): Promise<boolean>` 인터페이스(§3.1)는 변경하지 않는다 —
dimension 추출은 서비스 레이어 전용이며 `EmbedResponse`(§3.3 Planned) 트랙과 독립적이다.
```

`§8.3` 의 기존 "기존 chat / testConnection / resolveConfig 유지" 문구는 위 추가와 정합하도록 "testConnection 은 서비스 레이어에서 kind 별 probe 분기(아래)" 로 보강.

### 2. `spec/5-system/7-llm-client.md` — `## Rationale` 항목 추가

```
**testConnection dimension 추출이 EmbedResponse(Planned)와 독립인 이유**:
§3.3 의 `EmbedResponse`(usage/dimensions 메타데이터 반환)는 여전히 Planned 다. 그러나
연결 테스트의 dimension 은 서비스 레이어가 평범한 `embed()` 반환 벡터의 길이에서 추출하므로
`LLMClient.embed`/`testConnection` 인터페이스를 바꾸지 않는다 — 두 트랙은 독립이다.

**kind-agnostic 설정 조회 채택**: `LlmService.testConnection`/`listModels` 는
`ModelConfigService.findEntity`(kind 무관)를 직접 쓴다. 구 `LlmConfigService.findEntity`
(chat 고정)는 embedding/rerank 설정을 `MODEL_CONFIG_NOT_FOUND` 로 거부해 통합 Models 관리
UI 의 연결 테스트·모델 로드를 깨뜨렸다(PR #541 회귀). forwardRef 순환 의존 정리는 W4 백로그.
```

### 3. `spec/2-navigation/6-config.md §B.3` — chat/embedding 분기 명시

현행 §B.3(chat 위주 경량 호출만 기술)에 embedding 분기를 추가. 기존 chat 설명(경량 API 호출 → Connected/에러 표시)은 보존:

```
- "**Test Connection**" 버튼
- chat: 간단한 API 호출(모델 목록 조회 등)로 연결 확인
- embedding: 실제 probe embed(`client.embed(['connection test'], defaultModel)`)로 연결·모델
  유효성을 동시 검증하고, 반환 벡터 길이를 `dimension` 으로 감지한다(LLM Client §8.3).
- 성공: "Connected" 표시 (embedding 은 감지 차원도 함께 안내)
- 실패: 에러 메시지 표시 (인증 실패, 네트워크 오류 등)

embedding 연결 테스트가 차원을 감지하면, 그 값을 `PATCH /api/model-configs/:id { dimension }`
로 즉시 자동 저장한다(기존 `ModelConfig.dimension` 과 다를 때만). 자동 저장이 실패(권한 등)해도
연결 성공 표시는 유지한다(best-effort). 저장 대상은 `ModelConfig.dimension`(모델 출력 차원 SoT)이며,
KB 의 `KnowledgeBase.embedding_dimension`(파생 캐시)에는 쓰지 않는다 — 그쪽은 적재 경로가 채운다
(KB 폼 "임베딩 테스트"의 read-only probe 와 구분, [9-rag-search §5](../5-system/9-rag-search.md#5-임베딩-모델-일관성)).
```

### 4. `spec/2-navigation/6-config.md §B.5` — 차원(dimension) 행 전면 교체

현행 §B.5 표의 `차원(dimension)` 행 **한 줄을 아래로 대체**(나머지 §B.5 행·가드는 불변):

```
| 차원(dimension) | 임베딩 모델의 벡터 차원. **연결 테스트(probe embed)로 자동 감지·저장**된다(§B.3). 저장된 값이 있으면 폼에서 read-only 로 표시하고, 아직 감지 전(신규 생성·미테스트)에는 수동 입력 폴백을 허용한다(코드 SoT: read-only ⇔ `editConfig.dimension != null`). **ModelConfig.dimension = SoT** — KB 가 이 모델로 임베딩하면 `KnowledgeBase.embedding_dimension`(파생 캐시)에 고정된다 |
```

### 5. `spec/2-navigation/6-config.md §3 API 표` — test 엔드포인트 응답 shape 주석

L283 행 설명을 보강:

```
| POST | /api/model-configs/:id/test | 연결 테스트 (chat/embedding 만 — rerank 미제공). 응답: chat `{ success }`, embedding `{ success, dimension? }`(probe embed 감지 차원). 설정 조회는 kind 무관(`ModelConfigService.findEntity`) |
```

### 6. `spec/1-data-model.md §2.16 ModelConfig.dimension` — 자동감지 주석 (INFO)

`dimension` 필드 설명에 1줄 주석 추가:

```
(embedding 연결 테스트 성공 시 probe embed 로 자동 감지·자동 저장 가능 — 상세 [Config §B.3](./2-navigation/6-config.md))
```

---

## 우선순위 및 연동

- **PR #545(`unified-model-mgmt-pr4`)가 `spec/2-navigation/6-config.md`·`spec/1-data-model.md` 동시 편집 중** — 본 변경이 §B.3·§B.5·§3 표(6-config) + §2.16(1-data-model)을 건드리므로 conflict 가능. PR #545 와 base 정렬 후 반영 권고.
- `plan/in-progress/unified-model-management.md §7 W4`(forwardRef 순환 의존 정리) 백로그와 연동.
- spec 본문 반영 시 W4 백로그는 마크다운 링크가 아닌 백틱 인라인 텍스트로 유지(spec-link-integrity 가드 회피).
- API path parameter 는 OpenAPI 스타일 `{id}` 표기(swagger 규약).

## Rationale (본 draft 결정)
- **두 probe 분리 유지**: KB "임베딩 테스트"(read-only, `embedding_dimension` 미저장)와 Models "연결 테스트"(`ModelConfig.dimension` 자동 저장)는 대상 필드가 달라 공존한다. KB probe 의 read-only 원칙([9-rag-search Rationale](../../spec/5-system/9-rag-search.md))은 stale 벡터 오답 방지가 목적이므로 그대로 유지하고, 본 변경은 모델 설정 자신의 출력 차원(SoT) 만 갱신한다.
- **dimension read-only 를 "저장값 있을 때"로 한정**: 최초 등록/감지 실패 경로의 수동 입력을 막지 않으면서, 감지·저장된 정상 케이스에서는 오입력으로 인한 pgvector 차원 손상 위험을 줄인다.
