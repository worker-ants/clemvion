# Cross-Spec 일관성 검토 — `spec/conventions/` (--impl-prep)

## 발견사항

- **[WARNING]** impl-prep 번들 예산이 이번 작업과 무관한 카탈로그로 소진되어, 실제 관련 컨벤션(`migrations.md`)이 한 번도 로드되지 않음
  - target 위치: 조립된 프롬프트(`_prompts/cross_spec.md`) 전체 — `spec/conventions/migrations.md` 섹션(라인 1121~1124)이 `> ⚠️ 본문 생략됨 — 컨텍스트 예산 초과` 로 대체됨. 같은 사유로 `redis-keys.md`·`node-output.md`·`error-codes.md`·`spec-impl-evidence.md` 등 24개 최상위 컨벤션 중 6개(`audit-actions.md`/`cafe24-api-catalog/_overview.md,category.md,store.md,translation.md`/`cafe24-api-metadata.md`)를 뺀 전부와, `cafe24-api-catalog`/`makeshop-api-catalog` 하위 200여 개 field-level 문서 전부가 동일하게 생략됨.
  - 충돌 대상: `plan/in-progress/spec-draft-deletion-cascade-indexes.md` — 이번 impl-prep 이 지키려는 실제 구현 대상(V112~V116 인덱스 마이그레이션 5건 추가)이며, 그 draft 는 `spec/conventions/migrations.md` §5("인덱스를 만드는 마이그레이션은 별도 패턴" — `CREATE INDEX CONCURRENTLY` 앞 `DROP INDEX CONCURRENTLY IF EXISTS` 잔재 정리, `.conf` 페어, `check-migration-versions.py`)를 직접 인용한다.
  - 상세: 번들러가 `spec/conventions/` 디렉토리를 재귀적으로 그러모으는데, Cafe24 Admin API 카탈로그(485 operation 표 + 222개 field-level 문서)가 알파벳/디렉토리 순서상 먼저 걸려 예산 대부분을 잠식했다. Cafe24/Makeshop API 카탈로그는 이번 "삭제 연쇄 FK 인덱스" 작업과 아무 관련이 없는 도메인(전자상거래 통합 API 명세)이라, 정작 대조해야 할 `migrations.md`(V번호 정책·CONCURRENTLY 패턴)는 완전히 탈락했다. 이는 기존에 알려진 "`consistency --spec` 기본 예산이 conventions 를 통째로 떨군다" 문제(과거 세션 기록)가 `--impl-prep` 모드에서도 동일하게 재발한 것이다.
  - 참고 — 본 checker 가 번들 밖에서 `spec/conventions/migrations.md` 를 직접 읽어 별도로 대조한 결과, 계획된 V112~V116 은 현재 main 의 max V(=111, `codebase/backend/migrations/V111__trigger_workflow_id_index.sql`) 기준으로 gap 없이 연속하고, "`CREATE INDEX CONCURRENTLY` 앞에 `DROP INDEX CONCURRENTLY IF EXISTS <새 인덱스 이름>` 을 둔다"는 §5 규약도 draft 의 "구현" 절에 명시되어 있어 위반이 관측되지 않았다. 다만 이는 본 checker 가 예산 밖에서 임의로 보강한 것이고, **이번 자동 실행 자체는 `migrations.md` 를 한 번도 로드하지 못했다** — 우연히 문제가 없었을 뿐, 이번 실행의 BLOCK 판정은 그 파일에 대해 아무것도 검증하지 않은 상태로 내려진다.
  - 제안: 이번 impl-prep 재실행 시 target 스코프를 디렉토리 전체가 아니라 `spec/conventions/migrations.md` (해당 plan 의 `spec_impact`/구현 절이 실제로 참조하는 파일)로 좁혀서 다시 호출할 것. 장기적으로는 번들러가 plan 의 `spec_impact`·최근 diff 대상 파일을 우선순위 상단에 배치하도록 하드닝하는 편이 카탈로그류 대형 디렉토리에 의한 예산 잠식을 구조적으로 막는다.

- **[INFO]** `restricted` 빈칸 사유 각주가 두 컨벤션 문서에서 개수가 다름
  - target 위치: `spec/conventions/cafe24-api-catalog/store.md` §Rationale 상단 각주 — "※ `paymentmethods_list` / `paymentmethods_paymentproviders_list` / `paymentmethods_paymentproviders_update_display` 는 사용자 자료에 명시되지 않아 빈칸 유지."
  - 충돌 대상: `spec/conventions/cafe24-restricted-scopes.md` §Trade-off — "`paymentmethods_list` / `paymentmethods_paymentproviders_list` 는 사용자 자료에 명시되지 않았으므로 빈칸 유지."
  - 상세: `cafe24-restricted-scopes.md` 는 자신을 별도 승인 필요 명단의 "single-source-of-truth"로 선언하는데, store.md 가 restricted 컬럼을 빈칸으로 둔 이유로 드는 3개 operation id 중 `paymentmethods_paymentproviders_update_display` 하나가 SoT 문서의 동일 각주에는 열거되어 있지 않다. 두 문서 모두 결론("현재는 빈칸 유지, 확인되면 갱신")은 같아 기능적 충돌은 아니지만, SoT를 자처하는 문서가 자신이 다루는 항목을 완전히 나열하지 못한 상태다.
  - 제안: `cafe24-restricted-scopes.md` §Trade-off 에 `paymentmethods_paymentproviders_update_display` 를 추가해 두 문서의 열거를 일치시킨다.

## 검증 완료 — 충돌 없음으로 확인된 항목

번들에서 실제로 로드된 부분(`audit-actions.md`, `cafe24-api-catalog/_overview.md`·`category.md`·`store.md`·`translation.md`, `cafe24-api-metadata.md`)을 다음과 대조했으며 모두 일치했다:

- `audit-actions.md` §3 도메인별 레지스트리 ↔ `spec/5-system/1-auth.md` §4.1 "현재 구현된 액션"/"Planned" 표: integration·workspace·member·execution·auth_config·user·workflow·trigger·schedule·model_config 전 항목의 액션명·구현 여부(`workflow.executed`/`workspace.deleted` 제외 포함)가 정확히 일치.
- `audit-actions.md` 트리거 시크릿/토큰 3분할 Rationale ↔ `spec/data-flow/1-audit.md` §1.1 동일 서술(24h grace 유무, `interaction_token_revoked` 만 즉시 무효화) — 일치.
- `cafe24-api-catalog/*` 의 `restricted` 컬럼(`scope`/`operation`) ↔ `spec/conventions/cafe24-restricted-scopes.md` §1·§2 명단, `restrictedApproval.level`/`approvalGroup` 값(`activitylogs`/`menus`/`naverpay_setting`/`kakaopay_setting`/`pg_settings`) ↔ `cafe24-api-metadata.md` §2 정의 — 일치.
- `cafe24-api-catalog/_overview.md` §5 Coverage Matrix 합계(485) ↔ `spec/5-system/11-mcp-client.md` L339 "Cafe24 Admin API 485 operation" 인용 — 합산 검산 결과도 485 로 일치.
- catalog key 형식(`cafe24.<resource>.<operation>`) ↔ `spec/2-navigation/4-integration.md` §9.3/§4.6, `spec/4-nodes/4-integration/_product-overview.md` INT-US-05, `spec/4-nodes/4-integration/4-cafe24.md` — 4곳 모두 동일 형식·동일 책임 분리(backend=key만, frontend dict=i18n SoT).
- MCP 도구 이름 규칙(`mcp_<sid>__<operation.id>`) ↔ `spec/5-system/11-mcp-client.md` §5.2 — 일치.

## 요약

번들에서 실제로 로드된 대상(감사 로그 명명 규약 + Cafe24 API 카탈로그 계열)은 `5-system/1-auth.md`·`data-flow/1-audit.md`·`cafe24-restricted-scopes.md`·`2-navigation/4-integration.md`·`4-nodes/4-integration/4-cafe24.md`·`5-system/11-mcp-client.md` 등 다른 영역과 데이터 모델·API 계약·명명 규약 모두에서 정합했고 CRITICAL 급 모순은 발견되지 않았다(사소한 각주 개수 불일치 1건만 INFO). 다만 이번 `--impl-prep` 실행이 실제로 검증해야 했을 대상은 발견하지 못했다 — 컨텍스트 예산이 무관한 Cafe24 API 카탈로그(수백 개 파일)에서 소진되어, 정작 진행 중인 작업(`plan/in-progress/spec-draft-deletion-cascade-indexes.md` 의 V112~V116 마이그레이션)이 인용하는 `spec/conventions/migrations.md` 는 번들에 한 번도 실리지 못했다. 본 checker 가 번들 밖에서 직접 대조한 결과 그 문서와도 충돌은 없었지만, 이는 이번 자동 실행의 결과가 아니라 별도 확인이다.

## 위험도

LOW — 로드된 범위 내에서는 CRITICAL/WARNING 급 cross-spec 모순 없음. 다만 번들 예산이 실제 관련 문서(`migrations.md`)를 로드하지 못한 커버리지 갭이 있어(WARNING 1건), 동일 스코프를 좁혀 재실행하는 것을 권장한다.
