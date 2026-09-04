# Code Review 통합 보고서

## 전체 위험도
**LOW** — `ExecutionStatusDto` 5필드(`durationMs`/`currentNode`/`context`/`result`/`error`)의 OpenAPI `required: false → true` 정정. 9개 reviewer 전원 전문 확보(강제 7명 전원 결과 확보 포함, 미확보 없음), CRITICAL/WARNING 0건. `api_contract` reviewer 가 유일하게 자체 위험도를 LOW 로 매겼으나(코드젠 클라이언트 타입 협소화, wire 불변) 근거는 INFO 수준이며 조치 불요로 판정됨.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음.

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | api_contract / security / side_effect | OpenAPI `required` flip 은 wire(런타임 직렬화 바이트)는 불변이지만, 이 스키마로 코드젠하는 클라이언트의 생성 타입을 `field?: T \| null` → `field: T \| null` 로 좁힌다. 방향이 "옵셔널 체크 없이도 접근 가능"이라 기존 optional-check 코드가 깨지는 breaking 방향은 아니며, `CHANGELOG.md` 에 영향이 이미 명시돼 있다. | `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` (durationMs:130, currentNode:138, context:156, result:165, error:174) | 조치 불요 — 이미 문서화되고 3라운드에 걸쳐 반복 확인됨 |
| 2 | maintainability / testing / api_contract | 회귀 가드 테스트가 `NULL_PRESENT_FIELDS` 단일 공유 상수로 `nullable`/`required` 두 축 단언을 통합 — 이전 라운드가 지적한 "필드 목록 이중 하드코딩" drift 위험이 이번 diff 로 해소됨. 실측 뮤테이션 검증(currentNode 를 `@ApiPropertyOptional` 로 되돌려 실행)으로 새 `required` 단언 1건만 RED, 나머지 19건 GREEN 임을 확인 — 회귀를 실제로 잡는 유효한 가드. | `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:116-148` | 조치 불요 — 개선 확인 목적 기록 |
| 3 | scope / side_effect / security / documentation | 이번 5커밋 브랜치는 83→15→5 필드로 두 차례 되돌림을 거쳤으나, `origin/main` 대비 **최종 net diff 는 정확히 5필드(코드 2파일)로 수렴**한다. 중간 라운드에서 뒤집었다 되돌린 `ExecutionDto` 10필드·패스스루 DTO 18개는 net diff 에 전혀 남지 않으며, CHANGELOG·plan 문서도 그 최종 상태와 정확히 동기화돼 있다(고아 참조 없음). | `git diff origin/main...HEAD --stat` | 조치 불요 — 검증 목적 기록 |
| 4 | scope / side_effect | 이번 브랜치에는 §5.4 drift 작업과 무관한 별도 plan 문서 1건(`spec-draft-scope-and-anchor-drift.md`)의 `in-progress → complete` 라이프사이클 이동이 별도 커밋(`24c68d484`)으로 포함돼 있다. 자체 근거(consistency-check INFO#2, BLOCK:NO)를 갖추고 DTO 수정 커밋과 섞이지 않아 코드 diff 오염은 없음. | `plan/complete/spec-draft-scope-and-anchor-drift.md`, 커밋 `24c68d484` | 조치 불요. PR 설명에 "동일 세션의 다른 in-progress 항목 정리"임을 한 줄 명시하면 리뷰어 혼동 완화 가능 |
| 5 | security / scope / side_effect / documentation | changeset 46개 파일 중 40개는 이전 두 코드 리뷰 라운드(`14_54_36`,`15_22_06`)와 두 consistency-check 라운드(`15_16_28`,`15_42_35`)의 산출물 신규 커밋. 프로젝트 컨벤션상 정상 저장 위치(`CLAUDE.md` 정보 저장 위치 표)이며 시크릿·개인정보 노출 전수 grep 결과 0건. | `review/code/2026/09/04/{14_54_36,15_22_06}/*`, `review/consistency/2026/09/04/{15_16_28,15_42_35}/*` | 조치 불요 |
| 6 | documentation | `CHANGELOG.md` 신규 항목이 `§5.4` 를 4회(3,5,19,42행) plain text 로만 인용 — 같은 파일의 인접 기존 항목은 마크다운 링크(`[API 규약 §5.4](spec/5-system/2-api-convention.md)`)를 사용해 내부 링크 스타일이 비일관. 실질 정보 누락은 아님. | `CHANGELOG.md:5,19,42` | 선택 사항 — 다음 편집 시 링크 형태로 통일 고려. 이번 PR 차단 사유 아님 |
| 7 | maintainability | `CHANGELOG.md` 신규 항목이 "왜 처음 판단이 틀렸는가" 서사형 문단 위주로 구성돼 항목이 누적될수록 파일을 빠르게 훑는 스캔 비용이 증가. 기존 컨벤션과 일관돼 새로운 문제는 아님. | `CHANGELOG.md:3` | 조치 불요(기존 컨벤션 일관). 장기적으로 "요약+접기/링크" 포맷 전환 고려 가능하나 이번 diff 범위 밖 |
| 8 | requirement | spec 본문(`spec/5-system/2-api-convention.md` §5.4, `spec/5-system/14-external-interaction-api.md` §5.3)이 이번 5필드 형태와 line-level 로 정확히 일치 — spec-drift 없음. `getStatus()` 는 5키를 분기 없이 항상 채워 반환(`Promise<ExecutionStatusDto>` contextual typing 이 실제로 성립). | `codebase/backend/src/modules/external-interaction/interaction.service.ts:331-471`, `spec/5-system/2-api-convention.md:176-208` | 조치 불요 — 검증 목적 기록 |
| 9 | testing | 잔여 커버리지 갭(`ExecutionDto` 등 78곳 스키마 레벨 테스트 부재)은 이번 diff 가 만든 것이 아니라 검증자 부재를 이유로 의도적으로 되돌리고 조건부 유예된 것이며, `plan/in-progress/spec-draft-nullable-notation-followups.md` "2단계" 항목에 재개 조건과 함께 정확히 등재돼 있음. | `plan/in-progress/spec-draft-nullable-notation-followups.md:258-333` | 조치 불요 — 후속 트래킹이 이미 적절 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인젝션/시크릿/인증/입력검증/암호화/의존성 전 축 이상 없음. OpenAPI required flip 은 wire 불변 |
| requirement | NONE | spec §5.4/§5.3 과 line-level 정합, `getStatus()` 5키 항상 반환 실측 확인, spec-drift 없음 |
| scope | NONE | 최종 net diff 는 5필드로 정확히 수렴, 무관 plan 이동은 별도 커밋으로 분리돼 오염 없음 |
| side_effect | NONE | 전역상태/파일시스템/네트워크/이벤트 부작용 없음, 이전 라운드 지적된 `ExecutionDto` revert 완결 확인 |
| maintainability | NONE | 기계적 데코레이터 치환 + 테스트 DRY 개선(`NULL_PRESENT_FIELDS`), CHANGELOG 서사형 스타일은 기존 컨벤션 |
| testing | NONE | 20/20 GREEN, 뮤테이션 재현으로 회귀 가드 실효성(RED 1/20) 확인, 잔여 갭은 문서화된 유예 |
| documentation | NONE | CHANGELOG/JSDoc/plan 체크리스트/swagger.md 정본 예제 전부 코드와 일치, `§5.4` 링크 스타일 비일관만 INFO |
| api_contract | LOW | wire 불변, OpenAPI 코드젠 클라이언트 타입 협소화(breaking 아님), 이전 두 라운드보다 더 보수적으로 축소된 최종 범위 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 중 `backend-api-change` 만 glob 매칭되나 의미상 신규/삭제/재정의 필드 없어 user-guide 갱신 대상 아님 |

## 발견 없는 에이전트

없음 (전 에이전트 INFO 이상 최소 1건 이상 기록, 단 전부 조치 불요 판정).

## 권장 조치사항

1. (선택) `CHANGELOG.md` 신규 항목의 `§5.4` plain text 인용 4곳을 다음 편집 시 마크다운 링크로 통일 — 이번 PR 차단 사유 아님.
2. 잔여 스코프(§5.4 drift 2단계 — 검증자 없는 응답 DTO 78곳, WS wire 적용 여부)는 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재돼 있으므로 별도 조치 불요, 후속 세션에서 재개.
3. 그 외 즉시 조치 필요 항목 없음 — 현재 diff 는 병합 가능 상태로 판단됨.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, requirement, scope, side_effect, maintainability, testing, documentation, api_contract, user_guide_sync (9명)
  - **제외**: 아래 표 (5명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — forced 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — 이번 diff 가 데코레이터 메타데이터 정정뿐이라 성능 영향 경로 없음 |
  | architecture | 라우터 판단 — 구조/설계 변경 없음(단일 DTO 필드 플래그 정정) |
  | dependency | 라우터 판단 — package.json/lockfile 변경 없음 |
  | database | 라우터 판단 — 쿼리/스키마/마이그레이션 변경 없음 |
  | concurrency | 라우터 판단 — 동시성 관련 코드 경로 무관 |