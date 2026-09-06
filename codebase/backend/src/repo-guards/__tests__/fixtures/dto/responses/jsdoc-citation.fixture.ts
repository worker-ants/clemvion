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
