# 유지보수성(Maintainability) Review

리뷰 대상: `review/consistency/2026/05/16/` 하위 다수 review.md 파일 및 관련 plan/spec draft 파일 (총 27개 파일)

---

## 발견사항

### 1. 리뷰 문서 구조 비일관성

- **[WARNING]** `rationale_continuity/review.md` (파일 3: 12_24_55 세션) 가 최상위 제목(`# ...`)을 누락하고 `### 발견사항` 으로 바로 시작함
  - 위치: `review/consistency/2026/05/16/12_24_55/rationale_continuity/review.md` 첫 행
  - 상세: 동일 세션의 `naming_collision/review.md`, `plan_coherence/review.md` 는 `# 신규 식별자 충돌 검토 결과`, `# Plan 정합성 Review` 등 최상위 H1 제목을 갖는다. 동일 세션 내 checker 산출물 간 구조가 불일치한다.
  - 제안: `# Rationale 연속성 검토 결과` 등 H1 제목을 추가하여 세션 내 문서 구조를 통일한다.

- **[WARNING]** `plan_coherence/review.md` (파일 27: 14_06_49 세션) 가 최상위 제목 없이 `### 발견사항` 으로 시작함
  - 위치: `review/consistency/2026/05/16/14_06_49/plan_coherence/review.md` 첫 행
  - 상세: 동일 세션의 `convention_compliance/review.md`, `cross_spec/review.md`, `naming_collision/review.md` 는 모두 `# ...` H1 제목을 갖는다. 프로젝트 내 checker 산출물 표준 구조에서 이탈한다.
  - 제안: `# Plan 정합성 검토 — Cafe24 HMAC raw-value 재정정` 등 H1 제목을 첫 행에 추가한다.

---

### 2. 메타 정보 헤더 형식 불일치

- **[WARNING]** 세션 간 헤더 메타 정보 기재 방식이 혼재함
  - 위치: 복수 세션의 checker 별 review.md 첫 블록
  - 상세: 일부 파일은 bold key-value 패턴(`**Session**:`, `**Target files**:`)을 사용하고(13_09_46/convention_compliance), 다른 파일은 `검토 대상:`, `검토 파일:` 평문 패턴을 사용한다(12_24_55/naming_collision). 13_29_47/cross_spec 은 bold 뒤 공백+콜론 없이 인라인으로 기재한다. 세션을 넘나들며 같은 유형의 checker 산출물 형식이 제각각이다.
  - 제안: `**검토 대상**:`, `**검토 일시**:`, `**세션**:` 형식으로 통일하는 checker 산출물 헤더 템플릿을 `spec/conventions/` 또는 `.claude/skills/consistency-checker/SKILL.md` 에 명시한다.

---

### 3. `요약` 섹션 헤딩 수준 비일관성

- **[INFO]** H3(`###`) 과 H2(`##`) 가 혼재하여 사용됨
  - 위치: 전체 리뷰 파일 비교 — `12_24_55/plan_coherence/review.md` 는 `### 요약`, `### 위험도` 를 사용하고, `13_09_46/convention_compliance/review.md` 는 `## 요약`, `## 위험도` 를 사용함
  - 상세: 동일 역할의 섹션이 H2 와 H3 두 수준으로 혼재한다. 자동 TOC 생성이나 파싱 기반 처리를 할 경우 헤딩 수준이 중요한 신호가 된다.
  - 제안: `## 요약`/`## 위험도` 로 H2 수준으로 통일하거나, checker 별 산출물 형식 가이드에 헤딩 수준을 명시한다.

---

### 4. `spec-draft` 이중 성격 문서의 네이밍 혼란

- **[WARNING]** `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 의 파일명 및 제목이 plan 과 spec 의 경계를 모호하게 함
  - 위치: 파일 23(convention_compliance/review.md) 에서 지적된 내용 — plan 파일에 `# Spec Draft` 제목 사용
  - 상세: CLAUDE.md 명명 컨벤션에서 `plan/in-progress/*.md` 는 "처리할 항목이 남은 plan" 이고 spec 문서는 `spec/**` 에 위치한다. `spec-draft-` prefix 를 plan 파일 이름에 붙이는 패턴이 복수 파일(`spec-draft-data-model-install-token-followup.md` 포함)에서 반복 사용되고 있으나 이 패턴은 CLAUDE.md 명명 컨벤션 테이블에 정의되지 않은 암묵적 관행이다. 한 개가 아닌 패턴 차원의 네이밍 불일치다.
  - 제안: CLAUDE.md 또는 `spec/conventions/` 에 `spec-draft-<name>.md` 패턴을 명시적 컨벤션으로 등재하거나, 제목을 `# Plan — <작업명> (spec 변경 내역 포함)` 형식으로 표준화하여 plan 과 spec 의 역할 경계를 명확히 한다.

---

### 5. frontmatter `spec_files` 비표준 확장 키 반복 사용

- **[INFO]** `spec_files` 키가 공식 frontmatter 스키마에 없이 복수 plan 파일에서 사용됨
  - 위치: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` frontmatter; 동일 패턴이 `spec-draft-*` 계열 파일들에서 반복 추정
  - 상세: CLAUDE.md 의 공식 frontmatter 스키마는 `worktree`, `started`, `owner` 세 키만 정의한다. `spec_files` 는 plan_coherence checker 가 이 키를 파싱하지 않을 가능성이 있어 자동 검출 도구와의 통합이 보장되지 않는다. 비표준 키가 여러 파일에 정착하면 checker 툴과의 갭이 누적된다.
  - 제안: `spec_files` 를 정식 frontmatter 스키마에 추가하도록 CLAUDE.md 를 갱신하거나, 본문 내 `## 수정 대상 spec 파일` 섹션으로 이동하여 frontmatter 를 공식 3키로 유지한다.

---

### 6. CHANGELOG 삽입 앵커 부정확한 기술의 반복 패턴

- **[WARNING]** spec draft 문서들이 실제 파일 상태를 검증하지 않고 삽입 앵커를 오기재하는 패턴이 두 곳에서 발견됨
  - 위치: 파일 24(14_06_49/cross_spec/review.md) — 변경 2 에서 "기존 `2026-05-16 (ux-cleanup)` 행 다음" 이 실제로 존재하지 않는 앵커였음; 파일 11(13_29_47/convention_compliance/review.md) — `11_11_07` 세션 경로가 파일시스템에 미존재
  - 상세: 두 사례 모두 draft 작성 시점에 실제 파일 상태를 확인하지 않고 예상 상태를 기재한 것으로 보인다. CHANGELOG 삽입 앵커 오기는 개발자가 draft 를 그대로 따를 경우 삽입 위치 결정 불가 오류를 유발한다. 이 패턴은 단발 실수가 아닌 draft 작성 관행의 구조적 문제다.
  - 제안: spec draft 의 `정합성 self-check` 체크리스트에 "삽입 앵커가 실제 파일에 존재함 확인" 항목을 의무화한다. project-planner skill 워크플로에 spec draft 작성 시 실제 파일의 마지막 항을 Read 로 확인하는 단계를 추가한다.

---

### 7. plan frontmatter `worktree` 필드 갱신 누락의 반복 패턴

- **[WARNING]** 동일 plan 파일의 `worktree` frontmatter 가 Phase 전환 시 반복적으로 갱신되지 않는 패턴이 발견됨
  - 위치: `plan/in-progress/cafe24-node-resource-operation-ux.md` — Phase 1→2→3→4 전환마다 frontmatter 미갱신이 13_09_46, 13_29_47 두 세션의 convention_compliance 및 plan_coherence checker 에서 반복 경고됨
  - 상세: 동일 파일의 frontmatter 문제가 복수 세션에서 중복 발견되고 각 세션에서 동일한 제안이 반복된다. 문제가 해소되지 않은 채 다음 consistency-check 세션으로 이어진다. 이는 checker 발견사항이 RESOLUTION 흐름으로 연결되지 않는 절차적 단절을 나타낸다.
  - 제안: consistency-check 에서 WARNING 이상 발견 후 RESOLUTION.md 에 "frontmatter 갱신" 을 추적 가능한 TODO 로 기재하고, 다음 세션의 plan_coherence checker 가 이를 재확인하는 closed-loop 절차를 마련한다. 또는 Phase 전환 체크리스트에 "frontmatter `worktree` 갱신" 을 필수 항목으로 포함한다.

---

### 8. `_retry_state.json` 내 절대 경로 하드코딩

- **[INFO]** `_retry_state.json` 이 개발자 로컬 절대 경로를 포함함
  - 위치: `review/consistency/2026/05/16/14_06_49/_retry_state.json` — `session_dir`, `prompt_file`, `output_file` 필드가 `/Volumes/project/private/clemvion/...` 절대 경로 하드코딩
  - 상세: 이 파일이 저장소에 커밋되면 다른 환경(다른 마운트 경로, CI 환경)에서 재시도 로직이 동작하지 않는다. 또한 로컬 경로가 그대로 기록되어 보안·프라이버시 관점에서도 불필요한 정보가 포함된다.
  - 제안: `_retry_state.json` 을 `.gitignore` 에 추가하거나, 절대 경로 대신 세션 디렉토리를 기준으로 한 상대 경로 또는 `{SESSION_DIR}/...` 템플릿 변수를 사용하도록 orchestrator 스크립트를 개선한다.

---

### 9. `meta.json` 파일의 trailing newline 누락

- **[INFO]** `meta.json` 및 `_retry_state.json` 파일이 `No newline at end of file` 상태로 커밋됨
  - 위치: `review/consistency/2026/05/16/14_06_49/meta.json`, `review/consistency/2026/05/16/14_06_49/_retry_state.json`
  - 상세: POSIX 표준과 대부분의 코드 컨벤션은 텍스트 파일이 개행 문자로 끝나야 한다고 명시한다. diff 도구와 일부 파서에서 경고가 발생할 수 있다.
  - 제안: orchestrator 스크립트가 JSON 파일을 생성할 때 파일 끝에 `\n` 을 추가하도록 수정한다.

---

### 10. 동일 이슈의 중복 기록 비효율

- **[INFO]** cross_spec 과 plan_coherence 등 서로 다른 checker 가 동일한 drift 를 중복으로 발견하고 기재함
  - 위치: `spec/data-flow/5-integration.md` L90 의 `install_token=NULL` drift — 12_24_55/plan_coherence, 14_06_49/cross_spec 양쪽에서 독립적으로 발견됨. `cafe24-node-resource-operation-ux.md` frontmatter 문제 — 13_09_46/plan_coherence, 13_09_46/convention_compliance, 13_29_47/plan_coherence, 13_29_47/convention_compliance 4개 리뷰에서 동일 이슈 반복 기재
  - 상세: 검출 자체는 정상이나, 동일 이슈가 여러 checker 와 여러 세션에 걸쳐 반복 기재되면 SUMMARY 독자가 이슈의 실제 수를 오인할 수 있고, 조치 추적도 분산된다.
  - 제안: SUMMARY.md 작성 시 cross-checker 중복 이슈를 하나의 항목으로 dedup 처리하는 절차를 명시한다. 또는 checker 간 이슈 dedup 로직을 summary-agent 에 추가한다.

---

## 요약

리뷰 대상 파일들은 유지보수성 관점에서 몇 가지 반복 패턴의 구조적 문제를 보인다. 가장 주목할 부분은 (1) checker 산출물 간 문서 구조·헤딩 수준·헤더 형식의 불일치로, 동일 역할의 파일들이 세션마다 다른 형식을 취해 일관성이 결여되어 있다. (2) `spec-draft-*` 파일명 패턴과 `spec_files` frontmatter 키처럼 암묵적 관행이 CLAUDE.md 공식 컨벤션에 등재되지 않아 도구·사람 모두 일관된 처리가 어렵다. (3) plan frontmatter `worktree` 갱신 누락이 Phase 전환마다 반복되어 복수 세션에서 동일 경고가 재발한다 — 이는 발견된 이슈가 RESOLUTION 흐름으로 연결되지 않는 절차적 단절을 나타낸다. (4) spec draft 의 삽입 앵커 오기재가 두 곳에서 발견되어 draft 작성 단계의 self-check 절차 강화가 필요하다. `_retry_state.json` 의 절대 경로 하드코딩은 환경 이식성을 저해한다. 개별 리뷰 내용의 논리적 깊이와 정합성은 양호하나, 리뷰 산출물 자체의 형식 일관성과 폐루프(closed-loop) 추적 절차 정비가 유지보수성 향상의 핵심 과제다.

---

## 위험도

MEDIUM
