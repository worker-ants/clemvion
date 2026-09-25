# 신규 식별자 충돌 검토 — `spec-draft-workspace-path-guard-followup.md`

## 발견사항

### INFO — 이 draft 는 새 식별자를 도입하지 않는다(전부 기존 식별자 재참조)
- target 신규 식별자: (없음) — 4개 변경 모두 **이미 존재하는** 식별자·경로·앵커를 다른 spec 문서에 미러링하거나 frontmatter `code:` 에 등재하는 것뿐이다.
- 기존 사용처 및 실측:
  - 앵커 `#경로-파라미터-워크스페이스도-가드가-본다-2026-09-25` — `spec/data-flow/12-workspace.md:354` 헤딩("### 경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)")에서 이미 생성돼 있고, 같은 파일 335·477행이 이미 이 앵커로 자기참조한다. target 의 변경 1·2 는 같은 앵커를 **추가로 인용**할 뿐 새 앵커를 만들지 않는다.
  - `@WorkspaceParam(...)` — `spec/5-system/1-auth.md:805,817` 및 `plan/complete/spec-draft-workspace-path-guard.md` 전역에 이미 같은 의미(경로 파라미터 워크스페이스 바인딩 데코레이터)로 정의돼 있다. target 변경 2 의 재인용과 의미가 정확히 일치한다.
  - 가드 파일 `workspace-param-binding-guard.ts`/`workspace-param-binding.spec.ts`/`param-uuid-pipe-guard.ts`/`param-uuid-pipe.spec.ts`/`workspace-roles-attachment.spec.ts` — `codebase/backend/src/repo-guards/__tests__/` 에 **이미 실재**한다(`ls` 실측, mtime 09/25 14:03~15:45). target 변경 3 은 이 다섯(과 fixture 둘)을 `1-auth.md`/`swagger.md` frontmatter `code:` 에 **등재만** 한다 — 파일명을 새로 짓는 것이 아니다.
  - `POST /api/auth/workspaces/:id/switch`·`/api/workspaces/:id/...` — `spec/5-system/1-auth.md:22`, `spec/2-navigation/9-user-profile.md:157` 에 이미 정의된 기존 엔드포인트다. 새 endpoint 가 아니다.
- 상세: 신규 식별자 충돌 관점에서 검사할 대상 자체가 거의 없다 — 이 draft 는 "이미 착지한 결정의 전파 누락"을 미러링하는 순수 편집이라는 자체 Rationale 과 실측이 일치한다.
- 제안: 없음(문제 없음, 기록 목적).

### INFO — 이전 `naming_collision` WARNING(`workspace-param-binding` vs `workspace-roles-attachment`)은 이미 코드 레벨에서 해소됨, 이 draft 범위 밖이 맞다
- target 신규 식별자: 해당 없음(이 draft 가 다루지 않는 항목)
- 기존 사용처: `review/consistency/2026/09/25/15_15_21/SUMMARY.md` WARNING #5 — "신규 repo-guard 명 `workspace-param-binding` 이 같은 디렉터리 기존 `workspace-roles-attachment.spec.ts` 와 이름이 근접해 혼동 소지, 제안: docstring 으로 경계 명시 또는 개명".
- 상세: 실측(`codebase/backend/src/repo-guards/__tests__/workspace-param-binding.spec.ts` 상단 docstring)에 "## 이웃 가드와의 경계" 절이 이미 존재하며, `workspace-roles-attachment.spec.ts`(목록형 `@Roles()` reflection 고정) vs 본 가드(전 컨트롤러의 바인딩 **이름 패턴** 금지) vs `param-uuid-pipe.spec.ts`(파이프 축)를 명시적으로 구분한다. 즉 WARNING #5 는 **코드 docstring 으로 해소**돼 있고, 이 spec-write-only followup draft(Rationale: "spec 쓰기가 필요한 셋과 INFO 하나"만 다룬다)가 이 항목을 건드리지 않는 것은 누락이 아니라 올바른 스코프 판단이다.
- 제안: 없음 — 재조치 불필요. (참고로 남긴다: 향후 checker 가 이 WARNING 을 미해소로 재-flag 하면 오탐이다.)

### INFO — 파일명 관례상 단수/복수 사소한 불일치
- target 신규 식별자: plan 파일명 `plan/in-progress/spec-draft-workspace-path-guard-followup.md` (단수 `-followup`)
- 기존 사용처: `plan/in-progress/spec-draft-nullable-notation-followups.md` (복수 `-followups`) — 같은 `spec-draft-*` 계열의 유일한 선례.
- 상세: 의미 충돌은 없다(같은 디렉터리, 다른 주제라 실제 경합 없음) — 규칙을 깨거나 기존 파일과 겹치지도 않는다. 다만 단/복수 표기가 선례와 갈려 다음에 같은 패턴을 볼 때 어느 쪽이 관례인지 애매해질 수 있다.
- 제안: 강제 조치 불필요. 후속 `spec-draft-*-followup(s)` 명명 시 아무 쪽이나 고정해 관례화하면 됨.

## 요약
target 문서(`spec-draft-workspace-path-guard-followup.md`)는 새 요구사항 ID·엔티티/타입명·API endpoint·이벤트명·환경변수·spec 파일 경로를 **하나도 신설하지 않는다** — 같은 PR 의 선행 커밋(`e2e257707`)이 이미 만든 앵커(`경로 파라미터 워크스페이스도 가드가 본다 (2026-09-25)`)·데코레이터(`@WorkspaceParam`)·저장소 가드 파일(`workspace-param-binding*`, `param-uuid-pipe*`, `workspace-roles-attachment.spec.ts`, 이미 실재 확인)·엔드포인트(`/api/workspaces/:id/...`, `POST /api/auth/workspaces/:id/switch`)를 다른 spec 문서에 미러링하거나 frontmatter `code:` 에 등재하는 순수 동기화 편집이다. 직전 `--impl-prep` 라운드가 지적한 `naming_collision` WARNING(가드명 근접)은 코드 docstring 으로 이미 해소돼 있고 이 draft 의 스코프(spec 쓰기 필요 항목) 밖에 있는 것이 타당하다. 신규 식별자 충돌 관점에서 차단 사유나 경고 수준 발견은 없다.

## 위험도
NONE
