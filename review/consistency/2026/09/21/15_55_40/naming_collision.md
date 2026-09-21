# 신규 식별자 충돌 검토 — `spec/2-navigation` (impl-done, `plan/in-progress/authconfig-dup-delete.md`)

## 검토 대상 요약

`spec/2-navigation` 델타는 0개 파일이다 — 이 PR 은 spec 을 바꾸지 않는 코드 전용 변경이므로
정상이다. 실제 구현 diff 는 `AuthConfigsService.remove()` 의 동시 삭제 이중 감사 결함 수정
3파일(`auth-configs.service.ts` / `auth-configs.service.spec.ts` /
`auth-config-delete-concurrency.e2e-spec.ts`, 형제 PR #1369~#1373 과 같은 클래스의 일곱 번째
자리)이며, 새로 도입되는 식별자는 private 헬퍼 `throwAuthConfigNotFound(): never` 하나와 신규
e2e 스펙 파일 1개뿐이다. 신규 API endpoint·엔티티·DTO·이벤트·ENV var·spec 파일은 없다
(`spec_impact: none` 과 일치).

이 target 은 동일 plan 의 직전 라운드(`--impl-prep`, `review/consistency/2026/09/21/14_41_01`)에서
이미 이 관점(naming_collision)으로 검토돼 **WARNING 1건**이 나왔던 자리다. 이번 라운드는
그 WARNING 이 구현에서 실제로 해소됐는지를 확인하는 것이 핵심이다.

## 발견사항

- **[INFO]** 직전 라운드 WARNING(`throwAuthConfigNotFound` ↔ `AUTH_CONFIG_NOT_FOUND` 근접) — 구현에서 해소 확인
  - target 신규 식별자: `throwAuthConfigNotFound(): never`
    (`codebase/backend/src/modules/auth-configs/auth-configs.service.ts:152`, diff
    `origin/main...HEAD`)
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:976` 의
    `code: 'AUTH_CONFIG_NOT_FOUND'` (400 `BadRequestException`, `details.field='authConfigId'`).
    spec 정본은 `spec/5-system/3-error-handling.md` §1.11 — "이 저장소에서 유일한 `_NOT_FOUND`
    지만 404 가 아닌 예외" 로 명시된 자리
  - 상세: 직전 라운드가 지적한 대로 두 이름은 "AuthConfig"+"NotFound" 조합으로 강하게
    유사하지만 상태 코드(404 vs 400)·의미(리소스 부재 vs 입력값 유효성 검증 실패)가 정반대다.
    이번 구현은 그 WARNING 이 제안한 disambiguation 주석을 **정확히** 채택했다 — 헬퍼 JSDoc 이
    "`triggers.service.ts` 의 `AUTH_CONFIG_NOT_FOUND` 와 다른 자리다" 라고 명시하고, 400/404
    구분과 `§1.11` spec 근거까지 인용한다 (해당 JSDoc 은 diff 상 `auth-configs.service.ts:141-151`
    부근). 이름 자체는 형제 헬퍼 `throwTriggerNotFound`/`throwScheduleNotFound`/
    `throwIntegrationNotFound`/`throwMemberNotFound` 와 동일한 `throw<Entity>NotFound(): never`
    패턴을 유지해 코드베이스 명명 일관성도 지켰다
  - 제안: 없음 — 이미 해소됨. 후속 조치 불필요

- **[INFO]** 신규 e2e 스펙 파일 경로 — 기존 명명 컨벤션 준수, 충돌 없음
  - target 신규 식별자: `codebase/backend/test/auth-config-delete-concurrency.e2e-spec.ts`
  - 기존 사용처: 없음(신규 파일). 동일 컨벤션의 형제 파일 6개가 이미 존재 —
    `workflow-delete-concurrency.e2e-spec.ts` / `workspace-delete-concurrency.e2e-spec.ts` /
    `trigger-delete-concurrency.e2e-spec.ts` / `schedule-delete-concurrency.e2e-spec.ts` /
    `integration-delete-concurrency.e2e-spec.ts` / `member-remove-concurrency.e2e-spec.ts`
    (모두 `codebase/backend/test/`)
  - 상세: `<resource>-delete-concurrency.e2e-spec.ts` 패턴을 정확히 따르며 기존 파일과 겹치지
    않는다(신규 파일, grep 0건 사전 확인 — 직전 라운드 INFO 가 이미 이 이름을 예측했고 실제
    구현이 그대로 채택했다)
  - 제안: 없음

- **[INFO]** `RESOURCE_NOT_FOUND` 재사용 — 새 식별자 아님
  - target: `authConfigRepository.delete()` 의 `affected === 0` 분기가 던지는
    `code: 'RESOURCE_NOT_FOUND'` (`throwAuthConfigNotFound()` 내부, 기존 `findById()` 의
    404 리터럴을 헬퍼로 추출한 것뿐)
  - 기존 사용처: 저장소 전역 23개 서비스 파일에서 이미 쓰이는 범용 404 코드
    (`grep -rl "code: 'RESOURCE_NOT_FOUND'" codebase/backend/src/modules/` = 23건)
  - 상세: 이번 diff 는 이 코드를 새로 도입한 것이 아니라 기존 `findById()` 의 리터럴을
    private 메서드로 리팩터링해 두 번째 사용처(delete 경로)를 만든 것 — 충돌 후보 아님
  - 제안: 없음

## 검토 범위에 대한 비고

이번 diff(`auth-configs.service.ts`/`.spec.ts`/e2e 신규 파일)에서 요구사항 ID·엔티티/DTO
명·API endpoint(method+path)·webhook/queue/sse 이벤트명·ENV var·config key 축에서는 신규
식별자가 전혀 도입되지 않았다 — `DELETE /api/auth-configs/:id` 는 기존 endpoint 를 그대로
쓰고, `AUDIT_ACTIONS.AUTH_CONFIG_DELETE` 도 기존 상수를 그대로 재사용한다. 함께 변경된
`plan/in-progress/spec-draft-nullable-notation-followups.md`(트래커 정정)·`CHANGELOG.md` 는
서술 문서로, 새 식별자를 도입하지 않는다.

## 요약

이 라운드가 실제로 다루는 구현 diff 는 매우 좁고(private 헬퍼 1개 + e2e 파일 1개), 새 식별자
충돌 후보는 직전 `--impl-prep` 라운드에서 이미 찾아낸 `throwAuthConfigNotFound` ↔
`AUTH_CONFIG_NOT_FOUND` 근접 건 하나뿐이었다. 이번 구현은 그 WARNING 이 제안한
disambiguation 주석을 정확히 반영해 해소했고(이름은 형제 패턴 유지, 의미 차이는 JSDoc 으로
고정), 신규 e2e 파일명도 기존 6개 형제와 동일한 명명 컨벤션을 따라 충돌이 없다. 그 외
요구사항 ID·엔티티·API endpoint·이벤트명·ENV var·spec 파일 경로 축에서는 신규 식별자
자체가 없어 충돌 후보가 없다.

## 위험도

NONE
