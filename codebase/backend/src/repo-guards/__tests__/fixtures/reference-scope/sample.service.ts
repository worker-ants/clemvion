/**
 * `reference-scope-guard` 의 서비스 대조군 — 소속 검사 도달(`findScopeChecksReachableFrom`)과 공개 소비 메서드
 * (`findPublicDtoConsumers`)를 양쪽에서 본다.
 *
 * *"지금 저장소가 규칙을 지킨다"* 와 *"이 함수가 위반을 잡는다"* 는 다른 주장이다. 앞의 것만 단언하면 술어를 넓혀도
 * 스위트가 초록이다. 형제 fixture(`endpoint-path-save.fixture.ts`)와 같이 `any` 대신 가짜 타입을 선언한다.
 */

import type {
  FixtureCreateDto,
  FixtureNestedDto,
  FixturePlainDto,
  FixtureUpdateDto,
} from './dto/sample.dto';

interface FakeRepo {
  exists(options: unknown): Promise<boolean>;
  save(entity: unknown): Promise<unknown>;
}

interface FakeModelConfigService {
  findEntity(id: string, workspaceId: string, kind: string): Promise<unknown>;
}

interface FieldError {
  field: string;
  message: string;
}

declare function assertReferenceInScope(
  repo: FakeRepo,
  where: unknown,
  field: string,
  message: string,
): Promise<void>;
declare function throwInvalidReferences(items: FieldError[]): never;
declare function assertSomethingElse(
  repo: FakeRepo,
  where: unknown,
  field: string,
  message: string,
): Promise<void>;

export class FixtureReferenceService {
  constructor(
    private readonly repo: FakeRepo,
    private readonly modelConfigService: FakeModelConfigService,
    private readonly other: FixtureOtherService,
  ) {}

  /** 양성 — 공용 헬퍼를 직접 부른다. 세 번째 인자 `'workflowId'` 로 묶인다. */
  async direct(workspaceId: string, dto: FixtureCreateDto): Promise<void> {
    await assertReferenceInScope(
      this.repo,
      { id: dto.workflowId, workspaceId },
      'workflowId',
      'Workflow not found in this workspace',
    );
    await this.repo.save(dto);
  }

  /** 양성 — private 메서드를 거쳐 닿는다. 두 단계(`viaPrivate` → `checkFolder` → `assertFolder`)를 따라간다. */
  async viaPrivate(workspaceId: string, dto: FixtureUpdateDto): Promise<void> {
    await this.checkFolder(dto.folderId, workspaceId);
    await this.repo.save(dto);
  }

  /** 양성 — 항목 배열을 모아 던진다. `field:` 리터럴의 마지막 조각(`containerId` · `id`)으로 묶인다. */
  collected(dto: FixtureNestedDto): void {
    const invalid: FieldError[] = [];
    dto.items.forEach((item, i) => {
      if (item.containerId) {
        invalid.push({
          field: `items[${i}].containerId`,
          message: 'Container not found',
        });
      }
      invalid.push({ field: `items[${i}].id`, message: 'Id already used' });
    });
    if (invalid.length > 0) throwInvalidReferences(invalid);
  }

  /** 양성 — 첫 인자를 검사하는 검증기(모델 설정 예외). 값이 있을 때만 부르는 형태도 `dto.folderId` 의 이름으로 묶인다. */
  async firstArg(workspaceId: string, dto: FixtureCreateDto): Promise<void> {
    if (dto.folderId) {
      await this.modelConfigService.findEntity(
        dto.folderId,
        workspaceId,
        'chat',
      );
    }
  }

  /** 음성 — 검사 없이 저장한다. */
  async noCheck(dto: FixtureCreateDto): Promise<void> {
    await this.repo.save(dto);
  }

  /**
   * 음성 — 헬퍼 이름을 주석 · 문자열에만 적고 부르지 않는다. 다른 이름의 함수가 같은 인자 모양을 받아도 검사가 아니다.
   * assertReferenceInScope(this.repo, where, 'workflowId', '...')
   */
  async mentionsOnly(
    workspaceId: string,
    dto: FixtureCreateDto,
  ): Promise<void> {
    const note = 'assertReferenceInScope';
    await assertSomethingElse(
      this.repo,
      { id: dto.workflowId, workspaceId },
      'workflowId',
      note,
    );
  }

  /** 음성 — 필드 인자가 리터럴이 아니면 어느 필드를 보는지 정할 수 없어 묶지 않는다. */
  async nonLiteralField(
    workspaceId: string,
    dto: FixtureCreateDto,
    field: string,
  ): Promise<void> {
    await assertReferenceInScope(
      this.repo,
      { id: dto.workflowId, workspaceId },
      field,
      'not found',
    );
  }

  /** 음성 — 다른 객체의 같은 이름 메서드는 따라가지 않는다(`this.other.checkFolder` 는 `this.checkFolder` 가 아니다). */
  async otherObject(workspaceId: string, dto: FixtureCreateDto): Promise<void> {
    await this.other.checkFolder(dto.folderId, workspaceId);
  }

  /** 음성(공개 소비) — 참조를 나르지 않는 DTO 만 받는다. */
  plain(dto: FixturePlainDto): string {
    return dto.title;
  }

  /** 공개 소비 — 타입 연산자 안의 DTO(`Partial<…>`)도 본다. */
  partial(dto: Partial<FixtureCreateDto>): string | undefined {
    return dto.name;
  }

  /** 공개 소비 — 두 단계 바깥 DTO 의 인덱스 타입도 본다. */
  indexed(items: FixtureNestedDto['items']): number {
    return items.length;
  }

  /** private 메서드는 공개 소비로 세지 않는다 — 공개 메서드에서 닿는다. */
  private async checkFolder(
    folderId: string | null | undefined,
    workspaceId: string,
  ): Promise<void> {
    if (folderId == null) return;
    await this.assertFolder(folderId, workspaceId);
  }

  private assertFolder(folderId: string, workspaceId: string): Promise<void> {
    return assertReferenceInScope(
      this.repo,
      { id: folderId, workspaceId },
      'folderId',
      'Folder not found in this workspace',
    );
  }

  /** protected 메서드도 공개 소비가 아니다. */
  protected internal(dto: FixtureCreateDto): string {
    return dto.name;
  }
}

/** 같은 이름의 메서드(`duplicated`)를 두 클래스에 두어 어느 쪽인지 정할 수 없는 경우를 만든다. */
export class FixtureOtherService {
  async checkFolder(
    folderId: string | null | undefined,
    workspaceId: string,
  ): Promise<void> {
    await assertReferenceInScope(
      {} as FakeRepo,
      { id: folderId, workspaceId },
      'folderId',
      'Folder not found',
    );
  }

  duplicated(): void {}
}

export class FixtureThirdService {
  duplicated(): void {}
}
