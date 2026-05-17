# 부작용(Side Effect) 리뷰 결과

## 발견사항

### 파일 1: execution-engine.service.ts (핵심 변경)

- **[WARNING]** `nodeExec` null-check 통과 후 `nodeExecutionRepository.save` 호출 — 비동기 부작용 발생 위치가 한 곳 추가됨
  - 위치: 변경 diff 중 `if (nodeExec) { ... await this.nodeExecutionRepository.save(nodeExec); }` 블록 (약 line 2369~2377 기준)
  - 상세: 기존 `handleAiMessageTurn` 의 `waiting_for_input` 분기에는 DB 저장이 없었다. 이번 변경으로 해당 분기 진입 시마다 `NodeExecution` 행이 추가로 업데이트된다. 이 자체는 의도된 수정이나, 해당 `await` 이전에 이미 `contextService.setNodeOutput` 및 `eventEmitter` 를 통한 WS emit 이 선행된다. DB persist 실패(예: DB 일시 불가)가 발생해도 WS 메시지는 이미 브로드캐스트된 상태이므로, 클라이언트와 DB 상태 간 일시 불일치가 발생할 수 있다. 이는 Button 대기(`waitForButtonInteraction`) 및 첫 turn(`emitAiWaitingForInput`)도 동일한 구조를 가지고 있어 새로 도입한 비일관성은 아니나, 해당 위험이 이 경로에도 적용된다.
  - 제안: 현 구조를 그대로 따라가는 것은 기존 패턴과 일관되어 수용 가능하다. 추후 해당 시퀀스 전반에 걸쳐 emit-then-save 패턴의 원자성 개선이 필요하다면 트랜잭션 범위를 재검토한다.

- **[INFO]** `_resumeState` delete 연산은 shallow copy(`{ ...adaptedNext }`) 위에서 수행됨
  - 위치: `const persistedOutput: Record<string, unknown> = { ...adaptedNext }; delete persistedOutput._resumeState;`
  - 상세: spread shallow copy 후 최상위 키 `_resumeState` 를 제거하므로, `adaptedNext` 원본 객체는 변경되지 않는다. 의도한 strip 동작이 올바르게 구현되어 있다. 단, `_resumeState` 내부 참조 객체(messages 배열 등)는 `persistedOutput` 과 `adaptedNext` 가 동일 참조를 공유하므로, 이후 코드에서 해당 중첩 객체를 뮤테이트할 경우 양쪽에 영향을 준다. 현재 코드 흐름에서는 직후 `nextResumeState` 가 `adaptedNext._resumeState` 를 별도 참조로 사용하므로 실질적 문제는 없으나, 방어적 deep-clone 이 더 안전하다.
  - 제안: 보안·일관성 측면에서 `persistedOutput` 생성 시 `structuredClone(adaptedNext)` 또는 `JSON.parse(JSON.stringify(adaptedNext))` 후 `_resumeState` 를 삭제하면 중첩 참조 공유를 원천 차단한다.

- **[INFO]** 나머지 변경 3건(두 곳의 `buildEdgeIndexes` 호출, `isPortFiltered` 두 곳)은 순수 코드 포매팅(줄 바꿈·들여쓰기) 변경으로 동작 변경 없음
  - 위치: diff line 323~332, 1266~1345, 3215~3394 영역
  - 상세: 함수 호출 인수 배치만 변경되었고 호출 시그니처·인수 값은 동일하다. 부작용 없음.
  - 제안: 없음.

---

### 파일 2: execution-engine.service.spec.ts (테스트 추가)

- **[INFO]** 테스트 내 `mockNodeExecutionRepo.save.mockClear()` 호출은 이전 테스트에서 누적된 호출 기록을 초기화하는 부작용이 있음
  - 위치: 추가된 테스트 케이스 중 `mockNodeExecutionRepo.save.mockClear();` (line 84 상당)
  - 상세: `beforeEach` 에서 mock 이 재생성되므로 `describe` 블록 내 다른 테스트와의 간섭은 없다. 해당 `.mockClear()` 는 "첫 turn 의 save 호출을 제외하고 후속 turn 만 검증"하기 위한 의도적 리셋이다. 부작용 없음.
  - 제안: 없음.

- **[INFO]** 테스트에 하드코딩된 내부 식별자 문자열(`INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST`, `cred-leak-canary`)은 canary 목적으로만 사용되며 실제 서비스 코드에 노출되지 않는다. 테스트 격리 수준이 적절하다.

---

### 파일 3: catalog-sync.spec.ts (경로 픽스)

- **[INFO]** `CATALOG_DIR` 경로 hop 수 7 → 8로 증가 (`'..'` 하나 추가)
  - 위치: `join(__dirname, '..', '..', '..', '..', '..', '..', '..', 'spec', ...)` (line 433~492 상당)
  - 상세: `readdirSync` 와 `readFileSync` 를 통해 실제 파일시스템 읽기가 발생하는 테스트다. 경로가 잘못 설정되면 테스트 실행 시 파일시스템 조회 오류가 발생하거나 엉뚱한 디렉토리를 읽는 부작용이 생긴다. 이번 변경은 path 정확도를 높이는 수정이므로 올바른 방향이다. 단, 절대 경로(`__dirname` 기반 상대 hop)는 디렉토리 구조가 바뀔 때마다 취약하다.
  - 제안: 장기적으로 `CATALOG_DIR` 을 환경 변수나 Jest/Vitest config 의 `rootDir` 기반 상수로 선언해 hop 수 의존성을 제거하는 것을 권장한다.

---

### 파일 4: registry.test.ts (경로 픽스)

- **[INFO]** `repoRoot` 경로 hop 수 5 → 6으로 증가
  - 위치: `path.resolve(__dirname, '..', '..', '..', '..', '..', '..')` (line 956 상당)
  - 상세: `fs.existsSync` 및 `loadDocsIndex` 를 통한 파일시스템 읽기가 발생한다. 경로 픽스 자체는 정확도 개선이나, 파일 3과 동일하게 hop 수 하드코딩은 구조 변경에 취약하다. `hasRealDocs` 가드(`fs.existsSync(realDocsRoot)`)로 content/docs 부재 시 테스트가 skip 되므로, 경로가 다소 어긋나더라도 CI 폭파가 아닌 skip 처리된다. 그러나 `repoRoot` 가 잘못 설정되면 "존재하는 경로"가 다른 파일을 가리킬 수 있어 false-pass 위험이 있다.
  - 제안: 파일 3과 동일. 테스트 루트 설정을 config 레벨에서 주입하거나, `process.cwd()` 기반 경로 확인 로직으로 검증 레이어를 추가한다.

---

### 파일 5: plan/in-progress/ai-agent-multiturn-waiting-persist.md

- **[INFO]** 신규 plan 문서. 파일시스템 부작용 없음. frontmatter 에 `worktree`, `started`, `owner` 가 규약에 맞게 기재되어 있다.

---

## 요약

이번 변경에서 가장 주목할 부작용은 `execution-engine.service.ts` 의 `handleAiMessageTurn` waiting 분기에 추가된 `nodeExecutionRepository.save` 호출이다. 이는 의도된 버그 수정이며 기존 `emitAiWaitingForInput` / `waitForButtonInteraction` 와 동일한 패턴을 따라 일관성 있게 구현되었다. 단, `persistedOutput` 생성 시 shallow copy 사용으로 중첩 객체 참조가 공유되며, 보안에 민감한 `_resumeState` 내부 데이터가 이후 코드 경로에서 변이될 경우 `persistedOutput` 에도 영향을 줄 수 있다 — 현 코드 흐름에서는 실질 문제가 없으나 방어적 deep-clone 이 권장된다. 경로 hop 수 정정(파일 3, 4)은 파일시스템 읽기의 정확도를 높이는 수정이지만, 하드코딩된 상대 경로 패턴은 구조 변경 시 다시 깨질 위험이 있어 장기적 개선이 필요하다. 나머지 변경(포매팅, 테스트 추가)은 부작용이 없다.

## 위험도

LOW
