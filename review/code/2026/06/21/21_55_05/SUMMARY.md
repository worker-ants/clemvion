# Code Review 통합 보고서

> 대상 커밋: 960968b4 — M-1 2단계 fresh review WARNING 해소 (AiMemoryManager 테스트 커버리지 보강, 14→17 케이스)
> 리뷰 세션: 2026/06/21 21_55_05

## 전체 위험도
**LOW** — test-only 변경으로 production 로직 무변경. 직전 리뷰(21_43_55) WARNING 3건이 신규 테스트로 정확히 해소됨. 잔존 항목은 모두 planner 도메인 비차단 사항.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts` 미등재 — spec-coverage audit 시 갭 검출. 이전 리뷰(21_43_55 WARNING #4)에서도 동일 지적. developer 해소 불가(spec 쓰기 권한 없음). | `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter | M-1 전체 완료 후 planner 가 `ai-condition-evaluator.ts` + `ai-memory-manager.ts` 일괄 등재 및 §6.1/§6.2 구현 참조 갱신. 비차단 잔존. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] `tailMode`/`keepUserExchanges`/`queryText` 폴백 동작이 spec 본문 미명시 — 이미 직전 SUMMARY SPEC-DRIFT #1·#2로 분류돼 planner 위임 중. 본 커밋이 추가 악화 없음. | `spec/4-nodes/3-ai/1-ai-agent.md` §6.2 d.5, §6.1 단계 1.3 | 코드 유지 + planner 위임 유지. |
| 2 | Security / Side Effect | `review/**/_retry_state.json` 에 개발 머신 절대 경로(`/Volumes/project/private/clemvion/...`) 포함 — git 이력에 파일시스템 구조 노출. 이전 리뷰(21_43_55 INFO #4)에서 이미 인지된 반복 패턴. | `review/code/2026/06/21/21_43_55/_retry_state.json` | `review/**/_retry_state.json` 을 `.gitignore` 에 추가. 이번 PR 범위 밖, 별도 위생 작업. |
| 3 | Testing | WARNING #2 해소 테스트(`contextInjectionMode=system_text`)가 "splice 안 함" 부정 검증에 그침 — `finalSystemPrompt` 에 꼬리 텍스트가 실제로 append 됐는지 긍정 검증 부재. | `ai-memory-manager.spec.ts` line 349–380 | `expect(res.finalSystemPrompt).toContain(...)` 단언 추가. 비차단. |
| 4 | Testing | WARNING #1 해소 테스트의 `mock.calls[0][1]` 직접 접근 — 인자 순서 변경 시 묵묵히 오탐 가능. | `ai-memory-manager.spec.ts` line 330–347 | `toHaveBeenCalledWith(...)` 형식으로 전환 권장. 비차단. |
| 5 | Testing | `resolveMemoryStrategy` describe 내 `mgr` 인스턴스가 `beforeEach` 없이 공유 — 현재 순수 함수라 문제 없으나 향후 상태를 가진 케이스 추가 시 격리 파괴 위험. 기존 잔존(SUMMARY INFO #11). | `ai-memory-manager.spec.ts` line 76 | `beforeEach` 로 인스턴스 생성 이동. 비차단. |
| 6 | Maintainability | `as unknown as { resolveScopeKey: jest.Mock; recall: jest.Mock }` 인라인 캐스팅 6회 이상 분산 — 기존 패턴 동형 답습. 직전 SUMMARY INFO #7 잔존. | `ai-memory-manager.spec.ts` 전반 | 파일 상단에 `AgentMemMock` 타입 별칭 선언 후 단일 캐스팅으로 교체. 비차단. |
| 7 | Maintainability | `threadFake([], [])` 두 번째 인자 의미 불명확 — 파라미터명만으로 `getThreadExcludingNode` / `getThread` 매핑 불분명. 직전 SUMMARY INFO #8 잔존. | `ai-memory-manager.spec.ts` line 62, 118 | JSDoc 1줄 추가 또는 파라미터명 리네임. 비차단. |
| 8 | Maintainability | `as InjectArgs['target']` 반복 캐스팅 신규 케이스 3건 추가(파일 전체 7회 이상) — `baseInject` `target` 기본값이 `undefined` 라 각 케이스가 개별 override 필요. | `ai-memory-manager.spec.ts` line 67, 98–100, 122–123 | `baseInject` 의 `target` 기본값을 `{ conversationThread: { turns: [] } }` 로 변경. 비차단. |
| 9 | Security | 테스트 픽스처의 `as unknown as Ctor[N]` 이중 캐스팅 — test-only 이므로 production 위험 없음. 중장기적으로 production 코드 내 강제 캐스팅에 Zod 검증 적용 권장(이번 변경 범위 밖). | `ai-memory-manager.spec.ts` — `agentMemFake`, `llmFake`, `threadFake` | 별도 개선 작업. 비차단. |
| 10 | Documentation | `threadFake(turns, fullTurns)` 픽스처 헬퍼에 JSDoc 없음 — 파라미터 매핑을 주석 없이 파악하기 어려움. | `ai-memory-manager.spec.ts` — `threadFake` 함수 정의 | `@param turns getThreadExcludingNode 반환값`, `@param fullTurns getThread.turns 반환값` JSDoc 1줄 추가. 비차단. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | INFO 3건 — `_retry_state.json` 절대 경로 노출(기존), test-only 이중 캐스팅(비위험), 하드코딩 더미값(정상) |
| requirement | NONE | 이전 WARNING #1·#2·#3 모두 해소 확인. 잔존 SPEC-DRIFT 2건은 기존 planner 위임 항목 |
| scope | NONE | 범위 이탈 없음. 테스트 3건 추가 + review 산출물 신설만 변경 |
| side_effect | NONE | 격리된 Jest unit test. 전역 상태·파일시스템·네트워크 접근 없음. `_retry_state.json` 절대 경로(기존 INFO) |
| maintainability | NONE | 기존 패턴 동형 답습 INFO 4건 — 신규 도입 문제 없음 |
| testing | NONE | WARNING 3건 정확히 해소. 소규모 미흡 INFO 2건(부정 검증에 그침, mock.calls 접근) 비차단 |
| documentation | LOW | WARNING 1건 — spec frontmatter `code:` 미등재(planner 도메인, 비차단). INFO 4건 |

## 발견 없는 에이전트

- **scope**: 범위 이탈 발견 없음

## 권장 조치사항

1. **[SPEC-DRIFT / planner 위임]** `spec/4-nodes/3-ai/1-ai-agent.md` frontmatter `code:` 에 `ai-memory-manager.ts`·`ai-condition-evaluator.ts` 일괄 등재 및 §6.1/§6.2 구현 참조 갱신. M-1 전체 완료 후 planner 처리.
2. **[SPEC-DRIFT / planner 위임]** `tailMode`/`keepUserExchanges`/`queryText` 폴백 동작을 spec §6.2 d.5, §6.1 단계 1.3 에 명시. 기존 planner 위임 유지.
3. **[위생 / 별도 작업]** `review/**/_retry_state.json` 을 `.gitignore` 에 추가해 향후 절대 경로 노출 방지.
4. **[테스트 개선 / 비차단]** `contextInjectionMode=system_text` 케이스에 `finalSystemPrompt` 긍정 단언 추가.
5. **[테스트 개선 / 비차단]** `mock.calls[0][1]` 접근을 `toHaveBeenCalledWith(...)` 형식으로 전환.
6. **[유지보수 / 비차단]** `AgentMemMock` 타입 별칭 선언 및 `baseInject` `target` 기본값 개선 — 별도 리팩터링 PR 에서 일괄 처리.

## 라우터 결정

라우터가 선별 실행함 (`routing_status=done`).

- **실행 (강제 포함 — router_safety)**: `security`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation` (7명, 전원 router_safety 강제 포함)
- **제외**: `performance`, `architecture`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (7명)

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | test-only 변경 — 성능 영향 없음 |
| architecture | production 코드 무변경 — 아키텍처 영향 없음 |
| dependency | 신규 의존성 추가 없음 |
| database | DB 스키마/쿼리 변경 없음 |
| concurrency | 동시성 로직 변경 없음 |
| api_contract | 공개 API 변경 없음 |
| user_guide_sync | 사용자 가이드 영향 없음 |

- **강제 포함 (router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명 전원)