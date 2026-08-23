# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 0건, WARNING 2건(둘 다 저위험·비차단: spec 편집 권한 경계는 이미 planner 트래커로 이관됨, null 방어분기 테스트 갭은 정적으로 도달 불가). forced 화이트리스트(7개) 전원 결과 확보 완료 — 강제 reviewer 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Scope | `developer` 역할이 `spec/conventions/egress-masking.md` 를 직접 수정한 상태가 diff 에 여전히 남아 있음(1차 라운드 WARNING #2 의 연장). CLAUDE.md 는 `developer` 쓰기 권한을 `codebase/**`, `plan/**`, `review/**/RESOLUTION.md` 로 한정하고 `spec/` 은 read-only 로 명시한다. 이번 라운드는 이 편집을 되돌리지 않고 대신 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 새 planner 판단 항목(게이트 321~332)을 등재해 결정 자체는 선점하지 않았다. | `spec/conventions/egress-masking.md:83-92` | 이미 트래커에 이관돼 있어 이번 PR 을 막을 사안은 아님. 다음 라운드에서 project-planner 가 (a) 예외 명문화 또는 (b) 정식 이관 중 하나로 카브아웃을 닫을 것. |
| 2 | Testing | 신설 헬퍼 co-located 테스트(WARNING #1 fix)가 `maskIfPresent` 의 `value == null`(loose equality) 방어 분기 중 **`null` 쪽 절반을 어떤 케이스로도 실행하지 않음** — `undefined` 만 주입. 뮤테이션으로 확인: `value == null` 을 `value === undefined` 로 좁혀도(즉 `null` 방어를 제거해도) 이 spec 파일 29개 + 회귀 71개, 총 100개 테스트 전부 GREEN 유지(`tsc --noEmit` 클린). 이 파일 자신이 선언한 "한쪽만 검증하면 다른 쪽이 조용히 갈린다" 원칙이 이 지점에서 절반만 지켜졌다. | `codebase/backend/src/shared/utils/redact-stored-error.ts:127,131`; `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:289` | `redactNodeExecutionRow` "부재 컬럼 보존" 테스트 옆에 `inputData: null`(또는 `error: null`) 케이스 추가, 또는 `it.each([[undefined],[null]])` 로 파라미터화. 위험도 낮음(엔티티가 non-null 타입이라 정적으로 도달 불가) — 머지 차단 사안 아님. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability / Documentation | 신설 헬퍼(`redactStoredFieldsForResponse`, `redactNodeExecutionRow`)가 같은 파일의 기존 두 함수와 달리 `@param`/`@returns` 형식 태그 없이 산문 docstring만 사용. 두 reviewer 가 동일 항목을 독립 지적. plan 문서가 "우선순위 낮음, diff 확대 방지 위해 보류"로 이미 명시 처분. | `codebase/backend/src/shared/utils/redact-stored-error.ts:73-111, 134-159` | 조치 불요. 다음에 이 파일을 손댈 때 4개 export 함수의 JSDoc 형식을 통일. |
| 2 | Maintainability | `redactNodeExecutionRow` 만 파일 내 "…ForResponse" 네이밍 접미사 관례를 따르지 않음(나머지 3개 export 는 모두 접미사 사용). 1차 라운드에서 이미 지적되고 "방금 4곳을 옮긴 직후 추가 이동은 diff 만 넓힌다"는 이유로 미조치 결정됨. | `codebase/backend/src/shared/utils/redact-stored-error.ts:144` | 조치 불요(기존 결정 유지). 다음 이 파일 수정 시 함께 정리하거나 네이밍 규칙을 docstring 에 한 줄 남길 것. |
| 3 | Maintainability | `redactStoredFieldsForResponse` 의 파라미터/반환 타입이 `ResponseExecution`/`ResponseNodeExecution` 의 3필드 부분집합과 구조적으로 동일하나 별도 인라인 선언(타입 레이어의 손동기화 잔존). 세 컬럼 타입이 안정적이라 실제 드리프트 이력 없음. | `codebase/backend/src/shared/utils/redact-stored-error.ts:97-105` | 조치 불요. 필요해지면 `Pick<ResponseExecution, 'inputData'\|'outputData'\|'error'>` 파생 또는 공유 `MaskedTriple` 별칭 고려. |
| 4 | Side Effect | `redactNodeExecutionRow` 가 종전 private 인라인 코드에서 `shared/utils` 의 제네릭 **공개(export)** 함수로 승격됨. breaking change 는 아니나 모듈 경계 밖에서도 재사용 가능한 공개 계약이 됨(1차 라운드에도 동일 관점 INFO, 이번 diff 로 악화되지 않음). | `codebase/backend/src/shared/utils/redact-stored-error.ts:144` | 조치 불요. 제3의 소비처가 실제로 생기면 그때 "왜 헬퍼가 둘인가" 표를 갱신. |
| 5 | Testing | `redactNodeExecutionRow` "부재 보존" 테스트가 "복제 유발" 테스트(`it.each` 로 컬럼 3개 개별 단언)와 달리 `it.each` 화되지 않아 `outputData` 단독 `undefined` 케이스가 누락됨(대칭 갭). 실질 위험은 낮음(컬럼별 독립 호출). | `codebase/backend/src/shared/utils/redact-stored-error.spec.ts:276` (it.each 3케이스) vs `:289` (단일 it, inputData+error 동시) | 급하지 않음 — WARNING #2 수정과 함께 `it.each([['inputData'],['outputData'],['error']])` 로 통일하면 두 갭을 한 번에 메울 수 있음. |
| 6 | Security | 테스트 픽스처에 자격증명 형태 리터럴 문자열 사용(`postgres://u:pw@db.internal/prod`, `Bearer sk-live-abc123def456`) — 마스킹 정규식 매치 검증용 명백한 가짜 플레이스홀더, 실제 시크릿 유출 아님. | `codebase/backend/src/shared/utils/redact-stored-error.spec.ts` (CRED 상수) | 조치 불요 — 마스킹 단위 테스트의 일반적 패턴. |
| 7 | Security | `background-runs.service.ts` 컨트롤러에 `@Roles` 인가 게이트 부재(워크스페이스 멤버 전원에게 열림) — 기존 설계이며 이번 마스킹 통합 diff 범위 밖. 코드 주석에 이미 알려진 사항으로 기록돼 있음. | `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` (`toNodeExecutionDto` 위 주석) | 조치 불요(별건) — 이번 changeset 이 건드리지 않음. |
| 8 | Security / Requirement | 마스킹 게이트 통합은 4개 호출부 전부에서 스프레드 순서(원문 뒤에 마스킹값)가 보존되어 기능적으로 완전 동등 — 원문 유출 경로 없음. EIA §R17 이 정본으로 규정한 6표면·2컬럼 좌표계와 line-level 일치(뮤테이션 M1/M2/M3 재현으로 재확인). | `codebase/backend/src/modules/executions/executions.service.ts:1005,1069,704`; `background-runs.service.ts:302` | 조치 불요(양성 확인). |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 마스킹 통합 기능적으로 완전 동등, 원문 유출 경로 없음. 신규 취약점 없음. |
| requirement | NONE | EIA §R17 6표면·2컬럼 좌표계와 line-level 일치. 뮤테이션 M1/M2/M3 재현으로 spec 충족 확인. |
| scope | LOW | `spec/` developer 직접수정 잔존(1차 WARNING #2 연장, planner 트래커로 이관 완료). |
| side_effect | NONE | 순수 리팩터, 로직 바이트 단위 동일. `redactNodeExecutionRow` export 표면 소폭 확대(INFO). |
| maintainability | LOW | co-located 테스트로 1차 WARNING #1 해소 확인. 네이밍/타입/JSDoc 스타일 INFO만 잔존. |
| testing | LOW | 1차 WARNING #1/#2 실행 검증(29/29, 71/71 GREEN, 뮤테이션 재현)으로 해소 확인. 신규 갭 1건(`maskIfPresent` null 미검증) 발견. |
| documentation | LOW | 1차 WARNING #1/#2 문서 처리 적절(테스트 docstring·planner 이관 문구 명확). JSDoc 태그 스타일 INFO만 잔존. |

## 발견 없는 에이전트

해당 없음 — 전 에이전트가 최소 INFO 이상 보고(대부분 "정합 확인 — 문제 없음" 양성 결과 포함).

## 권장 조치사항

1. (선택, 저위험) `maskIfPresent` 의 `null` 방어 분기에 대한 테스트 케이스 추가 — `redactNodeExecutionRow` "부재 보존" 테스트에 `null` 값 케이스를 넣거나 `it.each([[undefined],[null]])` 로 파라미터화. WARNING #2(it.each 비대칭) 와 함께 한 번에 처리 가능.
2. (planner 소관, 이미 트래커 등재) `spec/conventions/egress-masking.md` 의 developer 직접 수정 건 — 다음 라운드에서 project-planner 가 (a) 예외 명문화 또는 (b) 정식 이관 중 하나로 카브아웃을 닫을 것.
3. (선택, 매우 저위험) 4개 export 헬퍼의 JSDoc `@param`/`@returns` 태그 스타일 통일 — 이 파일을 다음에 손댈 때 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation` (7명)
  - **제외**: 아래 표 (7명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원) — forced 전원 결과 확보됨. 강제 화이트리스트 미이행 없음.

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | 라우터 판단 — diff 가 순수 데이터 변환 통합(런타임 성능 특성 무변경)이라 대상 외로 분류(사유 상세는 프롬프트에 미기재). |
  | architecture | 상동 — 아키텍처 경계 변경 없음(기존 모듈 내 헬퍼 통합). |
  | dependency | 상동 — 신규 의존성 추가 없음. |
  | database | 상동 — SQL/쿼리 로직 변경 없음. |
  | concurrency | 상동 — 동시성 관련 코드 경로 무관. |
  | api_contract | 상동 — 응답 shape/DTO 계약 변경 없음(마스킹 값만 대체, 필드 구조 동일). |
  | user_guide_sync | 상동 — 사용자 문서 대상 변경 없음. |
