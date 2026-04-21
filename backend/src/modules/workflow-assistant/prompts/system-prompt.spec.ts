import { buildSystemPrompt } from './system-prompt';

/**
 * buildSystemPrompt 는 매 턴마다 LLM 에 주입되는 계약 문자열이다.
 * 두 가지 핵심 지시가 구조적으로 살아있는지 테스트로 고정한다:
 *  1) 노드 카탈로그가 isDynamicPorts 노드를 표시해 LLM 이 이를 보고
 *     `get_node_schema` 선행 호출이 필요함을 인지할 수 있도록.
 *  2) 현재 스냅샷 authoritative 문구와 "새 경로는 manual_trigger 에서
 *     시작" / "openQuestions 있으면 finish 금지" 강제 지시가 누락되지
 *     않도록.
 */
describe('buildSystemPrompt', () => {
  const emptySnapshot = { nodes: [], edges: [] };
  const defs = [
    {
      metadata: {
        type: 'manual_trigger',
        category: 'trigger',
        description: 'Manual trigger',
      },
      ports: { inputs: [], outputs: [{ id: 'out' }] },
    },
    {
      metadata: {
        type: 'switch',
        category: 'logic',
        description: 'Branch by case',
        isDynamicPorts: true,
      },
      ports: { inputs: [{ id: 'in' }], outputs: [{ id: 'default' }] },
    },
    {
      metadata: {
        type: 'http_request',
        category: 'integration',
        description: 'HTTP request',
      },
      ports: {
        inputs: [{ id: 'in' }],
        outputs: [{ id: 'out' }, { id: 'error' }],
      },
    },
  ];

  it('marks dynamic-ports nodes in the catalog summary', () => {
    const prompt = buildSystemPrompt(defs as never, emptySnapshot);
    // static 포트는 그대로 노출
    expect(prompt).toMatch(/- switch \(logic\):.*\[out: default\]/);
    // 동적 포트 표시자가 함께 붙어야 한다
    expect(prompt).toMatch(/- switch \(logic\):.*\[dynamic-ports\]/);
    // 정적 노드에는 마커가 없어야 한다
    expect(prompt).not.toMatch(
      /- http_request \(integration\):.*\[dynamic-ports\]/,
    );
  });

  it('embeds the three P0 guard rails (entry-point, openQuestions, dynamic-ports schema)', () => {
    const prompt = buildSystemPrompt(defs as never, emptySnapshot);
    // (a) manual_trigger 에서 시작하는 connection 강제
    expect(prompt).toMatch(/manual_trigger/);
    expect(prompt.toLowerCase()).toMatch(
      /entry point|starts? (at|from)|add_edge.*trigger/,
    );
    // (b) openQuestions 있으면 finish 금지
    expect(prompt).toMatch(/openQuestions/);
    expect(prompt.toLowerCase()).toMatch(
      /do ?not call .*finish|must not .*finish|without .*finish/,
    );
    // (c) isDynamicPorts 노드는 get_node_schema 선행 호출
    expect(prompt).toMatch(/dynamic-ports/);
    expect(prompt).toMatch(/get_node_schema/);
  });

  it('also recognizes metadata.dynamicPorts (without explicit isDynamicPorts) as a dynamic-ports node', () => {
    // 일부 노드는 isDynamicPorts 없이 dynamicPorts spec 만 선언한다.
    // 이 경우에도 catalog 마커가 붙어야 LLM 이 get_node_schema 를 먼저
    // 호출한다.
    const prompt = buildSystemPrompt(
      [
        {
          metadata: {
            type: 'category_carousel',
            category: 'presentation',
            description: 'dynamic buttons',
            dynamicPorts: { kind: 'carousel-buttons' },
          },
          ports: { inputs: [{ id: 'in' }], outputs: [{ id: 'default' }] },
        },
      ] as never,
      emptySnapshot,
    );
    expect(prompt).toMatch(
      /- category_carousel \(presentation\):.*\[dynamic-ports\]/,
    );
  });

  it('keeps the authoritative snapshot guidance that was added previously', () => {
    const prompt = buildSystemPrompt(defs as never, emptySnapshot);
    expect(prompt).toMatch(/authoritative/);
    expect(prompt).toMatch(/get_current_workflow/);
  });
});
