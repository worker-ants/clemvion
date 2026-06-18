# 정식 규약 준수 검토 결과

**검토 대상**: `spec/5-system/4-execution-engine.md`
**검토 모드**: 구현 착수 전 (--impl-prep)
**검토 일시**: 2026-06-19

---

## 발견사항

### [INFO] `interaction.data` 표 — `button_continue` 설명 누락 항목 불일치
- **target 위치**: §1.3 블로킹/재개 컨트랙트 — `interaction.data` payload 규격 표 (line ~186)
- **위반 규약**: `spec/conventions/node-output.md` Principle §4.5 `interaction.data` payload 규격 표
- **상세**: target 문서의 `button_continue` 행 설명이 `"link 타입 버튼 (CONVENTIONS §4.5)"` 로만 기술되어 있고 `url?`, `selectedItem?` 의 조건부 동봉 사유가 생략됐다. node-output convention §4.5 의 동일 행은 `ButtonInteractionService` 참조와 `url`=링크 버튼 URL, `selectedItem`=carousel item-level 버튼 조건까지 명시한다. 내용은 동등하나 target 이 convention 본문을 완전 재현하지 않고 단순 cross-link 로만 처리해 이 섹션만 단독으로 읽으면 정보가 부족하다.
- **제안**: 현 `"link 타입 버튼 (CONVENTIONS §4.5)"` 유지도 acceptable (규약 위반이 아닌 요약 형태). 단 `url?`, `selectedItem?` 두 필드를 인라인으로 추가하거나 현행대로 cross-link로만 처리하되 주석에 "상세는 §4.5 참조"를 명시하면 충분하다.

---

### [INFO] §9.1 Redis 키 패턴 — 예외 키에 대한 설명 중복 (문서 구조 INFO)
- **target 위치**: §9.1 / §9.2 하단 비고 문단 (line ~1100)
- **위반 규약**: CLAUDE.md 문서 구조 권장 (Overview / 본문 / Rationale 3섹션)
- **상세**: `exec:recover:lock`, `exec:cont:seq:*`, `exec:seq:*` 가 §9.1 패턴에서 벗어나는 이유를 §9.2 표 안의 행 설명과 §9.2 표 하단 비고 두 곳에 동일 내용으로 반복 기술한다. 중복이 많아 갱신 시 드리프트 위험이 있다.
- **제안**: §9.2 표의 비고 문단 또는 표 행 설명 중 하나만 유지하고 나머지를 cross-reference 처리. 다만 이는 가독성 문제이며 규약 위반은 아니다.

---

### [INFO] Rationale 섹션 — 일부 결정 제목이 `###` 레벨이 아닌 가이드라인 방식 혼재
- **target 위치**: `## Rationale` 내부 (line ~1237 이하)
- **위반 규약**: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
- **상세**: Rationale 절은 존재하며 3섹션 구조를 따르고 있다. 다만 Rationale 내부에서 일부 항목이 `### 제목` 으로 식별되고 일부는 `**굵게**` + 인라인 설명으로 기술되어 서브제목 계층이 혼재한다(예: `**B1·B2 분리 불가**`, `**채택안 — credential-strip ...**`). 동일 Rationale 절 내 일관된 `###` 계층이 권장되나 강제 규약이 아니다.
- **제안**: 가독성 향상을 원할 경우 인라인 bold 항목을 `####` 레벨 소제목으로 통일. 현행도 acceptable.

---

## 요약

`spec/5-system/4-execution-engine.md` 는 `spec/conventions/spec-impl-evidence.md` 의 frontmatter 요건(id, status, code, pending_plans)을 모두 충족하며, 에러 코드 명명(`UPPER_SNAKE_CASE`), `interaction.type` enum 등록, `WaitingInteractionType` 4값, Redis 키 네이밍(`{service}:{workspaceId}:{resource}:{id}:{sub}` 패턴 + 전역 예외 명시), 노드 출력 규약(Principle 0–11), audit-action 레지스트리 준수, swagger/API 규약 cross-link 등 모든 정식 규약 항목을 실질적으로 따르고 있다. 발견된 사항은 모두 INFO 수준의 형식 일관성 제안으로, 규약 직접 위반(CRITICAL) 또는 규약과의 거리감이 있는 표현(WARNING)은 없다. 구현 착수 차단 사유 없음.

## 위험도

NONE

STATUS: DONE
