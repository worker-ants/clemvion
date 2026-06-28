# 정식 규약 준수 검토 결과

검토 대상: `plan/in-progress/spec-draft-m1-integration-errorcode.md`
검토 모드: spec draft (--spec)
검토 일시: 2026-06-28

---

## 발견사항

### [INFO] plan draft 파일에 plan-lifecycle 필수 frontmatter 미작성
- target 위치: `plan/in-progress/spec-draft-m1-integration-errorcode.md` 파일 최상단
- 위반 규약: `.claude/docs/plan-lifecycle.md §4` — top-level `plan/in-progress/*.md` 는 `worktree`·`started`·`owner` 3필드 필수, build guard `plan-frontmatter.test.ts` 강제
- 상세: 본 draft 파일은 `plan/in-progress/` 아래 top-level 파일(`.md`)이므로 plan-lifecycle §4 의 frontmatter 의무 대상이다. 실제 파일에는 frontmatter 블록(`---`) 자체가 없다. 단, 파일 본문에 "검토 목적의 임시 draft … BLOCK:NO 확인 후 폐기(미커밋 또는 complete 이동)" 라고 명시돼 있어 커밋 의도가 없는 임시 파일이며, 하위 그룹 클러스터(예: `plan/in-progress/refactor/`) 파일이 아닌 최상위 파일이라는 점에서 build gate 가 실제로 트리거되는 경로다.
- 제안: 커밋 전 폐기(삭제 또는 `plan/complete/` 이동) 가 의도라면 현 상태 유지. 만약 브랜치에 커밋된다면 `worktree: spec-sync-m1-integration-75cbc2`, `started: 2026-06-28`, `owner: planner` frontmatter 를 추가해야 build guard 통과 가능.

### [INFO] draft 파일의 문서 구조가 spec 3섹션 권장을 부분 준수
- target 위치: `plan/in-progress/spec-draft-m1-integration-errorcode.md` 전체 구조
- 위반 규약: CLAUDE.md — "결정의 배경·근거: 해당 spec 문서 끝의 `## Rationale`" 권장 구조
- 상세: draft 가 `## Rationale` 섹션을 포함하고 있어 권장 구조를 따르고 있다. 단, 이 파일은 spec 문서 자체가 아니라 검토용 임시 draft 이므로 spec-impl-evidence §1 의 frontmatter 의무 대상이 아니다(`plan/in-progress/*.md` 는 spec 가드 적용 범위 밖). 문서 구조 관점에서는 준수 수준 양호.
- 제안: 현재 구조 유지. 지적 사항 없음.

---

## 변경 내용별 규약 준수 분석

### 변경 1 — `INTEGRATION_INVALID_SERVICE` 에러 코드 등재 (§9.4)

**규약 준수 확인 사항:**

1. **에러 코드 명명 (error-codes.md §1)**: `INTEGRATION_INVALID_SERVICE` 는 `UPPER_SNAKE_CASE` 준수, `INTEGRATION_` 도메인 prefix 규약 준수, 의미 기반 명명(지원하지 않는 서비스/인증 조합 = "invalid service") 준수. 정상 코드라 historical-artifact 예외 레지스트리(§3) 등재 대상 아님. 준수.

2. **error-codes.md 미등재 결정**: draft 의 근거 설명이 error-codes.md 의 자기 규정(§3 = "원칙을 따르지 않는 기존 코드 등록부", §Rationale "왜 SoT 를 분리하는가")과 정확히 일치한다. `INTEGRATION_INVALID_SERVICE` 는 §1 규약을 준수하는 정상 코드이므로 §3 에 넣으면 레지스트리 의미가 오염됨. 준수.

3. **등재 위치 (§9.4)**: 실제 `spec/2-navigation/4-integration.md §9.4` 에 `INTEGRATION_IN_USE (409)` · `INTEGRATION_TEST_FAILED (422)` 바로 뒤에 `INTEGRATION_INVALID_SERVICE (400)` 이 추가됐고, 같은 `INTEGRATION_*` 그룹 내 배치. 규약상 제약 없으며 기존 패턴과 일관. 준수.

4. **출력 포맷 (error-codes.md §1, error-handling.md 참조)**: 에러 메시지 형식 `Unsupported service/auth combination: {serviceType}/{authType}` 은 §1 의 "의미를 기술" 원칙과 일치. 준수.

### 변경 2 — §9.2 preview-test 필드명 `service` → `serviceType`

**규약 준수 확인 사항:**

1. **API 문서 포맷 (swagger.md)**: 실제 DTO 필드명(`PreviewTestDto.serviceType`)으로 spec 표를 보정하는 것은 spec-코드 정합 유지 의무에 부합. `swagger.md §1` 의 DTO 명명 패턴(JSDoc + class-validator) 을 이 draft 가 변경하는 것은 아니며, spec 표의 body 필드 기술이 실제 DTO 와 맞춰지는 것이 규약 취지. 준수.

2. **범위 밖 보존 (`oauth/begin` 행의 `service` 유지)**: draft 가 `OAuthBeginDto.service` (실제 필드명 `service`)는 별도 DTO 이므로 건드리지 않는다고 명시. 실제 `spec/2-navigation/4-integration.md §9.2` 에서도 `POST /api/integrations/oauth/begin` 의 body 표기(`{ service, scopes[], mode, integrationId? }`)는 그대로이며, `POST /api/integrations/preview-test` 만 `{ serviceType, authType, credentials }` (`PreviewTestDto`)로 갱신됐다. 규약 준수.

---

## 요약

본 draft 가 제안하는 두 spec 변경(`INTEGRATION_INVALID_SERVICE` §9.4 등재, `preview-test` 필드명 `service→serviceType`)은 `spec/conventions/error-codes.md` 의 명명 규율(의미 기반 `UPPER_SNAKE_CASE`, 도메인 prefix, §3 등재 대상 정의)과 완전히 정합하며, 실제로 적용된 `spec/2-navigation/4-integration.md` 역시 해당 내용을 올바른 위치에 반영했다. `error-codes.md` 미등재 결정의 근거도 그 문서의 자기 규정(명명 규율 전용, §3=명명위반 예외만)을 정확히 인용하고 있다. 유일한 지적사항은 임시 draft 파일 자체에 plan-lifecycle §4 의 frontmatter(`worktree`/`started`/`owner`)가 없다는 점이나, 파일 본문에 "커밋 없이 폐기" 의도가 명시돼 있어 실제 build gate 충돌 위험은 낮다.

## 위험도

NONE

STATUS: OK
