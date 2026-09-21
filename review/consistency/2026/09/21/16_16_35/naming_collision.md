# 신규 식별자 충돌 검토 — `spec/2-navigation` (--impl-prep, `modelconfig-dup-delete`)

## 검토 대상 재정의

이번 착수 대상은 `plan/in-progress/modelconfig-dup-delete.md` (`spec_impact: none`) 다.
`ModelConfigService.remove()` 를 형제 4건(#1371~#1374, schedules/integrations/workspaces/auth-configs)과
동일한 패턴으로 `repo.delete({ id, workspaceId })` + `affected` 판정으로 바꾸는 **순수 코드 결함
수정**이며, 신규 spec 문서나 신규 요구사항 ID 를 도입하지 않는다. 따라서 "target 문서가 새로
도입하는 식별자" 자체가 이 변경에는 존재하지 않고, 검토는 **계획이 재사용을 선언한 기존
식별자들이 실제로 기존 정의와 일치하는지** 확인하는 형태로 좁혔다 (`spec/2-navigation` 번들 중
budget 초과로 생략된 `6-config.md` 는 직접 `Read` 로 열어 확인).

## 발견사항

- **[INFO]** 도입되는 신규 식별자 없음 — 전부 기존 정의 재사용 확인
  - target 신규 식별자: (없음) — plan 이 사용을 선언한 식별자는 `MODEL_CONFIG_NOT_FOUND`,
    `model_config.delete`(`AUDIT_ACTIONS.MODEL_CONFIG_DELETE`), `DELETE /api/model-configs/:id`,
    `ModelConfigService.notFound()` 넷뿐이며 전부 기존 자산이다.
  - 기존 사용처:
    - `MODEL_CONFIG_NOT_FOUND` — `spec/5-system/3-error-handling.md:85` (404, "지정 id 의 ModelConfig
      부재 또는 cross-kind 접근 차단"), `spec/conventions/error-codes.md:171`,
      `codebase/backend/src/modules/model-config/model-config.service.ts:150`.
    - `model_config.delete` — `spec/5-system/1-auth.md:433`, `spec/data-flow/1-audit.md:103`,
      `codebase/backend/src/modules/audit-logs/audit-action.const.ts:105`
      (`MODEL_CONFIG_DELETE: 'model_config.delete'`), 이미 `model-config.service.ts:410` 에서 발행 중.
    - `DELETE /api/model-configs/:id` — `spec/2-navigation/6-config.md:284` (§3 Model Config API 표,
      "삭제").
    - `notFound()` — `model-config.service.ts:148` 기존 private 헬퍼(plan §C 가 "이 계열에서 헬퍼가
      이미 있던 첫 자리" 라고 명시).
  - 상세: 형제 PR 4건(#1371 schedules → `schedule.deleted`, #1372 integrations →
    `integration.deleted`, #1373 workspaces → `member.removed`, #1374 auth-configs →
    `auth_config.delete`)도 전부 기존 이벤트명·에러코드·엔드포인트를 재사용했고, 이번 것도 같은
    패턴이다. `MODEL_CONFIG_NOT_FOUND` 를 delete 의 진 쪽(losing request) 404 에 쓰는 것도
    `findEntity()` 가 이미 같은 코드로 던지는 것과 의미가 동일해 새 의미 부여가 아니다. 다른
    ModelConfig 관련 에러코드(`MODEL_CONFIG_DEFAULT_MISSING`, `MODEL_CONFIG_INVALID`)나 다른
    도메인의 `*_NOT_FOUND`(`ALERT_RULE_NOT_FOUND` 등)와도 이름이 겹치지 않는다.
  - 제안: 해당 없음 — 충돌 없음을 확인하는 것으로 충분.

- **[INFO]** 신규 e2e 파일명은 아직 존재하지 않으나 형제 4건과 동일 명명 규칙을 따르면 충돌 없음
  - target 신규 식별자: (파일 미생성, 예상) `codebase/backend/test/model-config-delete-concurrency.e2e-spec.ts`
  - 기존 사용처: 형제 파일 `codebase/backend/test/schedule-delete-concurrency.e2e-spec.ts`,
    `integration-delete-concurrency.e2e-spec.ts`, `member-remove-concurrency.e2e-spec.ts`,
    `auth-config-delete-concurrency.e2e-spec.ts` — `<resource>-{delete|remove}-concurrency.e2e-spec.ts`
    패턴.
  - 상세: `find codebase/backend/test -iname '*model-config*'` 결과 0건 — 예상 파일명과 겹치는
    기존 파일이 없다. `spec/2-navigation/6-config.md` 의 `code:` glob
    (`codebase/backend/src/modules/model-config/**`)은 `codebase/backend/test/` 아래를 물지
    않으므로, 형제 4건과 마찬가지로 이 신규 e2e 파일도 어떤 spec 의 `code:` 에도 등재되지 않는
    상태로 남을 것이다 — 이는 신규 충돌이 아니라 `4d9064740`(integrations PR) 커밋 메시지가 이미
    자인한 기존 갭("다섯 `*-delete-concurrency.e2e-spec.ts` 가 어느 spec 의 `code:` 에도 없다")의
    반복이다. 이번 리뷰의 관점(신규 식별자 충돌) 밖의 사안이라 CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: 파일명 자체는 그대로 진행해도 충돌 없음. `code:` 등재 갭은 이 plan 의 책임 범위(§"이 PR 이
    하지 않는 것")를 벗어나므로 별도 트래커 항목으로 남겨도 무방.

## 요약

이번 착수분은 신규 spec 문서·요구사항 ID·엔티티·API endpoint·이벤트명·ENV/설정키를 전혀 도입하지 않는
순수 버그 수정(`spec_impact: none`)이다. plan 이 재사용을 선언한 네 식별자(`MODEL_CONFIG_NOT_FOUND`,
`model_config.delete`, `DELETE /api/model-configs/:id`, `notFound()`)는 모두
`spec/5-system/1-auth.md`·`spec/5-system/3-error-handling.md`·`spec/data-flow/1-audit.md`·
`spec/2-navigation/6-config.md`·기존 서비스 코드와 정확히 같은 의미로 이미 정의돼 있어 새 의미
부여나 다른 정의와의 충돌이 없다. 아직 생성되지 않은 e2e 테스트 파일명도 형제 PR 4건의 명명 규칙을
그대로 따를 경우 기존 파일과 겹치지 않는다. 신규 식별자 충돌 관점에서 이 착수를 막을 사유가 없다.

## 위험도

NONE
