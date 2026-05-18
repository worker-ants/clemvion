# RESOLUTION — conversation-turn-render Phase 1 (frontend) ai-review

세션: `review/code/2026/05/18/12_56_01/`
대상: 2 commit (`48cc0eb` docs(spec) + `b5ddb4d` feat(frontend))
fix commit: `53305294` refactor(frontend): ai-review C1 + W1-W24 반영

## 조치 항목

### Critical

| ID | 내용 | 위치 | 조치 | commit |
|---|---|---|---|---|
| C1 | threadTurns 분기 idempotency guard 누락 — 재emit 시 store 덮어쓰기 위험 | `use-execution-events.ts` ai_conversation 분기 | `nextSeq` 비교 가드 추가 (`>` 일 때만 setConversationMessages). idempotency 회귀 테스트 3건 (use-execution-events.test.ts) | 53305294 |

### Warning (총 24건)

| ID | 내용 | 조치 | commit |
|---|---|---|---|
| W1 | interactionLabelKey 결정 삼항 체인 중복 (PresentationDetail + SummaryView) | `getInteractionLabelKey(interactionType)` 헬퍼 추출, `TranslationKey` 반환 타입으로 typed 호출 보장 | 53305294 |
| W2 | ConversationItem type 확장 영향 — exhaustive switch 소비자 점검 | grep 으로 모든 type 분기 발굴: `conversation-timeline-item.tsx` 만 영향 받음 → presentation/system 분기 추가. 나머지 소비자(`result-detail.tsx`/`llm-call-trace.ts`/`execution-store.ts`/interaction-commands)는 "assistant" 또는 "tool" 전용으로 영향 없음 | 53305294 |
| W3 | presentation 헤더 레이아웃 이중 구현 | `CardHeader({icon,label,timestamp})` 공용 컴포넌트 추출 | 53305294 |
| W4 | interactionType 추론 silent bug 위험 | `ConversationTurn.interactionType?` optional 필드 추가 (backend 가 향후 직접 emit 시 자동 사용) + `inferInteractionTypeFromData(data)` 별도 함수 분리 | 53305294 |
| W5 | messagesToConversationItems content 계약 조용한 변경 | JSDoc 에 "returns stripped content" + "raw payload 는 보존" 명시 | 53305294 |
| W6 | ai_assistant/ai_tool 의 turnIndex 폴백이 spec 과 미묘 불일치 | `turn0` → `effectiveTurnIndex` rename + spec §1.1 주석으로 "renderer key path 안정성 위한 비-0 floor" 명시 | 53305294 |
| W7 | threadTurnsToConversationItems switch 의 default 없음 | `default` 케이스 추가 (exhaustive `never` check + `console.warn`) | 53305294 |
| W8 | button_continue 추론에서 url-only 오분류 가능 | `inferInteractionTypeFromData` 가 button_continue 를 `buttonId` AND `url` 동시 요구로 명시 | 53305294 |
| W9 | PresentationDetail/SystemDetail 헤더 중복 | W3 의 `CardHeader` 공용 컴포넌트로 통합 | 53305294 |
| W10 | turn0 변수명 폴백 의도 불명 | `effectiveTurnIndex` rename | 53305294 |
| W11 | presentation_user case 의 불필요 type 단언 | `turn.data` 직접 사용 (단언 제거) | 53305294 |
| W12 | threadTurns 이중 가드 | `threadTurns?.length` 단일 조건으로 단순화 | 53305294 |
| W13 | SummaryView strip 회귀 테스트 누락 | conversation-inspector.test.tsx 에 SummaryView 경로 strip 회귀 1건 추가 | 53305294 |
| W14 | use-execution-events threadTurns 분기 hook 테스트 없음 | use-execution-events.test.ts 에 thread 우선 / idempotency / nextSeq advance / fallback 4건 추가 | 53305294 |
| W15 | form_submitted 빈 data "(no fields)" 테스트 없음 | conversation-inspector.test.tsx 에 1건 추가 | 53305294 |
| W16 | button_continue url 없음 edge case 테스트 없음 | 1건 추가 (no-crash 보장) | 53305294 |
| W17 | ai_assistant ai_user 없이 첫 turn 폴백 테스트 없음 | conversation-utils.test.ts 에 1건 추가 (turnIndex === 1 검증) | 53305294 |
| W18 | timestamp undefined 시 PresentationDetail/SystemDetail 렌더 테스트 없음 | conversation-inspector.test.tsx 에 1건 추가 (no-throw 보장) | 53305294 |
| W19 | PresentationCardBody 시나리오 단위 테스트 부족 | SummaryView 케이스로 (no fields / nested object / button_continue url 없음) 통합 — W15·W16·W20 가 같은 영역 커버 | 53305294 |
| W20 | form_submitted nested object JSON.stringify 테스트 없음 | 1건 추가 (`[1,2,3]` 직렬화 검증) | 53305294 |
| W21 | data undefined presentation_user interactionType 테스트 없음 | conversation-utils.test.ts 에 1건 추가 (form_submitted fallback) | 53305294 |
| W22 | ai_assistant 첫 turn turnIndex 명시 테스트 없음 | W17 과 동일 (1건) | 53305294 |
| W23 | system "reserved" JSDoc 노후화 위험 | `@todo Remove the "reserved" qualifier on "system" once v2 ships automatic push for it` 추가 | 53305294 |
| W24 | README/CHANGELOG 영향 검토 미결 | conversation Preview 의 UI 변경은 내부 미리보기 탭 한정 — 사용자 노출 페이지나 환경 변수 변경 없음. README 영향 없음으로 결론. plan Phase 4 의 해당 체크박스를 "영향 없음" 메모로 닫는다 (후속 commit) | 본 RESOLUTION 에 명시 |

### INFO (총 14건)

INFO 는 RESOLUTION 추적만, 즉시 미반영:

| ID | 내용 | 처리 |
|---|---|---|
| I1 | URL → javascript: scheme 위험 | 현재는 div 텍스트, 링크 변환 시점에 검증 함수 추가하기로 트래킹. follow-up |
| I2 | `_retry_state.json` 절대 경로 노출 | 비공개 repo 라 위험 낮음. `.gitignore` 검토는 별도 plan |
| I3 | stripInlineMarkers 다중 호출 | strip 책임을 변환 레이어에 1차 귀속 (이미 `messagesToConversationItems` 와 `threadTurnsToConversationItems` 둘 다 호출). 컴포넌트 (`SummaryView` history rebuild) 의 호출은 다른 데이터 경로라 유지. follow-up 으로 단일화 검토 |
| I4 | font-size 하드코딩 산재 | 기존 컴포넌트 패턴과 일관 — 별도 디자인 토큰 작업으로 분리 |
| I5 | 🧩 이모지 두 곳 하드코딩 | W3 의 PRESENTATION_ICON 상수로 해결됨 |
| I6 | USER_INPUT_MARKER_RE 의 `/g` 플래그 lastIndex 오염 | "replace-only" 주석 추가 (W5 과 동일 commit) |
| I7 | conversationThread.turns 빈 배열 의미 | 코드 주석에 idempotency 가드 의도 명시됨 (`>= 1 시 ` 등). 별도 주석 추가 불필요 |
| I8 | plan Phase 1 "selector 추가" 미포함 | 의도적 제외 — Phase 1 의 ConversationInspector 는 store 의 `conversationMessages` 를 직접 props 로 받음. 별도 selector 도입은 over-engineering. plan 갱신 commit 에서 명시적으로 닫음 |
| I9 | plan Phase 1 dev server 시나리오 재현 미체크 | 본 RESOLUTION 검증의 일부로 e2e 통과로 갈음. plan 체크 갱신 |
| I10 | `getByText("🧩")` 이모지 변경 시 테스트 취약 | 현재 안정. 이모지 변경 시 PRESENTATION_ICON 상수 따라 테스트도 동시 갱신. follow-up |
| I11 | PresentationDetail/SystemDetail JSDoc 없음 | 컴포넌트 위에 spec §9.1 참조 한 줄 JSDoc 추가 (W3 commit 에 포함) |
| I12 | conversationThread payload 필드 주석 없음 | W23 commit 에 인라인 주석 추가 |
| I13 | stripInlineMarkers JSDoc undefined 동작 미명시 | W5 commit 에 `@param`/`@returns` 추가 |
| I14 | `_retry_state.json` PR 포함 | 리뷰 산출물 archive 정책상 commit. `.gitignore` 정리는 별도 plan |

## TEST 결과

- **lint** — `cd codebase/frontend && npm run lint`: 통과
- **unit test** — `cd codebase/frontend && npm test`: 123 file · 1493 tests pass (신규 17건 포함)
- **build** — `cd codebase/frontend && npm run build`: 통과
- **e2e** — `make e2e-test-full`: 통과
  - backend supertest: 16 suites · 93 tests pass
  - playwright: 37 tests pass

코드 변경(frontend src/) 포함, 화이트리스트 밖이므로 `make e2e-test-full` 수행. 면제·보류 사유 없음.

## 보류·후속 항목

- I1 (URL safety) — URL 필드를 향후 클릭 가능 링크로 변환할 때 처리. 본 PR 은 div 텍스트라 무영향.
- I3 (strip 책임 단일화) — 별도 refactor PR 으로.
- I4 (font-size 토큰화) — 디자인 시스템 작업으로 분리.
- I10 (이모지 testid 전환) — 디자인 안정화 후 검토.
- I14 (`_retry_state.json` gitignore) — review 산출물 정책 별도 plan.

## plan 영향

`plan/in-progress/conversation-turn-render.md` Phase 1 체크리스트 갱신은 별 commit (`chore(plan):`) 으로 처리.
