# Rationale 연속성 검토 — `plan/in-progress/spec-draft-trigger-workflow-index.md`

## 발견사항

- **[INFO]** `V106 형태` 명시가 V110 의 최신 안전 패턴과 다른 이유를 draft 안에 남기지 않음
  - target 위치: `## 구현` 섹션 첫 불릿 (`V111 …` — "`CREATE INDEX CONCURRENTLY IF NOT EXISTS … (V106 형태, 수동 롤백 주석 포함)`")
  - 과거 결정 출처: `codebase/backend/migrations/README.md` §5 "인덱스 교체는 DROP-먼저" (2026-09-05 규약화, `spec/conventions/migrations.md` §5 포인터) — 및 그 규약이 문서화한 V056/V106/V110 세 선례 비교표
  - 상세: 2026-09-05 에 확립된 "DROP-먼저" 3문장 패턴(`DROP IF EXISTS <신규명>; CREATE …; DROP IF EXISTS <구명>;`)은 README·규약 문서 모두 **"기존 인덱스를 교체하는 마이그레이션"** 으로 명시적으로 스코프돼 있다. README §5 는 V106(신규 추가·짝 DROP 없음)을 "재실행 시 invalid 인덱스가 영영 유효해지지 않는" 잔존 위험을 가진 채로 **소급 수정 대상이 아닌 것**으로 명시적으로 인정해 둔다. 이 draft 는 V111 도 "교체"가 아니라 "신규 추가"이므로 README §5 의 스코프상 `V106 형태`(단일 `CREATE INDEX CONCURRENTLY IF NOT EXISTS`)가 정확히 맞는 선택이다 — 트래커 항목 자체도 등재 시점에 "`V106` 과 같은 `CREATE INDEX CONCURRENTLY` 마이그레이션" 이라고 못 박아 뒀다(`plan/in-progress/spec-draft-nullable-notation-followups.md` 4590~4593행). 즉 **기각된 대안 재도입도, 원칙 위반도 아니다** — README 가 "교체"와 "신규 추가"를 이미 갈라 둔 그대로다.
  - 제안: 다만 V110 이 가장 최근 선례이고 그쪽은 3문장 안전 패턴을 쓰므로, 나중에 코드 리뷰어가 "왜 V110 패턴을 안 썼는가"로 재지적할 여지가 있다. `S2`(신설 Rationale 절) 나 V111 마이그레이션 파일 주석에 "이 인덱스는 **교체가 아니라 신규 추가**라 README §5 의 DROP-먼저 요건 대상이 아니다(V106 과 동일 분류)"를 한 줄 남겨 두면 재지적을 예방한다. 이것은 target 수정 요구가 아니라 연속성 보강 제안이다.

## 요약

target draft 는 이 저장소가 이미 확립해 둔 세 축의 Rationale 과 정합적이다 — (1) `spec/1-data-model.md` "Schedule 인덱스" (2026-09-04) 절이 세운 "선두 컬럼은 실제 술어 컬럼이어야 한다"는 원칙을 단일 등치 컬럼 인덱스에 올바르게 적용했고, (2) `select: { id, type, config }` 좁히기는 같은 문서의 "User 민감 컬럼" (2026-09-06) Rationale 이 **채택**한 "쿼리 범위 select 투영" 패턴과 정확히 일치하며 그 절이 경고한 "기각된 `select: false` 엔티티 선언"과는 다른 것임을 스스로 구분해 서술한다, (3) `V106 형태` 마이그레이션 선택은 README §5 의 "인덱스 교체는 DROP-먼저"(2026-09-05) 규약이 명시적으로 **교체 전용**으로 스코프해 둔 것이며 트래커 항목 자체가 이 형태를 지정해 등재했으므로 기각된 패턴의 재도입이 아니다. 과거 Rationale 이 거부한 대안을 되살리거나, 합의된 설계 원칙을 우회하거나, 근거 없이 결정을 번복한 지점은 발견되지 않았다. 유일한 보강 여지는 INFO 수준으로, V110 이 최근 선례라 미래 리뷰어가 "더 안전한 패턴을 안 썼다"고 오인할 수 있으므로 스코프 구분을 한 줄 명시해 두면 좋다는 예방적 제안뿐이다.

## 위험도

NONE
