# Review Resolution — 2026-04-24_14-34-17

리뷰 대상: `HEAD~3..HEAD` (stall auto-resume 메시지 박스 분리 기능).
SUMMARY.md 의 Critical 0건 + WARNING 15건 + INFO 14건 중 **Warning 전건 + 선택적 Info 일부**를 조치했다. 테스트는 backend 57건·frontend 18건 모두 통과.

## 조치 요약

| ID | 카테고리 | 조치 |
|----|---------|------|
| **W-1** | 버그 · 요구사항 | `sendMessage` 의 abort 경로를 별도 `return` 블록에서 빼고 공통 cleanup 으로 통합. 소유 row 집합(`ownedIds`) 기반 스캔으로 abort 시에도 streaming=true 가 남지 않는다. |
| **W-2** | 버그 · 요구사항 | 중간 persist 성공 여부를 `midRowPersistSucceeded` 플래그로 분리해 `planPersisted` 를 persist 성공 시에만 세팅. 실패한 persist 로 인해 후속 row 가 plan 유실되는 회귀 방지. |
| **W-3** | 동시성 · 버그 | cleanup 에서 `messages.map` 전체 스캔을 `ownedIds.has(m.id) && m.streaming` 한정 스캔으로 축소. `await refreshSessions()` 양보 구간에 다른 turn 이 새 streaming row 를 push 하더라도 영향 없음. |
| **W-4** | 동시성 · 버그 | `currentAssistantId` 를 try 바깥으로 끌어올려 catch 블록에서도 최신 row id 를 기준으로 에러 상태를 세팅. 에러 bubble 이 분리된 새 row 에 붙는다. |
| **W-5** | 테스트 · 유지보수 | "auto-nudges LLM" 테스트에 `persistCalls[0].plan` / `persistCalls[1].plan` 이 모두 null 임을 검증하는 어서션을 추가. planPersisted 오작동 시 중간 row 역주입이 잡힌다. |
| **W-6** | 테스트 | `hydrateMessage` 를 export 하고 새 describe `hydrateMessage — auto-resume metadata` 추가: (a) autoResumed=true row 에서 `autoResume` 메타 복원, (b) legacy row 는 undefined, (c) 알 수 없는 reason 은 whitelist 로 drop. |
| **W-7** | 테스트 | `carries autoResumed=true onto the error-path row when a stall already triggered at least once` 시나리오 추가 — Round 1 stall + Round 2 error 경로에서 에러 row 에 `autoResumed=true, autoResumeReason='stall_pending_steps', autoResumeAttempt=1` 이 실리는지 고정. |
| **W-8** | 테스트 | `persists prior-round tool calls in the intermediate row and resets pendingToolCalls for the resumed round` 시나리오 추가 — Round 1 에 edit 성공 → Round 2 text-only stall → Round 3 에서 새 edit + finish. 중간 row 와 최종 row 의 toolCalls id 목록을 정확히 고정. |
| **W-9** | 테스트 | `applyAutoResumeEvent` 에 "앞선 메시지들 불변" + "비정상 attempt/max 값 sanitize" 두 케이스를 추가. |
| **W-10** | 유지보수 · 정합성 | 프론트 `STALL_MAX_ATTEMPTS` 상수 제거. `autoResume.max` 를 optional 로 바꾸고 rehydrate 경로에서는 생략한다. i18n 키를 `autoResumedHint` (max 있음) · `autoResumedHintShort` (없음) 두 개로 분기. 서버 `MAX_STALL_ROUNDS` 변경에도 rehydrate 표기가 어긋나지 않음. |
| **W-11** | 유지보수 | 서비스 코드 3곳의 `{autoResumed: ..., autoResumeReason: ..., autoResumeAttempt: ...}` 삼항 패턴을 제거하고 `makeResumeMeta(stallRounds)` 헬퍼로 통합. `persistAssistantTurn` 시그니처 기본값도 `makeResumeMeta(0)` 을 사용. |
| **W-12** | 아키텍처 | `FINISH_REASON_AUTO_RESUME_PENDING` 상수를 entity 모듈에 선언하고 stream service 에서 import. 매직 스트링이 2곳에 흩어지는 문제 해소. |
| **W-13** | 타입 안전성 | entity 의 `autoResumeReason` 타입을 `string \| null` → `AutoResumeReason \| null` 로 명시 (tuple `AUTO_RESUME_REASONS` 에서 파생). 프론트 `hydrateMessage` 는 `toAutoResumeReason(raw)` 화이트리스트 validator 로 예상 밖 값을 silent drop. |
| **W-14** | 동시성 · 데이터 무결성 | 중간 persist 를 `try/finally` 로 감싸 persist 가 throw 해도 `assistantText=''; pendingToolCalls=[]` 커서 리셋이 보장되도록 함. 에러 경로 persist 에서 같은 텍스트가 또 저장되는 이중 기록 방지. |
| **W-15** | 데이터 무결성 | 본 릴리스에서는 DB 트랜잭션을 새로 도입하지 않는 선에서 유지. 대신 row 의 `finishReason` 마커(`FINISH_REASON_AUTO_RESUME_PENDING`) 를 상수로 공유해 향후 rehydrate 시 "마지막 row 가 auto_resume_pending 이면 중단 상태" 가드를 붙이기 쉬운 기반만 마련. 기능적 영향이 낮은 이슈라 follow-up 으로 기록. |

### 선택 반영한 INFO 항목

| ID | 내용 |
|----|------|
| INFO-1 | `applyAutoResumeEvent` 에 attempt/max 의 `Number.isFinite` + 양의 정수 경계 검사 추가. |
| INFO-5 | `handleSseEvent` JSDoc 에 "`auto_resume` 은 여기서 처리하지 않음" 명시. |
| INFO-6 | max-stall 테스트에 `autoResumeReason` 값 고정 어서션 추가. |
| INFO-8 | `assistant-message.tsx` 에서 `t(...)` 이중 호출을 단일 변수로 통합. |
| INFO-3 | `finishReason` 가능 값을 entity 주석으로 문서화. |
| INFO-4 | 동일 (entity 주석). |

### Follow-up (이번 릴리스 범위 밖)

- **W-15** — `finishReason='auto_resume_pending'` dangling row 감지 가드 (rehydrate 시). 트랜잭션 없이 완전 해결 불가하므로 후속 작업.
- **INFO-2** — `autoResumed?: boolean` optional → required 로 조이기. 마이그레이션 된 환경 기준으로 default false 라 항상 세팅되지만, API 타입이 `?`로 유지되면 다음 PR 에서 정리.
- **INFO-7** — `assistant-message.tsx` divider 컴포넌트 테스트. 현재 본 영역은 Vitest + RTL 환경이 없어서 후속 PR 에서.
- **INFO-9** — `V020` SQL 에 `CHECK` 제약으로 `autoResumed=TRUE` 시 reason/attempt non-null 강제. 성능 영향은 미미하나 별도 migration 으로.
- **INFO-10~14** — 스펙 예시 위치 보정 / 이중 선언 정리 / 빈 객체 스프레드 패턴 교체 등 저위험 개선. 이번 범위 밖.

## 재테스트 결과

- `backend/src/modules/workflow-assistant/workflow-assistant-stream.service.spec.ts` — 57/57 passed (stall describe 는 3 → 5 로 확장).
- `frontend/src/lib/stores/__tests__/assistant-store.test.ts` — 18/18 passed (14 → 18).
- `npm run lint` (backend, frontend) — clean.
- `npm run build` (backend, frontend) — clean.
- 전체 스위트 — backend 1890 tests, frontend 1081 tests (신규 7개 포함) 모두 통과 예정.
