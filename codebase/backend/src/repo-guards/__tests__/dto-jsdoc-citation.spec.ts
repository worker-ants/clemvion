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
 * DTO **필드**의 JSDoc 은 `introspectComments` 로 **공개 OpenAPI `description`** 이 된다
 * (`swagger.md §3`). 그래서 `review-citations.md §3` 은 *"DTO 필드·컨트롤러의 JSDoc 은 (인용)
 * 대상이 아니다 — 소비자가 읽을 문장이 아니므로 애초에 거기 쓰지 않는다"* 고 적고,
 * 바로 위 `//` 주석을 회피처로 처방한다. **클래스** JSDoc 은 지금 플러그인이 싣지 않지만 같은
 * 절이 같은 규칙을 둔다 — 응답 DTO 파일의 `/** *\/` 를 공개 문서 채널 하나로 다룬다
 * (2026-09-27 규약 정정 — 그 전에는 «클래스 JSDoc 도 나간다» 는 틀린 근거로 같은 결론을 냈다).
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
 * (NERV `CLE-ENG-REVIEWCITE` 「인용 형식」 의 옛 산출물 세 형태 — 전체 경로 · 날짜+시각 ·
 * bare 시각 — 와 NERV 발견 인용 `finding <ID>`. 발견 인용은 전환 단계 4g 에서 더했다).
 * `//` 주석은 **보지 않는다** — 그것이 규약이 처방하는 회피처다.
 *
 * ## 베이스라인은 0 이다 (2026-09-27)
 *
 * 처음엔 두 자리를 동결했다 — `#1291` 이 넣은 `TriggerWorkflowRefDto` · `ScheduleTriggerWorkflowRefDto`
 * 의 클래스 JSDoc 인용이다(그때 checker 가 "필드 JSDoc" 만 봤다). `review-citations.md §3` 표가
 * 필드/클래스를 가르지 않는다는 선행 질문이 풀리면서(클래스도 쓰지 않는다) 두 인용을 바로 위
 * `//` 블록으로 옮겼다. 목록 상수와 «정확히 일치» 단언은 남긴다 — 새 인용이 생기면 목록에 없어
 * 실패하고, 예외를 두려면 이 목록에 이름으로 올려야 한다.
 */
const EXPECTED_DTO_JSDOC_CITATIONS: readonly string[] = [];

/** 양성/음성 대조군 fixture — 스캔 범위(`src/modules`) 밖에 둔다. */
const CITATION_FIXTURE = path.join(
  __dirname,
  'fixtures',
  'dto',
  'responses',
  'jsdoc-citation.fixture.ts',
);

describe('응답 DTO JSDoc 리뷰 인용 래칫', () => {
  const found = findDtoJsDocCitations(
    collectTsFiles(path.join(SRC_ROOT, 'modules')),
    SRC_ROOT,
  );

  it('알려진 목록과 정확히 일치한다 (새로 생겨도, 남몰래 줄어도 실패)', () => {
    expect(found.map((c) => c.key)).toEqual([...EXPECTED_DTO_JSDOC_CITATIONS]);
  });

  it('[대조군] fixture 의 위반을 전부 잡고 준수는 놓아 준다', () => {
    const hits = findDtoJsDocCitations([CITATION_FIXTURE], SRC_ROOT);
    const owners = hits.map((h) => h.owner).sort();

    // 양성 — 클래스 JSDoc · 필드 JSDoc · bare 시각 · 날짜+시각 · NERV 발견 인용.
    expect(owners).toEqual([
      'ViolationBareTimeNoBacktickDto.id',
      'ViolationClassCitationDto',
      'ViolationFieldCitationDto.avatarUrl',
      'ViolationFieldCitationDto.email',
      'ViolationFieldCitationDto.name',
      'ViolationNervFindingDto.id',
    ]);

    // 음성 — 인용 없음 · `//` 주석(클래스/필드 양쪽).
    expect(owners).not.toContain('CompliantPlainDto');
    expect(owners).not.toContain('CompliantLineCommentDto');
    expect(owners).not.toContain('CompliantLineCommentDto.id');
  });

  /**
   * **선언한 세 형태가 각각 관측되어야 한다.**
   *
   * 첫 판은 "세 형태를 센다" 고 적어 놓고 **둘만** fixture 에 넣었다 — 날짜+시각 정규식을
   * 통째로 지워도 스위트가 초록이었다 (`review/code/2026/09/06/12_53_28` W1, 리뷰어가
   * 직접 뮤테이션). 한 라운드 전 eager 축에서 겪은 것과 **같은 형태**의 실수다.
   *
   * 그래서 목록 비교로 끝내지 않고, **어떤 텍스트가 매치됐는지**를 형태별로 문다.
   */
  it('네 인용 형태가 각각 최소 한 번씩 관측된다', () => {
    const cited = findDtoJsDocCitations([CITATION_FIXTURE], SRC_ROOT).flatMap(
      (h) => h.citations,
    );

    // 전체 경로 · bare 시각 · 날짜+시각 · NERV 발견 인용.
    expect(cited.some((c) => c.startsWith('review/'))).toBe(true);
    // bare 축은 백틱을 요구하지 않으므로 매치 텍스트에도 백틱이 없다.
    expect(cited.some((c) => /^\d{2}_\d{2}_\d{2}$/.test(c))).toBe(true);
    expect(cited.some((c) => /^\d{4}-\d{2}-\d{2}\s/.test(c))).toBe(true);
    // 전체 ID 를 통째로 잡아 실패 메시지가 지울 대상을 그대로 보여 준다.
    expect(cited).toContain('finding 00000000-0000-7000-8000-000000000000');
  });

  it('[전제] fixture 스캔이 비어 있지 않다 — 0건이면 위 단언이 조용히 통과한다', () => {
    expect(
      findDtoJsDocCitations([CITATION_FIXTURE], SRC_ROOT).length,
    ).toBeGreaterThan(0);
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
