import { describe, it, expect } from '@jest/globals';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  FIXTURE_ROOT,
  SRC_ROOT,
  findOpenApiInternalRefs,
  isOpenApiSourceFile,
} from './openapi-internal-ref-guard';

/**
 * 공개 OpenAPI 문서에 **저장소 내부 참조**(스펙 경로 · 옛 스펙 파일 이름 · NERV 스펙 키 ·
 * 요구사항 ID · 옛 요구사항 ID · 옛 plan 경로)가 실리지 않게 막는다.
 *
 * ## 왜
 *
 * swagger CLI 플러그인(`nest-cli.json` 의 `introspectComments: true`)은 `*.dto.ts` 속성의
 * JSDoc 을 필드 `description` 으로, `*.controller.ts` 메서드의 JSDoc 을 operation 설명으로
 * 싣는다. 데코레이터의 `description` · `summary` 문자열도 그대로 나간다. 외부 소비자는
 * 저장소 경로도 NERV 키도 열어 볼 수 없다. 옛 스펙 트리는 NERV 정본 전환 마지막 단계에서
 * 지우므로 경로는 곧 죽은 문자열이 된다. 그래서 공개 문장에는 사실만 남기고, 근거는 바로 위
 * `//` 주석에 키 링크로 적는다(`//` 는 플러그인이 싣지 않는다).
 *
 * 두 파일 종류의 `/** *\/` 는 클래스 JSDoc 처럼 플러그인이 싣지 않는 자리까지 한 채널로 센다.
 * 쓰는 사람이 플러그인 동작을 보고 자리마다 판단하지 않게 하려는 것이다. 리뷰 인용 규약이 응답
 * DTO 파일의 `/** *\/` 를 한 채널로 본 것과 같은 이유다.
 *
 * 전환 단계 4c(NERV Task `CLE-T-9AM31N`)에서 91곳(50파일)을 걷어 내고 이 가드를 세웠다.
 * 응답 DTO JSDoc 의 리뷰 인용은 형제 가드 `dto-jsdoc-citation` 이 본다. 경로 없는 절 번호
 * 인용(`[Spec EIA §4]`)은 모양이 일정하지 않아 보지 않는다(정리는 NERV Task `CLE-T-BCS6QZ`).
 *
 * ## 베이스라인은 0 이다
 *
 * 예외를 둘 자리가 없다. 공개 문장에서 내부 참조를 빼는 것은 언제나 가능하다.
 */
const FIXTURE_DTO = path.join(
  FIXTURE_ROOT,
  'openapi-internal-ref',
  'sample.dto.ts',
);
const FIXTURE_CONTROLLER = path.join(
  FIXTURE_ROOT,
  'openapi-internal-ref',
  'sample.controller.ts',
);

describe('공개 OpenAPI 문장의 내부 참조', () => {
  it('[대조군] 공개 채널의 내부 참조만 잡고 회피처 · 비공개 자리 · 낱말은 넘긴다', () => {
    // 가드가 내는 순서(owner 사전순)는 계약이 아니다. 양쪽을 같은 방식으로 정렬해 집합으로 비교한다.
    // 매치 목록도 정렬해 비교한다. 형태 사이 순서가 아니라 어떤 형태가 잡혔는지를 본다.
    const found = findOpenApiInternalRefs(
      [FIXTURE_DTO, FIXTURE_CONTROLLER],
      FIXTURE_ROOT,
    )
      .map((r) => `${r.owner} ${r.channel} ${[...r.matches].sort().join(',')}`)
      .sort();

    const expected = [
      'INTERNAL_REF_FIXTURE_VALUES jsdoc spec/5',
      'InternalRefFixtureClassDocDto jsdoc CLE-API-CONV',
      'InternalRefFixtureController.decorated.summary summary CLE-API-CONV',
      'InternalRefFixtureController.list jsdoc spec/5',
      'InternalRefFixtureDto.withDecoratorDescription.description description CLE-API-CONV',
      'InternalRefFixtureDto.withKey jsdoc CLE-API-CONV',
      'InternalRefFixtureDto.withOldFile jsdoc 15-chat-channel.md',
      'InternalRefFixtureDto.withOldReq jsdoc WH-SC-01',
      'InternalRefFixtureDto.withPlan jsdoc plan/in-progress/',
      'InternalRefFixtureDto.withReq jsdoc REQ-GUIDE-032',
      'InternalRefFixtureDto.withSpecPath jsdoc spec/5',
      // 한 JSDoc 에 형태 둘 — 첫 형태에서 멈추면 하나만 잡힌다.
      'InternalRefFixtureDto.withTwoForms jsdoc CLE-API-CONV,spec/5',
      'internalRefFixtureMeta.description description CLE-API-SWAGGER',
      'internalRefFixtureMeta.summary summary spec/5',
      // 템플릿 리터럴(치환 포함) · 괄호로 묶은 연결 문자열.
      'internalRefFixtureParenthesized.description description WH-SC-01',
      'internalRefFixtureTemplateHead.summary summary spec/5',
      'internalRefFixtureTemplateTail.description description CLE-API-CONV',
    ].sort();

    expect(found).toEqual(expected);
  });

  it('공개 채널 파일은 `*.dto.ts` 와 `*.controller.ts` 다', () => {
    expect(isOpenApiSourceFile('/x/a.dto.ts')).toBe(true);
    expect(isOpenApiSourceFile('/x/a.controller.ts')).toBe(true);
    expect(isOpenApiSourceFile('/x/a.dto.spec.ts')).toBe(false);
    expect(isOpenApiSourceFile('/x/a.service.ts')).toBe(false);
  });

  it('프로덕션 DTO · 컨트롤러의 공개 문장에 내부 참조가 없다', () => {
    const files = collectTsFiles(SRC_ROOT).filter(
      (f) => isOpenApiSourceFile(f) && !f.startsWith(FIXTURE_ROOT + path.sep),
    );
    // 스캔이 비면 아래 단언이 공허하다.
    expect(files.length).toBeGreaterThan(100);

    const found = findOpenApiInternalRefs(files, SRC_ROOT);
    expect(
      found.map(
        (r) =>
          `${r.file}:${r.line} ${r.owner} [${r.channel}] ${r.matches.join(', ')}`,
      ),
    ).toEqual([]);
  });
});
