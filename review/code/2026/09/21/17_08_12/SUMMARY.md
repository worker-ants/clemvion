# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL/WARNING 없음. 형제 7건(#1369~#1374)과 동일한 검증된 패턴("무락 조회 → 원자적 `DELETE` → `affected === 0` 명시 비교 → notFound")을 여덟 번째 자리(`ModelConfigService.remove()`)에 정확히 재적용한 버그 수정이며, 12개 reviewer(강제 포함 7개 전원 포함) 전원 결과를 확보했다. 유일하게 반복 지적된 항목은 "이 판별자 관용구가 8개 서비스 클래스에 공유 추상화 없이 손으로 복제되고 있다"(architecture)는 구조적 관찰과, 그 형제 e2e 파일들의 구조적 중복(maintainability, testing — 이미 이전 라운드에서 WARNING으로 지적됐고 이번 라운드에 plan 결정-고정으로 처리 완료)이다.

## Critical 발견사항

없음.

## 경고 (WARNING)

없음. (architecture 리뷰가 "판별자 관용구가 8개 서비스에 복제되고 있다"를 WARNING으로 표시했으나, 리뷰 본문 자체가 "이번 PR을 막을 사유는 아니다"라고 명시하며 다음 착수 시점의 검토 권고로 성격을 규정함 — 아래 참고 표로 격하하지 않고 원문 그대로 참고에 기재한다.)

## 참고 (INFO / 구조적 관찰)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | "무락 조회 → 원자적 DELETE → `affected===0` 명시 비교 → notFound" 판별자 관용구가 공유 추상화 없이 서비스 계층 8개 클래스(`model-config`, `auth-configs`, `workspaces`, `schedules`, `integrations`, `executions` 등)에 손으로 복제되고 있다. #1371 자리에서 이 불변식이 빠졌을 때 `!affected` 회귀 뮤턴트 32건이 통과한 전례가 있다 | `model-config.service.ts` `remove()`(403~442) 외 형제 서비스 다수 | 완전 템플릿 통합은 과도(9번째 WebAuthn은 감사 위치 축이 다름) — `affected` 판별자 자체만 `common/`의 작은 유틸(예: `isDeleteMiss()`)로 최소 추출하는 안을 다음(9번째) 착수 시점에 검토. 이번 PR을 막을 사유 아님 |
| 2 | maintainability / testing | 신규 e2e(`model-config-delete-concurrency.e2e-spec.ts`)가 형제 8개 파일과 구조적으로 거의 동일(9번째 사본) | `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts` | 이미 이전 라운드 WARNING → 이번 라운드 `01c6130f5`(plan 결정-고정)로 처리 완료. 9번째(WebAuthn) 착수 시 공용 헬퍼 추출 여부를 실제로 결정하는 것이 선행 조건으로 plan에 명문화됨. 재-flag 불필요 |
| 3 | testing | 레이스 패자 단위 테스트가 `mockRepo.delete` 호출 인자(`{id, workspaceId}`)를 승자 테스트와 달리 명시 단언하지 않음 | `model-config.service.spec.ts` (게이트 1104~1120) | `expect(mockRepo.delete).toHaveBeenCalledWith(...)` 한 줄 추가 시 대칭 확보. 비차단 |
| 4 | testing | `it.each([[undefined],[null]])` 블록의 `as unknown as DeleteResult` 캐스팅이 불필요해 보임 | `model-config.service.spec.ts` (게이트 1132~1135) | 제거 시 타입체크 통과 확인 후 정리. 비차단, 우선순위 낮음 |
| 5 | documentation | 「캐시 무효화 통지 중복은 과장이었다」 정정 근거로 3개 문서(CHANGELOG, plan 2건)가 반복 인용한 `llm.service.ts:81`이 실제 `clearClientCache` 호출 줄(82)이 아니라 그 한 줄 위(리스너 선언)를 가리킴 | `CHANGELOG.md`, `plan/in-progress/modelconfig-dup-delete.md`, `plan/in-progress/spec-draft-nullable-notation-followups.md` | 다음 편집 기회에 `llm.service.ts:81-82`로 정정하거나 줄 번호 대신 메서드명만 인용. 차단 아님 |
| 6 | database | `notifyInvalidated`/`recordAudit`가 `DELETE`와 한 트랜잭션에 묶여 있지 않음(감사 실패 시 삭제는 됐지만 감사 미기록 가능) | `model-config.service.ts` `remove()`(426~437) | 이번 diff의 회귀 아님 — `setDefault()` 등 기존 컨벤션과 동일. 조치 불요 |
| 7 | performance | `remove()`가 단건 삭제에 DB 왕복 2회(SELECT+DELETE, 감사 포함 3회) 사용 — `DELETE...RETURNING`으로 합칠 여지 있으나 diff 전후 왕복 횟수 동일(회귀 아님) | `model-config.service.ts` `remove()` | 저빈도 관리 오퍼레이션이라 실익 작음. 조치 불요 |
| 8 | security/requirement/scope/side_effect/concurrency/api_contract/database | 테넌트 격리 유지, SQL 인젝션 없음, 인가 미변경, FK `ON DELETE SET NULL` 확인, 판별자 명시 비교(`affected===0`) 정확, 공개 시그니처/응답 봉투 불변, 레이스 패자 204→404(기존 코드 재사용, breaking change 아님), 범위 이탈 없음, 락 자원 누수 없음 등 다수 항목이 "문제 없음"으로 확인됨 | 각 리포트 참조 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 테넌트 격리·인가·인젝션·정보노출 모두 문제 없음 |
| performance | NONE | 알고리즘/쿼리 복잡도 회귀 없음, DB 왕복 3회는 기존 패턴 |
| architecture | LOW | 판별자 관용구 8개 서비스 복제 — 다음 자리 착수 시 최소 추출 검토 권고 |
| requirement | NONE | spec(`MODEL_CONFIG_NOT_FOUND`)과 line-level 일치, 요구사항 충족, 이전 WARNING 3건 해소 재확인 |
| scope | NONE | 커밋 단위 원자성, 의도 이상 변경 없음 |
| side_effect | NONE | 통지 콜백/HTTP 상태 변경은 의도된 계약, 테스트로 고정됨 |
| maintainability | LOW | e2e 9번째 사본 — 결정-고정 완료로 INFO 하향, 나머지 모범 사례 |
| testing | NONE | 커버리지 충분, 사소한 INFO 2건(비차단) |
| documentation | LOW | 정정 근거 줄 번호 오프바이원(81 vs 82) 외 전반 우수 |
| database | LOW | 감사 비-트랜잭션은 기존 컨벤션(회귀 아님), FK/인덱스/원자성 확인 |
| concurrency | NONE | TOCTOU 결함을 원자적 DELETE로 정확히 닫음, 대조군 테스트 확보 |
| api_contract | NONE | API 표면 불변, 204→404는 기존 코드 재사용 |

## 발견 없는 에이전트

security, performance, requirement, scope, side_effect, testing, concurrency, api_contract — CRITICAL/WARNING 없음(INFO만 존재하거나 전무).

## 권장 조치사항

1. (비차단, 다음 PR 착수 시) 9번째(WebAuthn) 자리 착수 시 plan에 명문화된 선행 조건대로 e2e 공용 헬퍼 추출 여부를 실제로 결정하고, 동시에 architecture가 제안한 `affected` 판별자 유틸 최소 추출도 함께 검토.
2. (비차단, 선택) `model-config.service.spec.ts`의 레이스 패자 테스트에 `mockRepo.delete` 호출 인자 단언 추가, 불필요한 타입 캐스팅 정리.
3. (비차단, 선택) CHANGELOG/plan 2건의 `llm.service.ts:81` 인용을 `81-82`로 정정.
4. 이번 PR 자체를 막을 CRITICAL/WARNING 사유 없음 — 병합 가능.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (forced 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단 — 이번 diff는 의존성 변경 없음(코드 정리/버그 수정 범위 밖) |
  | user_guide_sync | router 판단 — 사용자 가이드 문서 영향 없는 내부 서비스 로직 수정 |
