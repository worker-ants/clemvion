import { z, ZodObject } from 'zod';
import { ifElseConfigSchema } from './if-else/if-else.schema';
import { variableDeclarationNodeConfigSchema } from './variable-declaration/variable-declaration.schema';
import { variableModificationNodeConfigSchema } from './variable-modification/variable-modification.schema';
import { loopNodeConfigSchema } from './loop/loop.schema';
import { switchNodeConfigSchema } from './switch/switch.schema';
import { foreachNodeConfigSchema } from './foreach/foreach.schema';
import { mapNodeConfigSchema } from './map/map.schema';
import { filterNodeConfigSchema } from './filter/filter.schema';
import { splitNodeConfigSchema } from './split/split.schema';

/**
 * 잠금 테스트 — Logic 카테고리 노드들의 ui.required / requiredWhen 메타가
 * 동일 노드의 warningRules SSOT 와 정렬되어 있는지 검증.
 *
 * 배경: warningRules 는 "사실상 필수" 필드의 SSOT 지만, frontend 의 필수
 * asterisk 표시는 별도로 ui.required / requiredWhen 메타를 본다
 * (visibility.ts:36-46). 두 source 가 어긋나면 사용자는 "필수인데 표시
 * 없음" 또는 "필수 아닌데 표시" 를 경험한다. 본 잠금 테스트로 후속 변경
 * 시 동기화 누락을 회귀 방지한다.
 */
type UiMeta = { required?: boolean; requiredWhen?: unknown };
type Props = Record<string, { ui?: UiMeta }>;

function uiMeta(schema: ZodObject, key: string): UiMeta | undefined {
  const json = z.toJSONSchema(schema) as unknown as { properties?: Props };
  return json.properties?.[key]?.ui;
}

describe('Logic nodes — ui.required / requiredWhen vs warningRules SSOT', () => {
  it.each([
    ['if-else', ifElseConfigSchema, 'conditions'],
    ['variable-declaration', variableDeclarationNodeConfigSchema, 'variables'],
    [
      'variable-modification',
      variableModificationNodeConfigSchema,
      'modifications',
    ],
    ['loop', loopNodeConfigSchema, 'count'],
    ['switch', switchNodeConfigSchema, 'cases'],
    ['foreach', foreachNodeConfigSchema, 'arrayField'],
    ['map', mapNodeConfigSchema, 'inputField'],
    ['filter (inputField)', filterNodeConfigSchema, 'inputField'],
    ['filter (conditions)', filterNodeConfigSchema, 'conditions'],
    ['split', splitNodeConfigSchema, 'fieldPath'],
  ])('%s marks "%s" as required for UI cues', (_label, schema, key) => {
    expect(uiMeta(schema as ZodObject, key)?.required).toBe(true);
  });

  it('switch.switchValue uses requiredWhen mode!=expression (mirrors switch:value-mode-needs-switch-value)', () => {
    expect(uiMeta(switchNodeConfigSchema, 'switchValue')?.requiredWhen).toEqual(
      {
        field: 'mode',
        notEquals: 'expression',
      },
    );
  });
});
