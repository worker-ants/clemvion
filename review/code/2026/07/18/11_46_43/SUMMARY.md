# Code Review 통합 보고서

## 전체 위험도
**LOW** — behavior-preserving 순수 문서화·계약 명시화 + 회귀 핀 테스트. CRITICAL/WARNING 없음. forced whitelist(7개) 전원 결과 확보 완료(누락 없음).

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/유지보수성 | 동일 설계 결정(IE 의 `errorPayload` self-fill 사유 3가지)이 인터페이스와 구현체 두 파일에 거의 같은 문장으로 중복 서술 — 4개 reviewer(architecture/scope/maintainability/documentation) 공통 지적 | `node-handler.interface.ts:456-470,1281-1300`, `information-extractor.handler.ts:1180-1221` | 현재는 SoT 상호 참조로 drift 리스크 낮음. 향후 계약 재변경 시 인터페이스 쪽을 요약 한 문단으로 압축하고 상세 서술은 핸들러 docblock 에만 남기는 방향 고려 |
| 2 | 아키텍처 | 공유 인터페이스(`ResumableNodeHandler.endMultiTurnConversation`) 가 구현체별로 상이한 파라미터 소비 계약(AiAgentHandler=verbatim relay, IE=self-fill)을 강제 — ISP 인접 긴장 | `node-handler.interface.ts` `ResumableNodeHandler.endMultiTurnConversation`, `information-extractor.handler.ts:1180-1220` | plan 문서 근거상 통합보다 발산 유지가 spec 불변식(§5.3 code-기반 vs HTTP-status 기반 retryable)을 지킴 — 현재 defer 타당. 3번째 multi-turn 핸들러 추가 시 `SupportsRetryContinuation` mixin 분리 고려 |
| 3 | 아키텍처 | 인터페이스 JSDoc 이 구체 클래스명(`AiAgentHandler`/`InformationExtractorHandler`)을 직접 나열 | `node-handler.interface.ts:806-820,1286-1300` | 현 규모(구현체 2개)에서 문제 없음. 구현체 증가 시 재검토 |
| 4 | 테스트 | 신규 `errorState()` 헬퍼가 같은 파일 기존 `buildState()`(다른 `describe` 스코프)와 필드 상당 부분 중복 | `information-extractor.handler.spec.ts:43-74`(신규) vs `:773-798`(기존) | 여유 있을 때 공통 상태 팩토리를 파일 최상단으로 승격해 전역 재사용 — 지금 blocking 아님 |
| 5 | 테스트 | 두 번째 신규 테스트(`…when errorPayload is omitted`)가 첫 테스트의 축소판이라 신규 검증 표면이 좁음(code/retryable 2필드만) | `information-extractor.handler.spec.ts:1387-1394` | 조치 불필요. 강화하려면 `output.result.extracted` 까지 확장해 완전 대칭성 확보 가능 |
| 6 | 테스트 | 엔진의 실제 uncaught-throw safety-net → IE 5-인자 호출 경로는 e2e/integration 으로 커버되지 않음(메서드 경계 직접 호출로만 계약 핀) | `information-extractor.handler.spec.ts:1295-1394` | 우선순위 낮음. IE 의 turn-loop-진입-전 실패 경로(`hydrateState` throw 등)를 orchestrator 레벨에서 재현하는 별도 테스트 고려 |
| 7 | 문서화 | `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` frontmatter `spec_impact` 가 실제 diff 에 없는 spec 파일 2건(`3-information-extractor.md`, `1-ai-agent.md`) 나열 — 이번 changeset 은 `spec/**` 무편집 | plan frontmatter | `complete/` 이동 시점(Gate C)에 실제 spec 편집이 없다면 `spec_impact: none` 으로 교정 필요. 현재 in-progress 라 즉시 blocking 아님 |
| 8 | 유지보수성 | `endMultiTurnConversation`(handler.ts) docblock 대 함수 본문 비율이 극단적(~40줄 vs 8줄) | `information-extractor.handler.ts:1182-1232` | 저장소 기존 "긴 docblock=SoT" 관행과 일관돼 즉시 조치 불필요. 향후 rationale 이 더 늘면 spec 문서 `## Rationale` 로 이관 고려 |
| 9 | 보안 | 신규 `_errorPayload`/`_failedUserMessage`/`_failedUserMessageSource` 3개 파라미터는 `_` prefix 로 명시된 미사용 placeholder — 신규 데이터 흐름·공격 표면 없음(오히려 verbatim relay 오수정을 막는 안전판) | `information-extractor.handler.ts:773-775` | 조치 불필요 |
| 10 | 범위 | `plan/in-progress/*.md`, `review/consistency/2026/07/18/11_19_02/**`(8개 파일) 동봉은 프로젝트 표준 impl-prep 워크플로(consistency-check 산출물 + 근거 plan)의 정상 산출물 | plan/review 신규 파일 전체 | 조치 불필요 |
| 11 | 요구사항/아키텍처 | 병행 커밋된 `review/consistency/2026/07/18/11_19_02/SUMMARY.md` 가 지적한 CRITICAL 3건(AI Agent multi-turn spec 자기모순 등)은 plan 문서에 out-of-scope·사용자 승인 bypass 로 명시 위임되어 있어 이번 diff 채점 대상 아님 | 별도 plan 추적 | 별건으로 후속 project-planner 위임 확인됨, 이번 리뷰 범위 밖 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 미사용 placeholder 3개, 신규 공격 표면·시크릿 없음 |
| architecture | LOW | 인터페이스 ISP 인접 긴장(INFO), 순수 additive/OCP 준수 |
| requirement | NONE | 코드-spec line-level 대조 완전 일치, jest 38/38 pass, tsc/eslint clean |
| scope | NONE | plan §Q3 체크리스트와 diff 1:1 대응, 스코프 이탈 없음 |
| side_effect | NONE | 전 파라미터 optional, 런타임 동작 무변경(호출부 추적 확인) |
| maintainability | NONE | docblock 비율/중복 INFO 수준, 새 중복·복잡도 증가 없음 |
| testing | NONE | jest 38/38 pass, 회귀 핀 유효성 소스 교차 확인 |
| documentation | LOW | 문서 주장 전부 코드/spec 대조 검증 통과, docblock 중복·spec_impact 정합성만 INFO |

## 발견 없는 에이전트

없음 (전 8개 reviewer 가 최소 1건 이상 INFO 관찰을 기록했으나 CRITICAL/WARNING 은 전원 0건).

## 권장 조치사항

1. (낮은 우선순위) `complete/` 이동 전 `plan/in-progress/ie-endmultiturn-errorpayload-contract.md` frontmatter `spec_impact` 를 실제 diff(spec 무편집)에 맞춰 `none` 으로 교정.
2. (낮은 우선순위, 선택) 신규 `errorState()` 테스트 헬퍼와 기존 `buildState()` 를 파일 최상단 공용 팩토리로 통합 — 이번 PR 범위 밖, 후속 정리로 defer 가능.
3. (참고) 인터페이스·핸들러 두 곳의 중복 docblock 서술은 다음 계약 변경 시점에 인터페이스 쪽을 요약으로 압축 검토.
4. 그 외 즉시 조치 필요한 항목 없음 — 이번 변경은 behavior-preserving 문서화 + pinning test 로, 병합 차단 사유 없음.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨(누락 없음)
  - **제외**: 6명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff(순수 문서화+optional 파라미터+테스트)와 관련성 낮음 |
  | dependency | 의존성 그래프·패키지 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 로직 변경 없음 |
  | api_contract | 외부 API 계약(엔드포인트/DTO) 변경 없음, 내부 TS 인터페이스만 docblock 정정 |
  | user_guide_sync | 사용자 가시 동작 변경 없음(CHANGELOG 미갱신 판단과 일치) |
