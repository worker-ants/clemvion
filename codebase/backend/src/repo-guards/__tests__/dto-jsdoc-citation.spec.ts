import { describe, it, expect } from '@jest/globals';
import * as path from 'node:path';

import { collectTsFiles } from '../../common/__test-utils__/source-scan';
import {
  SRC_ROOT,
  findDtoJsDocCitations,
  isResponseDtoFile,
} from './dto-jsdoc-citation-guard';

/**
 * 응답 DTO 의 `/** *\/` JSDoc 에 **리뷰 인용이 들어가지 않게** 조인다.
 *
 * ## 왜 이 가드인가 — 같은 위반이 세 번 났다
 *
 * DTO 의 JSDoc 은 `introspectComments` 로 **공개 OpenAPI `description`** 이 된다
 * (`swagger.md §3`). 그래서 `review-citations.md §3` 은 *"DTO·컨트롤러의 JSDoc 은 (인용)
 * 대상이 아니다 — 소비자가 읽을 문장이 아니므로 애초에 거기 쓰지 않는다"* 고 적고,
 * 바로 위 `//` 주석을 회피처로 처방한다.
 *
 * 그런데 이 브랜치 계열에서 같은 위반이 **세 번** 났다:
 *
 * | # | 자리 | 잡은 것 |
 * |---|---|---|
 * | 1 | `ScheduleDto.trigger` 필드 JSDoc | `review/consistency/2026/09/05/21_40_38` |
 * | 2 | `ScheduleTriggerRefDto.workflow` 필드 JSDoc | `review/consistency/2026/09/05/23_30_01` W1 |
 * | 3 | `WorkspaceMemberDto.joinedAt` 필드 JSDoc | `review/consistency/2026/09/06/11_55_37` W3 |
 *
 * 세 번 다 **사람이 읽고 잡았고, 매번 수작업 `//` 회피로만 처리**됐다
 * (`review/code/2026/09/06/12_28_02` W2 — *"자동 회귀 가드가 없다"*). 규약이 정한 형태는
 * 결정 가능하므로 세는 편이 낫다.
 *
 * ## 무엇을 세는가
 *
 * `dto/responses/**` 파일의 **클래스·프로퍼티 JSDoc** 안에 있는 리뷰 인용
 * (`review-citations.md §2` 의 세 형태 — 전체 경로 · 날짜+시각 · bare 시각).
 * `//` 주석은 **보지 않는다** — 그것이 규약이 처방하는 회피처다.
 *
 * ## 베이스라인이 0이 아니다
 *
 * 두 자리가 이미 있고 **이 브랜치가 만든 것이 아니다** — 둘 다 `#1291` 이 넣었고 그 PR 의
 * 게이트를 통과했다(그때도 checker 가 "필드 JSDoc" 만 봤다). `review-citations.md §4`
 * (*"기존 인용은 소급 정리 대상이 아니다 — 그 자리를 다음에 건드릴 때 함께 맞춘다"*)에
 * 따라 지우지 않고 **동결**한다. 새로 생기면 목록에 없어 실패하고, 갚아서 없애면 목록에서
 * 빼야 통과한다.
 *
 * > 이 두 자리의 처분과 **`§3` 표가 필드/클래스를 안 가른다**는 선행 질문은
 * > `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 등재돼 있다.
 */
const EXPECTED_DTO_JSDOC_CITATIONS: readonly string[] = [
  'modules/schedules/dto/responses/schedule-response.dto.ts#ScheduleTriggerWorkflowRefDto',
  'modules/triggers/dto/responses/trigger-response.dto.ts#TriggerWorkflowRefDto',
];

describe('응답 DTO JSDoc 리뷰 인용 래칫', () => {
  const found = findDtoJsDocCitations(
    collectTsFiles(path.join(SRC_ROOT, 'modules')),
    SRC_ROOT,
  );

  it('알려진 목록과 정확히 일치한다 (새로 생겨도, 남몰래 줄어도 실패)', () => {
    expect(found.map((c) => c.key)).toEqual([...EXPECTED_DTO_JSDOC_CITATIONS]);
  });

  it('[대조군] 위반 3형태를 잡고 준수 3형태는 놓아 준다', () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'dto',
      'responses',
      'jsdoc-citation.fixture.ts',
    );
    const hits = findDtoJsDocCitations([fixture], SRC_ROOT);
    const owners = hits.map((h) => h.owner).sort();

    // 양성 — 클래스 JSDoc · 필드 JSDoc · bare 시각.
    expect(owners).toEqual([
      'ViolationClassCitationDto',
      'ViolationFieldCitationDto.email',
      'ViolationFieldCitationDto.name',
    ]);

    // 음성 — 인용 없음 · `//` 주석(클래스/필드 양쪽).
    expect(owners).not.toContain('CompliantPlainDto');
    expect(owners).not.toContain('CompliantLineCommentDto');
    expect(owners).not.toContain('CompliantLineCommentDto.id');
  });

  it('[전제] fixture 스캔이 비어 있지 않다 — 0건이면 위 단언이 조용히 통과한다', () => {
    const fixture = path.join(
      __dirname,
      'fixtures',
      'dto',
      'responses',
      'jsdoc-citation.fixture.ts',
    );
    expect(findDtoJsDocCitations([fixture], SRC_ROOT).length).toBeGreaterThan(
      0,
    );
  });

  it('`dto/responses/` 밖 파일은 대상이 아니다', () => {
    expect(isResponseDtoFile('/x/src/modules/a/dto/update-a.dto.ts')).toBe(
      false,
    );
    expect(isResponseDtoFile('/x/src/modules/a/a.service.ts')).toBe(false);
    expect(
      isResponseDtoFile('/x/src/modules/a/dto/responses/a-response.dto.ts'),
    ).toBe(true);
  });
});
