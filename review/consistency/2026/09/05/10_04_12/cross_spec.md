# Cross-Spec 일관성 검토 — `spec/conventions/migrations.md` · `spec/conventions/review-citations.md`

## 발견사항

- **[WARNING]** `code:` 필드 의미 재해석이 SoT 문서(`spec-impl-evidence.md`)와 동기화되지 않음
  - target 위치: `spec/conventions/review-citations.md` — Rationale
    `### code: 가 "구현 경로" 가 아니라 "준수 예시" 를 가리키는 이유` (commit `1b6ce5f8a`에서 신설)
  - 충돌 대상: `spec/conventions/spec-impl-evidence.md` §2.1 필드 정의 표(`code` = *"본 spec 이 약속한
    surface 의 구현 경로"*) + R-1 Rationale(glob 허용 논의만 있고 "시행 코드 자체가 없는 convention"
    케이스는 다루지 않음)
  - 상세: `review-citations.md` 는 스스로 *"이 규약에는 시행하는 코드가 없다 — 주석 형태를
    강제하는 가드가 없기 때문"* 이라 명시하고, `code:` 를 강제 코드가 아닌 **"규약을 준수하는
    예시 파일"** 로 재정의한다. 반면 `spec/conventions/` 안의 다른 `status: implemented`
    문서들은 전부 실제로 시행/검증하는 코드를 가리킨다 — 예: `migrations.md` 의
    `scripts/check-migration-versions.py`·`codebase/backend/src/migrations.spec.ts`,
    `swagger.md` 의 `codebase/backend/src/repo-guards/__tests__/swagger-dto-contract*.ts`·
    `production-guards.ts`. `review-citations.md` 만 유일하게 "가드 없음"을 전제로 이 필드를
    다른 의미로 쓴다. `spec-code-paths.test.ts` 가드는 경로 존재만 확인하므로 빌드는 통과하지만,
    `spec-impl-evidence.md` 를 SoT 로 참조하는 향후 작성자(또는 `/spec-coverage`)는 "code: =
    강제 코드"라는 전제로 이 파일의 `code:` 를 읽고, `review-citations.md` 의 선례를 모른 채
    상충하는 판단을 할 수 있다.
  - 제안: `spec-impl-evidence.md` §2.1 또는 R-1 에 "시행 코드가 없는 순수 문서형 convention"
    예외 클래스를 한 줄 각주로 추가하고 `review-citations.md` 를 예시로 상호 링크한다(양방향).
    최소한 어느 한쪽에서 "이 재해석은 SoT 문서가 아직 모른다"는 사실이 남지 않게 한다.

- **[WARNING]** 신설 "인덱스 교체는 DROP-먼저" rerun-안전 규약이, 같은 마이그레이션(V056)을
  캐비엇 없이 서술하는 기존 spec 과 상호 링크되지 않음
  - target 위치: `spec/conventions/migrations.md` §5 신규 문단(*"기존 인덱스를 교체하는
    마이그레이션은 재실행 안전성 패턴이 따로 있다"*) → `codebase/backend/migrations/README.md`
    §5 *"인덱스 교체는 DROP-먼저"* (V056 을 "CREATE + DROP — 진짜 교체 → 재실행 시 새 인덱스가
    invalid 인 채 옛 인덱스가 삭제돼 **쓸 수 있는 인덱스가 0개**" 사례로 명시 지목)
  - 충돌 대상: `spec/data-flow/8-notifications.md` (§"...`(user_id, is_read, created_at
    DESC)` 인덱스는 **partial index**...") — *"partial 전환은 `executeInTransaction=false` 로
    `CREATE INDEX CONCURRENTLY ... WHERE dismissed_at IS NULL` 후 옛 인덱스 `DROP INDEX
    CONCURRENTLY` 순서로 적용한다"* (이 서술이 가리키는 실제 마이그레이션 파일은
    `codebase/backend/migrations/V056__notification_active_partial_index.sql` — README.md 신규
    표가 예시로 든 바로 그 V번호)
  - 상세: 두 문서가 **같은 V056 마이그레이션**을 설명하는데, `data-flow/8-notifications.md`
    는 그 순서(CREATE 신규 → DROP 구인덱스)를 캐비엇 없이 정상 절차처럼 서술하고,
    새로 등재된 `migrations.md`/`README.md` §5 는 정확히 그 순서를 "재실행 시 인덱스 0개가
    될 수 있는 위험 사례"로 명시 지목한다. `README.md` 자신도 *"append-only 라... 소급 수정
    대상은 아니"* 라고 밝혀 V056 파일 자체를 고치라는 요구는 아니지만, `data-flow/8-notifications.md`
    쪽은 이 절차를 향후 유사 partial-index 전환의 **본보기**처럼 서술하고 있어, 그 문서만 읽고
    새 마이그레이션을 작성하는 사람은 새 DROP-먼저(0번 문장) 안전장치를 놓칠 수 있다.
  - 제안: `spec/data-flow/8-notifications.md` 해당 문단에 각주 1줄 추가 — "신규 인덱스 교체
    작성 시 `migrations.md` §5 / `README.md` §5 의 DROP-먼저 패턴을 따를 것 (본 문단이 서술하는
    V056 은 그 패턴 도입 이전 파일)". 양방향 링크가 부담스러우면 최소 이 방향만이라도.

- **[INFO]** `review-citations.md` §3 적용 범위 표가 `spec/**` 문서 자체를 다루지 않음
  - target 위치: `spec/conventions/review-citations.md` §3 표
  - 충돌 대상: `spec/5-system/1-auth.md:565`, `spec/data-flow/12-workspace.md:334` — 둘 다
    `review/code/**`·`review/consistency/**` 경로를 이미 인용 중
  - 상세: §3 의 판별 기준은 *"그 인용이 나중에 어떤 맥락에서 읽히는가"* 인데, 표는
    `codebase/**`·`scripts/**`·`.github/**`·DTO JSDoc·`plan/**`·`review/**` 만 다루고
    `spec/**` 문서 자체는 행이 없다. `spec/**` 도 `codebase/**` 와 같은 이유(몇 달 뒤 맥락 없이
    읽힘)로 논리상 "적용" 대상이어야 하는데 표에 빠져 있다. 실측한 2건은 우연히 이미 전체 경로
    형태라 위반은 아니지만, 이 규약 자체가 가드 없는 문서형(위 WARNING#1 참고)이라 향후 `spec/**`
    에 bare 시각이 들어가도 아무 것도 이를 잡아내지 못한다.
  - 제안: §3 표에 `spec/**` 행 추가(적용 / "몇 달 뒤 맥락 없이 읽힌다" — `codebase/**` 와 동일 논리).

## 요약

이번 라운드의 target(`spec/conventions/migrations.md`, `review-citations.md`)는 이전 라운드
(`09_53_09`)에서 지적된 DTO JSDoc 충돌(swagger.md §3)은 정확히 반영되어 재확인 결과 문제없다.
다만 두 가지 새로운 잠재 충돌이 남아 있다 — (1) `review-citations.md` 가 `spec-impl-evidence.md`
가 SoT 로 못박은 `code:` 필드의 의미를 이 저장소에서 유일하게 재해석하면서도 그 SoT 문서를
갱신하지 않았고, (2) `migrations.md`/`README.md` 가 새로 규약화한 인덱스 교체 rerun-안전
패턴이, 같은 V056 마이그레이션을 캐비엇 없이 서술하는 `data-flow/8-notifications.md` 와
상호 링크되지 않아 향후 작성자가 구 패턴을 본보기 삼을 위험이 남는다. 둘 다 빌드를 깨뜨리거나
가드를 우회하지는 않으며 문서 간 상호 참조 추가로 해소 가능한 수준이다.

## 위험도
MEDIUM
