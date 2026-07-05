# RESOLUTION — V-09 ai-review (15_20_19)

## 조치 항목
| # | 발견 | 조치 |
|---|---|---|
| side_effect WARNING#1 (cleanup) | accept page 메타 useEffect unmount 가드 부재 | `cancelled` 플래그 + cleanup 추가(register-form 패턴). unmount 후 setState 차단 |
| testing WARNING (branches) | handleAccept 실패·anonymous 방문자 미테스트 | accept 실패→error·anonymous→mismatch(자동수락 안 함) 테스트 2건 추가(8 passed) |
| documentation WARNING (plan) | plan V-09 checkbox 미갱신 | spec-code-cross-audit V-09 [x] 완료 처리 |
| side_effect WARNING#2 (logout fallback) | 서버 logout 실패 삼킴 | **조치불요** — 의도된 fallback(주석 명시). 클라이언트 세션은 확실히 정리하는 게 안전측. 실패 UX 안내는 별도 후속 |
| testing (translate interp) | translate mock 이 {{email}} 치환 우회 | **조치불요** — mock 한계. 실제 dict+translate 는 프로덕션 렌더/e2e 가 커버. mock 개선은 과설계 |

## TEST 결과
- lint: 통과 · unit: 통과(accept 8·register 10 passed) · build: 통과 · e2e: 통과 235(재수행)

## 보류·후속
- (INFO) logout 실패 시 사용자 안내(toast) — UX 사각, 별도 후속. maintainability INFO(axios error 추출 헬퍼 공유) 미조치.
