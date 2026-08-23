import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * `POST /api/workflows/:id/execute` 요청 본문 — **OpenAPI 스키마 전용**.
 *
 * ## 왜 `@Body()` 파라미터 타입이 아닌가
 *
 * 이 클래스는 {@link WorkflowsController.execute} 의 `@ApiBody({ type })` 로만 쓰이고,
 * `@Body()` 파라미터는 **인라인 객체 타입을 유지**한다. 의도적이다.
 *
 * 전역 `CustomValidationPipe` 는 `metatype` 이 `Object` 면 검증을 통째로 건너뛴다
 * (`toValidate()` 의 제외 목록). 즉 이 본문은 **지금까지 한 번도 검증된 적이 없다**.
 * 파라미터 타입을 이 클래스로 바꾸면 파이프가 진입하고, 그 순간 문서를 다는 작업이 조용히
 * **API 계약을 바꾸는** 변경이 된다.
 *
 * 얼마나 바뀌는지는 실측했다 — 두 갈래 다 계약 변경이고, 앞쪽은 치명적이다:
 *
 * | 파라미터 타입을 이 클래스로 바꾸면 | 결과 |
 * |---|---|
 * | 지금처럼 class-validator 데코레이터가 **없는** 상태 | `validate()` 가 등록된 메타데이터를 못 찾아 **모든 요청**을 거부한다 — 빈 객체 `{}` 조차 `VALIDATION_ERROR`(*"an unknown value was passed to the validate function"*) |
 * | `@IsOptional`·`@IsObject` 를 **달면** | `forbidNonWhitelisted: true` 가 켜져 **여분 top-level 키**를 실은 요청이 400 |
 *
 * 이 엔드포인트는 유저 가이드에도 실린 공개 API 라 어느 쪽이든 별도 결정 사항이다. 그래서
 * 여기서는 **문서만** 고치고 런타임은 한 줄도 바꾸지 않는다.
 *
 * > 데코레이터를 **일부러 달지 않았다** — 달면 "이제 body 타입으로 써도 되겠네" 로 읽히기
 * > 쉬운데, 그건 위 표의 두 번째 줄(계약 축소)이다. 이 결정을 지키는 캐너리:
 * > `workflows-execute-body.spec.ts`.
 */
export class ExecuteWorkflowDto {
  @ApiPropertyOptional({
    description:
      'Manual Trigger 파라미터 값. ' +
      '마스킹 마커와 정확히 일치하는 값은 400 `MASKED_VALUE_RESUBMITTED` 로 거부. ' +
      'SoT: EIA §R17.',
    type: 'object',
    additionalProperties: true,
  })
  parameterValues?: Record<string, unknown>;

  /**
   * **{@link ExecuteNodeDto.input} 과 이름만 같고 형태가 다르다.** 그쪽은 노드 입력 값
   * 자체이고, 이쪽은 `parameters` 를 품는 **봉투**다 — 같은 컨트롤러의 OpenAPI 표면에
   * 나란히 노출되므로 구분해 둔다. 나머지 키는 실행 입력에 그대로 실린다.
   *
   * > **`deprecated` 인 이유** (2026-08-23 사용자 결정): 형제 {@link ExecuteNodeDto.input}
   * > 과 이름이 같고 뜻이 달라 같은 OpenAPI 표면에서 헷갈린다. 그런데 **리네임은 답이
   * > 아니다** — 런타임이 `body?.input` 을 읽으므로 속성명만 바꾸면 OpenAPI 가 없는 필드를
   * > 광고하고, 와이어 필드를 바꾸면 계약이 깨진다.
   * >
   * > 코드가 이미 답을 말한다: `parameterValues ?? input.parameters` — 이 필드는 **처음부터
   * > back-compat 경로**다. `deprecated` 는 비파괴로 클라이언트를 `parameterValues` 로
   * > 유도하므로, 동명이의가 **시간이 지나며 저절로 해소**된다.
   *
   * > **마커 거부는 두 필드에 똑같이 걸린다** (`00_07_27` requirement W1). 컨트롤러가
   * > `parameterValues ?? input.parameters` 로 합류시킨 뒤 `resolveTriggerParametersRejectingMasked`
   * > 를 **한 번** 부르기 때문이다 — 한쪽 description 에만 적으면 다른 경로로 보내는
   * > 클라이언트가 규칙을 못 본다.
   */
  @ApiPropertyOptional({
    description:
      '레거시 봉투. `parameterValues` 미지정 시 `input.parameters` 사용 — ' +
      '그 값도 동일한 마커 거부 대상. 신규 통합은 `parameterValues` 를 쓴다.',
    type: 'object',
    additionalProperties: true,
    deprecated: true,
  })
  input?: Record<string, unknown>;
}
