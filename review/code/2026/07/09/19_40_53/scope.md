# 변경 범위(Scope) Review 결과

> 대상: 웹채팅 위젯 세션 컨트롤(새 대화/대화 종료) + `getStatus` durable `conversationThread` 새로고침
> 히스토리 복원 (`plan/complete/webchat-session-controls-history-restore.md`). 4개 커밋(feat + 3회
> `/ai-review` 라운드 반영), `origin/main...HEAD` 기준 64개 변경 파일을 직접 `git diff --stat`/개별 파일
> diff 로 재검증했다(이전 라운드 18_44_10/19_06_55/19_26_15 scope.md 산출물과 독립적으로 재확인).

## 발견사항

없음. 이전 라운드(19_26_15 scope.md)가 지적한 유일한 INFO(`plan/complete/...md` frontmatter
`status: in-progress` 잔존)는 최신 커밋 `47311f164`("test(web-chat): ai-review R3 반영")에서
`status: complete` 로 이미 정정되어 현재 `HEAD` 기준으로는 해소된 상태다(직접 확인:
`plan/complete/webchat-session-controls-history-restore.md` frontmatter `status: complete`).

## 범위 검증 상세

1. **실제 코드/스펙 diff 는 20개 파일에 그침** — `git diff --stat origin/main...HEAD -- codebase/ spec/
   CHANGELOG.md plan/`(review/ 제외) 결과 정확히 20개 파일(backend 3, channel-web-chat 11, spec 4,
   CHANGELOG 1, README 1)만 변경됐다. 계획서(`plan/complete/webchat-session-controls-history-restore.md`)의
   두 문제(세션 컨트롤 UI 부재 / 새로고침 히스토리 미복원)와 diff 파일 목록이 1:1로 대응하며, 계획에
   없던 모듈·엔드포인트·DB 마이그레이션·다른 채널/에디터 파일 수정은 없다.
2. **백엔드 변경은 `getStatus()` 응답 확장에 정확히 국한** — `interaction.service.ts` diff 는 JSDoc
   갱신 + `conversationThread` 조건부 스프레드(`base` 객체로 중복 제거) 만이며, 엔드포인트·가드·다른
   메서드는 무변경. `execution.entity.ts` 의 유일한 변경은 6줄 JSDoc 주석(신규 REST 노출 경로 교차
   참조)뿐 — 컬럼 정의·타입·마이그레이션은 무변경.
3. **프런트 리팩토링은 이번에 신설된 코드 자체에 국한** — `resetSessionRefs()` 추출은 `newChat`/신규
   `endConversation` 둘이 공유하는 teardown 시퀀스를 묶은 것이고, `CONFIRM_COPY` 조회 테이블과
   `isActiveConversationPhase`(`widget-state.ts` 신규 export)도 모두 이번 PR 이 추가하는 헤더 컨트롤·
   확인 UI 를 위한 신규 코드다. 기존 `roleOf`(`conversation.ts`)는 `source` 매핑 한 줄 추가로 기존
   분기 로직을 건드리지 않았고, `TurnSource` union 확장(`eia-types.ts`)도 값 추가(widening)라 기존
   `live`/`injected` 소비 경로에 회귀가 없다. 무관한 기존 함수·모듈을 재구성한 사례는 없다.
4. **기능 확장(over-engineering) 없음** — `endConversation`/`newChat` 은 계획서 "새 대화 + 대화 종료
   둘 다, 가벼운 확인"만 구현했다. `startGenRef` 세대 토큰은 신규 기능(종료/새 대화)이 유발하는
   실제 in-flight `start()` race 를 막는 필수 정합성 코드이며 부가 기능이 아니다. 3·4차 커밋(`160840462`,
   `47311f164`)의 `booting` 제외 로직·재진입 가드 테스트도 모두 `/ai-review` WARNING 반영이지 새로운
   기능 추가가 아니다.
5. **무관한 파일 수정 없음** — `package.json`/lint/tsconfig/CI 설정, 다른 백엔드 모듈(워크플로우 에디터,
   알림, 인증 등), `frontend/` 패키지에 대한 수정은 diff 에 전무하다. `review/code/**`(3라운드 × 12파일)
   와 `review/consistency/**`(1라운드 × 4파일) 산출물 44개는 본 저장소 컨벤션상 PR 에 커밋되는 프로세스
   산출물(메모리 "review/ 는 gitignored 아님, SUMMARY/RESOLUTION 도 커밋"과 일치)이라 스코프 이탈이 아니다.
6. **포맷팅 변경 없음** — 각 파일 diff 가 순수 추가/치환 라인 위주이며, 무관한 라인의 개행·들여쓰기만
   바꾸는 잡음성 hunk 는 없다. `panel.tsx` 의 `<div className="wc-panel-actions">` 래핑은 신규 버튼 2개
   배치를 위한 구조적으로 필요한 변경이다.
7. **주석 변경은 전부 신규 로직 설명** — `interaction.service.ts`/`execution.entity.ts`/`conversation.ts`/
   `widget-state.ts`/`use-widget.ts` 의 JSDoc·인라인 주석은 모두 이번에 추가된 `conversationThread` 동봉·
   `roleOf` source 매핑·`isActiveConversationPhase`·`endConversation`/gen guard 를 설명하며, 무관한
   기존 코드의 주석을 건드리지 않았다.
8. **임포트 변경은 필요분만** — `panel.tsx` 의 `useState` 추가(confirm 상태)·`isActiveConversationPhase`
   named import 추가, `panel.test.tsx` 의 `fireEvent` 추가 — 전부 신규 코드가 실사용. 불필요한 임포트
   정리/추가는 발견되지 않았다.
9. **설정 변경 없음** — `styles.ts`(CSS-in-JS) 에 신규 클래스(`wc-panel-actions`/`wc-panel-action`/
   `wc-confirm*`)만 additive 로 추가됐고, 빌드/lint/tsconfig 등 설정 파일은 diff 대상에 없다.

## 요약

`origin/main...HEAD` 전체 diff(64 파일, 그중 실질 코드/스펙/문서 20파일 + 프로세스 산출물 44파일)를
직접 재검증한 결과, 변경은 "웹채팅 위젯 세션 컨트롤 2종 + 새로고침 히스토리 복원"이라는 의도된 범위
안에 정확히 머물러 있다. 백엔드는 `getStatus()` 응답의 조건부 필드 확장 하나로 국한되고, 프런트
리팩토링(`resetSessionRefs` 추출·`CONFIRM_COPY` 테이블·`isActiveConversationPhase` 이관)은 모두 이번에
신설된 코드 자체를 대상으로 해 "무관한 리팩토링"에 해당하지 않는다. 이전 라운드(19_26_15)가 지적했던
유일한 INFO(plan frontmatter `status` drift)는 최신 커밋에서 이미 정정되어 현재 잔여 발견사항이 없다.
다른 모듈·설정 파일·무관한 코드 영역에 대한 수정은 전무하다.

## 위험도
NONE
