# 신규 식별자 충돌 검토 — `spec/2-navigation` (impl-prep, `plan/in-progress/authconfig-dup-delete.md`)

## 검토 대상 요약

이번 착수 대상은 spec 신규 작성이 아니라 `AuthConfigsService.remove()` 의 동시 삭제
버그 수정이다 (`plan_impact: none`). 형제 PR 넷(#1369~#1373: workflow·trigger·schedule·
integration·workspace-member)과 동일한 클래스의 결함을 auth-configs 도메인에 적용하는
일곱 번째 자리이며, 새로 도입되는 식별자는 사실상 private 헬퍼 메서드
`throwAuthConfigNotFound(): never` 하나뿐이다 (신규 API endpoint·엔티티·이벤트·ENV
var·spec 파일은 없음 — `spec_impact: none` 과 일치).

## 발견사항

- **[WARNING]** `throwAuthConfigNotFound()` 헬퍼명이 기존 `AUTH_CONFIG_NOT_FOUND` 에러
  코드와 같은 도메인에서 강하게 유사하다 — 이 저장소에서 유일하게 `*_NOT_FOUND` 인데 404
  가 아닌 예외 코드와 이름이 겹친다
  - target 신규 식별자: `throwAuthConfigNotFound(): never` (plan §A,
    `plan/in-progress/authconfig-dup-delete.md:1152-1169`, 형제 헬퍼
    `throwTriggerNotFound`/`throwScheduleNotFound`/`throwIntegrationNotFound`/
    `throwMemberNotFound` 와 동일 명명 패턴을 좇아 `codebase/backend/src/modules/auth-configs/auth-configs.service.ts` 에 신설 예정) — 던질 코드는 plan 자체가 `RESOURCE_NOT_FOUND`(404) 로 명시
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:965-978` 의
    `assertAuthConfigInWorkspace` 가 던지는 `code: 'AUTH_CONFIG_NOT_FOUND'` (400
    `BadRequestException`, `details: { field: 'authConfigId', code: 'INVALID_FIELD' }`).
    spec 정본은 `spec/5-system/3-error-handling.md:249-256`(§1.11) 이며, 바로 그 절이
    스스로 **"이름은 `_NOT_FOUND` 지만 404 가 아니다 — 이 저장소에서 유일한 예외다"** 라고
    명시한다. `spec/5-system/2-api-convention.md:250` · `spec/2-navigation/2-trigger-list.md:194`
    도 같은 코드를 참조한다
  - 상세: 두 식별자는 타입이 다르다(하나는 서비스 private 메서드명, 하나는 응답 `code`
    문자열 리터럴)이므로 **런타임 충돌은 아니다** — plan §B 의 착수 전 실측도 404
    `RESOURCE_NOT_FOUND` 를 명시적으로 골라 `findById`(`auth-configs.service.ts:130-137`)의
    기존 404 처리와 일치시켰다. 다만 두 이름이 "AuthConfig" + "NotFound" 조합으로 같은
    도메인·같은 저장소 안에서 **의미가 정반대(404 리소스 부재 vs 400 입력값 유효성)** 로
    공존하게 되며, 그 상태 코드 비대칭이 정확히 spec 이 "유일한 예외" 로 경고하는 그 항목과
    부딪힌다. `grep AuthConfigNotFound` 나 향후 리팩터링 시 두 자리를 같은 개념으로 오인해
    `throwAuthConfigNotFound()` 를 400/`AUTH_CONFIG_NOT_FOUND` 로 정렬하려는 시도가 나올
    위험이, 다른 네 형제 PR (`Trigger`/`Schedule`/`Integration`/`Member`) 에는 대응하는
    "같은 이름의 다른 상태코드 도메인 코드" 가 없어서 이번 자리에만 있는 위험이다
  - 제안: 헬퍼에 형제들과 같은 disambiguation 주석을 붙인다 — "이 404 `RESOURCE_NOT_FOUND`
    는 `triggers.service.ts` 의 400 `AUTH_CONFIG_NOT_FOUND`(§1.11, 유일한 `_NOT_FOUND`≠404
    예외)와 다른 자리다" 를 명시. 이름 자체를 바꿀 필요는 없다(형제 패턴과의 일관성이 더
    큰 가치) — 단 코드 리뷰·향후 유지보수자가 두 코드를 혼동하지 않도록 주석으로 고정해
    둘 것을 권장

- **[INFO]** 명명 규약 준수 확인 (충돌 아님, positive 확인)
  - `throwAuthConfigNotFound()` 는 `throwTriggerNotFound()` / `throwScheduleNotFound()` /
    `throwIntegrationNotFound()` (모두 `code: 'RESOURCE_NOT_FOUND'`) 와 동일한
    `throw<Entity>NotFound(): never` 패턴이다. `throwMemberNotFound()` 만 도메인 특화 코드
    `MEMBER_NOT_FOUND` 를 쓰는데, `AuthConfig` 는 `findById` 가 이미 `RESOURCE_NOT_FOUND`
    를 쓰고 있어(같은 파일 130-137행) 후자가 아니라 전자 패턴을 따르는 것이 기존 코드베이스와
    정합적이다 — plan §B 의 실측도 이를 확인했다
  - e2e 테스트 파일명도 미리 정해지지 않았으나, 형제 넷의 명명(`trigger-delete-concurrency`
    · `schedule-delete-concurrency` · `integration-delete-concurrency` ·
    `member-remove-concurrency` — 모두 `codebase/backend/test/`)을 따르면
    `auth-config-delete-concurrency.e2e-spec.ts` 가 되고, 그 경로는 현재 저장소에
    존재하지 않는다(충돌 없음, grep 0건)

## 검색 대상 코퍼스에 대한 비고

프롬프트가 예산 초과로 `spec/2-navigation/6-config.md`(AuthConfig API 정본)·
`spec/5-system/1-auth.md`·`spec/5-system/12-webhook.md` 본문을 생략했다. plan 체크리스트
자체가 이를 인지하고 "그 둘은 손으로 읽는다" 고 명시했으므로, 본 리뷰는 세 문서를 `Read` /
`grep` 으로 직접 열어 교차 확인했다 — `6-config.md` 는 `DELETE /api/auth-configs/:id` 를
"삭제 (Admin+)" 로만 적고 동시 삭제·404 코드를 아직 서술하지 않는다(신규 식별자 충돌은
없음 — 단순 미서술이며 이 plan 의 구현 완료 후 spec 보강 대상일 수 있으나 이는 신규 식별자
충돌 검토 범위 밖이다).

## 요약

이번 target 은 spec 문서 자체를 새로 쓰는 것이 아니라 `AuthConfigsService.remove()` 의
동시 삭제 결함을 형제 PR 넷과 같은 형태로 고치는 작업이며, 새로 도입하는 식별자는 private
헬퍼 `throwAuthConfigNotFound()` 하나로 범위가 매우 좁다. 이 헬퍼가 형제들과 같은 명명
패턴·같은 `RESOURCE_NOT_FOUND` 코드를 쓰는 것은 기존 코드베이스와 정합적이지만, 공교롭게도
같은 "AuthConfig" 도메인에 spec 이 "이 저장소의 유일한 `_NOT_FOUND`≠404 예외" 로 명시적으로
경고해 둔 `AUTH_CONFIG_NOT_FOUND`(400, `triggers.service.ts`)가 이미 존재해 이름이 매우
가깝다. 기능적 충돌(런타임 값 충돌)은 없으나, 향후 유지보수자를 오도할 수 있는 명명
근접성이므로 WARNING 으로 표시하고 disambiguation 주석을 권고한다. 그 외 요구사항 ID·
엔티티·API endpoint·이벤트명·ENV var·spec 파일 경로 축에서는 신규 식별자가 없어 충돌
후보가 없다.

## 위험도

LOW
