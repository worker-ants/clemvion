# 문서화(Documentation) 리뷰 결과

## 발견사항

### 1. [INFO] `cafe24-extras.ts` — `resolveCafe24OperationLabel` JSDoc 축약
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/lib/node-definitions/cafe24-extras.ts` (L39-L44)
- 상세: `readCafe24Extras` 는 graceful degradation 동작, 공유 목적, null 반환 조건을 충분히 설명하는 JSDoc 을 갖추고 있다. 반면 `resolveCafe24OperationLabel` 의 JSDoc 은 "Falls back to the raw key" 라고만 기술하고, catalog drift 상황의 의도적 fallback 이유(`spec/conventions/cafe24-api-metadata.md §7.5`)와 `.` 포함 키가 일반 `useT()` 경로와 충돌하는 구조적 이유를 생략했다. 이 정보는 `integration-configs.tsx` 의 원래 JSDoc 에는 명시되어 있었으나 이전 시 누락됐다.
- 제안: JSDoc 에 다음 두 가지를 보완한다. (1) dict 키에 `.` 가 포함되어 일반 `useT(dotted.key)` nested-lookup 흐름과 충돌하므로 flat dict 직접 lookup 을 택한다는 이유. (2) dict miss 시 key 자체를 반환하는 것이 의도적 fallback(catalog drift 즉시 감지 가능)이며 SoT 는 `spec/conventions/cafe24-api-metadata.md §7.5` 임을 명시.

---

### 2. [INFO] `cafe24-allowlist-editor.tsx` — `onChange` Props 타입 시그니처 부정확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` (L520)
- 상세: `Props` interface 에서 `onChange: (enabledTools: string[]) => void` 로 선언하나, 내부 `commit` 함수는 `undefined as unknown as string[]` 을 실제로 넘길 수 있다. JSDoc 에 default_true materialize 동작이 설명되어 있지만, `onChange` 타입이 `undefined` 를 전달 가능함을 타입 레벨에서 표현하지 않아 호출자가 타입 정의만 보고 `undefined` 가 올 수 있음을 알 수 없다.
- 제안: `onChange: (enabledTools: string[] | undefined) => void` 로 변경하거나, JSDoc comment 에 "호출 시 `undefined` 가 전달될 수 있음 — `enabledTools === undefined` 는 default_true(전부 허용) 의미" 를 명시한다. 타입 변경이 상위 Props(`McpServerRef.enabledTools?: string[]`)와 일치하므로 타입 수정이 가장 정확하다.

---

### 3. [INFO] `mcp-server-selector.tsx` — `toggleExpanded` 인라인 주석 위치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/mcp-server-selector.tsx` (L1004-L1012)
- 상세: `expanded` state 선언 위에 "Cafe24 server 별 'Operations allowlist' 펼침 상태 (advanced surface — §1)" 주석이 달려 있어 변수 목적은 설명된다. 그러나 `toggleExpanded` 는 JSDoc 없이 화살표 함수로 인라인 정의되어 있고, immutable Set 복사(`new Set(prev)`) 패턴의 이유(React state 불변성 요구) 가 설명되지 않아 처음 보는 개발자가 왜 `prev.add(id)` 대신 복사 후 수정하는지 이해하는 데 시간이 걸릴 수 있다.
- 제안: `toggleExpanded` 함수 위에 한 줄 주석 `// React state 불변성: Set 은 참조 동일성 유지로 리렌더 미발생 → 새 Set 으로 복사 후 수정` 추가. 또는 가독성 향상을 위해 명명 함수로 분리하는 것도 고려할 수 있다.

---

### 4. [INFO] `cafe24-allowlist-editor.tsx` — `base()`·`commit()` 인라인 주석 일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` (L562-L570)
- 상세: `base()` 는 "undefined(전부 허용) 면 전체 id 로 materialize", `commit()` 는 "명시 배열이 전체 id 와 동일하면 undefined(default_true) 로 되돌려 의미 보존" 이라는 인라인 주석이 있다. 이는 적절하다. 다만 `commit` 내부에서 `onChange(sameAsAll ? (undefined as unknown as string[]) : next)` 는 타입 cast 가 보이는데, 이 cast 가 타입 제약을 우회하는 의도적 결정임을 밝히는 주석이 없다. 타입 불일치 해결의 근거(Props 타입의 불완전성, 의도적 undefined 전달)가 주석에 설명되면 후속 개발자의 혼란을 예방할 수 있다.
- 제안: `onChange(sameAsAll ? (undefined as unknown as string[]) : next)` 앞에 `// Props 타입이 string[] 이나 default_true 보존을 위해 undefined 전달 — 호출자(McpServerRef.enabledTools?)가 undefined 허용` 주석 추가.

---

### 5. [INFO] `integration-configs.tsx` — 대체 주석이 원본 JSDoc 의 degradation 설명을 일부 손실
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/editor/settings-panel/node-configs/integration-configs.tsx` (L79-L81)
- 상세: 원래 `readCafe24Extras` 의 JSDoc 은 "definitions haven't loaded yet (initial editor mount) or when the node ships without extras (older backend)" 라는 두 가지 null 반환 시나리오와 "Operation select shows a 'definitions loading' placeholder and Fields editor falls back to free-form text" 라는 graceful degradation 행동을 상세히 설명했다. 삭제 후 남은 주석은 공유 이유만 간략히 언급하고, 이 graceful degradation 세부 사항은 추출된 `cafe24-extras.ts` 의 JSDoc 에 일부 전달됐으나 "older backend" 케이스와 "free-form text fallback" 설명은 누락됐다.
- 제안: `cafe24-extras.ts` 의 `readCafe24Extras` JSDoc 에 "older backend(extras 없이 배포된 버전)에서도 null 반환되며, 소비자(integration-configs)에서 Fields editor 를 free-form text 로 fallback 함" 을 보완한다.

---

### 6. [INFO] i18n 신규 키 — dict 에 i18n-key 문서화 미비
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/lib/i18n/dict/en/nodeConfigs.ts` (L1108-L1111), `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/lib/i18n/dict/ko/nodeConfigs.ts` (L1134-L1137)
- 상세: `cafe24AllowlistTitle`, `cafe24AllowlistHint`, `cafe24AllowlistLoading` 3개 신규 키가 ko/en 동시 추가됐고 parity 는 확인됐다. 그러나 dict 파일에 해당 키가 어느 컴포넌트에서 사용되는지, 어느 spec 섹션을 구현하는지를 나타내는 인라인 주석이 없다. 기존 키들도 동일하게 주석이 없으므로 프로젝트 관행상 문제는 아니지만, 신규 surface 추가 시 추적성을 높이는 기회다.
- 제안: (optional) `cafe24AllowlistTitle` 바로 위에 `// cafe24-allowlist-editor.tsx — spec §8.3 AI Agent enabledTools 편집 UI` 한 줄 주석 추가. 기존 관행과 동일하게 생략도 수용 가능.

---

### 7. [INFO] 테스트 파일 — `op()` 헬퍼 함수 미문서화
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx` (L141-L157)
- 상세: `op()` 는 테스트 전용 factory 함수이며, 코드 구조는 명확하나 반환 타입이 명시되지 않았다. `Cafe24SupportedOperation` 을 반환하는 의도인지, 의도적으로 느슨한 `as const` 타입인지가 타입 어노테이션 없이는 즉시 파악하기 어렵다. 이는 테스트 코드이므로 낮은 우선도이나, 타입 명시가 fixture data 의 형태를 자체 문서화할 수 있다.
- 제안: `function op(...): Omit<Cafe24SupportedOperation, 'restrictedApproval'> & { restrictedApproval?: Cafe24RestrictedApproval }` 또는 `Cafe24SupportedOperation` 을 반환 타입으로 명시해 fixture 의도를 자체 문서화한다.

---

### 8. [NONE] `plan/in-progress/cafe24-allowlist-ui.md` — 구현 완료 섹션 문서 충실
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/plan/in-progress/cafe24-allowlist-ui.md`
- 상세: plan 파일에 출처, spec 요구사항, 재사용 컴포넌트, 구현 완료 체크리스트, consistency-check 확정 결과, 비목표가 모두 문서화되어 있다. frontmatter(`worktree`, `started`, `owner`, `type`, `parent`) 도 완비됐다. 원 계획 메모와 실제 구현 섹션을 병존시켜 계획-구현 간 drift 를 추적 가능하게 한 점도 긍정적이다.

---

## 요약

이번 변경은 전반적으로 문서화 수준이 양호하다. 핵심 컴포넌트(`Cafe24AllowlistEditor`, `McpServerSelector`)에 목적·동작·spec 참조를 담은 JSDoc 이 작성됐고, 인라인 주석이 복잡한 default_true materialize 로직을 설명하며, plan 파일도 충실하게 기록됐다. 주요 개선 여지는 두 곳이다. 첫째, `resolveCafe24OperationLabel` JSDoc 이 원본 대비 `.` 키 충돌 이유와 spec SoT 참조를 누락했다(INFO #1). 둘째, `onChange` Props 타입이 실제로 `undefined` 를 전달할 수 있음을 타입 레벨 또는 주석에서 명시하지 않아 호출자 혼란 가능성이 있다(INFO #2). 두 사항 모두 코드 정확성에 영향을 주지 않는 문서 품질 이슈이며, 다른 발견사항도 모두 INFO 수준이다.

## 위험도

NONE

STATUS: SUCCESS
