# 문서화(Documentation) 리뷰 — request-body-guard (2R)

## 검증 방법

- `CHANGELOG.md`, `codebase/backend/src/common/pipes/validation.pipe.ts`(+`.spec.ts`),
  `codebase/backend/src/repo-guards/__tests__/request-body-advertised{-guard,}.ts`,
  `codebase/backend/src/shared/testing/swagger-probe.ts`(+`.spec.ts`), `spec/conventions/swagger.md`,
  `plan/in-progress/request-body-guard.md`, `plan/in-progress/spec-draft-swagger-request-body.md` 를 `Read` 로 전문 대조.
- 1R 리뷰(`review/code/2026/09/26/19_32_47/`)의 SUMMARY·RESOLUTION 이 주장하는 조치(`8bc7e8f19`)가 실제 코드에 반영됐는지
  현재 파일 상태로 재확인 — `Object.freeze` 적용 · JSDoc "얼린다" 문구 · `Number`/`Boolean`/`Array` 개별 대조군 ·
  `AlphaBodyFixtureController` 정렬 대조군 · `bodyArgIndexes` 다중 키 정렬 테스트, 전부 diff/파일 내용과 일치함을 확인.
  `선례 workflows/dto/execute-workflow.dto.ts`, `hooks.controller.ts` 의 `@ApiBody({ schema: {} })` 등 JSDoc 이 인용하는
  구체 파일·코드도 실재 확인.
- 저장소 파일은 읽기만 했다. 종료 시 `git status --short` 결과: `?? review/code/2026/09/26/19_54_03/`(본 리뷰 산출물 자신)만
  존재 — 뮤테이션 잔여물 없음.

## 발견사항

없음. 1R 이후 반영된 수정(`8bc7e8f19`)까지 포함해 문서화 관점의 Critical/Warning 급 결함을 찾지 못했다.

## 참고 (INFO, 비차단)

- **[INFO]** 1R `documentation.md` 가 지적했던 `bodyArgIndexes` "키 지정 본문이 여럿" 동작의 전용 테스트 부재는
  `swagger-probe.spec.ts`(`twoBodies` 케이스, `bodyArgIndexes(...).toStrictEqual([0, 1])`)로 이번 라운드에 앞서
  이미 해소되어 있었다 — 재확인만 하고 새로 지적하지 않는다.
  - 위치: `codebase/backend/src/shared/testing/swagger-probe.spec.ts`
- **[INFO]** `UNVALIDATED_METATYPES` JSDoc("얼린다 — export 된 전역 목록이라 …")과 `validation.pipe.spec.ts` 의 신규
  `describe('UNVALIDATED_METATYPES', …)` 두 test 설명("얼려 있다", "검증하지 않고 값을 그대로 넘긴다")이 서로 다른 층
  (프로덕션 JSDoc vs 테스트 설명)에서 같은 불변식을 중복 서술하지만, 문구가 서로 모순되지 않고 오히려 JSDoc→테스트로
  계약이 그대로 이어진다 — 오래된 주석/불일치 아님.
  - 위치: `codebase/backend/src/common/pipes/validation.pipe.ts` (JSDoc), `codebase/backend/src/common/pipes/validation.pipe.spec.ts`
- **[INFO]** CHANGELOG — 1R 수정 커밋(`8bc7e8f19`, `Object.freeze` 적용 등)은 CHANGELOG 기준(`CHANGELOG.md` 상단 §1~3)
  중 어느 것에도 해당하지 않는다 — 같은 미출시 기능("저장소 가드 신설")의 방어력 강화이지 별도의 제품 동작·배포·개발
  흐름 변화가 아니므로 기존 "저장소 가드 신설" 항목 하나로 충분하다. 별도 항목 누락이 아니다.
  - 위치: `CHANGELOG.md` (`## Unreleased — 저장소 가드 신설: …`)
- **[INFO]** README — `codebase/backend/README.md` 를 직접 확인한 결과 기존 형제 가드(`forbidden-response-codes` 등)도
  등재돼 있지 않아, 신설 가드 `request-body-advertised` 를 README 에 올리지 않은 것은 일관된 기존 관행이다.
  - 위치: `codebase/backend/README.md` (해당 언급 없음, grep 0건 확인)

## 요약

1R 리뷰가 "문서화 관점에서 모범적"이라 평가한 상태에서, 1R 의 Warning 2건(전역 가변 상태·뮤테이션 갭)에 대한 조치
커밋(`8bc7e8f19`)까지 실측 대조한 결과 JSDoc·인라인 주석·CHANGELOG·spec Rationale·plan 뮤턴트 표 사이에 불일치나
오래된 서술은 발견되지 않았다. 코드(JSDoc)가 서술하는 동작은 전부 실제 구현·테스트와 line-level 로 일치하며, 인용하는
형제 파일·선례 DTO·라우트도 모두 실재한다. README·API 문서·설정 문서·예제 코드 항목은 모두 기존 저장소 관행과
일치하거나 해당 없음으로 판정했다. 신규로 제기할 Critical/Warning 은 없다.

## 위험도

NONE
