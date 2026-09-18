# Security Review — webhook `endpoint_path` 전역 유일화 (V131/V132)

## 발견사항

- **[INFO]** 지운 웹훅 경로의 재등록(묘비 부재)이 남은 공격 표면
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` (신규 항목 "지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다 — 묘비(tombstone) 부재")
  - 상세: 이번 V131/V132 는 **동시에 존재하는** endpoint_path 중복만 막는다. 트리거 소유자가 웹훅 트리거를 삭제하면 그 경로는 비고, 경로를 알고 있는 제3자가 자신의 워크스페이스에 즉시 같은 경로로 재등록할 수 있다. 원래 서비스(GitHub, Stripe 등)가 옛 URL 로 계속 POST 하면 그 요청은 새 등록자에게 간다 — 원 소유자가 의도적으로 지운 것이 아니라 leak 된 URL 이 알려져 삭제 직후 낚아채는 시나리오라면 information disclosure/데이터 가로채기로 이어질 수 있다. 이 PR 은 이를 이미 인지하고 별도 backlog 항목으로 정확히 기록했으며 이번 스코프 밖(비대상)으로 명시했다 — 새로 도입된 결함이 아니라 기존 V002 설계부터 있던 잔여 공격 표면이고, 문서화 상태도 적절하다.
  - 제안: 이미 후속 항목으로 추적 중이므로 추가 조치 불요. 후속 작업 시 삭제된 endpoint_path 재사용 유예기간(cooldown)/묘비 테이블 도입을 우선순위 있게 검토 권장.

- **[INFO]** 마이그레이션 경쟁(레이스) 윈도우가 문서화·완화됨 — 잔여 리스크는 운영 절차 의존
  - 위치: `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:13` 부근("운영 절차 ① — 경쟁") 및 `V131__trigger_endpoint_path_dedupe.sql` 헤더 주석
  - 상세: V131(정리)과 V132(UNIQUE 인덱스 생성) 사이에는 트랜잭션이 분리돼 있어(둘 다 concurrently 라 한 파일에 못 묶음), 그 사이 새로운 워크스페이스 간 경로 복사가 다시 발생하면 `CREATE UNIQUE INDEX CONCURRENTLY` 가 실패하고 invalid 인덱스가 남는다 — 이 경우 옛 인덱스가 valid 로 남아 있어 보호 수준이 즉시 저하되진 않지만, 그 사이 새로 생긴 중복은 여전히 워크스페이스 단위로만 막혀 전역 가로채기 취약점이 그 좁은 창에서 재현될 수 있다. 문서(README §6, 운영 절차 ①)에 재실행 수순이 명시돼 있어 절차적으로 커버된다.
  - 제안: 이미 운영 절차로 커버됨 — 배포 시 V131→V132 사이 시간을 최소화(연속 실행)하고, invalid 인덱스 검증(B6 e2e 테스트가 `indisvalid`를 이미 검증)을 배포 파이프라인에 포함하는 정도로 충분.

## 점검한 항목과 결과 (문제 없음)

- **크로스-워크스페이스 웹훅 하이재킹 (핵심 취약점) — 수정 확인**: V002 의 `(workspace_id, endpoint_path)` UNIQUE 는 경로를 아는 다른 워크스페이스의 복사 등록을 막지 못했다. V132 가 `(endpoint_path)` 전역 partial UNIQUE 로 교체해 이를 닫았고, `triggers.service.ts` 의 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 상수도 새 인덱스 이름(`idx_trigger_endpoint_path`)으로 갱신됐다. e2e `webhook-trigger.e2e-spec.ts` B5 가 실제 DB 에서 (1) 생성 시도, (2) PATCH 로 변경 시도 둘 다 409 로 막히고 (3) 수신 웹훅이 원래 주인의 워크플로로만 가는 것을 검증한다. 동시성도 애플리케이션 레벨 check-then-act 가 아니라 DB UNIQUE 제약 위반을 `.catch()` 로 받는 패턴(`triggers.service.ts` create/update 경로 둘 다)이라 TOCTOU 레이스가 없다.
- **정보 노출(에러 메시지)**: 충돌 메시지가 "동일 워크스페이스" 문구를 제거해 실제로는 다른 워크스페이스 소유일 수 있다는 사실을 오도하지 않게 정정됐고(`triggers.service.ts` `rethrowEndpointPathConflict`), 어느 워크스페이스와 충돌했는지는 노출하지 않는다 — 적절한 정보 최소화.
- **민감정보 로그 노출**: V131 마이그레이션의 `RAISE NOTICE` 는 트리거 id·워크스페이스 id·chat_channel 여부만 남기고 `endpoint_path` 자체(비밀 키 역할, WH-SC-01)는 남기지 않는다. e2e `trigger-endpoint-path-dedupe.e2e-spec.ts` 가 이를 명시적으로 단언(`notices.join('\n')).not.toContain(secret)`)한다.
- **SQL 인젝션**: V131/V132 모두 정적 SQL 이며 사용자 입력을 문자열 결합으로 삽입하지 않는다. 애플리케이션 측 `pg-error.ts` 의 제약 이름 추출도 DB 가 반환하는 에러 객체 필드(`constraint`/`driverError.constraint`)를 읽을 뿐 사용자 입력을 파싱하지 않는다.
- **암호화/난수성**: 새로 발급하는 endpoint_path 는 `gen_random_uuid()`(PostgreSQL, OS CSPRNG 기반) — 추측 불가능성 요구에 부합. UUID v4 형식이라 기존 `trigger.endpoint_path` CHECK 제약도 통과.
- **인증/인가**: 웹훅 조회/충돌 처리 로직에 권한 우회 여지 없음 — 컨트롤러의 `editor` 이상 권한 가드는 변경되지 않았고, 이번 변경은 순수하게 유일성 스코프(워크스페이스→전역)와 에러 메시지 문구/문서 정정에 국한된다.
- **하드코딩 시크릿**: 변경분(마이그레이션 SQL, 서비스/컨트롤러/테스트/문서/스펙 전체) 전수 grep 결과 하드코딩된 API 키·비밀번호·토큰 없음. 테스트 파일의 "secret" 변수는 테스트 fixture UUID 를 지칭하는 지역 변수명일 뿐 실제 자격증명 아님.
- **의존성 보안**: 이번 변경은 신규 의존성을 추가하지 않는다.

## 요약

이번 변경은 실질적인 보안 취약점(워크스페이스 단위 UNIQUE 만으로는 막지 못했던, 알려진 경로를 이용한 크로스-워크스페이스 웹훅 가로채기)을 전역 UNIQUE 인덱스로 정확히 닫는 수정이다. 마이그레이션(V131 정리 → V132 전역 UNIQUE 교체)의 설계, 애플리케이션 레벨 충돌 처리(DB 제약 위반 캐치, TOCTOU 없음), 에러 메시지의 정보 최소화, 민감 정보(경로)의 로그 비노출까지 일관되게 잘 설계·검증(e2e B5/B6, 마이그레이션 e2e)되어 있다. 유일하게 남는 것은 이미 별도 backlog 항목으로 정확히 기록된 "삭제된 endpoint_path 재등록(묘비 부재)" 잔여 공격 표면이며, 이는 이번 PR 의 의도적 비대상이다. 마이그레이션 레이스 윈도우도 운영 절차와 e2e 검증으로 커버된다. 새로 도입된 취약점이나 미완화 Critical/Warning 급 결함은 발견되지 않았다.

## 위험도

NONE
