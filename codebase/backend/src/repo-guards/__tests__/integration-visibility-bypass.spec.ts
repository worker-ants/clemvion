import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  findUnguardedRowReaders,
  listCallerFiles,
} from './integration-visibility-bypass-guard';

/**
 * `IntegrationsService.getForExecution` 이 가시성 판정을 거치지 않는 유일한 경로임을 고정한다(NERV Task `CLE-T-1BQZ10` 목표
 * «경계 캐너리», CLE-INT-MANAGE 「개인 통합 사용 판정」).
 *
 * 사용자 요청 경로는 가시성 판정(`requireVisible` · `requireModifiable` · `integrationVisibilityClause`)을 거쳐 남의 개인 통합을
 * 없는 통합으로 본다. `getForExecution` 만 그 판정 대신 개인 통합 사용 판정을 거쳐 자격 증명을 돌려준다. 그래서 둘을 센다.
 *
 * 1. `IntegrationsService` 의 공개 메서드 가운데 판정 없이 통합 행을 읽는 것은 `getForExecution` 하나다.
 * 2. `getForExecution` 을 부르는 운영 코드는 실행 엔진의 통합 노드 베이스와 AI 에이전트 도구 프로바이더뿐이다. 컨트롤러나
 *    사용자 요청 서비스가 부르면 가시성 판정을 건너뛴다.
 *
 * 어느 쪽이든 새로 걸리면 그 경로가 사용자 요청에서 닿는지 먼저 본다. 닿으면 가시성 판정을 건다. 실행 시점 조회라면 목록에
 * 올리고 그 경로가 `use` 를 어떻게 만드는지 같은 커밋에 적는다.
 */
const repoRoot = path.resolve(__dirname, '../../../../..');
const srcDir = path.resolve(__dirname, '../..');
const SERVICE = path.join(srcDir, 'modules/integrations/integrations.service.ts');

const EXECUTION_CALLERS = [
  // 통합 노드 다섯 종의 공통 베이스. `context.nodeId` · `context.rawConfig` 로 `use` 를 만든다.
  'codebase/backend/src/nodes/integration/_base/integration-handler-base.ts',
  // AI 에이전트 도구 프로바이더. `ProviderBuildCtx.nodeId` 와 서버 항목의 `fromExpression` 으로 `use` 를 만든다.
  'codebase/backend/src/nodes/ai/ai-agent/tool-providers/cafe24-mcp-tool-provider.ts',
  'codebase/backend/src/nodes/ai/ai-agent/tool-providers/makeshop-mcp-tool-provider.ts',
  'codebase/backend/src/nodes/ai/ai-agent/tool-providers/mcp-tool-provider.ts',
];

describe('통합 가시성 판정을 거치지 않는 경로', () => {
  it('IntegrationsService 에서 판정 없이 통합 행을 읽는 공개 메서드는 getForExecution 하나다', () => {
    expect(
      findUnguardedRowReaders(
        fs.readFileSync(SERVICE, 'utf8'),
        'IntegrationsService',
      ),
    ).toEqual(['getForExecution']);
  });

  it('getForExecution 을 부르는 운영 코드는 실행 경로뿐이다', () => {
    expect(listCallerFiles(repoRoot, srcDir, 'getForExecution')).toEqual(
      [...EXECUTION_CALLERS].sort(),
    );
  });
});

describe('findUnguardedRowReaders', () => {
  const wrap = (body: string) => `class S {\n${body}\n}`;

  it('판정 없이 저장소를 읽는 공개 메서드를 잡는다', () => {
    expect(
      findUnguardedRowReaders(
        wrap(`async leak(id) { return this.integrationRepository.findOne({ where: { id } }); }`),
        'S',
      ),
    ).toEqual(['leak']);
  });

  it('비공개 메서드를 거친 읽기 · 원시 SQL 읽기 · 엔티티 인자 읽기도 잡는다', () => {
    expect(
      findUnguardedRowReaders(
        wrap(`
          async viaPrivate(id) { return this.load(id); }
          private async load(id) {
            return this.integrationRepository
              .createQueryBuilder('i')
              .getOne();
          }
          async raw() { return this.dataSource.query('SELECT * FROM integration WHERE id = $1', []); }
          async entity(m) { return m.findOne(Integration, {}); }
        `),
        'S',
      ),
    ).toEqual(['entity', 'raw', 'viaPrivate']);
  });

  it('판정을 거친 메서드와 다른 테이블 읽기는 잡지 않는다', () => {
    expect(
      findUnguardedRowReaders(
        wrap(`
          async ok(id, ws, user) { const row = await this.requireVisible(id, ws, user); return this.reload(row.id); }
          private async reload(id) { return this.integrationRepository.findOne({ where: { id } }); }
          async list(ws, user) {
            return this.integrationRepository.createQueryBuilder('i').andWhere(integrationVisibilityClause('i'), {});
          }
          async logs() { return this.dataSource.query('SELECT * FROM integration_usage_log', []); }
          private async requireVisible(id, ws, user) { return this.integrationRepository.findOne({ where: { id } }); }
        `),
        'S',
      ),
    ).toEqual([]);
  });
});
