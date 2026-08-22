# 테스트(Testing) 리뷰 — eia-error-code-unify

## 발견사항

- **[WARNING]** 리네임된 테스트가 제목만 새 코드값을 주장하고, 본문은 그 값을 단언하지 않는다
  - 위치: `codebase/backend/src/modules/executions/executions-rerun.service.spec.ts:330-354`
  - 상세: 이번 diff 는 이 테스트의 제목을 `'throws INVALID_INPUT when …'` → `'throws INVALID_TRIGGER_PARAMETERS when …'` 로 바꿨다(게이트 330). 그런데 테스트 본문(331~354)은 여전히
    ```ts
    await expect(
      service.reRun('e1', 'ws-1', user, { useOriginalInput: false, inputOverride: {} }),
    ).rejects.toBeInstanceOf(BadRequestException);   // 게이트 352
    expect(engine.execute).not.toHaveBeenCalled();     // 게이트 353
    ```
    만 검사한다 — `body.code` 값을 단 한 줄도 단언하지 않는다. 즉 이 특정 테스트는 실제로는 "무슨 코드가 나오는지"를 전혀 검증하지 않으면서, 제목만 `INVALID_TRIGGER_PARAMETERS` 를 명시적으로 주장하는 상태가 됐다. 이 PR 의 목적 자체가 "두 엔드포인트의 `error.code` 를 통일"하는 것이므로, 정확히 이 회귀(코드값이 도로 바뀌는 것)를 잡아야 할 테스트가 이름만 바뀌고 실질 검증력은 그대로(instanceof 만 확인)라는 점이 아이러니하다. 같은 실패 경로(`TriggerParameterValidationException` → `BadRequestException`)를 검사하는 바로 아래 캐너리 테스트(`[회귀] 거부 응답이 details[] 로 필드별 코드를 싣는다`, 394~432)는 게이트 422 에서 `expect(body.code).toBe('INVALID_TRIGGER_PARAMETERS')` 를 정확히 단언한다 — 패턴이 이미 같은 파일에 있다. 자매 파일들도 전부 같은 패턴을 쓴다: `workflows.controller.spec.ts:150,246` (`expect(response.code).toBe('INVALID_TRIGGER_PARAMETERS')`), `workflows.service.spec.ts:1176` (`rejects.toMatchObject({ response: expect.objectContaining({ code: 'INVALID_TRIGGER_PARAMETERS' }) })`). 즉 plan(`eia-error-code-unify.md`)이 "세 엔드포인트가 같은 코드를 낸다는 것이 각 소비처 테스트로 고정돼 있다"(검증 기준 절, 실측 표 참조)고 주장하는 3개 파일 중, 이 파일의 이 테스트만 실제로는 코드값을 고정하지 못한다. 코드가 실수로 `'INVALID_INPUT'` 이나 다른 문자열로 되돌아가도 이 테스트는 계속 GREEN 이다(다른 두 테스트가 이미 그 자리를 커버하고 있어 실무상 위험은 낮지만, 이 특정 테스트의 이름-본문 불일치 자체가 오도적이다).
  - 제안: 이 테스트에도 `body.code` 단언을 추가한다(같은 파일 394~432, 또는 `workflows.controller.spec.ts:130-160`의 패턴을 그대로 이식). 예:
    ```ts
    const err = await service.reRun(...).catch((e) => e);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'INVALID_TRIGGER_PARAMETERS' });
    expect(engine.execute).not.toHaveBeenCalled();
    ```
    diff 범위를 벗어나는 선존 갭이긴 하지만, 이 PR 이 바로 이 줄의 제목을 건드렸고 목적이 "코드 통일 고정"이므로 같은 손길로 고치는 편이 싸다.

- **[INFO]** e2e 레벨에서 re-run 입력 검증 실패 경로의 `error.code` 를 단언하는 테스트가 없다
  - 위치: `codebase/backend/test/re-run.e2e-spec.ts` (전체 — `inputOverride` 검증 실패 시나리오 자체가 없음)
  - 상세: `re-run.e2e-spec.ts` 는 happy-path 시나리오(A/B, `inputOverride`+`useOriginalInput=false` 성공 케이스, 게이트 170)만 다루고, 트리거 스키마 검증 실패로 400 이 나는 경로는 다루지 않는다. 반면 `manual-trigger-default-param.e2e-spec.ts:310` 은 `save` 경로에서 `error?.code === 'INVALID_TRIGGER_PARAMETERS'` 를 e2e 로 고정한다. re-run 경로는 unit 레벨(`executions-rerun.service.spec.ts`)에서만 코드값이 검증되고 e2e 로는 HTTP 봉투 전체(직렬화·`GlobalExceptionFilter` 경유)가 검증되지 않는다. 이번 PR 이 만든 갭은 아니고 선존 상태이지만, 이 PR 이 바로 이 코드값 계약을 "통일"의 대상으로 다루고 있으므로 언급해둔다.
  - 제안: 필수는 아님(unit 레벨 커버리지가 있고 `GlobalExceptionFilter` 자체는 다른 e2e 로 커버될 가능성). 여유가 되면 `re-run.e2e-spec.ts` 에 트리거 스키마 검증 실패 → `400 + code: INVALID_TRIGGER_PARAMETERS + details[]` 케이스 1개 추가 검토.

- **[INFO]** `executions.controller.ts` Swagger 설명 변경은 실행 코드 경로가 아니므로 전용 테스트 불필요
  - 위치: `codebase/backend/src/modules/executions/executions.controller.ts:274`
  - 상세: `@ApiBadRequestResponse({ description: '...' })` 문자열만 바뀌었고 런타임 분기가 없다. Swagger 스냅샷 테스트가 이 저장소에 있다면 (예: OpenAPI 스펙 diff 가드) 그쪽에서 자동 반영될 것이나, 별도 확인은 하지 않았다. 기능적으로는 테스트 불필요.
  - 제안: 조치 불필요.

## 요약

diff 의 핵심 코드 변경(`executions.service.ts` 의 `code: 'INVALID_INPUT'` → `'INVALID_TRIGGER_PARAMETERS'`)은 이미 존재하는 회귀 캐너리 테스트(`executions-rerun.service.spec.ts:422`)가 정확히 새 값을 단언하도록 함께 갱신되어 있어 이 변경 자체의 회귀 방지는 확보돼 있다. 다만 같은 파일에서 제목만 바뀐 인접 테스트(330-354, "throws INVALID_TRIGGER_PARAMETERS…")는 실제로는 `.code` 값을 검사하지 않아 제목이 약속하는 검증력을 갖추지 못했다 — 자매 소비처 두 파일(`workflows.controller.spec.ts`, `workflows.service.spec.ts`)이 동일 시나리오(필수 파라미터 누락)에서 이미 `code` 를 직접 단언하는 패턴을 갖고 있어, 이 파일만 뒤처진 형태다. 이 PR 의 목적이 정확히 "세 엔드포인트의 코드값 통일을 테스트로 고정"하는 것이라는 점에서 이 갭은 사소하지만 주제와 정확히 맞닿아 있다. mock 구성(실제 서비스 인스턴스 + repository/engine 만 mock)은 적절하고, 테스트 격리(각 `it` 마다 `getOneQueue`/`chainDepth` 재설정)도 정상으로 보인다. e2e 레벨에서는 re-run 검증 실패 경로 자체가 커버되지 않는 선존 갭이 있으나 이번 diff 가 만든 것은 아니다.

## 위험도
LOW
