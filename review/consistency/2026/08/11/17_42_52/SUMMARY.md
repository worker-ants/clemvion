# consistency SUMMARY — `17_42_52` (`--impl-done spec/conventions`)

## BLOCK: NO

Critical **0건**. checker 5/5 착지, 전원 BLOCK:NO.

| checker | 위험도 | 발견 |
|---|---|---|
| cross_spec · naming_collision · rationale_continuity | **NONE** | 0 |
| convention_compliance | **NONE** | INFO 1 |
| plan_coherence | LOW | **WARNING 1 (처분함)** |

## plan_coherence WARNING — 후속을 잘못된 plan 에 등재했다

`spec-link-integrity` 멀티라인 사각지대는 **하니스/테스트 인프라 결함**(`spec-links.ts` 수정
필요)인데 나는 이 **P3 spec-doc 티켓**(`owner: project-planner`, `spec_impact` 3파일)에 적었다.
이 티켓이 `complete/` 로 가면 docs-guard 작업자가 못 찾는다. 그리고
`harness-review-gate-followups.md` 는 **이미 같은 가드의 다른 결함**(§4.2 책임 소재 오기)을
추적 중이었다 — 형제 항목이 갈라져 있었던 셈이다.

**이관 완료.** 실측·뮤테이션 근거 + "남은 5건을 한 줄로 펴는 건 증상 처리" 경고까지 옮겼다.

## rationale_continuity — 이 라운드의 가장 무거운 질문

내가 `llm-model-config.controller.ts:118` 의 **명시적 결정 주석**("역할 제한이 없어
`@ApiForbiddenResponse` 도 두지 않는다")을 뒤집었다. **무근거 번복인가?**

`git log -S` + `git merge-base --is-ancestor` 로 위상 검증:

| 날짜 | 커밋 | 사실 |
|---|---|---|
| 2026-06-27 | `3e102ed3d` | 원 주석 도입 — **당시엔 참**이었다(`RolesGuard` 가 `requiredRoles` 비면 멤버십 조회 전에 통과) |
| 2026-08-08 | `8d84f6e9f` (#1103) | P0 cross-tenant fix 가 그 구멍을 닫음 — 멤버십 **무조건** 검증 |
| 2026-08-11 | 이번 PR | 주석을 새 사실에 맞춰 정정 |

`merge-base --is-ancestor 8d84f6e9f 3e102ed3d` → **NOT ancestor**. 즉 옛 주석이 쓰였을 때
그 fix 는 존재하지 않았다 — **"폐기된 규칙을 되살린" 것도, "살아있는 결정을 무근거로 뒤집은"
것도 아니다.** 시점엔 참이던 서술이 런타임 변경으로 거짓이 된 정상적 drift 다.

checker 는 또 함정 하나를 갈랐다: `RolesGuard` 를 `APP_GUARD` 전역 등록으로 바꾼 리팩터
(`c0ae17280`, 2026-05-04)는 **프로바이더 등록 방식**이지 **가드 내부 로직**이 아니다.
후자를 고친 것이 `8d84f6e9f` 다. 이 구분을 놓쳤다면 "2026-05-04 에 이미 바뀌었는데 왜
6월 주석이 저렇게 쓰였나" 로 잘못된 결론에 갔을 것이다.

인용된 `spec §3·R-7`(`2-navigation/6-config.md`)도 실재하고, `:id/models` 의 Viewer+ 유지
결정을 **건드리지 않았음**(코드상 `@Roles()` 여전히 부재)을 확인했다.

## cross_spec — 정정된 인용이 표와 정확히 맞는가

`1-auth.md:366-373` 표를 직접 열어 컬럼 순서(Owner→Admin→Editor→Viewer)와 체크마크
(Owner/Admin/Editor ✅, Viewer —)가 내 서술과 **문자 그대로 일치**함을 확인. `node-cancellation.md`
와 `3-execution.md` 두 정정이 서로 정합함도 나란히 대조했다.

신규 13건의 `'<role> 이상 권한 필요'` 가 `3-error-handling.md`·`2-api-convention.md` 의 403
**코드 체계**와 층위가 달라(Swagger 설명 텍스트 vs wire `code` 필드) 충돌 대상이 아님도 확인.

## naming_collision — `'owner 이상 권한 필요'` 는 저장소 최초

신규 표현이지만 §5-4 의 기계적 템플릿(`'<role> 이상 권한 필요'`)의 **첫 인스턴스**이고,
`owner` 는 `12-workspace.md` 의 유효 역할명이다. 기존 `"Owner 전용"`(1-auth.md:380)과는
문자열도 자리도 다르다. 앵커는 가드가 실제 쓰는 **`github-slugger` 로 직접 재계산**해 일치 확인.

## convention INFO (무조치)

401→403→404 배치가 **64/64 무예외**로 굳었으니 규약 명문화 가치가 있으나, **이 PR 에서는
하지 말 것**을 권고했다 — 새 규범 문장은 그 자체로 Rationale 을 요구해 별도 사이클이
자연스럽고, 이 plan 은 이미 "spec 을 더 건드리면 `--impl-done` 이 stale 이 된다" 는 이유로
범위를 좁혔다. 동의하고 무조치.
