# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-presentation-normalize-button-ids.md`

검토 모드: `--spec` (spec draft 검토)
검토 일시: 2026-05-23

---

## 발견사항

### [INFO] Frontmatter 스키마 — 완전 준수
- target 위치: 파일 상단 frontmatter (라인 1–5)
- 위반 규약: 해당 없음
- 상세: `worktree`, `started`, `owner` 3필드 모두 존재하며 `.claude/docs/plan-lifecycle.md §4` 스키마와 일치. `worktree` 값이 실제 worktree 디렉터리 이름(`render-presentation-button-click-fix-683f3a`)과 정확히 일치.
- 제안: 없음.

---

### [INFO] 파일 위치 — 완전 준수
- target 위치: `plan/in-progress/spec-draft-presentation-normalize-button-ids.md`
- 위반 규약: `CLAUDE.md` "정보 저장 위치" 표 — 진행 중 작업은 `plan/in-progress/<name>.md`
- 상세: 올바른 경로에 위치. `plan/` 루트에 직접 두거나 `complete/` 로 잘못 분류된 사례 없음.
- 제안: 없음.

---

### [WARNING] 사전 일관성 검토 결과 미완료 (TBD)
- target 위치: `## 사전 일관성 검토 결과` 섹션 (라인 70–73)
- 위반 규약: `CLAUDE.md` Skill 체계 — "`project-planner` 는 `spec/` 쓰기 직전 `consistency-check --spec` 의무"
- 상세: 해당 섹션이 "결과: TBD (실행 후 본 섹션 갱신)" 으로 명시되어 있다. spec draft 를 실제 `spec/` 파일에 적용하기 전에 이 칸이 채워져야 한다. 현재 draft 단계에서 TBD 로 두는 것은 문서상 자연스럽지만, spec 적용 PR 에서도 TBD 로 남으면 규약 위반이 된다.
- 제안: spec 적용 직전 `/consistency-check --spec` 를 실행하고 본 섹션의 TBD 를 실제 결과(세션 경로 + BLOCK/PASS 판정)로 갱신한 뒤 spec 파일을 수정할 것. draft 자체는 허용 범위.

---

### [WARNING] 문서 3섹션 구조 — Rationale 위치 비표준
- target 위치: `## Rationale` 섹션 (라인 42–68)
- 위반 규약: `CLAUDE.md` — "결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`". plan 문서가 spec draft 를 포함하는 경우, draft 본문 안에 `## Rationale` 을 두는 관행이 일반적이나, 본 문서는 plan 문서 레벨의 Rationale 이 spec draft 본문(`## 본문 (draft)`) 과 혼재한다.
- 상세: `## Rationale` 이 plan 문서 내에서 본문 draft 뒤에 위치하는 것은 기존 spec draft plan 파일들의 관행(`plan/complete/spec-draft-notification-dismiss.md`, `plan/complete/spec-draft-brand-rollback.md` 등)과 일치하므로 실질적 문제는 없다. 다만 CLAUDE.md 의 3섹션 원칙(Overview/본문/Rationale)은 spec 문서 자체에 적용되는 규칙이며, 이 plan 문서가 spec 적용 후 Rationale 을 spec 파일 끝(`## Rationale` 섹션)에 반영하는지가 핵심. Draft §10.5 본문에는 Rationale 이 포함되어 있지 않고 별도 섹션으로 분리되어 있다.
- 제안: spec 파일(`spec/4-nodes/6-presentation/0-common.md`)의 기존 `## Rationale` 섹션에 "normalize 시점 결정 (2026-05-23)" 항목을 추가할 것을 draft 본문에 명시하거나, spec draft 본문 자체에 Rationale 소절을 포함할 것을 권장. 현재 draft 본문(`## 본문 (draft)` 코드블록)에는 §10.5 본문만 있고 Rationale 갱신 지시가 없음.

---

### [INFO] §10.5 draft 본문 — 출력 포맷 규약 준수
- target 위치: `## 본문 (draft)` 코드블록 (라인 27–35)
- 위반 규약: `spec/conventions/node-output.md` Principle 3.2 — 에러 코드는 `UPPER_SNAKE_CASE`
- 상세: draft 본문 step 2 의 `{error: 'INVALID_PAYLOAD', issues: [...]}` 에서 `error` 키 값 `'INVALID_PAYLOAD'` 는 `UPPER_SNAKE_CASE` 로 작성되어 Principle 3.2 를 준수. `error` 키 자체는 소문자이나 이는 tool_result JSON 의 필드명으로 에러 컨트랙트의 `code` 필드와 구분되는 별도 페이로드 형태임 — 기존 §10.5 현행 본문과 동일하므로 신규 위반 없음.
- 제안: 없음.

---

### [INFO] §10.5 draft — node-output Principle 6 (동적 포트 네이밍) 무관
- target 위치: draft 전체
- 위반 규약: 해당 없음
- 상세: 본 변경은 normalize 단계 추가이며 포트 ID 생성 규칙(Principle 6)을 변경하지 않음. UUID v4 로 `button.id` 를 자동 보완한다는 내용은 `spec/4-nodes/6-presentation/0-common.md §1` 의 "id: 자동 생성, 불변" 원칙 및 §7.1 의 포트 ID = `<button.id>` (UUID v4) 명명 규칙과 정합.
- 제안: 없음.

---

### [INFO] draft 본문의 순서 설명 불명확 (사소한 가독성)
- target 위치: draft step 3 (라인 32)
- 위반 규약: 정식 규약 위반 아님 — 가독성 제안
- 상세: "validate 통과 + defaults overlay + 1MB cap 적용 이후" 라는 표현에서 §10.3(Defaults Overlay), §10.4(1MB cap), §10.5 step 1(validate) 의 순서 관계를 문장 하나로 서술한다. Rationale 에서는 "validate → overlay → cap → normalize" 순서가 명시되어 있으나, §10.5 step 2 에는 위반 처리만 있고 overlay/cap 수행 단계가 step 로 없어 step 3 의 전제가 다른 §(§10.3, §10.4)에 흩어져 있다. 이는 기존 §10.5 구조의 한계이며 본 draft 가 신규 도입하는 문제는 아님.
- 제안: step 3 앞부분을 "validate 통과 후, §10.3 defaults overlay 및 §10.4 1MB cap 적용 이후," 로 cross-ref 를 명시하면 섹션 간 추적성이 높아짐. 필수는 아님.

---

### [INFO] `## 적용 후 후속` 섹션 — 체크박스 미사용
- target 위치: `## 적용 후 후속` 섹션 (라인 75–78)
- 위반 규약: `.claude/docs/plan-lifecycle.md §2` — 미체크 체크박스가 있으면 `in-progress/` 에 두는 것이 올바름
- 상세: 후속 항목이 서술형으로 기재되어 있고 체크박스(`[ ]`)가 없다. plan-lifecycle 은 체크박스 유무로 `in-progress` / `complete` 를 판별하므로, 후속 행동이 완료 추적 대상이라면 `- [ ]` 형태로 표기하는 것이 관행에 부합한다. 현재는 단순 설명 메모로도 해석 가능하므로 규약 위반보다는 관행 불일치에 해당.
- 제안: 실행 가능한 후속 항목은 `- [ ] spec 적용 (project-planner)` / `- [ ] backend normalize 구현 + TDD (developer)` 형태의 체크박스로 변환하면 lifecycle 관리에 일관성이 생김.

---

## 요약

`plan/in-progress/spec-draft-presentation-normalize-button-ids.md` 는 CLAUDE.md 의 `plan/in-progress/` 위치 규칙, plan-lifecycle frontmatter 스키마, 단일 진실 원칙을 전반적으로 준수한다. draft 본문의 출력 포맷(에러 코드 UPPER_SNAKE_CASE, UUID v4 id 보완, Principle 6 포트 네이밍)은 `spec/conventions/node-output.md` 의 정식 규약과 충돌하지 않는다. 다만 두 가지 주의 사항이 있다: (1) "사전 일관성 검토 결과" 섹션이 TBD 로 남아 있어 spec 적용 PR 에서 반드시 채워야 하며, (2) spec 파일(`0-common.md`)의 `## Rationale` 섹션에 normalize 시점 결정 근거를 추가하는 지시가 draft 본문에 없어 spec 적용 시 Rationale 갱신이 누락될 위험이 있다. Cafe24 API 카탈로그, Swagger, interaction-type-registry 등 다른 정식 규약은 본 변경의 적용 범위 밖이라 해당 없음.

---

## 위험도

LOW
