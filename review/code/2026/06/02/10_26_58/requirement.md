# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [WARNING] `onChange` 타입 계약 위반 — `undefined` 를 `string[]` 로 강제 캐스팅
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` line 66
- 상세: `Props.onChange` 는 `(enabledTools: string[]) => void` 로 선언돼 있지만 `commit` 내부에서 `onChange(undefined as unknown as string[])` 를 호출한다. `mcp-server-selector.tsx` 의 호출 지점(`onChange={(et) => patch(ref.integrationId, { enabledTools: et })}`)이 `et` 를 `string[]` 타입으로 수신하지만 런타임에는 `undefined` 가 도착한다. `McpServerRef.enabledTools?: string[]` 가 `undefined` 를 허용하므로 기능상 올바르게 동작하지만, 타입 계약이 거짓이다 — TypeScript 컴파일 타임 보호가 완전히 우회된다. `McpServerRef.enabledTools` 에 직접 할당하는 다른 경로가 생길 경우 무방비 상태.
- 제안: `Props.onChange` 를 `(enabledTools: string[] | undefined) => void` 로 변경하거나, `mcp-server-selector.tsx` 의 래핑 함수에서 `et === undefined` 분기를 명시적으로 처리.

### [WARNING] `['*']` 값 처리 누락 — spec §5.6 과 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` line 60 (`isEnabled`)
- 상세: `spec/5-system/11-mcp-client.md §5.6` 은 `['*']` 또는 미설정(absent) 모두를 "전체 허용(기본)"으로 정의한다. 구현의 `isEnabled` 는 `enabledTools ? enabledTools.includes(id) : true` 만 처리해 `enabledTools = ['*']` 인 기존 설정이 있으면 모든 체크박스가 unchecked 로 표시된다. 신규 설정에서는 `McpServerRef` 의 `MCP_SERVER_REF_DEFAULTS` 가 `enabledTools` 를 absent 로 두므로 `['*']` 를 저장하는 경로는 없지만, 기존 워크플로 config 나 다른 클라이언트가 `['*']` 를 저장한 경우 UI가 잘못 표시된다.
- 제안: `isEnabled` 를 `enabledTools == null || enabledTools.includes('*') || enabledTools.includes(id)` 로 보강. `base()` 와 `commit()` 의 `sameAsAll` 경로도 동일하게 처리.

### [WARNING] `categoryRestricted` 에 `ops.some()` 사용 — spec 문구와 미묘한 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/cafe24-allowlist-editor.tsx` line 97–103
- 상세: `spec/4-nodes/4-integration/4-cafe24.md §8.3` 은 "scope 전체가 별도 승인 대상인 카테고리 (mileage / notification / privacy) 는 그룹 헤더에 ⚠" 라고 명시한다. 구현은 `ops.some((o) => o.restrictedApproval?.level === "scope")` — 카테고리 내 하나라도 scope-level 제한이 있으면 헤더에 ⚠ 가 표시된다. 현재 실제 메타데이터에서는 mileage/notification/privacy 의 모든 op 에 `level='scope'` 가 부여되므로 기능상 문제 없다. 그러나 향후 같은 카테고리에 일부만 scope-level 인 op 이 추가되면 헤더 ⚠ 가 false-positive 가 될 수 있다.
- 제안: 현재는 INFO 수준 실용적 문제. 메타데이터 SoT (`cafe24-restricted-scopes.md`) 가 카테고리를 통째로 scope-restricted 로 분류하는 구조를 유지하는 한 안전. 향후 혼합 카테고리 추가 가능성이 있다면 `ops.every()` 로 변경 검토.

### [INFO] `sameAsAll → undefined` 복원 경로에 대한 테스트 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/cafe24-allowlist-ui/codebase/frontend/src/components/integrations/__tests__/cafe24-allowlist-editor.test.tsx`
- 상세: `commit` 함수의 핵심 비즈니스 로직인 "명시 배열이 전체 id 와 동일하면 `undefined`(default_true) 로 되돌려 의미 보존" 경로(`sameAsAll` 분기)가 테스트되지 않는다. 계획 파일(plan/in-progress/cafe24-allowlist-ui.md)이 6케이스를 언급하지만 실제 파일에도 6개이고, 그 중 이 경로를 커버하는 케이스는 없다. 이 경로는 사용자가 끈 op 을 다시 켜서 전체 목록이 복원될 때 발동한다.
- 제안: `enabledTools={['product_list', ...ALL_IDS_MINUS_ONE]}` 상태에서 마지막 off op 을 re-enable 하면 `onChange(undefined)` 가 호출되는지 검증하는 테스트 추가.

### [INFO] spec §5.6 default 값 — `undefined` 와 `absent` 개념 구현 충실도
- 위치: `cafe24-allowlist-editor.tsx` JSDoc, `mcp-server-selector.tsx` line 254
- 상세: spec §5.6 표에서 "미설정" = absent(key 자체 없음)이 "전체 허용" 의미다. 구현의 `commit` 에서 `sameAsAll` 시 `undefined as unknown as string[]` 를 전달하고, `patch(ref.integrationId, { enabledTools: undefined })` 로 적용되면 `McpServerRef` 객체에 `enabledTools: undefined` key 가 남는다(key absent vs value undefined 의 차이). `JSON.stringify` 시 `undefined` 값은 직렬화에서 제거되므로 실제 저장 시에는 spec 과 일치. 그러나 런타임 객체에는 key 가 남아 있어 `'enabledTools' in ref` 검사가 있다면 오판할 수 있다.
- 제안: `patch` 함수에서 `enabledTools: undefined` 를 받을 때 해당 key 를 `delete` 처리하거나 spread 전에 정규화. 또는 현재 코드가 `JSON.stringify` 경로를 통해 백엔드로 전송됨을 확인해 INFO 로 종결.

### [INFO] spec §8.3 fidelity — 구현 완전성 확인
- 위치: `spec/4-nodes/4-integration/4-cafe24.md §8.3`
- 상세: spec §8.3 의 모든 요구사항이 구현됐는지 line-level 검토:
  - "bare operation id 배열로 저장" → `enabledTools: string[]` (OK)
  - "카테고리 단위 grouping" → `resources.sort()` 기반 grouping (OK)
  - "scope-level 카테고리 헤더 ⚠" → `categoryRestricted && <ApprovalRequiredBadge>` (OK, some vs every 위 WARNING 참조)
  - "operation-level 행 ⚠" → `opRestricted = level !== 'scope'` (OK, program 포함)
  - "차단 없음 — 안내만" → 체크박스 unchecked 도 허용, 저장 차단 없음 (OK)
  - "backend `restrictedApproval` 자동 렌더" → `readCafe24Extras()` 로 조회 후 렌더 (OK)
  - spec §5.6 `['*']` 처리 → 미구현 (위 WARNING)

### [INFO] `resources.sort()` — 알파벳 정렬, spec 에 정렬 순서 미정의
- 위치: `cafe24-allowlist-editor.tsx` line 59
- 상세: spec §8.3 은 resource 카테고리의 UI 정렬 순서를 명시하지 않는다. 구현은 알파벳 오름차순 정렬 (`sort()`) 을 적용해 매번 일관된 순서를 보장한다. spec 에 순서 정의가 없으므로 spec fidelity 관점에서는 회색지대 — 실용적으로는 무방.
- 제안: 현재 INFO 수준. 필요 시 spec §8.3 에 정렬 순서 한 줄 명시를 project-planner 위임 고려.

## 요약

핵심 기능 구현(resource grouping, scope/operation-level ⚠ 배지, default_true materialize, i18n 신규 3키, 공유 헬퍼 추출, 확장 가능 섹션 연동)은 `spec/4-nodes/4-integration/4-cafe24.md §8.3` 을 충실히 구현하고 있다. 그러나 두 가지 WARNING 이 있다: (1) `onChange` 타입 계약이 내부에서 `undefined` 를 `string[]` 로 강제 캐스팅해 타입 안전성이 깨지고, (2) `spec/5-system/11-mcp-client.md §5.6` 이 허용하는 `['*']` 값을 처리하지 않아 기존 설정에 `['*']` 가 있으면 UI 표시 오류가 발생한다. `sameAsAll → undefined` 복원 경로 테스트 부재 및 `categoryRestricted` 의 `some` vs `every` 의미 차이는 INFO 수준으로, 현재 메타데이터 구조에서는 실질적 문제가 없지만 향후 확장 시 취약점이 될 수 있다.

## 위험도

MEDIUM
