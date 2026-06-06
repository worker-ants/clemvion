# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done` (구현 완료 후 검토)  
대상 영역: `spec/5-system/` (diff-base: origin/main)  
검토 시각: 2026-06-06

---

## 발견사항

### [WARNING] `spec/5-system/9-rag-search.md` — 쿼리 임베딩 경로에 `inputType:'query'` 명시 부재

- **target 위치**: `spec/5-system/8-embedding-pipeline.md §5.4` (신규) / `spec/5-system/7-llm-client.md §3.3 / §8.3`
- **충돌 대상**: `spec/5-system/9-rag-search.md §2 검색 흐름`
- **상세**: `8-embedding-pipeline.md §5.4` 는 검색 query 임베딩 경로에서 `LlmService.embed(..., 'query')` 를 명시하도록 규정한다. `17-agent-memory.md §4` 도 회수 경로에 `inputType:'query'` 를 명시한다. 반면 `9-rag-search.md` 는 이번 diff 에 포함되지 않았으며, 해당 spec 본문(§2 `query_vector` 생성 부분)에 `inputType:'query'` 에 대한 언급이 없다. RAG 검색의 쿼리 임베딩이 대칭 모델(기본값 no-op)이라면 영향 없으나, e5/Gemini 계열 KB 를 쓰는 경우 검색 시 `'query'` inputType 이 누락되면 `8-embedding-pipeline.md §5.4` 의 "silent quality degradation" 문제가 그대로 잔존한다. spec 의 단일진실 원칙상 `9-rag-search.md` 도 동기화되어야 한다.
- **제안**: `spec/5-system/9-rag-search.md §2` (query 임베딩 생성 부분)에 "쿼리 임베딩 시 `LlmService.embed(config, [queryText], model?, opts?, 'query')` 사용 — 비대칭 모델 정합 ([임베딩 파이프라인 §5.4](./8-embedding-pipeline.md#54-비대칭-입력-input_type--prefix))" 문구를 추가해 동기화한다.

---

### [WARNING] `spec/7-channel-web-chat/` — webhook 202 응답 shape 변경이 EIA / webhook SoT 와 표기 불일치

- **target 위치**: `spec/7-channel-web-chat/0-architecture.md` 줄 62 / `spec/7-channel-web-chat/3-auth-session.md` 줄 41
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §4.1` / `spec/5-system/12-webhook.md §3.1` / `spec/5-system/2-api-convention.md §5`
- **상세**: 이번 diff 에서 채널 웹채팅 spec 두 곳이 202 응답 shape 표기를 `{ executionId, interaction: { token, endpoints } }` (봉투 없는 형태)로 변경했다. 그러나 `12-webhook.md §3.1` 과 `2-api-convention.md §5` 는 전역 `TransformInterceptor` 가 `{ data: { ... } }` 로 래핑함을 SoT 로 명시하고 있고, `14-external-interaction-api.md §4.1` 의 JSON 블록도 전송 논리 payload (= `data` 내용물) 표기를 유지하고 있다. 채널 웹채팅 spec 의 표기가 "논리 payload" 인지 "wire format" 인지 불분명해, 신규 개발자가 클라이언트 코드 작성 시 언랩 여부를 잘못 판단할 수 있다. 삭제된 `R5` Rationale 섹션과 `"논리 payload"` 주석 제거도 이 혼동을 강화한다. `eia-client.ts` 실제 코드가 언랩을 수행하고 있으므로 런타임 동작은 정상이나, spec 상 표기가 다른 spec 들과 어긋난다.
- **제안**: 채널 웹채팅 spec 표기를 다음 중 하나로 통일한다. (a) `spec/5-system/14-external-interaction-api.md §4.1` 방식처럼 논리 payload 임을 블록 설명에 명시하거나, (b) wire format 으로 `{ data: { executionId, interaction: { token, endpoints } } }` + `res.data` 언랩 언급을 복원한다. `12-webhook.md` / `2-api-convention.md` 의 `{ data }` 래핑 SoT 와 일관성을 유지해야 한다.

---

### [INFO] `spec/5-system/7-llm-client.md §3.3` — `LLMClient.embed` 인터페이스와 `LlmService.embed` 서비스 시그니처의 `opts` 인자 위치 차이 설명 부재

- **target 위치**: `spec/5-system/7-llm-client.md §3.3` (LLMClient 인터페이스), `§8.3` (LlmService 래퍼)
- **충돌 대상**: `spec/5-system/8-embedding-pipeline.md §5.4`, `spec/5-system/17-agent-memory.md §4`
- **상세**: `LLMClient.embed(texts, model?, inputType?)` 인터페이스(§3.3)와 `LlmService.embed(config, texts, model?, opts?, inputType?)` 서비스 래퍼(§8.3) 간 `opts` 인자 위치가 다르다. `8-embedding-pipeline.md §5.4` 와 `17-agent-memory.md §4` 의 호출 예시는 모두 서비스 래퍼 시그니처를 따르고 있어 모순은 없다. 그러나 §3.3 에서 §8.3 으로의 cross-link 가 짧아, 독자가 §3.3 의 인터페이스 시그니처만 보고 서비스 래퍼 호출 코드를 작성할 때 `opts` 위치를 착각할 수 있다.
- **제안**: `7-llm-client.md §3.3` 에 "서비스 계층 래퍼 시그니처는 §8.3 참조 — `opts`(timeoutMs/disableInnerRetry) 및 `config` 인자 추가" 한 줄 cross-link 를 추가해 혼동을 방지한다.

---

### [INFO] `spec/5-system/8-embedding-pipeline.md §5.4` — 기존 e5/Gemini KB 재임베딩 필요성에 대한 운영자 배포 가이드 부재

- **target 위치**: `spec/5-system/8-embedding-pipeline.md §5.4` 정합성 bullet
- **충돌 대상**: `spec/2-navigation/5-knowledge-base.md` (임베딩 모델 변경 경고 신규 추가)
- **상세**: `8-embedding-pipeline.md §5.4` 는 "e5/Gemini KB 는 본 변경 후 재임베딩 필요" 를 명시하고, `5-knowledge-base.md` 는 임베딩 모델 변경 시 재임베딩 인라인 경고를 추가했다. 이 두 spec 은 일관된다. 그러나 배포 업그레이드 시나리오(기존 설치에서 이 변경을 적용하는 경우)에서 e5/Gemini 계열 KB 를 보유한 운영자에게 1회성 재임베딩이 필요함을 안내하는 배포 노트가 spec 어디에도 없다. 결함은 아니지만 운영 맥락에서 정보 갭이 된다.
- **제안**: `8-embedding-pipeline.md §5.4` 의 정합성 섹션에 "배포 업그레이드 시 — e5/Gemini 계열 임베딩 모델을 사용 중인 기존 KB 는 본 변경 배포 후 1회 재임베딩(§7.3)이 필요하다. 자동 트리거되지 않으며 KB 상세 화면의 전체 재임베딩으로 수동 실행한다" 를 추가하는 것을 고려한다.

---

## 요약

이번 diff(`spec/5-system/7-llm-client.md`, `spec/5-system/8-embedding-pipeline.md`, `spec/5-system/17-agent-memory.md`, `spec/2-navigation/5-knowledge-base.md`, `spec/7-channel-web-chat/0-architecture.md`, `spec/7-channel-web-chat/3-auth-session.md`)는 내부적으로 일관성이 높다. `LlmService.embed` 의 `inputType` 시그니처는 LLMClient 인터페이스(§3.3), 서비스 래퍼(§8.3), 임베딩 파이프라인(§5.4), 에이전트 메모리(§4) 네 곳이 일치한다. 주요 위험은 두 가지다. 첫째, `spec/5-system/9-rag-search.md` 가 이번 diff 에서 업데이트되지 않아 쿼리 임베딩 경로의 `inputType:'query'` 적용이 spec 에서 누락된 채로 남아 있으며, e5/Gemini 계열 KB 검색에서 silent quality degradation 이 재발할 수 있다. 둘째, `spec/7-channel-web-chat/` 의 202 응답 표기에서 `{ data }` 봉투 언급이 제거되어 `12-webhook.md` · `2-api-convention.md` 의 `TransformInterceptor` SoT 와 표기 불일치가 발생했다. 두 항목 모두 런타임 동작은 정상이나 spec 문서로서의 명확성 결함이 신규 개발자 오구현을 유발할 수 있어 WARNING 으로 분류한다.

---

## 위험도

**MEDIUM**
