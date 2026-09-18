# Cross-Spec 일관성 검토 — 웹훅 `endpoint_path` 전역 유일 draft

대상: `plan/in-progress/spec-draft-webhook-endpoint-path-global-unique.md` (S1~S6 변경안, `--spec` 모드)

## 발견사항

- **[CRITICAL]** `spec/data-flow/10-triggers.md` 의 전용 Rationale 절이 S6 변경 대상에서 빠졌다 — 변경 후 데이터모델과 정면 모순
  - target 위치: draft S6 `spec/data-flow/10-triggers.md` `trigger` 생성 행
  - 충돌 대상: `spec/data-flow/10-triggers.md` `## Rationale` → `### Webhook \`endpoint_path\` 의 UNIQUE 범위` (245~255행, S6 은 언급하지 않음)
  - 상세: S6 은 "trigger 생성" 표 행(173행) 하나만 고친다. 그런데 같은 파일 Rationale 에 별도 서술 절이 있고, 그 절은 다음을 명문화한다 — "`(workspace_id, endpoint_path)` 가 UNIQUE 이므로 워크스페이스 스코프 안에서는 경로가 유일하다", "충돌 회피는 `endpoint_path` 를 UUID 로 자동 발급(WH-MG-02)해 **사실상 전역 고유**로 만드는 방식에 의존한다". 이 문장은 정확히 draft 의 «무엇이 문제였나» 절이 반증한 전제(고엔트로피는 추측을 막을 뿐 복사는 막지 못한다)를 그대로 담고 있다. S1~S6 어디에도 이 절이 대상으로 올라 있지 않으므로, draft 를 그대로 반영하면 같은 spec 세트 안에서 `1-data-model.md`(§3·Rationale 새 절)는 "전역 UNIQUE" 라 하고 `data-flow/10-triggers.md` 의 이 절은 여전히 "워크스페이스 단위 UNIQUE + UUID 로 사실상 전역 고유 확보"라고 **정면으로 모순**되는 상태로 남는다. 절 제목("UNIQUE 범위")부터 서술 전체가 사후에 거짓이 된다. 이 파일은 draft 의 `spec_impact` 목록에 이미 올라 있고 S6 이 "다뤘다"고 주장하는 바로 그 파일이라, 누락이 우연한 다른-영역 문제가 아니라 이 변경 자체의 완결성 문제다.
  - 제안: S6 에 이 Rationale 절 전체 갱신 항목을 추가한다 — 최소한 (a) 첫 문장을 "`(endpoint_path)` 가 전역 UNIQUE(V132)" 로, (b) "UUID 로 사실상 전역 고유를 확보한다" 는 의존 서술을 철회하고 12-webhook.md WH-SC-01 에 추가하는 문구와 같은 논지(추측 방지 ≠ 복사 방지, 전역 UNIQUE 가 복사를 막는다)로 교체, (c) `1-data-model.md` Rationale 새 절로 forward-reference.

- **[WARNING]** `spec/5-system/3-error-handling.md` 의 에러 카탈로그 표 행이 S5 대상에서 빠졌다
  - target 위치: draft S5 `spec/5-system/3-error-handling.md` "한 곳" 치환
  - 충돌 대상: `spec/5-system/3-error-handling.md` §1.10 `TRIGGER_ENDPOINT_PATH_CONFLICT` 테이블 행 (238행)
  - 상세: S5 는 234행 문단의 리터럴 문자열 "`(workspace_id, endpoint_path)` UNIQUE 제약" 만 "`(endpoint_path)` UNIQUE 제약(전역)" 으로 치환한다(실측: 파일 안에서 이 리터럴 문자열은 234행에 딱 한 번뿐이라 "한 곳" 서술은 정확하다). 그런데 바로 아래 카탈로그 표 행(238행)은 별도 문구로 "동일 워크스페이스에 같은 `endpointPath` 를 쓰는 트리거가 이미 존재"라고 적혀 있다 — S5 의 치환 규칙이 잡는 리터럴과 형태가 달라 이 행은 건드려지지 않는다. 이 표 행이 말하는 스코프("동일 워크스페이스에서만 충돌")는 이번 보안 수정이 뒤집는 바로 그 전제이므로, 변경 후에도 공용 에러 카탈로그가 옛 스코프를 계속 주장해 `1-data-model.md`/`12-webhook.md` 의 새 서술과 모순된다. (참고: 동일 문구가 `triggers.controller.ts` 의 두 `@ApiConflictResponse` 설명에도 있는데, 그쪽은 draft "구현" 절이 "409 설명 두 곳" 정정으로 이미 다루므로 코드 쪽은 커버되어 있다 — 누락은 이 spec 표 행뿐이다.)
  - 제안: S5 에 이 표 행 갱신을 추가 — "동일 워크스페이스에" → "다른 워크스페이스의 트리거를 포함해" 또는 동등한 전역 스코프 문구로.

- **[WARNING]** V131 dedupe 마이그레이션이 chat-channel `setupChannel` 재등록 불변식을 우회한다
  - target 위치: draft "구현" 절 V131 서술 + "비대상" 표
  - 충돌 대상: `spec/5-system/15-chat-channel.md` §5.4.1 인근("«chatChannel 이 실린 PATCH 에서 setupChannel 을 아예 안 부른다»" 대안을 기각하며 "**endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다**"고 명시 — 즉 `endpointPath` 변경은 반드시 provider 재등록을 동반해야 한다는 불변식), `codebase/backend/src/modules/triggers/triggers.service.ts` 의 `rotateBotToken`/`setupChannel` 호출부(콜백 URL 이 `trigger.endpointPath` 에서 유도됨)
  - 상세: V131 은 순수 SQL(`DO $$ … UPDATE trigger SET endpoint_path = gen_random_uuid()::text … $$`)로 중복 묶음의 "나머지" 행을 고친다. 이 갱신은 `TriggersService.update()`/`rotateBotToken()` 경로를 전혀 타지 않는다. 만약 dedupe 로 경로가 바뀌는 쪽(나중에 등록해 복사한 쪽)이 `config.chatChannel` 이 설정된 Telegram/Slack/Discord 트리거라면, 외부 provider 쪽 webhook 등록(callback URL)은 옛 `endpoint_path` 를 계속 가리키는데 DB 는 새 경로로 바뀌므로 그 채널은 마이그레이션 직후 **조용히 끊긴다** — 15-chat-channel.md 가 못박은 "endpointPath 가 바뀌면 setupChannel 재호출이 뒤따라야 한다"는 불변식을 위반한다. draft 의 "비대상" 표에는 인증 webhook 케이스만 있고 chat-channel 타입 dupe 는 검토되지 않았다. (판정할 것 §3 이 명시적으로 "채팅 채널 등록과의 충돌"을 물었던 지점이다.)
  - 제안: (a) V131 실행 전 dedupe 대상 중 `config->>'chatChannel'` 이 있는 행이 있는지 확인하는 절차를 마이그레이션 또는 배포 노트에 추가하고, 있다면 "수동 `setupChannel`/`rotateBotToken` 재실행 필요"를 NOTICE 나 별도 트래커 항목으로 등재하거나, (b) 최소한 draft "비대상"/"트래커 반영" 절에 이 갭을 명시적으로 적어 후속 결정을 남긴다.

## 검증해 확인한 항목 (충돌 없음)

- S1(§2.8 필드 표), S2(§3 인덱스 전략 Trigger 행)의 원문 대체 대상은 `1-data-model.md` 245행·927행과 문자 그대로 일치.
- S3 의 삽입 앵커("28개 밖에서 같은 모양으로 찾은 웹훅 트리거 조회…") 는 `1-data-model.md` 1036~1037행과 정확히 일치.
- S4 의 두 삽입 앵커(WH-SC-01 행 끝, «endpointPath 가변성» 절 마지막 불릿) 는 `12-webhook.md` 65행·512행과 정확히 일치. 새로 추가하는 문구("고엔트로피는 추측만 막는다")는 같은 절의 squatting 전제 문장을 취소하지 않고 보완하므로 자기 파일 안에서는 모순이 없다.
- S5 의 `2-trigger-list.md` "두 곳"은 126행·197행과 정확히 일치(파일 전체에서 리터럴 `(workspace_id, endpoint_path) UNIQUE` 는 이 둘뿐).
- `idx_trigger_endpoint_path` · `V131` · `V132` · Rationale 절 제목 "Webhook `endpoint_path` 전역 유일" 은 `spec/**`·`codebase/backend/migrations/**`·`codebase/backend/src/modules/triggers/**` 어디에도 기존 사용례가 없어 이름 충돌 없음.
- V132 의 0)DROP→CREATE→DROP 순서는 README §5 "인덱스 교체는 DROP-먼저" 규약 및 선례 V110(`idx_schedule_workspace_next_run`)과 형태가 일치.
- 세 조회 지점(`hooks.service.ts`·`public-webhook-throttle.guard.ts`·`embed-config.service.ts`)이 모두 `findOne({ endpointPath, type: 'webhook' })` 형태로 workspace 필터 없이 조회한다는 draft 의 근거 서술은 코드와 일치.
- 기존 중복 정리 정책(가장 먼저 만든 쪽 유지·나머지 새 UUID·경로 비로그)은 12-webhook.md 의 "endpointPath 는 mutable" 결정과 충돌하지 않는다(웹훅 경로는 원래도 변경 가능하다고 이미 명문화돼 있음).

## 요약

핵심 결정(유일성 범위를 워크스페이스→전역으로, V131/V132 두 마이그레이션 분리)은 기존 spec·컨벤션과 잘 정합하고, S1·S2·S3·S4 의 삽입 위치는 실제 원문과 문자 단위로 일치해 신뢰할 수 있다. 그러나 변경 대상 목록(S1~S6)이 **완결적이지 않다** — `spec_impact` 에 올라 있는 `data-flow/10-triggers.md` 자체에 이번 결정을 정면으로 반박하는 전용 Rationale 절이 있는데 S6 이 그 절을 건드리지 않고, `error-handling.md` 의 카탈로그 표 행도 옛 스코프("동일 워크스페이스")를 그대로 남긴다. 두 문서 모두 이 변경의 "공용 SoT" 로 참조되는 위치라 이대로 병합하면 같은 PR 안에서 새 spec 과 옛 spec 이 같은 사실(어느 UNIQUE 가 `endpoint_path` 를 지배하는가)을 서로 다르게 말하게 된다. 추가로, dedupe 마이그레이션이 애플리케이션 계층의 chat-channel 재등록 불변식을 우회하는 시나리오(복사한 쪽이 chat-channel 트리거인 경우)는 draft 의 "비대상" 검토에서 빠져 있다.

## 위험도

HIGH
