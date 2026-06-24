# Code Review 통합 보고서

## 전체 위험도
**LOW** — M-3 3단계 `AssistantTurnPersistenceService` 분리는 behavior-preserving 순수 리팩토링이며 Critical 발견 없음. WARNING 1건(architecture: `makeResumeMeta` 캡슐화 경계 관통)은 블로커 아니며 중기 개선 대상. SPEC-DRIFT 2건은 코드 결함이 아닌 spec 갱신 필요 사항.

## Critical 발견사항

_없음_

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `makeResumeMeta` 가 `stream.service.ts` 에서 직접 import 돼 persist 모듈 캡슐화 경계가 부분적으로 관통됨. 향후 `makeResumeMeta` 시그니처 변경 시 스트림 서비스도 함께 수정 필요. | `workflow-assistant-stream.service.ts`, `assistant-turn-persistence.service.ts` | `persistAssistantTurn` 에 `stallRounds: number` 오버로드 추가해 내부에서 `makeResumeMeta` 호출 — caller 가 raw 카운터만 전달하는 방식으로 경계 완전 폐쇄. 현 단계 블로커 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | spec §10 의사코드가 직접 호출 경로(`this.persistAssistantTurn(...)`)로 기술되어 있으나 실제 구현은 위임 경로. 코드가 정확하며 spec 갱신 필요. | `spec/3-workflow-editor/4-ai-assistant.md` §10 | planner 위임. M-3 전체 완료 후 일괄 갱신. |
| 2 | SPEC-DRIFT | spec §10 최종 row 판정 기준: spec 은 `consecutiveStallRounds > 0`, 구현은 `totalStallCount > 0`(누적). 코드가 stall-then-progress 를 올바르게 처리하며 spec 이 낡음. | `spec/3-workflow-editor/4-ai-assistant.md` §10 | planner 위임. 코드 리버트는 버그 재도입이므로 오답. |
| 3 | Maintainability | `persistAssistantTurn` positional 파라미터 7개 — 호출부 4곳 `null` 나열 반복. Pre-existing verbatim 이동. | 시그니처 + 호출부 4곳 | `AssistantPersistParams` options object 별건 PR. |
| 4 | Maintainability | `as never` mock 캐스팅 — 기존 코드베이스 관행과 일치. | spec 파일들 | 장기 `as Pick<...>` 교체(선택). |
| 5 | Testing | `persistUserTurn` `currentTitle: undefined` 케이스 미테스트(`null` 과 동일 경로). | persistUserTurn describe | undefined 케이스 추가 권장. |
| 6 | Testing | title slice 경계값(정확히 40자) 케이스 미테스트. | persistUserTurn describe | 40자 케이스 추가(선택). |
| 7 | Security | `stallRounds` 상한 검증 없음 — 내부 호출자 `MAX_STALL_ROUNDS=2` 제한. 실질 표면 없음. | `makeResumeMeta` | 향후 외부 입력 시 clamp(현재 불요). |
| 8 | Security | `content` 원문 DB 저장 — TypeORM 바인딩으로 SQLi 차단. Pre-existing. | persistUserTurn | 컨트롤러 `@MaxLength` 확인(범위 외). |
| 9 | Security | `sessionId` 소유권 인가는 컨트롤러/가드 레이어 책임. Pre-existing, 새 공백 아님. | 서비스 | 컨트롤러 가드 확인(범위 외). |
| 10 | Documentation | SPEC-DRIFT 3건 spec 갱신 미완료. planner 위임 대상. | spec §10 | M-3 완료 후 일괄. |
| 11 | Scope | review/** 산출물과 구현 fix 가 동일 커밋(8426d829) 혼재. 차단 불요. | 8426d829 | 향후 분리 고려. |
| 12 | Architecture | `finishReason: string` 넓으나 provider 원본 + 합성 마커 모두 수용 필요해 strict union 불가. Pre-existing. JSDoc 근거 명시됨. | 서비스 | narrowing hint 정도 충분. 강제 불필요. |
| 13 | Architecture | `UsageSnapshot` 과 `AssistantStreamEvent` `'usage'` 동형 — 이번 인터페이스 추출로 개선됨. | 서비스 | 장기: 이벤트 data 를 `UsageSnapshot` 참조로. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 신규 취약점 없음. INFO 3건 모두 pre-existing/방어적 고려. |
| architecture | LOW | WARNING 1 — `makeResumeMeta` 경계 관통(중기). SRP·DIP·무상태 양호. |
| requirement | NONE | 핵심 요구 충족. SPEC-DRIFT 2건(코드 결함 아님). |
| scope | NONE | RESOLUTION 조치와 정확히 일치. |
| side_effect | NONE | 전역 상태 없음, 공개 API 무변, SSE 순서 보존. |
| maintainability | LOW | positional 7개·`as never` — pre-existing 중기. |
| testing | LOW | 전용 단위 추가·통합 갱신. undefined·40자 경계 선택적. |
| documentation | LOW | JSDoc·의도 주석 정상. SPEC-DRIFT planner 위임. |

## 권장 조치사항

1. **[WARNING — deliberate defer]** `makeResumeMeta` 공유 import: 본 작업 스펙이 명시한 "공유 헬퍼 leaf 추출"의 의도된 결과. streamMessage 가 turn-scoped `totalStallCount` 를 소유·derive 하고 무상태 collaborator 는 받은 메타만 write 하는 1·2단계 패턴 + impl-prep consistency 의 "collaborator 는 받은 것만 write" 원칙과 정합. import 의도 주석 명시됨. RESOLUTION 참조.
2. **[SPEC-DRIFT — planner 위임]** §10 의사코드 위임 경로 + `consecutiveStallRounds > 0`→`totalStallCount > 0` 갱신(코드 revert 금지). M-3 전체 완료 후 일괄.
3. **[중기 개선 — 별건]** positional 파라미터 options object 화, `as never`→`Pick<>`.

## 라우터 결정

라우터 사용됨 (`routing=done`). 실행 8명(전원 router_safety): security·architecture·requirement·scope·side_effect·maintainability·testing·documentation. 제외 6명: performance·dependency·database·concurrency·api_contract·user_guide_sync.
