# Code Review 통합 보고서

## 전체 위험도
**LOW** — Critical/Warning 급 결함 없음. 실질 코드 변경(`ExecuteWorkflowDto.input` 에 OpenAPI `deprecated: true` 추가)은 비파괴적이며 런타임 동작 무변경임이 8개 reviewer 전원의 독립 검증(코드 대조·`npx jest` 10/10 GREEN·뮤테이션 재현)으로 확인됨. `api_contract` reviewer만 문서-동작 구조적 분리 상태(기존부터 있던 상태)를 근거로 LOW 로 판정, 나머지 7개는 전부 NONE.

**참고**: `requirement.md` 는 prompt 의 `ran` 목록에서 `no_status` 로 표기됐고 실제로 디스크에 파일이 없었으나, prompt 인라인 전문에 완전한 보고서가 포함되어 있어 이번 통합 시 그 전문을 그대로 `requirement.md` 에 영속화했다. 내용 손실은 없으며 forced 화이트리스트(`security, maintainability, requirement, scope, side_effect, testing`) 전원의 결과가 확보되어 반영됐다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. (직전 라운드 `12_22_08` 의 WARNING 3건은 이번 라운드에서 fix 반영이 소스 직접 대조·`check-doc-links.py`·grep 재검증으로 전부 해소 확인됨 — documentation·requirement·scope reviewer 공통 확인.)

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | `POST /workflows/:id/execute` 가 전역 `CustomValidationPipe` 를 계속 우회(여분 top-level 키 미검증) — 이번 PR 신규 아님, 선행 결정(`spec-sync-external-interaction-api-gaps.md`)에서 이미 "현행 유지"로 사용자가 명시 재확인·종결 | `codebase/backend/src/modules/workflows/dto/execute-workflow.dto.ts` 클래스 docstring 10-24행 | 조치 불요(참고 기록) |
| 2 | SECURITY | `input`/`parameterValues` 양쪽 모두 마스킹 마커(`MASKED_VALUE_RESUBMITTED`) 거부 규칙이 description 에 동일 반영, 컨트롤러 단일 병합 로직(`parameterValues ?? input.parameters`)과 line-level 일치 확인 | `dto/execute-workflow.dto.ts:32-38, 60-67` | 조치 불요 |
| 3 | SCOPE / REQUIREMENT | developer 소유 plan/worktree 가 planner 전속 영역인 `spec/conventions/swagger.md` 를 같은 세션에서 편집 — 이전 두 라운드(scope·convention-compliance)에서 이미 "3건 사용자 결정 일괄 집행 목적, 범위 밖 아님"으로 처분 완료, 이번 라운드는 기록만 이월 | `plan/in-progress/swagger-decisions.md:6`(owner: developer), `:21`(③ 표 행) | 조치 불요(기 처분 존중). 향후 유사 작업은 spec 편집분을 별도 planner 턴으로 분리 권장 |
| 4 | REQUIREMENT | `swagger.md` §3 Rationale 정량 근거(요청 116/335·응답 58/128)를 독립 재현 시 정확히 일치하지 않음(재집계 결과 request≈118/368, response≈61/185) — "규칙 아님" 이라는 결론의 방향성은 재현되어 ③ 결정 타당성엔 영향 없음 | `spec/conventions/swagger.md:426-430` | 향후 유사 실측 인용 시 집계 스크립트/glob 기준을 각주로 남기면 재현성 개선 |
| 5 | SIDE_EFFECT | `deprecated: true` 는 순수 OpenAPI 스키마 메타데이터 — DTO 가 `@Body()` 파라미터 타입이 아니므로(`@ApiBody({ type })` 로만 참조) 요청 검증·응답 스키마 무영향, codegen 소비 파이프라인도 저장소에 없음(grep 확인) | `dto/execute-workflow.dto.ts:66` | 조치 불요 |
| 6 | SIDE_EFFECT | 리뷰 진행 중 공유 worktree 에서 다른 sub-agent(테스트 뮤테이션 재현으로 추정)에 의한 일시적 파일 변형(`deprecated: true` 제거 + `.orig` 백업) 관측 — 수 초 내 자가 복구, 기존 문서화된 "병렬 리뷰어 공유 worktree 오염" 패턴의 재확인 | 워크트리 파일시스템 관측(diff 밖) | 조치 불요, 신규 결함 아님 |
| 7 | MAINTAINABILITY | 동일 결정 서사(back-compat 경로·비파괴 유도 논지)가 DTO JSDoc·plan·트래커 3곳에 거의 같은 문장으로 중복 기재. `input` 필드 JSDoc 자체도 3가지 독립 관심사(형태 차이·deprecated 근거·마커 거부 근거)를 19줄에 혼재 | `dto/execute-workflow.dto.ts:41-59`, `plan/in-progress/swagger-decisions.md:32-39`, `plan/in-progress/spec-sync-external-interaction-api-gaps.md:987-995` | 결정 번복 시 3곳 동시 갱신 필요성 인지. 필드가 늘어나면 "요약 1~2문장 + spec 링크" 패턴 고려 |
| 8 | MAINTAINABILITY / DOCUMENTATION | `plan/in-progress/swagger-decisions.md` 결정 표 "성격" 열이 행마다 다른 범주(①=변경 성질, ②·③=담당자)를 혼용 — 이미 낮은 우선순위 INFO 로 처분됨, 이번 라운드는 재확인만 | `plan/in-progress/swagger-decisions.md:17-21` | 필요 시 "성격"/"담당" 열 분리(강제 아님) |
| 9 | TESTING | `input` description 신규 안내 문구("신규 통합은 parameterValues 를 쓴다")가 `'마커'` substring 단언으로만 간접 커버되고 문구 전문은 직접 단언되지 않음 — 이전 라운드(`RESOLUTION.md` INFO#7)에서 "결정 자체(deprecated 플래그)에 가드를 걸었다"는 사유로 이미 "조치 불요" 처분 | `dto/execute-workflow.dto.ts:63`, `workflows-execute-body.spec.ts:174-179` | 조치 불요(기 처분 존중) |
| 10 | DOCUMENTATION | `deprecated: true` 의 CHANGELOG 미기록 — 재검토 결과 이전 선례(`GET /api/model-configs/:id/models`, 런타임 검증 실제 추가)보다 이번 변경이 훨씬 약해(순수 스키마 플래그, 런타임 무영향) "기록 불요" 처분이 오히려 더 타당함을 확인 | `CHANGELOG.md:1224` | 조치 불요 |
| 11 | API_CONTRACT | `deprecated: true` 는 런타임 수용 범위(여분 top-level 키 허용 등)를 바꾸지 않음 — 문서-동작 구조적 분리 상태 유지. sunset/migration 헤더(`Sunset`/`Link`) 미동반은 "영구 병존, 자연 유도" 설계 의도이지 누락 아님 | `dto/execute-workflow.dto.ts:60-67` | 조치 불요(설계 의도로 확인됨) |
| 12 | API_CONTRACT | `spec/conventions/swagger.md` 의 DTO `description` 길이 규칙 완화(강제→지향)·보안·정책 캐비엇 재정의(예외→지시)는 실제 API 계약(요청/응답 필드·상태 코드·인증)에 영향 없는 순수 문서 컨벤션 변경. 엔드포인트 `summary`/`description` 은 여전히 강제 유지 | `spec/conventions/swagger.md` §3 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실질 코드 변경은 순수 OpenAPI 메타데이터. 기존 validation pipe 우회 상태는 이미 사용자 결정으로 종결. 마커 거부 규칙 양 필드 일치 확인 |
| requirement | NONE | 정량 근거 재현 시 근사 불일치(결론 방향은 동일). WARNING 3건 fix 반영 코드 대조로 검증 완료. 뮤테이션·jest 재실행 GREEN |
| scope | NONE | 25개 변경 파일 전부 plan 이 명시한 3건 사용자 결정 + 의무 절차 산출물로 수렴. 요청 외 변경 없음 |
| side_effect | NONE | `deprecated:true` 는 런타임 부작용 0. swagger.md 완화 규칙을 소비하는 자동화 없음(grep 확인) |
| maintainability | NONE | 함수/복잡도 관련 위험 표면 거의 없음. 결정 서사 3곳 중복은 의도된 트레이드오프 |
| testing | NONE | `npx jest` 10/10 GREEN, 뮤테이션(`deprecated:true` 제거) 독립 재현으로 대조군 판별력 확인 |
| documentation | NONE | 직전 라운드 WARNING 3건(§3 프레이밍·유니코드 오타·plan 서술 누락) 전부 소스+`check-doc-links.py` 로 해소 재확인 |
| api_contract | LOW | `deprecated:true` 비파괴적, 문서-동작 구조적 분리는 기존 상태 유지(신규 아님). breaking change 없음 |

## 발견 없는 에이전트

없음 — 8개 reviewer 모두 최소 1건 이상의 INFO 를 보고했으나, 전부 참고 수준이며 조치가 필요한 결함은 없음.

## 권장 조치사항

1. (선택) `plan/in-progress/swagger-decisions.md` 결정 표의 "성격" 열을 "성격"(변경 성질)/"담당"(owner) 두 열로 분리해 가독성 개선 — 강제 아님, 낮은 우선순위.
2. (선택) 향후 spec Rationale 에 정량 실측치를 인용할 때는 집계 스크립트/필터 기준을 각주로 남겨 제3자 재현성을 확보.
3. 그 외 모든 발견사항은 이미 이전 라운드에서 처분되었거나 설계 의도로 확인된 참고 사항으로, 즉시 조치가 필요한 항목은 없음. `RESOLUTION.md` 불요 — 현재 diff 는 병합 가능한 상태로 판단됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract` (8명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명 — forced 전원 결과 확보됨)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 와 무관 (OpenAPI 메타데이터 변경만) |
  | architecture | router 판단상 이번 diff 와 무관 (구조 변경 없음) |
  | dependency | router 판단상 이번 diff 와 무관 (의존성 변경 없음) |
  | database | router 판단상 이번 diff 와 무관 (DB 접근 코드 변경 없음) |
  | concurrency | router 판단상 이번 diff 와 무관 (동시성 코드 변경 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관 (사용자 가이드 자동 동기화 대상 아님) |