# RESOLUTION — 2026/07/09 19_06_55 code review (round 2, fresh)

라운드1(18_44_10) WARNING 8건 구조적 해소 재검증됨. 신규 WARNING 3건(concurrency 는 journal 복원) 전량 반영.

## WARNING — 전량 반영

| # | Checker | 처리 |
|---|---------|------|
| 1 | side_effect (booting endConversation cancel 미발사) | `isActiveConversationPhase` 에서 **booting 제외** — 세션 컨트롤을 streaming/awaiting(세션 확립 후)에만 노출. booting 종료 UI 경로 소멸 → §3.1 계약 정합. spec §2·§3.1, panel 테스트 갱신 |
| 2 | documentation (JSDoc 링크 off-by-one) | `eia-types.ts` `../../../` → `../../../../` 정정 |
| 3 | concurrency [journal 복원] (resetSessionRefs 가 startedRef 재개방 → booting 중 재클릭 시 중복 webhook) | **동일 fix**(booting 제외)로 UI 경로 차단 — 컨트롤이 세션 확립 후에만 노출돼 동시 in-flight webhook 부재. |

## INFO — 반영
- #5 `USER_TURN_SOURCES`: `Set<string>`→`Set<TurnSource>`.
- #6 `"user_ended"`: `const reason` 상수화.
- #7 conversation.ts 헤더 주석: 5-source→role 매핑 반영.
- #8 테스트: ai_conversation waiting + nodeId 부재 → cancel 폴백 경계 테스트 추가.
- #11 프로덕션 주석의 "WARNING #N" 참조 3곳 제거/안정 표현 대체.

## INFO — defer (backlog/저위험)
- #1 durable thread REST redaction: 방어심화 backlog(신뢰모델 연장, R17 명문).
- #2 새 대화 orphan/토큰 노출: backlog(idle GC·이전 execution best-effort cancel planner 결정).
- #3 useWidget ref 가드 축적: YAGNI(3번째 유사 race 를 리팩터 트리거).
- #4 graceful 판정 순수함수 추출: 저우선.
- #9 node 없음+thread 조합 테스트, #10 widget-app 통합 스모크: 저우선.
- #12 외부 종료 중 confirm 잔존: 기능 결함 아님(정상 CTA 와 동일 결과).

## 잔여(pre-existing, 본 PR 무관)
- host `resetSession`(newChat)-during-booting 중복 webhook: 원래 newChat 도 startedRef 재개방 — host-API 엣지.
  본 PR 은 신규 UI 경로만 booting 제외로 차단. host-API 가드는 backlog.

## 검증
- web-chat 269 passed, backend external-interaction 200 passed, build/lint clean.
- 반영분 커버 위해 라운드3 fresh `/ai-review --branch main` 수행.
