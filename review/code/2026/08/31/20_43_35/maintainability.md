# 유지보수성(Maintainability) 리뷰

## 대상 요약

`error-codes.ts` 에 엔진 레이어 전용 `EngineErrorCode` const(4개 코드)를 신설하고,
`execution-engine.service.ts`(3곳) · `shutdown-state.service.ts`(2곳) · `ai-turn-orchestrator.service.ts`(4곳)의
맨 문자열 에러 코드 9지점을 `ErrorCode.*` / `EngineErrorCode.*` 참조로 리다이렉트했다. 재발 방지용
AST 기반 가드(`engine-error-code-anchor-guard.ts` + `-fixture.ts` + `.spec.ts`)를 신규 추가했고,
`plan/` 문서를 in-progress → complete 로 이동했다. 나머지 파일(9~21번)은 이전 리뷰 라운드
(`20_27_29`)의 산출물(RESOLUTION/SUMMARY/reviewer 리포트/retry-state)로, 그 자체가 리뷰 대상
"코드"는 아니다.

이 diff 는 직전 라운드(`20_27_29`)의 maintainability 리뷰 INFO 2건(가드 spec 매직넘버 근거 부재,
`EngineErrorCode` JSDoc ↔ `ANCHORED_ELSEWHERE` 서술 부분 중복)이 이미 지적된 상태다.
`RESOLUTION.md` 및 실제 소스를 직접 열어 대조한 결과, 매직넘버 건은 인라인 근거 주석으로
실제로 반영되어 있었다(`engine-error-code-anchor.spec.ts:44-46,126-128`). 문서 중복 건은 "지금은
통합 불요"로 의도적으로 미조치 처리되었고 그 판단 근거가 RESOLUTION 에 남아 있어 재지적하지
않는다.

## 발견사항

- **[INFO]** AST `as const` 언래핑 로직이 두 함수에 동일하게 중복
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:79-81`
    (`readDeclaredCodes`) 및 `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor-guard.ts:160-162`
    (`collectBoundCodes` 내부 `visit`)
  - 상세: `ts.isAsExpression(node.initializer) ? node.initializer.expression : node.initializer` 패턴이
    두 함수에 글자 그대로 반복된다. 두 함수 모두 "AST 로 언래핑한 뒤 리터럴을 검사한다"는 같은
    책임을 갖고 있어 별도 헬퍼(`unwrapAsExpression(node: ts.Expression): ts.Expression`)로 뽑아내면
    두 함수가 그 헬퍼를 재사용할 수 있다. 이 파일 스스로가 "다음 형태를 미리 알 수 없다"며 AST 채택
    근거를 정교하게 설명하는 만큼, 형태 처리 로직 자체의 중복은 그 원칙과 살짝 어긋난다.
  - 제안: 두 지점을 공용 헬퍼로 통합. 우선순위 낮음 — 각 3줄 미만의 소규모 중복이며 로직이 갈라질
    위험은 낮다(둘 다 단순 unwrap).

- **[INFO]** 픽스처 디렉터리 경로 문자열이 세 곳에 하드코딩되어 반복
  - 위치: `codebase/backend/src/repo-guards/__tests__/engine-error-code-anchor.spec.ts:72,101`
    (`'codebase/backend/src/repo-guards/__tests__'` 리터럴 2회 — `collectBoundCodes` 호출과
    `findUnanchored` 호출)
  - 상세: 같은 파일의 `ENGINE_DIR`/`CODES_SOURCE`(가드 파일 쪽)는 상수로 추출돼 있는데, 정작
    spec 자신이 두 번 쓰는 픽스처 디렉터리 경로는 리터럴 문자열로 중복된다. 오탈자가 나면 한쪽
    호출만 조용히 다른 디렉터리를 스캔하게 되고, 두 테스트(형태 커버리지 vs positive-path)가
    서로 다른 대상을 검사하고 있다는 사실을 알아채기 어려워진다.
  - 제안: 파일 상단에 `const FIXTURE_DIR = 'codebase/backend/src/repo-guards/__tests__';` 를 두고
    두 호출부에서 재사용. 우선순위 낮음 — 같은 파일 내 32줄 이내 근접 반복이라 drift 위험은 작다.

## 확인한 긍정적 포인트

- 문자열 리터럴 9곳 → 상수 참조 치환은 값이 100% 동일한 순수 기계적 변경이며, 리다이렉트 지점
  자체는 함수 길이·중첩·복잡도에 아무 영향을 주지 않는다(각각 한 줄 치환).
- `EngineErrorCode` 신설 JSDoc(`error-codes.ts:115-139`)이 "왜 파일을 안 나눴는가"(SoT 분열 방지)와
  "왜 const 는 나눴는가"(기존 `ErrorCode` docstring 계약 범위 준수)를 근거와 함께 설명해, 다음
  사람이 같은 질문을 반복하지 않도록 설계됐다.
- 네이밍(`EngineErrorCode`/`EngineErrorCodeValue`)이 기존 `ErrorCode`/`ErrorCodeValue` 컨벤션
  (UPPER_SNAKE 값, `as const`, `*Value` 파생 타입)을 그대로 계승해 일관적이다.
- `collectBoundCodes` 의 3-분기(property assignment / variable·property declaration / binary
  assignment) AST 방문 로직이 공통 `record()` 클로저로 수렴해, 바인딩 이름 검사·UPPER_SNAKE 필터
  같은 검증 로직 자체는 중복되지 않는다(위 INFO 는 unwrap 한 줄짜리 지엽적 중복).
- `ANCHORED_ELSEWHERE` 는 "예외"를 사유 없이 봐주는 도피처가 되지 않도록 사유 길이·dead-entry
  검증 테스트로 강제한다 — 매직 넘버가 아니라 정책을 코드로 강제하는 형태.
- 매직 넘버(`declared.size > 30`, `reason.length > 20`)는 왜 그 값인지(실측 40, 최단 사유 45자)를
  주석에 명시해 임의성이 없다.
- fixture 파일이 모든 바인딩을 `export` 해 불필요한 `eslint-disable` 없이도 lint 를 통과한다(직접
  확인: 지시어 없음).
- 가드 3파일 구성(순수 로직/픽스처/소비 spec 분리)이 저장소 기존 형제 패턴
  (`redis-fail-open-catalog-guard.ts`)을 그대로 따라 컨벤션 일관성이 높다.

## 요약

이번 변경은 엔진 레이어에 흩어져 있던 맨 문자열 에러 코드 9곳을 단일 상수(`ErrorCode`/신설
`EngineErrorCode`)로 리다이렉트하는 순수 기계적 리팩터이며, 재발 방지용 AST 가드까지 함께
도입해 향후 동일 결함 클래스가 재발하지 않도록 설계됐다. 직전 라운드에서 지적된 매직넘버
근거 부재는 실제로 인라인 주석으로 반영되었음을 소스에서 직접 확인했다. 새로 찾은 것은 가드
파일 내 AST 언래핑 로직의 지엽적 2줄 중복과 spec 파일의 픽스처 경로 문자열 반복뿐으로, 둘 다
파급 범위가 좁고 우선순위가 낮은 INFO 수준이다. 함수 길이·중첩 깊이·순환 복잡도 모두 문제
없는 수준이며, 네이밍·JSDoc·기존 형제 가드 패턴과의 일관성이 높다.

## 위험도

NONE
