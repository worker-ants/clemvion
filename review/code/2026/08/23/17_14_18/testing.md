STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 테스트(Testing) 리뷰 — assistant-mask-leak (17_14_18)

## 검증 방법 (독립 재현)

문서(RESOLUTION.md/이전 라운드 testing.md)의 주장을 신뢰하지 않고 직접 재현했다.

1. `npx jest explore-tools.service.spec.ts mask-sensitive-fields.util.spec.ts handler-output.adapter.spec.ts` — **76/76 GREEN**.
2. 뮤테이션 M2 (`mask-sensitive-fields.util.ts` 의 `DEFAULT_SENSITIVE_KEYS` 에서 token 계열 8개 리터럴 제거, `cp` 백업 → 편집 → 테스트 → `cp` 복원, `git status --porcelain`/`git diff --stat` 로 원상복구 확인):
   - `mask-sensitive-fields.util.spec.ts` — **8 RED** (신규 `it.each` 캐너리)
   - `handler-output.adapter.spec.ts` — **5 RED** (이전 라운드 WARNING #2 fix로 추가된 `it.each`)
   - `explore-tools.service.spec.ts` — **18/18 GREEN 유지** (겹친 `deepRedactSecrets` 값-패턴 층이 같은 키를 독립적으로 잡아 이 표면에서는 방어가 중복됨 — 문서 주장과 일치)
3. 뮤테이션 (구성 순서 반전, `deepRedactSecrets(maskSensitiveFields(v))` → `maskSensitiveFields(deepRedactSecrets(v))`, 같은 백업/복원 절차):
   - `explore-tools.service.spec.ts` — **2 RED** / 16 GREEN. RED 는 기존 `masks sensitive fields in inputData / outputData / error (recursive)` 테스트와 신규 `[캐너리] 키 축` 테스트. `[캐너리] 값 축`(`error.message`/`error.detail`)과 나머지는 순서와 무관하게 GREEN.
   - 원복 후 재실행 3개 스위트 **76/76 GREEN** 재확인.

세 뮤테이션 모두 RESOLUTION.md/이전 testing.md(`16_46_56`)가 주장한 결과와 정확히 일치했다 — 문서의 "실측" 주장에 과장·허위가 없다.

## 발견사항

- **[INFO]** "키 먼저, 값 나중" 순서 불변식이 전용 캐너리 없이 부수적으로만 커버된다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:92` (`const both = (v: unknown) => deepRedactSecrets(maskSensitiveFields(v));`, JSDoc `:78-81` "순서가 의미를 정한다")
  - 상세: 위 재현에서 확인했듯 순서를 뒤집으면 18개 중 2개만 RED 가 된다(기존 종합 단언 1개 + 키 축 캐너리 1개). 방어는 되지만(fail-safe), "이 순서가 왜 중요한가"를 직접 겨냥한 최소 재현 테스트(예: 값-패턴만 걸리는 필드 하나를 골라 `****`(반전 시) vs `***`(정상)를 직접 비교)는 없어, 이 불변식이 다른 대형 리팩터로 우연히 깨져도 원인 진단이 "종합 단언 실패" 수준에 머문다.
  - 제안: 필수는 아님(순서 반전은 실제로 잡힌다). 여유가 있으면 `redactAssistantFields` 근처에 순서 전용 최소 재현 테스트 1건을 추가하면 향후 회귀 시 원인이 즉시 드러난다.

- **[INFO]** 값 축 캐너리가 `error` 필드에만 있고 `inputData`/`outputData` 의 자유 텍스트 값에 대한 직접 캐너리는 없다
  - 위치: `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.spec.ts:534`~`564` (`[캐너리] 값 축` — `error.message`/`error.detail`만 검증)
  - 상세: `redactAssistantFields` 는 `both()` 헬퍼를 `inputData`/`outputData`/`error` 세 필드에 동일하게 적용하므로(`explore-tools.service.ts:92-97`) 위험은 낮지만, 티켓의 원 프로브가 `error.message` 사례였던 만큼 `inputData`/`outputData` 안의 자유 텍스트(예: HTTP 노드가 저장한 body 문자열에 박힌 자격증명)에 대한 캐너리는 아직 없다.
  - 제안: 필수는 아님(공유 헬퍼라 동일 동작 보장). 여유 시 `inputData`/`outputData` 각각에 대해서도 값-축 캐너리 1건씩 추가하면 세 소비 지점이 대칭적으로 잠긴다.

## 확인했지만 문제 없음

- 이전 라운드(`16_46_56` testing.md) WARNING #2 — "`handler-output.adapter.ts` 자매 표면이 자기 테스트로 안 잠긴다" — 는 이번 diff(`handler-output.adapter.spec.ts:92-113`)에서 `it.each` 5건 + 대조군(`endpoint` 비손상)으로 실제로 해소됐고, 위 뮤테이션 M2 재현으로 판별력(5 RED)을 직접 확인했다. Vacuous 아님.
- `mask-sensitive-fields.util.spec.ts` 신규 `it.each` 8건 + `tokenCount` 대조군(부분 문자열 vs 완전 일치)도 뮤테이션 M2 로 판별력 확인(8 RED). 대조군 자체는 현재 구현(Set 완전 일치)에 대해 자명 통과이지만 주석이 그 의도(정규식 전환 캐너리)를 정확히 밝히고 있어 오해 소지 없음.
- `explore-tools.service.spec.ts` 기존 6개 단언(`apiKey`/`Authorization`/`token`/`password`/`clientSecret`/`context.apiKey`)이 `****<last4>` → `***` 로 정확히 갱신됐고, `Object.keys(ne.inputData)` 로 "키 이름은 살아남는다"는 트레이드오프까지 별도 단언으로 고정 — 회귀 테스트로서 유효.
- 테스트 격리: 두 신규 캐너리 모두 각자 `makeService()`로 독립 mock repo 를 새로 만들고(`repos.execution.findOne.mockResolvedValueOnce` 등) 다른 테스트 상태에 의존하지 않는다. 순서 무관 실행 가능.
- Mock 적절성: `deepRedactSecrets`/`maskSensitiveFields` 를 mock 하지 않고 실제 구현을 그대로 태워 종단 검증한다 — 실제 동작과의 괴리 없음. repo 계층만 mock 되어 있고 이는 이 스위트의 기존 패턴과 일관됨.
- `redactAssistantFields` 가 non-export 인 점(이전 라운드 INFO)은 유지됐지만, 두 소비 지점(`toNodeExecutionEnvelope`/`toExecutionEnvelope`)이 기존 스위트로 왕복 검증되고 있어 지금 시점에는 문제 없음.

## 요약

이번 라운드는 이전 리뷰(`16_46_56`)가 지적한 유일한 실질 테스트 갭(WARNING #2, 자매 표면 자기 테스트 부재)이 `handler-output.adapter.spec.ts` 에 `it.each` + 대조군으로 정확히 메워졌음을 뮤테이션 재현(5 RED)으로 독립 확인했다. `mask-sensitive-fields.util.ts`/`explore-tools.service.ts` 양쪽의 신규 동작(token 계열 8개, `deepRedactSecrets` 중첩, 순서 불변식)도 각각 뮤테이션(M2: util 8 RED·adapter 5 RED·explore-tools 18 GREEN 유지, 순서 반전: 2 RED)으로 재현해 판별력이 vacuous 하지 않음을 직접 확인했다. 남은 것은 순서 불변식의 전용 캐너리 부재와 값 축 캐너리가 `error` 필드에만 있다는 두 건의 INFO 뿐이며 둘 다 필수 조치는 아니다.

## 위험도
LOW
