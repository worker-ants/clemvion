# 변경 범위(Scope) 리뷰

## 발견사항

변경 의도는 커밋 메시지에 명시된 3건이다:
1. 캐러셀 버튼 클릭 후 presentation 노드 메시지 미표시 버그 수정 (`execution.message` 이벤트 신설)
2. 미리보기 세션 초기화 (`wc:command resetSession`)
3. 미리보기 2-column 배치 UX 개선

### 발견사항

모든 17개 파일 변경을 점검한 결과, 범위 위반 사항이 발견되지 않았다.

**파일 1 (`presentation.ts` 신설):** 공용 상수 `PRESENTATION_NODE_TYPES` 신설. 엔진과 chat-channel 공유 목적으로 plan(Phase 1 step 2)에 명시된 의도적 분리. NONE.

**파일 2 (`chat-channel.dispatcher.ts`):** 로컬 `PRESENTATION_NODE_TYPES` 제거 후 공용 모듈 import 로 대체. 의도된 중복 제거(plan I9). NONE.

**파일 3 (`execution-engine.service.spec.ts`):** 신규 `execution.message` 발행·미발행 단위 테스트 추가. plan Phase 5 step 1 의무. NONE.

**파일 4 (`execution-engine.service.ts`):** non-blocking presentation 노드 완료 시 `EXECUTION_MESSAGE` 추가 발행. plan Phase 1 step 3 핵심 구현. NONE.

**파일 5 (`websocket.service.ts`):** `ExecutionEventType.EXECUTION_MESSAGE` enum 값 추가. plan Phase 1 step 1 의무. NONE.

**파일 6 (`eia-events.test.ts`):** `parseMessage` 단위 테스트 3개 추가. plan Phase 5 step 3 의무. NONE.

**파일 7 (`eia-events.ts`):** `parseMessage` 함수 추가. plan Phase 2 step 1 의무. NONE.

**파일 8 (`eia-types.ts`):** `ExecutionMessageEvent` 타입 신설 + `EiaEventName` 유니언 확장. plan Phase 2 W6·W7 의무. NONE.

**파일 9 (`use-widget.ts`):** `execution.message` 이벤트 핸들러 추가 + `apiRef`에 `newChat` 추가 + `resetSession` command 핸들러. plan Phase 2 step 2·3 의무. NONE.

**파일 10 (`page.tsx`):** 2-column grid 레이아웃 적용. plan Phase 3 step 2 의무. 기존 카드 컴포넌트가 단순 래핑 구조로 재배치된 것이며 기능 변경 없음. NONE.

**파일 11 (`live-preview.tsx`):** `postCommand` 헬퍼 추가 + "새 세션" 버튼 추가. plan Phase 3 step 1 의무. NONE.

**파일 12 (`en/webChat.ts`):** `preview.reset`·`preview.resetHint` i18n 키 추가. "새 세션" 버튼에 필요한 영문 번역. NONE.

**파일 13 (`ko/webChat.ts`):** `preview.reset`·`preview.resetHint` i18n 키 추가. 한국어 번역. NONE.

**파일 14 (`plan/in-progress/web-chat-preview-improvements.md`):** 작업 plan 파일 신설. frontmatter 포함 작업 추적 문서. NONE.

**파일 15 (`spec/5-system/14-external-interaction-api.md`):** §5.2 `execution.message` 이벤트 명세·payload·R18 Rationale 추가. plan Phase 4 step 1 의무. NONE.

**파일 16 (`spec/7-channel-web-chat/2-sdk.md`):** §3 테이블에 `resetSession` 추가 + 설명 bullet 추가. plan Phase 4 step 2 의무. NONE.

**파일 17 (`spec/7-channel-web-chat/5-admin-console.md`):** §6 에 presentation 노드 렌더·2-column 레이아웃·세션 초기화 명세 추가 + R7 Rationale 추가. plan Phase 4 step 3 의무. NONE.

## 요약

총 17개 파일 변경 전체가 커밋 메시지 및 plan(`web-chat-preview-improvements.md`)에 명시된 3건 개선(presentation 노드 `execution.message` 버그 수정 / 세션 초기화 / 2-column 배치)의 직접 필수 구성 요소다. 공용 상수 추출(`PRESENTATION_NODE_TYPES`)은 의존 방향 위반 방지를 위해 plan에 명시된 의도적 리팩토링이다. 불필요한 포맷팅 변경, 무관한 파일 수정, 주석 과잉, 미사용 임포트 추가 등 범위 외 변경은 발견되지 않았다.

## 위험도

NONE
