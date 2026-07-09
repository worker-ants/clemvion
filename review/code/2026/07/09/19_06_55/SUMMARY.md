# Code Review 통합 보고서 (fresh — 2커밋 vs main)

## 전체 위험도
**MEDIUM** — Critical 없음. 직전 라운드(18_44_10) WARNING 8건은 구조적으로 해소 재검증됨. 신규 WARNING 3건
(side_effect·documentation·**concurrency(journal 복원)**) — 모두 booting-중 세션 컨트롤 노출에서 파생.

> **concurrency 복원 메모**: concurrency reviewer 는 manifest success 이나 출력 파일 부재(알려진 Workflow 글리치).
> journal(`wf_66ed4844-3dc/journal.jsonl`, agent a61a6ea60c9a8e017)에서 결과를 복원했다 — **WARNING 1건**(아래 #3).
> 초기 summary 는 이를 누락했으나 본 파일에 반영한다.

## Critical
없음.

## 경고 (WARNING) 및 처리

| # | Checker | 발견 | 처리 |
|---|---------|------|------|
| 1 | side_effect | `booting`(webhook in-flight)에서 endConversation → sessionRef null 이라 cancel 미발사 + gen guard 로 persist 미실행 → 서버 종료 명령 0회(spec §3.1 booting cancel 계약 불일치) | **수정** — `isActiveConversationPhase` 에서 booting 제외(컨트롤은 streaming/awaiting=세션 확립 후에만 노출). booting 종료 UI 경로 제거 → 계약 정합. spec §2·§3.1 갱신 |
| 2 | documentation | eia-types.ts:33-34 JSDoc 상대경로 off-by-one(`../../../` → `../../../../`) | **수정** — 4단계로 정정 |
| 3 | concurrency (복원) | `resetSessionRefs()` 가 `startedRef=false` 재개방 → booting 중 newChat/endConversation 재호출 시 2번째 start() 가드 통과 → 중복 `POST /api/hooks`(첫 노드 부작용 2회 위험). gen guard 는 client 오염만 차단, 이미 발사된 중복 웹훅은 못 막음 | **수정** — 동일 fix(booting 제외)로 UI 경로 차단: 컨트롤이 streaming/awaiting(직전 start 정착 후)에만 노출 → 동시 in-flight webhook 없음. host `resetSession`-during-booting 잔여 엣지는 pre-existing(본 PR 무관), RESOLUTION 명시 |

## 참고 (INFO) 및 처리
- #5 maintainability: `USER_TURN_SOURCES` `Set<string>`→`Set<TurnSource>` — **수정**.
- #6 maintainability: `"user_ended"` 4회 리터럴 → const — **수정**.
- #7 maintainability: conversation.ts 헤더 주석 stale(5-source 매핑 미반영) — **수정**.
- #8 testing: ai_conversation waiting 이나 nodeId 부재 → cancel 폴백 경계 미검증 — **수정**(테스트 추가).
- #11 documentation: 프로덕션 주석의 "WARNING #N" 리뷰번호 참조 3곳 — **수정**(안정 앵커로 대체/제거).
- #1·#2 security(durable thread redaction·새 대화 orphan): 백로그 defer(신뢰모델 연장, R17/spec WARNING 명문).
- #3 architecture(ref 가드 축적): YAGNI defer. #4 architecture(graceful 판정 추출): 저우선 defer.
- #9 testing(node 없음+thread 조합), #10(widget-app 통합 스모크): 저우선 defer.
- #12 requirement(외부 종료 중 confirm 잔존): 기능적 결함 아님, defer.

## 결론
Critical 0. 신규 WARNING 3건 전부 반영(핵심: booting 을 세션 컨트롤 노출에서 제외 → side_effect·concurrency 동시 해소).
저비용 INFO 다수 반영, 백로그/저위험만 defer. 반영분 커버 위해 최종 fresh review 1회 수행.
