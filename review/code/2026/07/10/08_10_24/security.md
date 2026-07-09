# 보안(Security) 리뷰 — expression-enricher-dry (behavior-preserving 리팩터)

## 개요

대상 변경은 프론트엔드 표현식 자동완성용 `outputSchema` enrichers 5종(`node-output-schema-enrichers.ts`)을
공통 골격(`cloneSchema` / `collectProps` / `getOrCreateObjectChild` / `mergeLeafProps` /
`enrichByProjecting`)으로 DRY 리팩터하고, 소비처(`use-expression-context.ts`)의 두 곳
5-way `if/else` dispatch 를 `OUTPUT_SCHEMA_ENRICHERS` 레지스트리 lookup 으로 대체한 순수
내부 리팩터. 서버 통신·인증·암호화·영속화 계층을 건드리지 않으며, 산출물은 에디터
자동완성 힌트(런타임 검증 비관여)로 신뢰 경계 내부(현재 사용자 자신이 편집 중인
워크플로우 config)에서만 소비된다.

## 발견사항

발견된 CRITICAL/WARNING 없음. 참고용 INFO 만 기록한다.

- **[INFO]** 프로토타입 오염 방어 로직이 리팩터 후에도 동일하게 보존·테스트됨
  - 위치: `codebase/frontend/src/components/editor/expression/node-output-schema-enrichers.ts` — `isSafeFieldName` (L~54-58, 변경 없음), `UNSAFE_KEYS = new Set(["__proto__","constructor","prototype"])`; 신설 `collectProps` (L732-745 diff 기준)가 모든 5개 enricher의 필드 추출 지점에서 여전히 `isSafeFieldName`을 개별 `extractOne` 콜백 안에서 호출
  - 상세: 리팩터 전에는 각 enricher가 자체 for-loop 안에서 `isSafeFieldName`을 호출했고, 리팩터 후에는 공용 `collectProps`가 호출자가 넘긴 `extractOne`을 통해 동일 필터를 적용한다. info_extractor/form/table/manual_trigger/transform 5곳 모두 `isSafeFieldName` (또는 transform의 경우 동일 regex 기반 검사)이 필터 경로에서 빠짐없이 유지됨을 diff 및 신규 테스트(`skips unsafe prototype keys...` 계열, `OUTPUT_SCHEMA_ENRICHERS` 레지스트리 완전성 테스트)로 확인. `mergeLeafProps`/`getOrCreateObjectChild`가 객체에 쓰는 key(`result`/`interaction`/`data`/`extracted`/`parameters`/`rows`)는 전부 코드 리터럴이며 config-derived 값이 아니므로 이 경로로 프로토타입 오염이 재도입될 여지가 없음.
  - 제안: 조치 불필요. 향후 6번째 enricher 추가 시 `collectProps`의 `extractOne` 콜백에서 `isSafeFieldName` 호출을 빠뜨리지 않도록 리뷰 시 확인 포인트로 남겨두면 됨(플랜 문서에 명시된 "노드타입 추가 시 레지스트리 1곳 등록"과 별개로, 필드명 안전성 검사는 각 enricher 콜백 책임으로 남아있어 자동 강제되지 않음).

- **[INFO]** dev-only `console.warn` 메시지에 사용자 제어 데이터 미포함
  - 위치: `enrichByProjecting` 내 `warnLabel` 템플릿 리터럴 (node-output-schema-enrichers.ts)
  - 상세: `warnLabel`은 각 호출부에서 `"Information Extractor"`, `"Form"`, `"Table"`, `"Manual Trigger"` 하드코딩 문자열만 전달되며 config/사용자 입력이 로그 문자열에 섞이지 않음. `process.env.NODE_ENV !== "production"` 가드도 리팩터 전후 동일하게 유지.
  - 제안: 조치 불필요.

- **[INFO]** 테스트 코드(`node-output-schema-enrichers.test.ts`)의 신규 `OUTPUT_SCHEMA_ENRICHERS` 레지스트리 검증
  - 위치: `__tests__/node-output-schema-enrichers.test.ts` L637-654 (diff)
  - 상세: 레지스트리 완전성(5개 노드타입 매핑) 및 미등록 타입(`http_request`) → `undefined` 반환을 명시적으로 고정. `use-expression-context.ts`의 두 dispatch 지점 모두 `if (inputSchema && enrich)` / `if (enrich)` 가드로 `undefined` 케이스를 안전하게 처리하므로 미등록 노드타입에 대해 예외 없이 base schema를 그대로 사용 — DoS/크래시 유발 경로 없음.
  - 제안: 조치 불필요.

## 요약

이번 변경은 클라이언트 전용 자동완성 힌트 생성 로직의 순수 리팩터로, 인젝션·시크릿·인증/인가·암호화·에러 노출·의존성 관점에서 새로운 공격 표면을 추가하지 않는다. 기존에 존재하던 프로토타입 오염 방어(`isSafeFieldName`/`UNSAFE_KEYS`, `Object.create(null)` 누적)와 불변 클론(`cloneSchema`) 패턴은 공통 헬퍼로 추출된 뒤에도 각 enricher 경로에서 동일하게 적용되며, 신규 레지스트리(`OUTPUT_SCHEMA_ENRICHERS`)의 완전성과 미등록 타입 처리(안전한 `undefined` fallback)까지 테스트로 고정되어 있다. 서버 검증(런타임)과 무관한 UX 힌트 레이어라는 점, config 값이 항상 사용자 자신이 소유한 워크플로우 편집 컨텍스트에서만 오므로 신뢰 경계 변화가 없다는 점도 위험을 낮춘다.

## 위험도

NONE
