import { APP_GUARD } from '@nestjs/core';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../../app.module';
import { RolesGuard, ROLES_KEY } from '../../common/guards/roles.guard';
import { EdgesController } from '../../modules/edges/edges.controller';
import { NodesController } from '../../modules/nodes/nodes.controller';
import { ExecutionsController } from '../../modules/executions/executions.controller';
import { TriggersController } from '../../modules/triggers/triggers.controller';
import { KnowledgeBaseController } from '../../modules/knowledge-base/knowledge-base.controller';

/**
 * 회귀 가드 — `plan/in-progress/auth-workspace-membership-guard.md` §체크리스트
 * "회귀 가드" + ai-review WARNING #6/#8 (2026-08-08,
 * `review/code/2026/08/08/20_53_48`).
 *
 * 두 층을 지킨다:
 *
 * 1. **cross-tenant (비멤버, 73건 클래스 전체)** — `RolesGuard` 가 `APP_GUARD` 로
 *    전역 등록된 채로 남아 있는지 고정한다. 이번 fix 의 핵심은 "라우트마다
 *    데코레이터를 붙이는 opt-in 모델"이 아니라 "opt-out 이 구조적으로 불가능한
 *    가드"다(plan §설계) — 새 라우트는 코드 변경 없이 자동으로 멤버십 검사를
 *    받는다. 이 등록 한 줄만 지키면 74번째 라우트를 걱정할 필요가 없다.
 * 2. **intra-tenant (멤버이지만 viewer 가 쓰기, mutation 15건 중 §3.2 대조로
 *    확정된 8건)** — 개별 `@Roles()` 부착은 서비스 구현까지 읽는 사람 판정이
 *    필요해 정적으로 일반화할 수 없다(plan §전수 triage "일괄 `@Roles('editor')`
 *    는 정당한 viewer 동작을 깨뜨린다" 참조). 대신 이번 diff 로 확정된 8곳의
 *    메타데이터를 reflection 으로 직접 고정한다 — 오탈자·리팩터링으로 데코레이터가
 *    소실돼도 유닛 스위트가 RED 로 잡는다(ai-review WARNING #8: "실제로 붙어
 *    있는지 직접 검증하는 테스트가 전무").
 */
describe('workspace membership guard 회귀 가드', () => {
  it('RolesGuard 가 APP_GUARD 로 전역 등록되어 있다 (cross-tenant 차단의 구조적 근거)', () => {
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      AppModule,
    ) as unknown[];
    expect(Array.isArray(providers)).toBe(true);

    const hasRolesGuardAsAppGuard = providers.some(
      (p) =>
        typeof p === 'object' &&
        p !== null &&
        (p as { provide?: unknown }).provide === APP_GUARD &&
        (p as { useClass?: unknown }).useClass === RolesGuard,
    );
    expect(hasRolesGuardAsAppGuard).toBe(true);
  });

  describe.each([
    ['edges', EdgesController, 'create', ['editor']],
    ['edges', EdgesController, 'remove', ['editor']],
    ['nodes', NodesController, 'create', ['editor']],
    ['nodes', NodesController, 'update', ['editor']],
    ['nodes', NodesController, 'remove', ['editor']],
    ['executions', ExecutionsController, 'stop', ['editor']],
    ['triggers', TriggersController, 'rotateBotToken', ['editor']],
    ['knowledge-base', KnowledgeBaseController, 'search', ['viewer']],
  ] as const)(
    '%s 컨트롤러 — %s 핸들러',
    (_moduleName, ControllerClass, methodName, expectedRoles) => {
      it(`@Roles(${JSON.stringify(expectedRoles)}) 메타데이터가 실제로 부착돼 있다`, () => {
        const handler = (
          ControllerClass.prototype as unknown as Record<string, unknown>
        )[methodName as string];
        // vacuity 방지 — 메서드명이 리팩터로 바뀌면 undefined 가 되어 아래
        // getMetadata 가 조용히 undefined 를 돌려줄 수 있다. 여기서 먼저 끊는다.
        expect(typeof handler).toBe('function');

        const roles = Reflect.getMetadata(ROLES_KEY, handler as object) as
          string[] | undefined;
        expect(roles).toEqual(expectedRoles);
      });
    },
  );
});
