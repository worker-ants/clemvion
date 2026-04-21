## 발견사항

### [WARNING] `handleExploreCall` 에 `get_current_workflow` 케이스 없음
- **위치:** `workflow-assistant-stream.service.ts` — `handleExploreCall` switch, 그리고 이를 호출하는 분기(`kind === 'explore'` 블록)
- **상세:** `get_current_workflow`는 `TOOL_KIND_BY_NAME`에 `'explore'`로 등록되어 있지만 `handleExploreCall`의 switch에는 케이스가 없다. 현재는 `if (ev.name === 'get_current_workflow')` 선행 체크로 정상 동작하나, 훗날 리팩토링으로 해당 조건부가 제거되면 `default` 경로에서 `{ ok: false, error: 'UNKNOWN_EXPLORE_TOOL' }`를 조용히 반환한다.
- **제안:** `handleExploreCall`의 switch에 `case 'get_current_workflow': throw new Error('handled separately');` 같은 방어 코드를 추가하거나, 별도 핸들러 맵으로 추출해 암묵적 분기를 제거할 것

---

### [WARNING] 도구 description에 config redact 미언급
- **위치:** `tool-definitions.ts:114` — `get_current_workflow` description 문자열
- **상세:** 스펙(§4.1)은 반환 형식을 "`{ok, nodes, edges}` (config는 redact 적용)"으로 명시하지만, 도구 description에는 이 사실이 없다. LLM이 API 키·시크릿 값을 기대하고 후속 편집 판단을 내릴 경우 혼란이 생길 수 있다.
- **제안:** description 끝에 `"Sensitive config fields (API keys, tokens) are redacted to [REDACTED]."` 한 줄 추가

---

### [INFO] 시스템 프롬프트 스냅샷 vs `buildCurrentWorkflowResult` 엣지 형식 비대칭
- **위치:** `system-prompt.ts:46-52` vs `workflow-assistant-stream.service.ts:452-458`
- **상세:** 시스템 프롬프트 스냅샷의 엣지 객체에는 `id` 필드가 없지만, `buildCurrentWorkflowResult`의 엣지 객체에는 `id`가 포함된다. 두 형식이 다르면 "프롬프트 스냅샷에 없는 필드가 `get_current_workflow` 결과에는 있다"는 혼선이 생길 수 있다. 기능상 `get_current_workflow`가 더 완전하지만, 비일관성 자체가 LLM의 추론을 교란할 수 있다.
- **제안:** 시스템 프롬프트 스냅샷 엣지에도 `id`를 포함시키거나, `buildCurrentWorkflowResult`에서 의도적으로 제외했음을 주석으로 명시

---

### [INFO] `toolOwnerId` 반환 여부 미명시
- **위치:** `workflow-assistant-stream.service.ts:443-472` — `buildCurrentWorkflowResult`
- **상세:** `toShadowSnapshot`에서 `toolOwnerId`를 shadow에 적재하지만 `buildCurrentWorkflowResult`에는 포함하지 않는다. 시스템 프롬프트 스냅샷도 동일하게 제외하므로 의도적으로 보이나, 스펙 §4.1 반환 형식에 명시되지 않았다. 툴 소유 노드 관련 편집 시나리오에서 LLM이 이 필드를 필요로 할 경우를 대비해 명시적 결정이 문서화되어 있어야 한다.

---

### [INFO] package-lock.json peer 플래그 변경
- **위치:** `frontend/package-lock.json` — 다수 패키지의 `"peer": true` 추가/제거
- **상세:** npm이 자동 생성하는 lock 파일 변경이며 기능에 영향 없음. `react`, `react-dom`, `zod`, `immer` 등이 peer → 직접 의존성으로 재분류된 것은 실제 사용 패턴과 일치한다.

---

### 요약

`get_current_workflow` 도구의 신규 구현은 스펙 §4.1·§8의 2-tier 조회 설계(프롬프트 스냅샷 우선 → 편집 후 재확인 시만 도구 호출)를 올바르게 반영하고 있으며, config redact·SSE kind=explore 분류·히스토리 persist까지 요구사항을 빠짐없이 충족한다. 테스트도 초기 상태 반환, 편집 후 상태 반영, redact 적용 세 케이스를 모두 커버한다. 단, `handleExploreCall` switch에 케이스가 없어 리팩토링 시 무음 실패가 발생할 수 있는 구조적 취약점과, 도구 description에 redact 정책이 누락되어 LLM 추론에 혼란을 줄 수 있는 문서 gap이 존재한다.

### 위험도

**LOW**