# 유지보수성(Maintainability) 리뷰

## 리뷰 범위에 대한 메모

이번 변경의 실질 코드는 엔티티 데코레이터 정정 6개 파일(`edge.entity.ts` · `integration-expiry-dispatch.entity.ts` ·
`node-execution.entity.ts` · `node.entity.ts` · `workflow-assistant-session.entity.ts` · `workspace.entity.ts`)과
신규 e2e 가드 `codebase/backend/test/entity-schema-declarations.e2e-spec.ts` 다. 나머지(`plan/**`·`review/**`·
`spec/**`)는 계획·리뷰·스펙 문서로 코드가 아니라 위 점검 관점(함수 길이·중첩·매직 넘버 등)이 적용되지 않아
본 리뷰에서는 제외했다.

## 발견사항

- **[INFO]** 엔티티 6개 파일 — 데코레이터 정정이 일관된 패턴을 따른다
  - 위치: `codebase/backend/src/modules/edges/entities/edge.entity.ts:21`,
    `codebase/backend/src/modules/nodes/entities/node.entity.ts:24-27`,
    `codebase/backend/src/modules/workspaces/entities/workspace.entity.ts:21-24`,
    `codebase/backend/src/modules/workflow-assistant/entities/workflow-assistant-session.entity.ts:23-33`,
    `codebase/backend/src/modules/node-executions/entities/node-execution.entity.ts:38-40`,
    `codebase/backend/src/modules/integrations/entities/integration-expiry-dispatch.entity.ts:17`
  - 상세: 여섯 곳 모두 "왜 이 이름·컬럼·조건인가"를 데코레이터 바로 위 주석에 남기고, 이름이 필요 없는
    `@Unique`(자동 이름)는 이유를 명시적으로 적어 이름을 생략했다. `@Check` 두 곳(`edge.entity.ts:21`,
    `node.entity.ts:24-27`)은 named 형태로 통일됐다. 읽는 사람이 "이 선언이 실제 DB 와 같은가"를 코드만
    보고 검증할 수 있는 수준의 가독성이다. 새로 지적할 결함 없음 — 긍정 관찰로 기록.

- **[WARNING]** 신규 e2e 가드의 "매치 없음/이름 불일치" 판정 로직이 세 군데에서 사실상 동일하게 반복된다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:254-265`(인덱스),
    `:274-283`(유니크), `:311-322`(CHECK)
  - 상세: 세 블록 모두 `if (matches.length === 0) { problems.push(...'같은 X 가 없다'...) } else if (givenName && !matches.some(r => r.name === givenName)) { problems.push(...'이름이 다르다'...) }` 형태를 그대로 반복한다. 데코레이터 종류마다 `matches` 를 걸러내는 필터 조건만 다르고 판정·메시지 골격은 동일하다. 지금은 3곳이라 당장 문제는 아니지만, 향후 `@Index`/`@Unique` 판정 규칙이 바뀌면(예: 이름 불일치 허용 조건 추가) 세 곳을 모두 손대야 하고 하나를 놓치기 쉽다.
  - 제안: `reportMissingOrRenamed(problems, label, matches, givenName, noneMessage)` 형태의 공용 헬퍼로 추출해 판정 골격을 한 곳에 모은다.

- **[WARNING]** 라벨 생성용 템플릿 리터럴에 다중 삼항 연산자가 인라인으로 중첩되어 한 줄이 150~240자에 달한다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:232`(186자),
    `:256`(203자), `:356`(240자), `:374`(161자)
  - 상세: 예를 들어 256행은 `real.map((r) => \`${r.name}(${r.cols.join(', ')})${r.uniq ? ' UNIQUE' : ''}${r.pred ? \` WHERE ${r.pred}\` : ''}\`).join(' · ')` 를 다른 템플릿 리터럴 안에 통째로 내장한다. 356행은 FK 라벨 한 줄에 `?? 'NO ACTION'` 두 번 + 문자열 결합까지 겹쳐 240자다. ESLint 에 `max-len`/`complexity` 규칙이 없어(`codebase/backend/eslint.config.mjs` 확인) 도구가 잡아주지 않고, prettier 도 템플릿 리터럴 내부는 줄바꿈하지 않아 그대로 남는다. 실패 메시지 자체의 정보량은 유용하지만, 한 줄로는 눈으로 구조를 따라가기 어렵다.
  - 제안: `formatIndexSummary(idx)` / `formatFkSummary(fk)` 같은 순수 포맷 헬퍼로 분리해 조건부 접미사(UNIQUE·WHERE·ON DELETE 등) 조립을 함수 본문의 일반 분기문으로 풀어쓴다.

- **[INFO]** 인덱스·유니크 판정 `it` 블록이 두 책임(인덱스 검사 + 유니크 검사)을 한 테스트에 담아 67줄이다
  - 위치: `codebase/backend/test/entity-schema-declarations.e2e-spec.ts:222-289`
    (`it('@Index · @Unique · unique: true — ...')`)
  - 상세: `problems` 배열에 쌓인 라벨로 어느 데코레이터가 실패했는지는 구분 가능하지만, 두 책임이 한 `it` 에 있어 테스트 러너 리포트(예: CI 요약)에서는 "인덱스 실패"와 "유니크 실패"가 같은 테스트 이름 아래로 뭉친다. 최대 중첩도 `inRolledBackTx` 콜백 → `for(meta)` → `for(idx)` → `if(idx.where)` → `if(!normalized.ok)` 로 5단계에 이른다.
  - 제안: 필수는 아니나, `@Index`/`@Unique` 를 별도 `it` 로 분리하면 실패 귀인이 테스트 이름 수준에서 바로 드러나고 개별 중첩도 한 단계씩 얕아진다. 현재도 라벨이 충분히 상세해 급하지 않음.

## 요약

실질 코드 변경의 핵심인 엔티티 데코레이터 6곳 정정은 각 결정의 근거를 주석으로 바로 옆에 남겨 가독성·네이밍·일관성 모두 양호하며, 새로 지적할 결함이 없다. 신규 e2e 가드(`entity-schema-declarations.e2e-spec.ts`)는 목적(선언↔DB 전수 대조)에 충실하고 헬퍼 함수 이름·JSDoc 이 명확하지만, "매치 없음/이름 불일치" 판정 골격이 인덱스·유니크·CHECK 세 곳에서 반복되는 중복과, 조건부 접미사를 인라인 삼항으로 중첩해 최대 240자에 달하는 라벨 생성 줄이 유지보수 시 눈에 걸린다. 둘 다 동작에는 영향이 없고 실패 시 진단 정보 자체는 충분하므로 즉시 차단 사유는 아니며, 다음에 이 파일을 손댈 때 헬퍼 추출로 정리하면 되는 수준이다.

## 위험도
LOW
