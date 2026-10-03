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
   * 위반 4 — **날짜+시각** 형태. `CLE-ENG-REVIEWCITE` 「인용 형식」 이 "허용" 으로 분류한
   * 형태지만 규칙 6 은 **응답 DTO JSDoc 자체를 대상에서 뺀다** — 형태가 허용이어도 이 자리에
   * 있으면 안 된다.
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

// 위반 6 — **NERV 발견 인용**(`CLE-ENG-REVIEWCITE` 규칙 9 형식). 형식이 맞아도 응답 DTO 의
// `/** */` 에는 쓰지 않는다(규칙 6). 전환 단계 2 뒤의 리뷰는 이 형식만 남기므로 옛 경로 세
// 형태만 세면 새 인용이 통째로 빠진다.
export class ViolationNervFindingDto {
  /** 근거: finding 00000000-0000-7000-8000-000000000000 */
  id: string;
}

// 위반 7 — **줄인 NERV 발견 ID**(앞 8자). 규칙 9 가 금지하는 형태지만 응답 DTO 에서는 형태와
// 무관하게 인용을 막는다. 이 케이스가 없으면 UUID 꼬리를 선택이 아니라 필수로 바꾼 정규식도
// 스위트를 통과한다. 프런트 docs 가드 `review-citation-form` 은 이 파일을 대조군으로 허용한다.
export class ViolationNervShortFindingDto {
  /** 근거: finding 01a10005 */
  id: string;
}

/** 정상 — 인용이 아예 없다. */
export class CompliantPlainDto {
  /** 워크플로우 이름. */
  name: string;
}

/**
 * 정상 — `finding` 이라는 낱말과 16진 숫자열이 있지만 발견 ID 가 아니다. 8자에서 끊기지 않는
 * 숫자열(9자 · 10자)을 잡으면 끝 경계(`\b`)가 빠진 것이다.
 */
export class CompliantFindingWordDto {
  /** 검색 결과 코드. 예: finding 01a100059, finding 0123456789. */
  code: string;
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
