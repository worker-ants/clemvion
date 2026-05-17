import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AssistantMessageRequestDto,
  AssistantWorkflowNodeDto,
} from './assistant-message-request.dto';

/**
 * AssistantWorkflowNodeDto 는 `width`/`height` 를 optional 로 받지만,
 * 레이아웃 공식이 `predecessor.width ?? 250` 으로 폴백하기 때문에 **0 이
 * 들어오면 폴백이 무력화** 된다. DTO 수준에서 0·음수·NaN 을 거부해
 * 프롬프트 JSON 에 비정상 측정값이 흘러가지 못하게 한다.
 */
async function validateDto(
  instance: AssistantMessageRequestDto | AssistantWorkflowNodeDto,
) {
  return validate(instance, { forbidUnknownValues: false });
}

function makeNode(
  overrides: Partial<AssistantWorkflowNodeDto> = {},
): AssistantWorkflowNodeDto {
  return plainToInstance(AssistantWorkflowNodeDto, {
    id: 'n1',
    type: 'http_request',
    label: 'A',
    category: 'integration',
    positionX: 0,
    positionY: 0,
    config: {},
    ...overrides,
  });
}

describe('AssistantWorkflowNodeDto — width/height validation', () => {
  it('accepts a node with no width/height (initial render)', async () => {
    const errs = await validateDto(makeNode());
    expect(errs).toHaveLength(0);
  });

  it('accepts positive measured values', async () => {
    const errs = await validateDto(makeNode({ width: 240, height: 80 }));
    expect(errs).toHaveLength(0);
  });

  it('rejects width=0 because it defeats the `?? 250` fallback', async () => {
    const errs = await validateDto(makeNode({ width: 0 }));
    expect(errs.some((e) => e.property === 'width')).toBe(true);
  });

  it('rejects negative width/height', async () => {
    const errs = await validateDto(makeNode({ width: -5, height: -10 }));
    expect(errs.some((e) => e.property === 'width')).toBe(true);
    expect(errs.some((e) => e.property === 'height')).toBe(true);
  });

  it('rejects NaN width (provider misbehavior / JSON "NaN" parse)', async () => {
    const errs = await validateDto(makeNode({ width: Number.NaN }));
    expect(errs.some((e) => e.property === 'width')).toBe(true);
  });

  it('rejects unreasonably large dimensions (>10_000 px)', async () => {
    const errs = await validateDto(makeNode({ width: 100_000 }));
    expect(errs.some((e) => e.property === 'width')).toBe(true);
  });
});
