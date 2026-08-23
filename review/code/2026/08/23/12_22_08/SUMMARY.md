# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical 0건. 실질 코드 변경은 `ExecuteWorkflowDto.input` 에 `deprecated: true` 플래그 + JSDoc 확장, 이를 고정하는 unit 테스트 1건뿐이며 런타임 로직은 무변경(가드 테스트·뮤테이션 재현으로 확인됨). 발견된 WARNING 3건은 모두 이번 PR 이 함께 편집한 `spec/conventions/swagger.md` / `plan/in-progress/swagger-decisions.md` 문서 자체의 내부 정합성 문제이며 코드 결함이 아니다. forced 화이트리스트(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 7명 전원 결과 확보됨 — 강제 리뷰어 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서정합성 | `swagger.md §3` 보안·정책 캐비엇을 "예외"에서 "적극 지시"로 재정의한 신설 콜아웃이, 그 콜아웃이 "근거"로 직접 링크하는 미변경 Rationale 서브섹션(제목·본문 모두 옛 "예외" 프레이밍 그대로)과 용어가 충돌한다. `/consistency-check`(cross_spec W2)가 지적한 지점의 상단 표/콜아웃만 반영되고 링크가 가리키는 본문은 손대지 않음 | `spec/conventions/swagger.md:271-277`(신설 콜아웃), `:286`(옛 "예외" 표현의 근거 링크 텍스트, 미변경), `:471-475`(`### §3 보안·정책 캐비엇 예외 — ...` 섹션 제목·`**왜 예외인가**` 첫 문장, 미변경) | 471행 섹션 제목·473행 첫 문장을 새 "지시" 프레이밍으로 갱신하거나, 최소한 "2026-08-23 예외→지시 재정의 반영" 각주를 달아 286행 링크 텍스트와 정합시킨다 |
| 2 | 오타 | `spec/conventions/swagger.md` 신설 문장에서 구분점 문자가 섞임 — 문서 전체 25회 쓰이는 `·`(U+00B7) 대신 마지막 한 곳만 `ㆍ`(U+318D, 한글 채움 점) | `spec/conventions/swagger.md:271` | `ㆍ` → `·` 로 통일 |
| 3 | 문서완결성 | `plan/in-progress/swagger-decisions.md` ③ 서술이 실제 반영된 3축 결정(엔드포인트 summary·엔드포인트 description·DTO description)보다 좁다 — "엔드포인트 `description`(50~150자, 강제 유지)" 축이 본문에서 누락돼 두 축만 언급. 트래커에 이미 두 길이 기준을 혼동한 선례가 기록돼 있어 재발 위험 실재 | `plan/in-progress/swagger-decisions.md:41-54`(`## ③ 길이 규칙` 섹션), 대조: `spec-sync-external-interaction-api-gaps.md:1008-1010` | "엔드포인트 `description`(50~150자)은 그대로 강제 유지" 한 문장을 본문에 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `POST /workflows/:id/execute` 본문이 전역 `CustomValidationPipe` 를 계속 우회(신규 아님, 사용자가 "현행 유지"로 명시 결정·기록됨) | `execute-workflow.dto.ts` 클래스 docstring; `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(execute-body-dto 항목) | 조치 불요 — 참고 기록 |
| 2 | API 계약 | `deprecated: true` 는 순수 OpenAPI 스키마 플래그, 실제 요청 처리(`@Body()` 는 여전히 `Object` 타입)는 무변경. 마이그레이션/sunset 일정 없음(설계 의도) | `execute-workflow.dto.ts:60-67` | 조치 불요 |
| 3 | 유지보수성 | 동일 결정 서사가 DTO JSDoc·plan 문서·트래커 3곳에 유사 문장으로 중복 | `execute-workflow.dto.ts:46-53`, `plan/in-progress/swagger-decisions.md:32-39`, `spec-sync-external-interaction-api-gaps.md:987-995` | 저장소 기존 관행과 일치, 별도 조치 불요. 향후 결정 번복 시 3곳 동반 갱신 인지 |
| 4 | 유지보수성 | `input` 필드 JSDoc 이 형태 설명·deprecated 근거·마커 거부 근거 세 관심사를 19줄로 혼재 | `execute-workflow.dto.ts:41-59` | 필드 증가 시 상세 서사를 spec 링크로 분리하는 방향 고려 |
| 5 | 문서화 | `deprecated: true` 공개 API 표면 변경에 대한 `CHANGELOG.md` "Unreleased" 기록 없음(이 저장소는 유사 사례를 기록해 온 관행 있음) | `execute-workflow.dto.ts:66`; `CHANGELOG.md` | 짧은 항목 추가 고려(강제 아님) |
| 6 | 문서화 | 결정 요약 표 "성격" 열이 행마다 다른 범주(변경 성질 vs 담당자)를 담아 오독 소지 | `plan/in-progress/swagger-decisions.md:17-21` | 열 분리 또는 범주 통일 |
| 7 | 테스트 | 신규 description 안내 문구("신규 통합은 `parameterValues` 를 쓴다")는 기존 `'마커'` substring 가드로 커버되지 않아 문구 삭제/오탈자를 못 잡음(순수 안내 텍스트, plan 검증 범위 밖이라 낮은 우선순위) | `execute-workflow.dto.ts:63`; `workflows-execute-body.spec.ts:174-179` | 필요 시 `stringContaining('parameterValues')` 단언 추가(우선순위 낮음) |
| 8 | 스코프 | developer 소유 worktree/plan(`owner: developer`)이 planner 전속 영역(`spec/conventions/swagger.md`)까지 같은 세션에서 편집(항목③). 결과물 자체는 사용자 결정의 정확한 집행이라 범위 밖 아님, convention_compliance checker 도 "강제 아님"으로 판정 | `plan/in-progress/swagger-decisions.md:6`(frontmatter), `:21`(표) | frontmatter owner 를 항목별로 분리 표기하거나 향후 유사 작업에서 spec 편집분만 별도 planner 턴으로 분리 |
| 9 | 부작용 | `review/consistency/2026/08/23/11_59_11/**` 6개 파일 신규 커밋 — 저장소 컨벤션상 정상 산출물(`/consistency-check --spec` 표준 워크플로), 우려할 부작용 아님 | `review/consistency/2026/08/23/11_59_11/*` | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경 없음. 기존 validation-bypass 상태는 사용자가 이미 "현행 유지"로 결정·기록 |
| requirement | LOW | swagger.md §3 재정의 문단이 미변경 Rationale 절과 프레이밍 충돌(WARNING). 코드 변경분은 테스트·뮤테이션으로 기능 완전성 실측 확인 |
| scope | NONE | 13개 파일 전부 3건 사용자 결정 + 의무 절차(consistency-check, 트래커 갱신)로 수렴. 무관 변경/포맷 소음 없음. developer 세션의 spec 편집은 INFO |
| side_effect | NONE | 유일한 실질 영향은 의도된 `deprecated: true` OpenAPI 표면 변경. 전역 상태/환경변수/네트워크 호출/시그니처 변경 없음 |
| maintainability | NONE | 결정 서사 3중 반복·JSDoc 길이는 저장소 기존 관행과 일치하는 트레이드오프 |
| testing | NONE | jest 10/10 PASS 재실행 확인. 뮤테이션(`deprecated: true` 제거)으로 신규 단언 단독 RED 재현 성공. 대조군·격리·가독성 양호 |
| documentation | LOW | §3 재정의-Rationale 프레이밍 충돌(WARNING, requirement 와 동일 근본원인) + 유니코드 오타(WARNING) + plan ③ 서술 축 누락(WARNING). 그 외 사전 consistency-check WARNING 대부분 이미 해소 확인 |
| api_contract | LOW | `deprecated: true` 는 비파괴적 문서 변경, 와이어 필드명/검증 동작 불변. breaking change·인증/인가·응답 스키마 이슈 없음 |

## 발견 없는 에이전트

- security, scope, side_effect, maintainability, testing — Critical/Warning 없음(전부 INFO 또는 없음)

## 권장 조치사항

1. `spec/conventions/swagger.md:471-475` (§3 보안·정책 캐비엇 예외 섹션 제목·첫 문장)을 "예외→지시" 재정의에 맞게 갱신하거나 각주를 추가해 `:271-286` 신설 콜아웃과의 용어 충돌을 해소한다.
2. `spec/conventions/swagger.md:271` 의 `ㆍ`(U+318D) 를 `·`(U+00B7) 로 정정한다.
3. `plan/in-progress/swagger-decisions.md:41-54` (`## ③` 섹션)에 "엔드포인트 `description`(50~150자)은 그대로 강제 유지" 한 문장을 추가해 3축 결정을 온전히 반영한다.
4. (선택, 낮은 우선순위) `CHANGELOG.md` 에 `ExecuteWorkflowDto.input` deprecated 표시 항목 추가, plan 표 "성격" 열 범주 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **제외**: 아래 표 (6명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(success + 전문 인라인 제공), 누락 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 이번 diff 는 데코레이터 메타데이터·테스트·문서 변경뿐, 성능 영향 표면 없음 (router 판단) |
  | architecture | 아키텍처 구조 변경 없음 |
  | dependency | 의존성 변경 없음 |
  | database | DB 스키마/쿼리 변경 없음 |
  | concurrency | 동시성 관련 코드 변경 없음 |
  | user_guide_sync | 유저 가이드 노출 필드(`parameterValues`)는 이미 이번 deprecation 방향과 정합적이며 별도 갱신 불요로 documentation 리뷰에서 확인됨 |