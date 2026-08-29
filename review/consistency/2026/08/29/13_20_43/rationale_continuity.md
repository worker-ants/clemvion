# Rationale 연속성 검토 결과

## 검토 범위

- 검토 모드: `--impl-done`, scope=`spec/5-system/`, diff-base=`origin/main`
- 실제 코드 diff(`origin/main...HEAD -- code_areas`)는 4개 파일뿐이다:
  - `codebase/backend/src/modules/execution-engine/expression/expression-resolver.service.spec.ts`
  - `codebase/backend/src/modules/secret-store/secret-resolver.service.ts` (주석만, 로직 변경 없음)
  - `codebase/backend/src/nodes/data/code/code.handler.spec.ts`
  - `codebase/packages/expression-engine/src/__tests__/error-shape.spec.ts` (신규)
- 이 4곳 전부 `spec/5-system/3-error-handling.md §6.3.1`(`Error.cause` 부착 기준 C1/C2)에 걸린 캐너리 테스트/주석 보강이다. 그래서 이번 검토는 §6.3.1 및 그 `## Rationale` 항목에 집중했다.
- 확인 결과 `spec/5-system/**`는 이번 브랜치에서 **diff 가 전혀 없다** (`git diff origin/main...HEAD -- spec/` 공백). 즉 §6.3.1 본문·Rationale 자체는 이번 PR 이전에 이미 `origin/main`에 정본화되어 있었다 (`git log -S` 확인: 커밋 `44346ec81 docs(spec): Error.cause 부착 기준을 §6.3.1 로 정본화 — 검토가 기준 자체를 고쳤다 (#1230)`). 이번 diff는 그 기존 결정을 **코드/테스트로 강제**하는 후속 작업이다.

## 발견사항

- **[INFO]** `secret-resolver.service.ts` 주석의 "형제 3곳" 표현이 실제로는 4곳
  - target 위치: `codebase/backend/src/modules/secret-store/secret-resolver.service.ts:93` (이번 diff 대상 라인이 아님 — 인접 기존 라인)
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §6.3.1` Rationale — "`Error.cause` 부착 기준을 '소비처가 직렬화하는가' 로 잡지 않은 이유" 항목이 C1/C2 를 함께 서술하는 지점을 열거
  - 상세: `expression-resolver.service.ts`/`.spec.ts`·`code.handler.ts`/`.spec.ts` 넷이 "형제"인데 주석은 "형제 3곳"이라 서술한다. 다만 이는 새 diff 로 도입된 drift 가 아니라 **이미 `plan/in-progress/deps-peer-gating-and-eslint10.md`에 리뷰 INFO #3 으로 등록되어 "다음에 그 파일을 열 때" 항목으로 명시 추적 중**인 기존 결함이다 — Rationale 을 몰래 번복한 것이 아니라 이미 인지·기록된 잔여 정리 항목.
  - 제안: 이번 diff 범위 밖이라 즉시 수정을 요구하지 않는다. 다음에 `secret-resolver.service.ts` 를 여는 세션에서 plan 항목대로 "3곳"→"4곳" 정정하면 된다.

## 상세 근거 (충돌 없음 확인)

1. **기각된 대안의 재도입 여부** — 이번 diff 는 `secret-resolver.service.ts` 에 주석만 추가했는데, 그 내용이 정확히 §6.3.1 Rationale 이 이미 "명시적으로 기각"했다고 적어 둔 대안("`.cause` 가 지금 소비처에서 직렬화되는가"를 판정 기준으로 삼는 안)을 **재도입하지 않도록 오인을 차단**하는 방향이다. 오히려 과거 rationale_continuity 검토(plan 상 `--impl-done 01_30_29` INFO #2)가 지적한 "보조 근거가 판정축처럼 읽힐 수 있다"는 우려를 그대로 해소한 커밋이다. 재도입 없음.
2. **합의된 원칙 위반 여부** — §6.3.1 의 C1(message 포함)·C2(민감 속성 부재) 두 조건, 그리고 "판정 축은 enumerable own key" 원칙을 신규 테스트(`error-shape.spec.ts`, `it.each` 확장)가 그대로 따른다. 화이트리스트(`code`/`name`/`position`)·`preserve-caught-error` 억제 주석 포맷(`eslint-disable-next-line preserve-caught-error -- <사유>`)도 spec 서술과 문자 그대로 일치한다.
3. **결정의 무근거 번복 여부** — 번복이 아니라 강화(주석→테스트 캐너리로 전환)다. plan 문서에 4라운드에 걸친 실측(뮤테이션 5/5, 9/9 GREEN→치명적 약점 발견→정확값 비교로 교정 등)이 상세히 기록되어 있고, 그 결과가 이번 diff 다.
4. **암묵적 가정 충돌 여부** — `ExpressionError` 하위 클래스가 실제로는 6종(Syntax/Reference/Type/Function/Timeout/DepthExceeded)이라는 새로 확인된 사실을 spec 문서 본문을 고치지 않고도 "클래스 전수 열거" 축(신규 패키지 테스트)으로 흡수했다 — spec 이 클래스 개수를 못박은 바가 없으므로 이는 invariant 우회가 아니라 커버리지 보강이다.

## 요약

이번 PR(`eslint10-upgrade`, `#1219`/`#1233` 계열)의 실제 코드 diff는 4개 파일에 한정되며, 전부 `spec/5-system/3-error-handling.md §6.3.1`에 **이미 정본화된 `Error.cause` 부착 기준(C1/C2)**을 테스트 캐너리로 강제하는 후속 작업이다. `spec/5-system/**` 자체는 이번 브랜치에서 변경되지 않았고(§6.3.1 은 선행 PR #1230 에서 이미 확정), 코드 쪽 변경은 과거 Rationale 이 명시적으로 기각한 대안("소비처 직렬화 여부를 판정축으로")을 재도입하지 않도록 오인 소지를 없애는 주석 보강과, C1/C2 원칙을 정확값 단언·전수 열거로 강화하는 신규 테스트로 구성된다. plan 문서에 4라운드 코드 리뷰 실측(뮤테이션 결과 포함)과 이전 rationale_continuity 검토 지적사항의 반영 이력이 남아 있어 추적 가능성도 충분하다. 발견된 유일한 항목("형제 3곳"→실제 4곳 서술 오차)은 이번 diff 대상이 아닌 인접 기존 주석이며 이미 plan 에 별도 추적 중이라 신규 위반으로 볼 수 없다.

## 위험도

NONE
