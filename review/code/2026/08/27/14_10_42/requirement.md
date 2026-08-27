### 발견사항

- **[INFO]** 리뷰 시점 워크트리에 이 diff 에 없는 미커밋 뮤테이션이 얹혀 있었다(코드 결함 아님)
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` (`DEFAULT_SENSITIVE_KEYS` 배열, `'authorization',` 다음 줄)
  - 상세: 테스트 실행 중 `DEFAULT_SENSITIVE_KEYS` 에 `'oauthCred'` 항목이 삽입돼 있는 것을 발견했다. `git diff`로 대조한 결과 이 diff(HEAD, `origin/main..HEAD`)에는 이 항목이 없고, 워크트리에만 존재하는 **미커밋 변경**이다 — `review/code/2026/08/27/10_53_52/RESOLUTION.md`가 기술한 M4 뮤테이션(포함관계 캐너리가 실제로 새 키를 검사하는지 검증하기 위해 넣는 가상 키)과 정확히 일치하는 값이라, 동시에 진행 중인 다른 뮤테이션 테스트 세션이 공유 워크트리에 남긴 잔여물로 판단된다. 이 값 때문에 `mask-sensitive-fields.util.spec.ts`의 포함관계 캐너리 1건이 RED 였는데(정확히 그 키만 실패 — 캐너리가 의도대로 동작함을 방증), 이는 **이 PR 의 결함이 아니라 캐너리가 정상 동작한다는 증거**다. 이 파일을 직접 되돌리는 조치는 취하지 않았다(공유 워크트리 원복은 다른 세션을 오염시킬 수 있음).
  - 제안: 조치 불요 — 관찰만 기록. 병렬 세션이 남긴 산물이라면 그 세션이 자체적으로 `cp` 백업 등으로 원복할 것으로 보인다.

- **[INFO]** 해소 확인 — `handler-output.adapter.ts` 의 `config` echo 마스킹 제거가 CHANGELOG·spec 서술과 line-level 로 일치
  - 위치: `codebase/backend/src/modules/execution-engine/handler-output.adapter.ts` (`adaptHandlerReturn`, `config: r.config ?? {}`)
  - 상세: 실제 소스를 직접 열어 확인한 결과 `maskSensitiveFields` 호출이 완전히 제거되고 `config: r.config ?? {}` 로 원문 echo 되며, `CHANGELOG.md`("`config` 가 DB 에 원문으로 저장된다")·`spec/2-navigation/14-execution-history.md` R-5 정정 블록("`config` 는 DB 에 원문으로 저장되고, 나가는 자리에서만 가려진다")과 정확히 일치한다.
  - 제안: 없음(양호).

- **[INFO]** 해소 확인 — egress 마스킹 두 출구(REST/WS)가 실제로 배선돼 있고 포함관계 캐너리가 실제 값에서 파생됨
  - 위치: `codebase/backend/src/shared/utils/redact-stored-error.ts`(`redactStoredDataForResponse`, `redactStoredFieldsForResponse`), `codebase/backend/src/modules/executions/executions.service.ts:704,1005,1069`(`redactNodeExecutionRow`/`redactStoredFieldsForResponse` 호출부), `codebase/backend/src/modules/websocket/websocket.service.ts:460`(`maskWireEnvelope`), `codebase/backend/src/common/utils/mask-sensitive-fields.util.spec.ts`(포함관계 캐너리)
  - 상세: `GET /api/executions/:id` 응답 조립 경로(`executions.service.ts`)가 `nodeExecutions[]` 행에 `redactNodeExecutionRow`를, 최상위 실행 행에 `redactStoredFieldsForResponse`를 실제로 호출해 `config`를 포함한 `outputData`를 `deepRedactSecrets`로 재귀 마스킹함을 코드에서 직접 확인했다. WS 경로도 모든 emit 이 `maskWireEnvelope`를 지난다. 포함관계 캐너리(`mask-sensitive-fields.util.spec.ts`)는 `DEFAULT_SENSITIVE_KEYS`를 `[...DEFAULT_SENSITIVE_KEYS]`로 직접 순회해 각 키가 `deepRedactSecrets`에도 걸리는지 개별 단언하며(HEAD 기준 22개 키, threshold `>15`), `CREDENTIAL_KEY_PATTERN` 정규식이 실제로 특정 자격증명류 이름에 한정된 패턴임(와일드카드 아님)도 확인했다 — 캐너리가 형식적(vacuous)이 아니라 실질적으로 포함관계를 검증한다.
  - 제안: 없음(양호).

- **[INFO]** 해소 확인 — `DEFAULT_SENSITIVE_KEYS` export 후에도 런타임 소비처(`explore-tools.service.ts`)와 무관, 문서 주석과 실제 동작이 일치
  - 위치: `codebase/backend/src/common/utils/mask-sensitive-fields.util.ts` JSDoc, `codebase/backend/src/nodes/ai/ai-agent/ai-turn-executor.ts:3280-3283,3354-3358`, `spec/4-nodes/3-ai/1-ai-agent.md:480,755,979`
  - 상세: `_resumeState`/`_retryState`의 credential 미동봉 근거가 "allow-list 로 애초에 배제"로 정정된 문구가 코드 주석 2곳과 spec 3곳 모두에서 정확히 대응(취소선 + 정정 + 날짜 + 근거)한다. `assembleSingleTurnConfigEcho`/`buildMultiTurnConfigEcho`의 allow-list 필드 목록에 `llmConfigId`가 없다는 spec 서술도 실측과 일치한다(직접 grep 검증은 이번 라운드 이전 리뷰가 수행, 이번 검증은 spec/코드 주석 표현 정합만 재확인).
  - 제안: 없음(양호).

- **[INFO]** 해소 확인 — `setStructuredOutput`(참조 저장) vs `setEngineResolvedConfig`(shallow-copy) 비대칭이 JSDoc·테스트·구현 3자 일치
  - 위치: `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:137-160`, `codebase/backend/src/modules/execution-engine/context/execution-context.service.spec.ts`(`setStructuredOutput — 참조 저장` describe)
  - 상세: 구현이 `context.structuredOutputCache[nodeId] = adapted;` (참조 그대로 저장)임을 직접 확인했고, JSDoc 이 hop 1(`adaptHandlerReturn` — 어댑터 spec 이 고정)과 hop 2(이 메서드 — 이 spec 파일이 고정)를 명시적으로 분리해 각각의 캐너리를 정확히 지목한다. 신규 캐너리 2건(identity `toBe`, 반환 후 변형 가시성)과 자매 대조군(`setEngineResolvedConfig`의 shallow-copy `not.toBe`)이 실제 구현과 100% 정합한다 — 함수명·JSDoc·테스트·구현 간 괴리 없음.
  - 제안: 없음(양호).

- **[INFO]** spec fidelity 재검증 — 이전 라운드가 지적한 미러 스윕 잔여(`boundary masking parity` 개명 미전파, `node-output.md` Principle 0 모순, R-5 W2 노드 서술 오류)가 실제로 전부 해소됨을 grep + 소스 대조로 독립 재확인
  - 위치: `spec/`(전체) + `codebase/`(전체) `grep "boundary masking parity"` → 0건(잔존은 `plan/complete/**`·`review/**` 스냅샷뿐, 컨벤션상 의도적 미수정). `spec/conventions/node-output.md:23`(Principle 0 `config` 정의가 "마스킹은 egress 에서만"으로 정정됨). `spec/2-navigation/14-execution-history.md:483-490`(R-5 W2가 "Send Email 해당 없음 / HTTP Request `integration` 모드 해당 없음 / 실제 남는 표면은 `authentication='custom'`"으로 좁혀짐). `codebase/backend/src/modules/websocket/websocket.service.ts:448`(JSDoc이 "egress masking parity"로 정정됨).
  - 상세: 이 PR 은 5라운드 코드 리뷰 + 3라운드 consistency-check 를 거쳤고, RESOLUTION.md 들이 스스로 "미러 스윕이 반복해서 갈렸다"고 기록한 이력이 있다. 이번 최종 상태를 직접 소스 대조로 재확인한 결과 각 라운드가 지적한 항목들이 실제로 현재 HEAD 에 반영돼 있으며, 새로운 미러 스윕 잔여는 발견되지 않았다.
  - 제안: 없음(양호). 이미 트래커에 등재된 잔여 항목(크로스-노드 자격증명 릴레이 근본 처방, `chatChannel` 로컬 마스커 통합, `DEEP_REDACT_CACHE` identity 캐시 잠재 위험 — 오늘 도달 불가로 판정됨)은 이 PR 의 스코프 밖으로 남기는 것이 타당하다.

### 요약

핵심 기능 변경(`handler-output.adapter.ts` 에서 config echo 마스킹을 제거해 표현식이 원문을 읽게 하고, 안전성을 egress(WS `maskWireEnvelope` / REST `redactStoredDataForResponse`) 단독 책임으로 옮긴 것)을 소스 코드·테스트·spec 3자 직접 대조로 독립 검증한 결과, 의도한 기능이 완전히 구현돼 있고 CHANGELOG·`spec/2-navigation/14-execution-history.md` R-5·`spec/conventions/node-output.md` Principle 0/7 등 관련 spec 본문과 line-level 로 일치한다. 이 변경은 이미 5라운드 코드 리뷰(CRITICAL 1건 → 해소, WARNING 다수 → 전부 해소)와 3라운드 consistency-check(CRITICAL 2건 → 모두 planner 턴으로 해소)를 거쳤으며, 각 라운드가 스스로 기록한 "미러 스윕이 반복 갈렸다"는 자기비판적 이력을 이번 라운드에서 grep + 소스 직접 대조로 재확인한 결과 잔여 drift 는 발견되지 않았다(`boundary masking parity` 등 개명 전 문구는 `spec/`·`codebase/` 전체에서 0건, `plan/complete/**`·`review/**` 스냅샷에만 관례대로 잔존). 포함관계 캐너리는 실제 상수에서 파생하며 vacuous 하지 않고, 참조 저장 vs shallow-copy 비대칭도 JSDoc·테스트·구현이 정확히 정합한다. 유일한 관찰 사항은 리뷰 시점 공유 워크트리에 이 diff 와 무관한 미커밋 뮤테이션 테스트 잔여물(`DEFAULT_SENSITIVE_KEYS`에 `oauthCred` 삽입)이 있었다는 것으로, 이는 이 PR 의 결함이 아니라 오히려 포함관계 캐너리가 실제로 동작한다는 방증이다. 이미 문서화·트래커 등재된 트레이드오프(크로스-노드 자격증명 릴레이, safe-by-convention 전환, `chatChannel` 로컬 마스커 정규식 비대칭, `DEEP_REDACT_CACHE` identity 잠재 위험)는 신규 미문서화 결함이 아니라 이번 PR 이 스스로 인지·수용·등재한 것으로 확인되므로 차단 사유가 아니다.

### 위험도
LOW
