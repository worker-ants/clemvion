# 문서화(Documentation) 리뷰

## 발견사항

- **[INFO]** 신규 인라인 주석/JSDoc 3곳은 실측 검증 결과 정확하다
  - 위치: `codebase/backend/src/common/swagger/api-wrapped.ts:203-210`, `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:461-463`, `.../interact-ack-response.dto.spec.ts:677-679`
  - 상세: 설치된 `@nestjs/swagger@11.4.5`(`node_modules/@nestjs/swagger/package.json`)의 `exports` 맵을 직접 확인한 결과 `"."`/`"./plugin"`/`"./package.json"` 만 노출되어 있어 주석이 주장하는 "11.4.x 부터 deep-import(`.../dist/interfaces/open-api-spec.interface`) 차단"이 사실과 일치한다. 또한 `dist/interfaces/index.d.ts` 는 `open-api-spec.interface` 에서 `ApiTagOptions`/`OpenAPIObject` 만 재-export 하고 `SchemaObject` 는 재-export 하지 않는다(주석의 "공개로 re-export 하지 않고" 주장과 일치). `dist/decorators/api-response.decorator.d.ts` 의 실제 선언도 `export interface ApiResponseSchemaHost extends Omit<ResponseObject, 'description'> { schema: SchemaObject & Partial<ReferenceObject>; ... }` 로, 주석이 명시한 타입 정의(`= SchemaObject & Partial<ReferenceObject>`)와 정확히 일치하고 `ApiOkResponse`/`ApiCreatedResponse`/`ApiAcceptedResponse` 의 옵션 유니온(`ApiResponseNoStatusOptions`)에 `Omit<ApiResponseSchemaHost, 'status'>` 가 포함되어 있어 "`ApiOkResponse({ schema })` 가 실제로 받는 타입" 이라는 서술도 정확하다. `openapi3-ts` 신규 devDependency 도 실제로 추가되지 않았음(`package.json`/lockfile diff 확인)을 재확인해 "별도 openapi3-ts 의존성 불필요" 문구도 사실과 일치한다.
  - 제안: 조치 불요 (정확성 확인 완료, 정보성 기록).

- **[INFO]** `spec/conventions/swagger.md`, `PROJECT.md` 에는 핀/deep-import 를 "열린 이슈"로 서술하는 잔존 문구가 없음 — 갱신 불요
  - 위치: `spec/conventions/swagger.md` (전체), `PROJECT.md:43` (버전 핀 정책 절)
  - 상세: 저장소 전체에서 `11.2.7` 문자열을 가진 살아있는 문서(`spec/**`, `PROJECT.md`, `CLAUDE.md`)를 재귀 검색한 결과 `plan/in-progress/pnpm-migration-followups.md` 단 한 곳만 히트했다. `spec/conventions/swagger.md` 는 SchemaObject/deep-import/버전 핀을 전혀 언급하지 않아 이번 diff 로 인해 무효화될 서술이 없다. `PROJECT.md:43` 의 "버전 핀 정책"은 `pnpm-workspace.yaml` `overrides` 사용법을 일반론으로만 서술하고 `@nestjs/swagger` 를 특정해 언급하지 않으므로 이번 핀 제거로 인한 정정 대상이 아니다.
  - 제안: 조치 불요.

- **[INFO]** 열린 이슈를 서술하는 유일한 살아있는 문서는 `plan/in-progress/pnpm-migration-followups.md` §2 — 별도 처리 예정으로 인지, 본 리뷰 스코프 밖
  - 위치: `plan/in-progress/pnpm-migration-followups.md:43-53`
  - 상세: §2 는 "`@nestjs/swagger` 11.2.7 핀 제거 + deep-import 정리"를 아직 미완료 과제로 서술하고, "완료 조건"으로 "`pnpm-workspace.yaml` `overrides` 의 `@nestjs/swagger` 핀 제거"를 명시한다. 이번 diff 가 정확히 그 조건(pin 제거 + 3곳 deep-import → 공개 타입 파생 전환)을 충족했으나, 이 diff 자체에는 plan 파일 변경이 포함되어 있지 않다. 오케스트레이터 지시에 따라 plan §2 승격(완료 표시 + `plan/complete/` 이동 여부 판단)은 별도로 처리되므로 본 리뷰에서는 결함으로 표시하지 않는다.
  - 제안: (본 리뷰 스코프 밖, 참고용) plan §2 를 완료로 갱신하고 "완료 조건" 충족 근거(exports 맵 실측 등)를 남길 것 — 이미 별도 트랙에서 진행 예정이라고 전달받음.

- **[INFO]** `pnpm-workspace.yaml` 의 구 `swagger-pin` 주석이 깨끗이 제거되어 고아 참조가 남지 않음
  - 위치: `pnpm-workspace.yaml` diff (`- # swagger-pin: ...` 5줄 삭제)
  - 상세: 핀과 함께 그 근거를 설명하던 5줄 주석 블록 전체가 diff 로 제거되었다. 이 주석을 참조하는 다른 문서(예: PROJECT.md, plan 파일 등)가 있는지 확인했으나 이 주석 블록을 직접 인용/링크하는 곳은 없어 dangling reference 위험이 없다.
  - 제안: 조치 불요.

- **[INFO]** CHANGELOG 갱신 불요 — 저장소 컨벤션상 CHANGELOG 는 사용자/제품 기능 변경만 기록
  - 위치: `CHANGELOG.md` (상단 다수 항목)
  - 상세: `CHANGELOG.md` 기존 항목은 모두 워크플로 편집기·웹채팅 위젯 등 사용자에게 보이는 기능/동작 변경을 다루며, 앞선 pnpm→workspace 마이그레이션이나 의존성 버전 조정류의 내부 하우스키핑 변경에 대한 항목은 하나도 없다(`grep pnpm CHANGELOG.md` 무결과). 본 diff(swagger 패키지 버전 상향 + 내부 타입 파생 방식 변경)는 공개 API 계약이나 사용자 동작을 바꾸지 않는 순수 내부 변경이라 이 컨벤션상 CHANGELOG 항목이 필요하지 않다.
  - 제안: 조치 불요.

- **[INFO]** (경미, 참고) 신규 `SchemaObject` 타입 별칭 + 주석이 두 spec 파일에서 import 문 사이에 삽입됨
  - 위치: `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts:9-11`, `.../interact-ack-response.dto.spec.ts:4-6`
  - 상세: 두 파일 모두 `import type { ApiResponseSchemaHost, OpenAPIObject } from '@nestjs/swagger';` 다음에 주석 + `type SchemaObject = ...` 선언이 오고, 그 아래에 다시 `import { ... } from './execution-status-response.dto';` 등 후속 import 가 이어진다. 즉 import 블록이 타입 선언으로 한 번 끊긴다. 기능·동작에는 영향이 없고(TS 는 statement 순서에 관대) 저장소 eslint 설정에도 `import/first`/`import/order` 류 규칙이 없어(devDependencies 에 `eslint-plugin-import` 미설치, `eslint.config.mjs` 확인) lint 도 통과한다. 다만 가독성 관점에서 import 를 한 곳에 모으고 그 아래에 타입 별칭을 두는 편이 스캔하기 쉽다.
  - 제안: (선택) `type SchemaObject = ...` 와 주석을 모든 import 문 아래로 옮겨 import 블록을 연속시키는 것을 고려. 필수는 아님.

## 요약

이번 diff 의 핵심 문서화 요소는 `@nestjs/swagger` 11.2.7→11.4.5 업그레이드로 막힌 `SchemaObject` deep-import 를 공개 타입 `ApiResponseSchemaHost['schema']` 파생으로 대체한 이유를 설명하는 3곳의 신규 인라인 주석/JSDoc이며, 실제 설치된 패키지의 `exports` 맵과 타입 선언을 직접 대조한 결과 모든 주장(재-export 부재, 11.4.x exports 차단, `ApiResponseSchemaHost['schema']` 의 실제 타입, openapi3-ts 불필요)이 정확했다. `spec/conventions/swagger.md`·`PROJECT.md` 등 살아있는 규약 문서 중 핀이나 deep-import 를 "열린 이슈"로 서술하는 곳은 없으며, 유일하게 이를 미완료 과제로 서술하는 `plan/in-progress/pnpm-migration-followups.md` §2 는 오케스트레이터 확인대로 별도 트랙에서 완료 처리될 예정이라 본 리뷰의 결함 대상에서 제외했다. README·API 문서·CHANGELOG 는 이번 변경이 순수 내부 타입/의존성 정리라 갱신 대상이 아니며, 발견한 유일한 사소한 사항은 두 spec 파일에서 신규 타입 별칭이 import 블록을 잠시 끊는 스타일적 지점(선택적 개선)뿐이다.

## 위험도

NONE
