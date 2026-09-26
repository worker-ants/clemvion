# Code Review 통합 보고서

## 전체 위험도
**LOW** — 실행 가능한 제품 코드 변경은 e2e 테스트 파일 1개(단언 강화)뿐이며 CRITICAL 은 없다. WARNING 1건(plan 문서 간 경로 교차참조 불일치)만 존재. forced 화이트리스트(documentation, maintainability, requirement, scope, security, side_effect, testing) 7명 전원 결과 확보됨 — 강제 포함 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화 | plan 트래커가 존재하지 않는 경로(`plan/complete/spec-draft-ed-ai-19-status.md`)를 인용. 실제 파일은 `plan/in-progress/`에 있고, 같은 PR의 다른 plan 문서(`assistant-e2e-contract-gaps.md:38`)는 정확한 경로를 인용해 두 문서 간 내부 불일치가 생김 | `plan/in-progress/spec-draft-nullable-notation-followups.md:5154` (vs `plan/in-progress/spec-draft-ed-ai-19-status.md:3`) | 경로 표기를 `plan/in-progress/`로 정정하거나, 이 PR 마무리 커밋에서 해당 draft 를 실제로 `plan/complete/`로 이동시켜 표기와 일치시킬 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트/동시성 | `findLatestActive` 정렬이 `lastInteractionAt DESC` 단일 키만 사용해 2차 정렬 키(tie-breaker)가 없음. 테스트 F 의 "가장 최근 세션 = 방금 만든 세션" 단언은 벽시계 순서(밀리초 단위 시각차)에 암묵 의존 — 오늘은 네트워크 왕복 지연으로 안전하지만 동률 시 비결정적 | `codebase/backend/src/modules/workflow-assistant/workflow-assistant-session.service.ts:47-61`, `codebase/backend/test/workflow-assistant.e2e-spec.ts` 테스트 F | 서비스에 보조 정렬 키(`id`/`createdAt`) 추가, 또는 테스트에서 동률 케이스를 명시적으로 커버해 갭을 문서화. 차단 사유 아님 |
| 2 | 테스트 위생 / 부작용 | 테스트 F 의 `data: null` 분기에서 새로 만든 `emptyWorkflow`를 정리(DELETE)하지 않음. 같은 테스트가 세션은 명시적으로 `DELETE`하면서 워크플로는 남김 | `codebase/backend/test/workflow-assistant.e2e-spec.ts:208-216` | 테스트 종료 시 `DELETE /api/workflows/:id`로 정리. 단 파일 전체가 workflow/workspace 는 정리하지 않는 기존 관례를 따르고 있어 우선순위 낮음 |
| 3 | 유지보수성 | 테스트 F 가 "세션 있음"과 "세션 없음(`data: null`)" 두 개의 독립 시나리오를 하나의 `it` 블록에 결합 — 앞부분 실패 시 뒷부분(null 케이스)이 실행되지 않아 리포트에서 원인 파악이 늦어짐 | `codebase/backend/test/workflow-assistant.e2e-spec.ts:185-224` | `it('F1. ...')`/`it('F2. ...')` 로 분리 (파일 기존 스타일과 크게 어긋나지 않는 낮은 우선순위 제안) |
| 4 | 네이밍 | 응답 변수명 `none` 이 실제로는 HTTP `Response` 객체를 가리켜, 다른 변수(`latest`, `detail`, `create`, `patch`)의 "무엇을 담은 응답인지" 네이밍 관례와 어긋남 | `codebase/backend/test/workflow-assistant.e2e-spec.ts:213` | `emptyLatest` 등 "무엇에 대한 응답인지"를 드러내는 이름으로 변경 |
| 5 | 중복 | `assertMatchesContract(x.body.data, await contractForDto(Dto))` 패턴이 파일 전체에서 7회 이상 반복(이번 diff 로 1곳 추가). `contractForDto` 시그니처 변경 시 다수 지점 동시 수정 필요 | `codebase/backend/test/workflow-assistant.e2e-spec.ts:72-75, 93-96, 112-115, 202-205(신규), 260-263, 340-343` 등 | 로컬 헬퍼(`expectContract(body, Dto)`)로 감싸 향후 변경 지점을 한 곳으로 축소. 이번 PR 필수 사항 아님 |
| 6 | plan 위생 | `plan/in-progress/spec-draft-ed-ai-19-status.md` 의 제안(ED-AI-19 미구현 표기)이 이미 diff 에 실측 반영 완료됐으나 frontmatter `status` 는 여전히 `in-progress` | `plan/in-progress/spec-draft-ed-ai-19-status.md:3` | PR 마무리 커밋에서 두 plan 문서(`spec-draft-ed-ai-19-status.md`, `assistant-e2e-contract-gaps.md`) 체크박스 갱신 + `plan/complete/` 이동을 함께 수행 |
| 7 | 스코프 | 서로 다른 두 plan(테스트 전용 작업 + spec PRD 표기 정정)이 한 PR 에 묶임 — 원 plan 은 `spec_impact: none`을 명시했으나 실제로는 `_product-overview.md` 한 줄이 변경됨. 다만 `--impl-prep` 게이트가 강제한 무관 기존 spec 모순을 CLAUDE.md 절차(멈추고 planner 위임)대로 별도 plan 으로 처리한 것으로, 은닉된 확장이 아니라 문서화된 예외 | `spec/3-workflow-editor/_product-overview.md`(ED-AI-19 행) + `plan/in-progress/spec-draft-ed-ai-19-status.md`(신규) | 실제 PR 본문 첫 줄에 "두 plan 포함" 문구가 실제로 들어가는지 확인할 것 |
| 8 | 백로그 참고(비차단, 이번 PR 범위 아님) | ED-AI-19: 실행 중인 워크플로에 대한 Assistant 편집 도구 호출을 막는 서버측 상태 검증(`ASSISTANT_WORKFLOW_RUNNING` 가드)이 아직 구현되지 않음 — 이번 diff 가 새로 만든 갭이 아니라 기존 PRD/상세스펙 불일치를 문서로 확인·정정한 결과이며 별도 트래커로 인계됨 | `spec/3-workflow-editor/4-ai-assistant.md` §12.2, `spec/3-workflow-editor/_product-overview.md` ED-AI-19 | 별도 구현 작업(제품 백로그)으로 추적 — 이번 PR 소관 아님 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 실행 코드 변경 없음(인젝션/시크릿/인가/암호화 해당 없음). ED-AI-19 인가 상태검증 백로그 갭을 참고로 언급(비차단) |
| requirement | NONE | 컨트롤러·서비스·DTO 를 직접 대조해 테스트 주장이 구현과 전부 일치함을 확인. tie-break 부재, plan status stale 을 INFO 로 기록 |
| scope | LOW | 핵심 코드 변경은 plan 세 처방과 정확히 일치. 두 plan 묶임(문서화된 예외)만 지적 |
| side_effect | NONE | 코드 표면은 테스트 파일 1곳뿐, 공개 API/전역상태 영향 없음. emptyWorkflow 미정리는 기존 관례 연장(INFO) |
| maintainability | LOW | 함수/복잡도 문제 없음. 시나리오 결합·네이밍·중복 패턴 3건 INFO |
| testing | LOW | 새 코드 경로 없이 계약 대조 공백 3칸을 닫는 순수 보강, 뮤테이션 프로브로 비공허성 검증. tie-break·정리누락 INFO(기존 서비스 계층 갭, 이번 diff 원인 아님) |
| documentation | LOW | 주석·plan 근거 실측과 대부분 일치. plan 교차참조 경로 오류 WARNING 1건 |
| api_contract | NONE | API 구현 코드 변경 없음. 라우트 순서·`data: null` 봉투 형태를 테스트가 정확히 검증함을 확인(정상 확인만, 실질 발견 없음) |

## 발견 없는 에이전트

- **api_contract** — 확인 항목은 모두 "구현과 일치함(정상)"이라는 검증 결과이며 실질적 결함·개선 제안은 없음.

## 권장 조치사항

1. `plan/in-progress/spec-draft-nullable-notation-followups.md:5154` 의 `plan/complete/...` 경로 오기재를 정정하거나, 해당 draft(`spec-draft-ed-ai-19-status.md`)를 실제로 `plan/complete/`로 이동시켜 일치시킨다 (WARNING).
2. PR 마무리 커밋에서 `spec-draft-ed-ai-19-status.md`·`assistant-e2e-contract-gaps.md` 두 plan 문서의 체크박스 갱신과 `plan/complete/` 이동을 함께 수행한다.
3. (선택, 낮은 우선순위) 테스트 F 의 `emptyWorkflow` 정리 추가, `none` 변수명 개선, `assertMatchesContract` 반복을 로컬 헬퍼로 통합 — 이번 PR 필수는 아니며 다음에 이 파일을 만질 때 함께 처리 가능.
4. (선택, 별도 트래커) `findLatestActive` 에 보조 정렬 키(`id`/`createdAt`) 추가를 검토해 동시성 tie-break 비결정성을 해소.
5. PR 본문 첫 줄에 "이 PR 은 두 plan(`assistant-e2e-contract-gaps` + `spec-draft-ed-ai-19-status`)을 포함한다"는 문구를 실제로 명시한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract (8명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨(미이행 없음)
  - **제외**: 아래 표 (6명)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단(개별 사유 미제공) — 변경이 테스트 단언 강화 + 문서/스펙 표기 정정뿐이라 성능 영향 경로 없음으로 추정 |
  | architecture | 라우터 판단(개별 사유 미제공) — 구조적 변경(모듈/레이어) 없음 |
  | dependency | 라우터 판단(개별 사유 미제공) — 신규 의존성 추가 없음(diff 상 import 변경 없음) |
  | database | 라우터 판단(개별 사유 미제공) — 스키마/마이그레이션 변경 없음 |
  | concurrency | 라우터 판단(개별 사유 미제공) — 신규 동시성 제어 로직 없음(다만 requirement/testing 이 기존 tie-break 갭을 INFO 로 별도 포착) |
  | user_guide_sync | 라우터 판단(개별 사유 미제공) — 사용자 대상 문서/가이드 변경 없음 |
