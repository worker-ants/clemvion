// 대조군 fixture — `dto-class-name-collision.spec.ts` 전용. 프로덕션 코드 아님.
// 같은 이름을 쓰는 짝은 `beta.dto.ts`.

export class DuplicatedFixtureDto {
  id: string;
}

export class UniqueAlphaDto {
  name: string;
}
