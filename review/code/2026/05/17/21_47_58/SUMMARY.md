# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — AI Agent multi-turn 후속 turn 의 `NodeExecution.outputData` DB 영속 버그 수정은 전반적으로 올바르게 구현되었으나, `nodeExec` null 경로의 무음 실패와 인메모리 참조 변경 후 저장으로 인한 잠재적 경쟁 조건이 CRITICAL/MEDIUM 수준 우려를 남긴다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|---|---|---|---|
| 1 | 요구사항 | `nodeExec`가 `null/undefined`인 경우 save 가 조용히 skip 되며 경고 로그 없이 후속 로직이 진행되어, 경쟁 조건 발생 시 데이터 누락이 무성 오류로 남는다 | `execution-engine.service.ts` waiting_for_input 분기의 `if (nodeExec) { ... }` | `logger.warn('nodeExec not found, skipping DB persist')` 추가 또는 throw + rollback |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 제안 |
|---|---|---|---|
| 1 | 보안 / 요구사항 | `_resumeState` strip 이 shallow copy + delete 방식이라 향후 중첩 internal 필드 추가 시 silent DB 누출 위험 | allowlist destructure 또는 `_` prefix 일괄 strip 유틸로 중앙화 |
| 2 | 동시성 | `continueAiConversation` 연속 호출 시 `await` 경계 이후 다른 코루틴이 동일 `nodeExec` 참조를 이미 변경 — last-write-wins 누적 메시지 덮어쓰기 위험 | fresh 조회 또는 TypeORM `update(id, { outputData })` 단일 쿼리로 대체 |
| 3 | 요구사항 | self-transition 설계가 코드 수준에서 명시되지 않고, DB 오류 시 in-memory 캐시와 불일치 | try/catch 추가 + `logger.error` 또는 self-transition 지원 메서드 활용 |
| 4 | 테스트 | `continueAiConversation` 호출에 `await` 미적용, `flushPromises` 단발 의존 — 깊은 Promise 체인 false-negative | `await` 직접 적용 또는 `flushPromises` 2회 |
| 5 | 테스트 | `savedAgentRows` 필터 기준 `nodeId === 'node-agent'` 가 fixture 와 결합 — 헬퍼 변경 시 무음 실패 | nodeId 상수화 + assertion 메시지 명시화 |
| 6 | 변경 범위 | 핵심 fix 외 포맷팅 hunk 혼재 | 별 commit 분리 |
| 7 | 변경 범위 | catalog-sync.spec.ts / registry.test.ts 경로 fix 가 본 PR 혼재 | 별 commit 분리 또는 PR 본문 명시 |
| 8 | 테스트 | `registry.test.ts` 의 `it.runIf(hasRealDocs)` 조건부 실행이 CI 에서 `content/docs` 부재 시 검증 무력화 | CI step 추가 또는 skip 시 warn 로그 |
| 9 | 문서화 | plan 체크리스트에 API 문서 / 사용자 매뉴얼 검토 항목 누락 | "API 문서 영향 여부 확인" 항목 추가 |
| 10 | 요구사항 | plan 완료 항목 체크박스 미갱신 | `[x]` 갱신 |

## 참고 (INFO) — 12건

요약: shallow copy 패턴 (`structuredClone` 고려), `__dirname` `..` 반복 패턴 (`repoRoot()` 헬퍼 중앙화), canary 상수화, 테스트 case 분리, `nodeExec === undefined` 케이스 추가 검증, emit-then-save atomicity 개선, deep-clone 방어, sentinel 범위 확장, `if (nodeExec)` 의도 주석 등. 본 PR 의 회귀 fix scope 밖.

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|---|---|---|
| security | LOW | `_resumeState` strip shallow copy 잠재 누출 (W1). 실질 공격 면적 없음 |
| requirement | MEDIUM | `nodeExec` null 무음 실패(C1), allowlist 미적용(W1), Execution 원자성 명시 부재(W3) |
| scope | LOW | 포맷팅 hunk + 무관 경로 fix 혼재. 기능 영향 없음 |
| side_effect | LOW | emit-then-save 패턴 기존 불일치, shallow copy 공유 참조 — 현 흐름에서 문제 없음 |
| maintainability | LOW | `..` 반복 패턴 재발 위험, canary 미추출, 타입 캐스팅 체인 |
| testing | LOW | `flushPromises` race 잠재성, `nodeId` 결합, false branch 미검증 |
| documentation | LOW | null 조건 주석 누락, 체크리스트 누락 |
| database | NONE | 실제 DB 코드 변경 없음 |
| concurrency | MEDIUM | 공유 `nodeExec` 참조 last-write-wins, await 누락 unhandled rejection 소실 |
| api_contract | NONE | DTO/응답 스키마 변경 없음 |

## 라우터 결정

- 실행: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract` (10명)
- skip: `performance` (단발 save, 회귀 신호 없음), `architecture` (모듈 경계 변경 없음), `dependency` (package.json 변경 없음)

## 후속 조치

본 SUMMARY 의 발견사항 조치 결과는 `RESOLUTION.md` 참고. Critical 1건 + Warning 8건 직접 fix, Warning 2건 + INFO 12건은 follow-up.
