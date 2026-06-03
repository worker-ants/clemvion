# Maintainability Review

## 발견사항

### 파일 1: `codebase/frontend/src/components/editor/expression/expression-constants.ts`

- **[INFO] 단일 항목 추가, 패턴 완전 준수**
  - 위치: 파일 전체 (특히 `ROOT_VARIABLES` 배열 라인 74)
  - 상세: `$thread` 항목이 기존 `ROOT_VARIABLES` 항목들과 동일한 형태(`label`, `insertText`, `type`, `detail`, `isExpandable`)로 추가됐다. `BUILT_IN_PICKER_VARIABLES` 파생 로직(`ROOT_VARIABLES.filter(...).map(...)`)이 자동으로 새 항목을 포함하므로 중복 등록이 없다. 인터페이스·헬퍼 함수와의 계약도 준수됐다.
  - 제안: 없음. 코드베이스 스타일 완전 일치.

---

### 파일 2~15, 16~23: `plan/complete/**`, `plan/in-progress/**` (MD 문서류)

- **[INFO] plan 문서 형식·frontmatter 일관성 양호**
  - 위치: 전체 plan 파일
  - 상세: 모든 신규 `plan/complete/` 파일이 동일한 frontmatter 스키마(`worktree`, `started`, `owner`)를 갖는다. 섹션 구조(원본 발견사항 → 제안 변경 → 구현 상태)가 동류 파일들 사이에서 일관된다.
  - 제안: 없음.

- **[INFO] `spec-update-c-sync-promotions.md` 의 Rationale 항목 중복 서술**
  - 위치: `/plan/complete/spec-update-c-sync-promotions.md` §Rationale 및 §2 본문 정정 섹션
  - 상세: "전용 settings 엔드포인트" 설명이 §Rationale 에서 두 단락에 걸쳐 거의 동일한 내용으로 반복된다("전용 settings 엔드포인트는 신규 결정… 기존 `PATCH /:id` 는 `name` 필수" 문장이 두 번). plan 문서이므로 런타임 영향은 없으나 가독성을 저해한다.
  - 제안: 두 번째 단락("전용 settings 엔드포인트: 기존 `PATCH /:id` 는 `name` 필수…")을 첫 번째 단락과 통합하거나 삭제.

- **[INFO] `spec-sync-carousel-gaps.md` / `spec-sync-foreach-gaps.md` / `spec-sync-node-common-gaps.md` / `spec-sync-integration-common-gaps.md` / `spec-sync-template-gaps.md` / `spec-sync-data-common-gaps.md` — 재분류 메모 작성 패턴 일관성**
  - 위치: 각 파일의 `## ⚠ 재분류` 섹션
  - 상세: 동일한 목적의 섹션 제목이 일부는 `## ⚠ 재분류 (2026-06-03 groom): decision-free 아님 → planner 결정 필요`로, 일부는 같은 형태이나 이모지(`⚠`) 일관성에 차이가 없어 동일하다. 내용 구조(판단 이유 + 결정 필요 항목 + 구현 위치 힌트)는 일관적이다.
  - 제안: 현 상태로 충분함. 이모지 사용 여부가 이미 통일돼 있다.

---

### 파일 24~38: `spec/**` (MD 명세 문서류)

- **[INFO] spec frontmatter status 승격 및 `pending_plans` 제거 — 일관적으로 처리됨**
  - 위치: `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/11-error-empty-states.md`, `spec/2-navigation/7-statistics.md`, `spec/4-nodes/2-flow/1-workflow.md`, `spec/4-nodes/3-ai/2-text-classifier.md`, `spec/4-nodes/3-ai/3-information-extractor.md`, `spec/conventions/user-guide-evidence.md`
  - 상세: 모든 대상 파일이 동일한 패턴(`status: partial` → `status: implemented`, `pending_plans` 블록 제거)으로 처리됐다. 기계적 일관성이 높다.
  - 제안: 없음.

- **[INFO] `spec/5-system/12-webhook.md` 라인 2284 — 과도한 인라인 서사**
  - 위치: `spec/5-system/12-webhook.md` 처리 흐름 step 5 (diff 라인 2284 근처)
  - 상세: step 5 항목이 단일 단락에 분기 로직·보안 근거·설계 정당화를 모두 포함해 세 줄을 초과한다. 기술 명세에서 흐름 step 이 설계 근거를 인라인으로 포함하면 흐름 가독성이 떨어진다. 이미 Rationale 섹션(R-CC-12 (d))으로 cross-link 가 있으므로 step 5 에서는 동작만 기술하고 근거는 cross-link로 위임하는 것이 낫다.
  - 제안: step 5 텍스트에서 `(chatChannel 트리거는 비활성 상태에서도 인증을 그대로 수행 — 정당화: …)` 괄호 내용을 제거하고 `상세 [Spec Chat Channel §5.5]` 링크로 대체.

- **[WARNING] `spec/4-nodes/0-overview.md` §1.4.1 — 필터 표의 이스케이프 문자 시각적 노이즈**
  - 위치: `spec/4-nodes/0-overview.md` 신설 `#### 1.4.1 템플릿 문법` 표 (diff 라인 2027~2032)
  - 상세: 마크다운 테이블 셀 내 파이프(`|`) 이스케이프로 `\|`가 쓰였다(`{{method\|upper}}` 등). GitHub Flavored Markdown 렌더러에서는 정상 표시되나 일부 렌더러·편집기에서 `\|` 그대로 출력될 수 있다. 인접한 다른 spec 파일들의 템플릿 예시(`spec/4-nodes/2-flow/1-workflow.md` §7)는 표 외부의 인라인 코드에서 `|`를 이스케이프 없이 쓴다.
  - 제안: 표 셀 내 `\|` 표기를 인라인 코드(`` ` ``)로 감싸거나, 표 전체를 코드 블록으로 교체해 이스케이프를 없애는 것을 검토.

- **[INFO] `spec/5-system/1-auth.md` — 신규 행 2개의 컬럼 폭 불균형**
  - 위치: `spec/5-system/1-auth.md` §1 표 라인 2241~2242
  - 상세: 신규 추가된 "토큰 at-rest 저장" / "인증 메일 재발송" 행의 첫 컬럼 값이 기존 행("로그인", "비밀번호 분실" 등)보다 길어 마크다운 표 정렬 가독성이 저하된다. 렌더 결과는 무관하지만 raw 소스 가독성이 떨어진다.
  - 제안: 비중요. 기존 행들도 정렬 없이 혼용돼 있으므로 현 상태를 유지해도 무방.

- **[INFO] `spec/5-system/5-expression-language.md` diff 라인 2350 — 미구현 노트 제거 후 단문**
  - 위치: `spec/5-system/5-expression-language.md` §4.4 `$thread` 노트
  - 상세: "미구현 약속" 문장을 제거하고 `ROOT_VARIABLES 에도 $thread 가 포함된다`로 교체했다. 간결하고 의도가 명확하다.
  - 제안: 없음.

---

## 요약

이번 변경은 38개 파일에 걸친 대규모 spec-sync grooming 작업으로, 코드 변경은 TypeScript 파일 1개(단일 배열 항목 추가)에 불과하고 나머지는 plan/spec 문서 갱신이다. TypeScript 변경(`expression-constants.ts`)은 기존 패턴과 완전히 일치하며 파생 로직(`BUILT_IN_PICKER_VARIABLES`)이 자동으로 새 항목을 포함하여 중복 없이 유지보수성이 높다. Spec 문서군은 frontmatter 승격·미구현 마커 제거·Rationale 보강이 일관된 패턴으로 수행됐다. 주목할 유지보수성 관점의 문제는 `spec-draft-workspace-settings-api.md` Rationale의 단락 중복, `spec/4-nodes/0-overview.md` 필터 표의 이스케이프 시각적 노이즈, `spec/5-system/12-webhook.md` 처리 흐름 step의 인라인 서사 과다 세 가지이며, 모두 INFO~WARNING 수준으로 기능에는 영향이 없다.

## 위험도

LOW
