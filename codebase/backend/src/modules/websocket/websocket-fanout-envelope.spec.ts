import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

import {
  collectTsFiles,
  enclosingScopeName,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';
import type {
  ExecutionChannelEvent,
  FanoutEnvelope,
} from './websocket-events.types';
import type { WebsocketService } from './websocket.service';

/**
 * fanout 봉투 조립 순서를 타입과 구조로 묶는 가드 (CLE-T-7ZYES5, EGRESS §6).
 *
 * `executionEventSubject` 는 외부 수신자(SSE · 알림 · 채팅 채널)로 나가는 봉투를 싣는다.
 * 여기 들어가는 payload 는 값 마스킹(`maskWireEnvelope`)과 `toFanoutEnvelope` 를 모두
 * 지나야 한다. 이 파일은 그 약속을 두 층으로 지킨다.
 *
 * | 층 | 막는 우회 | 검사 주체 |
 * |---|---|---|
 * | 컴파일 타임 | 평범한 객체나 마스킹하지 않은 봉투를 subject · `toFanoutEnvelope` 에 넣기 | 타입체크 ratchet (`tsconfig.json` 이 spec 을 포함한다) |
 * | 소스 스캔 | 표지 타입으로 단언(`as`)하기, subject 에 `toFanoutEnvelope` 결과가 아닌 값 넣기 | 이 jest 스위트 |
 *
 * jest 는 타입을 지우므로 컴파일 타임 검사는 호출하지 않는 함수 안에 둔다. 제약이 풀리면
 * 그 안의 `@ts-expect-error` 가 «쓰이지 않는 지시어»(TS2578)가 되어 ratchet 이 실패한다.
 *
 * 못 막는 것: 표지 타입의 별칭을 만든 뒤의 단언(스캔이 이름으로 찾는다), 이미 표지가 붙은
 * 봉투를 spread 해 필드를 더하는 것. 뒤의 것은 「알려진 한계」 검사가 고정한다.
 */

const BACKEND_SRC = path.resolve(__dirname, '../..');
const SERVICE_FILE = path.join(__dirname, 'websocket.service.ts');

/** 표지 타입과, 그 타입으로 단언해도 되는 유일한 자리(`<파일>#<스코프>`). */
const BRANDED_TYPE_CAST_SITES: Readonly<Record<string, string>> = {
  FanoutEnvelope: 'modules/websocket/websocket.service.ts#toFanoutEnvelope',
  MaskedWireEnvelope: 'modules/websocket/websocket.service.ts#maskWireEnvelope',
  // payload 필드를 가진 이벤트 전체를 단언하면 payload 의 표지 검사를 건너뛴다.
  FanoutExecutionChannelEvent: '(없음)',
};

function parse(file: string): ts.SourceFile {
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
}

/** 단언 대상 타입 노드 안에서 표지 타입 이름을 찾는다(`as unknown as X` 의 바깥 단언 포함). */
function brandedNamesIn(typeNode: ts.TypeNode): string[] {
  const names: string[] = [];
  walk(typeNode, (n) => {
    if (
      ts.isTypeReferenceNode(n) &&
      ts.isIdentifier(n.typeName) &&
      n.typeName.text in BRANDED_TYPE_CAST_SITES
    ) {
      names.push(n.typeName.text);
    }
  });
  return names;
}

/** `this.<member>` 인가. */
function isThisMember(node: ts.Node, member: string): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ThisKeyword &&
    node.name.text === member
  );
}

/** `this.<method>(...)` 호출인가. */
function isThisCall(node: ts.Node, method: string): boolean {
  return ts.isCallExpression(node) && isThisMember(node.expression, method);
}

function enclosingFunction(node: ts.Node): ts.FunctionLikeDeclaration | null {
  for (let cur = node.parent; cur; cur = cur.parent) {
    if (ts.isFunctionLike(cur) && 'body' in cur) {
      return cur as ts.FunctionLikeDeclaration;
    }
  }
  return null;
}

/**
 * subject 에 넣는 `payload` 의 출처를 한 단어로 적는다. `this.toFanoutEnvelope(...)` 를
 * 바로 넣었거나, 그 호출로 초기화한 `const` 를 넣었으면 `'toFanoutEnvelope'` 다.
 */
function describePayloadSource(
  call: ts.CallExpression,
  sf: ts.SourceFile,
): string {
  const [arg] = call.arguments;
  if (!arg || !ts.isObjectLiteralExpression(arg)) {
    return `객체 리터럴이 아니다: ${arg?.getText(sf) ?? '(인자 없음)'}`;
  }
  if (arg.properties.some(ts.isSpreadAssignment)) {
    return `spread 가 있다: ${arg.getText(sf)}`;
  }

  let init: ts.Expression | null = null;
  for (const prop of arg.properties) {
    if (
      prop.name &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === 'payload'
    ) {
      if (ts.isPropertyAssignment(prop)) init = prop.initializer;
      else if (ts.isShorthandPropertyAssignment(prop)) init = prop.name;
    }
  }
  if (!init) return 'payload 가 없다';
  if (isThisCall(init, 'toFanoutEnvelope')) return 'toFanoutEnvelope';

  if (ts.isIdentifier(init)) {
    const fn = enclosingFunction(call);
    let source: string | null = null;
    if (fn) {
      walk(fn, (n) => {
        if (
          ts.isVariableDeclaration(n) &&
          ts.isIdentifier(n.name) &&
          n.name.text === (init as ts.Identifier).text &&
          ts.isVariableDeclarationList(n.parent) &&
          (n.parent.flags & ts.NodeFlags.Const) !== 0 &&
          n.initializer &&
          isThisCall(n.initializer, 'toFanoutEnvelope')
        ) {
          source = 'toFanoutEnvelope';
        }
      });
    }
    return (
      source ?? `toFanoutEnvelope 로 초기화한 const 가 아니다: ${init.text}`
    );
  }
  return `기타 식: ${init.getText(sf)}`;
}

describe('fanout 봉투 — 타입 강제 (컴파일 타임, 타입체크 ratchet 이 본다)', () => {
  it('마스킹 · toFanoutEnvelope 를 건너뛴 봉투는 subject 에 들어가지 못한다', () => {
    const checks = (service: WebsocketService): void => {
      // @ts-expect-error — 평범한 객체 리터럴에는 표지가 없다
      const literal: FanoutEnvelope = { executionId: 'e' };

      const unbranded: Record<string, unknown> = { executionId: 'e' };
      // @ts-expect-error — 넓은 레코드 타입은 표지 타입으로 좁혀지지 않는다
      const widened: FanoutEnvelope = unbranded;

      // 아래 이벤트 자체는 올바르다(단언 없이 컴파일된다). 그래서 다음 줄의 오류는 payload 의
      // 표지 하나 때문이다.
      const event: ExecutionChannelEvent = {
        executionId: 'e',
        eventType: 'execution.started',
        seq: 1,
        payload: { executionId: 'e' },
      };
      // @ts-expect-error — subject 는 FanoutEnvelope payload 만 받는다
      service['executionEventSubject'].next(event);

      // @ts-expect-error — 값 마스킹(maskWireEnvelope)을 건너뛴 봉투는 받지 않는다
      service['toFanoutEnvelope']('e', unbranded);

      // 정상 경로: 마스킹 → toFanoutEnvelope → subject.
      const envelope = service['toFanoutEnvelope'](
        'e',
        service['maskWireEnvelope']({ executionId: 'e' }),
      );
      service['executionEventSubject'].next({ ...event, payload: envelope });

      // 알려진 한계: 표지가 붙은 봉투를 spread 하면 표지가 그대로 남는다. 그래서 필드를 더한
      // 사본도 FanoutEnvelope 로 통과한다. 이 줄이 컴파일되는 한 FanoutEnvelope JSDoc 의
      // 한계 서술이 맞다. 여기서 막으려면 표지를 객체가 아니라 함수 출처로 바꿔야 한다.
      const spread: FanoutEnvelope = { ...envelope, injected: 'x' };

      void literal;
      void widened;
      void spread;
    };
    expect(checks).toBeInstanceOf(Function);
  });
});

describe('fanout 봉투 — 소스 스캔 (타입이 못 보는 우회)', () => {
  it('표지 타입으로의 단언(as · <T>)은 정해진 자리에만 있다', () => {
    const sites: string[] = [];
    for (const file of collectTsFiles(BACKEND_SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      if (!Object.keys(BRANDED_TYPE_CAST_SITES).some((n) => text.includes(n))) {
        continue;
      }
      const sf = parse(file);
      walk(sf, (n) => {
        if (ts.isAsExpression(n) || ts.isTypeAssertionExpression(n)) {
          for (const name of brandedNamesIn(n.type)) {
            sites.push(
              `${name} @ ${toPosixRelative(BACKEND_SRC, file)}#${enclosingScopeName(n, sf)}`,
            );
          }
        }
      });
    }

    // 정확히 이 두 자리다. 하나라도 빠지면 스캔이 진짜 단언을 못 보는 것이고(가드가 비었다),
    // 하나라도 늘면 우회가 생긴 것이다.
    expect(sites.sort()).toEqual(
      [
        `FanoutEnvelope @ ${BRANDED_TYPE_CAST_SITES.FanoutEnvelope}`,
        `MaskedWireEnvelope @ ${BRANDED_TYPE_CAST_SITES.MaskedWireEnvelope}`,
      ].sort(),
    );
  });

  it('subject 에 넣는 payload 는 모두 toFanoutEnvelope 의 결과다', () => {
    const sf = parse(SERVICE_FILE);
    const nextCalls: string[] = [];
    const otherUses: string[] = [];

    walk(sf, (n) => {
      if (!isThisMember(n, 'executionEventSubject')) return;
      const parent = n.parent;
      if (
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === n &&
        ts.isCallExpression(parent.parent) &&
        parent.parent.expression === parent
      ) {
        if (parent.name.text === 'next') {
          nextCalls.push(
            `${enclosingScopeName(n, sf)}: ${describePayloadSource(parent.parent, sf)}`,
          );
          return;
        }
        if (parent.name.text === 'asObservable') return;
      }
      // 변수에 담거나 다른 함수로 넘기면 위 검사를 우회한다.
      otherUses.push(`${enclosingScopeName(n, sf)}: ${parent.getText(sf)}`);
    });

    // emit 경로가 새로 생기면 이 목록을 함께 고친다. 그 경로도 toFanoutEnvelope 를 거쳐야 한다.
    expect(nextCalls).toEqual([
      'emitExecutionEvent: toFanoutEnvelope',
      'emitNodeEvent: toFanoutEnvelope',
    ]);
    expect(otherUses).toEqual([]);
  });
});
