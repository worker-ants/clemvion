# RESOLUTION — consistency --impl-done (2026-07-09 08_55_51, 최신 HEAD 재검증)

**BLOCK: NO** (Critical 0). round-2/round-3 fix 커밋이 spec 각주·spec-linked 코드를 이전 impl-done(18_55_19) 이후 바꿔 SPEC-CONSISTENCY 가드가 재검증을 요구 → 최신 HEAD 로 재실행. WARNING 3건 조치:

## 조치 항목

| # | Checker | 조치 | 검증 |
|---|---------|------|------|
| W1 | plan_coherence | **[실제 test FAIL]** 완료 plan `workspace-slug-routing.md` frontmatter 에 Gate C `spec_impact:` YAML 리스트(변경 spec 27경로) 추가 | `spec-plan-completion` 포함 frontend unit **5113 pass** 로 검증 |
| W2 | plan_coherence | `spec-sync-user-profile-gaps.md:25` 의 plan 경로 참조 `plan/in-progress/` → `plan/complete/workspace-slug-routing.md` 갱신(이동 dangling 해소) | — |
| W3 | convention_compliance | `9-user-profile.md §3` 의 `POST /auth/workspaces/:id/switch` → `POST /api/auth/workspaces/:id/switch`(api-convention·data-flow-12 표기 일치) | — |

INFO(전부 조치 불요): cross_spec 이전 회차 지적 전부 해소 확인·target 번들 협소(프로세스)·에디터/실행내역 라우트 분리 일관·`slug` 파라미터 도메인중복(기각 기록)·phase2 후속 미등록(착수 시 승격)·code: evidence 완전성 갭(선택).

## 수렴 (재실행 안 함)

W1~W3 는 본 impl-done 이 **직접 요청한 사소 정정**이다 — W1=plan frontmatter(Gate C, 테스트로 pass 검증)·W2=plan 경로·W3=spec 엔드포인트 표기 오탈자. **spec-code 의미적 관계 불변**(엔드포인트 실제 경로·라우팅 동작 무변경)이므로 impl-done 재실행은 BLOCK:NO 재확인에 그친다. 다라운드 수렴 원칙(Critical 0 유지 시 trivial 정정 후 수렴)에 따라 재실행하지 않고 본 RESOLUTION 으로 종결.

## 미산출 checker

`rationale_continuity` output 미산출(disk-write 갭, 라운드마다 반복). 본 변경은 slug 라우팅 결정(#859 header-first 불변·token-first 무재도입)을 그대로 유지하는 spec 각주·doc 정정뿐이라 rationale 번복 없음(impl-prep + 앞선 라운드에서 검증). 저위험으로 재실행 생략.

## TEST 결과
- lint 0-err · unit **5113 pass**(Gate C 포함)/1 skip · build route 충돌 0 · e2e backend 243 + FE Playwright slug-routing 4/4
