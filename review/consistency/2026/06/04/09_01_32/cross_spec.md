# Cross-Spec 일관성 검토 결과

**Target**: `spec/conventions/spec-impl-evidence.md`
**모드**: `--impl-done` (구현 완료 후 검토)
**검토 일시**: 2026-06-04

---

## 발견사항

### 발견사항 1

- **[WARNING]** `spec_impact` 허용값 범위가 spec 문서와 구현 코드 사이에 미묘하게 불일치
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.2` Gate C 행 — "`none`/`없음`" 만 명시
  - 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/spec-plan-completion.test.ts` line 25 `NONE_VALUES = new Set(["none", "없음", "n/a", "na"])`
  - 상세: spec 문서는 Gate C 설명에서 허용 sentinel 을 `"none"` / `"없음"` 두 가지만 표기하고 있다. 그러나 실제 build 가드 코드는 `"n/a"` 와 `"na"` 도 허용한다. R-8 Rationale 도 `none`/`없음` 만 언급한다. plan-lifecycle §5 Gate C 예시 역시 `none` 만 보여준다. 사용자가 `n/a` 나 `na` 로 작성하면 테스트는 통과하지만 spec 설명과 어긋나 혼선이 생길 수 있다.
  - 제안: spec 문서 §4.2 표의 Gate C 행과 R-8 본문을 `none`/`없음`/`n/a`/`na` 로 동기화하거나, 반대로 코드의 `NONE_VALUES` 를 `none`/`없음` 두 가지로 좁히는 방향 중 하나를 결정한다.

### 발견사항 2

- **[INFO]** `plan-frontmatter.test.ts` 가드의 필드 규약 SoT 위임 구조가 일관적으로 기술됨 — 추가 확인 필요 없음
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.2` plan-frontmatter 행 — "가드 규약 SoT = plan-lifecycle §4" 명시
  - 충돌 대상: `.claude/docs/plan-lifecycle.md §4` (worktree 버전) — `worktree`/`started`/`owner` 3필드 정의, `(unstarted)` sentinel, placeholder 거부 등 동일하게 기술
  - 상세: 두 문서의 역할 분리(spec-impl-evidence = 가드 파일 등재·SoT 위임 선언, plan-lifecycle = 필드 규약·sentinel 정의)가 명확히 구현되어 있고 내용도 일치한다. 충돌 없음.
  - 제안: 없음 (현재 구조 적절).

### 발견사항 3

- **[INFO]** `spec-area-index.test.ts` 의 `spec/conventions/` 면제가 target spec 본문과 일치
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.2` spec-area-index 행 — "`spec/conventions/`(flat reference, 무-index), 카탈로그" 면제
  - 충돌 대상: 없음 — `spec-area-index.test.ts` line 196 `if (rel === "spec/conventions") continue;` 와 정확히 일치
  - 상세: 충돌 없음. 면제 범위가 spec 과 코드에서 동일하게 정의된다.
  - 제안: 없음.

### 발견사항 4

- **[INFO]** Gate C cutoff `2026-06-04` 가 3곳(spec-impl-evidence, plan-lifecycle, test 코드)에 동기화되어 있음
  - target 위치: `spec/conventions/spec-impl-evidence.md §R-8` — "cutoff 값은 spec-impl-evidence·plan-lifecycle·test 3곳에 동기 유지"
  - 충돌 대상: `.claude/docs/plan-lifecycle.md §5 Gate C` / `spec-plan-completion.test.ts` line `GATE_C_CUTOFF = new Date("2026-06-04T00:00:00Z")`
  - 상세: 세 위치 모두 `2026-06-04` 로 일치. 충돌 없음.
  - 제안: 없음. 단, R-8 의 주석("변경 시 3곳 동시 갱신")이 유지보수 지침으로 명확히 기재되어 있어 향후 drift 방지 책임이 명시되어 있다.

### 발견사항 5

- **[INFO]** `spec-link-integrity.test.ts` 의 카탈로그 제외 범위가 기존 spec-frontmatter-parse.ts 와 정렬됨
  - target 위치: `spec/conventions/spec-impl-evidence.md §4.2` spec-link-integrity 행 — "생성형 `*-api-catalog/` 트리" 제외
  - 충돌 대상: `spec-frontmatter-parse.ts` 의 `CATALOG_FIELD_FILE` 정규식(§1·§R-7 기준)과 `spec-links.ts` 의 `inGeneratedCatalog` 함수 — 모두 `-api-catalog/` 경로 segment 포함 시 제외
  - 상세: 제외 기준(`-api-catalog/`를 포함하는 경로)이 두 가드 간에 동일하게 구현된다. 충돌 없음.
  - 제안: 없음.

---

## 요약

`spec/conventions/spec-impl-evidence.md` 의 신규 §4.2 (지식저장소·plan 무결성 가드 4건 + Gate D advisory) 및 Gate C 가드 구현(`spec-plan-completion.test.ts` 외 3건)은 기존 spec 영역(`plan-lifecycle`, `0-overview.md`, `spec-frontmatter-parse.ts` 등)과 전반적으로 일관된다. 데이터 모델·API 계약·RBAC·상태 머신 충돌은 없다. 유일한 주의 지점은 Gate C의 `spec_impact` 허용 sentinel 범위로, 구현 코드(`NONE_VALUES`)가 `n/a`·`na` 를 추가 허용하지만 spec 문서와 plan-lifecycle 예시는 `none`/`없음` 두 값만 언급한다. 이는 CRITICAL 수준 모순은 아니나 사용자 인지 불일치를 초래할 수 있어 명시적 동기화가 권장된다.

## 위험도

LOW

---

STATUS: OK
