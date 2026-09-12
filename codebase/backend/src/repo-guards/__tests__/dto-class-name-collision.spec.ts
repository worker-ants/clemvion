import { describe, it, expect } from '@jest/globals';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  exportedClassNames,
  findDtoClassCollisions,
} from './dto-class-name-collision-guard';

/**
 * `*.dto.ts` 의 `export class` 이름이 **저장소 안에서 유일한지** 조인다.
 *
 * ## 왜 이 가드인가 — 이 브랜치가 그 사고를 냈다
 *
 * `@nestjs/swagger` 는 스키마를 **클래스 `.name` 문자열**로 `components.schemas` 에 등록한다.
 * 이름이 같은 두 클래스가 스캔 경로에 있으면 **한쪽이 다른 쪽을 덮어쓴다** — 어느 쪽이 남는지는
 * 스캔 순서에 달렸고, 남지 못한 엔드포인트의 OpenAPI 문서는 **실제 응답과 다른 형태**를 광고한다.
 * 컴파일은 통과한다(서로 다른 모듈의 서로 다른 클래스이므로). 즉 **타입이 안 잡는 결함**이다.
 *
 * 2026-09-12 `chat-channel-rules-cleanup` 이 정확히 그것을 했다 — 신규 응답 DTO 안에
 * `ChatChannelBotIdentityDto` 를 선언했는데 `dto/chat-channel-config.dto.ts` 에 **동명 클래스**가
 * 이미 있었다(필드 필수 여부·`teamId` 유무가 다른 별개 타입). 두 reviewer 가 독립적으로
 * CRITICAL 로 잡았고, 해소 확인은 **1회성 grep 스크립트**로 했다 — 커밋되지 않으니 다음 사람은
 * 같은 실수를 같은 방식으로 다시 발견해야 한다.
 *
 * **사전 게이트가 이걸 못 본 이유도 기록해 둔다**: `--impl-prep` 의 naming-collision checker 는
 * **plan 이 예고한 식별자**만 grep 한다(그 턴에는 헬퍼 2종). 구현 중에 태어난 이름은 원리적으로
 * 그 검사 밖이다. 사후 리뷰가 잡았지만, 결정 가능한 형태이므로 세는 편이 낫다.
 *
 * ## 무엇을 세는가
 *
 * `src/**` 의 `*.dto.ts` 파일에서 **최상위 `export class`** 이름. 정규식이 아니라 **AST** 로
 * 읽는다 — 주석·문자열 안의 `export class` 를 세면 가드가 자기 오탐으로 죽는다.
 *
 * ## 베이스라인은 0이다 — 동결 목록을 두지 않는다
 *
 * 형제 가드(`dto-jsdoc-citation`)는 기존 위반 2건을 동결 목록으로 안고 간다. 여기는 **실측
 * 0건**이라(256개 클래스 전수) 목록 없이 *"중복은 0"* 을 그대로 단언한다. 목록이 없으면
 * 위반이 생기는 순간 실패하고, 누가 고의로 통과시키려면 이 단언 자체를 지워야 해 diff 에 남는다.
 */
describe('DTO 클래스명 충돌 가드', () => {
  const SRC_ROOT = path.resolve(__dirname, '..', '..');
  // **`src` 전체가 아니라 프로덕션 DTO 가 사는 두 디렉터리만 본다.** 첫 판본은 `src` 를 통째로
  // 훑어 **이 파일의 대조군 fixture 를 자기가 잡고** 죽었다 — 형제 가드가 *"fixture 는 스캔
  // 범위 밖에 둔다"* 고 적어 둔 이유를 몸으로 확인한 셈이다. 실측: `*.dto.ts` 114개가
  // `modules/`(111) 와 `common/`(3) 에만 있다.
  const SCAN_ROOTS = ['modules', 'common'].map((d) => path.join(SRC_ROOT, d));
  const files = SCAN_ROOTS.flatMap((root) => collectTsFiles(root));

  it('스캔 대상이 비어 있지 않다 (vacuous 방지)', () => {
    // 경로가 어긋나 0개를 스캔하면 아래 단언이 **아무것도 검사하지 않고** 통과한다.
    const dtoFiles = files.filter((f) => f.endsWith('.dto.ts'));
    expect(dtoFiles.length).toBeGreaterThan(100);
  });

  it('`*.dto.ts` 의 export class 이름은 저장소 안에서 유일하다', () => {
    // **실패 메시지를 값에 싣는다.** jest 의 `expect` 는 두 번째 인자를 받지 않으므로
    // (vitest 와 다르다 — 첫 판본이 그 형태로 죽었다), 무엇을 고쳐야 하는지는 비교 대상
    // 자체가 말하게 한다. 빈 배열과 대조하면 diff 가 그대로 진단이 된다.
    const collisions = findDtoClassCollisions(files, SRC_ROOT).map(
      (c) =>
        `${c.name} — @nestjs/swagger 가 서로를 덮어쓴다: ${c.files.join(' · ')}`,
    );
    expect(collisions).toEqual([]);
  });

  /**
   * **대조군** — 가드가 실제로 중복을 본다는 증거.
   *
   * 이게 없으면 위 단언은 "중복이 0이라서" 통과하는지 "아무것도 안 세서" 통과하는지 구별되지
   * 않는다. 실데이터를 건드리지 않고 판정 함수에 직접 먹인다.
   */
  it('[대조군] 같은 이름이 두 파일에 있으면 잡는다', () => {
    const fixtureDir = path.join(__dirname, 'fixtures', 'dto-class-collision');
    const fixtures = collectTsFiles(fixtureDir);
    const collisions = findDtoClassCollisions(fixtures, fixtureDir);
    expect(collisions.map((c) => c.name)).toEqual(['DuplicatedFixtureDto']);
    expect(collisions[0].files).toHaveLength(2);
  });

  it('[대조군] AST 로 읽는다 — 주석·문자열 속 `export class` 는 안 센다', () => {
    const decoy = path.join(
      __dirname,
      'fixtures',
      'dto-class-collision',
      'decoy.dto.ts',
    );
    expect(exportedClassNames(decoy)).toEqual(['RealDecoyDto']);
  });
});
