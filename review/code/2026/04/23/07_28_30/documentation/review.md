### 발견사항

---

**[INFO]** `resolve-dynamic-ports.ts` 모듈 수준 JSDoc은 우수하나 `presentationButtonPorts` 함수 본문에 인라인 설명 부재
- 위치: `resolve-dynamic-ports.ts` — `presentationButtonPorts` 함수 (~125–185행)
- 상세: 이 함수는 6개 분기(static items → item.buttons, dynamic itemButtons, global buttons, link-only → continue, no-buttons → fallback)를 처리하는 가장 복잡한 로직을 담고 있다. 다른 단순 함수(`switchPorts`, `classifierCategoriesPorts`)는 형태가 직관적이지만, 이 함수는 `mode`·`supportsItems`·`supportsItemButtons` 3개 플래그가 교차해 각 경로가 왜 필요한지 첫 독자에게 불명확하다. `continue` 포트 폴백 조건(link-type 버튼만 있을 때)이 특히 비자명하다.
- 제안: 함수 서두에 한 줄 주석으로 "port-type 버튼이 하나라도 있으면 strong 포트 반환, link-type만 있으면 weak `continue` 반환, 없으면 static fallback" 패턴을 명시.

---

**[INFO]** `ResolvedPortType` 타입 별칭에 설명 없음
- 위치: `resolve-dynamic-ports.ts:36` — `export type ResolvedPortType = 'data' | 'system' | 'error' | 'control';`
- 상세: `ResolvedPort` 인터페이스의 `type` 필드에서 참조되지만, 각 값(`system`, `control`)이 어떤 맥락에서 사용되는지 설명이 없다. 특히 `control`은 현재 사용처가 없어 보이는데 왜 타입에 포함됐는지 알 수 없다.
- 제안: 각 값에 대한 한 줄 설명 또는 `control`이 미래 확장용임을 명시하는 주석.

---

**[INFO]** `MAX_DANGLING_PORTS = 20` 상한값 근거 미기재
- 위치: `review-workflow.ts:95` — `const MAX_DANGLING_PORTS = 20;`
- 상세: 기존 `MAX_UNRESOLVED = 10`, `MAX_ORPHANS = 20` 은 같은 줄에 설명이 없지만 `MAX_DANGLING_PORTS`도 마찬가지다. 20이 선택된 근거(토큰 예산, 현실적 최대 버튼 수 등)가 코드에서 드러나지 않아 후속 기여자가 조정 시 기준을 알 수 없다.
- 제안: `// carousel + switch 최대 합산 포트 수 상한; LLM 컨텍스트 토큰 예산 고려` 수준의 짧은 인라인 주석.

---

**[INFO]** `resolve-dynamic-ports.spec.ts` 헤더의 프론트엔드 경로 참조가 glob(`*`) 패턴을 사용해 불명확
- 위치: `resolve-dynamic-ports.spec.ts:8` — `"frontend/src/lib/node-definitions/resolve-dynamic-ports.*.spec"`
- 상세: 실제 파일명이 `.spec.ts`인지, `resolve-dynamic-ports.spec.ts`인지 독자가 파악하려면 직접 찾아봐야 한다. 미러 관계는 유지보수 계약의 핵심이므로 정확한 경로가 명시되는 편이 낫다.
- 제안: 와일드카드 없이 실제 파일 경로로 교체.

---

**[INFO]** `isPlanPendingApproval` JSDoc 내 사용처 열거가 코드와 일치하나 RESOLUTION.md와의 용어 불일치
- 위치: `workflow-assistant-stream.service.ts` — `isPlanPendingApproval` JSDoc
- 상세: JSDoc은 "서비스 내 3 곳 (edit 핸들러, `evaluateFinishGuard`, 메인 루프의 plan-only 종료 가드)"를 열거한다. RESOLUTION.md가 이 헬퍼 추출을 `WARNING #1` 조치로 기록한 것과 일치한다. 단, JSDoc에서 `evaluateFinishGuard` 호출 위치를 함수명만으로 표기하고 있어, 함수 시그니처가 바뀌면 JSDoc이 구식이 된다. 현재는 문제 없음.
- 제안: 유지. 단 사용처가 변경될 경우 JSDoc 동기화 필요.

---

**[INFO]** `review-workflow.ts`의 `collectDanglingOutputPorts` JSDoc에서 "ORPHAN_NODES 와 상호 보완" 개념적 링크는 우수하나, `isUserConfigured` 필터 조건이 JSDoc에만 있고 코드 자체에는 인라인 주석 없음
- 위치: `review-workflow.ts` — `collectDanglingOutputPorts` 내 `if (!port.isUserConfigured) continue;` 라인
- 상세: weak 포트 스킵 이유(`default`/`error` 등은 terminal 노드 정상 케이스)가 JSDoc에 설명되어 있지만, 실제 필터 코드 라인에는 주석이 없어 JSDoc을 먼저 읽지 않은 독자는 왜 스킵하는지 알기 어렵다.
- 제안: `// weak 포트(default/error/fallback/continue)는 terminal 노드 정상 케이스` 한 줄 추가.

---

**[INFO]** `memory/workflow-assistant-self-review-and-error-hints.md`의 새 섹션 "Port 해석 (resolve-dynamic-ports.ts)"이 파일 상대 경로를 명시하지 않음
- 위치: `memory/workflow-assistant-self-review-and-error-hints.md` — `tools/resolve-dynamic-ports.ts` 참조
- 상세: "frontend 사본과 드리프트하지 않도록"이라는 유지보수 지침이 있으나, 프론트엔드 SSOT 파일의 정확한 경로가 없어 다음 기여자가 어느 파일과 동기화해야 하는지 찾아야 한다.
- 제안: 프론트엔드 파일 경로를 `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`로 명시.

---

### 요약

전반적인 문서화 수준은 이번 변경에서 눈에 띄게 향상되었다. `resolve-dynamic-ports.ts`의 모듈 JSDoc은 "왜 백엔드에 프론트엔드 로직을 복사하는가"를 명확히 설명하고, `ResolvedPort.isUserConfigured` JSDoc은 strong/weak 구분의 의미와 DANGLING_OUTPUT_PORTS 연결을 잘 표현한다. `memory/` 파일들도 증상-대응-호환성-회귀 테스트 이름까지 구조화되어 후속 유지보수 참조용으로 충분하다. 개선 여지는 `presentationButtonPorts` 함수의 복잡한 분기 로직 설명 부재, `ResolvedPortType`의 `control` 값 용도 불명, `MAX_DANGLING_PORTS` 상한 근거 미기재 등 소규모 누락에 집중된다. 기능 동작에 영향이 없는 낮은 수준의 이슈들이다.

### 위험도
**LOW**