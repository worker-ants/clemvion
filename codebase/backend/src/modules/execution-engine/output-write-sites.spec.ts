import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

/**
 * 노드 출력을 캐시에 직접 쓰는 지점(`contextService.setNodeOutputs` · `seedNodeOutput`)을
 * 고정한다.
 *
 * 병렬 분기 안에서 실행되는 노드의 출력은 `ExecutionEngineService.commitNodeOutput` 으로만
 * 써야 한다. 직접 쓰면 분기 사본 캐시에 옮겨지지 않고 결과 노드 기록에도 빠져서, 같은 분기의
 * 다음 노드 입력이 비거나 `branches[i]` 가 예외 없이 `null` 이 된다(NERV Task CLE-T-7JJHF2).
 * 그래서 새 직접 쓰기 지점이 생기면 이 테스트가 실패한다. 그 지점이 병렬 분기 본문에서
 * 닿지 않는지 확인한 뒤 아래 목록과 `commitNodeOutput` JSDoc 의 나열을 함께 고친다.
 * 닿는다면 `commitNodeOutput` 으로 바꾼다.
 */
const EXPECTED_WRITE_SITES = [
  'ai-turn-orchestrator.service.ts handleAiEndConversation setNodeOutputs',
  'ai-turn-orchestrator.service.ts handleAiMessageTurn setNodeOutputs',
  'ai-turn-orchestrator.service.ts handleAiMessageTurn setNodeOutputs',
  'ai-turn-orchestrator.service.ts handleAiResumeTurn seedNodeOutput',
  'ai-turn-orchestrator.service.ts handleAiTurnError setNodeOutputs',
  'ai-turn-orchestrator.service.ts publishAiResumedSnapshot setNodeOutputs',
  'button-interaction.service.ts processButtonResumeTurn setNodeOutputs',
  'execution-engine.service.ts commitNodeOutput setNodeOutputs',
  'execution-engine.service.ts executeInline setNodeOutputs',
  'execution-engine.service.ts injectInvokerOutput setNodeOutputs',
  'execution-engine.service.ts rehydrateContext setNodeOutputs',
  'execution-engine.service.ts replayCrashedAiTurn setNodeOutputs',
  'execution-engine.service.ts restoreStoredNodeOutput setNodeOutputs',
  'form-interaction.service.ts processFormResumeTurn setNodeOutputs',
  'retry-turn.service.ts applyRetryLastTurn seedNodeOutput',
];

const WRITE_METHODS = new Set(['setNodeOutputs', 'seedNodeOutput']);

/** `<파일> <감싸는 메서드> <호출한 메서드>` 목록을 정렬해 돌려준다. */
function collectWriteSites(dir: string): string[] {
  const sites: string[] = [];
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts'));
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      fs.readFileSync(path.join(dir, file), 'utf8'),
      ts.ScriptTarget.Latest,
      true,
    );
    const visit = (node: ts.Node, owner: string | undefined): void => {
      let nextOwner = owner;
      if (
        (ts.isMethodDeclaration(node) || ts.isFunctionDeclaration(node)) &&
        node.name
      ) {
        nextOwner = node.name.getText(source);
      }
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        WRITE_METHODS.has(node.expression.name.text) &&
        /(^|\.)contextService$/.test(node.expression.expression.getText(source))
      ) {
        sites.push(
          `${file} ${nextOwner ?? '<top-level>'} ${node.expression.name.text}`,
        );
      }
      ts.forEachChild(node, (child) => visit(child, nextOwner));
    };
    visit(source, undefined);
  }
  return sites.sort();
}

describe('노드 출력 직접 쓰기 지점', () => {
  it('contextService.setNodeOutputs · seedNodeOutput 를 부르는 지점은 정해진 목록뿐이다', () => {
    expect(collectWriteSites(__dirname)).toEqual(
      [...EXPECTED_WRITE_SITES].sort(),
    );
  });
});
