# Rationale 연속성 검토 결과

검토 대상: `spec/4-nodes/3-ai/1-ai-agent.md`
검토 기준: 기존 spec Rationale 섹션과의 연속성 (기각 대안 재도입 / 합의 원칙 위반 / 무근거 번복 / invariant 충돌)

---

## 발견사항

### [INFO] D6 결정이 `## Rationale` 대신 §7.5 본문 인라인에 기술됨

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §7.5 (Multi Turn 모드 — 사용자 메시지 수신) 본문 노트
- **과거 결정 출처**: 프로젝트 규약 `CLAUDE.md` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`"
- **상세**: D6 결정 (`output.messages` / `.message` / `.turnCount` 을 옛 top-level 에서 `output.result.*` 단일 경로로 통일, 옛 경로 폐기)은 output schema 구조에 대한 ADR 급 결정임에도 §12 Rationale 섹션이 아니라 §7.5 본문 인라인 노트(`> **D6 결정**: ...`)에 기술돼 있다. `§12.1~§12.14` 가 다른 모든 주요 결정을 수용하는 것에 비해 D6만 본문에 인라인으로 남아 있다.
- **제안**: D6 결정을 `§12.15 D6 — output.result.* 단일 경로 통일` 로 Rationale 섹션에 이전하거나, §7.5 인라인 노트에 `(결정 근거: §12.15)` 형태로 교차참조를 추가한다.

---

### [INFO] §12.12 "현 결정(번복)" 및 "후속 결정" 단락에 superseded 위젯명 stale 잔존

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §12.12 "후속 결정" 단락
- **과거 결정 출처**: §12.12 "재번복 결정" — `embedding-config-selector` / `chat-config-selector` (config.id 저장)으로 확정
- **상세**: "후속 결정" 단락은 `⚠️` 마커와 함께 "재번복 결정 단락에서 대체됐다"는 고지가 붙어 의사결정 이력용으로 보존 중이다. 그러나 단락 내 위젯명 `embedding-model-selector` / `chat-model-selector` 가 현재 코드베이스에서 폐기된 이름으로 남아 있어, 신규 독자가 현행 위젯과 혼동할 수 있다. `⚠️` 고지가 존재하므로 Rationale 위반은 아니지만 참조 신뢰도가 낮다.
- **제안**: "후속 결정" 단락 첫 문장의 `⚠️` 고지 뒤에 `(현행 위젯: embedding-config-selector / chat-config-selector)` 를 한 줄 추가해 독자 혼란을 줄인다.

---

### [INFO] §4 `ToolOverride` 구조 테이블이 제거된 기능 섹션에 상세 기술 잔존

- **target 위치**: `spec/4-nodes/3-ai/1-ai-agent.md` §4 "Tool Area 연동" — ToolOverride 구조 표 (`nodeId` / `toolName` / `toolDescription` / `inputMapping`)
- **과거 결정 출처**: 동일 문서 §1 `toolNodeIds` / `toolOverrides` 필드 제거 경고 (`⚠️ **도구 연결 입력 경로 — 재작성 예정 (현재 제거됨)**`)
- **상세**: §4 섹션 전체가 `⚠️ **재작성 예정 (현재 제거됨)**` 경고 하에 있어 기능이 비활성임을 명시하고 있다. 그러나 ToolOverride 4컬럼 구조 테이블이 마치 현행 spec처럼 상세 기술되어 있어, 신규 개발자가 이 구조를 구현 참조로 오인할 가능성이 있다. pending_plan `ai-agent-tool-connection-rewrite.md` 가 진행 중이므로 새 설계 결정이 이 구조를 바꿀 수 있다.
- **제안**: ToolOverride 구조 테이블 앞에 `(이하 비활성 — 재작성 설계 결정 전까지 참조 금지)` 주석을 추가하거나, 테이블을 접힌 `<details>` 블록으로 처리해 현행 spec 으로 오독되는 것을 방지한다.

---

## 요약

`spec/4-nodes/3-ai/1-ai-agent.md` 는 Rationale 연속성 관점에서 전반적으로 매우 우수한 관리 상태다. 주목할 결정 번복(§12.12 summaryModel 전용 필드 → 모델명 문자열 → ModelConfig config.id의 3단계, §12.5 form 인라인 통합, §12.8 retry downstream 진행, §12.10 v1/v2 경계 재정의) 이 모두 명시적 `⚠️` 마커와 함께 번복 근거를 갖추고 있으며, 기각된 대안 — `contextScope enum auto 추가`(§12.9), `render_*` error 포트 발화(§12.4), `rendered:false` 가드 필드(§12.6), downstream 차단형 retry(§12.8) — 은 각 Rationale 항에서 기각 사유가 명시돼 있다. 발견된 3개 항목은 모두 INFO 등급으로, 기각된 대안의 재도입이나 합의 원칙의 직접 위반에 해당하는 CRITICAL/WARNING은 없다.

---

## 위험도

LOW
