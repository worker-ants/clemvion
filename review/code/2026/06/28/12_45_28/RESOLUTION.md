# RESOLUTION — C-1 커버리지 보강 리뷰 조치

원본 SUMMARY: [`SUMMARY.md`](./SUMMARY.md) — LOW, Critical 0 / Warning 0 (전부 INFO).
Warning 이상 0 이라 비차단이나, 본 PR 이 "커버리지 보강" 이 목적이므로 테스트를 더 견고하게 하는 INFO 를 채택 반영.

## 조치 항목 (채택)

| SUMMARY # | 항목 | 조치 |
|---|---|---|
| INFO 1 | sanitize 128 on-boundary / 129→cap 경계 누락 | 128 보존·129 cap 케이스 추가 |
| INFO 7 | release warn 메시지 내용 미검증 | `expect(warn).toHaveBeenCalledWith(stringContaining('exec-del-fail'))` 추가 |
| INFO 2 | `warn.mockRestore()` 말미 위치 | try/finally 로 이동 (expect 실패 시 spy 잔류 방지) |
| INFO 5 | microtask flush 가정 주석 부재 | "catch body 동기 → 1회 flush 충분" 주석 |
| INFO 6 | `\r\n` 공백 개수 가독성 | `\r→' '·\n→' '·\t→' '` 인라인 주석 |
| INFO 9 | plan 케이스 수 오기 | "5 케이스(sanitize 4 + release 1)" 로 명확화 |
| INFO 10 | plan `/ai-review` 체크박스 | `[x]` 갱신 |

## 보류 (사유)

- INFO 3 (`AllocatorInternals` 타입 통합): 파일 전반 `as unknown as` 패턴 통합 — 본 PR(C-1) 범위 외 후속 리팩.
- INFO 4 (sanitize fail-fast 가드): #1 의 경계 케이스가 메서드 부재 시 어차피 fail 하므로 별도 가드 불요.
- INFO 8 (모듈 JSDoc 신규 경로 반영): 선택, 과함.

## TEST 결과

- **lint**: 통과
- **unit**: 통과 (backend — 신규 5 케이스 포함. frontend schedules-page flaky 1건은 단독 10/10 green 으로 무관)
- **build·e2e**: 프로덕션 코드 무변경(unit-spec 추가만) → 무관
- INFO 반영(코드 변경)으로 본 리뷰가 stale → 동일 changeset fresh `/ai-review` 로 재확인(아래 트레일).
