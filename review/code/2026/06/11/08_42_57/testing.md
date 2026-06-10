# Testing Review — KB 검색 불가 상세 배너 (옵션 ③)

## 발견사항

### [INFO] `owner` 역할 CTA 노출 테스트 미포함
- 위치: `/codebase/frontend/src/components/knowledge-base/__tests__/unsearchable-banner.test.tsx`
- 상세: `admin` 역할 회귀 가드 케이스는 추가됐으나 `owner` 역할(role hierarchy 최상위) CTA 노출은 명시 테스트가 없다. `RoleGate` 구현상 `minRole="editor"` 비교가 `ROLE_LEVEL[role] >= ROLE_LEVEL[minRole]` 이므로 `owner` 도 통과해야 하지만, `admin` 과 별개로 `owner` 를 커버하는 케이스가 없어 role 계층표에 향후 변경이 생길 경우 회귀가 무음으로 통과될 수 있다.
- 제안: `setRole("owner")` 케이스를 admin 케이스 옆에 추가하거나, admin 케이스를 `owner` 와 `admin` 을 `it.each` 로 묶어 처리.

### [INFO] `in_progress + viewer` 조합 텍스트 노출 테스트 부재
- 위치: `unsearchable-banner.test.tsx`
- 상세: `in_progress` 케이스는 `editor` 역할로만 검증한다. viewer 가 `in_progress` 상태의 배너를 볼 때 "Re-embedding…" 텍스트와 desc 단락이 정상 노출되는지(CTA 가 없음은 in_progress 분기 자체가 CTA 를 숨기므로 역할 무관하지만, 텍스트 노출은 역할 독립적임을 명시적으로 확인하지 않는다).
- 제안: 낮은 우선순위이나 역할 독립성을 명시하려면 `in_progress + viewer` 조합 한 케이스 추가.

### [INFO] `pending=true` 상태의 Loader2 아이콘 렌더 여부 미검증
- 위치: `unsearchable-banner.test.tsx` — "idle + editor + pending" 케이스
- 상세: `pending=true` 케이스는 button disabled 여부만 검증한다. 컴포넌트 내부에서 `pending` 이면 `<Loader2>` 를, 아니면 `<RefreshCw>` 를 렌더하는 아이콘 분기가 있으나 테스트에서 확인하지 않는다. 아이콘은 `aria-hidden` 이므로 접근성 트리상 불가시하지만, 시각적 피드백의 의도를 검증하지 않음.
- 제안: `aria-hidden` 아이콘은 role-based 쿼리로 접근이 어려우므로 `container.querySelector('.animate-spin')` 또는 `getAllByRole('img')` 대신 `testId` 를 추가하는 방안 고려. 단, 현재 테스트가 visible UX(disabled 상태) 를 이미 커버하므로 INFO 수준.

### [INFO] `beforeEach` 에서 `cleanup` + `reset` 순서 — 이중 초기화 패턴
- 위치: `unsearchable-banner.test.tsx` L18–22
- 상세: `cleanup()` 은 RTL 이 `afterEach` 에서 자동 실행하는 cleanup 과 동일하며, 명시 호출이 이중화된다. Vitest + `@testing-library/react` 환경에서 자동 cleanup 이 활성화된 경우 중복이다. 해가 없지만 패턴 일관성 면에서 불필요한 boilerplate.
- 제안: `cleanup()` 명시 호출 제거하고 자동 cleanup 에 위임 또는, 다른 테스트 파일의 패턴과 동일하게 맞춤.

### [INFO] `[id]/page.tsx` 게이트 조건 커버리지 — 페이지 레벨 통합 테스트 부재 (기존 지적 사항)
- 위치: `/codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` L571–576
- 상세: 배너 렌더를 제어하는 `{kb && kb.embeddingDimension == null}` 게이트와 props 배선(`reembedStatus={kb.reembedStatus}`, `pending={kbReEmbedMutation.isPending}`)은 페이지 레벨 통합 테스트 없이 컴포넌트 단위 + 빌드 통과로만 검증된다. 이전 리뷰(08_22_31 RESOLUTION.md #2)에서 "6+ mock 하네스 신설은 과투자"로 보류했으나, 적어도 `embeddingDimension == null` 일 때 `UnsearchableBanner` 가 마운트되고, `!= null` 일 때 마운트되지 않음을 검증하는 최소 smoke 테스트는 고려 가능.
- 제안: 보류 사유가 유효하므로 INFO 유지. 향후 `[id]/page.tsx` 에 대한 통합 테스트 하네스 신설 시 해당 게이트도 포함.

### [INFO] 테스트 파일 내 `rerender` 사용 후 store reset 미수행
- 위치: `unsearchable-banner.test.tsx` — "renders the per-state description paragraph" 케이스 (L100–115)
- 상세: `rerender` 를 통해 `reembedStatus` 를 `idle` → `in_progress` 로 전환하는 케이스에서 store 상태(`setRole("editor")`)가 이전 케이스 또는 `beforeEach` 의 `reset()` 이후에 재설정된다. 각 케이스가 독립적으로 `setRole` 을 호출하므로 실제 의존성은 없으나, `rerender` 직전에 store 상태가 변경되지 않는다는 암묵적 의존이 있어 가독성 면에서 주의 필요.
- 제안: INFO 수준, 현재 구조에서 격리 문제 없음.

## 요약

`UnsearchableBanner` 컴포넌트는 7종의 단위 테스트로 핵심 동작(idle/in_progress 상태 분기, 역할별 CTA 가시성, pending 비활성화, auto-dismiss 패턴)을 잘 커버한다. TDD 의도에 맞게 테스트가 구현 전후에 작성됐으며, 각 케이스의 명칭이 의도를 명확히 표현한다. `beforeEach` 에서 store reset 과 locale 초기화를 수행해 테스트 격리가 유지된다. 미비한 점은 `owner` 역할 회귀 케이스 누락(hierarchy 최상위), `pending` 시 Loader2 아이콘 분기 미검증, 그리고 페이지 레벨 통합 테스트가 없다는 것인데, 후자는 이미 비용 대비 효용을 고려해 보류로 결정된 상태다. 전반적으로 테스트 품질이 양호하며 추가로 해결이 필요한 Critical·WARNING 발견사항은 없다.

## 위험도

LOW
