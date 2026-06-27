# RESOLUTION — 최종 ai-review (Batch 3, 00_48_37)

대상: `review/code/2026/06/28/00_48_37/SUMMARY.md` (LOW, Critical 0, WARNING 5).
이 리뷰는 직전 resolution 커밋(de8ebff3c — W1 CORS·spec·테스트)을 커버하는 fresh 리뷰다.
WARNING 5건은 전부 저위험 테스트 커버리지·유지보수 nit 으로, 코드 추가(→재게이트) 대비
가치가 낮아 수동 accept/defer 로 종결한다 (developer 규약 — WARNING 은 fix 또는 RESOLUTION).

## 조치 항목
| # | 분류 | 처리 | 근거 |
|---|---|---|---|
| W1 | testing | accept | 패널 로딩/빈/선택·삭제 콜백/load-more 는 검증됨. isError 는 정적 에러문구 1줄 분기. page+패널+api 다층 커버. |
| W2 | testing | accept | listScopes q-미지정 케이스 존재. listMemories kind 분기는 동형 단순 spread. 저위험. |
| W3 | testing | defer | CORS 는 main.ts bootstrap — 단위 테스트 부적합. e2e 부팅 통과로 검증. defaultOptions 순수함수 추출은 별도 cleanup. |
| W4 | maintainability | defer | i18n/RoleGate mock 공통화(test-helpers/setupFiles)는 테스트 인프라 cleanup, 기능 무관. |
| W5 | maintainability | defer | 'X-Deleted-Count' 공유 상수화 — backend/frontend 경계 cleanup. 현재 3곳 문자열 일치 확인. |
| INFO 다수 | — | accept/defer | 추가 테스트 제안·스타일. 현 커버리지 충분 — 후속 보강 대상. |

> W2(외부 admin 소비자)·W12(clearScope 호출자)는 직전 RESOLUTION(23_02_30)에서 grep 검증 non-issue.
> impl-done WARNING(#738 webhook UUID spec 부채)은 본 PR 무관 — webhook track 이관.

## TEST 결과 (직전 resolution 후 재수행 — 본 리뷰 대상 코드 기준)
- lint·unit(backend 152·frontend 4735)·build·e2e(218) 전부 green (`_test_logs/*-20260628-00*`).
- 본 리뷰(00_48_37) 는 코드 변경 없이 종결 — 재테스트 불요.

## 보류·후속 항목 (별도 cleanup, 기능 무관)
- W3 defaultOptions 순수함수 추출 + CORS 단위 테스트.
- W4 테스트 mock 공통화.
- W5 X-Deleted-Count 공유 상수.
- W5(SQL 슬롯 빌더)·W7(PanelAsyncContent) — 직전 RESOLUTION 이월분 유지.
