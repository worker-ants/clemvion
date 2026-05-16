# 신규 식별자 충돌 검토 (naming_collision)

검토 모드: `--impl-prep`
대상 스코프: `spec/4-nodes/3-ai/0-common.md`, `spec/4-nodes/4-integration/4-cafe24.md`, `spec/5-system/5-expression-language.md`, `spec/conventions/conversation-thread.md`

---

## 발견사항

### [INFO] `ConversationThread.id = "default"` 값과 Edge port 예약어 `"default"` 의 namespace 혼동 가능성
- **target 신규 식별자**: `ConversationThread.id` — 고정값 `"default"` (v1 single-thread)
- **기존 사용처**: `spec/1-data-model.md §2.7 Edge.source_port` 및 `spec/3-workflow-editor/2-edge.md` 에서 포트 예약어 `"default"` 가 출력 포트 기본값으로 사용됨
- **상세**: `spec/conventions/conversation-thread.md §1.3` 는 이미 "port 예약어 `'default'` 와 무관 — namespace 분리. 코드에서 `DEFAULT_THREAD_ID = 'default'` 상수 추출 권장" 이라고 명시한다. 두 `"default"` 는 서로 다른 도메인(thread ID vs. port 이름)에 속하며 런타임 충돌은 없다. 단, 사용자 매뉴얼(MDX)에서 `$thread` 변수를 설명할 때 port `"default"` 와의 의미 차이를 독자가 혼동하지 않도록 문맥을 분리하는 것이 바람직하다.
- **제안**: MDX docs 에 `$thread` 소개 시 "thread ID `default`" 라는 내부 구현 상세는 노출하지 않고 변수 접근 방법(`.turns` / `.length` / `.text`)만 설명하면 충분. spec 레벨의 명세는 이미 정합되어 있으므로 spec 변경 불필요.

---

### [INFO] `application.ts` Cafe24 메타데이터 파일명과 Cafe24 OAuth `app_type` 개념의 혼동 가능성
- **target 신규 식별자**: `backend/src/nodes/integration/cafe24/metadata/application.ts` — Cafe24 "앱 관리 API" 카테고리의 Operation 메타데이터 파일
- **기존 사용처**: `spec/1-data-model.md §2.10 Integration.credentials` 의 `app_type` (public / private), `spec/2-navigation/4-integration.md §5.8` 의 Cafe24 Private App 등록 흐름에서 "application" / "앱" 용어가 반복 사용됨
- **상세**: `spec/conventions/cafe24-api-metadata.md §1` 이 이미 "⚠ Cafe24 앱 관리 API — OAuth 앱 등록(credentials.app_type)과 무관. naming collision 주의" 라고 명시해 선제적으로 경고하고 있다. 런타임 충돌은 없으며 spec 차원에서도 이미 인지·문서화된 상태이다.
- **제안**: 기존 spec 주의 표기로 충분. 개발자가 `application.ts` 파일명이 OAuth app 등록과 무관함을 코드 주석으로도 명시하면 혼동이 줄어든다. spec 수정 불필요.

---

## 요약

이번 구현 착수 전 검토(`--impl-prep`) 의 대상은 기존 spec 파일 4종을 1차 소스로 삼아 MDX 사용자 매뉴얼을 보강하는 작업이다. target 문서 자체에 신규 식별자 내용이 없으며(`(없음)` 표기), 보강에 사용될 식별자(`contextScope` / `contextScopeN` / `contextInjectionMode` / `includeToolTurns` / `excludeFromConversationThread` / `$thread` 변수 및 하위 속성 / `ConversationTurnSource` · `ConversationTurn` · `ConversationThread` 타입 / Cafe24 노드)는 모두 spec 에서 일관되게 정의되어 있고 기존 사용처와 의미 충돌이 없다. `ConversationThread.id = "default"` 와 Edge port 예약어 `"default"`, `application.ts` 와 OAuth app 개념의 잠재 혼동은 spec 자체에서 이미 명시적으로 경고·분리되어 있다. 구현을 차단할 CRITICAL·WARNING 수준의 식별자 충돌은 발견되지 않았다.

## 위험도

NONE
