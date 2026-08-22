import 'reflect-metadata';
import { CustomValidationPipe } from '../../common/pipes/validation.pipe';
import { WorkflowsController } from './workflows.controller';
import { ExecuteWorkflowDto } from './dto/execute-workflow.dto';

/**
 * `POST /workflows/:id/execute` 의 **본문 계약이 좁아지지 않았는지** 지키는 캐너리.
 *
 * 이 엔드포인트의 `@Body()` 는 인라인 객체 타입이라 전역 `CustomValidationPipe` 가
 * 검증을 통째로 건너뛴다 — 즉 여분 top-level 키를 함께 보내도 통과해 왔다.
 * `ExecuteWorkflowDto` 는 그 사실을 바꾸지 않고 **OpenAPI 스키마만** 제공하려고 만든 것이다.
 *
 * > **여기가 RED 면 문서 작업이 계약 변경으로 번진 것이다.** `@Body()` 파라미터 타입을
 * > `ExecuteWorkflowDto` 로 바꾸면 파이프가 진입하고 `forbidNonWhitelisted: true` 가 켜져
 * > 여분 키가 400 이 된다. 그렇게 **바꾸고 싶다면** 그건 공개 API 계약 축소라 별도 결정이
 * > 필요하다(트래커 항목 참조) — 이 테스트를 조용히 고쳐서 통과시키지 말 것.
 */
describe('POST /workflows/:id/execute 본문 계약', () => {
  /** `execute()` 의 `@Body()` 자리(마지막 파라미터)에 emit 된 설계 타입. */
  function executeBodyParamType(): unknown {
    const types = Reflect.getMetadata(
      'design:paramtypes',
      WorkflowsController.prototype,
      'execute',
    ) as unknown[] | undefined;
    if (!types || types.length === 0) {
      throw new Error('design:paramtypes 메타데이터가 없다 — 테스트 전제 붕괴');
    }
    return types[types.length - 1];
  }

  it('[캐너리] `@Body()` 파라미터는 DTO 로 타입되지 않는다 — 타입하면 파이프가 진입한다', () => {
    // 전제 확인 — 이 단언이 vacuous 하지 않으려면 메타데이터가 실제로 emit 돼야 한다.
    expect(executeBodyParamType()).toBeDefined();

    expect(executeBodyParamType()).toBe(Object);
    expect(executeBodyParamType()).not.toBe(ExecuteWorkflowDto);
  });

  it('[캐너리] 여분 top-level 키를 실은 본문도 파이프를 통과한다', async () => {
    const pipe = new CustomValidationPipe();
    const body = {
      parameterValues: { apiKey: 'real-value' },
      input: { parameters: { a: 1 } },
      // 문서에 없는 키 — 지금까지 조용히 무시돼 왔다.
      legacyClientField: 'ignored-so-far',
    };

    await expect(
      pipe.transform(body, {
        type: 'body',
        metatype: executeBodyParamType() as never,
      }),
    ).resolves.toEqual(body);
  });

  /**
   * 대조군 — 파이프 자체는 **멀쩡히 문다.** 위 테스트가 통과하는 이유가 "파이프가 고장나서"
   * 가 아니라 "이 자리에 metatype 이 `Object` 라서" 임을 못박는다.
   *
   * > 거부 범위가 넓다는 점이 중요하다(실측): 이 DTO 에는 class-validator 데코레이터가
   * > 하나도 없어 `validate()` 가 등록 메타데이터를 못 찾고 **빈 객체조차** 거부한다.
   * > 즉 파라미터 타입을 이 클래스로 바꾸면 "여분 키만" 깨지는 게 아니라 **모든 요청**이
   * > 깨진다.
   */
  it.each([
    ['정상 본문', { parameterValues: { a: 1 } }],
    ['여분 키 포함', { parameterValues: {}, legacyClientField: 'x' }],
    ['빈 객체', {}],
  ])(
    '[대조군] DTO 로 타입하면 파이프가 거부한다 — %s',
    async (_label, body) => {
      const pipe = new CustomValidationPipe();
      await expect(
        pipe.transform(body, { type: 'body', metatype: ExecuteWorkflowDto }),
      ).rejects.toMatchObject({
        response: { code: 'VALIDATION_ERROR' },
      });
    },
  );
});
