# Code Review 통합 보고서

## 전체 위험도
**LOW** — 순수 behavior-preserving 리팩터링. CRITICAL/WARNING 발견 없음. 모든 발견사항은 INFO 수준이며 대다수는 미래 단계 권고 또는 SPEC-DRIFT(spec/plan 문서 갱신 필요)임.

## Critical 발견사항

_없음_

## 경고 (WARNING)

_없음_

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | spec 구현 참조 포인터 구식 — `(구현: ai-agent.handler.ts classifyToolCalls)` 가 낡은 위치를 가리킴. 코드는 올바르게 이동됐으며 revert 가 오답. | `spec/4-nodes/3-ai/1-ai-agent.md` §6.1 3.a (L370) | spec 참조를 evaluator 로 갱신. project-planner 위임. |
| 2 | SPEC-DRIFT | plan M-1 체크박스 미갱신 — 1단계 완료됐으나 plan 의 체크박스가 `미착수` 상태. | `plan/in-progress/refactor/02-architecture.md` L124 | M-1 체크박스를 "1단계 완료"로 표시, 완료 커밋 해시·리뷰 경로 기록. (본 PR 에서 처리) |
| 3 | 보안 | condition.prompt 가 이스케이핑 없이 시스템 프롬프트에 직접 삽입(pre-existing). ConditionDef 가 워크플로 설계자(admin) 신뢰 레벨이라면 현재 실용적 위험 낮음. | `ai-condition-evaluator.ts` | ConditionDef 신뢰 경계 문서화. 외부 입력 확장 시 검증 추가. |
| 4 | 보안 | sanitizeId 충돌 — 서로 다른 ID가 동일 `cond_*` 이름으로 매핑 가능(pre-existing). | `ai-condition-evaluator.ts` | 후속: sanitized 이름 uniqueness 검증. |
| 5 | 유지보수성 | `extractConditionReason` 의 `500` 이 매직 넘버. 같은 파일 내 다른 cap 들은 이름 있는 상수. | `ai-condition-evaluator.ts` | `CONDITION_REASON_MAX_CHARS = 500` 추출. (본 PR 에서 처리) |
| 6 | 유지보수성 | `buildConditionSystemPromptSuffix` 의 인라인 한국어 LLM 안내문이 `KB_TOOL_GUIDANCE` 패턴과 불일치. | `ai-condition-evaluator.ts` | LLM-facing 문자열이라 behavior-preserving 위험 회피 위해 미변경(후속 후보). |
| 7 | 유지보수성 | `classifyToolCalls` winner 선택 시 `indexOf` 선형 탐색. 동작·실용 성능 무관. | `ai-condition-evaluator.ts` | 후속(선택). |
| 8–10 | 아키텍처 | 무상태 collaborator 패턴 적절. 미래 DI(`@Injectable()`) 전환은 `ai/shared/` 승격 시 검토. 현재 변경 불필요. | `ai-condition-evaluator.ts` / `ai-agent.handler.ts` | 차기 단계 메모. |
| 11 | 테스팅 | `buildConditionSystemPromptSuffix` 빈 배열 엣지 미테스트. | spec | 케이스 추가. (본 PR 에서 처리) |
| 12 | 테스팅 | `classifyToolCalls` 빈 `toolCalls` 미테스트. | spec | 케이스 추가. (본 PR 에서 처리) |
| 13 | 테스팅 | `extractConditionReason` 멀티바이트 절단 동작 미명시(char 단위). | spec | 케이스 추가. (본 PR 에서 처리) |
| 14 | 요구사항 | `buildConditionTools` 의 `parameters` 에 `required: []` 누락(pre-existing). LLM API 영향 없음. | `ai-condition-evaluator.ts` | 범위 밖. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | prompt injection(pre-existing, admin 신뢰), sanitizeId 충돌 — 모두 INFO |
| architecture | NONE | 무상태 collaborator 패턴 적절 |
| requirement | NONE | SPEC-DRIFT 2건 — 코드 fix 불필요 |
| scope | (output 부재) | — |
| side_effect | NONE | 부작용 없음, 공개 API 변화 없음 |
| maintainability | LOW | 매직 넘버·인라인 문자열 상수화 권고 — 모두 INFO |
| testing | LOW | 선택적 엣지 케이스 보완 권고 — 모두 INFO |

## 권장 조치사항 / 처리 결과

1. **(본 PR 처리)** plan M-1 체크박스 갱신 + 매직 넘버 `CONDITION_REASON_MAX_CHARS` 상수화 + 테스트 케이스 보완(빈 배열·빈 toolCalls·멀티바이트).
2. **(planner 위임)** spec §6.1 3.a 의 `(구현: ...)` 포인터를 evaluator 로 갱신 — SPEC-DRIFT, 코드 fix 불필요.
3. **(후속 후보)** guidance 문자열 상수화, sanitizeId uniqueness, DI 전환은 `ai/shared/` 승격 단계에서 검토.

## 라우터 결정

- routing_status=done: 실행 `security`/`architecture`/`requirement`/`scope`/`side_effect`/`maintainability`/`testing` (7), 제외 `performance`(순수 리팩터링).
- 참고: `scope` reviewer output_file 부재로 통합 제외(라우터 selected, 결과 파일 미생성).
