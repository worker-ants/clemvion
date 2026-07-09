# 신규 식별자 충돌 검토 — naming_collision

검토 모드: --impl-prep (scope=spec/2-navigation/, 실제 target = `plan/in-progress/editor-slug-phase2.md` 가 예고하는 신규 식별자)

## 발견사항

- **[WARNING]** 신규 훅/컴포넌트 이름이 기존 `useWorkspaceSlug`/`WorkspaceSlugLayout` 과 어근 순서만 뒤바뀐 근접 anagram
  - target 신규 식별자: `useSlugWorkspaceGate` 또는 `<SlugWorkspaceGate>` (`plan/in-progress/editor-slug-phase2.md` S1, `lib/workspace/` 에 신설 예정)
  - 기존 사용처: `codebase/frontend/src/lib/workspace/use-workspace-slug.ts` (`useWorkspaceSlug` — 순수 getter, URL/store 에서 slug 문자열만 반환) 및 `codebase/frontend/src/app/(main)/w/[slug]/layout.tsx` (`WorkspaceSlugLayout` — reconcile+redirect+render-gate 담당 컴포넌트, 지금 추출 대상)
  - 상세: 기존 두 식별자는 모두 "Workspace"+"Slug" 어순인데, 신규 후보만 "Slug"+"Workspace"+"Gate" 로 어순이 뒤집힌다. 셋이 같은 `lib/workspace/` 디렉터리에 공존하면 grep/자동완성/코드리뷰 시 부작용 없는 값 getter(`useWorkspaceSlug`)와 side-effecting gate(리다이렉트·블로킹 렌더, `useSlugWorkspaceGate`)를 혼동할 위험이 있다. 특히 (editor) 쪽에 새 layout 을 추가하는 이번 작업에서 실수로 `useWorkspaceSlug()` 만 호출하고 gate 로직을 빠뜨리는 실수를 유발하기 쉬운 이름이다.
  - 제안: 어순을 기존 컨벤션에 맞춰 `useWorkspaceSlugGate` / `<WorkspaceSlugGate>` 로 정정("Workspace" 선행 유지). "Gate" 접미사 자체는 `codebase/frontend/src/components/auth/role-gate.tsx` (`RoleGate`) 와 동일 패턴이라 프로젝트 관행에는 부합하므로 유지 가능.

- **[WARNING]** "phase 2" 라벨이 코퍼스 내에서 이미 3개 이상의 무관한 의미로 사용 중
  - target 신규 식별자: plan 제목·S7 spec flip 대상 문구의 "phase 2"(= 슬러그 라우팅 phase 2, 에디터 slug화)
  - 기존 사용처: `spec/3-workflow-editor/4-ai-assistant.md:680,957,960,962` ("Phase 2" = AI 턴 내 `WORKFLOW_VERIFY_REQUIRED` 검증 단계), `spec/5-system/4-execution-engine.md:1245,1311,1473,1477` / `spec/5-system/6-websocket-protocol.md:243` / `spec/5-system/13-replay-rerun.md:462` ("Phase 2" = 분산 실행/BullMQ continuation 롤아웃 단계), `prd/6-phase2-ai.md` (제품 로드맵상 "phase2" = AI 기능 단계)
  - 상세: 동일 spec 코퍼스 안에서 "phase 2" 라벨이 최소 3가지 서로 무관한 의미로 이미 쓰이고 있다. S7 이 편집할 `spec/2-navigation/9-user-profile.md:158`("slug화는 phase 2")·`0-dashboard.md:21`·`1-workflow-list.md:103`·`14-execution-history.md:20`·`_layout.md:85` 는 현재도 인접 단어("slug", "에디터")로 어느 정도 문맥 구분이 되지만, bare "phase 2" 만 검색·인용될 경우 다른 영역 문서와 혼동될 수 있다. plan 자체도 "spec 의 'Phase 2'(ai-assistant verify·실행엔진 단계)는 slug phase 2 와 무관 — 혼동 금지"라고 이미 자각하고 있어 위험 인지는 되어 있으나, 실제 spec 편집 시점에 이 qualify 가 누락되지 않도록 재확인이 필요하다.
  - 제안: S7 spec flip 시 bare "phase 2" 대신 항상 "슬러그 라우팅 phase 2" 또는 "(slug phase 2)" 처럼 완전히 명시적으로 qualify. PR 제목·커밋 메시지도 동일하게 "워크스페이스 슬러그 라우팅" 접두를 유지(phase 1 PR #862/#865 관행과 동일).

- **[INFO]** 신규 파일 배치 시 kebab-case 컨벤션 확인 필요
  - target 신규 식별자: `lib/workspace/` 에 추출될 훅/컴포넌트 파일명(plan 에는 아직 미확정 — 훅/컴포넌트 이름만 언급)
  - 기존 사용처: 동일 디렉터리 기존 파일 전부 kebab-case — `use-workspace-slug.ts`, `use-workspaces.ts`, `resolve-fallback.ts`, `href.ts`
  - 상세: 실제 충돌은 아니지만(파일명 미확정), 위 첫 WARNING 의 이름 교정과 함께 파일명도 기존 패턴을 따르도록 구현 착수 시 확정 권고.
  - 제안: `use-workspace-slug-gate.ts`(훅) 또는 `workspace-slug-gate.tsx`(컴포넌트)로 명명.

### 충돌 없음 확인 (참고)

- 요구사항 ID: 슬러그 라우팅 관련 PRD ID 자체가 없어(ad-hoc 인프라 결정) ID 충돌 대상 없음.
- API endpoint: FE-only 작업, backend/엔드포인트 변경 없음 — 충돌 없음.
- 엔티티/DTO/이벤트/ENV: 신규 도입 없음.
- 파일 경로: `(editor)/w/[slug]/layout.tsx`, `(editor)/w/[slug]/workflows/[id]/` 는 현재 저장소에 존재하지 않는 신규 경로 — `(main)/w/[slug]/layout.tsx` 와는 라우트 그룹이 달라 충돌 없음. `(editor)/workflows/[id]` → `(editor)/w/[slug]/workflows/[id]` 이동 후 옛 frontmatter `code:` 참조는 `spec/3-workflow-editor/2-edge.md:10` 한 곳뿐(검색 결과 다른 spec 미참조) — S7 목록과 일치, 누락 없음.

## 요약

이번 phase-2 작업은 FE 라우팅 리팩터로 신규 요구사항 ID·API endpoint·엔티티/DTO·이벤트·ENV var 도입이 없어 CRITICAL 급 식별자 재사용 충돌은 발견되지 않았다. 다만 (1) `lib/workspace/` 에 추출될 신규 훅/컴포넌트 이름 후보(`useSlugWorkspaceGate`/`<SlugWorkspaceGate>`)가 기존 `useWorkspaceSlug`/`WorkspaceSlugLayout` 과 어순만 뒤바뀐 근접 anagram 이라 유지보수 시 혼동 소지가 있고, (2) plan 이 다루는 "phase 2" 라벨이 spec 코퍼스 내 이미 여러 무관한 의미(AI 턴 verify 단계, 분산실행 롤아웃 단계)로 쓰이고 있어 S7 spec flip 시 qualify 문구 유지가 필요하다(plan 스스로도 인지하고 경고 중). 둘 다 명명 정합성 보완 수준의 WARNING 이며, 실제 기능적 충돌(동일 식별자가 다른 의미로 이미 바인딩)은 아니다.

## 위험도

LOW
