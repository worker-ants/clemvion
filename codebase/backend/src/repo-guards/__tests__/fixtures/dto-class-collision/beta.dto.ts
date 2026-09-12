// 대조군 fixture — `alpha.dto.ts` 와 **같은 이름**을 일부러 선언한다.
// 실제 사고(`ChatChannelBotIdentityDto` 중복)와 같은 형태: 이름만 같고 필드는 다르다.

export class DuplicatedFixtureDto {
  totallyDifferentField: number;
}

export class UniqueBetaDto {
  other: boolean;
}
