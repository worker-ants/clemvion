# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`

검토 모드: spec draft (--spec)
검토 대상: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`
검토 기준: `spec/conventions/**`

---

## 발견사항

### [INFO] plan frontmatter 에 `status` 필드가 포함됨 (비표준 확장)
- **target 위치**: frontmatter 1~6행 (`status: in-progress`)
- **위반 규약**: `.claude/docs/plan-lifecycle.md §4` — 필수 필드는 `worktree`·`started`·`owner` 3개. `priority`/`status`/`title` 등 추가 필드는 "허용" 으로만 명시되며 필수가 아님.
- **상세**: `status: in-progress` 는 plan-lifecycle 규약에서 명시 허용된 추가 필드이므로 규약 위반은 아니다. 그러나 동 규약은 `status` 를 표준 필드로 기술하지 않으며, build guard(`plan-frontmatter.test.ts`)도 이 필드를 검증하지 않아 향후 혼동 가능성이 있다.
- **제안**: 현 상태 유지 가능. 다만 plan 문서의 진행 상태는 체크박스 완료 여부로 추론하는 것이 컨벤션 의도에 더 부합한다. `status` 필드가 필요하다면 규약에 표준 허용 필드로 명시적으로 등재하는 것을 고려.

### [INFO] 문서 구조 — Overview / 본문 / Rationale 3섹션 권장, plan 문서로서의 적용 범위 확인
- **target 위치**: 문서 전체 구조
- **위반 규약**: CLAUDE.md "정보 저장 위치" 항 — `spec/<영역>/_product-overview.md` 또는 진입 문서의 `## Overview`, 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale`.
- **상세**: 대상 문서는 `plan/in-progress/` 경로의 plan 문서이므로 spec 문서의 3섹션(Overview / 본문 / Rationale) 구조 권장은 **직접 적용 대상이 아니다**. 그러나 문서 말미에 `## Rationale (draft 자체 근거)` 섹션을 포함하고 있으며, 이것은 spec draft 를 위한 의사결정 근거를 정리한 맥락 문서로 적절하다. 형식적으로 위반은 없다.
- **제안**: 현 구조 유지. 문제 없음.

### [INFO] `spec/data-flow/1-audit.md` 가 `spec/conventions/spec-impl-evidence.md §1` 적용 대상 외 경로임을 올바르게 인식
- **target 위치**: 배경 blockquote ("data-flow/1-audit.md 는 `code:` frontmatter 가 없는 frontmatter-evidence 비대상 폴더")
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §1` — frontmatter 의무 대상은 `spec/2-navigation/**.md`, `spec/3-workflow-editor/**.md`, `spec/4-nodes/**.md`, `spec/5-system/**.md`, `spec/7-channel-web-chat/**.md`, `spec/conventions/**.md` 이다. `spec/data-flow/` 는 열거에 없음.
- **상세**: 문서가 이 사실을 올바르게 파악하고 "frontmatter 부여 불요(SUMMARY Warning b 채택)"로 처리하고 있어 규약과 정합한다. 위반 아님, 기록용 INFO.
- **제안**: 현 판단 유지.

### [INFO] 응답 계약 변경(변경 4)의 API 응답 형태가 기존 패턴과 일치하는지 확인 완료
- **target 위치**: "변경 4 — change-password 응답 계약 갱신", `{ data: { accessToken: string } }`
- **위반 규약**: `spec/conventions/swagger.md §2-5` — 모든 성공 응답은 `TransformInterceptor` 에 의해 `{ data: ... }` 로 래핑됨.
- **상세**: 변경 4 에서 응답 형태를 `{ data: { accessToken: string } }` 로 기술하고 있어 `swagger.md §2-5` 의 `{ data: <Dto> }` 래핑 패턴을 준수한다. 문서 내 언급(`login/verify-email/refresh 등 기존 토큰 발급 응답과 동일 패턴`)도 이를 확인함. 위반 없음.
- **제안**: 현 형태 유지.

---

## 요약

`plan/in-progress/spec-draft-pwchange-revoke-user-ip.md` 는 plan 문서로서 `plan-lifecycle.md §4` 의 필수 frontmatter 3개(`worktree`·`started`·`owner`)를 모두 올바르게 포함하고 있으며, 비표준 확장 필드(`status: in-progress`)는 허용 범주 안에 있다. spec draft 내용에서 참조하는 응답 계약(`{ data: { accessToken } }`)은 `swagger.md §2-5` 의 래핑 패턴에 부합하고, `spec/data-flow/` 경로의 frontmatter 면제 판단도 `spec-impl-evidence.md §1` 에 근거한 정확한 해석이다. CRITICAL 또는 WARNING 에 해당하는 규약 위반은 발견되지 않았다. 모든 발견사항은 INFO 수준의 참고 사항에 그친다.

---

## 위험도

NONE
