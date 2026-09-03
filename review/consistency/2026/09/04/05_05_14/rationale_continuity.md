# Rationale 연속성 검토

## 범위 확인

- 이 브랜치(`origin/main...HEAD`)는 `spec/conventions/` 를 **변경하지 않았다** (spec 델타 0개 파일). 델타 0 자체는 CRITICAL 근거가 아니다 — 이번 diff 는 코드 전용(`repo-guards`/`source-scan` 인프라 통합 + `nullable-type-lie-cast-guard` 하드닝)이고 `plan/in-progress/entity-nullable-column-type-mismatch.md` 갱신이다.
- 실제 diff (`git diff origin/main...HEAD --stat`, non-review 파일만): `codebase/backend/src/common/__test-utils__/source-scan.{ts,spec.ts}`, `codebase/backend/src/repo-guards/__tests__/{audit-action-binding-guard,engine-error-code-anchor-guard,masked-reject-callers-guard,masked-reject-callers.spec,nullable-type-lie-cast-guard,nullable-type-lie-cast.spec,redis-fail-open-catalog-guard}.ts`, `plan/in-progress/entity-nullable-column-type-mismatch.md`.
- 따라서 이번 검토는 "target 이 spec/conventions 의 Rationale 을 개정했는가" 가 아니라 "이번 코드 변경·plan 서술이 `spec/conventions/*.md` 에 이미 박힌 Rationale/원칙과 충돌하는가" 를 물었다.

## 점검 결과

### 1. 기각된 대안의 재도입 — 해당 없음
`spec/conventions/egress-masking.md` `## Rationale > 기각한 대안`은 "좌표계를 기계가 검사하게 한다(신규 repo-guard)"를 **TS AST 파서가 필요하다**는 이유로 기각하고 "유한한 문제를 무한한 문제와 바꾸지 말 것" 원칙을 인용한다. 이번 PR 이 새로 추가한 `findStaleSpecCasts`(`nullable-type-lie-cast-guard.ts`)는 정확히 이 갈림길에서 **정규식 + `stripComments`/`stripLiterals`** 를 선택했고, docstring 에 "AST 로 옮기는 비용(spec 443개 파싱)을 지금 치를 근거가 없다"는 동일 논거를 명시했다. 즉 기각된 대안(AST 전면 도입)을 재도입한 것이 아니라, 그 기각 논거와 **같은 방향**으로 판단했다 — 위배 없음.
`masked-reject-callers-guard.ts` 는 이미 최초 커밋(`4287cdd5b`)부터 TS AST 를 쓰고 있었고, 이번 diff 는 `listSourceFiles` 를 공용 `collectTsFiles` 로 위임만 한다 — 과거 "정규식 허용목록이 오탐을 은폐했다가 AST 로 되돌렸다"는 코드 내 주석은 `git log`/구 커밋 대조로 실제 이력과 일치한다(날조 아님).

### 2. 합의된 원칙 위반 — 해당 없음
- `collectTsFiles` 는 5개 walker 사본을 실측(`507/818/1261/818/818` 파일셋 동일성 확인) 후 통합했고, 죽은 축(`.d.ts`/`node_modules`/`dist` 제외)도 "지금은 무해하지만 나중에 조용히 틀릴 수 있다"는 이유로 유지했다 — `redis-keys.md §Rationale "왜 규칙을 코드에 맞췄나"` 류의 "실측 후 결정" 패턴과 결이 같다.
- `raw-query-results.md` 가 `source-scan.ts` 를 `code:` 로 소유하지만, 그 문서의 불변식(RETURNING 튜플·snake_case 컬럼)과 이번 추가(`collectTsFiles`/`stripLiterals`)는 별개 축이라 충돌하지 않는다.

### 3. 결정의 무근거 번복 — 해당 없음 (오히려 모범적으로 근거를 남김)
`plan/in-progress/entity-nullable-column-type-mismatch.md` 는 과거 체크박스 두 개를 뒤집으면서 각각 새 Rationale 을 명시했다:
- "가드 사각지대 — `.spec.ts` 의 낡은 캐스트": 원문 "텍스트 스캔으로는 부족하다"는 판단을 반증하며 "그 판단이 방법을 시도하기 전에 내려져 있었다"고 명시.
- "공용 walker 추출": W5 를 배치에서 제외했던 결정을 뒤집으며 4축 실측표(`.spec.ts` 제외만 살아있음)를 근거로 첨부.
두 사례 모두 리뷰 라운드(9R/10R) 지적 → 재실측 → 근거 갱신의 흐름이 코드/plan 양쪽에 남아 있어 "무근거 번복"에 해당하지 않는다.

### 4. 암묵적 가정 충돌 — 해당 없음
`isNullableType`(공백/순서 무관 파싱)로의 교체는 `spec/conventions/swagger.md` 등 nullable 필드 표기 규약을 우회하는 것이 아니라, 기존 `includes('| null')` 판정의 **위음성**(표기 변형 시 조용히 누락)을 좁힌 것이다. `WIDENED_DECL` 의 "관계 데코레이터 1개까지만 인식" 한계는 은폐하지 않고 plan 에 캐너리 부재로 명시 등재했다(`후속 — 관계 데코레이터 동명 충돌에 캐너리가 없다`).

## 참고 — 강한 시그널 아님 (제안)

- **[INFO] 신규 가드 docstring 이 기존 원칙 문서를 인용하지 않는다**
  - target 위치: `codebase/backend/src/repo-guards/__tests__/nullable-type-lie-cast-guard.ts` `findStaleSpecCasts` docstring ("AST 로 옮기는 비용… 지금 치를 근거가 없다")
  - 과거 결정 출처: `spec/conventions/egress-masking.md` `## Rationale > 기각한 대안 > "좌표계를 기계가 검사하게 한다(신규 repo-guard)"` — "유한한 문제를 무한한 문제와 바꾸지 말 것"
  - 상세: 두 판단은 결이 같지만 독립적으로 도달했다. 서로를 인용하지 않아 다음 사람이 "이 저장소의 harness 가드는 AST 보다 정규식+명시적 한계를 기본으로 삼는다"는 저장소 차원의 반복 원칙임을 한 번에 못 본다.
  - 제안: (선택) `nullable-type-lie-cast-guard.ts` docstring 에 `egress-masking.md` Rationale 항을 한 줄 상호 참조하면, 같은 원칙이 두 파일에서 독립 재발견되는 것을 막을 수 있다. 강제 사유는 아니다(코드 리뷰 10라운드가 이미 수렴 처리했고 spec 변경 의무가 있는 결함은 아님).

## 요약

이번 diff 는 `spec/conventions/` 를 건드리지 않았고(델타 0), 실제 변경은 `repo-guards`/`source-scan` 테스트 인프라 통합과 `nullable-type-lie-cast-guard` 하드닝 + 관련 `plan/in-progress` 서술 갱신이다. 코드·plan 양쪽 모두 과거 판단을 뒤집을 때마다 새 실측·새 Rationale 을 동반했고(가드 사각지대 반증, walker 4축 실측, 데코레이터 한계 캐너리 등재), `spec/conventions/egress-masking.md` 가 명시한 "유한한 문제를 무한한 문제와 바꾸지 말 것"(AST 대신 정규식+명시적 한계) 원칙과도 방향이 일치한다. 코드 내 "AST 로 되돌렸다"는 이력 서술도 실제 git 이력과 대조해 날조가 아님을 확인했다. Rationale 연속성 관점에서 CRITICAL/WARNING 급 위반은 발견되지 않았다.

## 위험도
NONE
