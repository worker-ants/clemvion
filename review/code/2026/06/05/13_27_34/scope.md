# 변경 범위(Scope) 리뷰 결과

리뷰 일시: 2026-06-05
대상 커밋 범위: rag-rerank-followup worktree 변경분 (26개 파일)

---

## 발견사항

### [INFO] 파일 1~2: review/consistency 산출물 — 범위 적합

- 위치: `review/consistency/2026/06/05/11_50_51/plan_coherence.md`, `rationale_continuity.md`
- 상세: consistency-checker 가 생성한 정상 산출물. `exec-park-durable-resume.md` 대상의 `--impl-prep` 모드 결과물로, 지정된 경로(`review/consistency/**`)에 신규 생성됨. 범위 이탈 없음.
- 제안: 없음.

---

### [INFO] 파일 3: spec/0-overview.md — `active_running_ms` 타임아웃 항목 추가

- 위치: `spec/0-overview.md` L289 (신규 1행)
- 상세: `EXECUTION_MAX_ACTIVE_RUNNING_MS` active-running 누적 타임아웃 항목이 Worker Pool 설명에 추가됨. 이 변경은 파일 16(`spec/5-system/4-execution-engine.md` §8)의 PR2a 구현 완료 반영과 직결된다. 변경 의도(rerank+exec-park 구현 완료 spec 동기화)와 정합하며 over-engineering 없음.
- 제안: 없음.

---

### [INFO] 파일 4: spec/1-data-model.md — rerank + exec-park 두 작업 변경 혼재

- 위치: `spec/1-data-model.md`
- 상세: 이 파일에 두 독립 작업의 변경이 함께 포함되어 있다.
  - **rerank 관련**: `rerank_mode` 컬럼 설명에 `(V082)` 마이그레이션 버전 명시·"두 모드 구현됨" 갱신, `rerank_llm_config_id` 에서 "(후속)" 문구 제거, `§2.16.1` 헤딩 anchor 에 `(V081)` 추가 및 구현 상태 블록 추가.
  - **exec-park 관련**: `pending_plans` 에 `exec-park-durable-resume.md` 추가, `duration_ms` 보완 설명 추가, `active_running_ms` 신규 컬럼, `error` 컬럼 `§8` 링크 텍스트에서 `(미구현 -- planned)` 제거, `conversation_thread jsonb` 신규 컬럼 추가.
  - 두 작업이 동일 파일에서 혼재하지만, 각 변경은 해당 작업의 구현 완료 spec 동기화로 의도에 부합한다. 별도 커밋/PR 이 아닌 단일 spec 동기화 패스에서 이뤄진 것으로 보이며 의도 이상의 수정은 아님.
- 제안: 없음.

---

### [INFO] 파일 5: spec/2-navigation/16-agent-memory.md — 신규 파일, agent-memory-admin-ui 작업 산출물

- 위치: `spec/2-navigation/16-agent-memory.md` (new file)
- 상세: `agent-memory-admin-ui.md` plan 에 해당하는 UI spec 신규 생성. `plan/in-progress/agent-memory-admin-ui.md` 가 별도로 존재하는 것으로 보이며 이에 대응하는 spec 신설은 적절하다. rag-rerank-followup worktree 이름과 직접적으로 연결되지 않지만, 이 worktree 가 여러 pending plan 의 follow-up(후속 spec 동기화)을 포함하는 것으로 보인다.
- 제안: 이 worktree 가 'rag-rerank-followup' 이름임에도 agent-memory, exec-park 등 다수 도메인의 spec 변경을 포함하는 것은 명시적 규약 위반은 아니지만, 변경 추적 관점에서 worktree 이름과 실제 범위가 다소 불일치한다. 향후 worktree 작명 시 참고.

---

### [INFO] 파일 6~7: spec/2-navigation/5-knowledge-base.md, 6-config.md — rerank 구현 완료 반영

- 위치: `spec/2-navigation/5-knowledge-base.md`, `spec/2-navigation/6-config.md`
- 상세:
  - `5-knowledge-base.md`: "(Planned)" 표시 제거, `cross_encoder_llm` 구현됨으로 갱신, anchor 링크 수정(`rerankconfig-planned` → `rerankconfig`). 모두 구현 완료 반영.
  - `6-config.md`: 파일명·헤더를 "인증, LLM" → "인증, LLM, Rerank" 로 갱신, `Part C: Rerank` 섹션 + API 표 신규 추가. rerank 구현 완료에 따른 UI spec 보완으로 범위 적합.
- 제안: 없음.

---

### [INFO] 파일 8: spec/2-navigation/_product-overview.md — agent-memory + rerank 두 작업 반영 혼재

- 위치: `spec/2-navigation/_product-overview.md`
- 상세: 내비게이션 spec 맵 헤더에 `16-agent-memory.md` 링크 추가, 사이드바 목록에 `Agent Memory` 항목 추가, `§3.13 Agent Memory` 요구사항 섹션 신규 추가. agent-memory-admin-ui 작업 범위에 속하는 정상 변경.
- 제안: 없음.

---

### [INFO] 파일 9: spec/4-nodes/3-ai/1-ai-agent.md — agent-memory-summary-model 작업 반영

- 위치: `spec/4-nodes/3-ai/1-ai-agent.md`
- 상세: `summaryModel`/`extractionModel` 신규 필드 추가 (§12.12 번복 포함), `pending_plans` 에 `agent-memory-summary-model.md`·`exec-park-durable-resume.md` 추가, `_resumeCheckpoint` 범위 확장(`information_extractor` 포함), v1/v2 경계 서술 갱신, `§12.13` 요약 영속 경로 갱신. 여러 작업(summary-model, exec-park, ie-checkpoint)의 변경이 하나의 파일에 혼재하지만 모두 구현 완료 spec 동기화 범위.
  - 특이사항: `§12.12` 의 과거 결정 "기각" 번복이 포함되어 있다. Rationale 에 번복 근거가 상세히 기록되어 있어 규약 준수.
- 제안: 없음.

---

### [INFO] 파일 10: spec/4-nodes/3-ai/3-information-extractor.md — IE checkpoint 지원 반영

- 위치: `spec/4-nodes/3-ai/3-information-extractor.md`
- 상세: `pending_plans` 에 `exec-park-durable-resume.md` 추가, `_resumeState` 행 서술이 "미지원" → "지원(partialResult/collectionRetryCount 포함)" 으로 갱신. 구현 완료 반영.
- 제안: 없음.

---

### [INFO] 파일 11: spec/5-system/1-auth.md — rerank_config 권한·audit-log 추가, historical-artifact 주석 추가

- 위치: `spec/5-system/1-auth.md`
- 상세: 권한 매트릭스에 `Rerank Config` 행 추가, audit-log 이벤트 목록에 `rerank_config.*` 추가. rerank 구현 완료 반영. 추가로 §1.5.4 초대 에러 코드의 historical-artifact 주석이 삽입됨 — 이 주석은 파일 23(`error-codes.md`) 의 레지스트리 추가와 짝을 이루므로 무관한 변경이 아니라 error-codes 정합화 작업의 일환.
- 제안: 없음.

---

### [INFO] 파일 12~13: spec/5-system/14, 16 — EXECUTION_TIME_LIMIT_EXCEEDED + execution-run 큐 추가

- 위치: `spec/5-system/14-external-interaction-api.md`, `spec/5-system/16-system-status-api.md`
- 상세: `14`: 에러 코드 목록에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가 및 구분 설명. `16`: `execution-run` 큐 행 추가. 모두 PR2a 구현 완료(§8 active-running 타임아웃) 반영.
- 제안: 없음.

---

### [INFO] 파일 14: spec/5-system/17-agent-memory.md — agent-memory admin UI + summary-model 반영

- 위치: `spec/5-system/17-agent-memory.md`
- 상세: `pending_plans` 추가, 추출 모델 행 `extractionModel` fallback 체인으로 갱신, `§6` 신규(메모리 관리 API), `§7` 번호 이동 + v2 로드맵에서 "메모리 가시화 UI" 완료 표시. 여러 작업의 동기화이나 모두 구현 완료 반영.
- 제안: 없음.

---

### [INFO] 파일 15: spec/5-system/3-error-handling.md — 링크 텍스트·schemaVersion 설명 갱신

- 위치: `spec/5-system/3-error-handling.md`
- 상세: `§8` 링크에서 `(미구현 -- planned)` 제거, `RESUME_INCOMPATIBLE_STATE` 에 "미래 버전(schemaVersion 초과)" 케이스 추가. PR2a·checkpoint-schemaVersion 구현 완료 반영.
- 제안: 없음.

---

### [INFO] 파일 16: spec/5-system/4-execution-engine.md — exec-park-durable-resume 핵심 spec

- 위치: `spec/5-system/4-execution-engine.md`
- 상세: 가장 많은 변경이 집중된 파일. IE checkpoint 지원 확장, Execution.conversation_thread durable commit, schemaVersion 도입, §8 구현 완료 갱신, EXECUTION_MAX_ACTIVE_RUNNING_MS ENV 추가, Graceful Shutdown under-count 허용 결정, Rationale 추가. 모두 `exec-park-durable-resume.md` plan 의 Phase A/B 구현 완료 반영으로 범위 적합.
- 제안: 없음.

---

### [INFO] 파일 17: spec/5-system/6-websocket-protocol.md — schemaVersion 케이스 추가

- 위치: `spec/5-system/6-websocket-protocol.md`
- 상세: `RESUME_INCOMPATIBLE_STATE` 설명에 "미래 버전" 케이스 추가. 파일 15·16 과 동일 변경의 cross-cutting 동기화. 범위 적합.
- 제안: 없음.

---

### [INFO] 파일 18: spec/5-system/7-llm-client.md — anchor 링크 수정

- 위치: `spec/5-system/7-llm-client.md`
- 상세: `rerankconfig-planned` → `rerankconfig` anchor 수정 1행. 파일 6의 heading anchor 변경에 따른 링크 정합화. 의미 없는 단순 텍스트 수정이 아니라 broken anchor 방지이므로 적절.
- 제안: 없음.

---

### [INFO] 파일 19: spec/5-system/9-rag-search.md — rerank 구현 완료 + Overview 섹션 추가

- 위치: `spec/5-system/9-rag-search.md`
- 상세: `Overview` 섹션 신규 추가(3행), `(Planned)` 제거, `cross_encoder_llm` 구현됨으로 갱신, "(후속)" 문구 제거. spec 구조 규약(Overview 섹션)에 따른 Overview 추가는 정상적인 spec 동기화다.
- 제안: 없음.

---

### [INFO] 파일 20~21: spec/5-system/_product-overview.md, chat-channel-adapter.md

- 위치: `spec/5-system/_product-overview.md`, `spec/conventions/chat-channel-adapter.md`
- 상세: `_product-overview.md`: AGM-12/13 요구사항 추가 (agent-memory admin API). `chat-channel-adapter.md`: `EXECUTION_TIME_LIMIT_EXCEEDED` 타임아웃 분류 추가. 모두 구현 완료 반영.
- 제안: 없음.

---

### [INFO] 파일 22: spec/conventions/conversation-thread.md — durable park resume §8.4 신규

- 위치: `spec/conventions/conversation-thread.md`
- 상세: §4 영속화 표 갱신(park 스냅샷 행 추가), "신규 컬럼 없음" 원칙 전환, §7 v2 로드맵에서 두 항목 "채택 완료" 표시, §8.4 신규 섹션(전환 근거 Rationale 포함), §9 앞에 도입 문단 추가. exec-park-durable-resume Phase A1 완료 반영. Rationale 이 상세하게 기록됨.
- 제안: 없음.

---

### [INFO] 파일 23: spec/conventions/error-codes.md — historical-artifact 레지스트리에 초대 코드 추가

- 위치: `spec/conventions/error-codes.md`
- 상세: 초대 흐름의 `lower_snake_case` 에러 코드 6개를 historical-artifact 레지스트리에 등재. 파일 11(`1-auth.md`)의 §1.5.4 주석과 짝을 이루며 error-codes 정합화 작업. rag-rerank-followup 의 주된 작업(rerank/exec-park)과 직접 연관은 없으나, 관련 구현 완료 spec 동기화 패스에서 발견한 drift 를 함께 수정한 것으로 보인다.
- 위험도 고려: 이 변경은 기능 추가가 아닌 기존 코드의 명시적 문서화(historical-artifact 레지스트리 등재)이므로 부작용이 없다.
- 제안: 없음.

---

### [WARNING] 파일 23: error-codes.md + 파일 11: 1-auth.md — 작업 범위 외 영역 수정

- 위치: `spec/conventions/error-codes.md` (historical-artifact 레지스트리 추가), `spec/5-system/1-auth.md` (§1.5.4 historical-artifact 주석 추가)
- 상세: 이 변경은 rerank/exec-park/agent-memory 어느 plan 의 직접 구현 산출물도 아니다. 초대 흐름 `lower_snake_case` 에러 코드의 historical-artifact 문서화는 그 자체로 유용하지만, 현재 worktree(rag-rerank-followup)의 명시적 작업 범위에 포함되지 않는다.
- 단, 변경이 spec-only(문서 정합화)이고 기능 코드·마이그레이션·테스트에 영향이 없어 실질 위험은 낮다. CLAUDE.md 규약상 spec 변경은 project-planner 권한이며, 이 변경이 developer worktree 에서 발생했다면 규약(개발자는 spec 읽기 전용) 위반이 될 수 있다. 다만 이 worktree 의 다른 변경들도 모두 spec 갱신이므로, 해당 worktree 가 spec 갱신 포함 범위임을 감안하면 INFO 수준으로 볼 수도 있다.
- 제안: 초대 에러 코드 historical-artifact 문서화는 별도 spec-only PR 또는 다음 spec 동기화 패스로 분리하는 것이 범위 추적을 깔끔하게 한다. 단, 이미 합쳐진 상태라면 roll-back 비용이 문서화 가치를 초과하지 않으므로 현재 상태 유지도 허용 가능.

---

### [INFO] 파일 24: spec/conventions/node-output.md — schemaVersion 설명 추가

- 위치: `spec/conventions/node-output.md`
- 상세: `_resumeCheckpoint` 서술에 `schemaVersion` 동봉·미래 버전 graceful reset 설명 추가. 파일 16의 §1.3 변경과 정합하는 cross-cutting 동기화.
- 제안: 없음.

---

### [INFO] 파일 25~26: spec/data-flow/0-overview.md, 9-observability.md — execution-run 큐 추가

- 위치: `spec/data-flow/0-overview.md`, `spec/data-flow/9-observability.md`
- 상세: `execution-run` 큐를 큐 카탈로그와 observability 다이어그램(12→13개)에 추가. PR1(execution-run intake 큐) 구현 완료 반영.
- 제안: 없음.

---

## 요약

26개 변경 파일은 크게 세 작업(① rag-rerank `cross_encoder_llm` 구현 완료 동기화, ② exec-park-durable-resume Phase A/B 구현 완료 spec 동기화, ③ agent-memory admin UI + summary-model 구현 완료 동기화)의 spec 갱신으로 구성된다. 대부분의 변경은 구현 완료 상태를 spec 에 반영하는 것으로 의도에 부합하며, 의미 없는 포맷팅·불필요한 리팩토링·무관한 설정 변경은 관찰되지 않는다. 단 하나의 WARNING: `error-codes.md` 와 `1-auth.md` 에 포함된 초대 흐름 historical-artifact 문서화는 이 worktree 의 명시적 작업 범위(rerank/exec-park/agent-memory)와 직접 연관이 없으나, spec-only·기능 무영향 변경이라 실질 위험은 낮다. 전반적으로 변경 범위는 통제 가능한 수준이다.

---

## 위험도

LOW
