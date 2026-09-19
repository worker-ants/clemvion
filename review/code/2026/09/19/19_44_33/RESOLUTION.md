# RESOLUTION — 웹훅 경로 영구 예약 (1라운드)

SUMMARY: Critical 0 · Warning 2 · INFO 13. 정지 규칙(리뷰 전에 선언): Critical · Warning 0 이거나 `codebase/` 수정 0 인 라운드에서 수렴.

## 조치 항목

| SUMMARY # | 처분 | 커밋 |
|---|---|---|
| W1 CHANGELOG 누락 | Unreleased 항목 추가 + V132 항목 «남는 창» 에 해소 역참조 | `a4a4791a7` |
| W2 동시 경합 미검증 | 전용 e2e 에 두 연결 경합 테스트. 인터리빙 지점(기다리는 쪽의 잠금 대기)을 `pg_stat_activity` 로 확인한 뒤 먼저 잡은 쪽을 커밋/롤백. «하나만 성공» 은 전역 UNIQUE 만으로도 참이라 예약을 가르지 못해, 가르는 두 성질 — (a) 커밋 시 진 쪽이 PK 위반이 아니라 주인 라벨 (b) 롤백 시 예약이 남지 않음 — 을 본다. 뮤턴트: `ON CONFLICT` 제거 → `…_pkey` RED · 트리거 제거 → `idx_trigger_endpoint_path` RED | `a4a4791a7` |
| INFO 1 라벨은 실재 제약 아님 | V133 함수 주석 | `a4a4791a7` |
| INFO 2 배포 중 잠금 | CHANGELOG «배포 뒤 보일 수 있는 것» 에 적음(마이그레이션 헤더에도 있음) | `a4a4791a7` |
| INFO 3 `UPDATE OF` 는 SET 여부로 발화 | V133 트리거 주석 | `a4a4791a7` |
| INFO 4 READ COMMITTED 전제 | V133 함수 주석. **처음 쓴 문장(«더 높은 격리 수준이면 SELECT 가 NULL 을 봐 거부»)은 실측이 반증** — REPEATABLE READ 에서는 `ON CONFLICT` 가 40001 로 끝난다(일회용 DB). 실측대로 적었고, 코드베이스가 격리 수준을 올리지 않음을 grep 으로 확인 | `a4a4791a7` |
| INFO 5 409 단언 헬퍼 중복 | `expectPathConflict` 하나로(B4 위) | `a4a4791a7` |
| INFO 8 Swagger 문장 | 서술어를 맞춤 | `a4a4791a7` |
| INFO 6 · 7 · 9 · 10 · 13 | 조치 없음 — 6: 엔티티는 스키마 가드(`entity-schema-declarations`)가 DB 와 대조하고 Repository 를 붙일 코드가 없다 · 7: 축 셋은 JSDoc 으로 충분 · 9: `ON CONFLICT DO NOTHING RETURNING` 은 충돌 시 행을 돌려주지 않아 SELECT 를 없애지 못한다 · 10: 모듈 밖 사용처 0(리뷰어 전수 확인) · 13: 선재 번호 순서 | — |
| INFO 11 · 12 | 마무리 커밋(트래커 해소 · draft `plan/complete/` 이동)에서 해소 | 마무리 |

## TEST 결과

- lint: 통과
- unit: 통과
- build: 통과 (타입체크 ratchet 포함)
- e2e: 통과 (361)
