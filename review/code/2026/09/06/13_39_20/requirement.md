# 요구사항(Requirement) 리뷰

## 검토 방법

`git diff origin/main...HEAD -- . ':!review'` 로 실질 변경 20개 파일(`spec/`·`plan/`·`codebase/`)
전체를 확인했다. 프롬프트가 크기 제한으로 diff 를 생략한 파일은 워킹트리에서 `Read`/`Grep` 으로
직접 열어 대조했다. 핵심 가설(§5.4 검증자 등재의 실효성)은 저장소의 정본 게이트 코드
(`.claude/hooks/_lib/review_guard.py`)를 **직접 import 해 실행**해 검증했다 — 재구현하지 않았다.
저장소 파일은 쓰지 않았고(`git status --short` 로 확인, mutation 없음), 세션 자체 산출물
디렉터리(`review/code/2026/09/06/13_39_20/`, `review/consistency/2026/09/06/13_39_25/`)만
untracked 로 남아 있다.

## 발견사항

- **[CRITICAL]** `review-citations.md` 의 `code:` 등재가 자신이 고치려던 결함을 그대로 재현한다 — 가드 등록이 게이트에 안 잡힌다
  - 위치: `spec/conventions/review-citations.md:4-9` (frontmatter `code:` 블록)
  - 상세: 이 브랜치의 마지막 커밋(`0f689bb7e`)이 `dto-jsdoc-citation-guard.ts`/`dto-jsdoc-citation.spec.ts` 를 `--impl-done` SPEC-CONSISTENCY 게이트가 spec-linked 로 인식하도록 `code:` 블록에 등재했다. 그런데 그 블록에 `# 준수 예시 —…`/`# 시행 코드 —…` 두 YAML 주석 줄을 리스트 항목 사이(첫 항목 바로 앞)에 끼워 넣었다. 정본 게이트 파서 `_parse_frontmatter_code()`(`.claude/hooks/_lib/review_guard.py:637-646`)의 block-list 루프는 `^\s*-\s*` 에 안 맞는 **첫 줄에서 즉시 `break`** 한다 — 이는 **바로 이 브랜치가 등재한 같은 plan 문서**(`plan/in-progress/spec-draft-nullable-notation-followups.md`, "harness: `code:` 블록 리스트의 YAML 주석이 게이트 파서를 조용히 끊는다", 2026-09-05 등재, 체크박스 `[ ]` 미해결)가 정확히 경고한 그 결함이다. 실제로 `_parse_frontmatter_code('spec/conventions/review-citations.md')` 를 직접 실행해 확인한 결과 **빈 배열 `[]`** 이 나왔다(코드 블록 첫 줄이 주석이라 파싱이 시작하기도 전에 끊긴다 — plan 문서가 다룬 사례(`2-api-convention.md`, 주석이 뒤쪽에 있어 9개까지는 파싱됨)보다 더 나쁜 형태다). `origin/main` 시점(`git show origin/main:spec/conventions/review-citations.md`)에는 주석이 없어 2개 항목이 정상 파싱됐던 것과 대조된다.
  - 영향 (실측): `review_guard._spec_linked_changes('.', ['codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts', 'codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation.spec.ts'])` → `[]`. 즉 (a) 이번 커밋이 달성하려던 목표 — "이 가드들을 약화·삭제해도 게이트가 안 문다"는 문제의 해소 — 가 **달성되지 않았다**. (b) 오히려 **회귀**다 — `origin/main` 에서 이미 spec-linked였던 `codebase/frontend/src/components/llm-config/sanitize-loader-error.ts` 도 이제 `_spec_linked_changes()` 에서 빠진다(다른 spec 문서가 이 파일을 커버하지 않음, 직접 확인). `roles.guard.spec.ts` 만 `spec/5-system/1-auth.md` 의 별도 넓은 glob(`codebase/backend/src/common/guards/*.ts`)에 우연히 걸려 살아남는다.
  - 근본 원인: RESOLUTION.md(`review/code/2026/09/06/12_28_02`)와 CHANGELOG 는 "정정은 축 단위로 한다"는 **내용**(§2/§3 DTO/컨트롤러 강제 범위 구분)만 검증했고, 직전 consistency 라운드(`review/consistency/2026/09/06/13_18_59/convention_compliance.md`)도 "glob 이 실재 파일에 매치하는가"(정적 glob 매칭)만 확인했을 뿐, **`code:` 블록이 실제로 하나의 항목이라도 파싱되는지**(harness 파서를 실행)는 아무도 검증하지 않았다. 같은 브랜치가 `2-api-convention.md` 에서는 이 함정을 알고 주석을 넣지 않았는데(plan 문서에 명시: "당장은 주석을 쓰지 않는 것으로 회피했다"), `review-citations.md` 에는 그 회피를 적용하지 않았다.
  - 제안: `code:` 블록에서 YAML 주석 두 줄을 제거하고(범주 구분은 별도 산문/표로), 최소 4개 항목(`roles.guard.spec.ts`·`sanitize-loader-error.ts`·`dto-jsdoc-citation*.ts` — 후자는 이미 glob 이므로 1항목)이 `_parse_frontmatter_code()` 로 정상 파싱되는지 그 자리에서 직접 실행해 확인한다. 근본적으로는 이미 등재된 harness 항목(파서가 `#`/빈 줄을 스킵하도록 고치기)을 우선순위를 올려 처리하는 것이 재발을 막는다.

- **[INFO]** (이미 추적됨) `spec/5-system/2-api-convention.md` §5.4 「검증 층」이 여전히 "두 검증자"라고 서술 — 실제로는 3축(구조·이름·JSDoc 인용)
  - 위치: `spec/5-system/2-api-convention.md:227` (`그 자리를 **두 검증자**가 나눠 맡는다`)
  - 상세: 이번 PR 이 `user-entity-exposure-guard.ts`(구조 축)·`user-secret-absence.ts`(이름 축)를 신설했으나 이 문서는 갱신되지 않았다. `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 "신규 검출 3축을 §5.4 「검증 층」과 `code:` 에 등재" 항목(체크박스 `[ ]`)이 이 gap 을 planner 후속으로 정확히 지목하고 있고, `api-convention.md` 는 developer 쓰기 권한 밖(`spec/`)이므로 이번 브랜치가 직접 고칠 수 있는 범위도 아니다. 새로 발견한 결함이 아니라 이미 투명하게 등재된 known gap 이다.
  - 제안: 조치 불요(추적 중). 다음 planner 턴에서 §5.4 표에 세 번째 행을 추가하고 "두 검증자" → "세 검증자" 로 정정.

## 확인된 정상 동작 (기능 완전성)

- **`WorkflowVersionsService.findOne` Critical 유출 수정**: `CREATOR_PROJECTION`(`id`/`name`/`email`) 을 `findOne`/`findByWorkflow` 양쪽에 상수로 공유하고, `workflow-versions.service.spec.ts` 의 `CREATOR_PROJECTION ↔ WorkflowVersionCreatorDto` 테스트가 `buildSwaggerDocument` 로 생성한 실제 OpenAPI 스키마와 키 집합을 대조해 두 선언이 다시 갈리는 것을 막는다(손으로 만든 두 목록을 맞대는 것보다 강함). `WorkflowVersionCreatorDto` 의 실제 필드(`id`/`name`/`email`, `workflow-version-response.dto.ts:3-15`)와 정확히 일치함을 직접 대조했다. e2e `H.`(`workflow-crud.e2e-spec.ts:513`)가 이름 축·계약 축·양성 3필드 축을 모두 건다.
- **`WorkspaceMemberDto.joinedAt` 추가**: `WorkspacesService.listMembers`(`workspaces.service.ts:199-225`)가 실제로 6필드(`id`/`userId`/`email`/`name`/`role`/`joinedAt`)를 반환하고 DTO 도 정확히 그 6필드를 선언한다. "4자리가 전부 `new Date()` 로 채운다"는 JSDoc 의 구체적 수치 주장도 직접 grep 해 정확함을 확인했다(`workspaces.service.ts:65,184,262`, `workspace-invitations.service.ts:471`).
- **구조 축(`user-entity-exposure-guard.ts`)**: 관계 이름 집합을 엔티티 타입 주석에서 파생(`collectUserRelationNames`)하는 설계가 실제로 손 열거보다 넓다는 것(`executor` 추가 발견)을 코드·엔티티 파일 대조로 확인했다. `relations` 배열/객체(중첩 포함)/`leftJoinAndSelect`/`innerJoinAndSelect` 세 형태, `select` 투영 판정(불리언 vs 객체), `as`/`satisfies` unwrap, eager 데코레이터 축까지 fixture 로 각 분기가 독립적으로 관측되도록 짜여 있다(`user-relation-load.fixture.ts`, `user-eager-relation.fixture.ts`).
- **이름 축(`user-secret-absence.ts`)**: `findUserSecretLeaks` 가 봉투 전체를 재귀 순회하며 camelCase/snake_case 양쪽, 배열/중첩 객체, `null` 값도 키 존재만으로 위반 처리한다. null/원시값 입력, 빈 컬렉션, 유사 이름(오탐 방지) 등 경계 케이스가 spec 으로 커버된다.
- **spec fidelity**: `dto-jsdoc-citation-guard.ts` 의 세 인용 패턴(전체 경로/날짜+시각/bare 시각)이 `review-citations.md §2`·§3 이 정의한 형태와 정규식 수준까지 일치하며, fixture 가 세 형태를 모두 독립적으로 관측한다(회귀 이력: 한 형태가 죽어도 스위트가 그린이었던 사고가 이미 있었고 지금은 형태별 최소 1회 관측을 명시적으로 단언).
- TODO/FIXME/HACK/XXX 계열 미완성 주석 없음(diff 전수 grep).

## 요약

핵심 기능(`User` 엔티티 컬럼 노출 검출 2축 + `WorkflowVersionsService.findOne` 의 실제 Critical 유출 수정 + `WorkspaceMemberDto` 계약 보강)은 여러 라운드의 뮤테이션 검증을 거쳐 기능적으로 견고하고, 각 가드의 fixture 가 분기별로 독립 관측 가능하도록 짜여 있어 "죽은 술어가 그린을 낸다"는 이 저장소가 반복 겪은 결함 클래스를 스스로 방어한다. 다만 이 라운드에서 새로 발견한 CRITICAL 1건은 심각하다 — 이 브랜치의 마지막 커밋이 `dto-jsdoc-citation*.ts` 를 spec-linked 로 등재해 "가드 약화 시 게이트가 문다"는 목표를 선언했지만, **같은 브랜치의 plan 문서가 하루 전 이미 경고한 YAML 주석 파서 버그**를 그대로 재현해 `_spec_linked_changes()` 가 빈 배열을 반환한다(직접 실행으로 확인) — 목표 미달성일 뿐 아니라 기존에 정상 작동하던 2개 항목의 spec-linkage까지 회귀시켰다. 이는 코드 자체의 런타임 동작(가드 jest 테스트)에는 영향이 없지만, 이번 작업이 명시적으로 "닫았다"고 선언한 감사 사각지대(§5.4 소절 3건 중 dto-jsdoc-citation 축)가 실제로는 열려 있는 상태로 머지되게 만든다.

## 위험도

HIGH
