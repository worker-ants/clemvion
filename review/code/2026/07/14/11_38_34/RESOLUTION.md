# RESOLUTION — 통합 fix 검증 (11_38_34)

리뷰: `SUMMARY.md` (BLOCK: NO, Critical 0). 조치 완료 (commit `3343c416a`).

## 조치 항목
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| 1 | documentation/convention | markdown-v2.ts JSDoc "양쪽 import" 과장(렌더러 미import) | fix — "DTO import + 렌더러 자체 regex + 계약 테스트 guarded" 로 정정 |
| 2 | testing | maybeNotifyIgnored 테스트 group 분기 편중 | fix — unsupportedMessageKind(non-group) + is_bot silent-skip 테스트 추가 |
| 3 | documentation(INFO)/plan | plan "WS 4개 handler" 계수 오류 | fix — "3개" 로 정정 |

## TEST 결과
- lint / unit / build 통과. e2e: 직전 통합 fix 라운드 통과(254) 유효 — 본 델타는 JSDoc 주석 +
  테스트 추가 + plan 문서로 product 런타임·e2e 경로 무변경이라 재실행 갈음.

## 보류·후속 항목 (backlog)
- [convention] chat-channel 봇 KO/EN 백엔드 하드코딩(SURFACE_MISMATCH_DEFAULTS 등)이 i18n-userguide
  Principle 3 예외로 codify 안 됨 — sessionExpired/formOpenLabel 부터의 pre-existing 광범위 패턴,
  convention 문서 갱신은 별도 작업.
- [rationale] STATE_MISMATCH nodeId 정합 결정이 canonical `## Rationale` 대신 §7.5.1 인라인 각주 —
  배치 개선 저우선.
- [architecture] 렌더러도 shared 상수 import(char-class 재구성)로 완전 단일화 — 취약성 우려로 현재
  test-guarded, 별도 검토.
