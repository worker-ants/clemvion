# 문서화(Documentation) 리뷰

## 검증 방법

이 changeset 은 이미 6라운드의 AI 코드리뷰(`review/code/2026/09/04/01_48_39/` ~
`03_37_37/`, 매 라운드 documentation reviewer 포함)를 거쳤고, 그 라운드들의 WARNING 은
전부 다음 fix 커밋에서 조치됐다고 RESOLUTION.md 들이 주장한다. 그 주장을 그대로 받지 않고
**현재 파일을 직접 열어** 재확인했다(저장소에는 아무 것도 쓰지 않음 — `git status --short`
로 리뷰 전후 동일함 확인):

- `codebase/backend/src/common/__test-utils__/source-scan.ts` 전체
- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` 전체
- `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast.spec.ts` 전체
- `codebase/backend/src/repo-guards/__tests__/masked-reject-callers.spec.ts`(6R 신규분)·
  `masked-reject-callers-guard.ts`·`audit-action-binding-guard.ts`·
  `engine-error-code-anchor-guard.ts`·`redis-fail-open-catalog-guard.ts`
- `plan/in-progress/entity-nullable-column-type-mismatch.md` 의 "한 자리만 고치는 버릇" 절
  (289~330행)과 "할 일" 체크리스트(174~288행) 전체

## 이전 라운드 WARNING 재확인 (전부 반영 확인됨)

- **1R W4**(`countCalls` JSDoc orphan): `source-scan.ts` 를 직접 읽어 `stripLiterals`(57~82행)
  와 `countCalls`(84~93행)가 각자 자신의 JSDoc 을 정확히 갖고 있음을 확인.
- **2R W1**(`findStaleSpecCasts` 가 이름 매칭만으로 판정해 다른 엔티티의 정당한 캐스트를
  오탐): `nullable-type-lie-cast-guard.ts:129-166`(`widenedEntityFields` docstring)이
  이름 충돌을 실제로 빼는 로직(187-199행, `nonNull` 집합 차집합)과 "왜 오탐이 없나"를
  "충돌을 뺀 덕" 으로 정정한 서술이 일치함을 확인. 대조군 테스트
  (`nullable-type-lie-cast.spec.ts:318-344`)도 실재.
- **6R W2·W3**(plan 문서 "한 자리만 고치는 버릇" 절의 헤딩/본문 개수 불일치 + 표 렌더링 깨짐):
  직접 289~305행을 읽어 헤딩 "여섯 번" · 표 6행 · 본문 "여섯 다" 가 모두 일치하고, 4번-5번
  행 사이에 표를 끊는 빈 줄이 없음을 확인.
- **6R W1**(`masked-reject-callers-guard` 의 `includeSpec: true` 옵션이 빠져도 테스트가 안
  죽던 사각지대): `masked-reject-callers.spec.ts` 에 배선을 직접 단언하는
  `describe('스캔 대상에 \`.spec.ts\` 가 포함된다', …)` 블록(신규 JSDoc + 테스트 2건)이
  실재하며, JSDoc 의 "허용목록에 `.spec.ts` 항목이 실제로 두 개" 주장도
  `ALLOWED_DIRECT_CALLERS`(같은 파일 26-45행)를 직접 대조해 정확함을 확인
  (`resolve-trigger-parameters.spec.ts`·`load-trigger-parameter-schema.spec.ts` 두 건).
  이 신규 JSDoc 블록은 바로 아래 `describe` 블록에 올바르게 붙어 있고 orphan 이 아니다.

## 발견사항

- **[INFO]** `CollectTsFilesOptions.includeSpec` 의 JSDoc이 "실사례가 하나 있다" 고 여전히
  단수로 서술하지만, 실제로는 두 곳에서 `includeSpec: true` 를 쓴다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts:214`
    (`` `true` 가 필요한 실사례가 하나 있다: `masked-reject-callers-guard` 는 … ``)
  - 상세: `grep` 으로 직접 대조하면 `includeSpec: true` 호출부가 실제로 두 곳이다 —
    ① `masked-reject-callers-guard.ts:51`(`listSourceFiles`), ② `nullable-type-lie-cast.spec.ts:399`
    (`describe('저장소 전수', …)` 안의 `specs` 상수, `collectTsFiles(SRC_ROOT, { includeSpec: true })`).
    ②는 이번 diff 의 신규 가드(`findStaleSpecCasts`)가 spec 파일도 스캔해야 해서 생긴
    두 번째 실사례다. 이 stale 서술 자체는 이미 3라운드 전(3R INFO#1)부터 리뷰어들이
    반복 지적했고, 저자는 매 라운드 **의도적으로 유예**해 왔다 — 같은 파일이 스스로 세운
    규칙("검증되지 않는 숫자는 적지 않는다", `collectScanTargets`/`widenedEntityFields`
    docstring)과 "실사례 개수를 다시 늘려 적는 것"이 충돌하고, 그 편집이 또 한 라운드를
    부른다는 것이 6R RESOLUTION 에 명시된 근거다. 판단 자체는 합리적이지만, 서술이 여전히
    실제 사용처보다 좁다는 사실관계는 남아 있다.
  - 제안: 다음에 이 파일을 만질 기회에, 저자가 이미 6R 에서 적어 둔 대로 "실사례가 하나
    있다: …" 같은 **개수 서술을 아예 빼고** "어떤 경우에 필요한가"만 남기는 편집을 반영할
    것(둘 다 열거하면 세 번째가 생길 때 또 낡는다). 급한 조치는 아니다 — 기능·타입 영향
    없음, INFO 수준 유지.

## README·CHANGELOG·API 문서

이번 diff 는 `repo-guards/__tests__/`·`common/__test-utils__/` 하위의 내부 테스트/가드
인프라 리팩터와 `plan/` 문서 갱신에 국한된다. 신규 공개 API 엔드포인트·환경변수·설정
옵션이 없고, 이전 라운드들의 documentation reviewer 가 이미 확인한 대로 이 저장소 관례상
README/CHANGELOG 갱신 대상이 아니다(내부 CI 가드는 plan 문서가 SoT 역할을 대신함).

## 요약

이 changeset 은 6라운드에 걸쳐 실제 코드로 검증 가능한 문서화 결함(반증된 "원리적으로
불가능" 주장, orphan JSDoc, 옵션 배선 사각지대, plan 문서 자기 지시적 개수 불일치 등)을
전부 잡고 고쳐 온 드문 사례다 — 이번 라운드에서 소스를 직접 열어 재확인한 결과 모든 이전
WARNING 이 실제로 반영돼 있었다(주장만 있고 코드가 안 따라온 항목 없음). 새로 발견된
CRITICAL/WARNING 은 없다. 유일한 잔여 항목은 `CollectTsFilesOptions.includeSpec` JSDoc 의
"실사례 하나"가 실제로는 둘이라는 INFO 로, 저자가 이미 3라운드 연속 근거를 남기고 의도적으로
유예한 항목이다. 신규 공개 함수(`collectTsFiles`, `stripLiterals`, `widenedEntityFields`,
`findStaleSpecCasts`)는 모두 "왜 필요한가/왜 오탐이 없나/한계"를 갖춘 JSDoc 을 유지하고
있고, 새로 추가된 테스트(`masked-reject-callers.spec.ts` 의 배선 단언, `nullable-type-lie-cast.spec.ts`
의 이름 충돌 대조군)에도 그 존재 이유를 설명하는 주석이 붙어 있다.

## 위험도

LOW
