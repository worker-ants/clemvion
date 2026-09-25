# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 위배 없음 (5개 checker 전문 전량 확보, 재시도 필요 항목 없음)

## 전체 위험도
**MEDIUM** — Critical 은 없으나, `rationale_continuity` 가 MEDIUM 으로 판정한 WARNING(신설 `@WorkspaceParam` 데코레이터가 이 저장소가 두 차례 재기각한 "라우트별 opt-in 마커" 패턴과 형태가 겹치는데 가장 근접한 선례를 인용하지 않음)과, `cross_spec` 이 지적한 Rationale 문단 내부 모순(WARNING)은 draft 를 spec 에 반영하기 전에 정리하는 것이 좋다.

## Critical 위배 (BLOCK 사유)

(없음)

## planner 인계 (권한 밖 Critical)

(없음)

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec | 정정 대상 Rationale 문단에 새 정정과 모순되는 옛 문장이 그대로 남는다 — draft 의 정정은 "`:id`는 인가 판정의 입력이 아니다"만 부정하고, 같은 문단의 "없는 리소스는 어차피 404"는 정정하지 않는다. 그런데 draft 자신의 §A 실측(9/11 서비스가 인가 선행이라 부재 워크스페이스도 403)이 이 두 번째 문장도 워크스페이스 `:id`에 대해 거짓임을 이미 보여준다. | draft C-1(d) — `spec/data-flow/12-workspace.md` §Rationale "왜 경로 파라미터는 엄격해도 되는가" 문단 | 같은 문단 기존 두 번째 문장(`spec/data-flow/12-workspace.md` 393~394행) "없는 리소스는 어차피 404이고, 400과 404는 접근 가능 여부를 누설하지 않는다" | 같은 (d) 정정 안에 "없는 리소스는 어차피 404" 절도 함께 한정 — 예: "(워크스페이스 `:id`는 예외 — 부재 워크스페이스도 존재 오라클 없이 403 `NOT_A_MEMBER`로 응답한다. `:memberId`·`:invitationId`는 여전히 404.)" C-1(e)와 상호 참조를 붙여 흩어진 같은 사실을 한 곳에서 설명 |
| 2 | rationale_continuity | 신설 `@WorkspaceParam('<name>')` 데코레이터가 "라우트별 opt-in 마커" 재기각 계열과 형태가 정확히 겹치는데(개발자가 라우트마다 데코레이터를 붙여야 인식), draft 는 이 완화책을 `12-workspace.md`의 "73개 라우트 기각" 선례만으로 정당화하고 더 근접한 선례(`1-auth.md` 부트 캐너리 (b) — "호출부에 아무것도 요구하지 않는 방식을 택한다")는 인용·대조하지 않는다 | draft C-1(c) Rationale 신설 "경로 파라미터 워크스페이스도 가드가 본다"(특히 "74번째 라우트 문제는 데코레이터로 안 닫힌다" 문단), D-1, D-4(저장소 가드 `workspace-param-binding`) | `spec/5-system/1-auth.md` §"부트 캐너리 — `@WorkspaceId()` reflection 자가검증" (b) "재기각이다 … 캐너리는 호출부에 아무것도 요구하지 않으면서 같은 위험을 닫는다" | C-1(c) 또는 D-4 에 `1-auth.md §"부트 캐너리" (b)` 를 명시 인용하고, "왜 이번엔 opt-in 마커 + 정적 가드(CI fail-closed)가 (b)가 우려한 재발을 닫는지"를 한 문단으로 추가. 부가로 헤더/토큰 모델의 `req.user.workspaceId` 직접 접근 라우트(구조적으로 동일한 이탈 구멍인데 정적 가드가 없음)와의 비대칭을 한 줄로 인정 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | cross_spec | "코드를 명시한 자리" 전수 집계(C-9)는 *기존에 코드가 있어 stale해지는 자리*만 포괄하고, C-6·C-7처럼 *새로 코드를 붙이는* 자리는 별도 모집단이라 "전수"라는 표제가 오독될 여지 | draft C-9 `spec/5-system/2-api-convention.md` "전수 방법(Critical 대응)" | C-9 문단에 "이 census는 기존 코드가 stale해지는 자리만 포괄하며 C-6·C-7은 별도"라는 스코프 한 줄 추가 |
| 2 | convention_compliance | B-1의 "Planned 인라인 마커" 인용이 `spec-impl-evidence.md §3`(status 라이프사이클) 전체를 가리켜, 마커 **문법**의 근거로 오독될 여지(§3은 문법을 규정하지 않음) | draft §B-1 | "`spec-impl-evidence.md §3`(`status: partial` 라이프사이클)"로 한정하거나 실제 마커 선례(`1-auth.md §1.3`/§4.1) 병기 |
| 3 | convention_compliance | 신설 `EDITOR_REQUIRED`/`OWNER_REQUIRED`가 prefix-less로 등재되는데 `error-codes.md §1`의 prefix-less 예외 콜아웃 목록(`VALIDATION_ERROR`·`INVALID_TOOL_ARGUMENTS`)에 이 RBAC 코드군이 아직 없어 향후 오탐 소지 (기존 `ADMIN_REQUIRED`·`NOT_A_MEMBER` 선례를 따른 것이라 위반은 아님) | draft C-1(e), C-2 | 필요시 `error-codes.md §1`에 "역할·멤버십 거부군(`*_REQUIRED`, `NOT_A_MEMBER`)은 시스템 전역 공용 코드로 prefix 없이 쓴다" 한 줄 추가 고려 |
| 4 | plan_coherence | 신설 repo-guard(D-4, `workspace-param-binding`)가 `spec-conventions-engine-error-code-surface.md`가 추적 중인 `*-guard.ts`/`*-fixture.ts`/`*.spec.ts` 파일-쌍 population을 늘림 (그 plan 자체가 "재측정 대상"이라 선언해 뒀으므로 조치 불필요) | draft D-4 | 별도 조치 불필요 — 다음 그 plan 재측정 시 이번에 늘어난 가드 쌍도 포함해서 셀 것 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | LOW | 9개 spec 파일 인용·코드 대조 전부 일치, Critical 없음. Rationale 문단 내 모순(WARNING 1건), 전수집계 스코프 명확화(INFO 1건) |
| rationale_continuity | MEDIUM | `@WorkspaceParam` opt-in 마커 재기각 선례(1-auth.md 부트 캐너리 (b)) 미인용(WARNING 1건). 나머지는 Rationale 연속성 양호(정정 각주 보존, 실측 근거 명시) |
| convention_compliance | LOW | 명명·rename 정책·swagger 체크리스트·문서 3섹션 구조 전부 준수. INFO 2건(인용 정밀도, prefix 콜아웃 누락) |
| plan_coherence | NONE | 이전 두 라운드(`14_19_32`,`14_38_28`)의 WARNING 5건 전부 해소 확인, `plan/in-progress/**` 33개 문서 재검토로 신규 충돌 없음. INFO 1건(조치 불필요) |
| naming_collision | NONE | 신규 식별자 2개(`@WorkspaceParam`, `EDITOR_REQUIRED`) 전수 grep 무충돌, 재사용 식별자(`NOT_A_MEMBER` 등) 의미 전용 없음. 직전 라운드 지적 자체 반영 확인 |

## 권장 조치사항
1. cross_spec WARNING #1 해소: `spec/data-flow/12-workspace.md` C-1(d) 정정 문단에 "없는 리소스는 어차피 404" 절도 워크스페이스 `:id` 예외로 함께 한정 (C-1(e)와 상호 참조).
2. rationale_continuity WARNING #2 해소: draft C-1(c)/D-1/D-4에 `1-auth.md` 부트 캐너리 (b) 선례를 명시 인용하고, 이번 opt-in 데코레이터 + 정적 가드 조합이 그 선례의 우려(재발)를 왜 닫는지 한 문단으로 근거 보강. 헤더/토큰 모델의 구조적 비대칭도 한 줄 인정.
3. (선택) INFO 4건은 draft 품질 향상 목적으로 반영 가능하나 BLOCK 과 무관하며 강제 아님.
