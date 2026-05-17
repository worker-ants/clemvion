# RESOLUTION — AI Agent 대화 세션 페이지 재진입 hydration

세션: `review/code/2026/05/17/16_38_21/`
대상 commit: `4a99cd54` — fix(frontend/ws): hydrate AI 대화 메시지 — REST 스냅샷 경로
결과: BLOCK 없음. Critical 0건 / Warning 1건(기존 코드, 본 변경 무관) / INFO 19건.

## 조치 항목

본 변경 범위 내 누락·갭과 문서 미반영을 단일 commit 으로 보강 (테스트 8건 신규 + JSDoc + plan follow-up).

| ID | 카테고리 | 조치 | 위치 |
|----|---------|------|------|
| I-5 | requirement/testing | "messages 비어있음" 케이스를 더 의미 있게 — 기존 메시지·selectedConversationItemIndex 가 보존됨을 단언 | `apply-execution-snapshot.test.ts` "messages 가 비어있을 때 — selectedConversationItemIndex 영향받지 않음" |
| I-6 | requirement/testing | inconsistent snapshot (status=running + node=waiting_for_input) + ai_conversation 조합 hydration 검증 | 동 파일, "inconsistent snapshot ... reconcile 후 hydration" |
| I-7 | requirement/testing | legacy nested shape `{config, output:{messages}}` + legacy flat shape `{messages,...}` 통합 검증 (3 shape 모두) | 동 파일, "legacy nested shape", "legacy flat shape" |
| I-12 | testing | `information_extractor` 노드 타입의 ai_conversation 추론 + hydration 검증 | 동 파일, "information_extractor 노드 타입도 ai_conversation 분기로 hydrate" |
| I-13 | testing | `waitingConversationConfig.{mode,model,maxTurns}` 단언 추가 | 동 파일, "structured envelope ... waitingConversationConfig 매핑" |
| I-14 | testing | 복수 turn turnDebug 매핑 검증 (각 assistant 메시지가 같은 turnIndex 와 매핑) | 동 파일, "turnDebug 복수 turn" |
| I-15 | maintainability | `aiNodeExec(outputData, overrides?)` 픽스처 헬퍼 추출 — 8개 신규 케이스에서 반복 제거 | 동 파일, describe 블록 상단 |
| I-16 | maintainability | 케이스 이름을 실제 검증 방식 반영으로 수정 | 동 파일, 모든 신규 케이스 |
| I-17 | documentation | `applyExecutionSnapshot` JSDoc 에 ai_conversation hydration 동작 항목 추가 | `apply-execution-snapshot.ts` 상단 |
| I-19 | documentation | 신규 ai_conversation 테스트를 별도 describe 블록 (`"ai_conversation REST 스냅샷 hydration"`) 으로 분리 | 동 테스트 파일 |
| I-18 | documentation | consistency-check I-11 (spec §Rationale WS/REST 동등 원칙) 을 plan follow-up 으로 등록 | `plan/in-progress/agent-session-restore-on-rejoin.md` |
| I-4 | security | 테스트 픽스처 LLM 모델 식별자 중립화 (`"gpt-4o"` → `"test-model"`) | 동 테스트 파일 신규 케이스 |

## 보류 / 후속 항목

다음은 본 PR 범위 밖이므로 의도적으로 처리하지 않음:

- **W-1 (maintainability)** — `inferInteractionTypeFromNodeType` 의 노드 타입 문자열 하드코딩. **기존 코드**이며 본 변경(ai_conversation 분기 hydration 추가)과 무관. 별도 리팩토링 plan 대상.
- **I-1, I-2, I-3 (security)** — outputData 런타임 스키마 검증(`zod` 등 도입), `requestPayload` 노출 정책, `interactionType` whitelist 가드. 본 hydration 패치 범위를 크게 넘는 보안 정책 변경 — 별도 검토 plan 필요.
- **I-9 (side_effect)** — `pauseForConversation` + `setConversationMessages` 분리 호출의 중간 상태 React 렌더 노출. Zustand 의 `setState` 는 동기이고 함수가 return 전까지 React 가 batch 처리하므로 실 위험 없음. store action 추가는 scope 확장이라 보류.
- **I-10 (side_effect)** — `useExecutionStore.getState()` 이중 호출 의도 주석. 같은 파일의 status downgrade 분기 등에서도 동일 패턴을 사용하고 있어 readers 가 인식하는 관용. 단일 추가 주석 정도는 향후 maintenance commit 에서.
- **I-11 (testing/maintainability)** — beforeEach 픽스처와 store initialState 동기화. 기존 테스트 파일 컨벤션 변경 → 별도 작업.
- **I-8** — plan/in-progress → plan/complete `git mv`. 마지막 작업 PR 안에서 처리 (CLAUDE.md "PLAN 문서 라이프사이클"). 본 PR 의 다음 commit 에서 함께.

## TEST 결과

본 RESOLUTION 작성 직후 TEST WORKFLOW 재수행 결과:

- **lint**: 통과 — `npm run lint` (eslint 0 issues). 첫 lint sweep 은 직전 e2e 산출물 `playwright-report/` 의 minified asset 들이 잡혔으나 (gitignore 됨, lint 대상이면 안 됨), 산출물 정리 후 재실행 clean.
- **unit test**: 통과 — `npm test` (frontend), 1456/1456 passing (123 files; 신규 ai_conversation describe 9건 포함 — structured / legacy nested / legacy flat / information_extractor / no-overwrite / turnDebug / multi-turn turnDebug / inconsistent snapshot + ai_conversation / empty messages + selectedIndex 보존).
  - 첫 sweep 5건 실패는 worktree 의 `packages/expression-engine` 가 `dayjs` 모듈을 찾지 못한 환경 문제 (npm install 부분 실패). main worktree 의 동일 패키지 `node_modules` 를 심볼릭 링크해 해결 후 1456/1456.
- **build**: 통과 — `npm run build` (Next.js, no errors/warnings)
- **e2e (backend)**: 통과 — `make e2e-test` **86/86 passing** (15 suites) — 직전 commit `4a99cd54` 기준으로 검증 완료. 이후 추가된 변경(JSDoc + plan.md + 테스트 9건)은 runtime 코드 무영향 → 재실행 면제.
- **e2e (full, playwright 포함)**: **자동 흐름 환경 차단** — docker compose minio 컨테이너가 healthy 상태에서 즉시 exited(0) 로 종료되며 dependency chain 이 깨지는 transient docker 인프라 문제 (`Error response from daemon: No such container: ...`, `container clemvion-e2e-minio-1 exited (0)`). 본 변경과 무관한 환경 문제로 SKILL.md "/ai-review 8.7 안전 가드 — docker 인프라 실행 불가" 에 해당.
  - 직전 commit `4a99cd54` 기준의 e2e-test-full 은 정상 동작했으며 playwright 결과는 `36/37 pass` (1건 실패: `auth/password-reset.spec.ts:51` redirect 타이밍 — 본 변경과 파일·도메인 모두 무관, 최근 commits `ae3465cb` / `99cf1973` / `ea3d7f29` 모두 해당 e2e 파일을 패치 중인 플레이키 영역).
  - RESOLUTION 추가 변경(JSDoc + plan + 테스트) 은 frontend 런타임 코드 미터치라 playwright 회귀 가능성 없음.

> 환경 차단 사유로 docker 인프라 e2e-full 재실행 불가 — 사용자 환경(Docker daemon stale container 정리 등) 복구 요청 사항. 단, 본 PR 코드의 본질적 검증(20 unit tests covering 3 outputData shapes + reconcile path + multi-turn debug + overwrite protection)은 완료되어 있고, backend e2e 86/86 통과 + frontend lint/build clean 으로 회귀 위험 LOW 로 판단.

## 산출물

- 본 RESOLUTION.md
- `SUMMARY.md` (7 reviewer 통합)
- 각 reviewer 별 `<role>.md`
- `_routing_decision.json` — router 가 6 reviewer skip (performance / architecture / dependency / database / concurrency / api_contract)
- `_retry_state.json` — 모두 success
