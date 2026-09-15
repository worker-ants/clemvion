# 신규 식별자 충돌 검토 — `spec/5-system/` (`--impl-prep`, `trigger-lock-followups`)

## 스코프에 대한 메모

이번 target 은 신규 spec 문서가 아니라 `spec/5-system/` 전체(대부분 컨텍스트 예산 초과로
본문 생략)이며, 실질 변경 계획은 `plan/in-progress/trigger-lock-followups.md` 다 — `#1334`
(트리거 config advisory lock) 가 남긴 developer 범위 후속 5건을 착수하기 **직전** 검토다.
5건 중 신규 spec 식별자(요구사항 ID·엔드포인트·이벤트·ENV·파일 경로)를 도입하는 항목은
없다 — 전부 `codebase/backend/src/modules/triggers/**` 내부의 이름 교정·방어 코드 추가·
테스트 추가다. 따라서 6개 점검 관점 중 실질적으로 걸리는 것은 **②(엔티티/타입/식별자명
충돌)** 축 하나이고, 나머지(요구사항 ID·API endpoint·이벤트명·ENV/설정키·파일 경로)는
이번 5건에서 새로 생성되는 대상이 없어 해당 없음을 실측으로 확인했다.

## 발견사항

- **[WARNING]** `findByIdForUpdate` 개명 대상이 미확정 — 대체 이름이 "잠금" 어휘를 다시 쓰면 같은 결함이 다른 이름으로 재발한다
  - target 신규 식별자: (미정) — `plan/in-progress/trigger-lock-followups.md` #1 은
    "`findByIdForUpdate` 개명"을 항목화했지만 대체 식별자를 아직 정하지 않았다. 착수 전
    실측(①)도 "개명 근거는 유지되지만 체커 문면보다 좁게 적는다"까지만 확정했다.
  - 기존 사용처:
    - `codebase/backend/src/modules/triggers/trigger-config-lock.ts` — `acquireTriggerConfigLock`(37행)·
      `rewriteTriggerConfigLocked`(147행)·`TRIGGER_CONFIG_LOCK_PREFIX`(18행)·`triggerConfigLockKey`(24행).
      이 파일의 함수군은 **실제로 Postgres advisory lock 을 잡는다** — 이름에 "Lock"이 들어가는 것이
      "진짜 잠금"의 유일한 신호다.
    - SQL `FOR UPDATE` 관용구 — `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`,
      `ai-turn-orchestrator.service.ts`, `codebase/backend/src/modules/auth/webauthn/webauthn.service.ts`,
      `codebase/backend/src/modules/integrations/integration-oauth.service.ts` 등 **7개 파일**에서
      "행 잠금"의 뜻으로 쓰인다 (plan 의 실측 ① 과 일치, 재확인 완료).
  - 상세: 이번 rename 의 출발점은 정확히 "`findByIdForUpdate`라는 이름이 이 저장소의 잠금
    어휘(`ForUpdate`/`FOR UPDATE`)를 흉내 내지만 실제로는 잠금을 걸지 않는(그냥 `findOne`
    조회) private 메서드"라는 반증이었다(`--impl-done 01_44_29` naming_collision W4, plan
    표 #1). 그런데 대체 이름이 정해지지 않은 채 착수하면, "잠금이 아님을 강조"하려는 의도로
    `findByIdWithoutLock`·`findByIdUnlocked`·`findByIdForLockedUpdate` 류의 "Lock"을 포함한
    이름을 고르기 쉽다 — 그 순간 같은 파일 트리 안에서 **진짜 advisory lock 함수군과 이름으로
    다시 혼동**되는, 원래 결함과 같은 클래스의 문제를 재생산한다. "이름이 거짓말한다"를
    고치다가 "이름이 다시 거짓말할 준비를 한다"로 끝나는 경로다.
  - 제안: 대체 이름에는 "Lock/Locked/Unlocked" 계열 어휘를 배제하고, 이 메서드의 실제
    목적(PATCH 사전 검증용 경량 조회, `workflow` relation 없이 `(id, workspaceId)`로만
    조회)을 드러내는 목적어를 쓸 것(예: `findByIdForPatchPrecheck`, `loadTriggerForUpdateValidation`
    류). 참고로 저장소에 이미 `findByIdFor<목적>` 접미사 패턴의 선례가 있다 —
    `AuthConfigsService.findByIdForResponse`(`codebase/backend/src/modules/auth-configs/auth-configs.service.ts:144`,
    마스킹된 응답 전용 조회). 접미사 관용구 자체는 재사용해도 되지만, 목적어를 `Response`처럼
    그대로 빌려오면 이번 메서드의 실제 목적과 달라 또 다른 "거짓 이름"이 되므로 목적어는
    새로 지어야 한다.

- **[INFO]** `rewriteTriggerConfigLocked`의 `affected` 확인 수정이 「같은 리터럴 재중복」을 다시 만들 수 있다
  - target 신규 식별자: (미정) — item 4 는 삭제 경합(FK CASCADE, 세 번째 삭제 경로) 시
    `m.update()`가 0행에 매치돼도 함수가 `true`를 반환하는 결함을 고친다. 수정 자체는
    새 식별자를 만들지 않지만, 호출부가 반환된 `false`를 "찾을 수 없음"으로 드러낼 때
    새 실패-응답 코드를 손으로 다시 적을 위험이 있다.
  - 기존 사용처: `codebase/backend/src/modules/triggers/triggers.service.ts:401`
    `throwTriggerNotFound()` — 같은 파일 349~354행 JSDoc 이 "없으면 `RESOURCE_NOT_FOUND`로
    던진다 — 이 문구가 사는 유일한 자리. 같은 리터럴이 네 곳으로 늘었었다(`findById`·
    `findByIdForUpdate`·창 1의 삭제 경합·`rotateBotToken`의 삭제 경합)"고 명시한다 — 이미 한
    라운드에서 중복을 4→1로 좁힌 이력이 있는 자리다.
  - 상세: `affected === 0`을 드러내는 수정이 `TriggersService.update()`(창 1, `rewriteTriggerConfigLocked`를
    거치지 않고 `save(trigger)`를 씀) 또는 다른 호출부에 새 분기를 추가하면서
    `throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', ... })`를 인라인으로 다시
    작성하면, 바로 이 파일이 스스로 경계하는 "같은 리터럴이 네 곳으로 늘었었다"는 결함을
    다섯 번째 자리로 재발시킨다.
  - 제안: 새 실패 처리 분기는 반드시 기존 `this.throwTriggerNotFound()`를 재사용하고, 별도
    리터럴이나 새 헬퍼를 만들지 말 것.

- **[INFO]** `TRIGGER_DELETE_LOCK_TIMEOUT_MS`는 이름·정의를 바꾸지 않으므로 ENV/설정키 충돌 없음
  - target 신규 식별자: 없음 — item 2 는 이 상수의 **JSDoc 서술 범위**만 "정리 3종"으로
    일반화하는 문서 수정이고, 식별자 자체는 그대로 유지된다.
  - 기존 사용처: `codebase/backend/src/modules/triggers/trigger-config-lock.ts:76`에서
    `export const TRIGGER_DELETE_LOCK_TIMEOUT_MS = 5_000`로 정의된 **모듈 상수**(하드코딩,
    ENV var 아님)이고, 소비처는 `triggers.service.ts:1028`·`schedules.service.ts:316`
    정확히 둘(plan 실측 ②·③과 일치).
  - 상세: 이름 패턴(`*_TIMEOUT_MS`)이 기존 ENV var `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`(execution
    engine, 별도 관심사)와 접미사 관용구를 공유하지만 완전히 다른 토큰이고, 이번 항목은
    이름 자체를 바꾸지 않으므로 충돌 위험이 없다. 기록 목적의 확인.
  - 제안: 없음(현행 유지).

- **[INFO]** 요구사항 ID·API endpoint·이벤트명·파일 경로 축은 이번 5건에서 해당 없음
  - target 신규 식별자: 없음
  - 기존 사용처: 해당 없음
  - 상세: `plan/in-progress/trigger-lock-followups.md`의 5개 항목(①`findByIdForUpdate`
    개명, ②JSDoc 일반화, ③`timeoutMs` 검증 추가, ④`affected` 확인, ⑤falsy 분기 테스트)
    은 전부 `codebase/backend/src/modules/triggers/**` 내부 코드 교정이며, `spec_impact:
    none`으로 선언돼 있다(문서 frontmatter). 새 spec 파일, 새 REST endpoint, 새 webhook/
    queue/SSE 이벤트명, 새 ENV var/config key를 도입하지 않는다. 6건 중 등재만 되고
    보류된 `deleteTriggerRowLocked` 헬퍼 추출(세 번째 호출부 발생 조건부)도 이번 PR
    범위 밖으로 명시적으로 제외됐다.
  - 제안: 해당 없음.

## 요약

이번 target(`spec/5-system/`, 실질 작업 단위는 `trigger-lock-followups.md`)은 신규 spec
식별자를 도입하지 않는 developer 범위 코드 정리 5건이라, 6개 점검 관점 중 5개는 실측상
해당 사항이 없다. 유일하게 실질적인 위험은 ①`findByIdForUpdate` 개명 항목 — 대체 식별자가
아직 정해지지 않은 채로, 저장소에 이미 존재하는 "진짜 잠금" 어휘(`acquireTriggerConfigLock`
등 advisory lock 함수군, SQL `FOR UPDATE` 관용구 7파일)와 다시 겹치는 이름을 고를 위험이다
— 원래 결함("이름이 거짓말한다")을 고치다 같은 클래스의 결함을 다른 어휘로 재생산하는
구도라 착수 전에 짚어 둘 가치가 있다. ④`affected` 확인 수정도 실패 처리 분기를 새로
적을 때 이미 4→1로 통합해 둔 `throwTriggerNotFound()` 리터럴을 재중복시킬 소지가 있어
INFO로 남긴다. 두 항목 모두 "이미 확정된 충돌"이 아니라 "착수 시 선택에 따라 충돌이
생길 수 있는" 예방적 지적이며, 현재 코드/spec 상태에는 확정된 CRITICAL 충돌이 없다.

## 위험도

LOW
