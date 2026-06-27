# RESOLUTION — execution-seq-allocator-load e2e 리뷰 조치

원본 SUMMARY: [`SUMMARY.md`](./SUMMARY.md) — 전체 위험도 **LOW**, Critical 0 / Warning 1 / INFO 12.
수동 처리(main). fix 는 test-only 파일에 국소.

## 조치 항목

| SUMMARY # | 등급 | 항목 | 조치 | commit |
|---|---|---|---|---|
| WARNING 1 | WARNING | `finally` 가 `allocB.release()` 미호출 (lifecycle 계약 절반 이행) | `releaseBoth()` 헬퍼 신설 → 세 테스트 `finally` 모두 양쪽 release | (본 REVIEW commit) |
| INFO 1 | INFO | throughput 테스트 min assert 누락 (검증 비대칭) | `expect(Math.min(...seqs)).toBe(1)` 추가 | (본 REVIEW commit) |
| INFO 4 | INFO | p95 계산되나 assert 안 됨 | 측정 전용 의도 주석 명시 | (본 REVIEW commit) |
| INFO 5 | INFO | 테스트 1·2 동시 할당 패턴 중복 | `allocateConcurrentlyAcrossInstances()` 헬퍼 추출 | (본 REVIEW commit) |
| INFO 7 | INFO | "수용 기준 #3" plan 번호 의존 | 기준 내용(`in-memory baseline 대비 회귀 < 5ms`)으로 직접 기술 | (본 REVIEW commit) |
| INFO 9 | INFO | `as never` 캐스트 사유 미기재 | 인라인 주석으로 의도 명시 | (본 REVIEW commit) |
| INFO 10 | INFO | plan `/ai-review` 체크박스 미완료 | `[x]` 갱신 | (본 REVIEW commit) |

### 보류 (사유)

- **INFO 2** (`as never` → 명시 타입): sibling unit spec 의 `as never` 패턴과 일관 유지. 대신 INFO 9 주석으로 의도 명시.
- **INFO 3** (스프레드 스택 위험): N=1000 고정, 현 범위 안전. N 확장 시 재검토.
- **INFO 6** (매직 넘버 추출): 헬퍼 추출로 국소화됨. 추가 상수화는 과도.
- **INFO 8** (docker-compose YAML anchor): 기존 파일이 명시 반복 스타일 — 일관 유지.
- **INFO 11** (allocator catch 비원자성 주석): 본 PR 범위 외(기존 production 코드), 정확성 영향 없음.
- **INFO 12** (`redis:7-alpine` patch pin): 기존 이슈, 본 PR 범위 외.

## TEST 결과

- **lint**: 통과 (43s)
- **unit**: 통과 (직전 green 이후 비-테스트 코드 무변경 — 본 라운드 변경은 단일 e2e-spec 파일에 국한, lint 가 타입 검사 커버)
- **build**: 통과 (직전 green 131s 이후 production/Dockerfile/compose 입력 무변경 — 결과 동일)
- **e2e**: 통과 (218 tests, 본 load spec 3개 포함). 측정: 1000 발급/16.3ms ≈ 61,401 events/s; single-instance latency median 0.077ms / p95 0.093ms

## 보류·후속 항목

없음.
