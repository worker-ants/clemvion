# Code Review 통합 보고서

리뷰 대상: `fix(ai-agent): W7 SPEC-DRIFT — multi-turn condition 도구 meta.toolCalls 미합산 통일`
커밋: `c7e9574f`
파일: `ai-turn-executor.ts`, `ai-turn-executor.spec.ts`

---

## 전체 위험도

**LOW** — Critical 발견 없음. 전체 14개 reviewer 중 12개 NONE, 2개 LOW(side_effect·testing). 이번 변경은 spec §7.1 준수를 위한 정확한 버그픽스이며 신규 위험 요소 없음. LOW 항목 모두 운영 모니터링 임계값 재검토 및 보완 테스트 케이스 추가 권고 수준으로 blocking 없음.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

해당 없음.

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `meta.toolCalls` 수치 의미 변경 — 이전 실행 결과(condition 도구 포함 수치)와 신규 결과(미포함 수치) 간 히스토리 불연속 발생 | `recordMultiTurnNonProviderToolResults` / `_resumeState.toolCalls` | 운영 모니터링 대시보드·분석 쿼리가 `meta.toolCalls` 임계값 기반 알림을 사용하는 경우 재검토 권장. 코드 자체는 spec 준수로 올바름 |
| 2 | testing | condition-only(normal 도구 없음) multi-turn 케이스 미존재 — 현재 추가 케이스는 condition+normal 혼합만 다룸 | `processMultiTurnMessage (resume loop)` describe 블록 | 낮은 우선순위. `conditionToolCalls.length > 0, normalToolCalls.length === 0` 명시 케이스 추가 시 회귀 탐지 강화 |
| 3 | testing | `maxToolCalls` 소진 경계값 + condition+normal 혼합 시나리오 테스트 미존재 | `processMultiTurnMessage (resume loop)` describe 블록 | 낮은 우선순위. `maxToolCalls: 1` + condition+normal 혼합 케이스 추가 권장 |
| 4 | testing | `condRouteDurationMs` 단일 캡처 이후 `totalDurationMs` / `turnDebug[].totalDurationMs` 일치 여부 테스트 미존재 | `handleSingleTurnConditionRoute`, multi-turn condition 분기 | 낮은 우선순위. `jest.useFakeTimers()` 사용 시 이중 `Date.now()` 호출 회귀 방지 가능 |
| 5 | performance | `conditionToolCalls` 루프 내 `JSON.stringify({ result: CONDITION_DEFERRAL_RESULT_MSG })` 매 반복 호출 — 직렬화 결과가 상수이므로 불필요 | `recordSingleTurnNonProviderToolResults`, `recordMultiTurnNonProviderToolResults` 조건 도구 루프 | `condDeferralContent` 를 루프 밖 또는 모듈 레벨 상수로 호이스팅 |
| 6 | performance | `buildAiNodeRefFromContext` / `buildAiNodeRefFromState` 루프 내 반복 생성 — 동일 실행 내 불변 객체 | 동일 두 메서드 루프 | 루프 진입 전 `nodeRef` 1회 계산 후 재사용 |
| 7 | architecture | `recordSingleTurnNonProviderToolResults` / `recordMultiTurnNonProviderToolResults` 의 `conditionToolCalls` 처리 블록이 완전 동형 — 공통 헬퍼 추출 여지 | 두 private 메서드 내 condition 루프 | `recordConditionDeferralMessages` 공통 private 헬퍼로 추출해 정책 단일화 지점 확보 (normalToolCalls 블록은 `isToolTurnsEnabled` 인자 차이로 파라미터화 필요) |
| 8 | architecture | `state: Record<string, unknown>` 런타임 캐스팅 반복 — `state.rawConfig as Record<string, unknown>`, `state.conversationThreadRef as ConversationThread` 등 | multi-turn 경로 전반 | 장기 개선: `MultiTurnResumeState` 명시 인터페이스 정의해 캐스팅 지점을 경계(entry/exit)로 국한 |
| 9 | security | `sanitizeToolError` 첫 줄 200자 pass-through — provider 구현체별 예외 메시지 형태 의존 | `ai-turn-executor.ts` — `sanitizeToolError` 함수 및 `runProviderTool` catch 블록 | allowlist 기반 필터 또는 에러 분류 타입(provider-level 공개 에러 vs raw 예외) 구분 레이어 추가 검토 (선재 이슈, 이번 변경 범위 외) |
| 10 | security | `capFormDataBytes` 비-string 필드(number/boolean/array/object)에 byte cap 미적용 — 대형 배열 LLM context 폭주 가능성 | `ai-turn-executor.ts` — `capFormDataBytes` 비-string 분기 | 비-string 필드 serialized bytes 기준 단일 cap 또는 배열 원소 수 하드 한도 추가 검토 (선재 이슈, 이번 변경 범위 외) |
| 11 | maintainability | 짧은 spec 앵커(`§3.f-g` 형식) 일부 잔존 — 이번 변경에서 주요 위치는 완전 경로로 전환됐으나 코드베이스 전반에 혼재 | `ai-turn-executor.ts` 전반 | 향후 나머지 짧은 앵커도 점진적으로 `spec/<경로> §섹션` 완전 경로로 전환 권장 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 기존 `sanitizeToolError` pass-through, `capFormDataBytes` 비-string 미적용은 선재 이슈. 이번 변경 자체 신규 취약점 없음 |
| performance | NONE | `Date.now()` 이중 호출 단일 캡처 개선 긍정적. 루프 내 JSON.stringify / NodeRef 반복 생성은 실사용 규모에서 측정 불가 수준 |
| architecture | NONE | 두 동형 condition 블록 공통 헬퍼 추출 여지, `Record<string, unknown>` 캐스팅 패턴은 장기 개선 과제. 차단 이슈 없음 |
| requirement | NONE | spec §7.1 "조건 도구 제외" 명세에 완전 수렴. 테스트 단언 정확. spec 변경 불요 |
| scope | NONE | 변경 항목 모두 커밋 메시지와 1:1 대응. 무관 파일 없음 |
| side_effect | LOW | `meta.toolCalls` 수치 의미 변경으로 히스토리 데이터 불연속. 의도된 버그픽스의 필연적 결과이나 운영 임계값 재검토 필요 |
| maintainability | NONE | 잘못된 INVARIANT 주석 제거, spec 참조 완전 경로 전환, 상수화 모두 긍정적. 모든 발견 INFO |
| testing | LOW | 핵심 버그픽스 회귀 고정 테스트 추가됨. condition-only multi-turn, 경계값, 타임스탬프 일치 테스트 보강 여지 존재 |
| documentation | NONE | JSDoc 레이어 경계 명시, spec 참조 완전화, INVARIANT 주석 정정 모두 양호 |
| dependency | NONE | 신규 외부 의존성 없음. import 변경 없음 |
| database | NONE | DB 관련 변경 없음 |
| concurrency | NONE | `AiTurnExecutor` 무상태 collaborator 구조로 경쟁 조건 구조적 불발생 |
| api_contract | NONE | HTTP 엔드포인트·스키마·인증 변경 없음 |
| user_guide_sync | NONE | 신규 노드·schema·에러코드·UI 문자열 없음. 동반 갱신 의무 없음 |

---

## 발견 없는 에이전트

- **database** — DB 관련 코드 없음
- **api_contract** — API 엔드포인트 변경 없음
- **user_guide_sync** — 유저 가이드 동반 갱신 트리거 없음
- **dependency** — 신규 의존성 없음

---

## 권장 조치사항

1. (운영) `meta.toolCalls` 수치 의미 변경 확인 — 모니터링 대시보드·분석 쿼리에서 `toolCalls` 기반 임계값/알림을 사용하는 경우 "condition 도구 포함 → 미포함"으로 기준값 재검토 (히스토리 데이터와 수치 불연속 인지)
2. (테스트 보완, 낮은 우선순위) condition-only multi-turn 케이스 추가: `conditionToolCalls.length > 0`, `normalToolCalls.length === 0` 시나리오로 `toolCalls === 0` 명시 단언
3. (테스트 보완, 낮은 우선순위) `maxToolCalls` 경계값 + condition+normal 혼합 케이스 추가: `maxToolCalls: 1` 상태에서 condition 미합산 확인
4. (성능 소개선, 낮은 우선순위) `conditionToolCalls` 루프 내 `JSON.stringify(...)` 호이스팅 — 모듈 레벨 상수 `CONDITION_DEFERRAL_CONTENT` 로 캐시
5. (아키텍처 장기) 두 메서드의 동형 condition 블록을 `recordConditionDeferralMessages` 공통 헬퍼로 추출해 정책 단일화
6. (아키텍처 장기) `MultiTurnResumeState` 인터페이스 정의로 `Record<string, unknown>` 캐스팅 경계화

---

## 라우터 결정

라우터 미사용 — 사유: `routing=fallback-all`. 전체 reviewer 실행.

- **실행 (14명)**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync
- **강제 포함 (router_safety)**: maintainability, requirement, scope, security, side_effect, testing
- **제외**: 없음