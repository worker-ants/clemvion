# 변경 범위(Scope) 리뷰

## 발견사항

이번 변경의 의도된 범위는 커밋 메시지에 명시된 3가지다:
1. presentation 노드 비차단 완료 시 `execution.message` 이벤트 신설(버그 수정)
2. 라이브 미리보기 세션 초기화 (`resetSession` command)
3. 미리보기 2-column 배치 (UX 개선)

**범위 내 변경으로 판단된 사항**:
- 파일 1 (`presentation.ts` 공용 상수): 엔진·chat-channel 중복 정의 제거를 위해 신설. 의존 방향 위반 방지용 필수 리팩토링이며, 기존 로컬 Set(파일 2에서 삭제됨)의 단순 이전 — 범위 내.
- 파일 2 (`chat-channel.dispatcher.ts`): 로컬 `PRESENTATION_NODE_TYPES` Set 제거 후 공용 상수 import로 교체 — 순수 단일화, 범위 내.
- 파일 3 (spec 테스트): 엔진 emit/미발행 unit test 2개 신설 — 범위 내.
- 파일 4 (`execution-engine.service.ts`): presentation 노드 한정 `execution.message` 발행 로직 삽입 — 범위 내.
- 파일 5 (`websocket.service.ts`): `EXECUTION_MESSAGE` enum 멤버 및 JSDoc 추가 — 범위 내.
- 파일 6 (`eia-events.test.ts`): `parseMessage` 단위 테스트 4건 추가 — 범위 내.
- 파일 7 (`eia-events.ts`): `parseMessage` 함수 및 `ParsedMessage` 인터페이스 추가 — 범위 내.
- 파일 8 (`eia-types.ts`): `ExecutionMessageEvent` 인터페이스, `EiaEventName` 유니언 추가 — 범위 내.
- 파일 9 (`use-widget.ts`): `execution.message` 핸들러 분기 + `newChat`을 `apiRef`에 추가 + `resetSession` command 처리 — 범위 내(2·3번 개선 포함).
- 파일 10 (`page.tsx`): 3-Card 세로 stack → 2-column grid 배치 변환 — 범위 내.
- 파일 11 (`live-preview.tsx`): `postCommand` 헬퍼 + "새 세션" 버튼 UI 추가 — 범위 내.
- 파일 12·13 (i18n en/ko): `preview.reset`·`preview.resetHint` 키 추가 — 범위 내.
- 파일 14 (plan): 작업 plan 문서 신설 — 범위 내.
- 파일 15 (`14-external-interaction-api.md`): `execution.message` §5.2 명세 + R18 rationale 추가 — 범위 내(spec impact에 명시된 파일).
- 파일 16 (`2-sdk.md`): `resetSession` wc:command 표 항목 + 설명 추가 — 범위 내(plan Phase 4 명시).
- 파일 17 (`5-admin-console.md`): §6 미리보기 설명 3개 bullet + R7 rationale 추가 — 범위 내.

**범위 이탈 가능성 검토**:

- **[INFO]** `use-widget.ts` `apiRef`에 `newChat` 추가 (파일 9)
  - 위치: `apiRef.current = { ..., newChat }` 두 곳
  - 상세: `resetSession` command 처리를 위해 `newChat`을 `apiRef`에 포함한 것은 직접 필요다. `newChat` 함수 자체는 기존에 이미 widget에 정의된 함수를 재노출하는 것으로 새로운 기능 추가가 아니다. 범위 내 필수 변경.
  - 제안: 해당 없음(범위 내).

- **[INFO]** `PRESENTATION_NODE_TYPES` 상수를 공용 모듈로 분리한 것은 chat-channel.dispatcher.ts의 기존 로컬 정의를 삭제하고 이동한 것이다. 두 소비처가 동일 집합을 유지하기 위한 최소 리팩토링으로 현재 작업의 직접 요구사항(공용 사용, 의존 방향 위반 방지)이다.

추가 범위 이탈 없음 — 17개 파일 전수 확인 결과, 요청된 3건 개선(execution.message, resetSession, 2-column)과 그 필수 support(공용 상수, spec/plan 갱신, i18n, 테스트)만 포함되어 있다. 무관한 파일 수정, 불필요한 포맷팅 변경, 사용하지 않는 임포트 추가, 의도하지 않은 설정 파일 변경은 발견되지 않았다.

## 요약

이번 변경은 선언된 3개 항목(presentation 노드 `execution.message` 신설, 미리보기 세션 초기화, 2-column 배치)에 정확히 대응한다. 공용 상수(`PRESENTATION_NODE_TYPES`) 분리는 두 소비처가 생기면서 불가피한 최소 재구성이며 불필요한 리팩토링이 아니다. spec/plan 갱신(파일 14-17)은 프로젝트 규약(SDD 정식 Phase 4)에 따른 의무 범위다. 무관한 파일·포맷팅 혼입·임포트 오염·설정 변경은 없다.

## 위험도

NONE
