# 변경 범위(Scope) 리뷰 결과

## 발견사항

### [INFO] spec 파일 변경이 이번 커밋(dcacd58e)에 포함 — 의도된 분리
- 위치: `spec/1-data-model.md`, `spec/4-nodes/1-logic/1-if-else.md`, `spec/4-nodes/1-logic/8-filter.md`, `spec/4-nodes/5-data/1-transform.md`, `spec/4-nodes/5-data/2-code.md`, `spec/5-system/1-auth.md`, `spec/5-system/6-websocket-protocol.md`, `spec/conventions/swagger.md`
- 상세: 가장 최근 커밋(dcacd58e "docs(spec): refactor 04 보안 SPEC-DRIFT 정정")은 spec 파일만 포함하며, 그 이전 커밋(1aa52b54 "fix(security): refactor 04 보안 백로그")은 코드 구현만 포함한다. 두 커밋의 역할이 명확히 분리되어 있고, `plan/in-progress/spec-draft-refactor-04-security-drift.md`가 spec 정정 커밋의 의도와 범위를 명시하고 있다.
- 제안: 없음

### [INFO] `review/code/2026/06/12/20_32_29/` 리뷰 산출물 전체 신규 추가
- 위치: `review/code/2026/06/12/20_32_29/` 하위 모든 파일
- 상세: 프로젝트 규약에 따라 ai-review 산출물이 `review/code/` 하위에 기록된다. 이전 리뷰 라운드(19_49_22) 결과물이 함께 추가된 것도 동일한 규약 준수다. 범위 외 파일 수정이 아니다.
- 제안: 없음

### [INFO] `review/consistency/2026/06/12/20_50_19/` consistency-check 산출물 신규 추가
- 위치: `review/consistency/2026/06/12/20_50_19/` 하위 모든 파일
- 상세: spec 변경 전 의무 consistency-check(--spec) 산출물이다. CLAUDE.md의 "project-planner 는 spec/ 쓰기 직전 consistency-check --spec 의무" 규약에 따른 정당한 추가다.
- 제안: 없음

### [INFO] `spec/1-data-model.md` — RefreshToken ip_address 설명 정정
- 위치: `spec/1-data-model.md` L637 (ip_address 필드)
- 상세: consistency-check W1(Cross-Spec) 경고로 지적된 `spec/1-data-model.md §2.18.1` ip_address 설명("CF-Connecting-IP 우선") 정정이 spec-draft 범위에 포함되어 함께 처리됐다. spec-draft 원본 문서에 이 항목이 명시적으로 포함되지 않았으나, consistency-check W1 경고 해소를 위해 추가한 것이다. 논리적으로 M-5/m-3 SPEC-DRIFT 범위에 속하는 변경이며, 코드 구현과 일관성을 맞추는 정당한 수정이다.
- 제안: 없음. 단, spec-draft plan 문서에 해당 변경 항목을 명시적으로 추가해두면 추적성이 향상된다.

### [INFO] `spec/conventions/swagger.md` — production-guards.ts·main.ts code: 추가 및 ## Rationale 신설
- 위치: `spec/conventions/swagger.md`
- 상세: M-1 Swagger 게이팅 SPEC-DRIFT 정정의 일환으로, consistency-check W3·INFO4(Convention/Rationale) 경고를 함께 해소했다. `## Rationale` 섹션 신설은 spec 3섹션 구조를 완성하는 작업으로, 보안 노출 정책 변경의 맥락에서 자연스러운 동반 개선이다.
- 제안: 없음

### [INFO] spec-draft plan 문서(spec-draft-refactor-04-security-drift.md) — frontmatter 추가 및 §5 명시
- 위치: `plan/in-progress/spec-draft-refactor-04-security-drift.md`
- 상세: consistency-check Critical #1 해소(frontmatter 추가)와 W4 해소(§5 code surface 무변경 명시)가 반영되어 있다. plan 문서 자체의 정합성 보정이므로 범위 내 수정이다.
- 제안: 없음

---

## 요약

이번 변경(현재 커밋 dcacd58e)은 `refactor-04-security` 구현의 SPEC-DRIFT 후속 정정 작업이다. 모든 spec 파일 변경(auth, websocket, filter, transform, if-else, code 노드, swagger)은 `plan/in-progress/spec-draft-refactor-04-security-drift.md`에 명시된 M-1·M-3·M-5·M-6·m-2 항목의 범위 내에 있다. consistency-check 경고(W1 Cross-Spec, W3 Convention)를 해소하기 위해 `spec/1-data-model.md §2.18.1` ip_address 설명 및 `spec/conventions/swagger.md ## Rationale`이 동반 수정됐으나, 이는 spec 일관성 의무 단계의 당연한 후속 작업이다. review/ 하위 산출물 추가는 프로젝트 규약에 의한 의무 기록이다. 독립적 리팩토링, 불필요한 임포트 정리, 무관한 파일 수정, 포맷팅만을 위한 변경은 발견되지 않았다.

## 위험도

NONE
