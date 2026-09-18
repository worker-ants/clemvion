# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-assistant-i18n-table-sync.md`

검토 모드: spec draft 검토 (`--spec`). target 은 `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 키 표(+ §3.2 divider 서술 · Rationale 서술 2곳)를 실제 사전(`dict/{ko,en}/assistant.ts`) 값에 맞추는 plan 이다.

## 사실관계 검증 (교차 확인)

target 이 인용하는 모든 코드측 근거를 직접 대조했다 — 전부 일치했다.

- `codebase/frontend/src/lib/i18n/dict/ko/assistant.ts` · `dict/en/assistant.ts`: target 이 "바꿀 값" 으로 제시한 13행(§13 표) 값이 실제 사전 값과 **문자 단위로 동일**(`planQuestionsHint`·`errorNoLlmConfig`·`errorRateLimit`·`opAdded/Updated/Removed`·`edgeAdded/Removed`·`exploreLookup/ExecutionsList/ExecutionDetails`·`executionNotInScope`·`autoResumedHint`). 신규 제안 키 `assistant.autoResumedHintShort` 도 ko/en 사전에 이미 그대로 존재.
- `codebase/frontend/src/lib/i18n/core.ts`: `INTERPOLATION_RE = /\{\{\s*(\w+)\s*\}\}/g` — 단일 중괄호 `{label}` 은 치환되지 않고 그대로 남는다는 target 의 주장과 일치.
- `codebase/frontend/src/components/editor/assistant-panel/assistant-message.tsx`: `RotateCw` 아이콘(`aria-hidden="true"`)이 `autoResumedHint`/`autoResumedHintShort` 문구 옆에 별도 렌더되고, `message.autoResume.max` 유무로 두 키를 분기 — target 의 §3.2·Rationale 서술 정정과 정확히 일치.
- §13 표의 line 번호(746·749·762·763·765~773)도 현재 spec 파일의 실제 라인과 정확히 일치.

이 정도 정합이면 target 의 "바꿀 값" 제안은 **날조·오기 없이 코드 실측에 기반**한다.

## 발견사항

- **[INFO]** Principle 3-C 인용이 순수 frontend 키에도 적용됨 (범위 확장 인용)
  - target 위치: "변경" 표 765~772행의 「근거」 컬럼 — "i18n-userguide Principle 3-C — `interpolate()` 의 이중 중괄호"
  - 위반 규약: `spec/conventions/i18n-userguide.md` §Principle 3-C (제목: "코드/동적 **backend** 메시지 localization (`ERROR_KO`·`GRAPH_WARNING_KO`)")
  - 상세: `assistant.opAdded`/`opUpdated`/`opRemoved`/`exploreLookup`/`exploreExecutionsList`/`exploreExecutionDetails` 는 backend 발행 동적 메시지가 아니라 순수 frontend dict 키(Principle 1·2 영역)다. Principle 3-C 본문은 명시적으로 "backend 가 message 를 params 와 함께 노출" 하는 `ERROR_KO`/`GRAPH_WARNING_KO` 매핑을 다루며, `{{name}}` 이중 중괄호 문구는 그 Principle 의 "보간 계약" 절 안에서 "기존 `core.ts` 의 `interpolate()` 컨벤션을 재사용" 이라는 종속 서술로만 등장한다. 즉 이중 중괄호 요구 자체는 `core.ts` 구현이 Principle 1/2 dict 값에도 동일하게 적용하는 **공유 메커니즘**이지만, 그 요구를 명시한 조문은 conventions 문서 안에 Principle 3-C 하나뿐이라 target 이 그것을 인용한 것은 이해할 만하다.
  - 제안: target 의 결론(단일→이중 중괄호로 고친다)은 정확하므로 값 변경 자체는 그대로 두되, 「근거」 문구를 "Principle 3-C(보간 계약; `core.ts` `interpolate()` 는 P1/2 dict 값에도 동일 적용)" 식으로 스코프를 명시하면 다음 사람이 Principle 3-C를 "이 값들도 backend 동적 메시지" 로 오독할 소지를 없앤다. 또는 `spec/conventions/i18n-userguide.md` 쪽에서 이중 중괄호 요구를 Principle 2(ko/en parity) 근처로 승격해 명시하는 편집도 고려할 수 있다(규약 갱신 쪽 대안).

## 준수 확인된 항목 (규약 위반 아님 — 참고용)

- **글로서리 §2 "Edge → 연결선"·"Workflow → 워크플로우"**: `edgeAdded`/`edgeRemoved`/`executionNotInScope` 행 수정이 정확히 이 표기로 수렴 — `spec/conventions/i18n-userguide.md` Principle 6 이 가리키는 `_glossary.md` §2 표와 일치.
- **글로서리 §5 "「넣어주세요」류 수동태 지양 → 능동태 해요체"**: `planQuestionsHint`/`errorNoLlmConfig`/`errorRateLimit` 행 수정이 이 항목과 일치.
- **Principle 6-B (내부 SoT 노출 금지)**: 이 원칙은 스코프가 `codebase/frontend/src/content/docs/**`(사용자 가이드)로 한정돼 있어 `spec/**` 내부 엔지니어링 문서에는 적용되지 않는다 — target 이 spec 본문에서 `assistant.autoResumedHint`/`assistant.autoResumedHintShort` 같은 내부 식별자를 그대로 쓰는 것은 위반이 아니다.
- **스코프 판단**: `spec/3-workflow-editor/4-ai-assistant.md` §1 개요 등 본문 산문에 남아있는 "엣지" 표현(글로서리 대상 밖 — 그 절은 UI 노출 문자열이 아니라 설계 서술)은 target 이 손대지 않았다. 이는 글로서리 적용 범위(Principle 6: "사용자 가이드 본문 + **UI 사용자 가시 한국어 문자열**")를 정확히 좁게 잡은 것으로, 과다 수정(글로서리 밖 산문까지 고치는) 오류를 피했다.
- **문서 구조**: target spec 파일은 이미 Overview(§1 개요)/본문(§2~§15)/Rationale 3섹션 구조를 갖추고 있고, target 은 본문 표·서술 값만 교체할 뿐 구조를 건드리지 않는다 — CLAUDE.md 문서 구조 컨벤션과 충돌 없음.
- **표 포맷**: 신규 추가 행(§B, `assistant.autoResumedHintShort`) 의 컬럼(`키`/`한국어`/`영어`)이 대상 §13 표의 기존 헤더와 정확히 일치 — 삽입 시 표 스키마 붕괴 없음.

## 요약

target plan 은 `spec/3-workflow-editor/4-ai-assistant.md` §13 i18n 표 + §3.2 divider 서술 + Rationale 서술을 실제 사전(`dict/{ko,en}/assistant.ts`)·컴포넌트 구현에 맞춰 정정하는 문서로, 제시된 모든 "바꿀 값"·코드 근거를 직접 대조한 결과 **날조나 오기 없이 실측에 기반**했다. 제안된 변경은 glossary 금지어("엣지"→"연결선", "워크플로"→"워크플로우") 제거, 해요체·능동태 통일(글로서리 §5), 이중 중괄호 보간 계약(Principle 3-C) 준수라는 세 축에서 모두 `spec/conventions/i18n-userguide.md` 규약을 **위반이 아니라 그 방향으로 정정**한다. 유일한 지적은 Principle 3-C 인용이 본래 backend 동적 메시지(`ERROR_KO`/`GRAPH_WARNING_KO`) 스코프인데 순수 frontend dict 키에도 적용된 것으로 보이는 인용 정밀도 문제이며, 결론(중괄호 값)은 정확하므로 CRITICAL/WARNING 이 아닌 INFO 로 분류했다. `spec/**` 내부 문서라 Principle 6-B(내부 SoT 노출 금지)는 적용 대상이 아니며, 글로서리 스코프도 정확히 좁게(§13 표 = UI 노출 문자열) 적용해 과다 수정을 피했다.

## 위험도

LOW
