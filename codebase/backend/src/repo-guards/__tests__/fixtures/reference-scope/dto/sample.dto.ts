/**
 * `reference-scope-guard` 의 요청 DTO 대조군 — 모집단(`findRequestReferenceFields`)과 포함 관계(`findReferenceBearingDtos`)를 본다.
 *
 * 경로에 `dto` 디렉터리가 있어야 요청 DTO 로 읽히므로 `dto/` 아래에 둔다. 프로덕션 스캔은 `__tests__` 아래를 건너뛰어 이
 * 파일이 베이스라인에 섞이지 않는다.
 */

/** `@nestjs/swagger` 의 `PartialType` 흉내 — 상속받은 필드는 선언이 없어도 같은 참조를 나른다. */
declare function PartialType<T>(cls: new () => T): new () => Partial<T>;

/** 양성 — `workflowId` · `folderId` · `id` 가 모집단에 든다. `name` · `identity` 는 이름이 참조 모양이 아니다. */
export class FixtureCreateDto {
  workflowId: string;
  folderId?: string | null;
  id: string;
  name: string;
  identity: string;
}

/** 상속만 하는 DTO — 선언한 필드가 없어 모집단에는 없고, 포함 관계로 `FixtureCreateDto` 를 나른다. */
export class FixtureUpdateDto extends PartialType(FixtureCreateDto) {}

/** 배열 항목 DTO — `containerId` 와 복수형 `knowledgeBaseIds` 가 모집단에 든다. */
export class FixtureItemDto {
  containerId?: string | null;
  knowledgeBaseIds: string[];
}

/** 바깥 DTO — 참조 필드가 없지만 `items` 로 `FixtureItemDto` 를 나른다. */
export class FixtureNestedDto {
  items: FixtureItemDto[];
  title: string;
}

/** 두 단계 바깥 — `FixtureNestedDto` 를 거쳐 `FixtureItemDto` 까지 나른다. */
export class FixtureOuterDto {
  nested: FixtureNestedDto;
}

/** 음성 — 참조 필드도 참조를 나르는 프로퍼티도 없다. */
export class FixturePlainDto {
  title: string;
}
