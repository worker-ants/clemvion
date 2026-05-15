### 발견사항

- **[INFO]** `llm.service.ts`의 `resolveConfig` 에러 메시지 개선이 범위 경계선에 위치
  - 위치: `llm.service.ts` diff +2~+9 (`resolveConfig` 내부)
  - 상세: 핵심 기능(execution-engine의 no-llm-provider 에러 후필터)과 직접 관련 없는 `resolveConfig`의 에러 메시지 개선(workspaceId 포함, 한국어 메시지)이 동일 PR에 포함됨. `hasDefaultLlmConfig` 추가와 함께 묶인 이유는 이해되지만, 엄격히 보면 별개 변경임. 이에 대한 테스트(`should include workspaceId in error message and payload`, `should distinguish missing workspaceId case`)도 `llm.service.spec.ts`에 추가됨.
  - 제안: 기능상 무해하고 관련 컨텍스트에 위치하므로 분리 여부는 팀 컨벤션에 위임. 단, 커밋 메시지나 PR 설명에 이 부분을 명시적으로 기술하는 것이 좋음.

- **[INFO]** `workflow-canvas.tsx`의 신규 노드 `llmConfigId` 자동 채우기는 실행 허용 논리와 별개의 UX 동작
  - 위치: `workflow-canvas.tsx` +100~+132
  - 상세: execution-engine의 후필터 기능은 "노드에 llmConfigId가 없어도 workspace 기본 LLM이 있으면 실행을 통과"시키는 것이다. 반면 canvas의 `buildInitialConfig`는 "노드를 추가할 때 기본 LLM ID를 미리 채운다" — 즉 실행 허용이 아닌 초기 상태 설정이다. 두 동작은 상호보완적이지만 논리적으로 분리되어 있음.
  - 제안: 두 동작이 같은 사용자 스토리("워크스페이스 기본 LLM이 있으면 AI 노드가 정상 동작")를 완성한다는 점에서 한 PR에 포함하는 것은 합리적. 범위 위반은 아니나, 변경 의도 문서에 명시 권장.

- **[INFO]** `llm-config-selector.tsx`와 관련 테스트/i18n 변경이 execution-engine 수정과 병렬 포함
  - 위치: `llm-config-selector.tsx`, `en.ts`, `ko.ts`, `llm-config-selector.test.tsx`
  - 상세: 셀렉터 UI 개선(기본 LLM 이름 표시, 미설정 경고 힌트)은 사용자가 현재 동작을 인지하도록 돕는 정직한 UX 개선이며, 기능의 투명성을 높임. 단, 이 변경만으로도 독립적인 PR이 될 수 있는 단위임.
  - 제안: 범위 위반이 아님. 한 PR로 묶는 것이 사용자 스토리 완결성 측면에서 더 좋음.

- **[NONE]** 나머지 변경들(`llm-provider-rule.ts` 신규 생성, schema 파일 3종 상수 교체, `node-config-summary.ts` export 추가)은 모두 최소한의 필요 변경이며 범위 내에 정확히 위치함.

---

### 요약

변경셋 전체는 "AI 노드에서 명시적 LLM 미설정 시 워크스페이스 기본 LLM을 이용해 정상 실행"이라는 단일 사용자 스토리를 backend·frontend 양단에서 완성하는 응집도 높은 변경이다. 무관한 파일 수정이나 불필요한 리팩토링은 없으며, `resolveConfig` 에러 메시지 개선과 canvas 노드 초기 설정 자동화가 엄밀히는 부수적 동작이지만 모두 동일한 관심사 범위 내에 위치한다. 범위 위반 수준의 문제는 없고, 각 변경이 왜 필요한지 주석과 테스트에서 명확히 설명되어 있어 유지보수성도 양호하다.

### 위험도

**LOW**