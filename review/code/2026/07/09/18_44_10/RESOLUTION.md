# RESOLUTION — 2026/07/09 18_44_10 code review

리뷰 결과: **Critical 0, WARNING 8, INFO 16 (MEDIUM)**. Critical 없음이라 push 차단 아님. WARNING 전량 + 실행
가치 높은 INFO 다수를 반영하고, 후속/백로그 항목만 defer 했다. 미커밋이던 `startGenRef` race guard 도 동일 PR 에 포함.

## WARNING — 전량 반영

| # | 처리 |
|---|------|
| 1 부작용(conversationEnded 중복) | `endConversation` 을 **SSE 선차단(resetSessionRefs) → optimistic [ended] → best-effort 명령** 순서로 재배치 + `phase==='ended'` 가드. 명령 유발 terminal 이벤트가 중복 종료를 못 일으킴 |
| 2 아키텍처(phase 파생 위치) | `isActiveConversationPhase(phase)` 를 `widget-state.ts` 로 이관, `panel.tsx` 는 소비만 |
| 3 유지보수성(세션정리 중복) | `resetSessionRefs()` 헬퍼 추출 — newChat·endConversation 공용 |
| 4 유지보수성/테스트(동일 접근성 이름) | confirm 확정/취소 버튼에 `aria-label`(`… 확정`/`확인 취소`) 부여, 테스트를 CSS selector → `getByRole(name)` 전환 |
| 5 유지보수성(3항 분기 반복) | `CONFIRM_COPY` 조회 테이블로 문구·라벨·액션 통합 |
| 6 테스트(catch 경로) | interact 410 실패 시뮬 테스트 추가 — phase=ended·저장세션 정리 검증 |
| 7 테스트(graceful/cancel 경계) | buttons pending → `command==='cancel'` 테스트 추가 |
| 8 문서화(CHANGELOG) | Unreleased 항목 추가 |

## INFO — 반영

- #1 startGenRef: 동일 PR 포함(booting-중-종료 race guard) — 본 fresh review 로 재검증.
- #2 `"user"` dead literal: 제거.
- #5 409 optimistic ended: 1-widget-app §3.1 에 명령 실패/거부(410/409/네트워크) 시 로컬 종료 유지 병기.
- #6 getStatus 공통필드: `base` 선조립.
- #7 showSessionControls booting/streaming: `it.each` 커버.
- #8 COMPLETED+thread → context null: 회귀 가드 테스트 추가.
- #9 대화 종료 취소 경로: 테스트 추가.
- #10 README 상태: 5-source→role·세션 컨트롤·durable 복원 반영.
- #11 §3 다이어그램: 종료/새 대화 전이 보완 bullet(기존) 유지.
- #12 endConversation JSDoc nodeId 조건: 명시.
- #13 conversationThread 부재=키 생략: §5.3 에 명문.

## INFO — defer (백로그/저위험, 코드 미변경)

- #3 durable thread 서버측 redaction allowlist: 방어심화 백로그(현재 노드 핸들러 "민감정보 미기록" 컨벤션 + R17 명문 의존). 차단 사유 아님.
- #4 반복 "새 대화" 로 인한 `waiting_for_input` orphan 축적: 이미 spec WARNING 으로 추적, GC/아카이브 정책 백로그.
- #14 getStatus payload 크기(최대 thread): 기존 turn cap 존재로 즉시 위험 없음. 폴링 패턴 생기면 ETag 백로그.
- #15 durable thread clone 없이 embed: 응답은 즉시 JSON 직렬화 + 엔티티 request-scope GC — in-place mutate 경로 없어 저위험. SSE 대칭 clone 은 후속 nicety.
- #16 TurnSource Backend/Local 타입 분리: JSDoc 로 구분 중, 값 증가 시 분리 검토(타입 nicety).

## 검증
- web-chat unit: 268 passed. backend external-interaction: 200 passed(신규 4건 포함). web-chat build/lint clean.
- e2e: 스킵(정당) — additive read-only 필드, 실행엔진 상태전이 무변경. plan §검증 참조.

## Fresh review
gen guard(INFO#1)·WARNING 반영분을 커버하는 fresh `/ai-review --branch main` 1회 수행(RESOLUTION 후 stale 방지).
