# RESOLUTION — memory-internals-refactor-813b6e (#484 후속 공유 헬퍼 추출)

**리뷰 범위**: `git diff 2b793ffa..HEAD -- codebase/` (behavior-preserving 리팩토링)
**SUMMARY 판정**: side_effect BLOCK: NO / 위험도 LOW. consistency BLOCK 없음.
**날짜**: 2026-06-06

## 처리 결과

| ID | 등급 | 처리 | 내용 |
| --- | --- | --- | --- |
| W1 | WARNING | **수정** | `ai-agent.handler.ts:943` JSDoc 주석이 실재하지 않는 `getThreadExcludingNode` 참조 → `getThread` 로 정정 (동작 무영향, 주석 오기) |
| W2 | WARNING | **defer (수용)** | `buildAgentMemorySchemaFields` 반환 타입 `Record<string, z.ZodTypeAny>` spread 시 타입 정밀도 저하. **런타임 parse 동작 불변**(BLOCK:NO). 추출 전 인라인 정의도 소비자가 narrow 타입을 강제하지 않았고, 회귀 위험 대비 `satisfies`/`as const` 리팩토링 이득이 작아 본 PR 범위에서 제외. 필요 시 별도 타입-정밀화 백로그. |
| I1~I6 | INFO | 확인 | 모두 "이상 없음" — DEFAULT_MEMORY_* 값 동치, resolveMemoryTtlDays 경계 동치, scheduleMemoryExtraction payload·watermark 동치, import 경로 이전 정합 확인 |

## 추가 보강 (리뷰 외)

- **테스트 커버리지**: 추출된 공유 헬퍼 `resolveMemoryTtlDays`(경계 8케이스) + `scheduleMemoryExtraction`(strategy/scheduler/watermark/dedup/enqueue 5케이스) 단위 테스트를 `shared/agent-memory-injection.spec.ts` 에 추가 — 추출로 인해 핸들러 private 메서드 커버리지에서 빠진 부분 보전.
- **import 정리**: `information-extractor.handler.ts` 의 `DEFAULT_MEMORY_TOP_K`/`DEFAULT_MEMORY_THRESHOLD` import 를 `ai-agent.schema` re-export 경유 → `shared/agent-memory-schema` 직접 import 로 정정 (re-export 의존 제거).

## 검증

- `nest build` (production typecheck gate, tsconfig.build.json) — EXIT 0
- `jest src/nodes/ai/{shared,ai-agent/ai-agent.handler,information-extractor/information-extractor.handler}` — 6 suites / 235 tests PASS
- `eslint --fix` 대상 3파일 — EXIT 0
