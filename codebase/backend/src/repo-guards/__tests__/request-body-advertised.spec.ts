import { beforeAll, describe, expect, it } from '@jest/globals';
import * as path from 'node:path';
import { Body, Controller, Get, Post, RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum';
import {
  ApiBody,
  ApiExcludeController,
  ApiExcludeEndpoint,
  ApiProperty,
} from '@nestjs/swagger';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  collectRouteHandlers,
  loadControllers,
  type RouteHandler,
} from './forbidden-response-codes-guard';
import { scanRequestBodyAdvertised } from './request-body-advertised-guard';

/**
 * 요청 본문을 받는 라우트(`@Body()`)가 **본문 스키마를 광고하는지** 조인다(`spec/conventions/swagger.md` §5-4).
 *
 * ## 왜 이 가드인가
 *
 * `@Body()` 파라미터를 인라인 객체 타입(또는 `unknown` · 인터페이스)으로 받으면 플러그인이 스키마를 만들지 못해, 생성된 OpenAPI 에
 * `requestBody` 가 없다 — 클라이언트 생성기가 무엇을 보내야 하는지 모른다. 2026-09-26 에 그런 라우트가 3곳이었다(`rotate-bot-token` ·
 * 실행 `continue` · 웹훅 수신 — #1408 이 채웠다).
 *
 * ## 무엇을 대조하나
 *
 * | 칸 | 무엇 |
 * |---|---|
 * | 본문 자리 | 라우트 인자 메타데이터의 `@Body()` 자리(파라미터 순서가 아니다) |
 * | 설계 타입 | 그 자리의 `design:paramtypes` — 전역 `CustomValidationPipe` 가 받는 바로 그 값 |
 * | 위반 | 설계 타입이 파이프의 비검증 목록(`UNVALIDATED_METATYPES` · 없음)인데 `@ApiBody` 가 없음 |
 *
 * **왜 AST 가 아닌가**: `interface` · 타입 별칭 참조는 런타임에 `Object` 가 된다 — 소스로는 클래스 참조와 구별되지 않는다.
 *
 * **왜 클래스로 받게 강제하지 않나**: 파이프는 클래스 파라미터에만 진입하고, 진입하면 `whitelist` · `forbidNonWhitelisted` 로 에러
 * 코드와 여분 키 처리가 바뀐다(계약 변경). 그래서 인라인 타입은 그대로 두고 문서 전용 DTO 를 `@ApiBody` 로 광고하는 것도 통과다 —
 * 선례 `workflows/dto/execute-workflow.dto.ts`.
 *
 * **못 보는 것**: `@ApiBody` 가 **맞는** DTO 를 가리키는지(라우트별 캐너리 `*-body.spec.ts` 가 본다) · 클래스 파라미터의 DTO 가 실제
 * 본문과 맞는지(요청 쪽 검증은 파이프가 한다).
 *
 * ## 베이스라인은 0이다
 *
 * 실측(2026-09-26, `src/modules`): `@Body()` 78 — 클래스 74 · 인라인 + `@ApiBody` 4. 동결 목록이 없으니 위반이 생기는 순간 실패한다.
 */
describe('요청 본문 스키마 가드', () => {
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
    const scan = scanRequestBodyAdvertised(routes);
    // 실측(2026-09-26) 78 — 대조한 `@Body()` 자리. 판정과 같은 순회가 센 값이다.
    expect(scan.checked).toBeGreaterThan(70);
    // 실측 4 — 설계 타입이 클래스가 아닌 자리. 0 이면 판정 분기가 실제 코드에서 한 번도 돌지 않는다.
    expect(scan.unschematized).toBeGreaterThan(0);
  });

  it('요청 본문을 받는 라우트는 본문 스키마를 광고한다', () => {
    const violations = scanRequestBodyAdvertised(routes).violations.map(
      (v) =>
        `${v.controller}.${v.handler}() — @Body() 설계 타입 ${v.designType} · @ApiBody 없음`,
    );
    expect(violations).toStrictEqual([]);
  });

  describe('[대조군] 판정 함수가 실제로 가른다', () => {
    interface InlineShape {
      a?: string;
    }

    class FixtureBodyDto {
      @ApiProperty()
      a!: string;
    }

    @Controller('fixture-body')
    class BodyFixtureController {
      /** 인라인 객체 타입 · 광고 없음 — 위반. */
      @Post('inline-bare')
      inlineBare(@Body() _body: { a?: string }): void {}

      /** 인라인 객체 타입 · 문서 전용 DTO 를 `@ApiBody` 로 — 맞다(선례 `ExecuteWorkflowDto`). */
      @Post('inline-documented')
      @ApiBody({ type: FixtureBodyDto })
      inlineDocumented(@Body() _body: { a?: string }): void {}

      /** DTO 클래스 — 플러그인이 스키마를 만든다. 맞다. */
      @Post('class')
      classBody(@Body() _body: FixtureBodyDto): void {}

      /** 인터페이스 — 런타임에 `Object` 다. AST 로는 클래스와 구별되지 않는 자리 — 위반. */
      @Post('interface')
      interfaceBody(@Body() _body: InlineShape): void {}

      /** `unknown` · 광고 없음 — 위반. */
      @Post('unknown')
      unknownBody(@Body() _body: unknown): void {}

      /** `unknown` · `@ApiBody({ schema: {} })` — 형태를 발신자가 정하는 본문. 맞다(웹훅 수신). */
      @Post('unknown-documented')
      @ApiBody({ schema: {} })
      unknownDocumented(@Body() _body: unknown): void {}

      /** 키 지정 본문의 원시 타입 — 설계 타입 `String`. 광고 없음 — 위반. */
      @Post('keyed')
      keyedBody(@Body('a') _a: string): void {}

      // 파이프 목록의 나머지 셋 — 목록에서 하나가 빠지면 그 타입이 여기서 사라져 RED 다.
      /** `number` — 설계 타입 `Number`. 위반. */
      @Post('number')
      numberBody(@Body() _body: number): void {}

      /** `boolean` — 설계 타입 `Boolean`. 위반. */
      @Post('boolean')
      booleanBody(@Body() _body: boolean): void {}

      /** 배열 — 설계 타입 `Array`. 위반. */
      @Post('array')
      arrayBody(@Body() _body: string[]): void {}

      /** OpenAPI 에서 빠진 라우트 — 묻지 않는다. */
      @Post('excluded')
      @ApiExcludeEndpoint()
      excludedBody(@Body() _body: { a?: string }): void {}

      /** 본문이 없는 라우트 — 세지 않는다. */
      @Get('no-body')
      noBody(): void {}
    }

    /**
     * 이름이 앞서는 두 번째 컨트롤러 — 위반 정렬의 1차 키(컨트롤러)가 실제로 순서를 가르는지 본다. 핸들러 이름은 일부러 뒤로 가게
     * 지었다: 컨트롤러로 정렬하면 맨 앞, 핸들러로만 정렬하면 맨 뒤다.
     */
    @Controller('fixture-body-alpha')
    class AlphaBodyFixtureController {
      @Post()
      zInline(@Body() _body: { a?: string }): void {}
    }

    @Controller('fixture-body-excluded')
    @ApiExcludeController()
    class ExcludedBodyFixtureController {
      /** 컨트롤러째 OpenAPI 에서 빠졌다 — 묻지 않는다. */
      @Post()
      bare(@Body() _body: { a?: string }): void {}
    }

    const scan = scanRequestBodyAdvertised(
      collectRouteHandlers([
        BodyFixtureController,
        AlphaBodyFixtureController,
        ExcludedBodyFixtureController,
      ]),
    );

    it('인라인 · 인터페이스 · `unknown` · 원시 타입 · 배열의 무광고를 잡는다 — 컨트롤러 → 핸들러 순', () => {
      expect(
        scan.violations.map(
          (v) => `${v.controller}.${v.handler}:${v.designType}`,
        ),
      ).toStrictEqual([
        'AlphaBodyFixtureController.zInline:Object',
        'BodyFixtureController.arrayBody:Array',
        'BodyFixtureController.booleanBody:Boolean',
        'BodyFixtureController.inlineBare:Object',
        'BodyFixtureController.interfaceBody:Object',
        'BodyFixtureController.keyedBody:String',
        'BodyFixtureController.numberBody:Number',
        'BodyFixtureController.unknownBody:Object',
      ]);
    });

    it('광고한 인라인 본문 · DTO 클래스 · 제외 라우트는 안 잡는다', () => {
      const handlers = scan.violations.map((v) => v.handler);
      for (const clean of [
        'inlineDocumented',
        'classBody',
        'unknownDocumented',
        'excludedBody',
        'bare',
      ]) {
        expect(handlers).not.toContain(clean);
      }
    });

    it('본문 자리를 센다 — 제외 라우트와 본문 없는 라우트는 세지 않는다', () => {
      // 대조한 자리: BodyFixture 10(inlineBare · inlineDocumented · classBody · interfaceBody · unknownBody · unknownDocumented ·
      // keyedBody · numberBody · booleanBody · arrayBody) + AlphaBodyFixture 1 = 11
      expect(scan.checked).toBe(11);
      // 그중 클래스가 아닌 자리: classBody 를 뺀 10
      expect(scan.unschematized).toBe(10);
    });

    it('설계 타입이 emit 되지 않은 자리도 비클래스로 센다 — 파이프가 `!metatype` 이면 건너뛰는 것과 같다', () => {
      // 실제 Nest 라우트에서는 생기지 않는다(데코레이터가 있으면 `design:paramtypes` 가 emit 된다). 가드가 파이프와 같은 축을 따른다는
      // 주장이 이 항까지 참인지 고정하려고, 데코레이터 없는 메서드에 라우트 메타데이터만 손으로 싣는다.
      class BareRouteController {
        noDesignType(_body: unknown): void {}
      }
      Reflect.defineMetadata(
        METHOD_METADATA,
        RequestMethod.POST,
        BareRouteController.prototype.noDesignType,
      );
      Reflect.defineMetadata(
        ROUTE_ARGS_METADATA,
        { [`${RouteParamtypes.BODY}:0`]: { index: 0 } },
        BareRouteController,
        'noDesignType',
      );
      const bare = scanRequestBodyAdvertised(
        collectRouteHandlers([BareRouteController]),
      );
      expect(bare.violations).toStrictEqual([
        {
          controller: 'BareRouteController',
          handler: 'noDesignType',
          designType: '(없음)',
        },
      ]);
      expect(bare.checked).toBe(1);
      expect(bare.unschematized).toBe(1);
    });
  });
});
