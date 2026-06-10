# RESOLUTION — 23_53_19

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-integration-expiry-diagram.md` — §1.4 sequenceDiagram `status_reason=NULL` → `'token_expired'` + 상태도 라인 363 동기 |
| #2 | 코드 (테스트) | 24cb6ad3 | cafe24+refresh_token 7d 임계 / makeshop+refresh_token 3d 임계 알림 면제 케이스 2개 추가 (§11.2) |
| #3 | 코드 (주석) | 9ca9d2d2 | `run()` isRefreshCapable→continue 분기에 "§11.2 의도적 설계 — dedup claim 미생성" 주석 추가. 향후 회귀 방지 안내 포함 |
| #4 | 코드 (리팩토링) | 24cb6ad3 | `getNotifResourceIds` / `hasSavedExpired` 헬퍼 추출. 기존 이중 `.flat()` 약한 assertion 강화 |
| #5 | 코드 (주석) | 9ca9d2d2 | `MONITORED_QUEUES` 주석에 e2e `EXPECTED_QUEUE_NAMES` 갱신 의무 한 줄 추가. I-7 설명 문자열 하드코딩 `14` → `EXPECTED_QUEUE_NAMES.length` 동적 참조 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (40 passed)
- e2e   : 통과 (184/184)

## 보류·후속 항목

- SPEC-DRIFT #1 draft 위임: `plan/in-progress/spec-update-integration-expiry-diagram.md`
  - `spec/data-flow/5-integration.md` §1.4 sequenceDiagram 라인 282 (`status_reason=NULL` → `'token_expired'`)
  - 같은 파일 라인 363 상태도 (`status_reason=NULL` → `'token_expired'`) 도 함께 갱신 권장
  - project-planner `/consistency-check --spec` 수행 후 반영 필요
- INFO #4 (MAKESHOP_REFRESH_QUEUE BullModule.registerQueue 등록 여부): `makeshop.module.ts` 라인 61에서 `BullModule.registerQueue({ name: MAKESHOP_REFRESH_QUEUE })` 확인 완료 — 런타임 안전
- INFO #3 (`status_reason=null` 기존 레코드 처리): 이번 fix 범위 외. API 레이어 정규화 또는 마이그레이션 스크립트 검토는 별도 plan 으로 관리 권장
- INFO #5 (spec §11.2 "재인증 실패" 알림 발사 경로 명시 누락): project-planner 위임 권장
- INFO #8 (`normalizeStatusReason` 전용 단위 테스트 없음): 낮은 우선순위, 별도 plan 추가 권장
