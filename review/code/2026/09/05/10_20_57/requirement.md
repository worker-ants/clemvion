# 요구사항(Requirement) 리뷰

## 개요

이번 diff(56개 파일, `codebase/**` 실질 변경은 `codebase/backend/migrations/README.md` 1개뿐)는 애플리케이션 코드가 아니라 두 개의 마이그레이션/리뷰 프로세스 컨벤션을 성문화하는 문서 PR이다. 실질 변경은 `codebase/backend/migrations/README.md` §5 "인덱스 교체는 DROP-먼저" 패턴 신설, `spec/conventions/migrations.md`·`spec/conventions/spec-impl-evidence.md`·`spec/data-flow/8-notifications.md` 포인터/각주 추가, `spec/conventions/review-citations.md` 신설, 그리고 이를 뒷받침하는 `plan/**`·`review/**` 산출물이다. 이 PR 자체가 6라운드(코드리뷰 2 + consistency-check 4)의 리뷰-수정 사이클을 거쳐 마지막 라운드(`10_13_38`)가 5개 checker 전원 NONE으로 수렴한 상태다. 본 리뷰는 그 위에서 (1) 문서가 주장하는 실측·선례를 저장소에서 직접 재현하고, (2) 직전 라운드들이 "해소됐다"고 주장한 항목이 실제로 최종본에 반영됐는지 대조하고, (3) 규약 자체의 기술적 정확성(엣지 케이스)을 독립적으로 재검토했다.

검증 방법: 저장소 파일을 수정하지 않고 `Read`/`Bash`(git grep, git diff, git status)로만 검증. 종료 시점 `git status --short` 결과 `review/code/2026/09/05/10_20_57/`(이 세션 자신의 산출물) 외 잔여물 없음.

## 발견사항

- **[WARNING]** README §5 "감수하는 비대칭" 절이 "정상 흐름에서는 발생하지 않는다"고 주장하는 재빌드 시나리오가, 실제로는 문서가 규정하는 정상 복구 절차(실패 후 재실행) 안에서도 발생할 수 있다
  - 위치: `codebase/backend/migrations/README.md:153` ("감수하는 비대칭: 0) 은 대상이 invalid 잔재인지 정상 인덱스인지 구분하지 않습니다. … Flyway 는 성공한 마이그레이션을 다시 돌리지 않으므로 정상 흐름에서는 발생하지 않고, 반대편(인덱스 0개)이 훨씬 나쁩니다.")
  - 상세: 신설된 3문장 패턴은 `0) DROP new IF EXISTS` → `1) CREATE new` → `2) DROP old`다. 문서는 "재빌드" 비용이 오직 **이미 성공한 마이그레이션을 수동으로 재실행**할 때만 생긴다고 못박는다. 그런데 statement 1(CREATE)이 성공한 **뒤** statement 2(DROP old)가 실패하는 경우 — lock timeout, 연결 종료, pod 재시작 등으로 충분히 일어날 수 있다 — Flyway 는 이 마이그레이션을 **실패**로 기록하고, 이 저장소가 이미 다른 절(같은 README §6 하단 "checksum 보정"/`migrate-repair` 및 §4의 `FLYWAY_POSTGRESQL_TRANSACTIONAL_LOCK` 서술)에서 표준 복구 경로로 문서화한 "`flyway repair` → 재실행" 절차를 밟게 된다. 이 재실행에서 statement 0 은 **이전 시도에서 이미 유효하게 생성된 새 인덱스**(invalid 잔재가 아니라 정상 인덱스)를 무조건 DROP 하고 다시 CREATE 한다 — 즉 "성공한 마이그레이션의 수동 재실행"이 아니라 **실패한 마이그레이션의 정상 재실행 절차 자체**에서 동일한 재빌드 비용이 발생한다. 최종 상태는 여전히 정확하므로(데이터 손실·인덱스 0개 없음) CRITICAL은 아니지만, "정상 흐름에서는 발생하지 않는다"는 문장은 이 실패 지점(1과 2 사이)을 놓치고 있어 문서화된 엣지 케이스 범위가 실제 실패 표면보다 좁다.
  - 제안: "감수하는 비대칭" 문단에 "CREATE 성공 후 DROP(old) 실패로 마이그레이션 자체가 실패한 경우, `repair`+재실행에서도 동일한 재빌드가 발생한다"는 문장을 추가해 "정상 흐름에서는 발생하지 않는다"는 단언을 정정한다. CRITICAL은 아니므로 후속 소정정으로 충분.

- **[INFO]** 핵심 정량 주장 전수 재현 — 모두 일치
  - 위치: `spec/conventions/review-citations.md:14` (Overview), `plan/complete/spec-draft-migration-rerun-and-citations.md` §2.1 표
  - 상세: `git grep -oE '[0-9]{2}_[0-9]{2}_[0-9]{2}' origin/main -- 'codebase/*'` → **514회**, `git grep -lE ...` → **107개 파일** — 문서 주장과 정확히 일치. `roles.guard.spec.ts`(`review/code/2026/08/08/20_53_48`)·`sanitize-loader-error.ts`(`review/code/2026/05/26/12_10_38`) 두 `code:` 예시 파일 모두 실제로 전체 경로 형태 인용을 포함함을 확인.
  - 제안: 없음(신뢰도 근거로 기록).

- **[INFO]** 마이그레이션 파일 3종(V056/V106/V110) 선례 서술과 실제 SQL 완전 일치
  - 위치: `codebase/backend/migrations/README.md:159-166` (표) vs `codebase/backend/migrations/V056__notification_active_partial_index.sql`, `V106__schedule_trigger_id_index.sql`, `V110__schedule_workspace_next_run_index.sql`
  - 상세: 세 파일을 직접 열어 대조 — V056(CREATE+DROP, 진짜 교체), V106(CREATE만, 짝 DROP 없음), V110(DROP→CREATE→DROP, 신규 3문장 패턴의 선례) 모두 문서 서술과 문자 그대로 일치한다.
  - 제안: 없음.

- **[INFO]** 이전 라운드(`09_27_04`~`10_04_12`)가 지적한 WARNING/INFO가 최종본에 전부 반영됨을 직접 대조로 재확인
  - 위치: `codebase/backend/migrations/README.md:127`("§인덱스 교체" → "같은 절(§5) 아래 **인덱스 교체는 DROP-먼저**"), `plan/complete/spec-draft-migration-rerun-and-citations.md:196-221`(부록 A/B 전문 중복 제거 → 3-파일 포인터 표로 대체, 코드펜스 8개(4쌍) 균형 확인), `spec/conventions/review-citations.md:66,67`(DTO JSDoc 행·`spec/**` 행 존재), `spec/conventions/spec-impl-evidence.md:81`(`code:` 예외 각주 추가), `spec/data-flow/8-notifications.md:275-279`(V056 캐비엇 추가)
  - 상세: `plan/in-progress/spec-draft-nullable-notation-followups.md:400-404,436-439`의 두 체크박스가 `[x]` + 포인터로 닫혀 있고, `457-467`에 신규 후속 2건(`Flyway mixed=true` 도입 여부, bare 인용 8건)이 `- [ ]` 형식으로 정확히 등재돼 있음을 확인.
  - 제안: 없음 — 조치 완료 확인.

- **[INFO]** `spec/conventions/migrations.md`의 포인터 문구가 planner draft(§1.6)가 명시한 삽입 문구와 line-level로 일치
  - 위치: `spec/conventions/migrations.md:72-76` vs `plan/complete/spec-draft-migration-rerun-and-citations.md:133-138`
  - 상세: draft가 미리 적어 둔 정확한 삽입 문구와 실제 커밋된 문구가 토씨까지 일치한다.
  - 제안: 없음.

## 요약

애플리케이션 코드 변경은 없으며, 이번 PR은 CONCURRENTLY 인덱스 교체 재실행 안전성 패턴과 리뷰 인용 규약 두 건을 성문화하는 프로세스 문서 변경이다. 이미 6라운드의 코드리뷰·consistency-check를 거쳐 지적된 항목(V056/V106 과일반화, 코드펜스 중첩, 부록 드리프트, `code:` 필드 SoT 미동기화, `swagger.md`와의 표면 겹침, 상호 링크 누락 등)이 최종본에 실제로 반영됐음을 파일 직접 대조로 재확인했고, 문서가 주장하는 정량 수치(107파일/514회 등)와 선례 마이그레이션 파일(V056/V106/V110)의 실제 SQL도 전부 일치했다. 독립적으로 새로 찾은 것은 하나다 — 신설된 "DROP-먼저" 3문장 패턴의 "감수하는 비대칭" 절이 재빌드 비용의 발생 조건을 "성공한 마이그레이션의 수동 재실행"으로만 한정하는데, 실제로는 CREATE 성공 후 마지막 DROP이 실패해 마이그레이션 자체가 실패하는 경우(이 저장소가 이미 문서화한 `repair`+재실행 정상 복구 절차 안)에도 동일한 재빌드가 발생한다. 최종 데이터 상태는 두 경우 모두 정확하므로 CRITICAL은 아니지만, "정상 흐름에서는 발생하지 않는다"는 문장은 정정할 가치가 있는 WARNING이다.

## 위험도
LOW
