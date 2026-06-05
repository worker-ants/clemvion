# 요구사항(Requirement) 리뷰 결과

리뷰 일시: 2026-06-05
대상 파일: 26개 (review/consistency 2개 + spec 24개)
관련 spec: spec/5-system/9-rag-search.md, spec/1-data-model.md, spec/5-system/4-execution-engine.md, spec/5-system/17-agent-memory.md, spec/conventions/conversation-thread.md 외

---

## 발견사항

### [WARNING] `spec/2-navigation/6-config.md` 두 곳이 존재하지 않는 앵커 `#2161-rerankconfig-planned` 를 참조

- 위치: `spec/2-navigation/6-config.md` L17 (관련 문서 링크), L187 (Part C 엔티티 링크)
- 상세: `spec/1-data-model.md` 의 실제 heading 은 `### 2.16.1 RerankConfig` (앵커 `#2161-rerankconfig`) 이다. 같은 파일 내 주석이 "heading 의 `(Planned)` 를 anchor 안정성을 위해 유지한다"고 서술하지만, 실제 heading 에서 `(Planned)` 가 제거돼 있어 주석이 현실과 불일치한다. 반면 `spec/2-navigation/5-knowledge-base.md` L65 와 `spec/5-system/7-llm-client.md` L54 는 이미 새 앵커 `#2161-rerankconfig` 로 갱신됐다. `6-config.md` 두 곳만 구 앵커 `#2161-rerankconfig-planned` 로 남아 broken link 상태.
- 제안: `spec/2-navigation/6-config.md` L17, L187 의 `#2161-rerankconfig-planned` 를 `#2161-rerankconfig` 로 수정. 또한 `spec/1-data-model.md` L542 의 "heading 의 `(Planned)` 는 anchor 안정성 때문에 유지" 주석은 heading 이 실제로 `(Planned)` 를 포함하지 않으므로 제거 또는 수정 필요.

---

### [WARNING] `spec/5-system/9-rag-search.md` §3.3 상태 주석: `cross_encoder_llm` LLM grading 이 "모두 구현됨"으로 기술됐으나 코드상 일부 경로 incomplete 에 대한 spec 기술 부정확

- 위치: `spec/5-system/9-rag-search.md` §3.3 상태 배너 + §6 에러 테이블 `cross_encoder_llm grading LLM 실패` 행
- 상세: spec 은 "`cross_encoder` · `cross_encoder_llm` 두 모드 모두 구현됨"이라고 선언한다. 코드(`rerank.service.ts`)를 확인하면 `cross_encoder_llm` 모드의 `applyLlmGrading` 메서드가 실제로 구현돼 있고(`llmGradingApplied=true` 분기 존재), 기능적으로 작동한다. 이 점은 정확하다. 단, `rag-search.service.ts` L129~L135 주석에 "cross_encoder_llm 은 추가 LLM grading(후속)을 약속한다"는 구버전 주석이 남아 있어 구현 완료 상태와 혼재한다. spec 본문은 정확하나 코드 내 주석이 오래된 정보를 담고 있다.
- 제안: `rag-search.service.ts` L129~L135 주석의 "후속" 표현을 "구현됨"으로 정리 권장 (spec fidelity 관점 INFO 수준이지만 구현 완료 후 주석 정리 누락이므로 WARNING).

---

### [WARNING] `spec/5-system/17-agent-memory.md` §3 `AGM-04` 요구사항 기재와 코드 구현 간 세부 내용 불일치

- 위치: `spec/5-system/17-agent-memory.md` L75 `AGM-04` 요구사항 주석
- 상세: spec diff 에서 `AGM-04` 요구사항 기재가 `"노드 model 재사용"` 에서 `"추출 모델 = extractionModel ?? 노드 model ?? llmConfig 기본"` 으로 변경됐고, `spec/4-nodes/3-ai/1-ai-agent.md §12.12` 와 `ai-agent.handler.ts` 모두 새 fallback 체인을 구현한다. 이 자체는 정합하다. 다만 `spec/5-system/_product-overview.md` 의 `AGM-04` 요구사항 테이블 본문(L109)은 여전히 갱신 전 기술(`scheduleBackgroundBody snapshot 격리 준수, 노드 model 재사용`)을 유지하고 있어 _product-overview.md 와 17-agent-memory.md §3 사이에 기술 불일치가 발생한다.
- 제안: `spec/5-system/_product-overview.md` L109 의 `AGM-04` 행에서 "노드 model 재사용" 을 "추출 모델 = `extractionModel ?? 노드 model ?? llmConfig 기본`" 으로 동기 갱신.

---

### [SPEC-DRIFT] `spec/1-data-model.md` §2.16.1 주석이 실제 heading 상태를 오기술

- 위치: `spec/1-data-model.md` L542
- 상세: L542 는 "§2.16.1 heading 의 `(Planned)` 는 anchor 안정성 때문에 유지 — 다른 spec 이 `#2161-rerankconfig-planned` 를 참조" 라고 서술한다. 그러나 실제 L538 heading 은 `### 2.16.1 RerankConfig` (Planned 제거됨)이다. 코드·spec 의 의도는 anchor 를 `#2161-rerankconfig` 로 통일하는 것이며(7-llm-client.md, 5-knowledge-base.md 이미 반영), 6-config.md 만 구 anchor 를 사용 중이다. 주석 자체가 구버전 의도를 담고 있어 spec 내부 self-contradiction 상태.
- 제안: 코드 유지 + spec 수정. L542 의 `(Planned)` 관련 주석을 제거하거나 "6-config.md 가 구 anchor 를 사용 중 → 수정 필요" 로 교체. heading 은 현재 상태(`### 2.16.1 RerankConfig`)가 올바름. 대상 spec 위치: `spec/1-data-model.md` L542.

---

### [INFO] `spec/5-system/4-execution-engine.md` §8 구현 상태 기술이 multi-KB rerank 제한을 언급하지 않음

- 위치: `spec/5-system/9-rag-search.md` §3.3.2 / `rag-search.service.ts` L136~L148
- 상세: 코드는 `kbs.length === 1` 일 때만 rerank 경로를 활성화하고, 멀티-KB 입력이면 rerank 없이 cosine 경로로 처리한다. 이 제한은 코드 주석(`agentic 경로(KbToolProvider)는 항상 단일 KB 로 호출`)에서 정당화되나, spec §3.3 본문에 "단일 KB 한정(agentic 경로) / 멀티-KB 리랭크 후속" 제약이 명시되지 않았다. 현재 spec 은 §3.3 에서 모드만 설명하고 단일-KB 전제를 밝히지 않는다.
- 제안: `spec/5-system/9-rag-search.md` §3.3 에 "v1 rerank 는 단일 KB 호출에 적용(agentic 경로 `KbToolProvider`); 멀티-KB 경로는 cosine 순 병합 후 topK 컷(후속)" 구현 제약을 명시.

---

### [INFO] `review/consistency/2026/06/05/11_50_51/rationale_continuity.md` WARNING 2건 중 Phase B 착수 전 의무(spec 선행 갱신)가 현 시점까지 이행됐는지 추적 필요

- 위치: `review/consistency/2026/06/05/11_50_51/rationale_continuity.md` §[WARNING] §7.4 Worker 동작, §[WARNING] Phase B 선행 Rationale 명문화
- 상세: 두 WARNING 은 (1) `spec/5-system/4-execution-engine.md §7.4` Worker 동작 행의 fast-path 기술이 Rationale 와 혼재, (2) D4(turn-단위 park) Rationale 가 `4-execution-engine.md §Rationale` 에 미기록임을 지적한다. 이는 코드 구현 착수 전 spec 선행 변경 의무(plan `exec-park-durable-resume.md` 명시)에 해당하며, 현재 검토 대상 변경셋(이번 diff)에는 §7.4 Worker 동작 행 정정 및 Rationale D4 항 추가가 포함되지 않았다. 이번 변경셋은 rerank/agent-memory/exec-engine 관련 spec 정합 작업이며 Phase B 착수는 별도 작업이므로 즉각 차단 사유는 아니나, Phase B 착수 전 검증 필요.
- 제안: Phase B 착수 전 consistency 검토가 해당 항목들을 재차 확인하도록 plan 에 체크 항목 등재.

---

### [INFO] `spec/2-navigation/6-config.md` Part C §C.2 `provider 별 필수 필드` 기술과 `cohere` Base URL 처리

- 위치: `spec/2-navigation/6-config.md` L214 `provider 별 필수 필드`
- 상세: spec 은 "`cohere` 는 외부 API 이므로 API Key 가 필수이고 Base URL 은 받지 않는다 (provider 공식 endpoint 고정)"고 기술한다. `rerank-config.controller.ts` / `rerank-config.service.ts` 의 `cohere` create/update 로직이 Base URL 입력 없이 작동하는지 직접 검증은 미수행. UI spec 과 백엔드 DTO 간 일치 확인이 필요하다.
- 제안: INFO 수준 — `CreateRerankConfigDto` 의 `cohere` provider 에 대해 `baseUrl` 이 선택적(optional)이고 고정 endpoint 를 사용하는지 확인 권장.

---

### [INFO] `spec/conventions/conversation-thread.md` §7 v2 로드맵에서 `summaryModel`/`extractionModel` 채택 완료 항목의 fallback 세부 기술 누락

- 위치: `spec/conventions/conversation-thread.md` §7 v2 로드맵 갱신 항목
- 상세: `~~요약/추출 전용 저비용 모델~~: → 채택 완료` 로 crossed-out 처리됐다. 기술 내용이 "[AI Agent §12.12], A3. 미설정 시 fallback 체인 `[전용필드] → [노드 model] → [llmConfig 기본]` 으로 기존 동작 100% 보존"으로 올바르게 요약돼 있다. 이는 spec fidelity 정합으로 문제 없음.
- 제안: 별도 조치 불요.

---

## 요약

이번 변경셋은 rag-rerank followup 및 agent-memory, exec-engine 관련 spec 정합 작업이다. 기능 완전성(cross_encoder_llm LLM grading 구현, summaryModel/extractionModel 필드, AGM-12/AGM-13 API, conversation_thread durable park, active_running_ms 타임아웃, schemaVersion checkpoint)은 spec 기술과 코드 구현이 대체로 일치한다. 주요 문제는 두 가지다: (1) `spec/2-navigation/6-config.md` 가 존재하지 않는 앵커 `#2161-rerankconfig-planned` 를 두 곳에서 참조하는 broken link(WARNING), (2) `spec/5-system/_product-overview.md` 의 `AGM-04` 행이 `extractionModel` fallback 체인 변경을 반영하지 않은 불일치(WARNING). SPEC-DRIFT 1건은 `1-data-model.md` 내부 주석이 현재 heading 상태와 모순되는 기술 오류로, 코드는 정상이나 spec 주석 수정이 필요하다. 나머지 INFO 2건은 구현 제약 문서화 누락·검증 권장 수준이다.

---

## 위험도

LOW
