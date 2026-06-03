# 문서화(Documentation) 리뷰

## 발견사항

### [WARNING] `spec/5-system/17-agent-memory.md` — `AGM-*` 요구사항 ID 체계가 `_product-overview.md` 에 등재되지 않음
- 위치: `spec/5-system/17-agent-memory.md` §1~§5 각 section 끝의 요구사항 blockquote (`AGM-01`~`AGM-07`)
- 상세: 신규 spec 파일이 `AGM-01`~`AGM-07` 요구사항 ID를 인라인 blockquote로 정의하고 있으나, `spec/5-system/_product-overview.md`에 해당 ID들이 등재됐는지 확인되지 않는다. `spec/4-nodes/3-ai/_product-overview.md`의 `ND-AG-27~30`은 정식 등재됐고, `spec/4-nodes/_product-overview.md`에도 동기화됐다. 그러나 `AGM-*` ID는 `spec/5-system/` 도메인 소속인데 변경 목록에 `spec/5-system/_product-overview.md` 수정이 포함되지 않았다. 해당 파일에 Agent Memory 항목이 추가됐는지 명확하지 않아 drift 위험이 있다.
- 제안: `spec/5-system/_product-overview.md`에 `AGM-01`~`AGM-07` 요구사항 행을 추가하거나, 이미 추가된 경우 본 리뷰 payload 범위에 포함해 검증할 것.

### [WARNING] `spec/4-nodes/3-ai/0-common.md §10` — v1/v2 push 범위 기술이 `conversation-thread §2.3` 현황과 불일치
- 위치: `spec/4-nodes/3-ai/0-common.md` §10 첫 단락 (파일 내 line ~1162)
- 상세: `0-common.md §10`은 "v1 은 `ai_agent` 만 push + 자동 주입을 구현하고"라고 기술한다. 그러나 `spec/conventions/conversation-thread.md §2.3`은 "세 노드 모두 push 가 출하됐다 (`pushClassifierTurn` / `pushExtractorTurn` 가 `appendAiAssistantMessage` 호출)"라고 명시한다. 현재 기술은 독자가 text_classifier / information_extractor 의 push 가 미출하된 것처럼 오독할 수 있다. 이는 consistency review (rationale_continuity.md INFO-1) 에서도 동일하게 지적됐으나 spec 본문은 아직 수정되지 않은 상태다.
- 제안: `0-common.md §10` 첫 단락을 "v1 은 세 노드 모두 push 가 출하된 상태. `ai_agent` 만 자동 주입(contextScope)을 구현하며, `text_classifier` / `information_extractor` 는 동일 인터페이스로 v2 에 자동 주입이 추가된다"로 교정. 기존 consistency review 제안과 동일한 수정 방향.

### [WARNING] `spec/4-nodes/3-ai/0-common.md §10` — `memoryStrategy` 행 비고에 결정 근거 링크 누락
- 위치: `spec/4-nodes/3-ai/0-common.md` §10 `memoryStrategy` 행 비고
- 상세: "AI Agent 한정 (text_classifier/information_extractor 는 v2)" 비고가 있으나 이 제한이 의도된 설계 결정임을 뒷받침하는 링크가 없다. 독자는 이 제한이 의도적 설계인지 단순 미완성인지 판단하기 어렵다. 근거는 `1-ai-agent.md §12.9`에 명시되어 있다. consistency review (rationale_continuity.md INFO-2) 에서도 동일하게 지적됐다.
- 제안: 비고에 `[AI Agent §12.9](./1-ai-agent.md#129-memorystrategy-를-contextscope-enum-확장이-아닌-별도-필드로-둔-근거)` 참조 추가.

### [WARNING] `spec/4-nodes/3-ai/0-common.md §10` — `includeToolTurns` 행의 `memoryStrategy ≠ manual` 제한 누락
- 위치: `spec/4-nodes/3-ai/0-common.md` §10 `includeToolTurns` 행
- 상세: `1-ai-agent.md §1`의 `includeToolTurns` 행에는 "`memoryStrategy ≠ manual` 시 자동 주입 측면에서는 무효 (push 자체는 thread 누적 컨트랙트라 유지)"라는 중요한 제한이 명시되어 있다. 그러나 `0-common.md §10`의 동일 필드 행에는 이 제한이 없다. 두 문서를 독립적으로 읽는 독자는 공통 §10 기준으로 구현할 때 이 미묘한 제한을 놓칠 수 있다. consistency review (rationale_continuity.md INFO-3) 에서도 동일하게 지적됐다.
- 제안: `0-common.md §10`의 `includeToolTurns` 행 설명에 push/inject 분리 원칙 한 줄 추가: "`memoryStrategy ≠ manual` 시 자동 주입 측면에서 무효 — push (thread 누적) 자체는 전략과 독립 유지."

### [WARNING] `spec/conventions/conversation-thread.md §5` — `memoryStrategy` 무효화 관계가 `§5` 에 크로스 레퍼런스 없음
- 위치: `spec/conventions/conversation-thread.md §5` (`contextScope`/`contextInjectionMode` 필드 표)
- 상세: `§5` 필드 표는 `contextInjectionMode: messages/system_text`를 독립적으로 기술하며, `memoryStrategy ∈ {summary_buffer, persistent}` 일 때 `contextInjectionMode`가 "최근 원문 turn 주입 형식으로만 의미를 갖는다"는 제한이 없다. 이 제한은 `1-ai-agent.md §1`에만 있어, `conversation-thread.md §5` 기준으로 구현하는 사람은 놓칠 수 있다. cross_spec.md WARNING 항목에서도 지적됐다.
- 제안: `conversation-thread.md §5` 또는 §7 v2 로드맵에 "`memoryStrategy ≠ manual` 시 `contextScope` 계열 4필드의 범위 선택 의미가 무효화되며, `contextInjectionMode` 는 최근 원문 turn 주입 형식으로만 의미를 갖는다 — 상세: [Spec AI Agent §1]" 크로스 레퍼런스 추가.

### [WARNING] `spec/4-nodes/3-ai/2-text-classifier.md` — `status: implemented` 와 v2 미구현 기능 간 오독 가능성
- 위치: `spec/4-nodes/3-ai/2-text-classifier.md` frontmatter 및 §1 config 표
- 상세: `0-common.md §10`에서 `text_classifier`는 v2에서 `contextScope` 계열 push hook + 자동 주입이 추가된다고 명시됐으나, `2-text-classifier.md`의 config 표에는 이 필드들이 없다. `status: implemented`만 보면 모든 기능이 구현 완료된 것으로 오독될 수 있다. consistency review (convention_compliance.md INFO 항목)에서도 동일하게 지적됐다.
- 제안: `2-text-classifier.md §1` config 표 하단에 "v2 미구현 기능(`contextScope` 자동 주입)은 `spec/4-nodes/3-ai/0-common.md §10` 의 v2 로드맵 참조" note 추가.

### [INFO] `spec/5-system/17-agent-memory.md` — `AGENT_MEMORY_MAX_PER_SCOPE` 상수가 환경변수화 경로 미문서화
- 위치: `spec/5-system/17-agent-memory.md §4` + `spec/1-data-model.md §2.23`
- 상세: `AGENT_MEMORY_MAX_PER_SCOPE = 1000` 상수가 코드 내부 상수임을 `naming_collision.md`에서 명시했고 spec에도 하드코딩 값으로 기술됐다. 그러나 운영 환경에서 이 값을 조정할 필요가 생겼을 때의 경로(환경변수화 또는 Workspace 설정화)가 v2 로드맵에 언급되지 않았다. 실무에서 scope 당 1000건이 충분하지 않은 경우를 위한 조정 경로가 없다.
- 제안: `spec/5-system/17-agent-memory.md §6 v2 로드맵`에 "scope 당 상한값(`AGENT_MEMORY_MAX_PER_SCOPE`) 의 환경변수 또는 워크스페이스 설정 노출" 항목을 추가 검토 사항으로 기재.

### [INFO] `spec/1-data-model.md §2.23` — `metadata` JSONB 스키마가 `17-agent-memory.md §3`과 완전 동기화돼 있지 않음
- 위치: `spec/1-data-model.md §2.23` (`AgentMemory`) 테이블
- 상세: `§2.23`의 `metadata` 필드 설명은 `{ source_node_id?, source_execution_id?, kind?, … }`로, `17-agent-memory.md §3`의 저장 shape 설명과 동일하다. 그러나 §3은 "분류 깊이는 구현 시 확정"이라 기술하며 향후 `metadata` 스키마가 확장될 수 있음을 암시한다. 두 문서 중 어느 것이 `metadata` 스키마의 단일 진실인지 명시가 없다.
- 제안: `spec/1-data-model.md §2.23`의 `metadata` 행 설명에 "상세 스키마 SoT: [Spec Agent Memory §3](./5-system/17-agent-memory.md)" 크로스 레퍼런스 추가.

### [INFO] `spec/conventions/conversation-thread.md §5.3` — 절 제목에서 `(v1 — char 기반)` 제거됐으나 본문에 명시 없음
- 위치: `spec/conventions/conversation-thread.md §5.3` 절 제목
- 상세: diff에서 `### 5.3 Cap (v1 — char 기반)` → `### 5.3 Cap (v1)`으로 변경됐다. 변경 의도(token-budget 방식이 추가되어 "char 기반"이 더 이상 전체 캡 메커니즘을 설명하지 않음)는 이해할 수 있으나, 절 제목 변경만으로 이유가 명시되지 않아 히스토리 없이 읽는 독자는 혼동할 수 있다. 동 §5.3 하단에 `memoryStrategy` 별 cap 메커니즘 분기 blockquote가 추가돼 있어 실질적인 설명은 있지만, 절 제목 변경 이유가 그 blockquote 앞에 한 줄 주석으로도 없다.
- 제안: `§5.3` 절 첫 단락 또는 기존 표 바로 앞에 "본 char-cap은 `memoryStrategy: 'manual'` 전용이다. `summary_buffer`/`persistent` 전략의 token-budget 메커니즘은 하단 참조." 한 줄 추가.

### [INFO] `spec/4-nodes/3-ai/1-ai-agent.md §1` — `memoryTokenBudget` 필드의 "char-기반 cap과 별개 메커니즘" 설명이 단방향 참조
- 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1` `memoryTokenBudget` 행
- 상세: `memoryTokenBudget` 행은 "char-기반 cap (contextScope 계열, [conversation-thread §5.3](../../conventions/conversation-thread.md#53-cap-v1--char-기반)) 과 별개 메커니즘"이라고 크로스 레퍼런스했다. 그러나 `conversation-thread §5.3`의 절 앵커 링크가 `#53-cap-v1--char-기반`로 되어 있는데, 절 제목이 `(v1 — char 기반)` → `(v1)`으로 변경됐으므로 앵커 해시도 달라졌을 수 있다. Markdown 앵커 자동 생성 방식에 따라 `#53-cap-v1`이 됐을 경우 dead link가 된다.
- 제안: `1-ai-agent.md §1`의 `memoryTokenBudget` 행 링크를 실제 앵커 값(`#53-cap-v1`)으로 수정 확인. 변경된 절 제목과 앵커 해시 일치 여부를 전수 점검.

### [INFO] `spec/0-overview.md` — "Agent Memory" 추가는 적절하나 시스템 공통 목록 업데이트만 반영됨
- 위치: `spec/0-overview.md` 시스템 공통 행
- 상세: diff에서 `spec/5-system/` 설명에 "Agent Memory" 한 단어가 추가됐다. 적절한 최소 업데이트이며, `spec/0-overview.md`의 전체 목적(cross-cutting 진입 문서)에 부합한다. 추가 조치 필요 없음.
- 제안: 현 상태 이상 없음.

### [INFO] 리뷰 산출물(`review/consistency/`) — 문서로서의 완결성 평가
- 위치: `review/consistency/2026/06/03/21_38_47/` 디렉터리 5개 파일
- 상세: 5개 consistency review 산출물 모두 "검토 모드 / 검토 대상 / 검토 일시" 헤더, 발견사항, 요약, 위험도 섹션을 포함하며 자체 문서로서의 완결성을 갖추고 있다. `meta.json`에 newline 누락(`\ No newline at end of file`)이 있으나 이는 파싱에 영향 없고 JSON 자체는 유효하다.
- 제안: `meta.json` 파일 끝에 개행 추가 (minor, lint 통과 목적).

---

## 요약

이번 변경(AI Agent 컨텍스트 메모리 기능 — `memoryStrategy`, `summary_buffer`, `persistent`, `AgentMemory` 엔티티, `spec/5-system/17-agent-memory.md` 신규)은 spec 문서화 수준이 전반적으로 높다. 신규 spec `17-agent-memory.md`는 Overview/본문/Rationale 3섹션 구조를 충실히 준수하고, 요구사항 ID 인라인 blockquote, 다수의 cross-reference 링크, 설계 결정 근거를 모두 포함한다. `spec/4-nodes/3-ai/1-ai-agent.md`의 `§12.9~§12.11` Rationale 섹션은 설계 결정의 이유와 기각된 대안을 명시적으로 기록한 좋은 사례다. 그러나 공통 규약 문서(`0-common.md §10`)와 개별 노드 문서(`1-ai-agent.md §1`) 사이의 미세한 정보 갭 — v1/v2 push 범위 기술 불일치, `memoryStrategy` 결정 근거 링크 누락, `includeToolTurns` 제한 누락, `contextInjectionMode` 무효화 관계의 conversation-thread 미반영 — 이 WARNING 4건으로 남아 있다. 이 갭들은 구현자가 두 문서 중 하나만 읽을 때 미묘한 동작을 놓칠 수 있는 지점이므로 구현 착수 전 보완이 권장된다. 반면 `spec/0-overview.md`, `spec/1-data-model.md`, `spec/4-nodes/_product-overview.md`, `spec/4-nodes/3-ai/_product-overview.md`의 업데이트는 모두 적절하며 신규 기능을 충실히 반영했다.

## 위험도

MEDIUM
