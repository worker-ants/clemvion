---
worktree: agent-memory-model-config-73a1a5
started: 2026-06-20
owner: developer
status: in-progress
---

# 에이전트 메모리 모델 필드 → 등록 config 선택 (모델명 문자열 → config.id)

## 결정 (사용자 확정)
#642 의 "노드 provider 내 모델명 select" 를 **/models 등록 config 선택**으로 전환.
KB 의 `embeddingModelConfigId` 패턴 미러(검증된 선례 — 서버가 config.defaultModel 로 모델 도출).

- summary/extraction → 등록 **chat config** 선택 = `llm-config-selector` **재사용**.
- embedding → 등록 **embedding config** 선택 = 신규 `embedding-config-selector` (KB kb-form-body 의
  embedding NativeSelect + `list("embedding")` 미러, FieldGroup 래핑으로 라벨/hint).
- 저장값 = `config.id`. 서버가 그 config(kind 맞춰 resolve)의 `defaultModel` + provider/credential 로
  호출. 비우면 노드 main config(chat)/워크스페이스 기본(embedding) 폴백.
- **필드 rename**: summaryModel→`summaryModelConfigId`, extractionModel→`extractionModelConfigId`,
  embeddingModel→`embeddingModelConfigId` (KB 명명 일치).
- **§12.12 재번복**: 보조 콜이 노드 main provider 가 아닌 **선택 config 의 provider** 사용
  (다른 provider 의 저렴 모델 가능 = 비용절감 목적 실현).

## 구현 메모 (실제)
- 위젯은 `llm-config-selector` 재사용 대신 **신규 2종**(`chat-config-selector` / `embedding-config-selector`,
  `auto-form/config-selector-widgets.tsx`) — llm-config-selector 가 "LLM Provider" 라벨을 자체
  렌더해 schema 라벨(Summary/Extraction/Embedding Model)을 덮어쓰기 때문. FieldGroup 으로 감싸 schema
  label/hint 렌더 + config 삭제 시 stale 경고.
- LlmService 에 `resolveEmbedding` passthrough 추가(ModelConfigService.resolveEmbedding 위임) — 기존
  `resolveConfig` 는 kind='chat' 하드코딩이라 embedding 해석 불가였음.

## 편집 surface
### Backend
- [x] agent-memory-schema.ts: 3필드 rename + widget(chat-config-selector ×2 / embedding-config-selector).
- [x] 런타임 resolve 3지점:
  - [x] summary: ai-agent.handler.ts — summaryModelConfigId 있으면 resolveConfig→그 config+defaultModel.
  - [x] extraction: processor.ts(resolveConfig(extractionModelConfigId||llmConfigId)) + injection payload.
  - [x] embedding: agent-memory.service.ts(EmbedConfigSource{embeddingModelConfigId}) + LlmService.resolveEmbedding.
- [x] handlers(ai-agent / IE): config-id 전달 (recall embeddingModelConfigId, summary/extraction snapshot).
- [x] queue interface(agent-memory-extraction.queue.ts): payload 필드 rename.
- [x] config-echo(§11.7 echo 목록): 필드 rename (spec 반영).
- [x] node-component.interface.ts UiHint.widget union: chat-config-selector/embedding-config-selector.
- [x] backend 테스트 전부 갱신 (schema·service·processor·injection·memory specs, 267 pass).

### Frontend
- [x] 신규 config-selector-widgets.tsx (chat/embedding, value=config.id, FieldGroup, stale/no-config 경고).
- [x] widget-registry + UiWidget union(types.ts): config-selector 2종, model-selector 2종 제거.
- [x] model-selector-widgets.tsx + .test.tsx 삭제 (git rm).
- [x] i18n ko/en nodeConfigs.configSelector 블록 + backend-labels HINT_KO 3 hint 갱신.
- [x] 신규 config-selector-widgets.test.tsx (6 pass) + auto-form/i18n suite 회귀(146 pass).

### Spec
- [x] node-common §2.6.2 widget 어휘 (모델 config selector 2종).
- [x] ai-agent §1 표 3행 + §6.1 1.5/2.7 + config-echo + §12.12 재번복 결정.
- [x] IE §1 표 2행 + recall/scheduleExtraction 시그니처.
- [x] 17-agent-memory §1/§3 임베딩·추출 출처 + AGM-04.
- [x] data-flow/13-agent-memory 시퀀스·큐·sink 표. conversation-thread 로드맵 앵커.

### 마이그레이션
- #642 방금 머지라 기존 데이터 ~0. 옛 모델명 값(다른 키)은 폐기되고 미설정 폴백으로 graceful degrade.

## 워크플로
- [x] 코드+spec 구현, unit(backend 267 / frontend 6+146) 통과.
- [ ] TEST WORKFLOW (lint·build·e2e).
- [ ] /ai-review + impl-done.
</content>
