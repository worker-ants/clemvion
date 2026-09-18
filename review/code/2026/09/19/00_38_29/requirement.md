# 요구사항(Requirement) 충족 리뷰 — 웹훅 `endpoint_path` 전역 유일 (V131/V132)

## 발견사항

- **[INFO]** plan tracker 가 아직 생성되지 않은 `plan/complete/` 경로를 참조 (dangling — 계획된 마지막 단계이므로 실질적 결함 아님)
  - 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md:4632` (게이트 라인 4632, "**2026-09-19 해소** `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md`" 문구)
  - 상세: 트래커 항목이 `plan/complete/spec-draft-webhook-endpoint-path-global-unique.md` 를 가리키는데, 실제로 이 문서는 현재도 `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` 에 있다(`find plan -iname` 확인, `complete/` 에 동명 파일 없음). 다만 그 draft 자신의 체크리스트(`## 체크리스트`, 미확정 상태의 uncommitted 수정분)가 "`/ai-review` → `--impl-done` → 트래커 반영 · `complete/` 이동(마지막 커밋)" 순서를 이미 명시하고 있어, 이 리뷰 시점(=`/ai-review` 단계) 기준으로는 아직 이동 전인 것이 **의도된 순서**다. 다음 커밋에서 실제로 이동하지 않으면 이 참조는 영구히 깨진 링크로 남는다.
  - 제안: `--impl-done` 통과 후 draft 를 `plan/complete/`로 이동하는 마지막 단계를 빠뜨리지 말 것. 이동 후 `grep -rln "plan/complete/spec-draft-webhook-endpoint-path-global-unique.md" spec codebase` 로 인용 전부가 실재 경로를 가리키는지 재확인(체크리스트에 이미 명시돼 있음).

- **[INFO]** V131 dedupe 가 chat-channel provider 재등록을 SQL 로는 수행할 수 없어 애플리케이션 계층 불변식(15-chat-channel R-CC-21/CCH-AD-02 — endpointPath 변경 시 `setupChannel` 재호출)을 우회한다 — 검토 완료, 코드 결함 아님
  - 위치: `codebase/backend/migrations/V131__trigger_endpoint_path_dedupe.sql` 40~47행 (NOTICE + `n_chat` 카운트)
  - 상세: 1차 consistency 라운드(`review/consistency/2026/09/18/23_39_46/cross_spec.md` WARNING)가 지적한 그 지점이다. 최종적으로 "SQL 이 provider API 를 부를 수 없다 → NOTICE(`chat_channel=true`) + 운영 절차(소유자가 채널 설정을 다시 저장 → `setupChannel` 재등록)"로 명시적 결정이 내려졌고, `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` "비대상" 절과 V132 헤더 "운영 절차 ②"에 문서화됐으며, 3차 라운드(`review/consistency/2026/09/19/00_07_54`)에서 BLOCK:NO 로 해소 확인됨. 자동화된 provider 재등록 코드는 없으므로 **배포 운영자가 수동으로 후속 조치를 빠뜨리면 채팅 채널이 조용히 끊긴다**는 잔여 위험은 존재하지만, 이는 이미 검토·기록된 트레이드오프이지 이번 diff 의 누락이 아니다.
  - 제안: 조치 불요(이미 결정·기록됨). 배포 체크리스트에 "V131 NOTICE 의 chat_channel=true 목록 → 소유 워크스페이스 알림" 단계가 실제 운영 런북에도 반영돼 있는지만 배포 전 별도 확인 권장.

## 검증한 항목 (일치 확인, 발견사항 아님)

- **코드 ↔ spec line-level 일치**: `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX = 'idx_trigger_endpoint_path'`(`triggers.service.ts:228`), 에러 응답(`code=RESOURCE_CONFLICT`, `details.field='endpoint_path'`, `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'`, 메시지에 "워크스페이스" 미포함, `triggers.service.ts` `rethrowEndpointPathConflict`)이 `spec/2-navigation/2-trigger-list.md:126,197`, `spec/5-system/3-error-handling.md:238`, `spec/5-system/2-api-convention.md`(유니크 범위=전역), `spec/1-data-model.md:245,927`, `spec/data-flow/10-triggers.md:173,245-260`, `spec/5-system/12-webhook.md:65,512-513`, `spec/7-channel-web-chat/5-admin-console.md` 전부와 정확히 일치한다.
- **마이그레이션 절차 준수**: V132 의 `0) DROP(새 이름) → CREATE(새 이름) → DROP(옛 이름)` CONCURRENTLY 3단 순서와 `.conf executeInTransaction=false` 분리는 `migrations/README.md` §5 "인덱스 교체는 DROP-먼저"(V110 선례)와 형태 일치. V131 이 트랜잭션 DO 블록을 별 파일로 분리한 것도 README §5 "mixed 판정" 실측 근거와 일치.
- **V131 dedupe SQL 논리**: `row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id) WHERE endpoint_path IS NOT NULL` 로 NULL 그룹을 배제하고 그룹당 최초 1건만 보존 — 엣지케이스(전부 유일 → 0건 갱신, NULL 다건 → 파티션 대상 제외) 모두 올바르게 처리. `gen_random_uuid()::text` 는 v4 형식(`^[0-9a-f]{8}-...-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-...$`, `V102/V103` CHECK)을 통과함을 확인. `gen_random_uuid` 는 `V097` 에서 이미 사용 중이라 확장 가용성 문제 없음.
- **e2e B5/B6 신규 테스트**: B5 는 (1) 생성 충돌 (2) PATCH 충돌 (3) 실제 수신이 원 소유자 워크플로로 감을 모두 검증 — "다른 워크스페이스가 알고 있는 경로 등록 시도" 시나리오를 생성·수정 양쪽에서 커버. B6 은 `pg_index`/`pg_class` 로 신 인덱스 `indisvalid`·`indisunique`·`indexdef`(선두 컬럼·partial 조건)까지 대조하고 옛 인덱스 부재를 함께 확인 — README 가 지적하는 "이름만 점유한 invalid 잔재" 케이스까지 잡는 설계. 헬퍼(`createWebhookTrigger`, `registerAndLogin`, `createTeamWorkspace`, `uniqueName/uniqueEmail`)는 기존 파일에 이미 정의돼 있어 참조 유효.
- **단위 테스트**: `triggers.service.spec.ts` 가 인덱스명 상수를 새 값(`idx_trigger_endpoint_path`)으로 갱신하고, 메시지가 "워크스페이스"를 포함하지 않음을 별도로 단언하며, 옛 인덱스명(`idx_trigger_workspace_endpoint`)이 더는 좁히지 않음(→ `false`)을 왕복 검증 — "이름이 바뀌면 조용히 통과시킨다"는 함수 주석의 안전 방향과 정확히 일치.
- **TODO/FIXME/HACK**: 신규·변경 코드 어디에도 미완성을 시사하는 주석 없음.
- **spec drift 이력**: 1·2차 `--spec` consistency 라운드가 지적한 Critical 4건(chat-channel 재등록 우회 · data-flow Rationale 절 누락 · error-handling 카탈로그 행 누락 · api-convention §12.2 미반영)·WARNING 2건은 모두 3차 라운드(BLOCK:NO) 전에 실측 근거와 함께 해소됐고, 현재 `spec/` 상태로 직접 확인해도 반영돼 있다 — 리뷰 시점 기준 spec drift 잔여 없음.
- **인덱스/마이그레이션 번호 충돌 없음**: `V131`/`V132`, `idx_trigger_endpoint_path` 전수 grep 결과 기존 마이그레이션·다른 in-progress plan 과 충돌 없음(기존 최신 `V130`).

## 요약

웹훅 `endpoint_path` 전역 유일화(V131 dedupe + V132 UNIQUE 교체)는 기능적으로 완결돼 있다 — 컨트롤러 Swagger 설명, 서비스의 인덱스명 상수·충돌 메시지·에러 코드, 단위 테스트(양방향 인덱스명 판별), e2e 신규 테스트(B5 교차 워크스페이스 충돌+라우팅 검증, B6 스키마 검증) 가 모두 spec(`1-data-model.md`, `12-webhook.md`, `2-trigger-list.md`, `3-error-handling.md`, `data-flow/10-triggers.md`, `2-api-convention.md`, `7-channel-web-chat/5-admin-console.md`)과 line-level 로 정확히 일치하며, 마이그레이션 절차도 README §5 선례를 그대로 따른다. 1·2차 consistency 라운드가 찾은 spec 누락(Critical 4건)은 최종 커밋 전에 이미 해소됐다. 유일하게 남는 것은 (a) 이 draft 를 `plan/complete/`로 옮기는 마지막 체크리스트 단계가 아직 실행되지 않아 트래커의 forward-reference 가 일시적으로 dangling 상태라는 점(이미 계획된 순서), (b) chat-channel provider 재등록을 SQL 이 대신할 수 없어 운영 절차(NOTICE + 수동 재저장)에 의존한다는, 이미 검토·기록된 트레이드오프뿐이다. 둘 다 코드 결함이 아니라 프로세스/운영 후속 사항이다.

## 위험도

NONE
