# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/spec-draft-c1m7-publish-failfast.md`
검토 모드: spec draft 검토 (--spec)
검토일: 2026-06-24

---

## 발견사항

### [WARNING] plan frontmatter 에 `transient` 비표준 필드 사용

- **target 위치**: frontmatter `transient: apply 후 삭제 (plan-frontmatter 가드 회피)`
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — plan frontmatter 스키마는 `worktree`·`started`·`owner` 를 필수 3필드로 규정하며, 추가 허용 필드 예시로 `priority`/`status`/`title` 을 나열한다.
- **상세**: `transient` 는 plan-lifecycle §4 에 정의되거나 허용 목록에 등재된 필드가 아니다. 주석 "(plan-frontmatter 가드 회피)" 는 이 필드가 가드 우회 목적임을 명시하는데, plan-lifecycle 이 인정하는 가드 우회 수단은 `BYPASS_PLAN_GUARD=1` 환경변수뿐이다. build guard `plan-frontmatter.test.ts` 를 확인한 결과 이 guard 는 `worktree`·`started`·`owner` 의 존재만 검증하며 `transient` 필드를 특수 처리하지 않는다. 즉 이 필드는 가드에 실질적 영향이 없으며, 문서 수준에서만 "가드 회피 의도"를 암시하는 dead annotation 이다. 규약 문서에 등재되지 않은 필드를 가드 우회 목적으로 추가하는 것은 명명 규약·문서 구조 일관성을 해친다.
- **제안**: `transient` 필드를 제거한다. 대신 plan 본문 첫 줄에 "임시 spec-sync draft: apply 후 삭제" 등 인라인 주석으로 의도를 표현하거나, plan-lifecycle §4 에 `transient` 필드를 허용 필드로 추가·정의한다(규약 갱신이 더 적절하다면).

---

### [INFO] plan 제목 슬러그(`spec-draft-c1m7-publish-failfast`)의 `c1m7` 약어 불투명

- **target 위치**: 파일명 + 문서 제목 `# spec-sync draft — 06-concurrency C-1+M-7`
- **위반 규약**: CLAUDE.md §정보 저장 위치 — plan 파일명 권장 패턴 `plan/in-progress/<name>.md` (직접 위반은 아님). `spec/conventions/` 에 명명 약어 레지스트리 없음.
- **상세**: `c1m7` 은 본문 없이는 `C-1`(concurrency cluster item 1)·`M-7`(misc item 7) 인지 알기 어렵다. 다른 spec-sync plan 파일들(`spec-sync-webhook-gaps.md`, `spec-sync-canvas-gaps.md` 등)은 도메인/목적을 풀어쓴 파일명을 사용한다. `spec-draft-c1m7-publish-failfast` 는 약어 의존도가 높아 파일명만으로 맥락을 파악하기 어렵다.
- **제안**: INFO 수준 — 필수 수정 아님. 필요 시 `spec-draft-publish-failfast-c1-m7.md` 처럼 도메인 단어를 앞에 두어 가독성을 높이는 것을 검토할 수 있다.

---

### [INFO] `2-api-convention.md §6` HTTP 503 행 추가 — 기존 표 형식과의 스타일 비일관

- **target 위치**: plan §편집 1번 — `2-api-convention.md §6` 503 행 추가 제안
- **위반 규약**: `spec/5-system/2-api-convention.md §6` 현행 표 스타일 패턴
- **상세**: 현행 §6 표는 `| 코드 | 의미 | 사용 상황 |` 3컬럼이며 다른 행(200~500)에는 에러 코드 명칭을 직접 노출하지 않는 패턴이다. plan 이 제안하는 503 행은 "사용 상황" 컬럼 안에 `EXECUTION_ENQUEUE_FAILED`·`SERVER_SHUTTING_DOWN` 에러 코드 문자열과 해당 spec 절 참조를 괄호로 인라인 기술한다. 구조적 위반은 아니나 기존 표 스타일과의 일관성에서 벗어난다.
- **제안**: INFO 수준 — 규약 직접 위반은 아님. 스타일 통일을 위해 에러 코드를 괄호 직접 표기 대신 `→ §1.5` 링크 참조로 대체하거나, 현행 표 스타일을 따르는 것을 검토한다.

---

### [INFO] `4-execution-engine.md` frontmatter `pending_plans` 에 본 plan 미등재 — 규약 예외 명시 필요

- **target 위치**: `spec/5-system/4-execution-engine.md` 현행 frontmatter `pending_plans:` / 본 plan 본문
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` 인 spec 은 미구현 surface 를 책임지는 plan 을 `pending_plans:` 에 등재 의무
- **상세**: `4-execution-engine.md` 는 `status: partial` 이며 현재 4개 plan 이 `pending_plans:` 에 등재돼 있다. 본 spec-sync draft 는 이미 머지된 코드 행동을 문서화하는 additive 편집("모순 도입 없음")이므로 `partial → implemented` 승격을 유발하지 않으며 `pending_plans` 추가가 불필요할 수 있다. 그러나 규약은 이 예외("additive spec-sync 는 pending_plans 등재 면제")를 명시하지 않는다. 본 plan 이 "apply 후 삭제" 성격이라는 설명은 frontmatter `transient` 필드에만 있고 본문에는 없다.
- **제안**: INFO 수준 — plan 본문에 "additive-only, spec frontmatter 변경 없음(4-execution-engine.md status: partial 유지)" 을 한 줄 명시하면 후속 검토자가 pending_plans 누락을 오해하지 않는다.

---

## 요약

target plan 문서는 전반적으로 3섹션 구조(편집 대상·비편집 판단·Rationale 추가 의도)를 따르며, 제안하는 spec 변경들은 `error-codes.md`·`api-convention §6`·`spec-impl-evidence` 의 의미 기반 명명·책임 분리 원칙에 부합한다. 가장 주목할 문제는 frontmatter 에 `transient` 비표준 필드를 "plan-frontmatter 가드 회피" 주석과 함께 기재한 것으로, plan-lifecycle §4 에 정의된 필드도 인정된 가드 우회 수단도 아니어서 규약 문서화 일관성을 해친다(WARNING). 그 외 발견사항은 스타일 일관성·가독성 수준의 INFO 사항이며 채택을 차단하지 않는다.

## 위험도

LOW
