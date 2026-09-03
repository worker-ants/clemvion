# 요구사항(Requirement) 리뷰 — `repo-guards` walker 통합 + 낡은 spec 캐스트 가드 (5R 이후 재검토)

## 검증 방법

이 diff 는 이미 5라운드 리뷰(01_48_39 → 02_12_38 → 3R/4R/5R, 커밋 `63d5cdaa6`~`93cd244af`)를
거쳤다. 기존 발견사항(W1~W4, INFO#1~#8)이 실제로 반영됐는지 소스를 직접 열어 재확인하고,
plan 문서에 박힌 정량 주장을 저장소 실측으로 재검증했다(저장소 트리에는 아무 것도 쓰지 않음 —
모든 프로브는 `mktemp -d` scratch 에서 실행, `git status --short` 로 최종 확인해 review 세션
디렉터리 외 변경 없음).

- `npx jest --testPathPatterns="(source-scan|audit-action-binding|engine-error-code-anchor|masked-reject-callers|nullable-type-lie-cast|redis-fail-open-catalog)"`
  → **6 suites / 117 tests 전부 PASS** (1R 시점 105 → 이후 라운드에서 12개 테스트 추가, 전부 GREEN)
- `ts-node` 로 실제 저장소를 스캔해 `widenedEntityFields`/`findStaleSpecCasts` 를 직접 실행:
  `entities: 41, specs: 443, widened.size: 115, stale count: 0` — plan 문서의 "저장소 잔존 0",
  "2026-09-04 실측 135 → 115" 주장과 **정확히 일치**(충돌 제거 전 `135`, 충돌 `20`건, 이후
  `115` 도 별도로 재계산해 확인).
- `grep -rn readdirSync src/repo-guards/__tests__/ src/common/__test-utils__/` → 구현체
  `source-scan.ts` 1곳만 남음 — "readdirSync 잔존 0" 주장과 일치.
- `spec/` 전체에서 `source-scan|collectTsFiles|null as unknown as|widenedEntityFields` grep →
  `spec/conventions/raw-query-results.md` 의 코드 증거 링크 1건뿐, 동작을 규정하는 spec 본문
  없음 — 이 변경 영역(내부 test-tooling/repo-guard)은 spec 관할 밖(회색지대) 확인.
- `hits[0].file` 등 순서 의존 단언이 있는 형제 spec(`engine-error-code-anchor.spec.ts`)도 포함해
  전체 스위트가 GREEN — `collectTsFiles` 의 상시 `sort()` 도입이 기존 순서 의존 단언을 깨지
  않음을 실행으로 확인(정적 판독이 아니라 실제 실행 결과).

## 발견사항

- **[INFO]** `CollectTsFilesOptions.includeSpec` JSDoc 이 "실사례가 하나 있다" 고 적었지만
  실제로는 **같은 PR 안에서** 두 번째 실사례가 생겼다
  - 위치: `codebase/backend/src/common/__test-utils__/source-scan.ts` — `CollectTsFilesOptions`
    인터페이스의 `includeSpec` JSDoc(현재 209~219번째 줄 부근, `* \`true\` 가 필요한 실사례가
    하나 있다: \`masked-reject-callers-guard\`...`)
  - 상세: `git log -S"실사례가 하나 있다"` 로 확인하면 이 문장은 커밋 `63d5cdaa6`(walker 통합)에서
    쓰였고, 그 문장이 참이었던 시점엔 `includeSpec: true` 호출부가
    `masked-reject-callers-guard.ts` 하나뿐이었다. 그런데 바로 다음 커밋
    `46f464583`(같은 plan 항목의 후속 커밋, 낡은 spec 캐스트 가드 추가)이
    `nullable-type-lie-cast.spec.ts` 의 `describe('저장소 전수', ...)` 블록에
    `collectTsFiles(SRC_ROOT, { includeSpec: true })` 를 추가했다(현재 파일 399번째 줄).
    `grep -rn "includeSpec:\s*true" src/` 로 전수 확인하면 실사용 호출부는
    `masked-reject-callers-guard.ts:51` 과 `nullable-type-lie-cast.spec.ts:399` **두 곳**이다
    (`source-scan.spec.ts` 의 3곳은 `includeSpec` 옵션 자체를 테스트하는 자리라 "실사례"가
    아니라 제외). JSDoc 을 갱신하지 않아 "유일한 실사례" 라는 문장이 작성 시점에는 옳았지만
    지금은 **개수를 하나 틀리게 단언**하는 상태다. 기능에는 영향이 없다 — `includeSpec` 동작
    자체는 두 호출부 모두에서 올바르게 작동하고(테스트 GREEN, `저장소 전수` 스위트도 통과),
    이건 "왜 이 옵션이 존재하는가" 를 설명하는 주석의 열거가 하나 빠졌다는 문서 정확도 문제일
    뿐이다. 다만 이 프로젝트가 이 PR 전체에서 반복적으로 강조한 원칙("실사례" 개수를 정확히
    적어야 다음 사람이 오판하지 않는다, plan 문서의 "숫자를 어디에 쓸 수 있나" 절과 동일한
    성격의 문제)에 비추면 이 자리도 같은 클래스의 잔여 흠이다. 5라운드 리뷰 전체에서
    이 지점은 지적되지 않았다(문서화·범위·유지보수성 리뷰가 각각 다른 부분을 짚었지만 이
    구체적 문장은 다루지 않음).
  - 제안: "실사례가 하나 있다: `masked-reject-callers-guard`" 를 "실사례가 둘 있다:
    `masked-reject-callers-guard`(허용목록 스캔) · `nullable-type-lie-cast.spec.ts` 의
    '저장소 전수' 테스트(낡은 spec 캐스트 스캔)" 로 갱신. 코드 fix 불필요, 주석 정정만 필요.

## 확인 결과 — 문제 없음 (5라운드 발견사항의 현재 상태)

- **W1(정렬 커버리지 봉인 오류)**: `source-scan.spec.ts` 의 `nested-sibling.ts` 픽스처로 정렬
  분기를 관측 가능하게 만든 테스트가 현재 존재하고 GREEN — 반영 확인.
- **W2(`stripLiterals` 전용 테스트 부재)**: `source-scan.spec.ts` 에 따옴표 보존·템플릿
  다중 줄·이스케이프 처리·알려진 한계(중첩 백틱) 등 7개 테스트가 존재 — 반영 확인.
- **W3(`withFiles`/`withFixture` 중복)**: 현재 `nullable-type-lie-cast.spec.ts` 는 `withFiles`
  하나로 통합돼 있고 `withFixture` 는 그 얇은 래퍼 — 반영 확인.
- **W4(JSDoc orphan)**: `source-scan.ts` 를 직접 읽어 확인 — `stripLiterals` 의 JSDoc(57~76번째
  줄)과 `countCalls` 의 JSDoc(84~89번째 줄)이 각자의 선언 바로 위에 정확히 붙어 있다. orphan
  없음 — 반영 확인.
- **2R W1(동명 필드 오탐)**: `widenedEntityFields` 가 `nonNull` 집합과의 교집합을 제거하는 로직이
  현재 코드에 있고(`for (const f of nonNull) widened.delete(f);`), 대조군 테스트
  (`userId` 충돌 제외 · `onlyHereAt` 충돌 없음 잡음)도 존재 — 반영 확인. 실측치(135→115, 충돌
  20건)도 위 검증 방법에서 직접 재현해 정확히 일치함을 확인.
- **INFO#1(`WIDENED_DECL` 데코레이터 1개 한계)**: 코드 변경 없이 docstring 에 한계를 명시하는
  쪽으로 처리됐고, 현재도 그 문서화가 남아 있다 — 의도된 처분과 일치.
- **INFO#4(`| null` 표기 변형)**: `isNullableType` 이 `split('|').map(trim).includes('null')`
  로 순서·공백 무관 판정을 하고, `it.each` 로 세 가지 표기(공백 없음·순서 반대·표준)를 직접
  테스트 — 반영 확인.

## 요약

핵심 변경은 `repo-guards/__tests__/` 의 디렉터리 walker 사본 5개를 `source-scan.ts` 의
`collectTsFiles` 로 통합하고, 넓혀진(nullable 화된) 엔티티 필드를 겨눈 낡은 `.spec.ts` 캐스트를
잡는 신규 가드(`widenedEntityFields`/`findStaleSpecCasts`)를 추가한 것이다. 5라운드에 걸친
이전 리뷰가 정렬 커버리지 봉인 오류·전용 테스트 부재·헬퍼 중복·JSDoc orphan·동명 필드 오탐이라는
다섯 개의 실질적 결함을 모두 잡았고, 이번 재검토에서 그 수정 전부가 실제 소스에 반영돼 있고
테스트(117/117)가 GREEN 임을 직접 실행으로 재확인했다. plan 문서에 박힌 정량 주장
(`135 → 115`, 충돌 20건, 저장소 잔존 0, `readdirSync` 잔존 0)도 저장소를 직접 스캔해 전부
정확함을 검증했다. 이 변경 영역(내부 test-tooling/repo-guard)을 규정하는 `spec/` 본문은
없어 spec fidelity 축은 회색지대다. 이번 재검토에서 새로 찾은 유일한 항목은
`CollectTsFilesOptions.includeSpec` JSDoc 이 "실사례가 하나" 라고 적었지만 같은 PR 의 바로 다음
커밋에서 두 번째 실사례가 생겨 그 문장이 지금은 개수를 하나 틀리게 단언한다는 것 — 기능에는
영향 없는 문서 정확도 문제(INFO)다. CRITICAL/WARNING 급 결함은 발견되지 않았다.

## 위험도

LOW
