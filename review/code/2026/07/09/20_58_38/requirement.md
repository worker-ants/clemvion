# 요구사항(Requirement) Review — spec/7-channel-web-chat/3-auth-session.md · spec/conventions/conversation-thread.md

## 검증 방법

본 changeset 은 spec 문서 2건(둘 다 `status: implemented`)의 "새로고침 히스토리 복원(`context.conversationThread` 동봉)"
서술 추가/보강이며 코드 diff 는 포함돼 있지 않다. 두 문서 모두 이미 구현된 기능을 사후 문서화하는 성격이라, 점검 관점 9
(spec fidelity) 를 코드베이스 실측으로 뒤집어 검증했다:

- 백엔드: `codebase/backend/src/modules/external-interaction/interaction.service.ts` `getStatus()`
- 백엔드 spec: `spec/5-system/14-external-interaction-api.md` §5.3, §R17
- 프런트(위젯): `codebase/channel-web-chat/src/widget/use-widget.ts` `seedWaitingFromStatus`,
  `codebase/channel-web-chat/src/lib/eia-events.ts` `parseWaitingForInput`,
  `codebase/channel-web-chat/src/lib/conversation.ts` `threadToMessages`/`roleOf`,
  `codebase/channel-web-chat/src/lib/widget-state.ts` `WAITING`/`mergeMessages`
- 테스트: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`,
  `codebase/channel-web-chat/src/lib/conversation.test.ts`

## 발견사항

- **[INFO]** conversationThread 전체 히스토리 시드 경로의 end-to-end 테스트 부재 (부품 단위만 커버)
  - 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (getStatus 시드 테스트는 `turns` 비포함),
    `codebase/channel-web-chat/src/lib/conversation.test.ts` (`threadToMessages` 단위 테스트는 존재)
  - 상세: 이번 diff 가 서술하는 "새로고침 시 `context.conversationThread` 로 과거 대화 히스토리 전체를 시드" 동작은
    코드 상 정확히 구현돼 있음을 확인했다(`seedWaitingFromStatus` → `parseWaitingForInput` → `threadToMessages` →
    `dispatch({type:"WAITING", threadMessages})` → `mergeMessages`, `initialState.messages=[]` 이므로 reload 직후
    스냅샷이 항상 채택됨). 그러나 `use-widget-eager-start.test.ts` 의 getStatus 관련 테스트("race fix: getStatus 가
    buttons waiting 표면을 주면...")는 `context.conversationThread` 를 포함하지 않는 fixture 만 쓰고 있어, 여러 turn 이
    있는 실제 히스토리 복원 시나리오(예: user/assistant 여러 turn 을 담은 `conversationThread.turns` → `state.messages`
    반영)를 회귀 검증하는 통합 테스트가 없다. `threadToMessages`/`roleOf` 자체는 `conversation.test.ts` 로 잘 커버되지만
    위젯 reducer 통합 경로(`mergeMessages`, WAITING dispatch)는 미검증.
  - 제안: 코드 fix 는 불필요(구현은 spec 과 일치) — `testing` 관점 후속으로 turn 여러 개를 포함한
    getStatus mock 응답을 사용해 `state.messages` 가 복원되는지 확인하는 통합 테스트 추가를 권고(회귀 방지 목적, blocking 아님).

- **[INFO]** §4 영속화 표 "park 진입 시" 행의 비고가 소비처 확장(getStatus REST)을 요약하지 않음
  - 위치: `spec/conventions/conversation-thread.md:214` (표 행, 이번 diff 대상 밖) vs 같은 파일 `:559`(§8.4 "소비처 갱신" 신규 문단)
  - 상세: 이번 diff 로 §8.4 Rationale 에 "소비처는 (a) rehydration(내부) (b) SSE waiting emit (c) getStatus REST(읽기
    전용) 로 확장됐다"가 명문화됐으나, 상단 §4 개요 표(214행)의 "park 진입 시" 행 비고는 여전히 "rehydration 이 이 컬럼에서
    thread 를 무손실 복원"만 언급하고 getStatus REST 소비처를 요약하지 않는다. 내용 자체는 상충하지 않고(개요 표 vs
    상세 Rationale 의 계층 구조는 이 문서의 기존 패턴), 실제 오류는 아니다.
  - 제안: 표 자체를 고치는 것은 이번 fix 대상이 아님(INFO, 완결성 참고) — 추후 §4 표 갱신 시 "비고" 에 "(소비처: 내부
    rehydration + SSE + getStatus REST, §8.4)" 1줄 정도 추가하면 표만 봐도 소비처 전모가 드러나 탐색성이 좋아진다.

## Spec Fidelity 교차검증 결과 (문제 없음, 근거 기록)

- `EIA §5.3`(`spec/5-system/14-external-interaction-api.md:427`)·`§R17`(`:1104`) 실제 헤더 존재, 앵커 정합.
  `interaction.service.ts getStatus()` 구현이 spec 서술과 line-level 로 일치:
  - `execution.status === WAITING_FOR_INPUT` 일 때만 `context` 채움 → spec "그 외 status 는 `context: null`" 과 일치.
  - `conversationThread = execution.conversationThread ?? undefined` 후 `...(conversationThread ? {...} : {})` 로
    조건부 스프레드 → spec "durable thread 없으면 `context.conversationThread` **키를 생략**" 과 정확히 일치(값 `null`
    이 아니라 키 부재).
  - `conversationThread` 는 `interactionType` (`buttons`/`form`/`ai_conversation`) 과 무관하게 공통 `base` 객체에
    포함 → 3-auth-session.md diff 의 "waiting_for_input 이면(표면 종류 불문) 그 context 로 현재 표면 + 과거 대화
    히스토리 전체를 시드" 서술과 일치.
- 위젯 `seedWaitingFromStatus`(`use-widget.ts:225`)가 `status.status === "waiting_for_input"` 조건에서만 시드하고,
  그 외 상태(종료·404·401)는 아무 분기도 타지 않아 spec 의 "200+종료·404·복구불가 401 REST 분기는 여전히
  미구현(Planned)" 서술과 일치. `catch` 블록이 `console.warn` 후 계속 진행 → spec "그 외 status·오류는 catch soft-fail
  후 SSE 로 진행" 과 일치.
  → 이 두 갭(REST 분기·낙관적 401 refresh 미구현)은 diff 자체가 "Planned" 로 명시적으로 자인하고 있어 CRITICAL 대상
  아님(의도적 범위 축소, 사용자 결정 사항으로 남김).
- `conversation.ts roleOf()` 의 `presentation_user`/`ai_user` → user, 나머지 → assistant 매핑이 `1-widget-app.md §2`
  참조와 일치(해당 섹션 실제 존재, `## 2. 화면 구조`).
- `conversation-thread.md` §8.4 신규 문단의 "이미 SSE `waiting_for_input` 으로 공개 중인 데이터의 REST 재노출이라 신규
  민감 표면이 아니다" 주장이 `EIA §R17` 재조정 문단(`:1125-1131`)의 동일 논리와 정확히 대칭 — 두 문서 간 cross-link
  일관.
- TODO/FIXME/HACK/XXX 마커 없음. 반환값 누락·에러 경로 미정의 없음(코드 실측 결과 모든 분기 정상 반환).

## 요약

두 spec 파일의 diff 는 이미 구현·테스트된 "웹채팅 새로고침 히스토리 전체 복원"(`getStatus` → `context.conversationThread`
→ 위젯 시드) 기능을 사후 문서화한 것으로, 코드베이스 실측(backend `interaction.service.ts`, widget
`use-widget.ts`/`conversation.ts`/`widget-state.ts`) 결과 서술이 함수 시그니처·조건부 필드 생략 규칙·인터랙션 타입
무관 적용 범위까지 line-level 로 정확히 일치한다. Rationale(§R17, §8.4) 간 cross-link 도 대칭적이고 모순이 없다.
CRITICAL/WARNING 없음 — INFO 2건(통합 테스트 커버리지 갭, §4 개요 표 소비처 요약 누락)만 발견했으며 둘 다 기능적 결함이
아닌 완결성 참고 사항이다.

## 위험도

NONE
