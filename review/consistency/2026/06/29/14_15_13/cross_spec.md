# Cross-Spec 일관성 검토 결과

- **Target**: `spec/conventions/spec-impl-evidence.md`
- **검토 모드**: spec draft (`--spec`)
- **검토 일시**: 2026-06-29

---

## 발견사항

### [INFO] `user_guide:` 필드 — 가드 검증 부재 (선언 vs 미강제)

- target 위치: `spec/conventions/spec-impl-evidence.md §2.1` (`user_guide` 필드 정의), `§5.3` (예시)
- 충돌 대상: `spec/conventions/user-guide-evidence.md §2` (`impl-anchor-existence.test.ts` · `registry.test.ts`), `codebase/frontend/src/lib/docs/__tests__/spec-frontmatter-parse.ts`
- 상세: target 은 `user_guide:` 를 선택 필드로 정의하고 "가이드가 KO/EN 양쪽 존재 시 로케일 쌍 모두 등재" 를 의무로 설명하지만, 실제 build-time 가드(§4 표 4건 + §4.2 표 4건+1건)에 `user_guide:` 경로 실존을 검증하는 항목은 없다. `spec-frontmatter-parse.ts` 의 `SpecFrontmatter` 인터페이스에 `user_guide?: string[]` 가 타입 선언만 돼 있을 뿐, 어느 `.test.ts` 도 (a) `user_guide` 경로가 실존하는지, (b) KO 가이드가 있는데 EN 쌍(`<name>.en.mdx`)을 누락했는지를 강제하지 않는다. `user-guide-evidence.md §2` 의 `registry.test.ts` 는 MDX frontmatter `spec:`/`code:` 경로만 검증하며 spec `.md` 의 `user_guide` 는 대상이 아니다. 결과적으로 `user_guide:` 는 "선택 + 가이드만" 인 상태로, target 본문이 암시하는 "cross-link 건전성" 이 실제로는 강제되지 않는다.
- 제안: INFO 수준 — 현재 `user_guide:` 가 선택 필드이므로 가드 미존재가 직접 충돌이 아니라, target 이 미래 가드(예: `spec-user-guide-paths.test.ts`)를 추가하면 `user-guide-evidence.md §2.1` 관계 절도 갱신 필요. 지금 단계에서는 target 이 §2.1 표 `user_guide` 행에 "가드 없음 — 선언적 cross-link 용" 을 명시하면 독자 혼동을 방지할 수 있다.

---

### [INFO] `spec/data-flow/` 영역 — 적용 대상 §1 미포함 (의도 명시 필요)

- target 위치: `spec/conventions/spec-impl-evidence.md §1` (적용 대상 inclusive list)
- 충돌 대상: `spec/0-overview.md §8 문서 맵` (`spec/data-flow/` 영역 존재 확인)
- 상세: `spec/data-flow/` 는 `spec/0-overview.md §8` 문서 맵에 영역으로 등재돼 있으나 target §1 의 inclusive list(`spec/2-navigation/`, `spec/3-workflow-editor/`, `spec/4-nodes/`, `spec/5-system/`, `spec/7-channel-web-chat/`, `spec/conventions/`)에 포함되지 않는다. `spec-frontmatter-parse.ts` 의 `INCLUDE_PREFIXES` 도 `spec/data-flow/` 를 포함하지 않으며 실제 가드도 발화하지 않는다. 이는 의도적 제외일 수 있으나 target 본문에 제외 사유가 명시되지 않아 향후 작성자가 `data-flow/*.md` 에 frontmatter 를 붙이지 않아도 가드가 조용히 통과한다.
- 제안: 모순이 아닌 문서 gap. target §1 하단 **제외** 목록에 `spec/data-flow/` (= 데이터 흐름 다이어그램·스키마 매핑, 구현 lifecycle 추적 불요) 를 "의도적 제외" 로 한 줄 추가하면 명확해진다.

---

### [INFO] `spec-area-index.test.ts` — `spec/conventions/` 면제 근거가 가드 코드에만 존재

- target 위치: `spec/conventions/spec-impl-evidence.md §4.2` (`spec-area-index.test.ts` 가드 설명 — "예외 / 비고" 컬럼에 "`spec/conventions/`(flat reference, 무-index), 카탈로그`")
- 충돌 대상: `codebase/frontend/src/lib/docs/__tests__/spec-area-index.test.ts` (실제 면제 구현 코드, 미확인)
- 상세: target §4.2 표가 `spec-area-index.test.ts` 의 면제 규칙을 기술하는 SoT 역할을 한다. `spec/conventions/` 는 flat reference 폴더라 무-index 면제임을 명시했다. 이 기술은 `spec-area-index.test.ts` 구현이 실제로 `spec/conventions/` 를 면제하는 것과 일치해야 한다. 직접 충돌은 발견되지 않았으나, 두 위치(test 코드 vs spec 본문)가 면제 목록을 각자 관리하면 drift 위험이 있다. 현재 target 이 "예외 / 비고" 컬럼을 가드의 SoT로 선언하고 있으므로, 테스트 코드가 이 목록과 달라지면 target 이 오도가 된다.
- 제안: 단순 동기화 권장. `spec-area-index.test.ts` 내 면제 목록 주석에 `SoT: spec/conventions/spec-impl-evidence.md §4.2` 를 추가하면 drift 가 명시적으로 드러난다.

---

## 요약

`spec/conventions/spec-impl-evidence.md` (target)는 기존 spec 영역과 직접 모순되는 정의 충돌이 없다. 데이터 모델·API 계약·요구사항 ID·상태 전이·RBAC 관점에서 기존 `spec/1-data-model.md`, `spec/0-overview.md`, `plan-lifecycle.md` 의 정의와 상보 관계를 유지한다. `plan-lifecycle.md §5 Gate C` 와 target `§4.2 R-8` 은 `spec_impact` 필드·cutoff 날짜(`2026-06-04`)·sentinel 집합(`none`/`없음`/`n/a`/`na`)을 일관되게 기술한다. `user-guide-evidence.md` 와의 경계 분리(spec `.md` vs 가이드 `.mdx` 도메인 분리)도 명확하다. 발견된 사항 3건은 모두 INFO 수준 — 문서 gap 또는 명시 보완 권장이며 채택을 차단하는 Critical·Warning 이슈는 없다.

---

## 위험도

LOW
