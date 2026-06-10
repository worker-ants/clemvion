# 정식 규약 준수 검토 — `plan/in-progress/spec-update-ws-resumed-ack.md`

검토 모드: spec draft 검토 (--spec)
검토 일자: 2026-06-10

---

## 발견사항

### [CRITICAL] plan frontmatter 필수 필드 누락 — `started` 및 `owner`

- **target 위치**: frontmatter (lines 1–8)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
  — "세 필드(`worktree`·`started`·`owner`)는 top-level `plan/in-progress/*.md` 에서 **필수** — build guard `plan-frontmatter.test.ts` 가 강제한다."
- **상세**: 현재 frontmatter 에는 `worktree: ws-resumed-ack-spec` 만 있으며 `started` (ISO 날짜 YYYY-MM-DD)와 `owner` (planner / developer / 사용자 본인 등) 가 완전히 누락됐다. `plan-frontmatter.test.ts` 빌드 가드는 이 두 필드 부재 시 build fail 을 낸다.
- **제안**: frontmatter 에 아래 두 줄을 추가한다.
  ```yaml
  started: 2026-06-10
  owner: planner
  ```

---

### [WARNING] `status: in-progress` — plan frontmatter 비표준 필드

- **target 위치**: frontmatter `status: in-progress` (line 8)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4 Frontmatter 스키마`
  — plan frontmatter 의 공식 필드는 `worktree`·`started`·`owner`이며 추가 필드는 "허용"이나, 문서 전체에서 in-progress / complete 구분은 **파일 경로**(`plan/in-progress/` vs `plan/complete/`)로 관리한다고 명시한다. `status:` 필드 자체를 금지하지는 않지만, 공식 스키마 어디에도 plan frontmatter 의 `status:` 를 정의하거나 빌드 가드가 검증하는 항목이 아니다. 경로와 frontmatter 가 이중으로 상태를 표현해 sync drift 위험이 있다.
- **제안**: `status: in-progress` 줄을 제거하고 in-progress 상태는 파일 경로만으로 표현하거나, 명시적으로 보조 정보임을 팀 관행으로 합의해 규약에 기재한다.

---

### [WARNING] `spec_impact` 필드를 in-progress plan 에 선언

- **target 위치**: frontmatter `spec_impact:` (lines 3–6)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` 및 §Gate C
  — "`spec_impact` (완료 시점 필드, Gate C): **in-progress 단계에선 의무 아님(완료 시점에만** `spec-plan-completion.test.ts` 가 강제)."
  — `spec/conventions/spec-impl-evidence.md §4.2` Gate C: "완료(`complete/` 이동) plan 은 frontmatter 에 `spec_impact` 를 선언한다."
- **상세**: 규약상 `spec_impact` 는 완료 이동 시 채워야 하는 필드다. in-progress 단계에 미리 선언하는 것 자체는 빌드를 깨지 않으나, 규약 의도("완료 시점 결정 강제")와 어긋나며 `spec-plan-completion.test.ts` 검증 타이밍도 완료 시점이다. 또한 in-progress 중 spec 파일 경로가 변경되면 이 선언이 stale 해질 수 있다.
- **제안**: `spec_impact` 선언을 `complete/` 이동 시점 commit 까지 유보하거나, in-progress 상태에서는 plan 본문 변경안 섹션의 텍스트로만 기술한다. 단, 규약이 이를 명시적으로 금지하지 않으므로 팀 선호에 따라 허용 관행으로 규약에 명시하는 것도 가능하다(규약 갱신 적절).

---

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 구성

- **target 위치**: 문서 전체 섹션 구조
- **위반 규약**: `CLAUDE.md §정보 저장 위치` — "결정의 배경·근거 — 해당 spec 문서 끝의 `## Rationale`"; Spec 문서 3섹션 구성 (Overview / 본문 / Rationale) 권장
- **상세**: target 은 plan 문서이므로 spec 3섹션 의무 대상은 아니다. 그러나 `## Rationale` 섹션이 문서 끝에 존재하고, 배경·변경안·검증·Rationale 의 4섹션 구성으로 논리적으로 완결돼 있어 실질적 위반은 없다.
- **제안**: 현재 구조 유지 가능. plan 문서에 대한 별도 섹션 권장 규약이 없으므로 INFO 수준으로 기록만 한다.

---

### [INFO] `name:` 필드 — plan-lifecycle 비정의 필드

- **target 위치**: frontmatter `name: spec-update-ws-resumed-ack` (line 2)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 공식 필드 목록에 `name:` 없음
- **상세**: `name:` 은 plan-lifecycle 공식 스키마에 정의되지 않은 추가 필드다. 빌드 가드가 검증하지 않으며 금지도 아니므로 INFO 수준이나, 불필요한 중복(파일 basename 이 이미 `spec-update-ws-resumed-ack`)이다.
- **제안**: `name:` 필드 제거를 고려한다. 필요하다면 규약에 추가 필드로 명시한다.

---

## 요약

target 문서 `plan/in-progress/spec-update-ws-resumed-ack.md` 는 `plan-lifecycle.md §4` 의 plan frontmatter 스키마에서 빌드 가드(`plan-frontmatter.test.ts`)가 강제하는 필수 필드인 `started` 와 `owner` 를 누락하고 있어 현재 상태로는 빌드 실패가 예상된다(CRITICAL). 또한 `spec_impact` 를 in-progress 단계에 미리 선언하는 패턴과 비표준 `status: in-progress` 필드는 규약 의도와 거리감이 있어 WARNING으로 분류된다. 본문 내용(배경·변경안·검증·Rationale) 자체는 정식 spec 정정 plan 으로서 구조적으로 충실하고, 규약의 금지 항목을 답습하는 패턴은 없다.

---

## 위험도

HIGH
