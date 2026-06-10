# RESOLUTION — 17_09_35

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| Critical #1 | 코드 (기존 구현) | 59231fd7 (기존) | `syncScheduleActivation()` 이미 구현 — 리뷰어가 spec 갭 표기 기준으로 오탐. spec draft 위임 |
| Critical #2 | 코드 (기존 구현) | 59231fd7 (기존) | `remove()` 내 `removeJob` 이미 구현 — 동일 오탐. spec draft 위임 |
| Critical #3 | 보안 / sensitive-fix 가드 | (자동 수정 불가) | `promoteRotatedNotificationSecrets` 의 `secretRef` 잔존 버그 실재 확인. 인증 흐름 변경 위험 — 사용자 결정 필요 |
| Warning #1 | 보안 / sensitive-fix 가드 | (자동 수정 불가) | `endpoint_path` UUID 서버 강제 — API 계약 변경. spec 이 현재 "서버 미강제"를 명시. 변경 시 사용자 결정 필요 |
| Warning #2 | 보안 / already-tracked | (기존 plan) | `rateLimitPerMinute` CCH-NF-03 — `plan/in-progress/spec-sync-chat-channel-gaps.md` 이미 추적 중 |
| Warning #3 | 코드 (기존 구현) | 59231fd7 (기존) | Critical #1 과 동일 — 이미 해소 |
| Warning #4 | 데이터 정합성 / sensitive-fix 가드 | (자동 수정 불가) | `llm_config_workspace_default_unique` DB migration 누락 — DB migration 자동 생성 금지. 사용자 결정 필요 |
| Warning #5 | 코드 | 639be831 (신규) | AI 노드 핸들러 3종 `LlmCallContext` 전달 추가 — attribution NULL 갭 해소 |
| Warning #6 | spec / SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-sse-single-instance-rationale.md` |
| Warning #7 | 아키텍처 / user-decision | (plan 등록 필요) | `WorkspaceInvitationsService.pruneExpired` 스케줄러 연결 — 설계 결정 필요. `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` 에 항목 추가 권장 |
| Warning #8 | 문서화 / SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-gap-callout-plan-links.md` |
| Warning #9 | 유지보수성 / SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-doc-style.md` |
| Warning #10 | 유지보수성 / SPEC-DRIFT | (draft 위임) | `plan/in-progress/spec-update-doc-style.md` (W9 와 동일 draft) |

## TEST 결과

- lint  : 통과
- unit  : 통과 (6418 passed, 1 skipped)
- e2e   : 통과 (179/179)

## 보류·후속 항목

### ESCALATE — 사용자 결정 필요

**Critical #3 — `promoteRotatedNotificationSecrets` secretRef 우선순위 버그 (민감 변경)**

실재 확인됨. `promoteRotatedNotificationSecrets()` 가 `signing` 객체를 spread 하면서 기존 `secretRef` 를 제거하지 않고 `secret: secretV2` 를 추가한다. `resolveSigningSecret()` 은 `secretRef` 우선 → 승격 후에도 구 secret 으로 서명 지속. Secret rotation 목적 달성 불가.

spec `15-external-interaction.md` Rationale §1.5 에 이미 "코드 주석·시스템 spec 의 의도와 실제 코드가 갈라진 지점" 으로 명시되어 있어, 인지된 기존 갭임.

수정 방법 (둘 중 하나):
1. `promoteRotatedNotificationSecrets` 완료 시 `updatedSigning` 에서 `secretRef` 키 제거 + 신 secret 을 `secrets.rotate(ref, ...)` 로 store 에 저장 후 `secretRef` 만 남기기
2. `resolveSigningSecret` 우선순위 로직 수정 — `secret(평문)` 이 있으면 `secretRef` 보다 우선 (단, secret store 설계 원칙과 충돌 가능)

옵션 1 이 clean. 그러나 secret store 저장 + secretRef 재설정 로직 추가 필요 — 인증 흐름이므로 사용자 승인 후 진행 권장.

---

**Warning #1 — `endpoint_path` UUID 형식 서버 강제 (API 계약 변경)**

spec Rationale 가 "서버는 UUID 형식을 강제하지 않는다" 고 명시 중. `@IsUUID(4)` 를 추가하면 기존 비-UUID 경로를 사용하는 클라이언트가 400 에러를 받게 됨. API 계약 변경 전 마이그레이션 전략 필요.

---

**Warning #4 — `llm_config_workspace_default_unique` partial UNIQUE 인덱스 migration 누락**

entity `@Index` 선언은 있으나 SQL migration 없음. V001 에서 `llm_config` 테이블 생성 시 누락됨. V088 으로 추가 필요하나 기존 DB 에 중복 default 가 있을 경우 migration 실패 가능 — 사전 데이터 검사 + 중복 해소 쿼리 필요. migration 자동 생성 금지 가드 적용.

---

**Warning #7 — `WorkspaceInvitationsService.pruneExpired` BullMQ 스케줄러 미연결**

만료 초대 row 영구 잔존. `login-history-pruner` 패턴으로 스케줄러 연결 필요하나, 스케줄 주기·배치 크기·기회적 purge vs 전용 job 결정이 선행돼야 함. `plan/in-progress/spec-sync-data-flow-12-workspace-gaps.md` 에 항목 추가 권장.

---

### SPEC-DRIFT drafts (project-planner 위임)

1. `plan/in-progress/spec-update-trigger-schedule-sync.md` — C1/C2/W3 갭 표기 해소 (4곳)
2. `plan/in-progress/spec-update-sse-single-instance-rationale.md` — W6 SSE Rationale
3. `plan/in-progress/spec-update-gap-callout-plan-links.md` — W8 plan link 추가
4. `plan/in-progress/spec-update-doc-style.md` — W9/W10 doc style

### INFO 항목 (자동 수정 대상 아님)

- INFO #1~4: 긍정적 발견 — 조치 불필요
- INFO #5: Redis fail-open 명시 여부 — `15-external-interaction §3.1` Rationale 개선 권장
- INFO #6: 비활성 chatChannel inbound 감사 로그 — plan 등록 권장
- INFO #7~15: 각종 spec 명시 개선 — 향후 문서화 작업
- INFO #16~18: spec 문서 가독성 — spec-update-doc-style.md 에서 W9/W10 와 함께 처리 가능
