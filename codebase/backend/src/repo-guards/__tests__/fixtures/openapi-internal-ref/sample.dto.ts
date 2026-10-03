// 대조군 fixture — `openapi-internal-ref` 가드가 가르는 자리를 한 파일에 모은다.
// 근거를 적는 `//` 주석에는 CLE-API-CONV 같은 키가 있어도 된다.
// 프로덕션 스캔은 `repo-guards/__tests__/fixtures/` 를 뺀다. `@Api*` 데코레이터를 달지 않아
// `src/` 전체를 훑는 다른 가드(swagger DTO 계약 등)가 찾는 패턴은 여기 없다.

/** `description` 을 받는 속성 데코레이터 대조군. 이름이 `@Api*` 가 아니라 다른 가드에 걸리지 않는다. */
const Published =
  (_options: { description: string }): PropertyDecorator =>
  () =>
    undefined;

export class InternalRefFixtureDto {
  /** 정상 필드. 저장소 내부 문서를 말하지 않는다. */
  plain!: string;

  /** 경로를 적었다 (spec/5-system/demo). */
  withSpecPath!: string;

  /** 키를 적었다: CLE-API-CONV 참고. */
  withKey!: string;

  /** 요구사항 REQ-GUIDE-032 를 적었다. */
  withReq!: string;

  /** 옛 작업 문서 plan/in-progress/demo 를 적었다. */
  withPlan!: string;

  /** 옛 스펙 파일 이름만 적었다 [Spec §4.1 / 15-chat-channel.md]. */
  withOldFile!: string;

  /** 옛 요구사항 ID WH-SC-01 을 적었다. */
  withOldReq!: string;

  /** 한 JSDoc 에 형태 둘을 적었다 (CLE-API-CONV · spec/5-system/demo). 형태마다 첫 매치를 하나씩 모은다. */
  withTwoForms!: string;

  /** JSDoc 은 정상이다. 속성 데코레이터의 `description` 에 적은 참조는 공개 문장이다. */
  @Published({ description: '데코레이터 인자에 키를 적었다(CLE-API-CONV).' })
  withDecoratorDescription!: string;

  /** SHA-256 · ISO-8601 · UTF-8 · HMAC-SHA-256 · AES-GCM-256 은 요구사항 ID 가 아니다. */
  standardsOk!: string;

  /* 블록 주석은 JSDoc 이 아니다 — CLE-API-CONV. */
  blockCommentOk!: string;

  // 근거: CLE-API-CONV — `//` 주석은 OpenAPI 에 실리지 않는 회피처라 허용한다.
  /** 회피처를 쓴 필드. */
  lineCommentOk!: string;

  /** respec/ 과 spec 이라는 낱말, 번호 없는 README.md 는 경로로 보지 않는다. */
  wordsOk!: string;
}

/** 클래스 JSDoc 도 같은 채널이다. 플러그인이 싣지 않아도 센다 — CLE-API-CONV. */
export class InternalRefFixtureClassDocDto {}

/** 파일 수준 선언의 JSDoc 도 센다 — spec/5-system/demo. */
export const INTERNAL_REF_FIXTURE_VALUES = ['a', 'b'] as const;

export const internalRefFixtureMeta = {
  description: '설명에 키를 적었다(CLE-API-SWAGGER).',
  summary: '요약은 ' + '이어 붙여도 ' + 'spec/5-system/demo 를 본다',
  title: 'title 은 대상이 아니다 CLE-API-CONV',
};

const subject = '항목';

/** 프로덕션에 있는 모양이다. 치환 `${}` 뒤 꼬리 조각에 참조가 있다. */
export const internalRefFixtureTemplateTail = {
  description: `${subject} 설명은 CLE-API-CONV 를 본다`,
};

/** 치환 `${}` 앞 머리 조각에 참조가 있다. */
export const internalRefFixtureTemplateHead = {
  summary: `spec/5-system/demo 의 ${subject} 를 본다`,
};

/** 괄호로 묶은 연결 문자열. 참조는 괄호 안에만 있다. */
export const internalRefFixtureParenthesized = {
  description: '설명은 ' + ('괄호 안에 ' + 'WH-SC-01 을 적었다'),
};
