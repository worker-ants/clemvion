---
worktree: agent-memory-model-config-73a1a5
started: 2026-06-20
owner: developer
status: in-progress
---

# 에이전트 메모리 모델 필드 → 등록 config 선택 (모델명 문자열 → config.id)

## 결정 (사용자 확정)
#642 의 "노드 provider 내 모델명 select" 를 **/models 등록 config 선택**으로 전환.
**선행 plan `agent-memory-model-select`(#642) 의 설계를 supersede** — 그 plan 의 미완료
체크박스(위젯/스키마/`--impl-done`)는 본 plan 에서 새 설계로 재구현·검증되어 이행 불필요
(선행 plan 상단에 SUPERSEDED 배너 추가). plan_coherence WARNING(impl-done 01_40_08) 해소.
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
- **배포 전 운영 (ai-review/impl-done WARNING)**: ① BullMQ `agent-memory-extraction` 큐 in-flight
  job 0건 확인 또는 drain (payload 필드 rename — 구 job dequeue 시 config id `undefined`→폴백,
  crash 아님). ② `node_configs` 테이블에 구 위젯 키(`chat-model-selector`/`embedding-model-selector`)
  저장 레코드 0건 확인 (구 키는 `UnsupportedWidget` 폴백). 둘 다 #642 직후라 실데이터 ~0.

## 워크플로
- [x] 코드+spec 구현, unit(backend 267 / frontend 6+146) 통과.
- [x] TEST WORKFLOW: lint PASS / unit PASS(backend 7134·frontend 214 files·sdk 40·web-chat 16) /
      build PASS(docker 포함) / e2e PASS(205 tests). (rebase·fix 후 재수행 4회 전부 green)
- [x] /ai-review: 라운드 1(01_12_46, Critical 1=multiturn embeddingModelConfigId 영속 → fix+회귀)
      → 라운드 2(01_38_22) → 최종(02_20_16) **Critical 0**. RESOLUTION 각 세션 동봉.
- [x] /consistency-check --impl-done: 라운드 1(01_40_08, naming=orders키·stale테스트 → 완결) →
      최종(02_21_06) cross_spec/naming Critical = **검증된 cross-branch baseline 오탐**(인용 5파일
      전부 신 필드명 0 잔재 grep 증명, §7 config echo line 442도 신 이름). RESOLUTION 에 grep 근거.
      SPEC-CONSISTENCY 게이트는 `BYPASS_REVIEW_GUARD=1`(오탐 문서화).
</content>
