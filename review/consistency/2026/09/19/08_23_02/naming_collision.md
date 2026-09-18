# 신규 식별자 충돌 검토 — `spec-draft-assistant-i18n-table-sync.md`

## 검토 범위 확인

target 이 도입하는 신규 식별자를 목록화했다.

- **§13 표 A그룹(13행)**: 키·순서 불변, **값만** 교체(`assistant.planQuestionsHint` 외 12개). 신규 식별자 없음.
- **§13 표 B그룹**: 새 표 행 1개 — 키 `assistant.autoResumedHintShort` (ko/en 값 포함).
- **§3.2 divider 서술 정정 · Rationale 프론트 변경 서술 정정**: 프로즈 수정, 신규 식별자 없음.
- 신규 요구사항 ID·엔티티/DTO·API endpoint·webhook/queue/SSE 이벤트명·ENV/설정키·spec 파일 경로 — 전부 **없음**(target 은 기존 spec 파일 하나의 표·서술만 고치는 문서 정정이다).

따라서 이 target 에서 "신규 식별자 충돌" 관점으로 검사할 유일한 후보는 `assistant.autoResumedHintShort` 키다.

## 검증

1. **키의 실제 출처** — `codebase/frontend/src/lib/i18n/dict/ko/assistant.ts:20`, `codebase/frontend/src/lib/i18n/dict/en/assistant.ts:22` 에 이미 존재:
   - ko: `자동으로 이어서 진행했어요 ({{attempt}}번째)`
   - en: `Auto-resumed (attempt {{attempt}})`
   target 의 B그룹 표 값과 **한 글자 단위로 일치**한다.
2. **사용처** — `codebase/frontend/src/components/editor/assistant-panel/assistant-message.tsx:144,151`에서 `message.autoResume.max === undefined` 분기의 `t("assistant.autoResumedHintShort", {...})` 로 이미 실사용 중이다. 즉 이 키는 코드에는 이미 있고, target 은 **spec §13 표에 누락돼 있던 것을 뒤늦게 채우는** 것이다 — 새 의미를 발명하는 것이 아니다.
3. **spec 내 기존 사용 여부** — `spec/3-workflow-editor/4-ai-assistant.md` 전체에서 `autoResumedHintShort` grep 결과 0건(§13 표에는 `assistant.autoResumedHint`만 749행에 있음). 즉 spec 문서 안에서 이 식별자가 **다른 의미로 이미 쓰이고 있지 않다** — 충돌 없음.
4. **명명 컨벤션 정합성** — 프로젝트 내 `*Short` 접미사는 `oauthFailedShort`·`testFailedShort`·`loadingShort`·`roleUpdateFailedShort` 등 "동일 개념의 축약형" 패턴으로 이미 일관되게 쓰인다. `autoResumedHint` → `autoResumedHintShort` 도 같은 패턴(진행도 있는 버전 vs 순번만 있는 축약 버전)이라 명명 관례상 이질감이 없다.
5. **다른 신규 식별자 후보 재확인** — A그룹 13행은 키 이름 자체를 바꾸지 않으므로 요구사항 ID·엔티티·API·이벤트명·ENV 키 층위에는 아무 영향이 없다. C그룹(§3.2 divider·Rationale 프로즈)도 새 용어를 도입하지 않고 기존 `assistant.autoResumedHint`/`autoResumedHintShort` 를 가리킬 뿐이다.

## 발견사항

없음 — target 이 도입하는 유일한 신규 식별자(`assistant.autoResumedHintShort`)는 이미 codebase 사전·컴포넌트에 존재하는 키를 spec 문서에 뒤늦게 반영하는 것이며, spec 내 기존 용법과도, 다른 도메인(요구사항 ID·엔티티·API endpoint·이벤트명·ENV 키·파일 경로)과도 충돌하지 않는다.

## 요약

target 문서는 새 개념·새 API·새 파일을 만드는 것이 아니라 기존 spec 표의 값을 실제 사전 값에 맞추는 정정이며, 유일하게 spec에 새로 추가되는 식별자 `assistant.autoResumedHintShort`도 이미 코드(사전 파일 2곳 + 렌더 컴포넌트 1곳)에 정확히 같은 값·같은 의미로 존재해 문서가 실재를 뒤따라가는 경우다. 신규 식별자 충돌 관점에서 지적할 사항이 없다.

## 위험도

NONE
