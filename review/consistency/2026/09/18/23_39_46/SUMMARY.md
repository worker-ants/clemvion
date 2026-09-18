# Consistency Check 통합 보고서

**BLOCK: YES** — Critical 2건 발견 (V131 마이그레이션의 chat-channel 재등록 우회, `data-flow/10-triggers.md` Rationale 절 스코프 누락)

## 전체 위험도
**CRITICAL** — 핵심 설계 결정(유일성 범위 워크스페이스→전역)은 근거가 탄탄하지만, 실행 메커니즘(V131 DB 직접 dedupe)이 기존 chat-channel 불변식(R-CC-21)을 우회하고, `spec_impact` 로 선언한 `data-flow/10-triggers.md` 안에 이번 결정이 반증한 전제가 그대로 남는 두 지점이 병합 전 반드시 처분돼야 한다.

## Critical 위배 (BLOCK 사유)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | rationale_continuity (CRITICAL) / cross_spec (동일 사안 WARNING로도 지적 → 상향 유지) | V131 dedupe 마이그레이션이 `TriggersService.update()`/`setupChannel()` 애플리케이션 계층을 우회해 DB 에서 직접 `endpoint_path` 를 바꾼다. 중복 묶음 중 "나중에 만든(loser)" 쪽이 chat-channel 트리거(`config.chatChannel` 존재)면, DB 는 새 UUID 로 바뀌지만 Telegram/Slack/Discord 에 등록된 webhook URL 은 옛 경로 그대로 남아 마이그레이션 직후 그 채널이 조용히 끊기고, 옛 경로는 이제 "먼저 만든(winner)" 쪽이 전역 UNIQUE 로 단독 소유해 외부 provider 트래픽이 엉뚱한 워크플로로 샌다 — 이 draft 가 고치려는 것과 같은 클래스의 결함이 반대 방향으로 재발한다. | draft 「구현」V131 서술 + 「비대상」표 | `spec/5-system/15-chat-channel.md` `## Rationale` → `### R-CC-21` 「telegram carve-out 을 정하며 함께 기각한 것」 마지막 항 — "`chatChannel` 이 실린 PATCH 에서 `setupChannel` 을 아예 안 부른다" 를 "endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다" 는 이유로 명시 기각; `CCH-AD-02`(필수) 불변식 | (1) V131 실행 전/후로 `type='webhook' AND config->'chatChannel' IS NOT NULL` 인 loser 행을 추려 developer 턴에서 `setupChannel()` 재호출 후속 스텝 추가(권장), 또는 (2) 최소한 NOTICE 에 `type`·`chatChannel` 존재 여부를 포함하고 「비대상」표에 "chat-channel 트리거 provider 재등록" 갭을 명시 등재, 또는 (3) 이 조합이 실제로 발생할 수 없는 근거를 실측해 S3 Rationale 에 기록 |
| 2 | cross_spec (CRITICAL) / rationale_continuity (동일 사안 WARNING) / convention_compliance (WARNING) / plan_coherence (INFO) → 상향 유지 | `spec/data-flow/10-triggers.md` 의 전용 Rationale 절 `### Webhook endpoint_path 의 UNIQUE 범위`(245~255행)가 S6 변경 대상에서 빠졌다. S6 은 같은 파일의 "trigger 생성" 표 행(173행)만 고치는데, 245행 절은 "`(workspace_id, endpoint_path)` 가 UNIQUE 이므로 워크스페이스 스코프 안에서는 유일" · "UUID 자동 발급으로 사실상 전역 고유를 확보" 라는, draft 의 「무엇이 문제였나」가 정면으로 반증한 전제를 그대로 서술한다. 이 파일은 draft `spec_impact` 에 이미 올라 있고 S6 이 "다뤘다"고 주장하는 그 파일이라 완결성 결함이다. | draft S6 `spec/data-flow/10-triggers.md` `trigger` 생성 행 | `spec/data-flow/10-triggers.md` `## Rationale` → `### Webhook endpoint_path 의 UNIQUE 범위` (245~255행) | S6 에 이 Rationale 절 갱신 항목 추가 — (a) 첫 문장을 "`(endpoint_path)` 가 전역 UNIQUE(V132)" 로, (b) "UUID 로 사실상 전역 고유 확보" 의존 서술 철회 후 12-webhook.md WH-SC-01 과 같은 논지(추측 방지 ≠ 복사 방지)로 교체, (c) `1-data-model.md` 새 Rationale 절로 forward-reference. 저장소 선례(`2-trigger-list.md` `### R-2` 취소선+"정정(날짜)"+링크) 형식을 따를 것 |

## planner 인계 (권한 밖 Critical)

(없음) — 이 draft 는 `project-planner` 가 `spec/` 반영 직전 수행한 `--spec` 모드 자체 검토 산출물이며, 두 Critical 모두 draft 작성자(호출자) 권한 안에서 수정 가능한 draft 내용 보강이다. developer 턴에서 발견된 spec drift 가 아니므로 인계 대상 없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| 1 | cross_spec / plan_coherence (INFO) / naming_collision (INFO, 실행 정확성 관점 병기) | `spec/5-system/3-error-handling.md` §1.10 에러 카탈로그 표 행(238행) "동일 워크스페이스에 같은 endpointPath 를 쓰는 트리거가 이미 존재" 문구가 S5 의 리터럴 문자열 치환 대상(234행 "한 곳")에서 빠진다. 234행과 형태가 달라 S5 규칙이 잡지 못하며, 전역 UNIQUE 적용 후에도 옛 스코프("동일 워크스페이스")를 계속 주장해 `1-data-model.md`/`12-webhook.md` 새 서술과 모순. (`triggers.controller.ts` 의 동일 문구 두 곳은 draft "구현" 절이 이미 커버 — 코드 쪽은 정상.) | draft S5 `spec/5-system/3-error-handling.md` "한 곳" 치환 | `spec/5-system/3-error-handling.md` 238행 카탈로그 표 (`TRIGGER_ENDPOINT_PATH_CONFLICT`) | S5 범위에 238행 포함 — "동일 워크스페이스에" → "다른 워크스페이스의 트리거를 포함해" 또는 동등 전역 스코프 문구로 교체 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| 1 | naming_collision | 신규 마이그레이션 번호 V131·V132, 인덱스명 `idx_trigger_endpoint_path` 전수 grep 결과 기존 사용처·다른 in-progress plan 과 충돌 없음 (최신 기존 파일 V130) | `codebase/backend/migrations/`, `plan/in-progress/**` | 없음 — 그대로 진행 가능 |
| 2 | naming_collision | 삭제 대상 `idx_trigger_workspace_endpoint`, 상수 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX`, 에러 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 신규 식별자가 아니라 기존 식별자의 값/의미 재배선 — "신규 식별자 vs 기존 다른 의미" 충돌 정의 밖 | `triggers.service.ts:224`, `spec/5-system/3-error-handling.md`, `spec/2-navigation/2-trigger-list.md` | 없음 (위 WARNING #1 로 실행 정확성 측면은 이미 반영) |
| 3 | convention_compliance | `codebase/backend/migrations/README.md` "UNIQUE 제약 = `ADD CONSTRAINT ... USING INDEX`" 일반 문구와 V132(`CREATE UNIQUE INDEX` 단독, named constraint 아님)의 표면적 불일치 — 기존 전례(V002·V005·V013 등) 전부 같은 패턴이라 이 draft 책임 아닌 기존 drift | `codebase/backend/migrations/README.md`, V132 | 없음 — draft 는 README §5 "인덱스 교체는 DROP-먼저"(V110 선례)를 정확히 따름 |
| 4 | convention_compliance | 마이그레이션 명명(V131/V132 단조 증가·snake_case)·에러 코드 UPPER_SNAKE_CASE·swagger `@ApiConflictResponse` 갱신 대상·plan frontmatter/`spec_impact` 스키마 모두 정식 규약과 정확히 일치 확인 | draft 전반 | 없음 |
| 5 | plan_coherence | 트래커 원 항목(`spec-draft-nullable-notation-followups.md`)이 열어 둔 두 선택지(전역 UNIQUE vs 비유일 보조 인덱스) 중 draft 가 근거(재현 실증)와 함께 전자를 명시적으로 선택 — 미해결 결정 우회 아님. 실측값 재정정(W=10,000 VACUUM 전/후)도 원문과 일치 | draft 전체, 트래커 대조 | 없음 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| cross_spec | HIGH | `data-flow/10-triggers.md` Rationale 절 누락(CRITICAL), `error-handling.md` 카탈로그 행 누락(WARNING), V131 chat-channel 우회(WARNING) |
| rationale_continuity | CRITICAL | V131 이 `15-chat-channel.md` R-CC-21 명시 기각 대안과 동일 결과 재생산(CRITICAL), `10-triggers.md` 옛 전제 잔존(WARNING) |
| convention_compliance | LOW | 정식 규약(migrations/error-codes/swagger) 전부 준수, `spec_impact` 스코프 완결성만 보강 필요(본문에선 INFO/WARNING 경계로 보고했으나 통합본에서는 위 Critical #2 로 상향 반영) |
| plan_coherence | LOW | 트래커 정합·다른 in-progress plan 충돌 없음 확인, 자기-완결성 인접 누락 2건은 INFO |
| naming_collision | NONE | 신규 식별자 전수 미충돌 확인 |

## 권장 조치사항
1. (BLOCK 해소 최우선) V131 dedupe 대상 중 chat-channel 트리거(`config.chatChannel` 존재) 존재 여부를 확인하는 절차를 마이그레이션/배포 노트에 추가하고, 발견 시 `setupChannel()` 수동 재호출 스텝을 후속 작업으로 명시 등재 (또는 이 조합이 불가능함을 실측 근거로 S3 Rationale 에 기록).
2. (BLOCK 해소) S6 을 `spec/data-flow/10-triggers.md` `### Webhook endpoint_path 의 UNIQUE 범위` 절까지 확장하거나 S7 신설 — 반증된 전제 문장을 정정하고 `1-data-model.md` 새 Rationale 절로 forward-reference.
3. S5 범위에 `spec/5-system/3-error-handling.md` 238행 카탈로그 표 행도 포함 — "동일 워크스페이스에" 문구를 전역 스코프로 정정.
4. 위 세 항목 반영 후 draft 를 재검토(가능하면 좁은 재실행)해 Critical 해소를 확인한 뒤 `spec/` 반영 진행.
