import { beforeAll, describe, expect, it } from '@jest/globals';
import * as path from 'node:path';
import {
  Controller,
  type ExecutionContext,
  ForbiddenException,
  Get,
  Post,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiExcludeEndpoint, ApiForbiddenResponse } from '@nestjs/swagger';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { Public, WorkspaceId, WorkspaceParam } from '../../common/decorators';
import type { WorkspaceRoleName } from '../../common/constants/workspace-roles';
import { Roles, RolesGuard } from '../../common/guards/roles.guard';
import { FORBIDDEN_NOT_A_MEMBER, forbiddenForRole } from '../../common/swagger';
import type { WorkspacesService } from '../../modules/workspaces/workspaces.service';
import {
  collectRouteHandlers,
  type ForbiddenCodeViolation,
  guardRejectionCodes,
  loadControllers,
  type RouteHandler,
  scanForbiddenResponseCodes,
} from './forbidden-response-codes-guard';

/**
 * 라우트의 `@ApiForbiddenResponse` 설명이 **`RolesGuard` 가 낼 수 있는 거부 코드**를 전부 싣는지 조인다
 * (`spec/conventions/swagger.md` §5-4).
 *
 * ## 왜 이 가드인가 — 157곳 중 129곳이 코드를 싣지 않았다
 *
 * 가드 거부가 코드를 갖게 된 뒤(`NOT_A_MEMBER` · `EDITOR_REQUIRED` · `ADMIN_REQUIRED` · `OWNER_REQUIRED` — 2026-09-25)에도
 * 기존 라우트의 403 설명은 따라가지 않았다. §5-4 는 새 엔드포인트 체크리스트라 기존 라우트를 묶지 않았다. 2026-09-26 실측
 * (`src/modules`, 이 파일과 같은 reflection): 가드가 403 을 낼 수 있는 라우트 157곳 중 **129곳**의 설명에 코드가 빠져 있었다 —
 * «워크스페이스 멤버가 아님» 54 · «editor 이상 권한 필요» 53 · «viewer 이상 권한 필요» 4 · 표기가 제각각인 역할 문장 14 · 비멤버
 * 코드만 빠진 통합 4. OpenAPI 로 클라이언트를 만드는 쪽은 어떤 코드가 오는지 알 수 없었다.
 *
 * ## 무엇을 대조하나
 *
 * | 칸 | 무엇 |
 * |---|---|
 * | 가드 코드 | `guardRejectionCodes` — `RolesGuard` 와 같은 규칙(`@Public` · `@Roles` · 워크스페이스 소비) |
 * | 광고 | 403 설명 — 데코레이터가 평가된 **최종 문장**(`swagger/apiResponse` 메타데이터) |
 * | 위반 | 가드 코드 중 설명에 없는 것이 있음(403 광고 자체가 없으면 전부) |
 *
 * 설명이 상수 보간(`${NOT_A_MEMBER.code}`)이라 소스 텍스트로는 최종 문장을 알 수 없다 — 그래서 AST 가 아니라 reflection 이다.
 *
 * **못 보는 것 두 가지** — 문서한 보장이 이 술어보다 넓어지지 않게 적어 둔다:
 *
 * - **남은 코드.** 술어는 설명에 **빠진** 코드만 센다. `@Roles('editor')` 를 내린 뒤 설명에 남은 `EDITOR_REQUIRED` 는 잡지 않는다 —
 *   서비스가 같은 이름의 코드를 내는 자리(통합의 Organization 변경 `ADMIN_REQUIRED`)와 구별할 수 없다. 역할을 바꾸면 설명도 손으로
 *   맞춘다(`swagger.md` §5-4).
 * - **서비스 거부.** 서비스가 내는 403(`FORBIDDEN` · `RERUN_PERMISSION_DENIED` 등)은 세지 않는다 — 자리마다 조건과 코드가 달라
 *   기계적 판정이 안 된다.
 *
 * ## 모델이 실제 가드와 같은가 — 캐너리로 고정한다
 *
 * `guardRejectionCodes` 는 `RolesGuard` 의 분기를 옮겨 적은 **모델**이다. 둘이 갈리면 검사가 가드가 내지 않는 코드를 요구하거나
 * 내는 코드를 놓친다. 문턱(요구 중 가장 낮은 역할)은 가드와 같은 함수(`lowestRequiredRole`)를 쓰고, 나머지 분기는 아래 «모델
 * 캐너리» 가 대조군의 모든 모양에 대해 **실제 `RolesGuard` 를 돌려** 모델과 같은 코드가 나오는지 본다.
 *
 * ## 베이스라인은 0이다
 *
 * 129곳을 공용 헬퍼(`FORBIDDEN_NOT_A_MEMBER` · `forbiddenForRole`)로 바꿔 0으로 만들었다. 동결 목록이 없으니 위반이 생기는 순간
 * 실패한다.
 */
describe('403 설명 ↔ 가드 거부 코드 가드', () => {
  const SRC_ROOT = path.resolve(__dirname, '..', '..');
  // `src/modules` 만 본다 — 컨트롤러가 전부 거기 있고, 대조군은 이 파일 안의 클래스다.
  const SCAN_ROOT = path.join(SRC_ROOT, 'modules');
  let routes: RouteHandler[] = [];
  let controllerCount = 0;

  beforeAll(async () => {
    const controllers = await loadControllers(collectTsFiles(SCAN_ROOT));
    controllerCount = controllers.length;
    routes = collectRouteHandlers(controllers);
  }, 120_000);

  it('스캔 대상이 비어 있지 않다 (vacuous 방지)', () => {
    expect(controllerCount).toBeGreaterThan(30);
    // 실측(2026-09-26) 157 — 가드가 403 을 낼 수 있어 대조한 라우트. 판정과 같은 순회가 센 값이다.
    expect(scanForbiddenResponseCodes(routes).checked).toBeGreaterThan(150);
  });

  it('가드가 낼 수 있는 403 코드가 설명에 전부 있다', () => {
    const violations = scanForbiddenResponseCodes(routes).violations.map(
      (v) =>
        `${v.controller}.${v.handler}() — 빠짐 ${v.missing.join(' · ')} | 설명: ${v.description ?? '(403 광고 없음)'}`,
    );
    expect(violations).toEqual([]);
  });

  describe('[대조군] 판정 함수가 실제로 가른다', () => {
    @Controller('fixture-forbidden')
    class ForbiddenFixtureController {
      /** 역할도 워크스페이스도 없는 전역 API — 가드 코드 없음. */
      @Get('global')
      global(): void {}

      /** `@WorkspaceId()` 소비 · 헬퍼 문장 — 맞다. */
      @Get('member')
      @ApiForbiddenResponse({ description: FORBIDDEN_NOT_A_MEMBER })
      member(@WorkspaceId() _ws: string): void {}

      /** 코드 없는 옛 문장 — `NOT_A_MEMBER` 빠짐. */
      @Get('member-legacy')
      @ApiForbiddenResponse({ description: '워크스페이스 멤버가 아님' })
      memberLegacy(@WorkspaceId() _ws: string): void {}

      /** 경로 워크스페이스 — `@WorkspaceParam` 도 소비다. */
      @Get('path/:id')
      @ApiForbiddenResponse({ description: FORBIDDEN_NOT_A_MEMBER })
      pathMember(@WorkspaceParam('id') _id: string): void {}

      /** `@Roles('editor')` · 헬퍼 문장 — 맞다. */
      @Post('editor')
      @Roles('editor')
      @ApiForbiddenResponse({ description: forbiddenForRole('editor') })
      editor(): void {}

      /** 종전 §5-4 문구 그대로(역할 코드만) — 비멤버 코드 빠짐. */
      @Post('editor-role-only')
      @Roles('editor')
      @ApiForbiddenResponse({
        description: 'editor 이상 권한 필요(EDITOR_REQUIRED)',
      })
      editorRoleOnly(): void {}

      /** 여러 역할 — 문턱은 가장 낮은 editor. admin 문장이면 `EDITOR_REQUIRED` 빠짐. */
      @Post('multi')
      @Roles('admin', 'editor')
      @ApiForbiddenResponse({ description: forbiddenForRole('admin') })
      multiDescribedAsAdmin(): void {}

      /** `viewer` 는 멤버십과 같다 — `NOT_A_MEMBER` 하나면 맞다. */
      @Get('viewer')
      @Roles('viewer')
      @ApiForbiddenResponse({ description: forbiddenForRole('viewer') })
      viewer(): void {}

      /** Owner — 두 코드. */
      @Post('owner')
      @Roles('owner')
      @ApiForbiddenResponse({ description: forbiddenForRole('owner') })
      owner(): void {}

      /** 경로 워크스페이스 + `@Roles` — 저장소에서 가장 흔한 조합(`workspaces` 컨트롤러). 두 코드. */
      @Post('path-admin/:id')
      @Roles('admin')
      @ApiForbiddenResponse({ description: forbiddenForRole('admin') })
      pathAdmin(@WorkspaceParam('id') _id: string): void {}

      /**
       * 서열 밖 문자열이 요구에 섞인 자리 — 그것(서열 0)이 문턱이 되어 멤버는 누구나 통과하고, 비멤버만 `NOT_A_MEMBER` 다.
       * 프로토타입 키(`constructor`)라 `ROLE_REQUIRED[...]` 를 곧장 인덱싱하면 `Object.prototype.constructor` 가 걸린다 —
       * 모델이 `Object.hasOwn` 으로 거르는지 본다(`@Roles` 는 `WorkspaceRoleName` 만 받아 캐스트로만 만들 수 있다).
       */
      @Post('out-of-hierarchy')
      @Roles('editor', 'constructor' as WorkspaceRoleName)
      @ApiForbiddenResponse({ description: FORBIDDEN_NOT_A_MEMBER })
      outOfHierarchy(): void {}

      /** 403 광고 자체가 없다 — 가드 코드 전부 빠짐. */
      @Post('no-forbidden')
      @Roles('admin')
      noForbidden(): void {}

      /** `@Public()` — 인증을 건너뛰어 가드가 멤버십을 보지 않는다. 워크스페이스를 소비해도 코드 없음. */
      @Get('public')
      @Public()
      publicRoute(@WorkspaceId() _ws: string): void {}

      /** OpenAPI 밖 — 광고가 없으니 묻지 않는다. */
      @Post('excluded')
      @Roles('editor')
      @ApiExcludeEndpoint()
      excluded(): void {}
    }

    /**
     * 클래스 단위 `@Roles` — 가드는 `getAllAndOverride([handler, class])` 로 읽는다. 저장소에 이 모양은 아직 없지만(2026-09-26
     * 실측 0) 모델이 이 fallback 을 주장하므로 대조군이 있어야 한다 — 없을 때 fallback 을 지운 뮤턴트가 살아남았다.
     */
    @Controller('fixture-forbidden-class-roles')
    @Roles('admin')
    class ClassRolesFixtureController {
      /** 클래스의 `@Roles('admin')` 를 물려받는다 — 두 코드. */
      @Post('inherit')
      @ApiForbiddenResponse({ description: forbiddenForRole('admin') })
      inherit(): void {}

      /** 핸들러의 `@Roles` 가 클래스를 덮는다(핸들러 우선) — `viewer` 라 비멤버 코드 하나. */
      @Get('override')
      @Roles('viewer')
      @ApiForbiddenResponse({ description: FORBIDDEN_NOT_A_MEMBER })
      override(): void {}
    }

    const fixtureRoutes = collectRouteHandlers([
      ForbiddenFixtureController,
      ClassRolesFixtureController,
    ]);
    const scan = scanForbiddenResponseCodes(fixtureRoutes);
    const key = (v: ForbiddenCodeViolation): string =>
      `${v.handler}:${v.missing.join('+')}`;

    it('네 모양의 위반을 잡는다 — 옛 문장 · 역할 코드만 · 문턱 아닌 역할 · 광고 없음', () => {
      expect(scan.violations.map(key).sort()).toEqual([
        'editorRoleOnly:NOT_A_MEMBER',
        'memberLegacy:NOT_A_MEMBER',
        'multiDescribedAsAdmin:EDITOR_REQUIRED',
        'noForbidden:NOT_A_MEMBER+ADMIN_REQUIRED',
      ]);
    });

    it('대조하는 라우트 수 — 전역 · Public · 제외는 세지 않는다', () => {
      // member · memberLegacy · pathMember · editor · editorRoleOnly · multi · viewer · owner · pathAdmin · outOfHierarchy ·
      // noForbidden · inherit · override
      expect(scan.checked).toBe(13);
    });

    it('가드 코드 모델', () => {
      const codesOf = (name: string): string[] =>
        guardRejectionCodes(
          fixtureRoutes.find((r) => r.name === name) as RouteHandler,
        );
      expect(codesOf('global')).toEqual([]);
      expect(codesOf('publicRoute')).toEqual([]);
      expect(codesOf('member')).toEqual(['NOT_A_MEMBER']);
      expect(codesOf('pathMember')).toEqual(['NOT_A_MEMBER']);
      expect(codesOf('viewer')).toEqual(['NOT_A_MEMBER']);
      expect(codesOf('editor')).toEqual(['NOT_A_MEMBER', 'EDITOR_REQUIRED']);
      expect(codesOf('multiDescribedAsAdmin')).toEqual([
        'NOT_A_MEMBER',
        'EDITOR_REQUIRED',
      ]);
      expect(codesOf('owner')).toEqual(['NOT_A_MEMBER', 'OWNER_REQUIRED']);
      expect(codesOf('pathAdmin')).toEqual(['NOT_A_MEMBER', 'ADMIN_REQUIRED']);
      expect(codesOf('outOfHierarchy')).toEqual(['NOT_A_MEMBER']);
      expect(codesOf('inherit')).toEqual(['NOT_A_MEMBER', 'ADMIN_REQUIRED']);
      expect(codesOf('override')).toEqual(['NOT_A_MEMBER']);
    });

    /**
     * ## 모델 캐너리 — 실제 `RolesGuard` 를 돌려 모델과 대조한다
     *
     * 대조군의 모든 라우트에 두 요청을 보낸다 — 비멤버(`getMemberRole` → 없음)와 viewer 멤버. 헤더 워크스페이스를 토큰과 다르게
     * 줘 헤더 라우트의 멤버십 재검증을 강제하고(`membershipUnverified`), 경로 파라미터도 같은 값으로 준다. `@Public()` 라우트는
     * `JwtAuthGuard` 가 인증을 건너뛰므로 `request.user` 없이 보낸다. 두 요청에서 던져진 코드의 합이 모델과 같아야 한다.
     *
     * viewer 멤버 한 사람으로 역할 미달을 재는 이유: 문턱이 viewer 보다 높으면 viewer 는 늘 미달이다 — 문턱이 무엇이든 그 코드가
     * 나온다.
     */
    it('모델 캐너리 — 실제 RolesGuard 가 대조군 모든 라우트에서 모델과 같은 코드를 낸다', async () => {
      const TOKEN_WS = '11111111-1111-4111-8111-111111111111';
      const OTHER_WS = '22222222-2222-4222-8222-222222222222';
      const codesFromGuard = async (route: RouteHandler): Promise<string[]> => {
        const isPublic =
          Reflect.getMetadata(IS_PUBLIC_KEY, route.handler) === true;
        const thrown = new Set<string>();
        for (const memberRole of [null, 'viewer'] as const) {
          const guard = new RolesGuard(new Reflector(), {
            getMemberRole: async () => memberRole,
          } as unknown as WorkspacesService);
          const request = {
            user: isPublic ? undefined : { sub: 'u-1', workspaceId: TOKEN_WS },
            headers: { 'x-workspace-id': OTHER_WS },
            params: new Proxy({}, { get: () => OTHER_WS }),
          };
          const context = {
            getHandler: () => route.handler,
            getClass: () => route.controller,
            switchToHttp: () => ({ getRequest: () => request }),
          } as unknown as ExecutionContext;
          try {
            const allowed = await guard.canActivate(context);
            // 코드 없는 거부(`false`)는 모델에 없는 결과다 — 드러나게 한다.
            if (!allowed) thrown.add('(false)');
          } catch (err) {
            if (!(err instanceof ForbiddenException)) throw err;
            thrown.add((err.getResponse() as { code: string }).code);
          }
        }
        return [...thrown].sort();
      };

      const mismatches: string[] = [];
      for (const route of fixtureRoutes) {
        const fromGuard = await codesFromGuard(route);
        const fromModel = [...guardRejectionCodes(route)].sort();
        if (fromGuard.join() !== fromModel.join()) {
          mismatches.push(
            `${route.name}: 가드 ${fromGuard.join('+') || '없음'} · 모델 ${fromModel.join('+') || '없음'}`,
          );
        }
      }
      expect(mismatches).toEqual([]);
      // 공허성 — 대조군이 모든 코드 종류를 실제로 끌어냈는가.
      const all = new Set(
        (await Promise.all(fixtureRoutes.map(codesFromGuard))).flat(),
      );
      expect([...all].sort()).toEqual([
        'ADMIN_REQUIRED',
        'EDITOR_REQUIRED',
        'NOT_A_MEMBER',
        'OWNER_REQUIRED',
      ]);
    });
  });
});
