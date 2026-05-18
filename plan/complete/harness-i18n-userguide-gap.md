---
worktree: harness-i18n-userguide-cded87
started: 2026-05-16
owner: developer
---

# 하네스 보완 제안 — i18n / 유저 가이드 갱신 누락 방지

## 문제 정의

최근 3주간 머지된 PR 중 다음과 같은 **사후 보정** 패턴이 누적 발생.

| 사후 보정 commit | 누락 유형 |
| --- | --- |
| `fix(i18n): Cafe24 노드 설정 하드코딩 문자열 i18n 정리` (PR #58) | 노드 설정 TSX 에 한국어 문자열 하드코딩 (dict 미경유) |
| `fix(i18n): AI Agent 노드 설정 한/영 양방향 누락 번역 정리` (PR #57) | `ko.ts` 또는 `en.ts` 한쪽만 키가 존재 (parity 결손) + `backend-labels.ts` 누락 |
| `docs(user-guide): cafe24 페이지의 외부 URL 정정` | 기능 변경 후 `/docs/06-integrations-and-config/cafe24.mdx` 가 stale |
| `docs(user-guide): FAQ 섹션을 사이드바 맨 아래로 + locale.ts 라벨 동기화` | 신규 섹션 디렉토리 추가 시 `SECTION_LABELS_BY_LOCALE` 미등록 |
| `docs(frontend): 한국어 가이드·UI i18n 어색 표현 일제 정리` | 글로서리·해요체 규약 미준수 |
| `fix(e2e): background-run-section assertions to ko-default i18n strings` | UI 문자열 변경이 e2e 회귀로 뒤늦게 드러남 |

공통 원인: **변경의 종류와 후속 갱신 항목 사이의 매핑이 하네스에 명시되지 않음.** 개발자는 코드 변경에 집중하다 i18n dict / 유저 가이드 / locale 라벨 갱신을 잊는다.

## 현행 하네스의 약점 (구체)

### CLAUDE.md
- i18n 정책 언급 0건. README.md 만 "제품 최종 상태" 로 언급될 뿐, 유저 가이드(`codebase/frontend/src/content/docs/`) 와의 동기화 규약은 없음.

### `.claude/skills/developer/SKILL.md`
- §DOCUMENTATION (~line 50) 항목이 3줄로만 구성:
  - `codebase/frontend/docs 에서 제공되는 사용자 설명서` ← **경로 오기** (실제는 `codebase/frontend/src/content/docs/`)
  - backend swagger doc — "API 변동 시"
  - README.md — "제품 최종 상태 바뀐 경우"
- i18n dict (`codebase/frontend/src/lib/i18n/dict/{ko,en}.ts`), backend-labels, locale.ts SECTION_LABELS 는 **전혀 언급 없음**.
- "어떤 변경 시 → 어떤 문서 갱신" 의 trigger 매핑이 없어, 개발자가 매번 자체 판단해야 함.
- §E2E TEST WRITING GUIDE 의 i18n 매칭 패턴(`getByText(/한글|English/i)`)은 "테스트 쓸 때"만 다루고, 코드 자체의 i18n 키 누락은 다루지 않음.

### `.claude/skills/project-planner/SKILL.md`
- 신규 spec 작성 시 그 영역이 유저 가이드 섹션과 매핑되는지, dict 키가 늘어나는지 검토하는 trigger 없음.

### `.claude/skills/consistency-checker/SKILL.md` (5개 checker)
| checker | 현재 커버 | i18n/user-guide 관련성 |
| --- | --- | --- |
| `cross-spec-checker` | 데이터 모델·API·요구사항 ID 충돌 | UI 문자열·user-guide 페이지 변동 미커버 |
| `rationale-continuity-checker` | 폐기 결정 재도입 | 무관 |
| `convention-compliance-checker` | `spec/conventions/**` 위반 | i18n 규약은 spec/conventions 에 정식 등록 안 됨 (있다면 자동 커버되지만 없음) |
| `plan-coherence-checker` | plan/worktree 충돌 | 무관 |
| `naming-collision-checker` | 식별자 중복 | i18n key 중복·orphan 미커버 |

### `.claude/skills/code-review-agents/` (13개 reviewer)
- `documentation-reviewer` 체크리스트는 docstring/JSDoc/README/API 문서/주석/CHANGELOG 등 **개발자 대상 문서**만 다룸. 유저 가이드(`codebase/frontend/src/content/docs/**`) 와 i18n dict 는 명시 항목 아님.
- 다른 12개 reviewer 도 i18n 키 parity·user-guide sync 를 직접 점검하지 않음.

### 자동 가드 (테스트·lint)
- `codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts` (80줄): `translate()` 동작 / locale 상수 / fallback 만 검증. **ko.ts ↔ en.ts 키 parity 미검증**.
- `codebase/frontend/src/lib/docs/__tests__/locale.test.ts` (81줄): 알려진 섹션 라벨만 spot check. **현재 docs 디렉토리의 모든 섹션이 KO/EN 양쪽에 등록됐는지 미검증**.
- `codebase/frontend/src/lib/docs/__tests__/registry.test.ts` (213줄): frontmatter `spec`/`code` 경로 실존 검증은 있음 (✓). 하지만 KO mdx 의 sibling `<slug>.en.mdx` 존재·sync 는 미검증.
- ESLint: 하드코딩 한국어 문자열 검출 룰 없음.

## 제안 — 4단계 방어선 (마이그레이션 가드 패턴 재사용)

마이그레이션 V번호 중복 가드와 동일한 다층 방어 구조로 보완. 각 단계는 독립적으로 효과가 있고, 누락이 발생해도 다음 단계에서 잡힌다.

### 1단계 (예방) — `developer/SKILL.md` DOCUMENTATION 섹션 강화

현재 3줄 → 변경 유형별 트리거 매핑 표로 확장. **이 단계가 가장 효과가 크다** (개발자가 작업 진입 시점에 본다).

#### 1-A. 경로 정정
`codebase/frontend/docs` → `codebase/frontend/src/content/docs/` 로 수정.

#### 1-B. 변경 유형 → 갱신 대상 매핑 표 신설

```markdown
| 변경 유형 | 필수 갱신 위치 | 검증 명령 |
| --- | --- | --- |
| 새 노드 추가 (`codebase/backend/src/nodes/<cat>/<name>/`) | (a) `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx` + `.en.mdx`<br>(b) `codebase/frontend/src/lib/i18n/dict/{ko,en}.ts` 의 노드명·필드명·placeholder<br>(c) `codebase/frontend/src/lib/i18n/backend-labels.ts` (errorCode·label) | `cd codebase/frontend && npm test -- i18n docs` |
| 노드 schema 변경 (필드 추가·라벨 변경) | (a) `codebase/frontend/src/content/docs/02-nodes/<cat>.mdx` 의 FieldTable<br>(b) `codebase/frontend/src/lib/i18n/dict/{ko,en}.ts` 의 해당 키<br>(c) `codebase/frontend/src/lib/i18n/backend-labels.ts` 의 label | 동일 |
| UI 문자열 추가/변경 (TSX) | `dict/{ko,en}.ts` 양쪽 — 한쪽만 추가 금지 (parity 가드 fail) | `cd codebase/frontend && npm test -- i18n` |
| Integration 신규/변경 | `codebase/frontend/src/content/docs/06-integrations-and-config/<provider>.{mdx,en.mdx}` | docs registry test |
| 유저 가이드 신규 섹션 추가 (`content/docs/<NN>-<name>/`) | `codebase/frontend/src/lib/docs/locale.ts` 의 `SECTION_LABELS_BY_LOCALE` 양쪽 로케일 등록 | `cd codebase/frontend && npm test -- locale` |
| 백엔드 API 변경 | (a) swagger jsdoc<br>(b) 영향받는 user-guide 페이지 | swagger test |
| 인증·권한 흐름 변경 | `codebase/frontend/src/content/docs/07-workspace-and-team/` + e2e | `make e2e-test` |
| 표현식 언어 변경 | `codebase/frontend/src/content/docs/04-expression-language/` (basics / cheatsheet / variables) | 수동 |
| README 영향 변경 (런타임, 환경 변수, 실행 방법) | `README.md` (최종 상태 서술) | 수동 |
```

#### 1-C. 작업 워크플로 §4 (DOCUMENTATION 업데이트) 의 명확화

"이 단계는 §1-B 매핑표를 보고 누락 없이 갱신한다. 갱신 후 §1-B 의 검증 명령으로 parity / sync 를 즉시 확인. 검증 fail 이면 §4 가 끝나지 않은 것 — 단계 5 (테스트 선작성) 로 진입 금지."

### 2단계 (사전 검토) — `consistency-checker` 확장

**옵션 A (권장): 기존 `convention-compliance-checker` 의 prompt 에 i18n / user-guide 규약 점검 항목 추가**

- 이유: 새 checker 추가는 매 호출당 비용·시간 증가. i18n 규약은 본질적으로 "convention 준수" 카테고리.
- 추가 점검 항목 (`.claude/agents/convention-compliance-checker.md` 의 체크리스트에):
  1. spec 변경이 i18n dict 추가를 함의하는지 — UI 문자열·노드 설정·에러 메시지 신설 시 dict 갱신 plan 이 plan/in-progress 에 명시됐는지
  2. 신규 spec 영역이 유저 가이드 섹션과 매핑되는지 — `codebase/frontend/src/content/docs/<섹션>/<slug>.mdx` 의 신규/갱신 plan 이 있는지
  3. `codebase/frontend/src/content/docs/_i18n-conventions.md` 의 파일 명명·frontmatter 규약 위반 여부 (planner 가 docs 갱신 plan 을 짤 때)
  4. `codebase/frontend/src/content/docs/_glossary.md` 의 문체·금지어 위반 여부

**옵션 B: 신규 `i18n-userguide-coherence-checker` 추가 (5 → 6 checker)**

- 이유: i18n / user-guide 이슈가 cross-cutting 이라 별도 관점이 더 깔끔.
- 비용: 매 consistency-check 호출당 reviewer 1개 추가 (~수십 초·model 호출 1회).
- 책임: 위 4개 점검 항목을 전담.

**권장**: 옵션 A 부터 시도. 호출 빈도·실효성을 1–2주 관측 후 옵션 B 로 승격할지 결정.

### 3단계 (사후 리뷰) — `code-review-agents` 강화

`.claude/agents/documentation-reviewer.md` 의 체크리스트(현재 8개)에 항목 추가:

```markdown
9. **i18n 키 커버리지**: TSX 안의 한국어 하드코딩 문자열 / `dict/{ko,en}.ts` 한쪽 키 누락
10. **유저 가이드 sync**: 변경된 코드가 user-guide 페이지에 영향을 주는지 (특히 신규 노드·integration·필드)
11. **locale 라벨 등록**: 신규 `content/docs/<섹션>/` 디렉토리가 `locale.ts` 에 KO/EN 양쪽 등록됐는지
```

documentation-reviewer 가 frontend 변경에서 위 3건을 직접 grep 하므로, 자동 검출 가능한 영역이 넓다.

### 4단계 (자동 가드) — 결정적 검출

ai 리뷰는 비결정적이므로 정량 가드가 추가로 필요. 마이그레이션 가드(`check-duplicate-versions.sh`) 와 동일 철학.

#### 4-A. ko ↔ en dict parity 단위 테스트

`codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts` 에 추가:

```typescript
it("ko 와 en 사전의 leaf key 집합이 일치한다", () => {
  // recursive flatten → ko keys === en keys
  const koKeys = flattenKeys(ko);
  const enKeys = flattenKeys(en);
  const koOnly = [...koKeys].filter(k => !enKeys.has(k));
  const enOnly = [...enKeys].filter(k => !koKeys.has(k));
  expect({ koOnly, enOnly }).toEqual({ koOnly: [], enOnly: [] });
});
```

PR #57 의 음성 케이스가 정확히 이걸로 잡힌다.

#### 4-B. SECTION_LABELS_BY_LOCALE coverage 테스트

`codebase/frontend/src/lib/docs/__tests__/locale.test.ts` 에 추가:

```typescript
it("content/docs/ 의 모든 (숨김 아닌) 섹션이 KO/EN 양쪽 라벨을 가진다", () => {
  // fs.readdirSync(content/docs) 의 NN-* 디렉토리 → SECTION_LABELS_BY_LOCALE.ko/en 양쪽에 있어야 함
});
```

PR #50 (FAQ 사이드바 이동 + locale.ts 동기화) 의 음성 케이스가 잡힌다.

#### 4-C. KO ↔ EN mdx sibling coverage 테스트 (옵션)

`registry.test.ts` 에 추가:

```typescript
it("모든 <slug>.mdx 는 <slug>.en.mdx sibling 을 가진다 (draft 제외)", () => {
  // 미존재 시 fail; production 빌드 시 EN 사용자는 KO + 안내 배너로 노출되므로 hard fail 은 과할 수 있음
  // → warn-only mode (FAIL_ON_MISSING_EN=1 env 로 활성화) 권장
});
```

**주의**: `_i18n-conventions.md` §"새 로케일 추가 절차" 는 sibling 미존재 시 KO 폴백 + 배너를 정상 동작으로 정의. 따라서 이 테스트는 **hard fail 이 아닌 console.warn + 카운터** 가 적절. CI 게이트로는 4-A / 4-B 가 핵심.

#### 4-D. 하드코딩 한국어 문자열 ESLint 룰 (장기 옵션)

- 룰: TSX 안의 JSX text 또는 string literal 중 `[가-힣]` 매칭이 dict 파일 / mdx 파일 / 테스트 / 주석 외에 등장하면 warn.
- 비용: 룰 작성·예외 화이트리스트 관리 부담. 일단 4-A 로 dict 갱신 누락은 잡히므로, 4-D 는 후속 과제로 둔다.

## 추천 우선순위 / 단계별 배포

| 우선순위 | 항목 | 상태 | 비용 | 효과 |
| --- | --- | --- | --- | --- |
| **P0 (1차)** | 1-A 경로 정정 + 1-B 매핑표 + 1-C 절차 명확화 | **DONE (본 PR)** | 30 분 (developer/SKILL.md 1 파일) | 큼 — 모든 신규 작업의 진입 시점에 효과 |
| **P0 (1차)** | 4-A ko↔en parity 테스트 | **DONE (본 PR)** | 1 시간 (i18n.test.ts) | 큼 — PR #57 같은 케이스 즉시 차단 |
| **P0 (1차)** | 4-B SECTION_LABELS coverage 테스트 | **DONE (본 PR)** | 1 시간 (locale.test.ts + `hasExplicitSectionLabel` export) | 중 — PR #50 같은 케이스 차단 |
| **P1 (2차)** | 2-옵션 A: convention-compliance-checker prompt 확장 | **DONE (후속 PR, 옵션 변형)** — spec/conventions/i18n-userguide.md 신설로 등가 처리. generic agent prompt 수정 없이 자동 inheritance. (commit 8c4cbe8f) | 30 분 (conventions 문서) | 중 — checker 가 spec/conventions/ 를 자동으로 본다 |
| **P1 (2차)** | 3단계: documentation-reviewer 체크리스트 확장 | **의도적 미채택** — 공유 하네스 (.claude/agents/*) 수정 회피. spec/conventions/i18n-userguide.md 가 동일 점검 항목을 정식 규약으로 제공 | — | — |
| **P1-B (신규)** | backend-labels parity 테스트 (warningRules / NodeMetadata label·description) | **DONE (후속 PR)** — backend SoT 와 frontend ko 매핑 차집합 검증. Merge 도먼트 경고 2건 ko 매핑 추가 (commit 884d6867) | 2 시간 | 큼 — PR #57 / cbffad22 패턴 결정적 차단 |
| **P1-C (신규)** | 노드 MDX coverage 테스트 | **DONE (후속 PR)** — backend 노드 schema 파일이 02-nodes/*.mdx 의 frontmatter code: 어딘가에 등장하는지 검증 (commit f49d7f0a) | 2 시간 | 중 — `docs(user-guide): sync MDX with implementation` 패턴 차단 |
| **P1-D (신규)** | PROJECT.md 매핑표에 errorCode 행 추가 + 자동 가드 절 보강 | **DONE (후속 PR)** — backend 신규 errorCode/warningCode 발행 시 backend-labels.ts 갱신 명시 (commit 6778b5cb) | 5 분 | 중 |
| **P2 (3차)** | 4-C mdx sibling coverage (warn-only) | **의도적 미채택** — KO 폴백 + 안내 배너가 정상 동작 (_i18n-conventions.md §"새 로케일 추가 절차"). hard fail 무리, warn-only 도 실효성 낮음 | — | — |
| **P3 (후속)** | 4-D ESLint 한국어 하드코딩 룰 | **DONE 등가 (후속 PR, 옵션 변형)** — P2-b grep 기반 ratchet 테스트로 대체. ESLint custom rule 부담 회피 (commit 9839241a) | 1.5 시간 (vs ESLint 4 시간) | 중 — 신규 위반은 결정적 차단, 기존 baseline 은 점진적 0 화 |
| **P3 (후속)** | 2-옵션 B: 신규 checker 분리 | **의도적 미채택** — 옵션 A (spec/conventions/i18n-userguide.md) 가 등가 효과로 안착. 별 checker 호출 비용·시간 증가 회피 | — | — |

## 본 PR 변경사항 (P0)

- `.claude/skills/developer/SKILL.md` — 작업 워크플로 §4 명확화 + DOCUMENTATION 섹션 전면 개정 (경로 정정 + 변경 유형→갱신 위치 매핑표 + 자동 가드 안내).
- `codebase/frontend/src/lib/i18n/__tests__/i18n.test.ts` — `flattenLeafKeys` 헬퍼 + `dict parity (ko ↔ en)` describe 신설 (2 테스트 추가).
- `codebase/frontend/src/lib/docs/locale.ts` — `hasExplicitSectionLabel(key, locale)` 신규 export.
- `codebase/frontend/src/lib/docs/__tests__/locale.test.ts` — `SECTION_LABELS_BY_LOCALE coverage` describe 신설 (3 테스트 추가) + `hasExplicitSectionLabel` 단위 테스트 2건.

검증:
- 정상: `npm test -- i18n locale` 53/53 통과.
- 음성 1 (ko 만 키 추가): parity 테스트 fail.
- 음성 2 (새 섹션 디렉토리, locale.ts 미등록): coverage 테스트 양쪽 로케일 모두 fail.
- lint·build 통과.

## 후속 (P1+) — 본 plan 으로 모두 처리됨

P1+ 항목은 다음 후속 PR (worktree-i18n-guard-extension-a7b3c9) 으로 모두 처리됐다:

- **P1-A (2-옵션 A 변형)**: `spec/conventions/i18n-userguide.md` 신설 — 7 Principle 정식 규약. convention-compliance-checker 가 spec/conventions/ 를 자동 inheritance 하므로 공유 하네스 agent 수정 없이 동일 효과 (commit 8c4cbe8f).
- **P1-B (신규)**: backend-labels parity 테스트 — backend `*.schema.ts` 의 NodeComponentMetadata 발행 영문 SoT 가 frontend `WARNING_KO` / `NODE_LABEL_KO` / `NODE_DESCRIPTION_KO` 에 매핑됐는지 정적 검증. Merge 도먼트 경고 2건 ko 매핑 동시 추가 (commit 884d6867).
- **P1-C (신규)**: 노드 MDX coverage 테스트 — backend 의 모든 노드 schema 파일이 02-nodes/<cat>.mdx 의 frontmatter `code:` 어딘가에 등장하는지 검증 (commit f49d7f0a).
- **P1-D (신규)**: PROJECT.md 매핑표에 backend errorCode 발행 행 추가 + §자동 가드 절에 신규 3개 테스트 + spec/conventions/i18n-userguide.md 링크 (commit 6778b5cb).
- **P2-b (4-D 변형)**: 하드코딩 한국어 ratchet 테스트 — `src/{components,app,lib}/**` 한국어 라인 카운트가 baseline 이상으로 증가하지 않도록 감시. ESLint custom rule 부담 회피. baseline 초기 6 파일 32 라인 (commit 9839241a).

**의도적 미채택 항목**:
- 3단계 documentation-reviewer 체크리스트 확장 — 공유 하네스 (.claude/agents/*) 수정 회피. P1-A 의 conventions 등록으로 등가 효과.
- 4-C mdx sibling coverage — KO 폴백 + 안내 배너가 의도된 동작 (_i18n-conventions.md). hard fail 무리, warn-only 도 실효성 낮음.
- 2-옵션 B 신규 checker 분리 — P1-A 가 등가 효과로 안착. 호출 비용 증가 회피.

## 비고

- **마이그레이션 가드와의 일관성**: 이 4단계 구조(예방·사전 검토·사후 리뷰·자동 가드)는 PR #55 에서 이미 검증된 패턴. 새 패턴 도입이 아니라 동일 패턴의 적용 확장.
- **spec/conventions/ 정식 등록**: P0 가 안착하면 `spec/conventions/i18n-userguide.md` 신설을 검토한다. 그렇게 하면 convention-compliance-checker 가 자동으로 새 규약을 본다 — 옵션 2-A 의 자연스러운 안착 경로.
- **scope-reviewer 와의 충돌**: scope-reviewer 는 "의도 이상의 변경"을 잡지만, i18n / user-guide 갱신은 의도된 추가 변경이다. P0 매핑표가 "의도된 함께 변경" 의 white list 역할을 한다.
