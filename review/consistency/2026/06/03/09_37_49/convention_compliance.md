# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-channel-web-chat-gaps.md`

검토 일시: 2026-06-03  
검토 모드: spec draft (--spec)  
대상 파일: `.claude/worktrees/feat-web-chat-demo/plan/in-progress/spec-draft-channel-web-chat-gaps.md`

---

## 발견사항

### 1. [CRITICAL] frontmatter `worktree` 필드 형식 위반 — 전체 절대경로 사용

- **target 위치**: frontmatter line 2 `worktree: .claude/worktrees/feat-web-chat-demo`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md` 는 직접 관련 없으나, 기준 SSOT 는 `.claude/docs/plan-lifecycle.md §4` — frontmatter 스키마 정의:
  ```
  worktree: <task_name>-<slug>     # 이 plan 이 살아있는 worktree 디렉토리 이름
  ```
  예시 값: `feat-web-chat-demo` (디렉토리 이름만)
- **상세**: 규약은 `worktree` 필드 값을 `.claude/worktrees/<task>-<slug>/` 디렉토리의 **이름만** (`feat-web-chat-demo`) 저장하도록 한다. 현재 값은 `.claude/worktrees/feat-web-chat-demo` — 경로 prefix 가 포함된 full path 형식이다. `consistency-checker` 의 `plan_coherence` checker 가 이 값을 기반으로 충돌 검출을 수행하므로, 경로 포맷 불일치 시 매칭이 깨질 수 있다.
- **제안**: `worktree: feat-web-chat-demo` 로 수정 (디렉토리 이름만).

---

### 2. [WARNING] frontmatter `kind` 필드 — 규약에 없는 비표준 필드

- **target 위치**: frontmatter line 5 `kind: spec-draft`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 공식 frontmatter 스키마는 `worktree`, `started`, `owner` 세 필드만 정의한다. `kind` 는 명세에 없는 추가 필드.
- **상세**: 비표준 필드 자체가 직접 금지되진 않으나, 규약 SSOT 에 정의된 스키마 밖의 필드이므로 다른 plan 문서와 형식 일관성이 깨진다. 또한 `plan_coherence` checker 가 기대하는 필드 집합에 포함되지 않아 파서 오동작 가능성이 있다.
- **제안**: `kind: spec-draft` 제거. 필요하다면 본문 h1 제목 `# Spec draft — ...` 으로 충분히 명시되어 있어 중복이기도 하다. 규약 갱신이 필요하다면 plan-lifecycle.md §4 에 `kind` 를 optional 필드로 공식화해야 한다.

---

### 3. [WARNING] frontmatter `targets` 필드 — 규약에 없는 비표준 필드

- **target 위치**: frontmatter lines 6–14 `targets: [...]`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 공식 스키마에 `targets` 필드 없음.
- **상세**: `kind` 와 동일하게 규약 스키마 외 필드. 비표준 필드 중 `targets` 는 codebase 경로와 spec 경로를 혼재(`codebase/frontend/...`, `spec/7-channel-web-chat/...`)해 나열하고 있어, spec 문서의 `pending_plans:` + 본문의 개별 섹션으로 이미 충분히 표현 가능한 정보를 frontmatter 에 중복 기재하는 패턴이다.
- **제안**: 규약 SSOT 에 없는 필드이므로 제거하고 본문 설명으로 유지하거나, plan-lifecycle.md §4 에 `targets` 를 optional 필드로 명시해 규약 갱신. 어느 쪽이든 규약 문서와 실제 사용 간 불일치가 있다.

---

### 4. [WARNING] W3 — `spec-impl-evidence.md §1` 적용 대상 확장 지시가 규약 파일 직접 수정 지시이나 developer-domain 코드 파일명이 규약에 기재된 파일과 다름

- **target 위치**: §W3 "동반(developer):" `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` — build-time 가드 파일 목록에 `spec-frontmatter-parse.ts` 는 없다. 규약 §4 는 가드 파일로 `spec-frontmatter.test.ts`, `spec-code-paths.test.ts`, `spec-status-lifecycle.test.ts`, `spec-pending-plan-existence.test.ts` 를 열거한다. `spec-frontmatter-parse.ts` 는 이 4개 테스트 파일이 공유하는 helper 모듈임이 실제 파일(`.claude/worktrees/feat-web-chat-demo/codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`)로 확인된다.
- **상세**: `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 배열에 `"spec/7-channel-web-chat/"` 을 추가하는 작업 자체는 올바른 방향이다. 그러나 plan 본문에서 이 파일을 "spec 문서와 1:1 동기" 해야 하는 파일로 언급하면서, `frontend npm test -- spec-frontmatter` 통과 확인이라고 적고 있는데 실제 테스트 커맨드가 이 helper 파일을 직접 테스트하는 것이 아니라 `spec-frontmatter.test.ts` 를 실행한다는 점에서 표현 혼동이 있다. 규약 §4 에 helper 파일은 별도 명시가 없으므로 plan 이 규약의 공식 가드 파일 목록에 없는 파일을 "1:1 동기" 대상으로 기술한 것은 규약 일관성 관점에서 INFO 수준이지만, frontmatter `targets` 에 이 파일이 포함되어 있어 공식 spec file 이 아닌 codebase helper 파일이 혼재하는 구조가 된다는 점은 WARNING.
- **제안**: plan 본문 표현을 "spec-frontmatter-parse.ts (INCLUDE_PREFIXES helper) 갱신 → spec-frontmatter.test.ts 통과 확인" 으로 명확히 구분. frontmatter `targets` 에서 developer-domain 파일 (`codebase/...`) 은 제거하고 본문 섹션 내 "(developer)" 주석으로 유지하는 것이 규약 의도에 더 가깝다.

---

### 5. [INFO] 본문 섹션 번호 건너뜀 — §1과 §3이 없음

- **target 위치**: 본문 전체 구조 — "섹션 2", "섹션 4" 만 있고 "섹션 1", "섹션 3" 이 없음
- **위반 규약**: 문서 구조 규약 직접 위반은 아니나, plan 문서의 가독성 관점에서 섹션 번호 연속성이 없어 "섹션 1·3 은 다른 문서에 있는 것인가?" 혼동을 줄 수 있다.
- **상세**: 대상 consistency-check 보고서(2026-06-03, `08_56_55`)의 섹션 번호 매핑을 그대로 사용한 것으로 추정되나, 자립 문서로서 섹션 1·3 이 없는 이유가 문서 내 어디에도 명시되지 않음.
- **제안**: 문서 상단 또는 각 섹션 앞에 "본 draft 는 consistency-check 보고서의 §2·§4 에 해당하는 항목만 다룬다" 같은 문맥 명시를 추가하거나, 섹션을 §1~§2 로 재번호 매김.

---

### 6. [INFO] `Rationale` 섹션 제목 형식 비표준

- **target 위치**: 문서 끝 `## Rationale (draft 결정 근거)`
- **위반 규약**: CLAUDE.md §정보 저장 위치 — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". 권장 제목은 `## Rationale` 이다.
- **상세**: `(draft 결정 근거)` 접미사가 추가되어 있다. plan 문서에는 strict 한 제목 형식 의무는 없으나, spec 문서로의 변환 또는 참조 파서 관점에서 표준 제목과 다를 수 있다.
- **제안**: `## Rationale` 로 제목을 표준화하고 설명이 필요하면 본문 첫 줄에 기술.

---

## 요약

target plan 문서(`spec-draft-channel-web-chat-gaps.md`)의 **내용적 설계(W1~W5, show/hide/updateProfile)**는 spec/conventions 의 규약과 충돌하지 않는다. 단, **frontmatter 형식**에서 규약과 직접 충돌하는 항목이 있다. 가장 중요한 것은 `worktree` 필드가 경로 prefix 포함 full path(`.claude/worktrees/feat-web-chat-demo`)를 사용하고 있어 `.claude/docs/plan-lifecycle.md §4` 가 요구하는 "디렉토리 이름만" 규칙을 위반한다(CRITICAL). 추가로 `kind`·`targets` 는 공식 frontmatter 스키마에 없는 비표준 필드로, 규약 SSOT 와의 불일치를 만든다(WARNING). 내용 설계 자체는 EIA SoT 교차 참조, spec 3섹션(Overview/본문/Rationale) 권장 구조, `_product-overview.md` underscore 제외 처리 등 주요 규약을 준수한다.

---

## 위험도

**MEDIUM**

(CRITICAL 1건: frontmatter `worktree` 형식. WARNING 3건: `kind`/`targets` 비표준 필드, developer 파일 혼재. INFO 2건: 섹션 번호 불연속, Rationale 제목 접미사)
