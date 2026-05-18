# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts (주석 변경)

- **[INFO]** 테스트 주석이 구현 의도를 명확히 설명하도록 개선됨
  - 위치: diff hunk (`// surface loudly instead of finishing as no-ops.` 이하 3줄)
  - 상세: 기존 주석 "Schema-level `loop:no-count` warning catches this at design time" 은 이미 제거된 warningRule 을 참조하는 stale 설명이었다. 신규 주석은 `zod default('1')` 의 역할, 정책 근거(spec §8), 그리고 throw 가 여전히 남아야 하는 이유(레거시 데이터·직접 DB 기록 경로)를 순서대로 서술해 의도를 명확히 전달한다.
  - 제안: 현재 상태로 충분. 추가 개선 불필요.

### 파일 2: loop.handler.spec.ts (테스트 케이스 교체)

- **[INFO]** 테스트 이름이 행동 기반 설명으로 전환되어 가독성이 향상됨
  - 위치: `it('accepts missing count — zod default("1") fills it ...')` (line 383, 439)
  - 상세: 기존 `'rejects missing count'` 라는 이름은 코드 동작과 반대되는 설명이었다(실제로는 통과해야 하는 케이스). 새 이름에 정책명과 spec 참조 위치(`spec §8`)를 포함시켜 코드만으로 근거를 추적할 수 있다.
  - 제안: 현재 상태로 충분.

- **[INFO]** 인라인 주석이 테스트 의도를 보완하지만 한국어·영어 혼용
  - 위치: `loop.handler.spec.ts:441-442` (`// handler.validate 는 raw config 만 본다...`)
  - 상세: 동일 파일 내 다른 테스트는 영어 주석을 쓰는 경향이 있으나(예: `// Principle 7 — raw template preserved`) 신규 추가분은 한국어 주석을 사용한다. 기능상 문제는 없으나 언어 일관성 측면에서 경미한 불일치.
  - 제안: 코드베이스 전체 컨벤션이 혼용을 허용하고 있다면 현 상태 유지. 통일이 필요하면 영어로 전환하거나 프로젝트 차원의 컨벤션 결정 필요.

### 파일 3: loop.schema.spec.ts (테스트 구조 정리)

- **[INFO]** 불필요해진 `describe('loop:no-count')` 블록 전체 제거로 dead test 코드가 삭제됨
  - 위치: diff `-32 ~ -12` 구간 (loop:no-count describe 블록 전체)
  - 상세: warningRule 이 제거된 이후에도 테스트를 그대로 두면 테스트가 통과하더라도 존재 자체가 오해를 유발한다. 제거가 올바른 조치다.
  - 제안: 현재 상태로 충분.

- **[INFO]** 빈 `describe('loopNodeMetadata.warningRules')` 블록 유지 및 단일 설명형 테스트로 대체
  - 위치: `loop.schema.spec.ts:597-603`
  - 상세: `warningRules: []` 를 단순히 제거하지 않고 "의도적으로 비어있다"는 설명을 담은 테스트로 남긴 것은 향후 유지보수자에게 실수로 warningRule 이 추가되는 상황을 막는 의도적 선택이다. 단, `describe` 블록 내 테스트 하나만 있는 구조는 간결하고 명확하다.
  - 제안: 현재 상태로 충분.

### 파일 4: loop.schema.ts (핵심 구현 변경)

- **[INFO]** 인라인 주석이 설계 결정의 근거를 충분히 담고 있음
  - 위치: `loop.schema.ts:755-758` (`.meta()` 내 주석), `loop.schema.ts:868-873` (`warningRules: []` 상단 주석)
  - 상세: 두 위치 모두 `default('1')` 정책, warningRule 제거 이유, spec 참조 위치를 명시한다. 주석 내용이 중복되는 경향이 있지만 각 위치에서 독립적으로 읽혀야 하는 컨텍스트 차이가 있어 허용 가능한 수준이다.
  - 제안: 두 주석이 유사한 내용을 반복하는 점은 가볍게 인지. 긴 시간이 지난 후 하나만 갱신되고 다른 하나는 stale 이 될 위험이 있으므로, 미래에는 한 곳(예: `warningRules` 주석)을 정규 위치로 삼고 `.meta()` 주석은 한 줄 참조로 줄이는 방향을 고려할 수 있다.

- **[WARNING]** `validateLoopConfig` 내 `count` 와 `maxIterations` 의 파싱 로직이 부분 중복
  - 위치: `loop.schema.ts:827-853` (`validateLoopConfig` 함수 전체)
  - 상세: `count` 와 `maxIterations` 각각에 대해 `loopLooksLikeExpression` 호출 → `loopParseNumeric` 호출 → null 체크 → 값 범위 체크 순서가 반복된다. 현재는 두 필드뿐이라 큰 문제가 아니지만, 향후 필드가 추가되면 패턴 복사가 이어질 수 있다.
  - 제안: 즉각 리팩토링이 필수적인 수준은 아니나, 중기적으로 `parseNumericField(value): number | null | 'expression'` 같은 헬퍼를 추출하면 필드별 분기 로직을 단순화할 수 있다.

- **[INFO]** `loopParseNumeric`/`loopLooksLikeExpression` 함수명 prefix(`loop`) 일관성
  - 위치: `loop.schema.ts:805-818`
  - 상세: 모듈 내부 helper 함수임에도 `loop` prefix 가 붙어있다. 파일이 `loop.schema.ts` 이므로 prefix 가 중복 정보지만, TypeScript 모듈 내에서 충돌 방지 차원의 의도적 선택일 수 있다. export 되지 않는 함수이므로 동작에 영향 없음.
  - 제안: 현재 상태 유지. 추출하거나 공유 헬퍼로 이동할 경우에만 이름 재검토.

### 파일 5: backend-labels.ts (i18n 매핑 삭제)

- **[INFO]** 사용되지 않는 i18n 항목 정확히 제거됨
  - 위치: `WARNING_KO` 레코드 내 `"Count must be entered."` 항목 (diff line -895)
  - 상세: warningRule 삭제와 동일 commit 에 i18n 매핑을 함께 제거한 것은 Principle 3 (삭제 방향 포함) 가드를 올바르게 준수한 것이다. dead translation 항목이 남으면 향후 parity guard 테스트에서 오탐이 발생할 수 있었다.
  - 제안: 현재 상태로 충분.

### 파일 6-7: plan 문서

- **[INFO]** plan 문서 상태 마킹이 정확하고 추적 가능함
  - 위치: `loop-count-policy.md` 체크리스트, `node-config-required-defaults-sweep.md` follow-up 섹션
  - 상세: 분리된 항목에 strikethrough + 참조 링크 + 결정 사유 한 줄 요약이 명시되어 있어 두 plan 문서를 동시에 볼 때 중복 작업·경합 위험을 파악하기 쉽다.
  - 제안: 현재 상태로 충분.

### 파일 8: consistency-check SUMMARY.md

- **[INFO]** 리뷰 산출물이므로 코드 유지보수성 분석 대상에서 제외. 문서 자체 구조는 명확하고 체계적.

---

## 요약

이번 변경은 dead warningRule(`loop:no-count`) 제거와 이에 연동된 테스트·i18n·주석 정리로 구성된다. 변경 범위가 명확하게 한정되어 있고, 제거 이유가 각 파일(schema 주석, spec §8 참조, 테스트 이름)에서 일관되게 표현되어 있다. 테스트는 "왜 이 동작이 맞는가"를 설명하는 방향으로 재작성되어 미래 유지보수자의 혼란을 방지한다. 지적할 만한 주요 이슈는 `validateLoopConfig` 내 `count`/`maxIterations` 파싱 패턴이 부분 중복된다는 점(WARNING 1건)이나, 현재 두 필드만 존재하므로 즉각 리팩토링이 필수적이지는 않다. 주석이 두 위치에 유사 내용을 반복하는 패턴은 미래 stale 위험이 있으나 현시점에서는 허용 가능하다. 전반적으로 유지보수성 관점에서 양호한 변경이다.

## 위험도

LOW
