# 테스트(Testing) 리뷰 — Gate C / plan-scan 라이프사이클 가드

## 발견사항

- **[WARNING]** `hasValidSpecImpact` 의 `NONE_VALUES` 정규화(trim/toLowerCase) 및 `"n/a"`/`"na"` 어휘가 어떤 테스트로도 검증되지 않는다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:31` (`NONE_VALUES` 정의), `:73`·`:238` (`impact.trim().toLowerCase()` 정규화 로직), `:284-291` (해당 유일한 단위 테스트)
  - 상세: `NONE_VALUES = new Set(["none", "없음", "n/a", "na"])` 는 4개 어휘를 등재하지만, `spec-plan-completion.test.ts:284-291` 의 `it("accepts \`none\`/\`없음\`...")` 은 `"none"`/`"없음"` 두 값만 호출한다. `"n/a"`/`"na"` 는 이 테스트 파일은 물론 실저장소 데이터(`plan/complete/**`, grep 실측)에서도 단 한 번도 등장하지 않는다. 또한 `.trim().toLowerCase()` 정규화(대소문자 무시, 공백 트림)를 겨냥한 케이스(`"NONE"`, `" none "`, `"N/A"` 등)도 전혀 없다. 이 파일의 다른 함수들(`danglingSpecImpact`, `isIsoDate`, `hasMalformedStarted`)은 JSDoc 에서 반복적으로 "실 데이터에 없는 분기라도 합성 fixture 로 겨눠야 뮤테이션에 안 죽는다" 는 원칙을 명시하고 실제로 그렇게 했는데(뮤테이션 실측 언급 포함), `hasValidSpecImpact` 의 이 부분만 같은 원칙이 적용되지 않았다. `NONE_VALUES` 에서 `"n/a"`/`"na"` 를 빼거나 `.toLowerCase()` 를 제거하는 뮤턴트가 들어와도 전체 스위트가 GREEN 을 유지한다(직접 검증: grep 으로 두 값이 코드베이스 어디에서도 assert 되지 않음을 확인).
  - 제안: `Gate C enforcement logic` 블록(`:284`)의 해당 `it` 에 `hasValidSpecImpact("n/a", exists)`, `hasValidSpecImpact("NA", exists)`, `hasValidSpecImpact("NONE", exists)`, `hasValidSpecImpact("  none  ", exists)` 등을 추가해 정규화 어휘 전체와 trim/대소문자 무시 경로를 합성 fixture 로 고정할 것.

- **[INFO]** `rawScalar` 의 정규식 메타문자 이스케이프가 `.` 한 글자만 검증된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.test.ts:259-265` (`it("treats the key as a literal, not a regex")`)
  - 상세: 구현(`plan-scan.ts:221`)은 `key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")` 로 13종의 메타문자를 이스케이프하지만 테스트는 `"a.b"` 하나만 겨눈다. 주석에서 스스로 "지금 호출부는 리터럴 하나뿐이라 즉시 위험은 없다" 고 인정하고 있어 심각도는 낮지만, export 된 범용 유틸이라 향후 호출부가 늘면 `*`/`(`/`[` 등 다른 메타문자에서 조용히 깨질 수 있다.
  - 제안: 필수는 아니나, 여유가 있다면 대표 메타문자 1~2개(`*`, `(`)를 추가로 겨누면 이스케이프 전체가 의도대로 동작함을 조금 더 강하게 보장할 수 있다.

## 강점 (참고)

- 세 파일 모두 "실저장소 positive-only 단언(위반 0건)은 검사 작동을 증명하지 못한다" 는 원칙을 일관되게 지켜, 순수 함수(`isGateCEnforced`/`hasMalformedStarted`/`hasValidSpecImpact`/`danglingSpecImpact`/`makeSpecExists`/`checkPlanFrontmatter`/`rawScalar`/`isIsoDate`)를 분리하고 각각을 합성 fixture 로 negative-path 까지 겨눈다. 여러 JSDoc/주석이 뮤테이션 테스트로 발견한 구체적 생존 뮤턴트(예: 연·월 비교 죽은 분기, `danglingSpecImpact` 인라인 시절 생존)를 근거로 남겨 두어 회귀 방지 의도가 명확하다.
- mock 을 전혀 쓰지 않고 `fs.mkdtempSync` 기반 임시 디렉터리로 실제 파일시스템/gray-matter 동작을 그대로 검증한다 — 이 도메인(파일 스캔·YAML 파싱 실측 괴리, 예: js-yaml 날짜 롤오버)에서는 mock 보다 적절한 선택이다.
- `describe` 블록마다(`plan-scan`, `findFrontmatterViolations`) 독립된 `beforeAll`/`afterAll` 임시 디렉터리를 쓰고 테스트 간 상태를 공유하지 않아 격리가 깨끗하다. vitest 기본 `isolate: true` 로 파일 간 gray-matter 캐시 오염도 없음을 주석에서 실측 근거로 명시했다.
- `plan-frontmatter.test.ts` 리팩터(별도 diff)로 판정 로직이 `plan-scan.ts`/`spec-links.ts` 로 위임되면서 이 3개 파일의 회귀 스위트가 실제 CI 게이트 로직과 동일 소스를 공유하게 됐다 — "판정 이중화" 재발을 구조적으로 차단한다.
- 로컬에서 3개 파일 전체(및 리팩터된 `plan-frontmatter.test.ts`)를 `vitest run` 으로 직접 실행해 989 tests 전량 GREEN 을 확인했다.

## 요약

Gate C(spec_impact 강제)와 plan-scan 라이프사이클 가드 리팩터는 테스트 관점에서 매우 높은 완성도를 보인다 — positive-only 실저장소 단언의 한계를 명확히 인지하고 순수 함수 추출 + 합성 fixture + 문서화된 뮤테이션 실측으로 negative-path 를 체계적으로 고정했다. 유일한 실질 갭은 `hasValidSpecImpact` 의 `NONE_VALUES` 정규화(trim/대소문자)와 `"n/a"`/`"na"` 어휘가 이 파일 자신의 방법론(합성 fixture 로 모든 분기 겨누기)을 적용받지 못한 것으로, 실 피해는 현재 없지만(실데이터에 해당 어휘 없음) 향후 조용한 회귀에 취약하다. 그 외에는 격리·가독성·mock 적절성·회귀 안전성 모두 양호하다.

## 위험도
LOW
