import { Logger } from '@nestjs/common';
import { MAX_MODEL_LIST_SIZE, capModelList } from './list-models-cap';
import type { ModelInfo } from './interfaces/llm-client.interface';

const model = (i: number): ModelInfo => ({
  id: `m-${i}`,
  name: `model ${i}`,
  type: 'chat',
});

describe('capModelList', () => {
  it('returns the list unchanged when at or below the cap', () => {
    const under = Array.from({ length: 10 }, (_, i) => model(i));
    const exact = Array.from({ length: MAX_MODEL_LIST_SIZE }, (_, i) =>
      model(i),
    );
    const empty: ModelInfo[] = [];
    expect(capModelList(under)).toBe(under);
    expect(capModelList(exact)).toBe(exact);
    expect(capModelList(empty)).toBe(empty);
  });

  it('truncates to the first MAX_MODEL_LIST_SIZE preserving provider order', () => {
    const over = Array.from({ length: MAX_MODEL_LIST_SIZE + 50 }, (_, i) =>
      model(i),
    );
    const capped = capModelList(over);
    expect(capped).toHaveLength(MAX_MODEL_LIST_SIZE);
    // 앞 N개를 provider 순서 그대로 (재정렬 없음)
    expect(capped[0].id).toBe('m-0');
    expect(capped[MAX_MODEL_LIST_SIZE - 1].id).toBe(
      `m-${MAX_MODEL_LIST_SIZE - 1}`,
    );
  });

  it('logs a warning only when truncating', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const logger = new Logger('test');
    // try/finally — assertion 실패해도 spy 를 복원해 테스트 격리 유지.
    try {
      capModelList([model(0)], logger);
      expect(warn).not.toHaveBeenCalled();

      const over = Array.from({ length: MAX_MODEL_LIST_SIZE + 1 }, (_, i) =>
        model(i),
      );
      capModelList(over, logger);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining(`${MAX_MODEL_LIST_SIZE}`),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
