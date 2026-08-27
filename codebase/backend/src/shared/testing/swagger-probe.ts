import { Test } from '@nestjs/testing';
import {
  type ApiResponseSchemaHost,
  DocumentBuilder,
  type OpenAPIObject,
  SwaggerModule,
} from '@nestjs/swagger';
import type { ModuleMetadata } from '@nestjs/common';

/**
 * DTO 의 **생성된 OpenAPI 스키마**를 캐너리로 고정할 때 쓰는 프로브 헬퍼.
 *
 * ## 왜 있나
 *
 * 네 스펙이 같은 보일러플레이트를 반복하고 있었다 — `workflows-execute-body` ·
 * `interact-ack-response.dto` · `execution-status-response.dto` · `re-run.dto`.
 * 리뷰가 세 라운드에 걸쳐 *"4번째 유사 스펙이 생기면 공유 헬퍼로 추출하라"* 는 조건부
 * 처분을 냈고, `re-run.dto.spec.ts` 가 그 4번째였다 (`21_03_29` plan_coherence W2).
 *
 * ## 이 파일은 `dist` 로 나가면 안 된다
 *
 * `@nestjs/testing` 은 **devDependency** 다. 프로덕션 설치엔 없으므로 dist 안의
 * `require("@nestjs/testing")` 은 지뢰다. `*spec.ts` 패턴에 안 걸리는 이름이라
 * `tsconfig.build.json` 의 `exclude` 에 `src/shared/testing/**` 을 **명시 등재**했다 —
 * 같은 파일이 `src/repo-guards/**` 를 등재한 것과 **같은 이유**이고, 그 선례는 실제로
 * 오염이 일어난 뒤에 추가된 것이다.
 */

/**
 * `SchemaObject` 는 `@nestjs/swagger` 가 공개 export 하지 않는다 — 공개 타입에서 파생한다.
 * 네 스펙이 각자 같은 줄을 갖고 있던 것을 여기로 모은다.
 */
export type SwaggerSchemaObject = ApiResponseSchemaHost['schema'];

/**
 * 프로브 모듈 하나를 띄워 OpenAPI 문서를 만들고 **반드시 닫는다**.
 *
 * `app.close()` 가 `finally` 에 있는 것이 중요하다 — `createDocument` 가 던지면 Nest
 * 애플리케이션이 살아남아 Jest 가 열린 핸들로 매달린다.
 *
 * 인자는 `Test.createTestingModule` 의 metadata 를 **그대로** 받는다. 네 스펙 중 셋은
 * `{ controllers: [StubController] }`, 하나(`re-run.dto.spec.ts`)는
 * `{ imports: [ProbeModule] }` 로 프로브를 세운다 — 한쪽 형태만 받게 만들면 나머지가
 * 헬퍼를 못 쓴다.
 */
export async function buildSwaggerDocument(
  metadata: ModuleMetadata,
): Promise<OpenAPIObject> {
  const moduleRef = await Test.createTestingModule(metadata).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  try {
    return SwaggerModule.createDocument(app, new DocumentBuilder().build());
  } finally {
    await app.close();
  }
}

/**
 * `components.schemas` 레코드 전체 — **여러 DTO 를 한 문서에서** 조회하는 스펙용
 * (`@ApiExtraModels` 로 등재된 variant 들이 dangling `$ref` 가 아닌지 보는 경우).
 * 단건이면 {@link schemaOf} 가 낫다.
 */
export function schemasOf(
  doc: OpenAPIObject,
): Record<string, SwaggerSchemaObject> {
  const schemas = doc.components?.schemas as Record<
    string,
    SwaggerSchemaObject
  >;
  // `!schemas` 는 **오늘 도달하지 않는다** — `SwaggerModule.createDocument` 는 참조된 DTO 가
  // 하나도 없어도 `{"schemas":{}}` 를 낸다(실측). 타입 좁히기 값으로만 남긴다.
  // 실제로 도달하는 오류 상태는 **빈 레코드**이고, 그건 프로브가 잘못 세워졌다는 뜻이다.
  if (!schemas || Object.keys(schemas).length === 0) {
    throw new Error(
      'OpenAPI 문서에 등재된 DTO 스키마가 없다 — 프로브 컨트롤러가 어떤 DTO 도 참조하지 ' +
        '않았을 가능성이 높다(`@ApiBody`/`@ApiOkResponse` 누락, 또는 `type:` 을 안 준 경우).',
    );
  }
  return schemas;
}

/**
 * 생성 문서에서 DTO 스키마 하나를 꺼낸다.
 *
 * **왜 던지나**: 원래 네 스펙은 `doc.components?.schemas as Record<…>` 로 캐스팅한 뒤
 * 인덱싱했다. DTO 이름을 오타 내거나 프로브가 그 DTO 를 참조하지 않으면 `undefined` 가
 * 나오고, 다음 줄의 `.properties` 접근이 **설명 없는 `TypeError`** 로 죽는다. 어느 단계가
 * 비었는지 이름으로 말해 주는 편이 디버깅 비용이 훨씬 싸다.
 */
export function schemaOf(
  doc: OpenAPIObject,
  dtoName: string,
): SwaggerSchemaObject {
  const schemas = schemasOf(doc);
  const schema = schemas[dtoName];
  if (!schema) {
    throw new Error(
      `OpenAPI 스키마에 \`${dtoName}\` 이 없다. 생성된 이름: ` +
        `${Object.keys(schemas).sort().join(', ') || '(없음)'}`,
    );
  }
  return schema;
}

/**
 * DTO 스키마의 프로퍼티 하나를 꺼낸다 — 캐너리가 실제로 보고 싶어 하는 단위.
 *
 * 프로퍼티가 없으면 **형제 이름을 함께** 알려 준다. 프로퍼티가 광고되지 않는 회귀(예:
 * `@ApiProperty` 누락)와 오타를 그 자리에서 가른다.
 */
export function propertyOf(
  doc: OpenAPIObject,
  dtoName: string,
  propertyName: string,
): SwaggerSchemaObject {
  const schema = schemaOf(doc, dtoName);
  const properties = (schema.properties ?? {}) as Record<
    string,
    SwaggerSchemaObject
  >;
  const property = properties[propertyName];
  if (!property) {
    throw new Error(
      `\`${dtoName}\` 스키마에 프로퍼티 \`${propertyName}\` 이 없다. 광고된 프로퍼티: ` +
        `${Object.keys(properties).sort().join(', ') || '(없음)'}`,
    );
  }
  return property;
}
