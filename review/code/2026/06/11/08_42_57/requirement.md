# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] 기능 완전성: 모든 spec §2.4.1·R-3 요건 구현됨
- 위치: `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`, `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx`
- 상세: spec §2.4.1이 요구하는 4개 동작이 모두 구현됨.
  1. `reembedStatus === 'idle'` → 경고색 배너 + RoleGate(editor) [지금 재임베딩] CTA (구현: `!inProgress && <RoleGate minRole="editor"><Button ...>`)
  2. `reembedStatus === 'in_progress'` → 진행색 배너 + CTA 없음 (구현: `inProgress` 분기)
  3. 수동 닫기(X) 버튼 없음 (구현: 닫기 버튼 부재, 테스트에서 `getAllByRole("button")` 길이 1 확인)
  4. 비-editor 는 텍스트만 표시 (구현: `RoleGate`가 CTA를 감싸고 텍스트 div는 RoleGate 밖)
- 제안: 현 상태 유지.

### [INFO] 게이트 조건: `embeddingDimension == null` 루스 이퀄리티 사용
- 위치: `codebase/frontend/src/app/(main)/knowledge-bases/[id]/page.tsx` (배너 조건 `kb.embeddingDimension == null`)
- 상세: spec §2.4.1은 "`embeddingDimension == null` 인 KB 만" 이라고 명시하며 루스 이퀄리티(`==`)를 암시한다(JS에서 `null == undefined`). 구현이 spec 표기와 일치한다. `undefined`도 포함하는 게이트는 KB 응답이 필드를 생략할 경우에도 안전하게 배너를 표시한다. 의도된 동작.
- 제안: 현 상태 유지.

### [INFO] pending prop 기본값: `undefined` 처리
- 위치: `unsearchable-banner.tsx` — `pending?: boolean` (optional)
- 상세: `pending` 이 `undefined` 일 때 `disabled={undefined}` 가 되어 버튼이 활성화된다. 이는 올바른 기본 동작이다. 호출부(`[id]/page.tsx`)가 `pending={kbReEmbedMutation.isPending}` 을 항상 전달하므로 실운영에서는 `undefined`로 남는 경우가 없다.
- 제안: 현 상태 유지.

### [INFO] reembedStatus 타입: `"idle" | "in_progress"` 만 허용
- 위치: `unsearchable-banner.tsx` Props 인터페이스
- 상세: `Props.reembedStatus`는 `"idle" | "in_progress"` 유니온 타입이다. spec §2.4.1의 두 분기와 정확히 일치한다. 그러나 실제 KB DTO에 다른 상태값이 존재할 경우(예: 알 수 없는 상태) 컴포넌트는 받지 못하고 호출부에서 타입 에러가 난다. 게이트(`embeddingDimension == null` 일 때만 렌더)를 호출부가 책임지도록 설계되어 있어, DTO에서 dimension이 null이면 반드시 idle 또는 in_progress임을 전제한다. 이 전제가 백엔드 계약에서 보장되는지 코드 범위 밖이나, spec §2.2.1 표("두 NULL 케이스" — idle/in_progress 두 가지만 명시)와 일치한다.
- 제안: 현 상태 유지.

### [INFO] CTA 클릭 → ConfirmModal 흐름: 호출부 위임으로 spec 충족
- 위치: `[id]/page.tsx` — `onReembed={() => setShowKbReEmbedConfirm(true)}`
- 상세: spec §2.4.1은 "클릭 → ConfirmModal(vector/graph 비용 안내 분리) → `POST /api/knowledge-bases/:id/re-embed`"를 요구한다. 구현은 `onReembed` 콜백으로 `setShowKbReEmbedConfirm(true)`를 트리거하며, ConfirmModal과 `kbReEmbedMutation`은 기존 코드에서 재사용된다. 배너 컴포넌트 자체는 ConfirmModal을 열지 않고 호출부에 위임하는 구조로, spec의 신규 API 없음 방침과 일치한다.
- 제안: 현 상태 유지.

### [INFO] i18n 키 3종: spec 텍스트 일치 확인
- 위치: `en/knowledgeBases.ts`, `ko/knowledgeBases.ts`
- 상세:
  - `reembedNow`: "Re-embed now" / "지금 재임베딩" — spec §2.4.1 "[지금 재임베딩] CTA"와 일치.
  - `reembeddingRequired`: "Re-embedding required · not searchable" / "재임베딩 필요 · 검색 불가" — spec §2.2.1 및 §2.4.1 경고 문구와 일치.
  - `reembeddingInProgress`: "Re-embedding…" / "재임베딩 중" — spec §2.4.1 진행 문구와 일치.
  - `unsearchableBannerIdleDesc`/`unsearchableBannerInProgressDesc`: spec에 문구 정의 없음(구현이 spec보다 상세한 설명을 추가). spec 침묵 영역이므로 INFO.
- 제안: 현 상태 유지.

### [INFO] [SPEC-DRIFT] spec `pending_plans` 에 `plan/in-progress/kb-model-change-reembed-followup.md` 링크가 잔류(origin/main 기준)
- 위치: `/Volumes/project/private/clemvion/spec/2-navigation/5-knowledge-base.md` frontmatter (origin/main)
- 상세: origin/main의 spec frontmatter는 `status: partial`이고 `pending_plans: [plan/in-progress/kb-model-change-reembed-followup.md]`를 참조한다. 그러나 본 worktree의 spec은 이미 `status: implemented`로 갱신되고 `pending_plans`가 제거되어 있다. 즉, 워크트리 내 구현과 spec 갱신은 완료됐으나 origin/main에 아직 머지되지 않은 상태다. 코드 버그가 아니라 PR 머지 전 정상 상태이며, 머지 후 origin/main spec도 갱신된다.
- 제안: 코드 유지. spec 갱신은 이미 워크트리에서 완료됨(worktree spec: `status: implemented`). PR 머지 시 자동 해소.

### [INFO] `owner` 역할 CTA 테스트 미포함
- 위치: `unsearchable-banner.test.tsx`
- 상세: `admin`(≥ editor) 역할의 CTA 노출은 테스트됐으나(line 162–170), `owner` 역할은 명시적으로 테스트되지 않았다. RoleGate(`minRole="editor"`)가 owner도 허용한다면 테스트로 문서화될 수 있다. 기능 오류 가능성은 낮으나 회귀 가드 측면에서 개선 여지가 있다.
- 제안: 선택적 개선 — `setRole("owner")` 케이스 추가 가능. 기능 정확성에는 영향 없음.

---

## 요약

변경된 코드는 spec `2-navigation/5-knowledge-base.md` §2.4.1·R-3이 정의한 모든 요건(idle/in_progress 상태별 배너, RoleGate(editor) CTA, 수동 닫기 없음, 비-editor 텍스트 표시, 신규 API 없음, 기존 ConfirmModal·mutation 재사용)을 line-level로 충족한다. 게이트 조건(`embeddingDimension == null`), prop 타입(`"idle" | "in_progress"`), i18n 문구 모두 spec과 일치하며, pending 비활성화·admin 역할·desc 단락 테스트도 포함되어 있다. Critical 또는 Warning 수준의 요구사항 위반은 발견되지 않았다. 유일한 spec 상태 불일치(origin/main `pending_plans` 잔류)는 PR 머지 전 정상 상태이며 worktree 내에서 이미 해소됐다.

## 위험도

NONE
