# 정식 규약 준수 검토 결과

검토 모드: --impl-done  
scope: `spec/5-system/4-execution-engine.md`  
diff-base: origin/main  
대상 변경 파일:
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts` (신규)
- `codebase/backend/src/modules/execution-engine/workflow-errors.ts`

---

## 발견사항

- **[INFO]** `graph-dispatch.types.ts` 파일명 패턴은 기존 관행과 일치함
  - target 위치: `codebase/backend/src/modules/execution-engine/types/graph-dispatch.types.ts` (신규 파일)
  - 위반 규약: 해당 없음
  - 상세: 동일 `types/` 디렉토리에 선행하는 `trigger-parameter.types.ts` 가 `<kebab-slug>.types.ts` 패턴을 이미 확립했다. 신규 `graph-dispatch.types.ts` 는 동일 패턴을 따른다. `spec/conventions/` 에는 백엔드 모듈 내부 TypeScript 파일 명명에 대한 명시적 규약 문서가 없으므로 위반이 아니다.
  - 제안: 변경 불필요.

- **[INFO]** `@internal` JSDoc 태그 사용 — 규약 공백 영역
  - target 위치: `engine-driver.interface.ts` 의 `rehydrateContext`, `loadAndBuildGraph`, `runNodeDispatchLoop`, `findActivatedBackEdge`, `clearLlmDefaultConfigCache` 메서드 및 `workflow-errors.ts` 의 `ExecutionCancelledError` 클래스
  - 위반 규약: `spec/conventions/swagger.md` 는 DTO JSDoc 패턴(한국어 설명, `@ApiProperty` 보강)을 규정하나, 인터페이스·에러 클래스의 `@internal` TSDoc 태그 사용 허용/금지에 대한 명시 조항이 없다.
  - 상세: diff 는 EngineDriver 인터페이스 5개 멤버와 `ExecutionCancelledError` 에 `@internal — ... 모듈 외부 직접 참조 금지.` 주석을 추가한다. `swagger.md` 가 다루는 범위는 NestJS DTO(`*.dto.ts`) 와 Swagger 데코레이터 패턴에 국한되며, TypeScript interface/error class 의 TSDoc `@internal` 태그는 그 범위 밖이다. 어떤 convention 문서도 이 태그 사용을 금지하거나 요구하지 않는다. 따라서 규약 위반은 아니며, 단지 규약이 침묵하는 영역이다.
  - 제안: 현행 변경에는 조치 불필요. 향후 engine 내부 surface 문서화 패턴 확산 시 `spec/conventions/` 에 "backend 모듈 내부 TypeScript 문서화 패턴" 규약을 신설하는 것이 적절하다.

- **[INFO]** `spec/5-system/4-execution-engine.md` frontmatter — 신규 코드 경로 커버 여부
  - target 위치: `spec/5-system/4-execution-engine.md` frontmatter `code:` 항목
  - 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `code:` 는 spec 이 약속한 surface 의 구현 경로를 glob 으로 명시해야 함.
  - 상세: 현재 `code:` 에 `codebase/backend/src/modules/execution-engine/**` glob 이 등재돼 있다. 신규 파일 `types/graph-dispatch.types.ts` 는 이 glob 에 포함되므로(`**` 하위 경로 전체 커버) 추가 항목 없이 `spec-code-paths.test.ts` 가드를 통과한다. 실질적 가드 gap 없음.
  - 제안: 변경 불필요.

---

## 요약

검토 범위 내 diff(engine-driver interface JSDoc 보강, graph-dispatch 타입 leaf 모듈 분리, ExecutionCancelledError @internal 주석 추가)는 `spec/conventions/` 의 어떤 정식 규약도 직접 위반하지 않는다. 파일 명명은 기존 `types/` 디렉토리 패턴(`*.types.ts`)과 일치하며, `spec/5-system/4-execution-engine.md` frontmatter `code:` glob 은 신규 파일을 이미 포섭한다. `@internal` TSDoc 태그 사용은 `swagger.md` 의 DTO-scoped JSDoc 규약과 레이어가 달라 충돌이 없고, 해당 태그에 대한 명시적 금지 규약도 없다. 발견된 항목은 전부 INFO 등급(형식 일관성 제안 수준)이며, 규약 갱신이 필요한 항목도 없다.

## 위험도

NONE
