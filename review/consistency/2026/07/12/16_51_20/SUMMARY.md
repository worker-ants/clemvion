# Consistency Check 통합 보고서 (--impl-done, 복구·정정본)

**BLOCK: NO** — Critical 0. journal 전 result 스캔에서 `[CRITICAL]`/HIGH·CRITICAL 위험도 **0건** 확인.

> 5 checker 중 cross_spec·convention_compliance 는 요약 agent 가 회수(NONE), 나머지 3(rationale_continuity·plan_coherence·naming_collision)은 disk-write gap. naming_collision 전문은 journal 에서 복구·분리 저장. plan_coherence 는 journal 에 short fragment 만 남아 전문 복구 불가(cross_spec 이 plan 일관 독립 확인).

## 대상
`spec/7-channel-web-chat/` — 위젯 chrome EN i18n 활성 구현(commit efaf6f474, base origin/main).

## Critical
없음.

## Checker별
| Checker | 위험도 | 판정 |
|---|---|---|
| cross_spec | NONE | 데이터모델·API·요구사항ID·상태전이·RBAC·계층 6관점 충돌 0. locale vs Chat Channel `languageLocale` 구분 확인. plan(defer vs 예약실행) 일관 |
| convention_compliance | NONE | swagger·conversation-thread·i18n-userguide·error-codes·spec-impl-evidence·api-convention 대조 위반 0. INFO 1(데모 host 문체) |
| rationale_continuity | LOW | CRITICAL/WARNING 급 연속성 문제 없음(locale 활성=예약경로 실행, 재도입 아님) |
| plan_coherence | (미확인, BLOCK 사유 없음) | disk-write gap fragment. cross_spec 이 plan 일관 독립 확인 |
| naming_collision | LOW | WARNING 2(아래) — 비차단 |

## WARNING (naming_collision) — 수용(accept-with-rationale)
| # | 발견 | 결정 |
|---|---|---|
| N1 | 위젯 `Locale` 타입명이 frontend `Locale`(메인 앱 i18n)과 동명 | **수용** — 별 패키지, `@/*` tsconfig 격리로 컴파일/모듈 충돌 0(값 union 우연 동일). rename(`WidgetLocale`)은 선택적 cosmetic, 재-cycle 비용 대비 defer |
| N2 | 위젯 `TranslationKey` 타입명이 frontend `TranslationKey` 와 동명 | **수용** — 동일 근거(격리 패키지, 실충돌 없음). 개념 구분은 spec 의 `languageLocale` disambiguation + catalog 헤더 주석이 이미 커버 |

> 근거: 두 타입은 물리적으로 분리된 번들(frontend vs channel-web-chat)에 독립 정의되며 상호 import 경로가 없다(cross_spec·naming_collision 모두 확인). grep 혼동은 실기능 리스크가 아니며, rename 은 comment-only 변경이라도 SPEC-CONSISTENCY 재-cycle 을 유발(disk-write gap 비용)하므로 비용 대비 defer 가 합리적. 후속 정리 시 `WidgetLocale`/`WidgetTranslationKey` 개명 검토.

## INFO — 수용
- convention_compliance: `src/app/demo/demo-host.tsx`(dev-only 데모 시뮬레이터) 합니다체 — 위젯 소유 chrome(`widget/`·`lib/i18n/`)은 전부 해요체 정합. **데모 host 는 위젯 chrome 스코프 밖**([[project_webchat_i18n_scope_carveout]] 경계: 데모·테스트 제외)이라 P6 강제 대상 아님. 반복 오탐 방지 위해 향후 i18n-userguide 에 명문화 검토 가능(비차단).

## 결론
BLOCK: NO. naming WARNING 2건은 수용(격리 패키지·무충돌), 데모 host INFO 는 스코프 밖. SPEC-CONSISTENCY 게이트 통과.
