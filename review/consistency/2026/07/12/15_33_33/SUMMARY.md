# Consistency Check 통합 보고서 (--impl-prep, 복구·재집계본)

**BLOCK: NO** — Critical 0. 3 checker(rationale_continuity·convention_compliance·naming_collision) disk-write gap → workflow journal.jsonl 에서 복구·재집계. 전체 위험도 MEDIUM(plan_coherence stale 포인터 WARNING).

## 대상
`spec/7-channel-web-chat/` (구현 착수 전 --impl-prep, 위젯 chrome EN i18n 구현).

## Checker별 (5/5 확보)
| Checker | 위험도 | 판정 |
|---|---|---|
| cross_spec | LOW | INFO 1(GENERIC_ERROR_MESSAGE ↔ 4-security 상호참조 누락). 모순 없음 |
| rationale_continuity | LOW | 정상 — locale 활성=모범 번복 패턴, EIA-RL-07 스코프 분리 확인 |
| convention_compliance | LOW | WARNING 1(구현상태 고지 불일치: 2-sdk/5-admin 현재형 vs 1-widget/0-overview "착수 예정") |
| plan_coherence | MEDIUM | WARNING 2(후속 포인터가 defer plan 지목·카루셀 각주 미반영) |
| naming_collision | LOW | WARNING 1(테스트 `__tests__/` 배치가 콜로케이트 관례 이탈). 신규 식별자 충돌 0 |

## WARNING (조치 계획)
| # | 요지 | 조치 |
|---|---|---|
| 1 | spec "후속" 링크가 완료된 defer plan(webchat-i18n-scope) 지목 | 구현 완료 후 spec 캐비엇 갱신 시 in-progress plan 으로 교체(post-impl) |
| 2 | 카루셀 후속 plan i18n 각주 미반영(자기보고 오기재) | webchat-widget-presentation-followups.md 에 실제 각주 추가 |
| 3 | 구현상태 고지 불일치 | **구현 완료 후** 1-widget §4·0-overview "착수 예정"→"구현됨" + 2-sdk/5-admin 현재형 정합화(feature 실재화로 자연 해소) |
| 4 | i18n 테스트 `__tests__/` 이탈 | **콜로케이트로 구현**: `catalog.test.ts`/`resolve-locale.test.ts`/`context.test.tsx` (플랜 §9 수정) |

## INFO
- 4-security §1 에 "표시 문구는 위젯 로컬 i18n catalog 경유" 1줄(구현 PR 반영) · `TranslationKey`/`useTranslation` 동명(별 패키지, 충돌 아님) · catalog 키 vs admin `webChat` dict 분리.

## 결론
BLOCK: NO. WARNING 4·1·3 은 구현 및 post-impl spec 정합화에서 해소, WARNING 2 는 후속 plan 각주 추가. 구현 진행.
