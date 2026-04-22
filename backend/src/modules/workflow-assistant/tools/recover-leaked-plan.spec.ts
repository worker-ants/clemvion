import { recoverLeakedPlan } from './recover-leaked-plan';

/**
 * 실사례: LLM(GPT-4o) 이 `propose_plan` 도구 호출 대신 plan payload 를 text
 * 채널로 뱉는 leak 이 관측되었다. 서버에서 시그니처를 탐지해 합성 tool call
 * 로 전환하는 recovery 함수의 계약을 고정한다.
 */
describe('recoverLeakedPlan', () => {
  const VALID_LEAK = `{ "title": "설문조사 플로우 구성", "summary": "1depth 선택 → 2depth 음식 제시 → 결과", "steps": [ {"id":"s1","action":"add_node","description":"form 노드"}, {"id":"s2","action":"add_edge","description":"manual_trigger → form"} ], "openQuestions": ["이메일 Integration ID?"] }`;

  it('recovers a pure JSON payload emitted verbatim in text', () => {
    const result = recoverLeakedPlan(VALID_LEAK);
    expect(result).not.toBeNull();
    expect(result!.args.title).toBe('설문조사 플로우 구성');
    const steps = result!.args.steps as Array<Record<string, unknown>>;
    expect(steps).toHaveLength(2);
    expect(steps[0].id).toBe('s1');
    expect(steps[0].action).toBe('add_node');
    expect(result!.matched.trim().startsWith('{')).toBe(true);
    expect(result!.matched.trim().endsWith('}')).toBe(true);
  });

  it('recovers a JSON payload surrounded by prose', () => {
    const text = `네, 이렇게 진행하겠습니다.\n\n${VALID_LEAK}\n\n승인해 주세요.`;
    const result = recoverLeakedPlan(text);
    expect(result).not.toBeNull();
    expect(result!.args.title).toBe('설문조사 플로우 구성');
    // matched 는 원문 JSON 블록만 (주변 prose 는 포함되지 않음)
    expect(result!.matched.trim().startsWith('{')).toBe(true);
    expect(result!.matched).not.toMatch(/네, 이렇게/);
    expect(result!.matched).not.toMatch(/승인해 주세요/);
  });

  it('recovers a JSON payload wrapped in a markdown code fence', () => {
    const text = `계획은 다음과 같아요.\n\`\`\`json\n${VALID_LEAK}\n\`\`\`\n`;
    const result = recoverLeakedPlan(text);
    expect(result).not.toBeNull();
    expect(result!.args.title).toBe('설문조사 플로우 구성');
    // matched 는 code fence 안의 JSON 만 잡는다 (fence 자체는 포함될 수 있음).
    // 중요한 건 파서가 파싱 가능한 substring 이어야 한다는 것.
    const extracted = JSON.parse(
      result!.matched
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, ''),
    );
    expect(extracted.title).toBe('설문조사 플로우 구성');
  });

  it('returns null for plain prose with no JSON', () => {
    expect(recoverLeakedPlan('안녕하세요. 무엇을 도와드릴까요?')).toBeNull();
    expect(recoverLeakedPlan('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    const bad = `{ "title": "x", "steps": [ { "id": "s1", "action": "add_node" `;
    expect(recoverLeakedPlan(bad)).toBeNull();
  });

  it('returns null for JSON that is not a propose_plan shape', () => {
    // add_node 의 인자처럼 생긴 다른 JSON 을 오탐하면 안 된다.
    const otherTool = `{ "type": "http_request", "label": "API", "position": {"x":100,"y":200}, "config": {} }`;
    expect(recoverLeakedPlan(otherTool)).toBeNull();
    // title 만 있고 steps 는 없는 경우도 거부
    const incomplete = `{ "title": "plan", "summary": "x" }`;
    expect(recoverLeakedPlan(incomplete)).toBeNull();
    // steps 만 있고 title 은 없는 경우도 거부
    const onlySteps = `{ "steps": [{"id":"s1","action":"add_node","description":"x"}] }`;
    expect(recoverLeakedPlan(onlySteps)).toBeNull();
    // steps 의 entry 가 형식을 안 지키면 거부 (action 누락)
    const badStep = `{ "title": "p", "steps": [{"id":"s1","description":"x"}] }`;
    expect(recoverLeakedPlan(badStep)).toBeNull();
  });

  it('returns null for a small JSON object that happens to contain "title"', () => {
    // false-positive 방어. config field 안의 literal title 은 steps 가 없어서
    // 거부된다.
    const nodeConfig = `{ "title": "페이지 제목" }`;
    expect(recoverLeakedPlan(nodeConfig)).toBeNull();
  });

  it('respects string-literal braces when finding the matching close brace', () => {
    // steps 안의 description 에 "}" 가 들어가 있어도 brace 카운팅이 깨지면 안 된다.
    const tricky = `{ "title": "x", "steps": [{"id":"s1","action":"note","description":"closing brace } test"}] }`;
    const result = recoverLeakedPlan(tricky);
    expect(result).not.toBeNull();
    expect(result!.args.steps as unknown[]).toHaveLength(1);
  });

  it('picks the first valid propose_plan block if multiple candidates exist', () => {
    // 드문 케이스지만 두 블록이 섞여 있으면 순서상 먼저 유효한 것을 우선.
    const first = `{ "title": "첫번째", "steps": [{"id":"s1","action":"add_node","description":"a"}] }`;
    const second = `{ "title": "두번째", "steps": [{"id":"s1","action":"add_edge","description":"b"}] }`;
    const text = `${first}\n\n${second}`;
    const result = recoverLeakedPlan(text);
    expect(result).not.toBeNull();
    expect(result!.args.title).toBe('첫번째');
  });
});
