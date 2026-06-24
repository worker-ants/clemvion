# Review Resolution — W7 SPEC-DRIFT 해소 (multi-turn condition meta.toolCalls 미합산)

리뷰 SUMMARY: `review/code/2026/06/25/08_09_39/SUMMARY.md`
**위험도 LOW · Critical 0 · Warning 0 · INFO 11.** 14 reviewer 전원 success.
대상 커밋 `c7e9574f`.

## 처분 요약

**Critical/Warning 0 → 강제 fix 의무 미발동.** INFO 11건은 모두 선택/장기/pre-existing 이거나 본 버그픽스의 의도된 결과로, 코드 추가 변경 없이 근거를 남기고 종결한다 (review_guard 불필요 재무장 회피). 본 변경은 spec §7.1 준수를 위한 정확한 버그픽스로 reviewer 전원이 정당성 확인(requirement·scope·maintainability·documentation NONE).

## 보류 (Deferred — 근거 명시)

| # | 카테고리 | 사유 |
| --- | --- | --- |
| INFO-1 | side_effect | `meta.toolCalls` 수치 의미 변경(condition 포함→미포함)은 **본 버그픽스의 의도된 필연적 결과** — spec §7.1 "조건 도구 제외" 준수. 코드는 올바름. 운영 모니터링 임계값 재검토는 인프라/대시보드 영역으로 코드 PR 범위 밖 (커밋 메시지·plan 에 변경 명시). |
| INFO-2·3·4 | testing | condition-only multi-turn(`toolCalls===0`, **handleMultiTurnConditionRoute 경로 — W7 이 건드린 record 경로와 별개**)·`maxToolCalls` 경계값·타임스탬프 일치(fake timers) 보강. 본 PR 신규 테스트가 W7 핵심 경로(condition+normal 혼합 미합산)를 직접 고정. 추가 엣지는 백로그(저우선). |
| INFO-5·6 | performance | `JSON.stringify(deferral)` 호이스팅·`nodeRef` 루프밖 캐시 — 실사용 규모에서 측정 불가 수준 micro-opt(reviewer NONE 등급). 본 변경 범위 밖, 별도 grooming. |
| INFO-7 | architecture | 두 record helper 의 동형 condition 블록을 `recordConditionDeferralMessages` 공통 헬퍼로 추출 — 정책 단일화 이점 있으나 normalToolCalls 블록 차이(파라미터화 필요)로 본 픽스 범위 초과. 후속 grooming. |
| INFO-8 | architecture | `MultiTurnResumeState` 인터페이스로 `Record<string, unknown>` 캐스팅 경계화 — 장기 개선, multi-turn 경로 전반 영향이라 별도 작업. |
| INFO-9·10 | security | `sanitizeToolError` pass-through·`capFormDataBytes` 비-string cap — **pre-existing, 본 변경과 무관**(reviewer 도 "이번 변경 범위 외" 명시). 별도 보안 grooming 백로그. |
| INFO-11 | maintainability | 코드베이스 전반의 짧은 `§3.f-g` 형식 앵커 — 본 PR 은 W7 관련 4곳을 완전 경로로 전환. 나머지는 점진 전환(저우선). |

## 재검증

본 PR 은 리뷰 후 코드 추가 변경 없음 (Critical/Warning 0). 직전 검증 유효: lint·build(tsc)·unit(ai-agent **478**, multi-turn condition no-count 신규)·**e2e 214 PASS**. impl-prep `review/consistency/2026/06/25/07_50_33` BLOCK:YES(=제거 대상 위반 확인, 구현이 곧 해소). impl-done 으로 위반 해소(BLOCK:NO) 확인.
