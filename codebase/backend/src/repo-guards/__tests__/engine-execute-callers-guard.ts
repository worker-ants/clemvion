// 엔진 실행 진입 메서드를 부르는 지점 허용 목록 가드 — 스캔 · 판정 순수 로직.
//
// 소비처는 형제 파일 `engine-execute-callers.spec.ts`. 배경 · 근거는 그 파일 헤더에 있다.

import * as fs from 'node:fs';
import * as ts from 'typescript';
import {
  collectTsFiles,
  enclosingScopeName,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

/** 엔진에서 워크플로우를 실행하는 진입 메서드. */
export const ENGINE_ENTRY_METHODS: ReadonlySet<string> = new Set([
  'execute',
  'executeSync',
  'executeAsync',
  'executeInline',
]);

/**
 * 엔진을 가리키는 타입 이름. `ExecutionEngineService` 는 클래스, `WorkflowExecutor` 는 노드 레이어가
 * `WORKFLOW_EXECUTOR` 토큰으로 주입받는 같은 엔진의 인터페이스다.
 */
const ENGINE_TYPE_NAMES: ReadonlySet<string> = new Set([
  'ExecutionEngineService',
  'WorkflowExecutor',
]);

/** 엔진 클래스 안에서 `this.execute…()` 로 부르는 내부 호출을 잡으려고 쓴다. */
const ENGINE_CLASS_NAME = 'ExecutionEngineService';

/** 관문 함수 이름. 관문을 거치는 지점은 같은 함수 안에서 이 함수를 부른다. */
export const GATE_FUNCTION_NAME = 'isWorkflowInactive';

/**
 * 엔진 진입 메서드를 부르는 지점의 분류.
 * - `gated`: 외부 이벤트로 새 실행을 시작한다. 같은 함수 안에서 {@link GATE_FUNCTION_NAME} 을 부른다.
 * - `exempt`: 관문을 거치지 않는다. 사람이 직접 시작하거나 이미 시작된 실행의 한 단계다.
 */
export interface EngineEntryCaller {
  readonly kind: 'gated' | 'exempt';
  readonly reason: string;
}

/**
 * 엔진 진입 메서드를 부르는 지점(`<저장소 루트 상대 경로>::<감싸는 함수>::<메서드>`)과 분류.
 *
 * 정본은 CLE-TRIG-DATA 「워크플로우 활성 관문」 절의 경로 표와 「관문을 거치지 않는 경로」 목록이다.
 * `gated` 지점은 `isWorkflowInactive` JSDoc 의 호출 지점 목록과도 맞춘다. 새 지점을 여기 올릴 때는 그 절의
 * 한쪽 목록에 함께 더한다.
 */
export const ENGINE_ENTRY_CALLERS: Readonly<Record<string, EngineEntryCaller>> =
  {
    'codebase/backend/src/modules/hooks/hooks.service.ts::handleWebhook::execute':
      {
        kind: 'gated',
        reason:
          '일반 웹훅. 트리거 활성 확인 바로 뒤, 인증 앞에서 관문을 거친다',
      },
    'codebase/backend/src/modules/hooks/hooks.service.ts::dispatchChatChannelUpdate::execute':
      {
        kind: 'gated',
        reason:
          '채팅 채널 인입. 새 실행을 시작하기 직전, /start 의 기존 실행 취소 앞에서 관문을 거친다',
      },
    'codebase/backend/src/modules/schedules/schedule-runner.service.ts::process::execute':
      {
        kind: 'gated',
        reason: '스케줄 발사. job 을 받은 뒤 execute() 앞에서 관문을 거친다',
      },
    'codebase/backend/src/modules/workflows/workflows.controller.ts::execute::execute':
      {
        kind: 'exempt',
        reason:
          '에디터 수동 실행(POST /api/workflows/:id/execute). 사람이 시작한 실행이라 executedBy 를 넘긴다',
      },
    'codebase/backend/src/modules/workflows/workflows.controller.ts::executeNode::execute':
      {
        kind: 'exempt',
        reason:
          '에디터 단일 노드 실행(POST /api/workflows/:id/nodes/:nodeId/execute). 사람이 시작한 실행이라 executedBy 를 넘긴다',
      },
    'codebase/backend/src/modules/schedules/schedules.service.ts::runNow::execute':
      {
        kind: 'exempt',
        reason:
          '스케줄 "지금 실행"(POST /api/schedules/:id/run-now). 사람이 시작한 실행이라 executedBy 를 넘긴다',
      },
    'codebase/backend/src/modules/executions/executions.service.ts::reRun::execute':
      {
        kind: 'exempt',
        reason: '재실행. 사람이 시작한 실행이라 executedBy 를 넘긴다',
      },
    'codebase/backend/src/nodes/flow/workflow/workflow.handler.ts::execute::executeAsync':
      {
        kind: 'exempt',
        reason:
          '워크플로우 호출 노드의 비동기 서브 워크플로우. 이미 시작된 부모 실행의 한 단계',
      },
    'codebase/backend/src/nodes/flow/workflow/workflow.handler.ts::execute::executeInline':
      {
        kind: 'exempt',
        reason:
          '워크플로우 호출 노드의 인라인 서브 워크플로우. 부모 실행 안에서 돈다',
      },
    'codebase/backend/src/modules/execution-engine/execution-engine.service.ts::executeBackgroundSubgraph::executeInline':
      {
        kind: 'exempt',
        reason:
          'Background 노드 워커. 이미 시작된 실행의 본문을 같은 실행 안에서 돌린다',
      },
  };

function typeNameOf(type: ts.TypeNode | undefined): string | null {
  if (!type || !ts.isTypeReferenceNode(type)) return null;
  const name = type.typeName;
  return ts.isIdentifier(name) ? name.text : name.right.text;
}

/** 형 주석이 엔진 타입인 매개변수 · 속성 · 변수 이름. 파일 단위로 모은다. */
function engineReceiverNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      (ts.isParameter(node) ||
        ts.isPropertyDeclaration(node) ||
        ts.isVariableDeclaration(node)) &&
      ts.isIdentifier(node.name)
    ) {
      const typeName = typeNameOf(node.type);
      if (typeName !== null && ENGINE_TYPE_NAMES.has(typeName)) {
        names.add(node.name.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

function enclosingClassName(node: ts.Node): string | null {
  for (let cur: ts.Node | undefined = node.parent; cur; cur = cur.parent) {
    if (ts.isClassDeclaration(cur)) return cur.name?.text ?? null;
  }
  return null;
}

function isEngineReceiver(
  receiver: ts.Expression,
  names: ReadonlySet<string>,
  call: ts.Node,
): boolean {
  if (
    ts.isParenthesizedExpression(receiver) ||
    ts.isNonNullExpression(receiver)
  ) {
    return isEngineReceiver(receiver.expression, names, call);
  }
  if (ts.isAsExpression(receiver) || ts.isTypeAssertionExpression(receiver)) {
    const typeName = typeNameOf(receiver.type);
    if (typeName !== null && ENGINE_TYPE_NAMES.has(typeName)) return true;
    return isEngineReceiver(receiver.expression, names, call);
  }
  if (receiver.kind === ts.SyntaxKind.ThisKeyword) {
    return enclosingClassName(call) === ENGINE_CLASS_NAME;
  }
  if (ts.isIdentifier(receiver)) return names.has(receiver.text);
  if (ts.isPropertyAccessExpression(receiver)) {
    return names.has(receiver.name.text);
  }
  return false;
}

/** 소스 하나에서 찾은 엔진 진입 호출 지점과 관문 호출 함수. */
export interface EngineCallScan {
  /** `<감싸는 함수>::<메서드>` (중복 없이 정렬). */
  readonly entryCalls: string[];
  /** {@link GATE_FUNCTION_NAME} 을 부르는 감싸는 함수 이름(중복 없이 정렬). */
  readonly gateScopes: string[];
  /**
   * 같은 함수 안에서 그보다 앞에 관문 호출이 없는 진입 호출(`<감싸는 함수>::<메서드>`, 중복 없이 정렬).
   * 앞뒤는 소스 위치로 가린다. 관문이 분기 안에 있어 실제로 거치지 않는 경로는 가리지 못한다.
   */
  readonly entryCallsBeforeGate: string[];
}

/**
 * 소스 하나에서 엔진 진입 메서드 호출과 관문 함수 호출을 찾는다.
 *
 * - 수신자가 엔진 타입(`ExecutionEngineService` · `WorkflowExecutor`)으로 선언된 이름인 `.execute()` ·
 *   `.executeSync()` · `.executeAsync()` · `.executeInline()` 호출
 * - 엔진 클래스 안의 `this.execute…()` 호출
 *
 * 수신자를 형 주석으로 가리므로 TypeORM 쿼리 빌더의 `.execute()` 나 노드 핸들러의 `handler.execute()` 는
 * 잡지 않는다. 형 주석 없이 엔진을 받는 지점(별칭 타입 · 동적 조회)은 놓친다. 지금 저장소에는 그런 지점이
 * 없고 엔진은 생성자 주입으로만 받는다.
 */
export function scanEngineCalls(source: string): EngineCallScan {
  const empty: EngineCallScan = {
    entryCalls: [],
    gateScopes: [],
    entryCallsBeforeGate: [],
  };
  if (
    !/\bexecute(?:Sync|Async|Inline)?\b/.test(source) &&
    !source.includes(GATE_FUNCTION_NAME)
  ) {
    return empty;
  }
  const sf = ts.createSourceFile(
    'probe.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const names = engineReceiverNames(sf);
  const entries: { key: string; scope: string; pos: number }[] = [];
  /** 함수마다 가장 앞선 관문 호출 위치. */
  const firstGatePos = new Map<string, number>();
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (
        ts.isPropertyAccessExpression(callee) &&
        ENGINE_ENTRY_METHODS.has(callee.name.text) &&
        isEngineReceiver(callee.expression, names, node)
      ) {
        const scope = enclosingScopeName(node, sf);
        entries.push({
          key: `${scope}::${callee.name.text}`,
          scope,
          pos: node.getStart(sf),
        });
      }
      if (ts.isIdentifier(callee) && callee.text === GATE_FUNCTION_NAME) {
        const scope = enclosingScopeName(node, sf);
        const pos = node.getStart(sf);
        const prev = firstGatePos.get(scope);
        if (prev === undefined || pos < prev) firstGatePos.set(scope, pos);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const beforeGate = entries.filter((e) => {
    const gatePos = firstGatePos.get(e.scope);
    return gatePos === undefined || e.pos < gatePos;
  });
  return {
    entryCalls: [...new Set(entries.map((e) => e.key))].sort(),
    gateScopes: [...firstGatePos.keys()].sort(),
    entryCallsBeforeGate: [...new Set(beforeGate.map((e) => e.key))].sort(),
  };
}

/** 저장소 전체 스캔 결과. {@link EngineCallScan} 의 각 항목 앞에 `<저장소 루트 상대 경로>::` 가 붙는다. */
export type EngineCallerListing = EngineCallScan;

/** `srcDir` 아래 운영 코드(`.spec.ts` 제외)에서 엔진 진입 호출 지점과 관문 호출 함수를 모은다. */
export function listEngineCallers(
  repoRoot: string,
  srcDir: string,
): EngineCallerListing {
  const entryCalls: string[] = [];
  const gateScopes: string[] = [];
  const entryCallsBeforeGate: string[] = [];
  for (const file of collectTsFiles(srcDir)) {
    const scan = scanEngineCalls(fs.readFileSync(file, 'utf8'));
    const rel = toPosixRelative(repoRoot, file);
    entryCalls.push(...scan.entryCalls.map((c) => `${rel}::${c}`));
    gateScopes.push(...scan.gateScopes.map((s) => `${rel}::${s}`));
    entryCallsBeforeGate.push(
      ...scan.entryCallsBeforeGate.map((c) => `${rel}::${c}`),
    );
  }
  return {
    entryCalls: entryCalls.sort(),
    gateScopes: gateScopes.sort(),
    entryCallsBeforeGate: entryCallsBeforeGate.sort(),
  };
}

/** `<경로>::<함수>::<메서드>` 에서 `<경로>::<함수>` 를 뗀다. */
export function callerScope(key: string): string {
  return key.slice(0, key.lastIndexOf('::'));
}

/** 스캔 결과와 허용 목록을 대조한 어긋남. 모두 빈 배열이어야 통과다. */
export interface EngineCallerMismatch {
  /** 스캔에서 찾았는데 허용 목록에 없는 진입 호출 지점. */
  readonly unlisted: string[];
  /** 허용 목록에 있는데 스캔에서 찾지 못한 지점(지워졌거나 이름이 바뀌었다). */
  readonly stale: string[];
  /** `gated` 인데 같은 함수 안에서 관문보다 앞서거나 관문 없이 엔진을 부르는 지점. */
  readonly gatedWithoutGateFirst: string[];
  /** 관문을 부르지만 `gated` 지점이 아닌 함수(`<경로>::<함수>`). */
  readonly gateOutsideGated: string[];
}

/** 스캔 결과를 허용 목록과 대조한다. */
export function diffEngineCallers(
  listing: EngineCallerListing,
  allowlist: Readonly<Record<string, EngineEntryCaller>>,
): EngineCallerMismatch {
  const listed = new Set(Object.keys(allowlist));
  const found = new Set(listing.entryCalls);
  const gatedKeys = Object.keys(allowlist).filter(
    (k) => allowlist[k].kind === 'gated',
  );
  const gatedScopes = new Set(gatedKeys.map(callerScope));
  const beforeGate = new Set(listing.entryCallsBeforeGate);
  return {
    unlisted: listing.entryCalls.filter((k) => !listed.has(k)),
    stale: [...listed].filter((k) => !found.has(k)).sort(),
    gatedWithoutGateFirst: gatedKeys
      .filter((k) => found.has(k) && beforeGate.has(k))
      .sort(),
    gateOutsideGated: listing.gateScopes.filter((s) => !gatedScopes.has(s)),
  };
}
