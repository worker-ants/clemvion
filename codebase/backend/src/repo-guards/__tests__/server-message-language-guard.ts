// 에러 응답 `message` 언어 가드 — 스캔 · 판정 순수 로직.
//
// 소비처는 형제 파일 `server-message-language.spec.ts`. 배경은 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 나누는 규약은 형제 가드 `masked-reject-callers-guard.ts` 와 같다.

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import {
  collectTsFiles,
  toPosixRelative,
} from '../../common/__test-utils__/source-scan';

/**
 * 영문 `message` 로 옮긴 범위(backend `src/` 기준 상대 경로). 디렉터리면 그 아래 `.ts` 전부(테스트 제외)다.
 *
 * - `modules/auth` — NERV Task `CLE-T-MNX9KP` · `CLE-T-1K5CWP`
 * - `modules/triggers` — `CLE-T-CP6E9B`
 * - `common/constants/workspace-roles.ts` — 워크스페이스 가드 거부 본문, `CLE-T-CHP94Z`
 *
 * - `modules/workspaces` · `modules/users` — 워크스페이스 · 초대 · 사용자 서비스, `CLE-T-MBMPX5`
 *
 * 판정은 이름 규칙으로 응답 문구 자리를 추정하는 휴리스틱이다(`isResponseText`). 다른 파일에서 가져온 예외 헬퍼, 화살표 함수
 * 헬퍼, 변수에 담았다가 `throw` 하는 문구는 잡지 못하고 `description` · `summary` · `example` 속성과 `notify(…)` 인자는
 * 늘 제외한다. 판정을 넓히지 않고 못 잡는 꼴을 형제 spec 의 「지금은 안 잡는다」 픽스처로 고정한다(`CLE-T-7QQPK7`).
 */
export const SCANNED_PATHS: readonly string[] = [
  'modules/auth',
  'modules/triggers',
  'common/constants/workspace-roles.ts',
  'modules/workspaces',
  'modules/users',
];

const HANGUL = /[ㄱ-ㆎ가-힣]/;

/** 응답 문구를 담는 상수 이름. 거부 문구 표(`*_MESSAGES`)와 문구 뒤에 붙는 안내(`*_HINT`). */
const MESSAGE_CONSTANT_NAME = /(?:_MESSAGES?|_HINT)$/;

/** 이 속성 아래의 문자열은 응답 문구가 아니다(Swagger 설명 · 예시). */
const DOC_PROPERTY_NAMES = new Set(['description', 'summary', 'example']);

/** 한국어가 든 응답 문구 한 건. `line` 은 1부터 센다. */
export interface KoreanMessageHit {
  readonly line: number;
  readonly text: string;
}

function propertyName(node: ts.PropertyAssignment): string | undefined {
  const { name } = node;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return undefined;
}

/** `logger.warn(…)` · `this.logger.error(…)` 처럼 로거를 부르는가. 로그는 응답이 아니다. */
function isLoggerCall(node: ts.CallExpression): boolean {
  const callee = node.expression;
  if (!ts.isPropertyAccessExpression(callee)) return false;
  const target = callee.expression;
  if (ts.isIdentifier(target)) return /logger$/i.test(target.text);
  return (
    ts.isPropertyAccessExpression(target) && /logger$/i.test(target.name.text)
  );
}

function calleeName(node: ts.CallExpression | ts.NewExpression): string {
  const callee = node.expression;
  if (ts.isIdentifier(callee)) return callee.text;
  if (ts.isPropertyAccessExpression(callee)) return callee.name.text;
  return '';
}

/**
 * 인앱 알림을 보내는 `notify(…)` 호출 안인가. 알림의 `title` · `message` 는 받는 사람에게 보이는 알림 본문이고 에러 응답이
 * 아니다(`notificationsService.notify({ message })`). 알림 본문의 다국어화는 따로 다룬다.
 */
function isInsideNotifyCall(node: ts.Node): boolean {
  for (let cur = node.parent; cur !== undefined; cur = cur.parent) {
    if (ts.isCallExpression(cur) && calleeName(cur) === 'notify') return true;
  }
  return false;
}

/**
 * 문자열 노드가 에러 응답 문구 자리에 있는가. 조상을 올라가며 처음 만나는 판정 노드로 정한다.
 *
 * 응답 문구로 보는 자리:
 * 1. 이름이 `message` 인 속성의 값(예외 본문 객체 · 거부 본문 상수 · class-validator 옵션).
 * 2. 이름이 `…Exception` 인 생성자의 인자.
 * 3. `throwInvalidField(field, message)` 의 인자와, 같은 파일에서 반환 타입을 `…Exception` 으로 적은 함수의 인자
 *    (`totpNotInitialized(message)` 처럼 예외를 만들어 돌려주는 헬퍼).
 * 4. 이름이 `*_MESSAGES` · `*_HINT` 인 상수의 초기값.
 *
 * 그 전에 Swagger 설명 속성(`description` 등)이나 로거 호출을 만나면 응답 문구가 아니다. `notify(…)` 호출 안의 문자열은
 * 어느 자리든 응답 문구가 아니다(`isInsideNotifyCall`).
 */
function isResponseText(
  node: ts.Node,
  exceptionHelpers: ReadonlySet<string>,
): boolean {
  if (isInsideNotifyCall(node)) return false;
  for (let cur = node.parent; cur !== undefined; cur = cur.parent) {
    if (ts.isPropertyAssignment(cur)) {
      const name = propertyName(cur);
      if (name !== undefined && DOC_PROPERTY_NAMES.has(name)) return false;
      if (name === 'message') return true;
    }
    if (ts.isCallExpression(cur)) {
      if (isLoggerCall(cur)) return false;
      const name = calleeName(cur);
      if (name === 'throwInvalidField' || exceptionHelpers.has(name)) {
        return true;
      }
    }
    if (ts.isNewExpression(cur) && calleeName(cur).endsWith('Exception')) {
      return true;
    }
    if (
      ts.isVariableDeclaration(cur) &&
      ts.isIdentifier(cur.name) &&
      MESSAGE_CONSTANT_NAME.test(cur.name.text)
    ) {
      return true;
    }
  }
  return false;
}

/** 반환 타입을 `…Exception` 으로 적은 함수 선언의 이름. 예외를 만들어 돌려주는 헬퍼다. */
function collectExceptionHelpers(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isFunctionDeclaration(node) &&
      node.name !== undefined &&
      node.type !== undefined &&
      /Exception$/.test(node.type.getText(sf))
    ) {
      names.add(node.name.text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return names;
}

/** 소스 한 편에서 한국어가 든 응답 문구를 찾는다. 주석은 파서가 노드로 만들지 않아 걸리지 않는다. */
export function findKoreanMessages(source: string): KoreanMessageHit[] {
  if (!HANGUL.test(source)) return [];
  const sf = ts.createSourceFile(
    'probe.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
  );
  const exceptionHelpers = collectExceptionHelpers(sf);
  const hits: KoreanMessageHit[] = [];
  const visit = (node: ts.Node): void => {
    const isText =
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateExpression(node);
    if (isText) {
      const raw = node.getText(sf);
      if (HANGUL.test(raw) && isResponseText(node, exceptionHelpers)) {
        const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
        hits.push({ line: line + 1, text: raw });
      }
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return hits;
}

/** `SCANNED_PATHS` 아래 테스트 밖 `.ts` 파일(절대 경로, 정렬). */
export function listScannedFiles(srcDir: string): string[] {
  const files: string[] = [];
  for (const rel of SCANNED_PATHS) {
    const abs = path.join(srcDir, rel);
    if (fs.statSync(abs).isDirectory()) {
      files.push(...collectTsFiles(abs));
    } else {
      files.push(abs);
    }
  }
  return files.sort();
}

/** 범위 안의 한국어 응답 문구를 `경로:줄 문구` 로 모은다. */
export function findKoreanMessagesInScope(
  repoRoot: string,
  srcDir: string,
): string[] {
  return listScannedFiles(srcDir).flatMap((file) =>
    findKoreanMessages(fs.readFileSync(file, 'utf8')).map(
      (hit) => `${toPosixRelative(repoRoot, file)}:${hit.line} ${hit.text}`,
    ),
  );
}
