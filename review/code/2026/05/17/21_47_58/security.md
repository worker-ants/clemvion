# 보안(Security) 리뷰 결과

## 발견사항

### 파일 1: execution-engine.service.spec.ts (신규 테스트)

- **[INFO]** 테스트 픽스처에 민감 내부 식별자가 평문으로 포함됨
  - 위치: 라인 74–76 (`_resumeState` 내 `systemPrompt`, `llmConfigId` 필드)
  - 상세: `systemPrompt: 'INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST'` 및 `llmConfigId: 'cred-leak-canary'` 값이 테스트 픽스처에 사용되었다. 이 값들은 의도적으로 유출 방지 검증용 canary 로 설계된 것이며, 실제 시크릿이 아닌 테스트 전용 더미 식별자다. 그러나 코드 주석(라인 73)에 "민감 internal state — DB 에 새어 나가면 WARN #6 회귀" 라고 명시하고 있어 의도가 명확하고, 실제 자격증명이 아님.
  - 제안: 변경 없이 허용 가능. 다만 테스트 파일이 CI 로그에 노출될 경우 오해를 살 수 있으므로, 주석에 "더미값" 임을 명확히 표기하는 것을 권장 (현재는 "canary" 라는 표현으로 이미 준충분히 암시됨).

- **[INFO]** `_resumeState` 의 DB 영속 방지 검증은 적절히 구현됨
  - 위치: 라인 121–128
  - 상세: `expect(outputData).not.toHaveProperty('_resumeState')` 와 `JSON.stringify(outputData)` 를 통한 전체 직렬화 검증으로 내부 상태 누출을 두 겹으로 방어한다. 보안 회귀 가드가 올바르게 구성되었다.
  - 제안: 현재 구현 유지.

---

### 파일 2: execution-engine.service.ts (핵심 구현 변경)

- **[WARNING]** `_resumeState` strip 이 shallow copy 에 의존함 — 중첩 객체 내 잔류 가능성
  - 위치: 라인 369–370 (`persistedOutput` 구성 로직)
  - 상세:
    ```typescript
    const persistedOutput: Record<string, unknown> = { ...adaptedNext };
    delete persistedOutput._resumeState;
    ```
    스프레드 연산자(`{ ...adaptedNext }`)는 1-depth shallow copy 다. `adaptedNext` 의 최상위 키 `_resumeState` 는 제거되지만, `adaptedNext` 의 다른 최상위 키(예: `output`, `meta`) 아래 중첩된 객체들은 원본 참조를 그대로 유지한다. 만약 향후 핸들러가 `output.result._resumeState` 또는 다른 중첩 위치에 내부 상태를 배치하는 경우 해당 정보는 DB 에 그대로 영속된다.
    현재 spec 상 `_resumeState` 는 최상위 키로만 정의되어 있어 즉각적인 위협은 아니나, 구조 변경 시 silent 누출 위험이 있다.
  - 제안: 명시적 허용 목록(allowlist) 방식으로 전환을 검토한다.
    ```typescript
    const persistedOutput = {
      output: adaptedNext.output,
      meta: adaptedNext.meta,
      // _resumeState 는 의도적으로 제외
    };
    ```
    또는 `_resumeState` strip 에 대한 단위 테스트를 중첩 위치까지 커버하도록 보강.

- **[INFO]** `nodeExec` null 가드가 적절히 적용됨
  - 위치: 라인 368 (`if (nodeExec)`)
  - 상세: `nodeExec` 가 undefined/null 일 때를 조건 분기로 보호하고 있다. DB 저장 시도 시 null 참조로 인한 예외 발생 가능성이 차단되어 있다.
  - 제안: 현재 구현 유지.

- **[INFO]** `await` 누락 시 트랜잭션 격리 우려 없음 (이미 await 적용)
  - 위치: 라인 375 (`await this.nodeExecutionRepository.save(nodeExec)`)
  - 상세: 비동기 DB 저장이 `await` 로 올바르게 처리되어, 저장 완료 전 다음 상태 전이가 진행되는 race condition 이 방지된다.
  - 제안: 현재 구현 유지.

---

### 파일 3: catalog-sync.spec.ts (경로 수정)

- **[INFO]** 상대 경로 조작으로 인한 경로 탐색(path traversal) 위협 — 테스트 환경 한정
  - 위치: 라인 482–494 (`CATALOG_DIR` 정의, `'..'` 다중 사용)
  - 상세: `join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'spec', ...)` 형태로 7단계 상위 디렉토리를 탐색한다. 이는 테스트 러너 환경의 `__dirname` 이 예상 경로에 있을 때만 올바른 spec 디렉토리를 가리킨다. 만약 테스트가 다른 디렉토리에서 실행되거나 심볼릭 링크가 개입되면 의도하지 않은 경로를 읽을 수 있다. 단, 이 코드는 테스트(spec 파일) 전용이며 프로덕션 서빙 경로가 아니므로 실질적 보안 위협은 낮다.
  - 제안: `process.env.REPO_ROOT` 또는 package.json 상위 탐색 방식으로 경로를 절대화하거나, `path.resolve` + monorepo root 앵커 파일 탐색 방식을 사용하면 더 견고하다.

- **[INFO]** `readdirSync` / `readFileSync` 를 사용한 파일 읽기 — 입력 경로 검증 없음
  - 위치: 라인 626 (`parseCatalogFile(filePath)`) 및 `loadCatalog()`
  - 상세: `CAFE24_RESOURCES` 배열의 각 요소를 직접 파일명으로 조합하여 읽는다. `CAFE24_RESOURCES` 가 하드코딩된 상수이므로 외부 입력이 아니며 경로 인젝션 위협은 없다. 테스트 파일이므로 프로덕션 공격 면적 밖이다.
  - 제안: 현재 구현 유지.

---

### 파일 4: registry.test.ts (경로 수정)

- **[INFO]** `path.resolve(repoRoot, ref.raw)` — frontmatter 경로가 제어되지 않은 경로를 가리킬 가능성
  - 위치: 라인 1208 (`const abs = path.resolve(repoRoot, ref.raw)`)
  - 상세: `ref.raw` 는 mdx 파일의 frontmatter 에서 읽은 `spec` / `code` 경로 값이다. `fs.existsSync(abs)` 로 존재 여부만 확인하고 결과를 단언하는 구조이므로, 악의적인 frontmatter(예: `../../etc/passwd`)가 있더라도 해당 경로의 존재 여부만 확인할 뿐 내용을 읽거나 실행하지 않는다. 실질적 보안 피해는 없으나 정보 수집(파일 존재 여부 oracle) 에 활용될 수 있다. 단, 이는 CI 테스트 환경 전용이며 외부 요청자가 frontmatter 를 조작하려면 PR 을 통해야 한다.
  - 제안: 현재 구현 유지. 필요 시 `ref.raw` 가 `repoRoot` 밖을 가리키는지 검증하는 경계 확인을 추가할 수 있으나, 테스트 컨텍스트에서 필수는 아님.

---

### 파일 5: plan/in-progress/ai-agent-multiturn-waiting-persist.md

- **[INFO]** plan 문서에 내부 구조 정보가 상세히 노출됨
  - 위치: 문서 전체
  - 상세: 취약점 근본 원인, 코드 라인 번호, 내부 함수명이 plan 문서에 기술되어 있다. 이 문서는 버전 관리되어 repo 이력에 영속되므로, 공개 저장소 또는 접근 권한이 넓은 저장소의 경우 내부 구현 상세가 노출된다. 이는 일반적인 개발 프로세스 범위 내의 문서화이며 직접적인 보안 취약점은 아니다.
  - 제안: 비공개 저장소이면 현재 수준 유지. 공개 저장소 전환 시 plan 문서의 상세도 재검토 필요.

---

### 파일 6: review/consistency/2026/05/17/21_25_34/SUMMARY.md

- 보안 관점에서 특기할 사항 없음. 리뷰 메타 문서로 보안 관련 코드 없음.

---

## 요약

이번 변경의 핵심인 `execution-engine.service.ts` 의 `handleAiMessageTurn` waiting 분기 보강은 보안 측면에서 전반적으로 적절하게 구현되었다. 특히 `_resumeState` (내부 turn debug, model state, rawConfig 포함 가능성이 있는 엔진 내부 상태) 를 DB 영속 페이로드에서 제거하는 WARN #6 회귀 방지 처리가 구현 및 테스트 양쪽에서 확인되었다. 다만 현재 strip 방식이 shallow copy + delete 조합이어서 `_resumeState` 가 최상위 키로만 존재한다는 가정에 의존하고 있으므로, 향후 핸들러 구조 변경 시 중첩 위치의 내부 상태가 누출되지 않도록 허용 목록(allowlist) 방식으로의 전환을 권장한다. 테스트 파일들의 경로 탐색 패턴과 frontmatter 경로 검증은 모두 테스트 전용 코드로 실질적 공격 면적이 없다.

## 위험도

LOW
