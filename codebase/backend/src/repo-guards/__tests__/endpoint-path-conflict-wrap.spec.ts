import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  CONFLICT_WRAPPER,
  SRC_ROOT,
  findTriggerRepositorySaves,
  findUnwrappedTriggerSaves,
} from './endpoint-path-conflict-wrap-guard';

/**
 * **`endpointPath` 를 쓰는 다음 `save()` 가 충돌 래핑을 빠뜨려도 아무도 알려 주지 않는다.**
 *
 * `TriggersService` 의 `triggerRepository.save()` 는 여러 곳인데
 * `rethrowEndpointPathConflict` 로 감싼 것은 `create`/`update` 둘뿐이다. 나머지는
 * `endpointPath` 를 건드리지 않으므로 **지금은 옳다.** 남는 것은 비대칭이다 — 앞으로
 * `endpointPath` 를 쓰는 `save()` 가 새로 생기면 그 경로만 미가공 500 이 되고, 그 사실을
 * 문서 말고는 아무것도 들고 있지 않았다 (`review/code/2026/09/06/19_31_04` INFO#2).
 *
 * ## 왜 *"`endpointPath` 를 쓰는 save"* 로 좁히지 않았나 — 그 술어는 **비어 있다**
 *
 * 처음 등재된 처방은 *"`endpointPath` 를 대입·갱신하는 메서드의 `save()` 는 래핑돼야 한다"*
 * 였다. 착수해서 실측하니 **그 술어는 두 정답 사이트를 하나도 못 잡는다**:
 *
 * - `create` 는 `this.triggerRepository.create({ ...rest, … })` — `endpointPath` 가
 *   **스프레드로** 들어간다.
 * - `update` 는 `Object.assign(trigger, defined, …)` — 역시 스프레드다.
 *
 * 두 메서드 본문 어디에도 `endpointPath` 토큰이 없다(2026-09-08 실측: 그 파일의
 * `endpointPath` 출현은 전부 검증·URL 조립·조회 경로다). 단일 파일 AST 로는 스프레드가
 * 무엇을 나르는지 따라갈 수 없으므로, 그 술어로 만든 가드는 **양성 0건짜리 vacuous 가드**가
 * 된다 — 이 저장소가 반복해 겪은 형태다.
 *
 * ## 그래서 술어를 뒤집었다
 *
 * *"어느 save 가 endpointPath 를 건드리나"* 를 추측하지 않고, **모든**
 * `triggerRepository.save()` 를 세어 **래핑됐거나, 이유와 함께 목록에 있거나** 를 요구한다.
 * 새 `save()` 가 생기면 그 자리에서 실패하고, 작성자는 래핑하거나 목록에 사유를 적어야 한다.
 * 비대칭을 문서가 아니라 **테스트가** 들고 있게 되는 것이 이 항목의 실질이다.
 */
const TRIGGERS_DIR = path.join(SRC_ROOT, 'modules', 'triggers');

/**
 * 래핑 없이 저장하는 자리 — **전부 `endpointPath` 를 건드리지 않는다.**
 *
 * 새 항목을 여기 추가하려면 *"이 저장 경로는 `endpointPath` 를 바꾸지 않는다"* 가 참이어야
 * 한다. 참이 아니면 목록이 아니라 `.catch(… ${CONFLICT_WRAPPER} …)` 가 답이다.
 */
const EXPECTED_UNWRAPPED_TRIGGER_SAVES: readonly string[] = [
  // notification secret ref 정규화 — `trigger.config` 의 `notification` 하위만 쓴다.
  'modules/triggers/triggers.service.ts#normalizeNotificationSecretRef',
  // notification secret 회전 — `notificationSecretV2`·`notificationRotatedAt` 컬럼만 쓴다.
  'modules/triggers/triggers.service.ts#rotateNotificationSecret',
  // per-trigger interaction 토큰 폐기 — `trigger.config` 의 `interaction` 하위만 쓴다.
  'modules/triggers/triggers.service.ts#revokePerTriggerToken',
  // grace 만료 승격 스윕 — 같은 메서드가 두 분기에서 저장한다(`#2`). 둘 다
  // `notificationSecretV2`·`notificationRotatedAt`(+`config`) 만 쓴다.
  'modules/triggers/triggers.service.ts#promoteRotatedNotificationSecrets',
  'modules/triggers/triggers.service.ts#promoteRotatedNotificationSecrets#2',
  // chatChannel 회전 grace 정리 — `chatChannelTokenV2`·`chatChannelRotatedAt` 만 쓴다.
  'modules/triggers/triggers.service.ts#cleanupRotatedChatChannelTokens',
];

/** 충돌 래핑을 갖춘 자리 — `endpointPath` 가 스프레드로 실려 오는 두 경로. */
const EXPECTED_WRAPPED_TRIGGER_SAVES: readonly string[] = [
  'modules/triggers/triggers.service.ts#create',
  'modules/triggers/triggers.service.ts#update',
];

describe('`endpoint_path` 충돌 래핑 래칫', () => {
  const files = collectTsFiles(TRIGGERS_DIR);
  const sites = findTriggerRepositorySaves(files, SRC_ROOT);

  it('[전제] 스캔이 비어 있지 않다 — 0건이면 아래 단언이 조용히 통과한다', () => {
    expect(sites.length).toBeGreaterThan(0);
    expect(files.some((f) => f.endsWith('triggers.service.ts'))).toBe(true);
  });

  it('래핑된 자리가 알려진 목록과 정확히 일치한다 (남몰래 줄어도 실패)', () => {
    expect(
      sites
        .filter((s) => s.wrapped)
        .map((s) => s.key)
        .sort(),
    ).toEqual([...EXPECTED_WRAPPED_TRIGGER_SAVES].sort());
  });

  it('래핑 없는 자리가 알려진 목록과 정확히 일치한다 (새로 생기면 실패)', () => {
    // **이것이 이 가드의 요점이다.** 새 `save()` 가 생기면 여기서 멈춘다 — 작성자는
    // 래핑하거나, 위 목록에 "이 경로는 endpointPath 를 안 바꾼다" 는 사유와 함께 올려야 한다.
    expect(findUnwrappedTriggerSaves(files, SRC_ROOT).sort()).toEqual(
      [...EXPECTED_UNWRAPPED_TRIGGER_SAVES].sort(),
    );
  });

  describe('[대조군] fixture 로 술어를 양쪽에서 확인한다', () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'endpoint-path-save.fixture.ts',
    );
    const found = findTriggerRepositorySaves([fixture], __dirname);
    const unwrapped = found
      .filter((s) => !s.wrapped)
      .map((s) => s.key.split('#').slice(1).join('#'));

    it('래핑 없는 save 를 잡는다 (같은 메서드 두 번째는 `#2` 로 갈린다)', () => {
      expect(unwrapped.sort()).toEqual(
        [
          'catchButNotWrapping',
          'mentionsButDoesNotCall',
          'twoSaves',
          'twoSaves#2',
          'unwrappedSave',
        ].sort(),
      );
    });

    it('래핑된 save 와 다른 리포지토리는 놓아 준다', () => {
      expect(found.filter((s) => s.wrapped).map((s) => s.method)).toEqual([
        'wrappedSave',
      ]);
      // `scheduleRepository.save` 는 애초에 스캔되지 않는다 — 목록 어디에도 없어야 한다.
      expect(found.map((s) => s.method)).not.toContain('otherRepositorySave');
    });

    it(`\`.catch\` 가 있어도 \`${CONFLICT_WRAPPER}\` 를 안 부르면 미래핑이다`, () => {
      // 술어가 "`.catch` 체인이 있는가" 로 넓어지는 것을 막는 대조군.
      expect(unwrapped).toContain('catchButNotWrapping');
    });

    it('이름만 등장하고 호출하지 않으면 미래핑이다 (fail-open 방지)', () => {
      // 첫 판은 `.catch` **전체 텍스트**에 이름이 있는지만 봐서 이 형태를 통과시켰다
      // (`review/code/2026/09/08/12_53_08` INFO#6). 지금은 **호출식**을 요구한다.
      expect(unwrapped).toContain('mentionsButDoesNotCall');
    });
  });
});
