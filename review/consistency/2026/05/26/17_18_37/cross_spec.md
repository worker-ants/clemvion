# Cross-Spec 일관성 검토 결과

- 검토 모드: `--impl-prep`
- 대상 영역: `spec/4-nodes/3-ai/` (0-common.md / 1-ai-agent.md / 2-text-classifier.md / 3-information-extractor.md)
- 검토 일자: 2026-05-26

---

## 발견사항

### [INFO] AI 노드 설정 패널의 `model` 필드 — select-only 정책 범위 명시 충분하나 동기화 권장

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §1`, `2-text-classifier.md §1`, `3-information-extractor.md §1` — `model` 필드가 `String (Expression 가능)` / `String` 타입으로 자유 입력 허용
- 충돌 대상: `spec/2-navigation/6-config.md §B.2 + Rationale R-1 (2026-05-26)`
- 상세: LLM Config 화면의 `defaultModel` 필드는 2026-05-26에 select-only 로 전환됐다. R-1 Rationale 에 "AI 노드 설정 패널의 `model` 필드는 Expression 허용이 그대로 유지된다"는 범위 한정 문장이 명시되어 있어 직접 모순은 아니다. 그러나 `spec/4-nodes/3-ai/` 세 노드 문서에는 이 정책 경계에 대한 forward reference 가 없다 — 구현자가 LLM Config 의 select-only 변경이 AI 노드 `model` 필드에는 적용되지 않는다는 사실을 단방향 참조만으로 확인해야 한다.
- 제안: `1-ai-agent.md §1` config 표의 `model` 행 설명 또는 `0-common.md §1 LLM 모델/Config 선택` 에 `LLMConfig.defaultModel` 의 select-only 정책과 노드 `model` 필드의 Expression 허용이 별개 책임임을 한 줄 명시. 선택 사항 — 충돌은 아니므로 구현 착수 전에 반드시 수정할 필요는 없음.

---

### [INFO] `spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델` — select-only 적용 범위 교차 참조 누락

- target 위치: `spec/4-nodes/3-ai/0-common.md §2 Knowledge Base 연동` — `knowledgeBases: UUID[]` 필드 정의
- 충돌 대상: `spec/2-navigation/6-config.md §Rationale R-1` — "동일 결정을 임베딩 모델 선택에도 적용"이라는 언급
- 상세: R-1 은 `spec/2-navigation/5-knowledge-base.md §2.2 임베딩 모델` 에도 select-only 가 적용됨을 언급한다. AI 노드의 KB 연동 spec 에서는 이 변경이 KB 화면 임베딩 모델 선택 UX 에 미치는 영향이 없으므로 직접 충돌은 없다. 다만 KB를 사용하는 AI 노드가 implicitly 의존하는 KB 구성 화면에 최근 UX 변경이 있었음을 target spec 이 언급하지 않아, 구현자가 KB 화면과의 연계를 파악하는 데 추가 탐색이 필요하다.
- 제안: 필수 변경 아님. 필요하다면 `0-common.md §2` 의 "관련 문서" 줄에 `spec/2-navigation/5-knowledge-base.md` 를 추가.

---

### [INFO] `meta.interactionType` 값 `'ai_form_render'` — interaction-type-registry 와 단방향 참조 관계 확인 필요

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii`, `§7.4` — `interactionType: 'ai_form_render'`
- 충돌 대상: `spec/conventions/interaction-type-registry.md` — `ai_form_render` 값이 registry 에 등록되어 있고 SoT 를 `interaction-type-registry.md` 로 명시
- 상세: `1-ai-agent.md §6.1.d.ii` 와 `§7.4` 에서 `interactionType: 'ai_form_render'` 와 `'ai_conversation'` 을 직접 기술한다. `interaction-type-registry.md` 가 이 값들의 단일 진실 공급원으로 기능하고 있으며, 두 문서의 정의가 일치한다 — 충돌은 없다. AI Agent 의 기술이 registry 의 내용을 중복 정의하는 형태이므로 drift 가능성은 존재한다.
- 제안: 정합 상태이므로 즉각 조치 불필요. 향후 registry 값 변경 시 AI Agent spec 도 동반 갱신 필요함을 개발 시 인지.

---

### [INFO] `spec/4-nodes/3-ai/0-common.md §11.3 Timezone SoT` — `spec/1-data-model.md §2.2 Workspace.settings.timezone` 정합 확인

- target 위치: `spec/4-nodes/3-ai/0-common.md §11.3` — `Workspace.settings.timezone` 을 1차 SoT 로 열거
- 충돌 대상: `spec/1-data-model.md §2.2 Workspace` — `settings JSONB` 의 `timezone: string?` 필드 정의
- 상세: `0-common.md §11.3` 은 `Workspace.settings.timezone` 을 precedence 1 로 참조하고, `1-data-model.md §2.2` 는 `settings` JSONB 의 알려진 키로 `timezone: string? (IANA)` 를 기재하며 "AI 노드의 System Context Prefix ([Spec AI 공통 §11.3])" 와 "Schedule 의 default timezone" 이 본 값을 참조한다고 명시한다. 양쪽이 일관되게 cross-reference 하고 있어 정합 상태다.
- 제안: 없음. 정합 상태 확인.

---

### [INFO] `_retryState` DB 보존 정책 — `spec/conventions/node-output.md Principle 4.2.1` 와 AI Agent `§7.4 / §7.9` 기술의 일치 확인

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.4 (표)`, `§7.9` — `_resumeState` 는 `stripControlFields()` 가 무조건 제거, `_retryState` 는 DB 보존 예외
- 충돌 대상: `spec/conventions/node-output.md Principle 4.2.1` — 동일 정책 정의
- 상세: AI Agent spec 의 두 필드 생명주기 비교 표는 `node-output.md Principle 4.2.1` 의 정의와 정확히 일치한다. 단일 진실 공급원은 `conventions/node-output.md` 이고, AI Agent spec 은 cross-ref 를 명시하고 있으므로 충돌 없음.
- 제안: 없음.

---

### [INFO] `output.result.presentations[]` echo — `spec/conventions/conversation-thread.md §1.2` 및 `§4 영속화` 와의 관계

- target 위치: `spec/4-nodes/3-ai/1-ai-agent.md §7.10` — `output.result.presentations[]` 를 execution history 복원용 echo 로 정의
- 충돌 대상: `spec/conventions/conversation-thread.md §1.2` (ConversationTurn `presentations[]` 가 1차 SoT)
- 상세: AI Agent spec `§7.10` 은 두 위치가 의도된 echo 임을 명시하고, `conversation-thread.md §1.2` 는 cross-ref 만 두도록 설계되어 있다. 실제 문서도 이 규약에 따라 작성되어 있어 충돌 없음.
- 제안: 없음.

---

### [INFO] Text Classifier `CategoryDef.id` — `class_${i}` fallback 과 엣지 `source_port` 값 정합

- target 위치: `spec/4-nodes/3-ai/2-text-classifier.md §1 CategoryDef`, `§3.2 출력 포트`
- 충돌 대상: `spec/1-data-model.md §2.7 Edge.source_port`, `spec/3-workflow-editor/2-edge.md`
- 상세: Text Classifier 의 동적 포트 id 가 `category.id` 또는 `class_${i}` 로 결정되고, 이 값이 Edge 의 `source_port` 로 저장된다. Edge 는 `source_port: String` 으로 자유 형식이므로 데이터 모델상 충돌 없음. `§1` 의 마이그레이션 주의 노트가 이 결정을 명시하고 있어 일관성 유지.
- 제안: 없음.

---

## 요약

`spec/4-nodes/3-ai/` 영역은 다른 spec 영역들과 구조적 충돌 없이 잘 정합되어 있다. LLM Config 화면의 select-only 전환 (2026-05-26 신규) 이 AI 노드 `model` 필드에는 미적용임을 Rationale R-1 이 명시하고 있어 직접 모순은 없으나, AI 노드 spec 측에 역방향 cross-reference 가 없다. 나머지 발견사항은 모두 cross-reference 누락 또는 동기화 권장 수준이며, 어느 항목도 구현을 차단할 CRITICAL/WARNING 수준의 모순에 해당하지 않는다. 구현 착수 전 spec 변경이 필요한 사항은 없다.

## 위험도

NONE
