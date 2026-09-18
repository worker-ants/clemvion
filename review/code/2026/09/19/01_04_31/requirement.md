# 요구사항(Requirement) 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131/V132)

## 발견사항

- **[INFO]** 이미 커밋된 소스가 아직 존재하지 않는 `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 경로를 SoT 로 인용한다
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql:4`, `codebase/backend/migrations/V132__trigger_endpoint_path_global_unique.sql:5`, `codebase/backend/test/trigger-endpoint-path-dedupe.e2e-spec.ts:20`, `spec/1-data-model.md:1017`
  - 상세: 네 곳 모두 `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 를 근거 문서로 가리키는데, 실제로 그 문서는 아직 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 에 있다(`git status` 상으로도 uncommitted 수정 상태). 다만 이 draft 자신의 체크리스트(`plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 하단 `## 체크리스트`)가 "`/ai-review` → `--impl-done` → 트래커 반영·`complete/` 이동(마지막 커밋)" 순서를 명시적으로 예고해 뒀고, 이동 뒤 `grep -rln "plan/complete/…" spec codebase` 로 인용 전부가 실재 경로를 가리키는지 재확인하는 절차까지 스스로 적어 뒀다 — 즉 이 시점의 dangling 참조는 이 작업 자체가 예고한 미완료 단계이지 새로 발견된 실수가 아니다. 저장소 관행상(`V120`~`V130` 마이그레이션이 전부 이 패턴을 쓰고 실제로 `plan/complete/`로 이동됐음을 확인) 정상적인 워크플로다. 기능적 영향은 없다(SQL 주석일 뿐 실행 로직과 무관).
  - 제안: `--impl-done` 이후 draft 를 `plan/complete/`로 옮기고 draft 자신이 적어 둔 grep 검증을 실제로 수행할 것 — 지금 당장 코드를 고칠 필요는 없음.

- **[INFO]** `TriggersService.findByEndpointPath(workspaceId, endpointPath)` 가 워크스페이스 스코프 시그니처를 그대로 유지
  - 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` (파일 끝, `findByEndpointPath`)
  - 상세: `endpoint_path` 유일성이 전역이 된 뒤에도 이 메서드는 `where: { workspaceId, endpointPath }` 로 워크스페이스까지 함께 건다. 다만 `grep` 결과 이 메서드는 서비스/컨트롤러/테스트 어디에서도 호출되지 않는 dead code이고, 이번 diff 가 건드린 범위 밖(신규 추가/변경 아님)이라 이번 변경의 결함은 아니다.
  - 제안: 실사용처가 생기기 전까지는 조치 불요. 재사용하게 되면 전역 유일 전제와 맞는지(단순 `findOne({ endpointPath })`) 재검토 권장.

## 기능/엣지케이스/spec 정합성 확인 (문제 없음 — 근거만 기록)

- **V131 dedupe 로직**: `row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id)` 로 "가장 먼저 생성 · 동률이면 id" 타이브레이크가 정확히 구현됐고, `e2e-spec.ts`(`trigger-endpoint-path-dedupe.e2e-spec.ts`)가 셋 묶음(P: 원본·복사·채팅채널복사)·둘 묶음(Q: `created_at` 동률, id 로 승부)·무중복(R)·경로없음(noPath) 네 케이스를 모두 스키마 사본(`LIKE public.trigger INCLUDING DEFAULTS INCLUDING CONSTRAINTS`) 위에서 실제 PostgreSQL 로 검증한다. `config JSONB NOT NULL DEFAULT '{}'` (V001) 이라 `config ? 'chatChannel'` 이 NULL 걱정 없이 항상 boolean 을 반환하는 것도 확인. `gen_random_uuid()::text` 는 V102/V103 의 `chk_trigger_endpoint_path_uuid` v4 CHECK 를 결정적으로 통과한다(정규식 대조 확인). 멱등성(재실행 0건)·NOTICE 형식(경로 비노출, `chat_channel=t` 표시, 합계 줄)까지 e2e 로 단언됨.
- **V132 인덱스 교체**: README §5 "인덱스 교체는 DROP-먼저"(0) DROP 새이름 → CREATE 새이름 → DROP 옛이름) 정확히 준수, 선례(V110)와 형태 일치. `.conf` `executeInTransaction=false` 도 CONCURRENTLY 요건에 맞게 존재. `webhook-trigger.e2e-spec.ts` B6 테스트가 `pg_index`/`indisvalid`/`pg_get_indexdef` 로 새 인덱스만 남고 옛 인덱스(`idx_trigger_workspace_endpoint`)가 사라졌음을 직접 확인.
- **교차 워크스페이스 충돌 e2e (B5)**: 다른 워크스페이스가 아는 경로로 (1) 생성 시도, (2) PATCH 시도 각각 409 `RESOURCE_CONFLICT`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 를 확인하고, 거부된 PATCH 가 실제로 DB 상태를 바꾸지 않았는지(`ownAfter.rows[0].endpoint_path` 불변)까지 검증하며, 마지막으로 원래 웹훅 URL 로 POST 하면 원래 주인의 워크플로가 실행됨(가로채기가 실제로 막혔음)을 종단 검증한다 — 요구사항(보안 결함 수정)의 핵심 주장을 직접 재현·반증한다.
- **서비스 계층**: `isEndpointPathUniqueViolation`/`rethrowEndpointPathConflict` 상수가 `idx_trigger_endpoint_path` 로 정확히 교체됐고, `create()`(L497)·`update()`(L723) 두 호출부 모두 이 catch 경로를 탄다. 메시지도 "같은 워크스페이스" 문구를 제거해 "다른 트리거가 쓰고 있다"는 워크스페이스 무관 표현으로 정정됐다 — 단위 테스트(`triggers.service.spec.ts`)가 메시지에 "워크스페이스" 문자열이 없음을 직접 단언하고, `idx_trigger_workspace_endpoint`(옛 이름)가 더 이상 좁히지 않음(→ 전역 409 로 fallback)도 신규 케이스로 커버.
- **Swagger/spec 표면**: `triggers.controller.ts` 의 두 `@ApiConflictResponse` 설명이 공용 상수로 통합되고 "다른 워크스페이스의 트리거 포함" 문구로 갱신됐으며, `grep` 결과 백엔드/프론트엔드 어디에도 "동일 워크스페이스에 같은 endpointPath" 잔존 문구가 없다.
- **spec 본문 정합성**: `spec/1-data-model.md`(§3·Rationale), `spec/5-system/12-webhook.md`(WH-SC-01, endpointPath 필드 설명, mutable 절), `spec/2-navigation/2-trigger-list.md`(필드 표·PATCH 계약), `spec/5-system/2-api-convention.md`(§12.2 유니크 범위 표), `spec/5-system/3-error-handling.md`(§1.10 서술+카탈로그 행), `spec/7-channel-web-chat/5-admin-console.md`, `spec/data-flow/10-triggers.md`(sink 표 + "UNIQUE 범위" 절 취소선+정정) 8개 지점이 diff 로 확인한 결과 전부 "전역 UNIQUE(V132)" 로 일관되게 갱신됐다. 4 라운드에 걸친 자체 consistency-check(2026-09-18 23:39 → 2026-09-19 00:16, 첨부된 `review/consistency/**` 산출물)에서 처음 발견된 Critical 4건·WARNING 3건(2-api-convention.md §12.2 미갱신, chat-channel 반증, data-flow/10-triggers.md Rationale 절 누락, error-handling.md 카탈로그 행 누락, admin-console.md 사후정합 누락 등)이 모두 이번 diff 시점 spec 본문에 반영돼 있음을 개별 대조로 확인했다 — 최종 라운드는 BLOCK:NO, Critical/WARNING 0.
- **chat-channel 불변식(R-CC-19 "두 경로" 닫힌 열거)**: V131 은 `chat_channel_health` 컬럼을 전혀 쓰지 않고 NOTICE 로만 chat-channel 트리거를 표시 — SQL 이 provider API 를 부를 수 없어 실제 재등록은 운영 절차(V132 헤더 ②)로 수동 수행하도록 명시적으로 설계됐다. 이는 R-CC-19 의 "degraded 두 경로(CCH-SE-01/CCH-NF-03)" 닫힌 열거를 침해하지 않는 의도적 설계이며, cross-spec 최종 라운드가 이를 "비침해"로 확인했다.

## 요약

V131(중복 정리)·V132(전역 UNIQUE 인덱스 교체) 마이그레이션, `triggers.service.ts`/`triggers.controller.ts` 의 에러 계약·Swagger 갱신, 그리고 관련 8개 spec 문서가 "웹훅 endpoint_path 워크스페이스 간 가로채기" 보안 결함을 일관되게 수정한다. 핵심 로직(타이브레이크·멱등성·NOTICE 비노출·인덱스 교체 순서·409 계약·거부된 PATCH 의 no-op)은 실제 PostgreSQL 을 무는 e2e(신규 `trigger-endpoint-path-dedupe.e2e-spec.ts`, `webhook-trigger.e2e-spec.ts` B5/B6)와 단위 테스트로 직접 검증됐고, spec 본문과 line-level 로 대조한 결과 4라운드 consistency-check 를 거쳐 발견됐던 모든 Critical/WARNING(§12.2 유니크 범위 표, chat-channel 반증, data-flow Rationale 절, 에러 카탈로그 행, admin-console 서술)이 이미 반영돼 있다. 유일하게 남은 것은 마이그레이션·e2e·spec 주석이 아직 `plan/in-progress/`에 있는 draft 를 `plan/complete/` 경로로 인용하는 dangling 참조인데, 이는 draft 자신의 체크리스트가 "마지막 커밋에 이동"으로 예고한 정상적인 미완료 단계이며 기능에는 영향이 없다. TODO/FIXME/HACK 성 미완성 주석은 발견되지 않았다.

## 위험도

LOW
