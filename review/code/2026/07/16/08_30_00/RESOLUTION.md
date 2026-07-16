# RESOLUTION — control-plane per-provider escape 리뷰 (08_30_00)

리뷰: `SUMMARY.md` (BLOCK: NO, Critical 0). 조치 완료 (commit `2a2e3a8c7`).

## 조치 항목
| # | reviewer | 발견 | 조치 |
|---|---|---|---|
| 1 | architecture | escape 호출이 4곳 분산 — 구조적 강제력 없음 | fix — help/formValidationFailed/formNextField 를 sendBestEffortNotice 로 통일(단일 chokepoint) |
| 2 | maintainability | telegram escapePromptText 가 escapeMarkdownV2 중복 | fix — 호출부를 escapeMarkdownV2 로 교체, escapePromptText 제거 |
| 3 | maintainability | sendSurfaceMismatchNotice 주석이 옛 MarkdownV2-safe 서술 | fix — "평문 — escapeControlText 가 escape" 로 갱신 |
| 4 | testing | escapeControlText wiring 미검증 + /help 테스트 전무 | fix — marker 변환 mock 으로 wiring 검증 + /help 경로 테스트 |
| 5 | documentation/requirement | §1.1 rename 이 15-chat-channel backlink 2곳 파손, "6함수" stale | fix — 앵커 2곳 갱신 + types.ts/R-CCA 본문 "6함수" 일반화 |

## 문서화만 (코드 방어 미채택)
- [requirement/side_effect] 이중-escape 마이그레이션: plan "마이그레이션 주의" 에 배포 전 DB 점검(ops) note.
  코드 방어(이미-escaped skip)는 backslash-toggle 복잡도 부활 + 평문 계약서 backslash 정상입력 오탐이라 미채택.
  위험 창은 #950 머지 직후라 매우 좁다.

## 수용/backlog
- R1/R2 Rationale 제목 "6함수"(원래 core-6 설계 rationale, escapeControlText 는 additive) — 제목 변경 시
  anchor cascade 위험이라 보존.
- formValidationFailed/formNextField 경로 테스트 — handleFormStep 복잡 setup. escape 경유는 /help+wiring
  테스트로 대표 검증(sendBestEffortNotice 공유 chokepoint).

## TEST 결과
- lint / unit(14) / build / e2e(254) 전부 통과.
