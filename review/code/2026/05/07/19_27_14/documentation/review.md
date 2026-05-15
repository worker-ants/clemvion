## 문서화 리뷰

### 발견사항

---

- **[WARNING]** `jest-e2e.json` — `transformIgnorePatterns` 패키지 선정 근거 누락
  - 위치: `backend/test/jest-e2e.json`, `transformIgnorePatterns` 배열
  - 상세: `uuid | p-limit | yocto-queue` 세 패키지를 트랜스폼 예외로 지정한 이유(ESM-only 패키지라 CJS Jest에서 직접 실행 불가)가 어디에도 기록되지 않았다. `app.e2e-spec.ts`의 블록 주석이 "transformIgnorePatterns 누락"을 언급하지만 **왜 이 세 패키지인지**는 설명하지 않는다. 향후 `nanoid` 등 다른 ESM-only 패키지를 도입하는 개발자가 같은 규칙을 어디에 추가해야 하는지 알 수 없다.
  - 제안: JSON 파일에는 주석을 쓸 수 없으므로, `app.e2e-spec.ts`의 블록 주석 또는 `backend/README.md`에 다음을 추가한다.
    ```
    # E2E Jest 설정
    jest-e2e.json의 transformIgnorePatterns는 ESM-only 패키지(uuid, p-limit, yocto-queue)를
    ts-jest가 트랜스폼하도록 허용한다. 새 ESM-only 패키지 추가 시 동일 패턴에 추가할 것.
    ```

---

- **[INFO]** `ai-agent.handler.ts` — `KB_TOOL_GUIDANCE` 상수에 JSDoc 없음
  - 위치: `backend/src/nodes/ai/ai-agent/ai-agent.handler.ts:113`
  - 상세: 이 상수는 LLM의 KB 도구 호출 전략 전체를 결정하는 "행동 지침 프롬프트"다. 이번 변경으로 전략이 "병렬 호출 허용"에서 "능동적 의도 분해 후 단위별 호출"로 명확히 전환됐는데, 상수 자체에 JSDoc이 없어 향후 문구를 수정하는 사람이 변경의 의도와 LLM 응답에 미치는 영향을 파악하기 어렵다.
  - 제안:
    ```typescript
    /**
     * KB tool이 등록된 경우 system prompt 끝에 자동 주입되는 검색 전략 지침.
     * LLM이 사용자 입력을 지식 단위로 분해해 단일 주제 query 를 병렬 호출하도록
     * 유도한다 (agentic RAG). 문구 변경 시 kb-tool-provider.ts의 tool description
     * 및 spec/5-system/9-rag-search.md §1 과 일관성을 유지해야 한다.
     */
    const KB_TOOL_GUIDANCE = ...
    ```

---

- **[INFO]** `kb-tool-provider.ts` — 클래스 JSDoc이 신규 전략을 반영하지 않음
  - 위치: `backend/src/nodes/ai/ai-agent/tool-providers/kb-tool-provider.ts`, `KbToolProvider` 클래스 JSDoc
  - 상세: 클래스 수준 JSDoc은 "LLM 이 사용자 의도에 맞는 KB 를 자율 선택·동시 호출하도록 한다"고 기술한다. 이번 변경의 핵심인 **query 단위 분해(intent decomposition)** 가 빠져 있어, `buildTools`의 `description` 문구 변경 의도를 클래스 수준에서 이해하기 어렵다.
  - 제안: JSDoc 마지막 줄에 "각 tool 호출은 단일 지식 단위 query 만 담으며, LLM이 의도 분해 후 병렬 호출하도록 description과 KB_TOOL_GUIDANCE로 유도한다."를 추가.

---

- **[INFO]** `ai-agent.handler.spec.ts` — multi-turn 병렬 테스트의 `resumeState` 필수 필드 명시 없음
  - 위치: `ai-agent.handler.spec.ts`, `'runs provider tools in parallel on multi-turn resume too'` 테스트, `resumeState` 객체
  - 상세: `processMultiTurnMessage`의 private 메서드를 type cast로 직접 호출하면서 `resumeState`를 수동 구성했다. 어떤 필드가 병렬 실행 경로에서 실제로 필요한지(예: `knowledgeBases`, `maxToolCalls`, `messages`) 와 단지 타입 오류를 막기 위해 채운 필드(예: `ragLastDiagnostics: undefined`)가 구분되지 않는다. 테스트가 깨질 때 최소 재현 조건을 파악하기 어렵다.
  - 제안: `resumeState` 선언부에 한 줄 주석 추가: `// knowledgeBases·maxToolCalls·messages 가 병렬 실행 경로의 필수 입력; 나머지는 타입 충족용`.

---

- **[INFO]** `app.e2e-spec.ts` — 스킵 해제 조건이 미기재
  - 위치: `backend/test/app.e2e-spec.ts`, 블록 주석
  - 상세: "인프라 셋업이 정비되기 전까지 스킵"이라고 명시됐으나, '정비됐다'고 판단하는 기준(Docker Compose 환경 변수 설정, CI 환경 준비 등)이 없다. 스킵을 해제해야 할 시점을 모르는 신규 팀원이 영구 스킵으로 방치할 수 있다.
  - 제안: 주석에 "해제 조건: `docker compose --profile app up` 환경에서 `GET /` 라우트가 추가되면 `describe.skip` → `describe` 로 복원"과 같이 조건을 명기.

---

### 요약

전반적인 문서화 품질은 높다. 스펙 문서(`3-ai-nodes.md`, `9-rag-search.md`) 가 구현과 동기화됐고, 핸들러 코드의 인라인 주석이 병렬 실행·batch truncate의 설계 근거를 충분히 서술한다. 테스트 주석도 각 케이스의 검증 의도를 한국어로 명확하게 설명한다. 주요 보완 포인트는 `jest-e2e.json`의 ESM 패키지 목록 선정 이유(유지보수 시 확장 기준 불명) 와 `KB_TOOL_GUIDANCE` 상수의 JSDoc 누락(문구 변경 시 영향 범위를 명시해야 회귀를 막을 수 있음) 두 가지다.

### 위험도
**LOW**