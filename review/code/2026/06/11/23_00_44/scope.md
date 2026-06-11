# 변경 범위(Scope) 리뷰 결과

**리뷰 대상**: `http-ssrf-all-auth` worktree (SSRF 가드 전 인증 방식 적용, refactor 04 C-3)
**리뷰 일시**: 2026-06-11

---

## 발견사항

### [INFO] config-echo spread→명시열거 변경은 계획상 "부수 변경"으로 분류됨
- **위치**: `codebase/backend/src/nodes/integration/http-request/http-request.handler.ts` (configEcho 재작성), `http-request.handler.spec.ts` (credential-leak 가드 테스트 추가)
- **상세**: `plan/in-progress/http-ssrf-all-auth.md` 체크리스트에 "부수: config-echo spread→명시 열거(Principle 7 D1) 동반"으로 사전 선언된 변경이다. primary 범위(SSRF 가드 ungate)와 독립적으로 분리 가능한 수정이나, consistency-check 22_28_10 세션에서 CRITICAL로 식별된 블록을 해소하기 위해 포함됐다. plan이 투명하게 선언했으므로 허용 범위.
- **제안**: 수용 가능. consistency-check BLOCK 해소 필수 항목.

### [INFO] `spec/conventions/node-output.md` Principle 3.1 수정 — cross-cutting conventions 변경
- **위치**: `spec/conventions/node-output.md` Principle 3.1 표 및 D4 callout 추가 (파일 33)
- **상세**: 이 파일은 HTTP Request 노드 전용이 아닌 프로젝트 전체 conventions SoT다. consistency-check 22_39_51 CRITICAL #1("Principle 3.1이 D4 결정과 충돌")을 해소하기 위한 수정으로, D4 결정(SSRF/credential → port:'error' 라우팅)을 Principle 3.1에 반영한다. 변경이 시스템 전체 conventions를 건드리지만, 내용은 기존 결정(`0-common.md §4.2` D4)의 순방향 반영이며 다른 Integration 노드 행동 변경을 유발하지 않는다.
- **제안**: 수용 가능. consistency-check CRITICAL 해소 의무에서 파생된 수정.

### [INFO] `spec/5-system/3-error-handling.md` 수정 — 시스템 전체 에러 카탈로그 변경
- **위치**: `spec/5-system/3-error-handling.md` HTTP 카탈로그에 `HTTP_BLOCKED` 추가 (파일 32)
- **상세**: consistency-check 22_50_38 W-1에서 식별된 항목으로, `HTTP_BLOCKED`가 시스템 에러 카탈로그에서 누락된 것을 등재하는 수정이다. `error-codes.ts` enum 등재(파일 1, W-2)와 쌍을 이룬다. 이 task의 핵심 에러 코드를 카탈로그에 등록하는 자연스러운 범위.
- **제안**: 수용 가능.

### [INFO] 다수의 consistency-check review 산출물 파일 포함
- **위치**: `review/consistency/2026/06/11/22_28_10/`, `22_39_51/`, `22_50_38/` 하위 24개 파일 (파일 6~29)
- **상세**: developer SKILL 규약에 따라 구현 착수 전 `/consistency-check --spec` 3회 실행(BLOCK 해소 후 진행)이 의무다. 이 산출물들은 그 단계의 필수 이행 증거이며 범위 이탈이 아닌 프로세스 준수다.
- **제안**: 없음.

---

## 요약

이 변경은 `http-ssrf-all-auth` task의 명시적 목적(SSRF 가드를 `authentication='integration'` 한정에서 전 인증 방식 공통으로 확대, refactor 04 C-3)을 핵심으로 하되, consistency-check CRITICAL/WARNING 해소를 위해 필요하게 파생된 수정들(config-echo spread→명시열거, `node-output.md` Principle 3.1 D4 반영, `3-error-handling.md` HTTP_BLOCKED 카탈로그 등재, `error-codes.ts` enum 등재)이 함께 포함됐다. 이 모든 부수 변경은 plan 파일에 사전 선언되거나 consistency-check 블록 해소 의무에서 파생된 것이므로 의도 이상의 임의 확장이 아닌 규약 준수 범위 내 수정이다. 불필요한 리팩토링, 무관한 파일 수정, 포맷팅만의 변경은 식별되지 않았다.

---

## 위험도

NONE
