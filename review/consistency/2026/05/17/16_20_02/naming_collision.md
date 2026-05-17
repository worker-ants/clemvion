# 신규 식별자 충돌 검토 결과

## 검토 대상

- 모드: 구현 착수 전 검토 (`--impl-prep`)
- 범위: `frontend/src/lib/websocket` (구체적으로 `apply-execution-snapshot.ts` 수정)
- 작업 계획: `plan/in-progress/agent-session-restore-on-rejoin.md` — AI Agent 대화 세션 재진입 시 메시지 복원

## 발견사항

해당 작업이 도입하거나 재사용하는 식별자 전체를 아래 6개 점검 관점에 대입해 분석하였다.

### 요약된 식별자 목록

작업 계획에 따르면 `apply-execution-snapshot.ts` 의 `ai_conversation` 분기(기존 lines 223–227)에 다음 두 심볼을 추가 호출한다.

| 심볼 | 구분 | 현재 위치 |
|---|---|---|
| `parseHistoryMessages` | 함수 (기존 export 재사용) | `frontend/src/lib/conversation/conversation-utils.ts:268` |
| `setConversationMessages` | Zustand 액션 (기존 재사용) | `frontend/src/lib/stores/execution-store.ts:159,389` |

---

### 점검 1 — 요구사항 ID 충돌

새로 부여되는 요구사항 ID 없음. 작업 계획에 ID 신규 발급 없음.

**결론: 해당 없음.**

### 점검 2 — 엔티티/타입명 충돌

새 엔티티·DTO·인터페이스·타입 도입 없음. 기존 `ConversationItem`, `ConversationConfig` 등을 그대로 사용.

**결론: 해당 없음.**

### 점검 3 — API endpoint 충돌

백엔드 변경 없음. 신규 endpoint 없음.

**결론: 해당 없음.**

### 점검 4 — 이벤트/메시지명 충돌

WebSocket 이벤트 이름 신규 추가 없음. 기존 이벤트 처리 경로 내 store 액션 호출만 추가됨.

**결론: 해당 없음.**

### 점검 5 — 환경변수·설정키 충돌

환경변수·설정 키 신규 추가 없음.

**결론: 해당 없음.**

### 점검 6 — 파일 경로 충돌

신규 파일 생성 없음. 기존 `apply-execution-snapshot.ts` 수정만 수행. 테스트 파일(`__tests__/apply-execution-snapshot.test.ts`)도 이미 존재하는 파일에 케이스 추가.

**결론: 해당 없음.**

---

## 추가 관찰 (INFO 수준)

- **[INFO]** `parseHistoryMessages` 의 임포트 경로 일관성
  - target 신규 식별자: `apply-execution-snapshot.ts` 에서 첫 임포트가 예정된 `parseHistoryMessages`
  - 기존 사용처: `page.tsx`·`result-detail.tsx`·`result-timeline.tsx` 는 `@/components/editor/run-results/conversation-utils` (re-export 래퍼) 를 사용; `@/lib/conversation/conversation-utils` 는 정식 canonical 경로
  - 상세: `apply-execution-snapshot.ts` 는 `frontend/src/lib/websocket/` 레이어에 속하므로, 계층 역전을 피하려면 컴포넌트 경로(`@/components/…`)보다 canonical lib 경로(`@/lib/conversation/conversation-utils`) 에서 직접 임포트하는 것이 계층 규약에 부합한다. `@/components/editor/run-results/conversation-utils.ts` 의 주석도 "lib/websocket/ 에서 계층 역전 없이 쓸 수 있도록 canonical lib 경로로 이동했다"고 명시하고 있다.
  - 제안: 임포트를 `@/lib/conversation/conversation-utils` 에서 직접 수행할 것. 충돌은 아니지만 계층 규약 준수를 위해 확인 권장.

---

## 요약

`frontend/src/lib/websocket/apply-execution-snapshot.ts` 수정 작업은 기존에 이미 정의·export 된 `parseHistoryMessages`(`@/lib/conversation/conversation-utils.ts`)와 `setConversationMessages`(execution-store) 를 재사용하는 것이 전부다. 신규 식별자(요구사항 ID, 엔티티명, API endpoint, 이벤트명, 환경변수, 파일 경로) 를 하나도 도입하지 않으므로 명명 충돌 위험이 없다. 임포트 경로의 계층 규약 준수 여부만 구현 시 확인하면 충분하다.

## 위험도

NONE
