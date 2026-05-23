# Cross-Spec 일관성 검토 결과

- **대상**: `plan/in-progress/spec-harness-impl-coverage.md`
- **검토일**: 2026-05-23
- **검토자**: cross-spec consistency checker

---

## 발견사항

### [WARNING] `status: archived` 명칭과 `cafe24-api-catalog` 의 `deprecated` 충돌 가능성

- **target 위치**: 결정 A — spec frontmatter `status:` enum, `archived` 정의 및 명명 근거 주석
- **충돌 대상**: `spec/conventions/cafe24-api-catalog/_overview.md §3 status enum`
- **상세**:
  target 은 spec frontmatter 의 폐기 상태를 `archived` 로 명명하고 "Cafe24 endpoint 의 `deprecated` 와 의미 도메인이 달라 혼동 방지" 라는 근거를 inline 으로 달았다(결정 A의 `backlog` 설명 주석). 이 근거 자체는 타당하나, `cafe24-api-catalog/_overview.md §3` 의 `deprecated` 값이 "Cafe24 가 제거 또는 deprecate 했고 우리 노드에서도 더 이상 호출 안 함" 으로 정의되어 있어, **새 `spec/conventions/spec-impl-evidence.md` 가 도입된 뒤에는 `deprecated` (Cafe24 endpoint 폐기) vs `archived` (spec 폐기) 두 개의 "폐기" 유사 상태가 서로 다른 도메인·파일에 공존**한다.
  `spec-impl-evidence.md §Rationale` 에 이 구분이 명시될 예정(결정 A에서 언급)이지만, `cafe24-api-catalog/_overview.md §3` 쪽에도 "spec frontmatter 의 `archived` 와 이 `deprecated` 는 의미 도메인이 다르다" 는 한 줄 주석이 없으면 미래 독자가 혼동할 수 있다.
- **제안**: 신설 `spec/conventions/spec-impl-evidence.md §Rationale` 에 이미 반영 예정(결정 A 본문에 언급됨). 추가로 `spec/conventions/cafe24-api-catalog/_overview.md §3` 의 `deprecated` 행 설명 또는 각주에 "spec frontmatter status 와는 별개 도메인" 임을 한 줄 명시 권장.

---

### [WARNING] `review/consistency/coverage/<YYYY>/...` 경로가 CLAUDE.md 정보 저장 위치 표에 미등재

- **target 위치**: 결정 C-2, 결정 E-6
- **충돌 대상**: `CLAUDE.md §정보 저장 위치 (단일 진실 원칙)` 표
- **상세**:
  현재 CLAUDE.md 의 정보 저장 위치 표는 일관성 검토 산출물을 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 로 정의한다. target 은 `/spec-coverage` 슬래시 커맨드의 산출물을 `review/consistency/coverage/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/SUMMARY.md` 경로에 저장하도록 결정(C-2)하고, 이 변경을 E-6에서 CLAUDE.md 표에 신규 row 추가로 반영할 계획이다.
  그러나 현재 CLAUDE.md 에서는 `review/consistency/` 아래 임의 하위 경로(`coverage/`) 를 허용하는 규칙이 없다. `consistency-checker` skill 의 쓰기 권한이 `review/consistency/**` 로 glob 되어 있으므로 기술적 충돌은 아니지만, **현행 표가 `review/consistency/<YYYY>/...` 만 명시적으로 정의하고 있어, E-6 갱신이 이루어지기 전까지는 `coverage/` 하위 경로가 표에서 관리 밖**이다.
  target 은 E-6 를 통해 CLAUDE.md 를 갱신할 계획이므로 본 PR 안에서 해소 예정이지만, E 결정은 본 spec PR 의 범위이므로 즉시 수행되어야 한다(본 PR 에서 누락되면 표가 영구 inconsistent 상태가 된다).
- **제안**: E-6 갱신이 본 PR 의 실제 파일 변경 범위에 반드시 포함됨을 확인. 누락 시 `review/consistency/coverage/` 경로가 CLAUDE.md 표 미기재 상태로 운영되는 갭 발생.

---

### [WARNING] `<ImplAnchor>` 컴포넌트가 `spec/2-navigation/13-user-guide.md §8 공용 MDX 컴포넌트` 카탈로그에 미등재

- **target 위치**: 결정 B — 강제력 확보 (1)번 항목
- **충돌 대상**: `spec/2-navigation/13-user-guide.md §8 공용 MDX 컴포넌트` 표
- **상세**:
  `spec/2-navigation/13-user-guide.md §8` 은 현재 `<Steps>`, `<FieldTable>`, `<Callout>`, `<Example>` 4종 컴포넌트만 카탈로그에 등재되어 있다. target 은 신규 `<ImplAnchor>` 컴포넌트를 "본 PR 안에" `§공용 MDX 컴포넌트` 에 추가할 것을 명시(결정 B 강제력 확보 1번)하며, 이는 본 PR 의 실제 spec 파일 변경 범위에 포함된다.
  현재 카탈로그에 `<ImplAnchor>` 가 없는 것은 아직 신설 전이므로 자연스럽지만, **본 PR 이 `spec/2-navigation/13-user-guide.md` 를 실제로 변경하지 않으면 공용 MDX 컴포넌트 카탈로그 정의(`13-user-guide.md §8`)와 실제 사용 가이드 작성 규약(`user-guide-evidence.md` + `user-guide-writer` 체크리스트)이 분리된 채 운영**된다.
  결정 B 강제력 확보 (2)번(`PROJECT.md §SoT 문서 인덱스` 갱신)과 (3)번(`.claude/agents/user-guide-writer.md` 갱신)도 동일하게 본 PR 범위로 명시되어 있어 누락 시 동일한 갭이 발생한다.
- **제안**: 본 PR 의 실제 파일 변경 목록(`spec/2-navigation/13-user-guide.md`, `PROJECT.md`, `.claude/agents/user-guide-writer.md`)이 계획대로 수정되도록 확인. `spec/2-navigation/13-user-guide.md §8` 에 `<ImplAnchor>` 행을 추가하고 `kind` enum, `file`·`symbol`·`describes` 속성을 카탈로그에 기술.

---

### [WARNING] `PROJECT.md §유저 가이드 파일 컨벤션 SoT 문서 인덱스` 에 신규 convention 문서 미등재

- **target 위치**: 결정 E-5
- **충돌 대상**: `PROJECT.md §유저 가이드 파일 컨벤션 > SoT 문서 인덱스` (현재 5문서 목록)
- **상세**:
  현재 `PROJECT.md §유저 가이드 파일 컨벤션 > SoT 문서 인덱스` 는 `PROJECT.md`, `spec/2-navigation/13-user-guide.md`, `codebase/frontend/src/lib/docs/locale.ts` 등의 문서를 나열하고 있다. target 은 E-5에서 `spec/conventions/spec-impl-evidence.md` 와 `spec/conventions/user-guide-evidence.md` 두 문서를 이 인덱스에 추가할 것을 결정했다.
  이 갱신 역시 본 PR 파일 변경 범위에 명시되어 있지만, 본 PR 의 실제 spec 파일 작성이 계획대로 수행되지 않으면 `user-guide-writer` sub-agent 가 `user-guide-evidence.md` 를 읽지 않아도 된다고 판단하는 상황이 발생한다.
- **제안**: E-5 항목이 본 PR 안에서 실제 `PROJECT.md` 편집으로 이행되도록 확인. `spec/conventions/spec-impl-evidence.md` 와 `spec/conventions/user-guide-evidence.md` 신설이 함께 이루어져야 인덱스 등록이 의미 있다.

---

### [INFO] `i18n-userguide.md §Principle 7` 의 "자동 결정 검출 불가" 주석이 신규 `<ImplAnchor>` 가드 도입 후 stale 될 수 있음

- **target 위치**: 결정 B 강제력 확보 (4)번 — "후속 plan 3 범위로 명시만"
- **충돌 대상**: `spec/conventions/i18n-userguide.md §Principle 7`
- **상세**:
  `i18n-userguide.md §Principle 7` 은 "자동 결정 검출 불가. 본 규약은 코드 리뷰 / consistency-check 의 점검 가이드로 사용된다." 라고 명시되어 있다. target 의 결정 B(`impl-anchor-existence.test.ts`, `integrations-coverage.test.ts`, `triggers-coverage.test.ts`)가 도입되면 "GUI 흐름 절에 `<ImplAnchor>` 존재" 는 자동 검출이 가능해진다.
  target 은 이 갱신을 "후속 plan 3 범위" 로 명시했으므로 본 PR 에서는 충돌이 발생하지 않는다. 그러나 후속 plan 3 (`user-guide-reverse-coverage.md`) 이 완료된 뒤 `i18n-userguide.md §Principle 7` 이 갱신되지 않으면 "자동 검출 불가" 주석이 영구 stale 된다.
- **제안**: 후속 plan 3 (`user-guide-reverse-coverage.md`) 의 TODO 항목에 `i18n-userguide.md §Principle 7` 주석 갱신을 명시적으로 추가. target 은 이미 "(4)번으로 명시만" 했으나 plan 3 의 실제 범위에 이 항목이 포함되도록 plan stub 에 기재 권장.

---

### [INFO] `spec/0-overview.md §6.3 로드맵` 연동 미명시 — `status: backlog` 가드 대상 spec 파일 수

- **target 위치**: 결정 A — `backlog` status 설명, "`spec/0-overview.md §6.3 로드맵` 항목 매칭 의무 (가드)"
- **충돌 대상**: `spec/0-overview.md §6.3 로드맵 / 미구현`
- **상세**:
  target 은 `status: backlog` 인 spec 파일이 `spec/0-overview.md §6.3 로드맵` 항목과 매칭되어야 한다고 정의하고 이를 build-time 가드로 강제할 계획이다. 그러나 현재 `spec/0-overview.md §6.3` 의 항목 수가 5개 정도에 불과하며, spec 파일 60여 개 중 구현 의도가 있지만 단기 로드맵에 없는 것들이 다수 존재할 수 있다.
  `spec-status-lifecycle.test.ts` 가 `backlog` 상태의 모든 spec 파일에 대해 `§6.3 로드맵 항목 매칭` 을 hard fail 로 강제한다면, spec 파일 rollout(후속 plan 2) 시점에 `§6.3` 로드맵 표가 대거 확장되거나, 다수 spec 이 `spec-only` 로 강제 분류되어야 한다. 현재 `§6.3` 의 항목 형태가 "자유 텍스트 영역명" 이라 자동 매칭 granularity 가 불명확하다.
- **제안**: `spec/conventions/spec-impl-evidence.md §Rationale` 에 `backlog` ↔ `§6.3` 매칭의 정확한 granularity(예: 영역명 prefix 매칭, 키워드 포함 여부 등)와 매칭이 없을 때 가드가 fail vs warn 인지를 명시. 또한 후속 plan 2(`spec-frontmatter-rollout.md`) 착수 전에 `§6.3` 항목 목록이 충분히 확장되어 있는지 확인하는 전제 조건을 plan 2 에 기재.

---

### [INFO] `plan-lifecycle.md §audit` 절 추가가 기존 plan-lifecycle 규약과 충돌 없는지 확인 필요

- **target 위치**: 결정 C — `.claude/docs/plan-lifecycle.md` 에 §audit 절 추가
- **충돌 대상**: `.claude/docs/plan-lifecycle.md` §1~5 (기존 본문)
- **상세**:
  기존 `plan-lifecycle.md` 는 §1 폴더 구조, §2 분류 기준, §3 이동 규칙, §4 frontmatter 스키마, §5 이동 commit 자가 점검 5섹션으로 구성된다. target 은 여기에 `§audit` 절을 추가해 `plan-stale-audit.sh` 도구를 참조하도록 한다. 현재 plan-lifecycle.md 는 "plan 문서를 어떻게 관리하는가" 의 규약 문서이고, `§audit` 는 운영 도구(bash 스크립트) 참조를 추가하는 성격이다. 내용 자체의 충돌은 없으나, **§audit 가 plan-lifecycle 규약의 일부인지 별도 운영 가이드인지 구분이 모호**하면 consistency-checker 가 미래에 "plan-lifecycle.md 에 운영 스크립트 참조가 왜 있는가?" 를 의문으로 제기할 수 있다.
- **제안**: `plan-lifecycle.md §audit` 추가 시 해당 절 첫 문장에 "본 절은 stale plan 탐지 도구로, 규약 변경이 아닌 운영 보조 참조" 임을 명시하여 기존 §1~5 의 규범적 성격과 구분.

---

### [INFO] `spec/conventions/secret-store.md` 의 `secret://` URI scheme 과 신규 `ImplAnchor.file` 경로 체계 간 혼동 가능성 없음 — 확인 완료

- **target 위치**: 결정 B — `<ImplAnchor file="codebase/frontend/...">` 속성
- **충돌 대상**: `spec/conventions/secret-store.md` (`secret://` URI)
- **상세**:
  `<ImplAnchor file=...>` 는 파일 시스템 상대 경로이고, `spec/conventions/secret-store.md` 의 `secret://` 는 논리적 URI scheme 으로 완전히 다른 도메인이다. 혼동 가능성 없음. 다만 `<ImplAnchor file=...>` 의 경로 기준(레포 루트 기준 상대경로 vs 절대경로)이 `spec/conventions/spec-impl-evidence.md` 의 `code:` 글로브와 일치해야 한다는 점은 신설 컨벤션 문서에 명시 필요.
- **제안**: `spec/conventions/user-guide-evidence.md` 의 `<ImplAnchor file=...>` 경로 기준을 "레포 루트 기준 상대경로 (예: `codebase/frontend/...`)" 로 명시. 이는 `spec-impl-evidence.md` 의 `code:` 글로브 패턴과 동일 기준을 사용하도록 정렬.

---

## 요약

Cross-Spec 일관성 관점에서 target 은 전반적으로 기존 spec 과 직접 모순되는 Critical 이슈 없이 설계되어 있다. 핵심 위험은 두 가지다. 첫째, `status: archived` (신설) 와 `cafe24-api-catalog` 의 `deprecated` 는 의미 도메인이 다름에도 target 의 Rationale 인용이 `spec-impl-evidence.md` 에만 집중되고 카탈로그 쪽에는 역방향 설명이 없어 미래 독자의 혼동 가능성이 있다. 둘째, 결정 B/E 에서 명시한 `spec/2-navigation/13-user-guide.md §8`, `PROJECT.md §SoT 문서 인덱스`, `.claude/agents/user-guide-writer.md` 갱신이 본 PR 의 실제 파일 변경에 포함되지 않으면 신규 `<ImplAnchor>` 컴포넌트가 카탈로그에서 분리된 채 운영된다. 또한 결정 C-2/E-6 의 `review/consistency/coverage/` 경로가 CLAUDE.md 표에 반영되지 않으면 산출물 경로가 정책 밖이 된다. 이 세 WARNING 은 모두 본 PR 안에서의 실제 파일 변경으로 해소 가능하다. INFO 항목들은 후속 plan 에서 처리하면 충분하다.

---

## 위험도

**MEDIUM**
