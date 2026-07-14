# 요구사항(Requirement) 리뷰 — @nestjs/swagger 11.2.7→11.4.5 + deep-import 공개 타입 파생 교체

## 검증 방법 (실측)

- `spec/conventions/swagger.md`, `spec/5-system/14-external-interaction-api.md` (§5.1/§5.3/§10.1) 전문 확인.
- `node_modules/@nestjs/swagger` 설치본(11.4.5)의 `dist/decorators/api-response.decorator.d.ts` 원문 확인 — `ApiResponseSchemaHost.schema` 의 실제 타입 = `SchemaObject & Partial<ReferenceObject>` (api-wrapped.ts 신규 JSDoc 주석의 주장과 **정확히 일치**).
- `node_modules/@nestjs/swagger/package.json` 의 `exports` 맵 확인 — `.`, `./plugin`, `./package.json` 만 노출, `./dist/interfaces/*` 서브패스는 미노출. `codebase/backend/tsconfig.json` 은 `moduleResolution: nodenext` 이므로 이 exports 맵이 실제로 강제됨을 확인.
- `npx jest src/modules/external-interaction/dto/responses/execution-status-response.dto.spec.ts src/modules/external-interaction/dto/responses/interact-ack-response.dto.spec.ts src/common/swagger` 실행 → **3 suites / 28 tests 전부 통과** (요구사항 payload 의 "28개 회귀 테스트" 주장과 일치).
- `npx tsc --noEmit -p tsconfig.json` → 프로젝트 전역에 기존(무관) 에러 다수 있으나 `swagger`/`api-wrapped`/`execution-status-response`/`interact-ack-response` 관련 에러 **0건**.
- `grep -rn "dist/interfaces/open-api-spec.interface" src/ test/` → 잔존 deep-import **0건** (주석 내 언급 1건 제외) — 마이그레이션이 부분적이지 않고 완결됨을 확인.
- `plan/in-progress/pnpm-migration-followups.md` §2 대조 — "교체 완료 시 `pnpm-workspace.yaml` `overrides` 의 `@nestjs/swagger` 핀 제거 (= 이 작업의 명시적 완료 조건)" 명시. 본 diff 가 정확히 그 핀을 제거함을 확인 (`pnpm-workspace.yaml` diff).

## 발견사항

- **[INFO]** plan 문서의 §2 항목이 "완료" 로 주석 처리되지 않음
  - 위치: `plan/in-progress/pnpm-migration-followups.md` §2 (43~53행)
  - 상세: §1 의 하위 항목들(1, 1-(a))은 작업 완료 시 "**완료(날짜, PR)**: ..." 문장이 본문에 추가됐으나, 실제로 이 diff 가 구현한 §2("`@nestjs/swagger` 11.2.7 핀 제거 + deep-import 정리")는 명시된 완료 조건(핀 제거)을 충족했음에도 plan 파일 자체에는 그 사실이 아직 기록되지 않았다. 이 diff 에 `plan/**` 변경이 포함되어 있지 않다.
  - 제안: 같은 PR (또는 후속 커밋)에서 §2 본문에 완료 주석을 추가 — `.claude/docs/plan-lifecycle.md` 관례상 완료된 하위 항목은 즉시 기록하는 편이 §1 패턴과 일관적. 코드 자체의 결함은 아니므로 CRITICAL/WARNING 이 아닌 INFO.

- **[INFO]** 회귀 검증 범위는 EIA 2개 DTO 한정, 버전 bump 는 전역 영향
  - 위치: `codebase/backend/package.json`, `pnpm-lock.yaml` (`@nestjs/swagger` 11.2.7→11.4.5)
  - 상세: `SwaggerModule.createDocument` 실제 출력을 스냅샷 검증하는 테스트는 저장소 전체에서 `execution-status-response.dto.spec.ts` / `interact-ack-response.dto.spec.ts` 2개뿐이다 (`grep -rl "SwaggerModule.createDocument" src --include="*.spec.ts"` 확인). 라이브러리 마이너 버전 bump 는 전체 Swagger 표면(다른 모듈의 DTO)에도 영향 가능하나, 이 두 DTO 밖의 회귀는 단위/e2e(253) 의 간접 통과에만 의존하고 OpenAPI 문서 자체의 diff 스냅샷으로는 검증되지 않는다.
  - 제안: 코드 fix 대상은 아님 — 커밋 메시지 자체가 검증 범위를 이미 투명하게 명시(2 DTO/28 tests + lint/unit/build/e2e). 참고용 잔여 리스크로만 기록.

## 요구사항 충족 관점 종합 판단

이 변경은 **런타임 동작을 일절 바꾸지 않는 순수 컴파일타임 리팩터**다. `api-wrapped.ts` 의 `wrapDataSchema`/`wrapOneOfDataSchema`/`wrapItemsSchema`/`wrapPaginatedSchema` 가 반환하는 객체 리터럴은 diff 전후 동일하며, 바뀐 것은 오직 `SchemaObject` 타입의 **소스**(내부 deep-import → `@nestjs/swagger` 가 root 로 공개하는 `ApiResponseSchemaHost['schema']`)뿐이다. 실제 `.d.ts` 원문 대조로 두 타입이 구조적으로 동일함(`SchemaObject & Partial<ReferenceObject>`)을 확인했고, `@nestjs/swagger` 11.4.5 의 `exports` 맵이 실제로 구 deep-import 경로를 차단함(그래서 핀이 필요했었음)을 재현 확인했다. EIA §5.1/§5.3 이 규정하는 `InteractAckDto`/`ExecutionStatusDto` 의 wire shape(필드명·enum·nullable·oneOf 등)는 이 diff 가 손대는 영역이 아니며, 관련 28개 회귀 가드 테스트가 실측 통과해 스키마 출력 불변을 직접 증명한다. `pnpm-workspace.yaml` 의 핀 제거는 그 핀을 최초로 건 커밋이 명시한 "완료 조건"과 정확히 일치하고, 후속 파일(spec 문서)에도 이 refactor 로 인한 line-level 불일치는 없다(swagger.md/EIA spec 모두 wire-format·컨벤션을 규정할 뿐 내부 TS 타입 소스를 규정하지 않으므로 해당 없음, SPEC-DRIFT 아님). TODO/FIXME/HACK 류 미완성 표식도 diff 내 없음. 유일한 잔여 사항은 코드 결함이 아니라 plan 문서 bookkeeping(§2 완료 주석 누락)과 검증 범위의 자연스러운 한계(라이브러리 bump 전역 영향 vs 2-DTO 스냅샷 테스트)이며 둘 다 INFO 수준이다.

## 위험도
LOW
