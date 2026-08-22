# Cross-Spec 일관성 검토 — spec-draft-swagger-401-drift.md

## 검토 방법 (참고)
prompt_file 에 번들된 "관련 spec 본문" 은 컨텍스트 예산 초과로 대부분 절단되어 있었다
(`13-replay-rerun.md` 본문 포함, `conventions/swagger.md` 는 번들 목록에 아예 등장하지 않음).
번들 완전 적재분(`2-api-convention.md`·`3-error-handling.md`)은 그대로 활용하고, 절단된
target 대상 파일 2건(`spec/5-system/13-replay-rerun.md`·`spec/conventions/swagger.md`)과
`spec/conventions/error-codes.md`·`codebase/backend` 런타임 소스는 워크트리에서 직접 읽어
실측했다.

## 발견사항

발견된 CRITICAL/WARNING 없음.

- **[INFO]** ① 401 코드명 정정 — 실측 완전 일치, 교차 충돌 없음
  - target 위치: `plan/in-progress/spec-draft-swagger-401-drift.md` §①, 제안 diff
  - 충돌 대상: 없음 (검증 완료)
  - 상세: `spec/` 전역에서 `` `UNAUTHORIZED` `` 는 정확히 2곳(`spec/5-system/13-replay-rerun.md:240,269`)이고 target 의 "자매 전수 확인" 주장과 정확히 일치함을 재실측으로 확인했다. `spec/5-system/2-api-convention.md:311`·`spec/5-system/3-error-handling.md:633`(§1.2, 이번 번들에 완전 적재됨) 모두 401=`AUTH_REQUIRED` 로 이미 일치하며, 런타임 `codebase/backend/src/common/filters/http-exception.filter.ts:145`(`case 401: return 'AUTH_REQUIRED';`)도 target 인용과 정확히 일치한다. `spec/conventions/error-codes.md` §3(Historical-artifact 예외 레지스트리)·§5(Rename 이력) 어디에도 `UNAUTHORIZED` 항목이 없어, target 의 "이건 rename 이 아니라 오기 정정이라 §5 대상이 아니다" 판단도 정합적이다. 데이터모델·API계약·요구사항ID·상태전이·RBAC·계층책임 어느 관점에서도 이 2줄 수정이 다른 spec 영역과 충돌할 표면이 없다.
  - 제안: 없음 (수정 그대로 진행 가능)

- **[INFO]** ② swagger.md §3 예외 양방향 확장 — 순수 문서 규약 텍스트, 기능적 충돌 표면 없음
  - target 위치: `plan/in-progress/spec-draft-swagger-401-drift.md` §②, 제안 diff
  - 충돌 대상: 없음 (검증 완료)
  - 상세: `spec/conventions/swagger.md:260-267` 의 현행 "예외 — 보안·정책 캐비엇" 문단은 target 이 인용한 원문과 정확히 일치한다. 이 예외 문구를 참조·복제하는 다른 spec 파일은 없다(`spec/` 전역 grep 결과 `swagger.md` 자신뿐). `ReRunRequestDto.inputOverride`(`codebase/backend/src/modules/executions/dto/re-run.dto.ts:18-27`)의 실제 JSDoc 은 이미 "마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부. SoT: EIA §R17." 를 담고 있어 target 이 "이미 굳은 관행" 이라 주장하는 근거와 부합하며, `MASKED_VALUE_RESUBMITTED` 자체는 `spec/5-system/14-external-interaction-api.md`(§R17)·`spec/5-system/3-error-handling.md`§1.7·`spec/5-system/13-replay-rerun.md`§8.1/§10.2·`spec/4-nodes/7-trigger/1-manual-trigger.md`§6·`spec/1-data-model.md`·`spec/conventions/error-codes.md`§4 전반에 이미 안정적으로 등재돼 있다 — 이번 편집은 이 기존 사실들 위에 문서 규약(설명 길이 예외)만 추가하는 것이라 데이터모델·API계약·상태전이·RBAC·계층책임 어느 축도 건드리지 않는다. `swagger.md §5-4`(엔드포인트 체크리스트)·`§1-3`(Optional 필드)와도 겹치는 규정이 없다.
  - 제안: 없음. 다만 target 스스로 명시한 대로 "넓히지 않는 것"(기본 `10~40자` 수치 규칙 자체의 34% 이탈)은 별도 트래커 항목으로 남겨두고 이번 편집 범위에 섞지 않는 판단이 적절 — 계속 그렇게 분리 유지할 것.

## 요약
target 문서의 두 spec 편집은 (1) 이미 다른 spec 영역·런타임 코드에서 표준으로 확정된 `AUTH_REQUIRED` 에 맞춰 낡은 오기 2줄을 정정하는 것, (2) 이미 코드·타 spec 문서에 안정적으로 존재하는 `MASKED_VALUE_RESUBMITTED` 요청-필드 거부 규칙을 swagger 설명 길이 예외 문구에 양방향으로 반영하는 것으로, 둘 다 기존 사실을 문서에 뒤늦게 반영하는 성격이며 새로운 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC·계층 책임을 도입하지 않는다. spec 전역 grep 과 대상 파일 직접 열람으로 target 의 모든 실측 주장(`UNAUTHORIZED` 정확히 2곳, DTO 설명 원문, 런타임 401 매핑, `MASKED_VALUE_RESUBMITTED` 기 등재 상태)을 재검증했고 불일치를 찾지 못했다. Cross-Spec 관점에서 이 draft 를 그대로 채택해도 다른 영역이 깨지거나 우선순위 결정이 필요한 지점이 없다.

## 위험도
NONE
