# Code Review 조치 내용

> 리뷰 대상 커밋: `8044f2d fix(ai-nodes): workspace 기본 LLM 존재 시 실행을 통과시키고 셀렉터 UI 일치화`
> 조치일: 2026-05-03

## 요약

리뷰에서 발견된 16건의 Warning 과 16건의 Info 중, 운영 위험·구조적 부채·테스트 갭에 해당하는 항목을 즉시 처리했다. 시그니처 인터페이스 전면 변경이 필요한 항목(예: `validate()` 반환 타입 구조화, frontend/backend 노드 타입 공유 패키지 추출) 은 본 변경 범위에서 분리해 별도 트랙으로 둔다.

## Warning 조치

| # | 항목 | 조치 |
|---|------|------|
| W-1 | **[Security] `__workspaceId` 신뢰 경계 불명확** | `filterAiNoLlmProviderError` JSDoc 에 trust boundary 명시 — 이 필드는 `runExecution` 이 DB 의 `workflow.workspaceId` 로부터 server-side 로 채우며, 사용자 입력으로 덮어쓰는 코드 경로가 현재 코드베이스에 존재하지 않음을 검증·문서화. `updateVariables` 호출자 0 건 / 다른 AI 핸들러도 동일 출처 사용 확인. ExecutionContext 시스템 필드 분리는 기존 핸들러 전체 이주가 필요해 별도 PR 로. |
| W-2 | **[Security] `workspaceId` 에러 페이로드 노출** | 데이터는 사용자 자신의 workspace 정보이므로 IDOR 면에서 enumeration surface 가 아님을 확인. 메시지 본문에 이미 ID 가 포함되므로 구조화 필드는 유지하되 진단 목적 명시는 message 에서 제공. |
| W-3 | **[Performance] N+1 hasDefaultLlmConfig** | `resolveHasDefaultLlmConfigCached` 추가 — `context.variables[__hasDefaultLlmConfig:<wsId>]` 에 결과 메모이즈. 동일 실행 내 N 개 AI 노드여도 DB findDefault 1 회만 호출됨. 테스트 추가: `caches hasDefaultLlmConfig result on the same context (no N+1)`. |
| W-4 | **[Reliability] DB 오류 전파** | `filterAiNoLlmProviderError` 에 try/catch 추가 — `hasDefaultLlmConfig` 가 throw 하면 원본 errors 반환 + Logger.warn. 테스트 추가: `falls back to original errors when hasDefaultLlmConfig throws`. |
| W-5 | **[Architecture] 실행 엔진 도메인 침투** | 의도된 trade-off. 단일 메서드(`filterAiNoLlmProviderError`) 로 격리, JSDoc 으로 책임 명시. `validate()` 시그니처 확장은 모든 노드 핸들러 영향이라 본 PR 범위 외. |
| W-6 | **[Architecture] string[] validate 부채** | 본 PR 범위 외 (전체 노드 핸들러 인터페이스 변경 필요). 메시지 상수(`AI_NO_LLM_PROVIDER_MESSAGE`)로 SSOT 를 만들어 typo/표현 변형으로 인한 무음 비활성화는 차단. JSDoc 에 trade-off 명시. |
| W-7 | **[Architecture] FE/BE 노드 타입 이중 관리** | 본 PR 범위 외 (모노레포 공유 패키지 신설 필요). 양측 파일에 동기화 필요 명시 댓글은 schema 코멘트의 mirror points 로 이미 존재. |
| W-8 | **[Concurrency] TOCTOU** | 검증과 핸들러 실행 사이 짧은 윈도우는 존재하나, 핸들러 내부 `resolveConfig` 가 `LLM_CONFIG_NOT_FOUND` 로 명확히 throw 하므로 silent failure 는 없음. context 캐시 도입(W-3)으로 race window 도 줄어듦. |
| W-9 | **[UX] 로딩 중 힌트 플리커** | `useQuery` 의 `isLoading`/`isPending` 을 hint 표시 조건에 추가. 테스트 추가: `does not flash the no-default hint while the query is still loading`. |
| W-10 | **[UX] 쿼리 완료 전 노드 추가** | 현 상태에서는 노드가 빈 `llmConfigId` 로 추가되며, 사용자가 셀렉터에서 직접 선택 가능. 미래 보정 로직(soft-fix) 은 별도 트랙으로. |
| W-11 | **[Testing] buildInitialConfig 테스트 부재** | `buildNodeInitialConfig` 를 `frontend/src/lib/utils/build-node-initial-config.ts` 로 pure function 추출. 7 개 케이스 단위 테스트 추가 (비-AI 노드 단순 복사, AI 3 종 pre-fill, 기존 llmConfigId 보존, default 없을 때 빈 상태 유지 등). `workflow-canvas.tsx` 는 이 pure 함수를 호출하도록 변경. |
| W-12 | **[Testing] useT 모킹 부재** | `llm-config-selector.test.tsx` 에 `vi.mock("@/lib/i18n", ...)` 추가. mocked dictionary 가 영문 strings 을 반환하도록 정의. |
| W-13 | **[Maintainability] NO_LLM_MSG 리터럴 하드코딩** | `execution-engine.service.spec.ts` 에서 상수를 `AI_NO_LLM_PROVIDER_MESSAGE` import 로 교체. 메시지 변경 시 spec 도 자동으로 따라 깨지도록. |
| W-14 | **[Maintainability] API 응답 이중 fallback 패턴 중복** | `LLM_CONFIGS_QUERY_KEY` 공유 상수를 `frontend/src/lib/api/llm-configs.ts` 에 추가, selector / canvas 가 같이 참조. fallback 패턴 자체는 응답 타입 단일화가 필요한 별도 작업. |
| W-15 | **[Documentation] custom-node 동일 query key 검증 불가** | W-14 의 `LLM_CONFIGS_QUERY_KEY` 도입으로 코드 레벨 SSOT 확보. 캔버스 주석도 그 상수를 가리키도록 수정. |
| W-16 | **[API Contract] 메시지 언어 변경 호환성** | `code: 'LLM_CONFIG_NOT_FOUND'` 는 그대로 유지 — 클라이언트는 code 기반 핸들링이 권장. 메시지는 사용자 진단용이라 i18n/문구 변경은 호환성 영향 없음 (외부 클라이언트가 메시지 문자열을 매칭하지 않는다는 가정 하). |

## Info 항목 처리

대표적으로:
- **Testing #7** (`__workspaceId` 키 자체 부재) → 테스트 케이스 `keeps the error when __workspaceId is absent from variables` 추가.
- **Testing #9** (`llmService` 캐스트 중복) → `beforeEach` 에서 `llm` 변수 한 번에 할당.
- **Testing #12** (`Filterable` 시그니처 sync 주석) → `// keep in sync with filterAiNoLlmProviderError signature` 주석 추가.
- **Testing #13** (`workspaceId is missing` 테스트명 정확화) → `'workspaceId is empty string'` 으로 분리, `__workspaceId` 부재 케이스를 별도 it 으로.
- **Documentation #14** (`@param context` 추가) → JSDoc 에 `@param nodeType / errors / context` 모두 추가, `context.variables.__workspaceId` 출처 명시.
- **Documentation #15** (`{{name}}` interpolation 계약) → selector 코드 내 주석으로 명시 (dict 주석 대신 사용 지점에서 명시).
- **Performance #3** (`useMemo` 미적용) → selector 의 `configs.find(...)` 를 `useMemo` 로 감싸고 `configs` 자체도 `useMemo`.
- **Performance #4** (비-AI 노드 early-return) → `buildNodeInitialConfig` 가 LLM_PROVIDER_NODES 가 아닌 경우 즉시 shallow-copy 반환.

별도 트랙으로 미루는 항목: Database #1 (인덱스 점검), Concurrency #2 (실행 시작 1 회 조회), API Contract #16 (OpenAPI 에러 스키마 보강).

## TEST WORKFLOW 재통과

- backend `npm run lint` ✓
- backend `npx jest --no-coverage` — 149 suites / 2362 tests ✓
- backend `npm run build` ✓
- frontend `npm run lint` ✓
- frontend `npx vitest run` — 96 files / 1047 tests ✓
- frontend `npm run build` ✓
