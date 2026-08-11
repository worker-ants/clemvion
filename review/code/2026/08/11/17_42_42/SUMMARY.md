# ai-review SUMMARY — `17_42_42` (6) + consistency `17_42_52` (5)

델타 = 커밋 `165960a92`(잔여 13 + 주석/표기 정정) + `7977f5c81`(리뷰 산출물).

## 집계 — 11/11 착지, **CRITICAL 0**, consistency 전원 BLOCK:NO

| reviewer | 위험도 |
|---|---|
| api_contract · security · documentation · cross_spec · convention · naming · rationale | **NONE** |
| scope · testing · maintainability · plan_coherence | LOW (WARNING 2) |

## 리뷰어들이 이번엔 **독립 도구**로 재현했다

직전 라운드에서 세 리뷰어가 잔여를 6/3/12 로 다르게 세는 일이 있었다. 이번엔 각자 도구를 바꿨다:

- **api_contract** — 정규식 대신 **TypeScript 컴파일러 API(AST)** 로 스캐너를 새로 짜
  35파일 222라우트를 파싱. 잔여 **0** 확인. 자기 파서의 정밀도를 스스로 근거로 댔다.
- **testing** — 실제 `spec-links.ts` 를 **esbuild 로 번들해** scratch fake-repo 에서
  `findBrokenLinks()` 를 직접 실행. 내 뮤테이션 3줄 표를 **3/3 그대로 재현**했다.
  멀티라인 링크 전수도 **CommonMark 파서**(`mdast-util-from-markdown`)로 다시 세어
  5(현재) + 1(해소됨) = **6/6** 일치 확인.
- **convention** — 자기 스캐너의 **방향 버그로 첫 시도가 오탐 145건**을 낸 것을 발견해
  고치고 재실행했다(그 사실을 보고서에 적었다).
- **security** — "내 스캐너를 믿지 말라" 는 요구대로 별도 파서로 222라우트 재스캔, 잔여 0.

**세 독립 구현이 모두 잔여 0으로 수렴했다** — 직전 라운드의 수량 불일치가 해소됐다.

## testing 이 내 처분을 검증했다 (핵심)

| 확인 | 결과 |
|---|---|
| 350 멀티라인(수정 전) 뮤테이션 | **GREEN 생존** — 사각지대 실증 |
| 350 한 줄로 편 뒤 | **RED** |
| 398 단독 | **RED** |
| backend 전체 스위트 | **418 suites / 8511 passed / 0 failed** |
| 멀티라인 링크 전수 | **6건/6파일** 일치 |

그리고 **회귀 가드 유예 판단이 타당한지** 물었더니 — 저장소에 `Api*Response` 계열
데코레이터를 검증하는 테스트가 **하나도 없고**(`@ApiUnauthorizedResponse` 156건 포함),
런타임 영향이 0임을 `RolesGuard` 소스로 확인해 **"유예가 관례 부합, 이 PR 의 결함 아님"**
으로 판정했다. 나에게 유리한 답이지만 근거를 대고 준 답이다.

## WARNING 2건 — 둘 다 처분

| 출처 | 내용 | 처분 |
|---|---|---|
| **maintainability** | plan 에 `## 후속` 절이 **두 번** 존재하고, 그 안에 §5-4(오류)/§2-4(정정) 버전이 **중복 방치** | 절 통합 + 오기 전수 정정 |
| **plan_coherence** | 가드 사각지대 후속이 **잘못된 plan** 에 등재 — P3 spec-doc 티켓이 `complete/` 로 가면 docs-guard 작업자가 못 찾는다 | `harness-review-gate-followups.md` 로 **이관**, 원 plan 엔 포인터만 |

**maintainability 의 지적은 이 PR 의 반복 패턴 그 자체다** — 정정을 새로 append 하면서
**원본을 안 지웠다.** 고치면서 §5-4 오기가 106행에도, 정정 전 뮤테이션 주장이 122행에도
남아 있는 것을 추가로 찾아 전수 정정했다.

## 신규 관찰 (조치 불요, 근거 있음)

- **api_contract·security·scope 3명이 독립으로**: `executions.controller.ts` 의 테스트 훅 2종은
  `@ApiExcludeEndpoint()` 라 부착한 `@ApiForbiddenResponse` 가 **생성 OpenAPI 에 안 실린다.**
  다만 security 가 코드로 확인했듯 **가드는 핸들러 본문보다 먼저 돌아** 실제 403 은 난다.
  §5-4 가 예외를 두지 않으므로 임의 skip 이 오히려 일관성을 깬다 — 무조치.
- **rationale**: `llm-model-config` 주석 반전이 **무근거 번복인지** `git merge-base
  --is-ancestor` 로 위상 검증 → 옛 주석(2026-06-27)은 **당시엔 참**이었고 P0 fix(2026-08-08)가
  전제를 깼다. 정정이 정당함을 확정.
- **convention**: 401→403→404 배치가 64/64 무예외 — 규약 명문화 가치는 있으나 **이 PR 에서는
  하지 말 것**을 권고(새 규범은 Rationale 을 요구해 별도 사이클이 자연스럽다). 동의.

## RISK: LOW
## CRITICAL_COUNT: 0
## WARNING_COUNT: 2 (전부 처분)
