# 정식 규약 준수 검토 — convention_compliance

검토 대상: `plan/in-progress/rag-eval-harness.md`
검토 모드: `--impl-prep` (구현 착수 전)
검토 일시: 2026-06-06

---

## 발견사항

### [WARNING] plan frontmatter 에 비표준 필드 `spec_refs` 사용
- target 위치: `plan/in-progress/rag-eval-harness.md` frontmatter 5~7번째 줄 (`spec_refs:`)
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — frontmatter 의무 필드는 `worktree`·`started`·`owner` 세 가지이며, 추가 필드는 "허용"되나 정식 규약에 정의된 이름이 아님. `spec/conventions/spec-impl-evidence.md §4.2` Gate C 의 `spec_impact` 필드도 in-progress 단계에서는 의무가 아님.
- 상세: `spec_refs` 는 plan-lifecycle 이나 spec-impl-evidence 어느 규약에도 정의된 frontmatter 키가 아니다. 의미상으로는 "이 plan 이 참조하는 spec 파일 목록" 으로 추정되나, 이 개념의 정식 필드는 완료(`complete/`) 이동 시점의 `spec_impact` 이다. in-progress 단계에서 별도 이름으로 선언하면 규약 독자에게 혼동을 준다. plan-lifecycle §4 는 `priority`/`status`/`title` 등 추가 필드를 "허용" 한다고 하지만 `spec_refs` 를 정식 정의된 키처럼 노출하는 것은 규약과 거리감이 있다.
- 제안: `spec_refs` 를 제거하거나 `# 참조 spec` 본문 섹션으로 이동. 또는 plan-lifecycle §4 에 `spec_refs` 를 선택 필드로 공식 정의하고 `spec_impact` 와의 관계를 명시하는 방향으로 규약 자체를 갱신하는 것이 적절하다.

---

### [WARNING] 신규 spec 파일 `spec/conventions/rag-evaluation.md` 의 예상 frontmatter status 가 plan 에 명시되지 않음
- target 위치: `plan/in-progress/rag-eval-harness.md §2 Phase B` — `spec/conventions/rag-evaluation.md 신규`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §1·§2·§3` — `spec/conventions/**.md` 는 frontmatter 의무 대상이며 신규 파일은 의무 필드(`id`·`status`·`code:`)를 가져야 한다.
- 상세: plan 은 "신규 conventions spec 작성" 을 Phase B 로 기술하지만, 작성될 `rag-evaluation.md` 가 어떤 `status` 로 시작해야 하는지 기술하지 않는다. `spec-impl-evidence.md §3` 에 따르면 코드와 동시에 작성 완료되는 경우(`implemented`)와 아직 구현 진행 중인 경우(`partial`)의 구분이 필요하다. 본 plan 의 게이트 순서(§3)는 "Phase A 구현 → Phase B spec 작성" 으로 spec 이 코드 완성 이후에 작성됨을 나타내지만, 이 경우에도 신규 파일이 `implemented` 로 시작해야 하는지 여부가 명시되지 않아 구현자가 혼동할 여지가 있다.
- 제안: Phase B 항목에 "(`id: rag-evaluation`, `status: implemented`, `code: codebase/backend/src/modules/knowledge-base/eval/**` 등으로 시작)" 형태의 frontmatter 가이드를 한 줄 추가한다. 이는 spec-impl-evidence §5.3 (완성 머지 시 예시)과 일치한다.

---

### [INFO] `spec/5-system/9-rag-search.md` 링크 추가 계획에 대해 `pending_plans` 역방향 링크 업데이트 여부 미언급
- target 위치: `plan/in-progress/rag-eval-harness.md §2 Phase B` 마지막 줄 — `spec/5-system/9-rag-search.md 에서 1줄 링크`
- 위반 규약: `spec/conventions/spec-impl-evidence.md §2.1` — `spec/5-system/9-rag-search.md` 는 현재 `status: partial`, `pending_plans: [plan/in-progress/rag-rerank-followup.md]`. 본 plan 이 해당 spec 에 변경을 가하면 `pending_plans` 갱신 필요 여부를 검토해야 한다.
- 상세: 본 plan 은 `9-rag-search.md` 에 cross-link 1줄만 추가한다고 기술하고 있어 spec 의 `status` 나 `code:` 변경은 없다. 따라서 `pending_plans:` 에 본 plan 을 추가해야 할 의무는 없다. 확인 사항이므로 조치 불필요.
- 제안: 조치 불필요. 의식적 no-op 확인.

---

### [INFO] `spec/conventions/rag-evaluation.md` 문서 구조에 `## Rationale` 섹션 언급 누락
- target 위치: `plan/in-progress/rag-eval-harness.md §2 Phase B`
- 위반 규약: CLAUDE.md `## 정보 저장 위치` — "결정의 배경·근거 → 해당 spec 문서 끝의 `## Rationale`". spec 문서 3섹션 구성 권장.
- 상세: plan 이 명시한 `rag-evaluation.md` 내용 기술("골든셋 스키마·지표 정의·결정성 규칙·silver→gold·해석 가이드")에 `## Rationale` 섹션이 언급되지 않는다. plan §1 의 D-E1~D-E6 결정 근거가 spec 에도 반영돼야 한다.
- 제안: Phase B 기술에 "(`## Overview` + 본문 + `## Rationale` D-E1~D-E6 근거 포함)" 명시 추가 권장.

---

## 요약

`plan/in-progress/rag-eval-harness.md` 는 plan-lifecycle §4 의 필수 frontmatter 3필드(`worktree`·`started`·`owner`)를 모두 갖추고 있으며 구조적으로 잘 작성된 plan 이다. 정식 규약의 직접 위반(CRITICAL)은 없다. 두 가지 WARNING 이 있다. 첫째, 비표준 frontmatter 키 `spec_refs` 가 plan-lifecycle 이나 spec-impl-evidence 어느 규약에도 정의되지 않은 채 사용됐으며 `spec_impact` 와의 혼동 여지가 있다. 둘째, 신규 `spec/conventions/rag-evaluation.md` 에 적용돼야 할 frontmatter `status` 값이 plan 에 안내되지 않아 구현 착수 시 혼동 여지가 있다. 두 INFO 항목은 사소한 형식 일관성 제안으로 구현 차단 수준이 아니다. 종합적으로 구현 착수에 대한 규약 준수 장애물은 없다.

## 위험도

LOW
