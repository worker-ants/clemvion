# 유지보수성(Maintainability) 리뷰

## 발견사항

### 파일 1: execution-engine.service.spec.ts (신규 테스트 케이스)

- **[INFO]** 테스트명이 검증 의도를 충분히 설명하고 있음
  - 위치: 라인 46 (`it('persists outputData ...')`)
  - 상세: 테스트 이름이 세 가지 검증(messages 누적, interactionType 마킹, _resumeState strip)을 모두 담고 있어 다소 길지만, 회귀 가드 성격을 명확히 전달한다. 테스트 선두 주석(버그 설명, spec 참조)도 유지보수자가 배경을 즉시 파악하기에 충분하다.
  - 제안: 현 상태 유지 가능. 필요 시 `describe` 블록으로 세 케이스(A/B/C)를 분리하면 실패 시 메시지가 더 구체적이다.

- **[WARNING]** 검증 체인 내 중간 변수가 `unknown`-로부터 연쇄 캐스팅되어 타입 안전성이 낮고 이후 수정 시 오류 탐지가 늦음
  - 위치: 라인 104–106
    ```ts
    const output = outputData.output as Record<string, unknown> | undefined;
    const result = output?.result as Record<string, unknown> | undefined;
    const messages = result?.messages as Array<Record<string, unknown>>;
    ```
  - 상세: 각 단계에서 `as` 캐스팅을 반복하면 타입 시스템의 보호를 우회한다. 실제 타입이 변경되어도 컴파일 시점에 감지되지 않는다. 테스트 코드라도 캐스팅 체인은 유지보수 부담이다.
  - 제안: `NodeHandlerOutput` 또는 내부 출력 타입을 import해 좁히거나, 테스트 전용 타입 헬퍼(`getNestedProp<T>()`)를 추출한다. 최소한 `messages` 캐스팅은 `Array.isArray` 검사 후 진행하도록 순서를 조정한다.

- **[INFO]** `mockNodeExecutionRepo.save.mockClear()` 이후 `continueAiConversation` 호출 패턴이 기존 테스트들과 일관됨
  - 위치: 라인 84–87
  - 상세: 첫 turn의 save 호출을 초기화하고 후속 turn만 검증하는 패턴은 다른 테스트 케이스와 동일하며, 의도가 주석으로 명시되어 있다. 일관성 유지됨.
  - 제안: 없음.

- **[INFO]** 보안 canary 문자열 리터럴이 테스트 코드 두 곳에 산재
  - 위치: 라인 74–75 (fixture 정의)와 라인 125–128 (검증)
  - 상세: `'INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST'`와 `'cred-leak-canary'`가 두 군데 분산되어 있다. 문자열을 바꾸면 두 곳을 모두 수정해야 한다.
  - 제안: 상수로 추출한다.
    ```ts
    const CANARY_SYSTEM_PROMPT = 'INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST';
    const CANARY_CRED_ID = 'cred-leak-canary';
    ```

---

### 파일 2: execution-engine.service.ts (핵심 버그 픽스)

- **[INFO]** 새 블록의 인라인 주석이 상세하고 맥락을 충분히 제공함
  - 위치: 라인 353–368 (diff 기준)
  - 상세: 왜 이 save가 필요한지, 어느 spec 구절과 대응하는지, 기존 어떤 패턴과 미러링하는지 주석으로 명시되어 있다. 향후 수정자가 배경을 재조사하지 않아도 된다.
  - 제안: 없음.

- **[INFO]** `if (nodeExec)` null 가드의 의도가 명시되지 않음
  - 위치: 라인 369 (`if (nodeExec) {`)
  - 상세: `nodeExec`가 어떤 조건에서 falsy인지 주석이 없다. 기존 코드 패턴과 일치하는 방어적 가드이지만, 이 상황에서 `nodeExec`가 없을 수 있는 경로(워크플로 초기화 미완, race condition 등)에 대한 설명이 있으면 유지보수에 도움이 된다.
  - 제안: `// nodeExec may be undefined if the node execution was not yet persisted (e.g. background-only path)` 형태의 짧은 설명 추가를 고려.

- **[INFO]** 긴 메서드 인자 줄바꿈이 이 PR에서 일괄 적용됨 (코드 포맷 일관성 개선)
  - 위치: 라인 323–332, 340–345, 386–394, 400–408 (diff 기준)
  - 상세: `buildEdgeIndexes`, `isPortFiltered` 등의 3-인자 호출을 Prettier 포맷에 맞게 줄바꿈한 변경이다. 의미 없는 변경처럼 보일 수 있지만 코드베이스 포맷 일관성을 높인다.
  - 제안: 포맷 전용 커밋은 별도로 분리하는 것이 이상적이나, 현재 규모(4건)는 허용 범위.

---

### 파일 3: catalog-sync.spec.ts (`CATALOG_DIR` 경로 수정)

- **[WARNING]** `__dirname` 기준 상대 경로 체인이 7단계(`..` × 7)로 취약함
  - 위치: 라인 483–494 (전체 파일 컨텍스트)
    ```ts
    const CATALOG_DIR = join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'spec', ...);
    ```
  - 상세: `..` 반복 횟수는 파일이 이동될 때 즉시 깨진다. 이미 한 번 실패했으며(commit 33521233 후 경로 업데이트 누락), 같은 문제가 재발할 가능성이 높다. 위 주석(`7 hops back`)이 추가되었지만 단위 자체의 취약성은 해결되지 않는다.
  - 제안: `__dirname` 대신 `process.cwd()` (프로젝트 루트에서 실행 보장 시) 또는 `path.resolve(__dirname, '../../../../../../..')` 를 `REPO_ROOT` 상수로 추출하고, 두 테스트 파일(catalog-sync.spec.ts, registry.test.ts)이 공유하는 헬퍼 `repoRoot()` 유틸을 `__tests__/helpers.ts`에 두는 것을 권장한다.

- **[INFO]** 수정 이유를 설명하는 주석이 명확하게 추가됨
  - 위치: 라인 429–431 (diff 기준)
  - 상세: commit hash(`33521233`)와 변경 사유가 주석으로 기록되어 있어 히스토리 추적이 가능하다.
  - 제안: 없음.

---

### 파일 4: registry.test.ts (`repoRoot` 경로 수정)

- **[WARNING]** `repoRoot`가 `..` × 6 체인으로 하드코딩 — catalog-sync.spec.ts와 동일한 취약점
  - 위치: 라인 1188
    ```ts
    const repoRoot = path.resolve(__dirname, "..", "..", "..", "..", "..", "..");
  - 상세: 파일 3(catalog-sync.spec.ts)과 같은 구조적 취약점이다. 두 파일이 동일한 문제를 독립적으로 해결하고 있어 중복 패턴이 형성되었다.
  - 제안: 공유 유틸 추출 (파일 3 제안과 동일).

- **[INFO]** 주석이 수정 동기를 명확하게 설명함
  - 위치: 라인 953–955 (diff 기준)
  - 상세: commit 33521233 참조와 hop 수 설명이 포함되어 있어 유지보수에 도움이 된다.
  - 제안: 없음.

---

### 파일 5: plan/in-progress/ai-agent-multiturn-waiting-persist.md

- **[INFO]** plan 문서 구조가 CLAUDE.md 규약과 완전히 일치함
  - 위치: frontmatter + 전체 구조
  - 상세: `worktree`, `started`, `owner` frontmatter 모두 기재, 체크박스 라이프사이클 준수, consistency-check 결과 인라인 기록 등 프로젝트 컨벤션을 충실히 따른다.
  - 제안: 없음.

---

### 파일 6: review/consistency/2026/05/17/21_25_34/SUMMARY.md

- **[INFO]** 리뷰 산출물 파일이므로 코드 유지보수성 관점의 별도 지적 사항 없음
  - 위치: 전체
  - 상세: consistency-check 결과 아티팩트로서 해당 경로 규약(`review/consistency/<YYYY>/<MM>/<DD>/...`)을 준수한다.
  - 제안: 없음.

---

## 요약

이번 PR은 AI Agent multi-turn 후속 turn에서 `NodeExecution.outputData`가 DB에 영속되지 않던 버그를 수정하는 집중도 높은 변경이다. 핵심 픽스(`execution-engine.service.ts`)는 기존 `emitAiWaitingForInput` / `waitForButtonInteraction` 패턴을 그대로 답습하여 코드베이스 일관성을 유지하고 있으며, 인라인 주석이 풍부해 의도를 파악하기 쉽다. 테스트 케이스는 세 가지 검증 포인트(messages 누적, interactionType 마킹, _resumeState strip)를 한 테스트에 담은 점이 다소 밀도 있지만, 각 검증에 주석이 붙어 있어 가독성이 보완된다. 주요 유지보수 위험은 `catalog-sync.spec.ts`와 `registry.test.ts`의 `..` 반복 경로 패턴으로, 동일한 문제가 이미 한 번 발생했고 두 파일에서 독립적으로 해결되어 중복이 생겼다. 공유 `repoRoot()` 헬퍼 추출이 미래 재발을 방지하는 데 가장 효과적인 개선책이다. 테스트 코드 내 보안 canary 문자열이 두 곳에 분산된 점도 소규모지만 상수 추출로 개선 가능하다. 전체적으로 변경 범위가 좁고 기존 패턴을 잘 따르고 있어 유지보수성 부담이 낮다.

## 위험도

LOW
