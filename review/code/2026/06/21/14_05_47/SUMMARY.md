# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 리팩터링(함수 이동 + import 경로 갱신)으로 기능 변경 없음. Critical 발견사항 없음. WARNING 1건은 이번 PR 범위 밖의 기존 코드 복잡도 관찰.

## Critical 발견사항

해당 없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 유지보수성 | `handleAiMessageTurn` 메서드가 약 345줄의 단일 private 메서드로, `waiting_for_input` 분기와 terminal 분기를 모두 처리해 향후 분기 추가 시 복잡도가 급증할 수 있음. 이번 PR 범위 밖의 기존 코드 문제. | `ai-turn-orchestrator.service.ts` `handleAiMessageTurn` (~564~909줄) | 이번 PR 범위 밖으로 별도 리팩터링 이슈에서 `handleAiWaitingTurn` / `handleAiTerminalTurn` 으로 분리 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `isLlmRateLimit` 이 `llm.service` 에 잔류 — `extractRetryAfterMs` 와 쌍을 이루는 함수인데 이동되지 않아 `text-classifier.handler` 가 여전히 `llm.service` 모듈 의존성을 보유 | `llm.service.ts` line 458, `text-classifier.handler.ts` line 9 | 후속 작업으로 `isLlmRateLimit` 도 `shared/utils/retry-after.ts` (또는 `shared/utils/llm-rate-limit.ts`)로 이동 검토 |
| 2 | 유지보수성 | 헤더 케이스 변형을 수동 3종 열거(`retry-after`, `Retry-After`, `RETRY-AFTER`) — HTTP 표준상 헤더는 case-insensitive이므로 미래 SDK 추가 시 케이스 누락 가능성 존재. 현재 대상 SDK 커버됨. | `shared/utils/retry-after.ts` line 32 | 향후 SDK 추가 시 `toLowerCase()` 기반 탐색으로 교체 고려 |
| 3 | 테스팅 | HTTP-date 테스트가 `Date.now() + 5_000` + `±500ms` 허용 범위 방식 사용 — CI 부하 시 flaky 가능성 잠재. 기존 패턴 이관이며 현재 CI 환경에서 문제 없음. | `retry-after.spec.ts` lines 3327~3418 | 필요 시 `jest.useFakeTimers()` 로 시계 고정 (낮은 우선순위) |
| 4 | 테스팅 | array 타입 헤더 값(`['30']`) 에 대한 `null` 반환 경로가 소스 주석에 언급됐으나 테스트 미포함 | `retry-after.spec.ts` | `{ 'retry-after': ['30'] }` 케이스 추가 고려 (낮은 우선순위) |
| 5 | 부작용 | `execution-engine.service.ts` line 62 에 `extractRetryAfterMs` 를 언급하는 주석(C-1 step2) 잔류 — 실제 import/사용 없는 순수 주석으로 런타임 부작용 없음 | `execution-engine.service.ts` line 62 | 혼란 방지 목적으로 주석 정리 가능하나 필수 아님 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | LOW | `isLlmRateLimit` 이 `llm.service` 에 잔류해 결합 분리가 불완전; 이동 방향 자체는 올바름 |
| requirement | NONE | 9개 테스트 케이스 무손실 이관, spec 침묵 영역, 요구사항 완전 충족 |
| scope | NONE | 범위 위반 없음, 함수 이동 + import 갱신 + 테스트 이관만 |
| side_effect | NONE | 모든 소비자 import 경로 마이그레이션 완료, 구 경로 잔류 코드 없음 |
| maintainability | NONE (WARNING 1건 관찰) | `handleAiMessageTurn` 길이 관찰(범위 밖); 이동 결정 및 코드 품질 양호 |
| testing | NONE | 테스트 완전 이관, 두 계층(단위+통합) 모두 커버, 미세 flakiness INFO 수준 |
| security | — | 출력 파일 부재 (실행 결과 없음) |

## 발견 없는 에이전트

- **scope**: 범위 위반 없음으로 명시
- **requirement**: 요구사항 충족 완전으로 명시
- **side_effect**: 의도치 않은 부작용 없음

## 권장 조치사항
1. (이번 PR 즉시) 별도 조치 필요 없음 — WARNING 1건(`handleAiMessageTurn` 길이)은 이번 PR 범위 밖의 기존 코드 문제로 별도 이슈 추적.
2. (후속 PR) `isLlmRateLimit` 을 `shared/utils/` 로 이동해 `text-classifier.handler` 의 `llm.service` 의존성 완전 제거.
3. (선택적) `retry-after.ts` 헤더 케이스 탐색을 `toLowerCase()` 기반으로 교체 — 미래 SDK 방어.
4. (선택적) `retry-after.spec.ts` HTTP-date 테스트에 `jest.useFakeTimers()` 적용 — CI 결정성 향상.
5. (선택적) array 타입 헤더 값 테스트 케이스 추가.

## 라우터 결정

라우터 선별 실행 (`routing_status=done`):

- **실행**: `security`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing` (7명)
- **강제 포함(router_safety)**: `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing`
- **제외**: `performance`, `documentation`, `dependency`, `database`, `concurrency`, `api_contract`, `user_guide_sync` (7명)

| 제외된 reviewer | 이유 |
|------------------|------|
| performance | 라우터 선별 제외 (상세 이유 미기록) |
| documentation | 라우터 선별 제외 (상세 이유 미기록) |
| dependency | 라우터 선별 제외 (상세 이유 미기록) |
| database | 라우터 선별 제외 (상세 이유 미기록) |
| concurrency | 라우터 선별 제외 (상세 이유 미기록) |
| api_contract | 라우터 선별 제외 (상세 이유 미기록) |
| user_guide_sync | 라우터 선별 제외 (상세 이유 미기록) |

**비고**: `security` reviewer 출력 파일(`security.md`)이 존재하지 않아 내용을 읽을 수 없었음. 에이전트별 요약에 "출력 파일 부재"로 표기.