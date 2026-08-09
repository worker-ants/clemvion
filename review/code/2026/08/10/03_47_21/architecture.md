# 아키텍처(Architecture) 리뷰

## 발견사항

- **[WARNING]** plan-tree 워커가 "하나로 합친다"는 이번 PR 의 목표에도 불구하고 두 개의 독립 구현으로 남아 있고, 둘의 동등성이 자동화되지 않았다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:59` (`collectCompletePlans` 함수, 59-83줄) vs `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:59` (`walkPlanMarkdown`, 59-86줄) / `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:94` (`collectCompletePlanMarkdown`)
  - 상세: `plan-scan.ts` 헤더 주석(1-25줄)이 스스로 "네 벌 있던 walker 중 둘만 합쳤고, Gate C(`spec-plan-completion.test.ts`)의 `collectCompletePlans` 는 아직 독립 구현으로 남아 있다"고 명시하며 `plan/in-progress/docs-guard-walker-dedup.md` 에 후속으로 등재해 뒀다(실제로 해당 plan 파일 존재 확인함) — 즉 인지되고 추적되는 부채다. 다만 그 문서·주석이 근거로 드는 "면제 규칙 값은 현재 일치"는 **실측(수동 확인)**일 뿐, 두 구현의 산출 집합이 항상 같다는 것을 강제하는 테스트는 없다. `isLifecyclePlan`(plan-scan.ts) 대 인라인 조건(spec-plan-completion.test.ts:72-77)이 개별 파일에서 각각 유지보수되므로, 한쪽만 바뀌면(`0-`/`_` 접두 규칙 확장 등) 두 스캐너가 서로 다른 plan 집합을 보는데도 어떤 테스트도 그 드리프트를 잡지 못한다. 정확히 이 PR 이 해소하려는 "네 walker 가 서로 다른 접두 처리를 갖고 있었고 그 차이가 조용히 어긋난다"는 문제의 축소판이 그대로 남아 있는 형태다.
  - 제안: 최소한 `spec-plan-completion.test.ts` 의 `collectCompletePlans` 를 `plan-scan.ts` 의 `collectCompletePlanMarkdown`(이미 `spec-links.ts` 가 `collectLivePlanMarkdown` 을 임포트하는 선례가 있음)로 교체하거나, 교체가 어렵다면 두 구현이 같은 파일 집합을 반환하는지 검증하는 계약 테스트(cross-check test) 하나만이라도 추가해 드리프트를 자동 탐지하게 한다. 통합 자체는 `docs-guard-walker-dedup.md` 로 미뤄도 되지만, "일치를 실측으로만 안다"는 상태는 이 PR 범위에서 값싸게 좁힐 수 있다.

- **[WARNING]** gray-matter 캐시 우회 관용구(`matter(raw, {})`)가 파일 경계를 넘어 4곳에 중복 — 공유 헬퍼 부재
  - 위치: `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:139`(`findNonTerminalCompletedPlans` 내부), `codebase/frontend/src/lib/docs/__tests__/plan-scan.ts:249`(`checkPlanFrontmatter` 내부) / `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:97`, `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:118`
  - 상세: `plan-scan.ts:130-138` 의 주석은 이 방어(빈 옵션 객체로 gray-matter 의 프로세스-전역 파싱 캐시를 우회하는 관용구)를 "한 파일 안에서 같은 hazard 를 한쪽만 막아 두면 다음 사람이 '여긴 안 막아도 되는 자리'로 읽는다"는 이유로 정당화한다. 그런데 정확히 같은 관용구가 **파일 경계를 넘어** `spec-plan-completion.test.ts` 에도 두 번(97·118줄) 손으로 복제돼 있고, `spec-plan-completion.test.ts:93-96` 주석은 "이 가드와 `plan-scan.ts` 는 같은 `plan/complete/**` 를 각각 파싱하므로 실제로 서로의 캐시를 밟는다"고 그 사실을 인지까지 하고 있다. 즉 hazard 인지는 있는데 대응은 "SoT 모듈이 이미 있음(`plan-scan.ts`, `spec-links.ts` 가 이미 그로부터 import 하는 선례 있음)"에도 불구하고 헬퍼 추출 대신 4번째 복제를 택했다. 이 상태에서 향후 5번째 파서 호출이 추가되면 `{}` 인자를 빠뜨릴 위험이 매번 반복된다.
  - 제안: `plan-scan.ts` 에 `parseFrontmatterSafe(raw: string): Record<string, unknown> | null`(또는 throw-on-fail 버전) 형태의 단일 헬퍼를 export 하고, 위 4개 호출부 모두 그것으로 교체한다. `spec-links.ts` 가 이미 `plan-scan.ts` 를 SoT 로 import 하는 구조이므로 같은 패턴을 확장하면 된다.

- **[INFO]** Gate C 의 순수 판정 함수(`isGateCEnforced`/`hasValidSpecImpact`)가 SoT 모듈이 아니라 `.test.ts` 파일에 남아 있다 — 이 PR 이 정확히 반대 이유로 다른 로직을 추출했던 것과 대비된다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:38`(`isGateCEnforced`), `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts:43`(`hasValidSpecImpact`)
  - 상세: `plan-scan.ts` 헤더 주석은 "158 tests 전량 GREEN 인데 위반 수집 분기가 한 번도 실행되지 않았다 — 원래 `.test.ts` 안에 인라인으로 있어 fixture 로 negative-path 를 증명할 수 없었다"는 것을 로직을 별 모듈로 뺀 근거로 든다. `isGateCEnforced`/`hasValidSpecImpact` 는 같은 성격의 순수·fixture-testable 판정 함수이면서(그리고 이미 그렇게 단위 테스트되고 있다, 156-179줄) 여전히 `spec-plan-completion.test.ts` 안에 인라인이다. 현재는 이 파일 자신만 소비하므로 실질적 결합/중복 위험은 없지만, 모듈 경계 기준이 파일마다 다르게 적용된 형태다.
  - 제안: 지금 당장 옮길 필요는 없으나, `docs-guard-walker-dedup.md` 통합 시점에 `plan-scan.ts` 로 함께 이관하는 것을 고려한다(같은 파일이 "plan lifecycle 불변식"의 SoT 를 자처하고 있으므로).

- **[INFO]** (긍정 관찰) `spec-links.ts` 의 `findBrokenLinksInFiles` + `LinkScanOptions` 파라미터화는 DEAD/ANCHOR 스캔 로직 중복을 3개 공개 진입점(`findBrokenLinks`/`findBrokenPlanLinks`/`findBrokenSpecLinksInSources`) 전체에서 잘 피했다
  - 위치: `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:183`(`findBrokenLinksInFiles`), `codebase/frontend/src/lib/docs/__tests__/spec-links.ts:263`·`290`·`352`(세 공개 함수)
  - 상세: `checkSelfAnchors`/`targetFilter` 두 옵션만으로 스캔 대상 파일 집합·앵커 검사 범위·경로 필터를 모두 표현해, 위 WARNING 두 건과 달리 이 모듈은 "하나의 구현에서 파생"이라는 원래 설계 목표를 실제로 달성했다. 새 스캔 표면이 추가돼도(OCP) 옵션 하나만 늘리면 되는 구조.

## 요약

이번 PR 은 plan 라이프사이클 불변식(frontmatter 필수 3필드, `status` 종료값, 링크 무결성)을 `plan-scan.ts`/`spec-links.ts` 공유 모듈로 옮겨 "네 벌의 walker" 문제를 절반으로 줄였고, 그 과정에서 파싱 결과 대신 원문을 검사해야 하는 이유·gray-matter 캐시 함정·YAML 1.1 불리언 함정 같은 실측 근거를 주석에 촘촘히 남겨 재귀적으로 같은 함정에 빠지지 않도록 설계했다는 점은 견고하다. 순수 함수와 테스트를 분리해 negative-path 를 fixture 로 고정한 구조, `spec-links.ts` 의 옵션 파라미터화도 SOLID 관점에서 무난하다. 다만 이 PR 자신이 제시한 "단일 스캔 소스여야 하는 이유"라는 원칙이 `spec-plan-completion.test.ts` 의 독립 walker 와 4곳에 중복된 gray-matter 캐시 우회 관용구에는 아직 적용되지 못했고, 전자는 문서화된 추적 항목이 있지만 후자는 그렇지 않다 — 둘 다 이 PR 의 범위 내에서 저비용으로 좁힐 수 있는 잔여 리스크다. 순환 의존성이나 레이어 위반, 심각한 결합 문제는 발견되지 않았다.

## 위험도

LOW
