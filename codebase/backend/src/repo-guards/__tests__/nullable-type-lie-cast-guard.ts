// `null as unknown as X` 이중 캐스트 금지 가드 — 스캔·판정 순수 로직.
//
// 소비처는 형제 파일 `nullable-type-lie-cast.spec.ts`. 배경·근거는 그 파일 헤더에 있다.
// 파서 순수 로직과 소비 spec 을 분리하는 규약은 형제 가드 `masked-reject-callers-guard.ts`·
// `eslint-unicorn-peer-guard.ts` 와 동일하다.
//
// 세는 술어 자체는 `common/__test-utils__/source-scan.ts` 가 소유한다 — 그 모듈이
// "세 번째 가드가 생겨도 여기만 고치면 되도록" 이라고 자기 docstring 에 적어 둔 자리다.

import * as fs from 'node:fs';
import * as path from 'node:path';

import { countNullAsUnknownAsCasts } from '../../common/__test-utils__/source-scan';

/** `src` 루트. 이 파일은 `src/repo-guards/__tests__/` 에 있다. */
export const SRC_ROOT = path.resolve(__dirname, '..', '..');

export interface CastOffender {
  readonly file: string;
  readonly count: number;
}

/**
 * 스캔 대상: `src` 아래 **비-spec** `.ts` 파일.
 *
 * `*.spec.ts` 는 제외한다 — 테스트 fixture 가 부분 객체를 엔티티로 캐스트하는 것은 정당하고
 * (2026-09-03 실측 12건), 그쪽은 backend typecheck ratchet 이 이미 덮는다.
 */
export function collectScanTargets(root: string = SRC_ROOT): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.ts') && !e.name.endsWith('.spec.ts'))
        out.push(p);
    }
  };
  walk(root);
  return out.sort();
}

/** 캐스트가 남아 있는 파일과 개수. 위반이 없으면 빈 배열. */
export function findCastOffenders(files: string[]): CastOffender[] {
  const offenders: CastOffender[] = [];
  for (const file of files) {
    const count = countNullAsUnknownAsCasts(fs.readFileSync(file, 'utf8'));
    if (count > 0) {
      offenders.push({ file: path.relative(SRC_ROOT, file), count });
    }
  }
  return offenders;
}
