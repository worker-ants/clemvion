/**
 * `dto-jsdoc-citation-guard` 의 **양성/음성 대조군**.
 *
 * 경로가 `dto/responses/` 를 포함해야 `isResponseDtoFile` 이 통과한다 — 그래서 형제
 * fixture 와 달리 이 파일만 두 단계 더 들어가 있다 (`optional-nullable.fixture.ts` 가
 * 같은 이유로 같은 자리에 있다).
 *
 * 프로덕션 스캔은 `src/modules` 만 훑으므로 이 파일은 베이스라인을 오염시키지 않는다.
 */

/**
 * 위반 1 — **클래스 JSDoc** 에 전체 경로 인용.
 * (`review/code/2026/09/06/12_28_02` W2)
 */
export class ViolationClassCitationDto {
  /** 정상 — 소비자가 읽을 문장만. */
  id: string;
}

/** 정상 — 클래스 설명에 인용이 없다. */
export class ViolationFieldCitationDto {
  /**
   * 위반 2 — **필드 JSDoc** 에 전체 경로 인용.
   * (`review/consistency/2026/09/06/11_55_37` W3)
   */
  name: string;

  /**
   * 위반 3 — **bare 시각**. 규약이 금지하는 형태라고 해서 가드가 안 봐도 되는 것은
   * 아니다 — 오히려 JSDoc 에 남을 확률이 그쪽이 높다. (`12_28_02` W2)
   */
  email: string;

  /**
   * 위반 4 — **날짜+시각** 형태. `review-citations.md §2` 가 "허용" 으로 분류한 형태지만
   * §3 은 **DTO JSDoc 자체를 대상에서 뺀다** — 형태가 허용이어도 이 자리에 있으면 안 된다.
   *
   * 이 케이스가 없을 때 해당 정규식을 통째로 지워도 스위트가 초록이었다
   * (`review/code/2026/09/06/12_53_28` W1 — 리뷰어가 직접 뮤테이션). 가드가 스스로
   * "세 형태" 라고 선언했으면 셋 다 관측되어야 한다.
   * 2026-09-05 23_30_01 W1
   */
  avatarUrl: string;
}

// 위반 5 — **백틱 없는 bare 시각.** 가드는 "세 형태를 센다" 고 적어 놓고 bare 축만
// 백틱 두른 형태를 요구하고 있었다 — 백틱 없이 쓴 인용은 통째로 빠졌다
// (review/code/2026/09/06/16_58_14 W4, 리뷰어가 무수정 프로브로 재현).
//
// JSDoc 에 남을 확률이 높은 쪽이 오히려 이 형태다 — 백틱은 마크다운 습관이고 주석에
// 급히 적을 땐 안 붙는다.
//
// **설명을 `//` 에 둔 것도 의도다**: 클래스 JSDoc 에 인용을 적으면 그 자리도 위반이 돼
// 이 fixture 가 두 가지를 동시에 시험하게 된다. 여기서 물으려는 것은 **필드** 축이다.
export class ViolationBareTimeNoBacktickDto {
  /** 근거: 12_28_02 W2 — 백틱 없이 적었다. */
  id: string;
}

/** 정상 — 인용이 아예 없다. */
export class CompliantPlainDto {
  /** 워크플로우 이름. */
  name: string;
}

/**
 * 정상 — 내부 서사가 **`//`** 에 있다. 이것이 규약이 처방하는 회피처다.
 */
// 왜 이 형태인가 — `review/code/2026/09/06/12_28_02` W2 가 세운 가드가
// `//` 는 보지 않는다. JSDoc 만 공개 description 이 되기 때문이다.
export class CompliantLineCommentDto {
  /** 워크플로우 UUID. */
  // 근거: `review/consistency/2026/09/06/11_55_37` W3.
  id: string;
}
