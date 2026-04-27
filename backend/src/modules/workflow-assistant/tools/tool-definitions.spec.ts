import {
  AssistantToolKind,
  TOOL_KIND_BY_NAME,
  buildAssistantTools,
} from './tool-definitions';

/**
 * `TOOL_KIND_BY_NAME` 과 `buildAssistantTools()` 는 각각 별개의 소스라서
 * 새 도구를 추가할 때 한쪽만 갱신하면 런타임에서만 터진다
 * (workflow-assistant-stream.service.ts 가 `TOOL_KIND_BY_NAME[ev.name] ??
 * 'edit'` 로 fallback 하므로 분류 누락이 "모든 신규 도구 = edit" 으로
 * 조용히 잘못 분기될 수 있음). 이 테스트가 양방향 집합이 같은지 고정한다.
 */
describe('assistant tool definitions ↔ TOOL_KIND_BY_NAME sync', () => {
  it('every tool returned by buildAssistantTools() has an entry in TOOL_KIND_BY_NAME', () => {
    const toolNames = buildAssistantTools().map((t) => t.name);
    for (const name of toolNames) {
      expect(TOOL_KIND_BY_NAME[name]).toBeDefined();
    }
  });

  it('every key in TOOL_KIND_BY_NAME corresponds to a tool in buildAssistantTools()', () => {
    const toolNames = new Set(buildAssistantTools().map((t) => t.name));
    for (const name of Object.keys(TOOL_KIND_BY_NAME)) {
      expect(toolNames.has(name)).toBe(true);
    }
  });

  it('classifies each kind into exactly the expected tool set', () => {
    const byKind: Record<AssistantToolKind, string[]> = {
      explore: [],
      plan: [],
      edit: [],
      finish: [],
    };
    for (const [name, kind] of Object.entries(TOOL_KIND_BY_NAME)) {
      byKind[kind].push(name);
    }
    // edit 5종은 병렬 배치 권장 대상 (system prompt §Parallel tool calls 가
    // 이 집합을 전제로 쓰여 있음).
    expect(byKind.edit.sort()).toEqual([
      'add_edge',
      'add_node',
      'remove_edge',
      'remove_node',
      'update_node',
    ]);
    expect(byKind.plan.sort()).toEqual(['clear_plan', 'propose_plan']);
    expect(byKind.finish).toEqual(['finish']);
    // explore 는 read-only 집합. 새 read 도구가 추가되면 여기를 확장해
    // 의도된 분류를 명시적으로 고정한다.
    expect(byKind.explore.sort()).toEqual(
      [
        'get_node_schema',
        'list_integrations',
        'list_workflows',
        'get_workflow',
        'get_current_workflow',
        'list_knowledge_bases',
        'get_workflow_executions',
        'get_execution_details',
        // verify_workflow 는 read-only 도구이지만 ok:true 결과가 review/verify
        // 게이트를 충족시키는 부수효과를 갖는다 (Phase 3). 분류 자체는 explore.
        'verify_workflow',
      ].sort(),
    );
  });

  it('edit tool descriptions all teach parallel batching (system-prompt §Parallel tool calls support)', () => {
    // 시스템 프롬프트의 Parallel tool calls 섹션이 edit 도구들을 batch 로
    // 묶어 낼 것을 지시한다. 도구 셀렉션 시점의 로컬 힌트가 그 지시를
    // 뒷받침하도록 각 edit 도구 description 에 parallel 키워드가 살아있는지
    // 고정 — 누가 description 을 재작성하면서 실수로 지우지 않도록.
    const editTools = buildAssistantTools().filter(
      (t) => TOOL_KIND_BY_NAME[t.name] === 'edit',
    );
    expect(editTools.length).toBeGreaterThan(0);
    for (const t of editTools) {
      expect(t.description.toLowerCase()).toMatch(
        /parallel|batch(ed)?(\s+in\s+parallel)?/,
      );
    }
  });
});
