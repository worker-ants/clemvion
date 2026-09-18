---
title: 웹훅 endpoint_path 전역 유일 — 다른 워크스페이스가 알고 있는 경로를 등록하면 수신 웹훅을 가로챌 수 있었다
status: in-progress
owner: project-planner
worktree: webhook-endpoint-lookup-7a1f3c
started: 2026-09-18
spec_impact:
  - spec/1-data-model.md
  - spec/5-system/12-webhook.md
  - spec/2-navigation/2-trigger-list.md
  - spec/5-system/3-error-handling.md
  - spec/data-flow/10-triggers.md
  - spec/5-system/2-api-convention.md
  - spec/7-channel-web-chat/5-admin-console.md
---

# spec draft — 웹훅 `endpoint_path` 전역 유일

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 «웹훅 트리거 조회가 `endpoint_path` 인덱스 전체를 훑는다»(2026-09-18
등재, `plan/complete/spec-draft-fk-remaining-dispositions.md` «비대상») 를 닫는다. 성능 항목으로 등재했지만 **재 보니 보안 결함이 먼저다**.

## 무엇이 문제였나

웹훅 수신 URL 은 `/api/hooks/:endpointPath` 로 **워크스페이스와 무관한 전역 라우팅 키**다([12-webhook WH-SC-01](../../spec/5-system/12-webhook.md)).
그런데 유일성은 `(workspace_id, endpoint_path)` — **워크스페이스 단위**뿐이었다(V002 `idx_trigger_workspace_endpoint`).

- `endpoint_path` 는 **클라이언트가 만들어 보내고**(`crypto.randomUUID()`, 서버는 v4 형식만 강제 — WH-MG-02) **나중에 바꿀 수 있다**
  (12-webhook «endpointPath 가변성»). 다른 워크스페이스의 경로와 겹치는지는 아무도 검사하지 않는다(`triggers.service.ts` 의 충돌 처리는
  위 UNIQUE 위반만 본다 — 메시지도 «같은 워크스페이스에 …»).
- 수신 조회 셋 — `HooksService.handleWebhook` · `PublicWebhookThrottleGuard` · `EmbedConfigService.resolve` — 은 모두
  `findOne({ endpointPath, type: 'webhook' })` 로 **워크스페이스 없이 · 정렬 없이** 한 행을 고른다.
- 그래서 **경로를 알고 있는 사람**(그 워크스페이스의 뷰어 · 전 멤버 · URL 을 받은 외부 서비스)이 **자기 워크스페이스에 같은 경로로 트리거를
  만들면**, 수신 웹훅이 둘 중 하나로 간다. spec 은 «UUID 의 고엔트로피가 squatting·enumeration 을 막는다» 는 전제만 적었는데
  (12-webhook «endpointPath 가변성»), 고엔트로피는 **추측**을 막을 뿐 **복사**는 막지 못한다.

**재현** (PostgreSQL 18, V001~V130, 옛 스키마): 워크스페이스 id 가 더 작은 워크스페이스가 피해 워크스페이스의 경로를 나중에 복사하자, 수신
조회와 같은 쿼리가 **복사한 쪽을 골랐다**(`routed_to = 복사한 w5 (가로채기)`). 반대 순서에서는 원래 주인을 골랐다 — 어느 쪽이 이길지는
워크스페이스 id 순서가 정한다. 새 스키마(전역 UNIQUE)에서는 같은 복사가 `duplicate key value violates unique constraint
"idx_trigger_endpoint_path"` 로 거부된다.

정상 경로로는 워크스페이스 간 중복이 생기지 않는다 — 워크플로 복제 · 가져오기는 트리거를 옮기지 않는다([data-flow/11-workflow.md](../../spec/data-flow/11-workflow.md)
«복제 범위 밖: `trigger`»), `endpoint_path` 를 쓰는 곳은 `TriggersService` 의 생성 · 수정뿐이다(grep). UUID v4 의 우연 충돌은 무시할 수준이다.
**운영 DB 에 중복이 있다면 복사 등록의 흔적이다.**

## 결정 (2026-09-18 사용자)

1. **유일성 범위를 전역으로** — `(endpoint_path) UNIQUE WHERE endpoint_path IS NOT NULL` 로 V002 의 `(workspace_id, endpoint_path)` UNIQUE
   를 교체한다. (기각: 비유일 보조 인덱스 + 앱 레벨 중복 검사 + 가장 오래된 행 선택 — 마이그레이션 위험은 없지만 동시 요청 경합을 DB 가
   막지 못한다.)
2. **기존 중복은 나중 것을 새 UUID 로** — 경로가 같은 묶음마다 가장 먼저 만든 트리거(`created_at`, 같으면 `id`)만 경로를 유지하고,
   나머지는 `gen_random_uuid()` 로 새 경로를 받는다. 바뀐 트리거는 id · 워크스페이스 id 만 NOTICE 로 남긴다(경로 자체는 비밀 키라 로그에
   남기지 않는다). (기각: 중복이 있으면 마이그레이션을 실패시킨다 — 데이터를 몰래 바꾸지 않지만 배포가 막힌다.)
   **새 경로를 받은 트리거가 채팅 채널**(`config.chatChannel`)이면 provider(Telegram · Slack · Discord)에 등록된 URL 은 옛 경로 그대로다 —
   SQL 은 provider API 를 부를 수 없다. V131 은 그 트리거의 채팅 채널 상태 컬럼을 **건드리지 않고** NOTICE 에 `chat_channel=true` 를 남긴다.
   배포 운영자가 그 목록의 소유 워크스페이스에 알려 채널 설정을 **다시 저장**하게 한다 — 재등록은 정상 경로(다시 저장 → `setupChannel`)로
   일어난다(V132 헤더의 운영 절차, 아래 Rationale «채팅 채널 트리거 — R-CC-21 과의 관계»).

## 실측 (PostgreSQL 18 일회용, V001~V130, 워크스페이스 W 개마다 워크플로 10 · 그 절반의 트리거가 웹훅, 새로 만든 데이터 · VACUUM 뒤 · 워밍 뒤 1회)

| 조회 | W=2,500 (웹훅 1.25만) | W=10,000 (웹훅 5만) | W=10,000 + 전역 UNIQUE |
|---|---|---|---|
| 수신 · 공개 가드 `endpoint_path = ? AND type = 'webhook'` | 0.049 ms | 0.200 ms | 0.025 ms |
| embed-config `… AND auth_config_id IS NULL` | 0.077 ms | 0.192 ms | 0.014 ms |
| `findByEndpointPath(workspaceId, endpointPath)` | 0.013 ms | 0.015 ms | 0.015 ms |

옛 인덱스는 `workspace_id` 가 선두라 워크스페이스를 모르는 조회가 인덱스 **전체**를 훑었다(`Index Searches: 1`, 웹훅 트리거 수에 선형).
새 인덱스는 한 번에 찾는다. 워크스페이스를 아는 조회(`findByEndpointPath`)는 새 인덱스로도 같은 비용이다. **성능 이득은 크지 않다 — 이 변경의
이유는 보안이다.** 인덱스를 교체하므로 트리거 테이블의 인덱스 수는 그대로다.

> 트래커 등재 때 적은 «W=10,000 에서 0.9 ms» 는 5만 행 UPDATE 직후 VACUUM 없이 잰 값이었다. 위 표가 다시 잰 값이다.

### 마이그레이션 검증 (같은 프로브, 옛 스키마에 중복을 심고)

- 심은 것: 워크스페이스 w5 의 경로를 w7(1분 뒤) · w8(2분 뒤)이, w6 의 경로를 w9(1분 뒤)가 복사 — 중복 묶음 2.
- **V131**(중복 정리): w5 · w6 경로 유지, w7 · w8 · w9 새 경로(셋 다 v4 형식 — `trigger` 의 `endpoint_path` CHECK 통과). NOTICE 3건 +
  «3 trigger(s) regenerated». 중복 묶음 0. **다시 돌리면 0건**(멱등).
- **V132**(전역 UNIQUE 교체): 성공 — `idx_trigger_endpoint_path` valid, `idx_trigger_workspace_endpoint` 삭제.
- **경쟁**(V131 뒤 V132 전에 복사가 들어온 경우): V132 가 중복 키(`Key (endpoint_path)=(…) is duplicated.`)로 실패하고 새 인덱스가 invalid 로 남는다 —
  **옛 인덱스는 valid 그대로**라 보호가 줄지 않는다. 정리 SQL(V131 본문)을 수동으로 다시 돌린 뒤 V132 를 재실행하면 0) DROP 이 invalid
  잔재를 치우고 성공한다. Flyway 는 성공한 V131 을 다시 돌리지 않으므로 이 수동 절차를 V132 헤더에 적는다.

## 변경안

### S1. `spec/1-data-model.md` §2.8 Trigger 필드 표

`| endpoint_path | String? | Webhook URL 경로 (type=webhook) |` →
`| endpoint_path | String? | Webhook URL 경로 (type=webhook) — 라우팅 키가 전역이라 **전역 유일**(§3, V132) |`

### S2. `spec/1-data-model.md` §3 인덱스 전략 — Trigger 행 교체

`| Trigger | (workspace_id, endpoint_path) UNIQUE | Webhook URL 라우팅 (워크스페이스 단위 유니크) |` →
`| Trigger | (endpoint_path) UNIQUE WHERE endpoint_path IS NOT NULL | Webhook URL 라우팅 — 라우팅 키(`/api/hooks/:endpointPath`)가 워크스페이스 무관 전역이라 유일성도 전역이다. 수신 · 공개 가드 · 웹챗 embed-config 가 이 컬럼 하나로 찾는다. V002 의 `(workspace_id, endpoint_path)` UNIQUE 를 교체(V131 중복 정리 · V132 CONCURRENTLY) |`

### S3. `spec/1-data-model.md` `## Rationale` 맨 위 새 절 — «Webhook `endpoint_path` 전역 유일 (2026-09-18)»

위 «무엇이 문제였나» · 재현 · «결정» 두 항목과 기각한 대안 · 실측 표 요약 · 마이그레이션 검증(경쟁 포함)을 옮긴다. 그리고 **남는 틈 하나**를
적는다: 주인이 트리거를 **지우면** 그 경로는 비고, 경로를 아는 누구든 다시 등록할 수 있다 — 외부 서비스가 옛 URL 로 계속 보내면 새 주인이
받는다. 전역 UNIQUE 는 **동시에 존재하는** 중복만 막는다. 지운 경로를 묶어 두려면 묘비(tombstone)가 필요하고, 그것은 이 결정의 범위 밖이다.

같은 파일 «쓸 인덱스가 없는 FK 서른하나의 처분» 절의 «28개 **밖**에서 같은 모양으로 찾은 웹훅 트리거 조회(…)는 유일성 범위 결정이 걸려
트래커로 보냈다.» 뒤에 — «같은 날 위 «Webhook `endpoint_path` 전역 유일» 절이 전역으로 정했다 — 재 보니 성능보다 교차 워크스페이스
가로채기가 먼저였다.»

### S4. `spec/5-system/12-webhook.md`

- WH-SC-01 행 끝(`… 클라이언트는 약한 RNG·고정값 사용을 금한다.`) 뒤에: «경로는 **전역 유일**이다(`(endpoint_path) UNIQUE`, V132) — 경로를
  알고 있는 다른 워크스페이스가 같은 경로를 등록하면 409 로 거부된다. 비밀성(추측 불가)과 유일성(복사 불가)은 다른 보장이다.»
- «endpointPath 가변성» 절의 마지막 불릿 `- 변경된 값은 여전히 비밀 키 역할을 하므로(WH-SC-01) UUID 수준의 고엔트로피 값을 유지해
  squatting·enumeration 을 막는 것을 전제로 한다.` 뒤에 불릿 하나: «고엔트로피는 **추측**을 막을 뿐 **복사**는 막지 못한다 — 경로를 아는
  사람(뷰어 · 전 멤버 · URL 을 받은 외부 서비스)이 다른 워크스페이스에 같은 경로를 등록하는 것은 전역 UNIQUE(V132)가 막는다. 2026-09-18
  이전에는 유일성이 워크스페이스 단위라 이 복사가 가능했고, 수신 웹훅이 복사한 쪽으로 갈 수 있었다([데이터 모델 Rationale
  «Webhook `endpoint_path` 전역 유일»](../../spec/1-data-model.md)).»

### S5. `spec/2-navigation/2-trigger-list.md` 두 곳 · `spec/5-system/3-error-handling.md` 두 곳

`(workspace_id, endpoint_path) UNIQUE` → `(endpoint_path) UNIQUE(전역 — 다른 워크스페이스의 트리거와도 겹칠 수 없다)`. 3-error-handling 은
`… 가 \`(endpoint_path)\` UNIQUE 제약(전역)을 위반할 때 발행한다` 와, 같은 절 카탈로그 표의 `TRIGGER_ENDPOINT_PATH_CONFLICT` 행 설명
«동일 워크스페이스에 같은 `endpointPath` 를 쓰는 트리거가 이미 존재» → «같은 `endpointPath` 를 쓰는 트리거가 이미 존재(다른 워크스페이스의
트리거 포함 — 전역 유일)» (`--spec` WARNING 1).

### S6. `spec/data-flow/10-triggers.md` `trigger` 생성 행

`(workspace_id, endpoint_path) UNIQUE + (workspace_id, type) 인덱스는 V002.` →
`(workspace_id, type) 인덱스는 V002. \`(endpoint_path)\` UNIQUE(전역)는 V132 — V002 의 \`(workspace_id, endpoint_path)\` UNIQUE 를 교체했다(V131 이 기존 중복을 정리).`

### S7. `spec/data-flow/10-triggers.md` `## Rationale` «Webhook `endpoint_path` 의 UNIQUE 범위» 절 (`--spec` Critical 2)

이 절은 반증된 전제 둘을 적고 있다 — «`(workspace_id, endpoint_path)` 가 UNIQUE 이므로 워크스페이스 스코프 안에서는 경로가 유일하다» 와
«충돌 회피는 `endpoint_path` 를 UUID 로 자동 발급(WH-MG-02)해 사실상 전역 고유로 만드는 방식에 의존한다». 두 문장은 취소선으로 남기고
(원문을 지우지 않는 스타일 — CLAUDE.md 의 자기-반증형 소정정 조항과 모양이 같을 뿐 그 조항을 쓰는 것은 아니다, 이것은 planner 턴이다), 그 뒤에
`2-trigger-list.md` R-2 의 «정정 (날짜)» 블록 형식으로 정정을 잇는다:

«**정정 (2026-09-18)**: 유일성은 이제 `(endpoint_path)` 전역 UNIQUE(V132)라 라우팅 키와 범위가 같다. UUID 자동 발급은 **우연한** 충돌을
막을 뿐, 경로를 **알고 있는** 사람이 다른 워크스페이스에 같은 경로를 등록하는 것(복사)은 막지 못했다 — 그 경우 이 조회가 둘 중 하나를
골라 수신 웹훅이 복사한 쪽으로 갈 수 있었다. 근거와 재현은 [데이터 모델 Rationale «Webhook `endpoint_path` 전역 유일»](../../spec/1-data-model.md).»

나머지 문장(라우팅 키가 `endpoint_path` 단독이라는 사실 · 서버의 v4 형식 강제 · 공개 URL 형식)은 그대로 참이라 두다.

### S8. `spec/5-system/2-api-convention.md` §12.2 «유니크 제약 범위» 표 (`--spec` 2차 Critical 1)

`| \`Trigger.endpoint_path\` | 워크스페이스 단위 | 동일 워크스페이스 내에서 중복 불가. 다른 워크스페이스와는 독립 |` →
`| \`Trigger.endpoint_path\` | 전역 | 모든 워크스페이스를 통틀어 중복 불가 — 라우팅 키(\`/api/hooks/:endpointPath\`)가 워크스페이스 무관 전역이라서다(V132). 2026-09-18 이전에는 워크스페이스 단위였다 |`

### S9. `spec/5-system/12-webhook.md` 필드 표

`| \`endpointPath\` | URL 경로 (고유, UUID 기반 자동 생성) |` → `| \`endpointPath\` | URL 경로 (전역 고유 — \`(endpoint_path)\` UNIQUE, V132 · UUID 기반 자동 생성) |`
— «고유» 는 V132 전에는 워크스페이스 안에서만 참이었다.

### S10. `spec/7-channel-web-chat/5-admin-console.md` «`endpointPath` 검증» 불릿 (`--spec` 2차 WARNING 1)

`… 공개 webhook path 이므로 경로 주입·중복 가로채기 방지는 그 규약(+ DB unique)이 단일 책임. 콘솔은 클라이언트 UUID 를 제출할 뿐이다.` 뒤에:
«DB unique 가 **전역**이 된 것은 2026-09-18(V132)이다 — 그 전에는 워크스페이스 단위라 다른 워크스페이스의 복사 등록(가로채기)을 막지 못했다
([데이터 모델 Rationale «Webhook `endpoint_path` 전역 유일»](../../spec/1-data-model.md)). 콘솔의 트리거 생성도 같은 `TriggersService` 경로라 함께 보호된다.»

## 구현 (같은 PR, developer 턴)

- **V131__trigger_endpoint_path_dedupe.sql** (트랜잭션) — `DO $$ … $$`: `row_number() OVER (PARTITION BY endpoint_path ORDER BY created_at, id)`
  가 1 보다 큰 행에 `endpoint_path = gen_random_uuid()::text, updated_at = now()`. 행마다 id · 워크스페이스 id · `chat_channel`
  여부(`config ? 'chatChannel'`) NOTICE, 끝에 건수 · 채팅 채널 건수 NOTICE. 채팅 채널 상태 컬럼은 쓰지 않는다.
- **V132__trigger_endpoint_path_global_unique.sql** + `.conf executeInTransaction=false` — README §5 «교체» 형태(선례 V110):
  0) `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_endpoint_path` → `CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_trigger_endpoint_path
  ON trigger (endpoint_path) WHERE endpoint_path IS NOT NULL` → `DROP INDEX CONCURRENTLY IF EXISTS idx_trigger_workspace_endpoint`. 헤더에 운영
  절차 둘 — ① 경쟁 시 수동 절차(V131 본문 재실행 → repair → migrate) ② V131 NOTICE 에 `chat_channel=true` 가 있으면 그 트리거의 소유
  워크스페이스에 채널 설정을 다시 저장하게 한다(provider 재등록). 트랜잭션 문장(`DO`)과 `CONCURRENTLY` 를 한 파일에 섞을 수 없어(README §5 mixed 판정) 둘로 나눈다.
- `triggers.service.ts` — 충돌 판정 상수 `TRIGGER_ENDPOINT_PATH_UNIQUE_INDEX` 를 `idx_trigger_endpoint_path` 로, 409 메시지를 워크스페이스를 말하지
  않게(«이미 다른 트리거가 쓰는 엔드포인트 경로예요.»). JSDoc 의 `(workspace_id, endpoint_path)` 서술 정정. `triggers.controller.ts` 의 409 설명 두 곳.
- 테스트 — `triggers.service.spec.ts` 의 인덱스 이름 fixture(새 이름 → 좁힘 · 옛 이름 → 통과). e2e `webhook-trigger.e2e-spec.ts` 에 **다른 워크스페이스의
  경로로 생성 · 수정 → 409 `TRIGGER_ENDPOINT_PATH_CONFLICT`**, 그 뒤 수신 웹훅이 원래 주인에게 가는지. 인덱스 단언(실재 · `indisvalid` · 정의 ·
  옛 인덱스 부재).

## 비대상

| 대상 | 이유 |
|---|---|
| 지운 경로의 재등록(묘비) | 위 S3 «남는 틈». 동시 존재 중복과 다른 문제이고, 경로 보존 기간 · 저장 위치 결정이 필요하다 — 트래커에 올린다 |
| 대소문자만 다른 경로 | 조회가 문자열 등치라 `A…` 와 `a…` 는 다른 라우트다 — 한쪽이 다른 쪽을 가로채지 못한다. 서버는 v4 형식만 보고 대소문자를 강제하지 않는다 |
| 인증 웹훅(`auth_config_id` 있음) | 가로챈 쪽이 요청을 받는 순간 문제가 생기므로 인증 여부와 무관하다 — 전역 UNIQUE 가 둘 다 막는다 |

## 트래커 반영

- «웹훅 트리거 조회가 `endpoint_path` 인덱스 전체를 훑는다» → `[x]` 해소(이 draft). 등재 때의 «0.9 ms» 는 VACUUM 없이 잰 값이었다는 정정을 함께.
- 새 항목: «지운 웹훅 경로를 다른 워크스페이스가 다시 등록할 수 있다(묘비 부재)».

## 체크리스트

- [x] `--spec` 이 draft — 1차 `review/consistency/2026/09/18/23_39_46` **BLOCK: YES**(Critical 2 · WARNING 1) · 2차 `…/23_54_40` **BLOCK: YES**
  (Critical 2 · WARNING 1) → 처분 반영 뒤 3차 `review/consistency/2026/09/19/00_07_54` **BLOCK: NO**(Critical 0 · WARNING 0 · INFO 4)
- [x] S1~S10 반영 — planner 커밋 `eb5332b57`
- [x] `--impl-prep spec/2-navigation/` — `review/consistency/2026/09/19/00_16_40` **BLOCK: NO** (Critical 0 · WARNING 1 · INFO 5). WARNING 1
  트래커 항목이 «결정 필요» 로 남아 있다 → 착수 전에 `[x]` 로 닫고 묘비 부재 항목을 새로 올렸다. INFO 2 이 체크박스 · INFO 4 V 번호 재확인 — 반영.
  INFO 1 · 3 (`2-trigger-list.md` frontmatter 키 순서 · `eia-trigger-edit-ui` dangling 참조)은 이 변경과 무관한 기존 상태, 조치 안 함
- [x] V131 · V132 · 서비스 · 테스트 — `check-migration-versions.py --base origin/main` → `OK: 132 migration(s), max V132`. 커밋할 파일 그대로
  일회용 pg18 에 적용: 중복 정리 · 멱등 · 전역 UNIQUE 교체 · 경쟁 시 옛 인덱스 valid 유지 · 정리 재실행 뒤 복구(«마이그레이션 검증» 과 같은 결과).
  단위: 충돌 계약 RED 6 → GREEN 11. 메시지 뮤턴트(«같은 워크스페이스에 …» 로 되돌림) RED 4. 백엔드 타입체크 ratchet baseline 일치
- [ ] lint · unit · build · e2e
- [ ] `/ai-review`
- [ ] `--impl-done`
- [ ] 트래커 반영 · 이 draft `complete/` 이동(마지막 커밋). 이동 뒤 `grep -rln "plan/complete/spec-draft-webhook-endpoint-path-global-unique.md" spec codebase`
  로 인용 전부가 실재 경로를 가리키는지 확인

## Rationale

### 왜 성능 항목이 보안 항목이 됐나

등재 때는 «`workspace_id` 를 모르는 조회가 인덱스 전체를 훑는다» 는 성능 관찰이었고, 해법을 «유일성 범위를 전역으로 좁힐지 · 비유일 보조
인덱스로 조회만 고칠지» 의 결정으로 적었다. 결정의 재료를 모으려고 `endpoint_path` 를 **누가 쓰는가**를 보니 클라이언트가 만들어 보내고
바꿀 수도 있었다 — 그러면 유일성 범위는 성능의 부산물이 아니라 **라우팅의 정합성**이다. 전역 라우팅 키에 워크스페이스 단위 유일성을 둔 것이
결함이고, 성능은 그 결함의 증상이었다.

### 왜 두 파일인가

정리(`DO $$ … UPDATE … $$`)는 트랜잭션 문장이고 인덱스 교체는 `CONCURRENTLY` 라 한 파일에 둘 수 없다(README §5 — Flyway mixed 판정,
`-mixed=true` 는 가드를 전 마이그레이션에 대해 풀므로 쓰지 않는다). README §5 는 «파일을 둘로 쪼개면 앞 파일의 정리 코드가 재실행 때 돌 기회가
없다» 고 경고한다 — 그 경고는 invalid 인덱스 정리를 두고 한 말이고, 여기서는 **경쟁으로 V132 가 실패할 때**에 해당한다. 그 경우 옛 인덱스가
valid 로 남아 보호가 줄지 않고(위 실측), 수동 절차(V131 본문 재실행)가 V132 헤더에 있다. 경쟁이 생기려면 V131 과 V132 사이 수 초 안에 다른
워크스페이스의 경로를 복사해 등록해야 한다.

### 왜 가장 먼저 만든 쪽을 남기나

복사는 원본보다 **나중**에만 생길 수 있다 — 원본이 있어야 경로를 알 수 있다. 그래서 `created_at` 이 가장 이른 행이 정당한 주인이다. `created_at`
은 트랜잭션 시작 시각(`now()`)이라 서로 다른 트랜잭션이 같은 값을 받을 수 있다 — 그때는 `id` 로 순서를 정해 결과를 결정적으로 만든다.
복사는 원본을 본 뒤의 **다른** 요청이라 원본과 같은 마이크로초를 받는 일은 드물지만, 불가능하다고 적지는 않는다.

### 채팅 채널 트리거 — R-CC-21 과의 관계 (`--spec` 1차 Critical 1 · 2차 Critical 2)

[15-chat-channel R-CC-21](../../spec/5-system/15-chat-channel.md) 은 «`chatChannel` 이 실린 PATCH 에서 `setupChannel` 을 아예 안 부른다» 를
**endpointPath 변경 PATCH 의 webhook 재등록 경로를 끊는다**는 이유로 기각했다(CCH-AD-02 멱등 재등록이 전제). V131 은 PATCH 가 아니라 일회성
SQL 정리지만, 채팅 채널 트리거의 경로를 바꾸면 결과가 같다 — provider 는 옛 경로로 계속 보낸다. SQL 은 provider API 를 부를 수 없으므로
재등록을 흉내 내지 않고 **정상 경로로 돌려보낸다**: NOTICE 에 `chat_channel=true` 를 남기고, 배포 운영자가 그 소유자에게 채널 설정을 다시
저장하게 한다(V132 헤더). 다시 저장하면 `setupChannel` 이 새 경로로 재등록한다.

**상태 컬럼(`chat_channel_health` · `chat_channel_last_error`)은 쓰지 않는다.** 1차 처분 초안은 `degraded` 로 표시해 제품 안에서 알리려 했는데,
`degraded` 는 «외부 API 호출 실패» 신호로 의미가 닫혀 있다 — CCH-SE-01 · CCH-NF-03 두 경로(R-CC-19 «degraded 의 두 경로 정합», §743 (d) 의
의미 분리). 마이그레이션을 세 번째 경로로 더하면 그 의미를 넓히고 채팅 채널 문서 여럿을 함께 고쳐야 한다(2차 Critical 2). 이 경우는 다른
워크스페이스의 경로를 **일부러 복사한** 채팅 채널 트리거에서만 생기므로 운영 절차로 충분하다고 판단했다.

그 사이 provider 가 옛 경로로 보내는 요청은 이제 먼저 만든 쪽이 받는다. 그 트리거가 채팅 채널이면 **그 트리거의 비밀로** 서명을 검증하므로
401 로 거부된다(R-CC-12(d), `HooksService.handleWebhook` 의 chatChannel 분기). 공개 웹훅이면 그 워크플로가 돈다 — 경로를 아는 누구든 직접
POST 할 수 있는 URL 이라 새로 열리는 표면은 아니다. 그리고 **마이그레이션 전에도** 이 묶음은 조회가 한 행만 골라 한쪽만 받고 있었다 —
V131 은 누가 받는지를 «가장 먼저 만든 쪽» 으로 정할 뿐이다.

### `--spec` 1차 처분 (`review/consistency/2026/09/18/23_39_46` — **BLOCK: YES**, Critical 2 · WARNING 1 · INFO 5)

번들이 예산에 잘려 §3 · `migrations.md` · 트리거 목록이 빠졌다(main 실측) — 절대경로로 직접 Read 하라는 블록을 붙여 돌렸다.

- **Critical 1** V131 이 채팅 채널 트리거의 경로를 바꾸면 provider 등록이 옛 경로에 남는다 — R-CC-21 이 기각한 «재등록 없는 경로 변경» 과
  같은 결과 → 결정 2 보강 · 구현 V131 보강 · 위 «채팅 채널 트리거» 절. 재등록은 사용자의 다시 저장(정상 경로)으로, 표시는 `degraded` +
  `chat_channel_last_error` 로.
- **Critical 2** `data-flow/10-triggers.md` 의 «Webhook `endpoint_path` 의 UNIQUE 범위» 절이 반증된 전제를 그대로 적고 있다 — S6 은 표 행만
  고쳤다 → **S7** 신설(원문 취소선 보존 + `2-trigger-list.md` R-2 형식의 «정정 (날짜)» 블록 + 링크).
- **WARNING 1** `3-error-handling.md` 카탈로그 표 행의 «동일 워크스페이스에 …» 가 S5 에서 빠졌다 → S5 확장.
- **INFO 1~5** 새 이름 충돌 0 · 기존 식별자 재배선 · README 의 `ADD CONSTRAINT … USING INDEX` 일반 문구와 V132 의 표면 불일치는 V002 등 선례
  전부가 같은 형태라 이 draft 책임 밖 · 규약 준수 확인 · 트래커 선택지 중 하나를 근거와 함께 고른 것 확인 — 조치 불요.

### `--spec` 2차 처분 (`review/consistency/2026/09/18/23_54_40` — **BLOCK: YES**, Critical 2 · WARNING 1 · INFO 4)

1차 뒤에도 같은 종류(선언한 `spec_impact` 밖의 서술)가 두 번 더 나왔다 — 한 곳씩 넓히지 않고 **전수 grep** 으로 바꿨다: spec 전체에서
`endpoint_path`/`endpointPath` 와 유일성 어휘가 같은 줄에 있는 것을 주어별로 확인했다. 첫 어휘(unique · 유니크 · 유일 · 고유 · 겹 · 충돌 · 중복 ·
가로채 · squat · 스코프 · 범위 · 독립 · 전역)는 21줄이었는데, 1차에서 고친 `3-error-handling.md:238`(«**동일** 워크스페이스에 …»)을 놓쳤다 —
어휘를 넓혀(동일 · 같은 · 워크스페이스 · workspace) **32줄**로 다시 셌다. 유일성 범위를 말하는 줄은 S2 · S3 · S5(238 포함) · S6 · S7 이 이미
다룬 것 외에 셋 — `2-api-convention.md:572`(S8) · `12-webhook.md:148` «고유»(S9) · `7-channel-web-chat/5-admin-console.md:112`(S10). 나머지
(`4-security.md:102 · 259` · `12-webhook.md:460 · 462` · `2-api-convention.md:205 · 504` · `15-chat-channel.md:495 · 712 · 804` · `providers/discord.md:102` ·
`0-architecture.md:67` · `2-trigger-list.md:194` · `data-flow/10-triggers.md:101 · 243 · 248 · 249` · `data-flow/14-chat-channel.md:175` ·
`3-error-handling.md:232`)는 유일성이 아니라 비밀성 · URL 형식 · 404 · 라우팅 서술 · 절 제목이다(`10-triggers.md:248 · 249` 는 S7 절 안의 참인 문장,
`3-error-handling.md:232` 는 «충돌» 이 걸린 절 제목 — 3차 INFO 1 로 이 목록에 더했다).

- **Critical 1** `2-api-convention.md` §12.2 표가 «워크스페이스 단위 · 다른 워크스페이스와는 독립» → **S8**. 같은 전수에서 S9 도 나왔다.
- **Critical 2** V131 의 `degraded` 표시가 «degraded 두 경로» 닫힌 열거를 반증 → 상태 컬럼을 **쓰지 않는** 쪽으로 설계를 바꿨다(위 «채팅
  채널 트리거» 절). 이 방향은 1차 Critical 1 의 제안 (2)(«NOTICE 에 chatChannel 여부 + 갭 명시»)와 같다.
- **WARNING 1** 웹챗 콘솔 «DB unique 가 가로채기를 막는다» 는 V132 전에는 거짓이었다 → **S10**.
- **INFO 1** V 번호 선점 — 구현 착수 직전 `check-migration-versions.py --base origin/main` 으로 확인한다(체크리스트). **INFO 2** `secret-store.md`
  스코프 — 경로를 로그에 남기지 않는 근거는 WH-SC-01(비밀 키 역할)이지 secret-store 가 아니다, 조치 불요. **INFO 3** 정정 블록 서식 —
  `2-trigger-list.md` 선례대로 «정정 (2026-09-18)» (괄호 앞 공백)으로 맞춘다(S7 — 반영 스크립트는 이미 이 형식). **INFO 4** 트래커의 다른
  PATCH 경로 항목과 혼동 — 이 draft 는 PATCH 를 바꾸지 않는다, 조치 불요.

### `--spec` 3차 처분 (`review/consistency/2026/09/19/00_07_54` — **BLOCK: NO**, Critical 0 · WARNING 0 · INFO 4)

1 · 2차의 Critical 4 · WARNING 2 가 모두 해소됐다고 판정됐다(실측 대조).

- **INFO 1** 2차 처분의 32줄 분류에 `3-error-handling.md:232`(절 제목) 가 빠져 31줄만 셌다 → 목록에 더했다.
- **INFO 2** `15-chat-channel.md` R-CC-19 본문에 «세 번째 degraded 경로 후보를 검토 · 기각했다» 는 이력이 남지 않는다 — 기각 근거는 이 draft
  («채팅 채널 트리거» 절)와 `1-data-model.md` 새 Rationale 절에 있다. R-CC-19 는 이 결정 뒤에도 참(경로는 여전히 둘)이라 고치지 않는다 — 조치 안 함.
- **INFO 3** S2 지시문의 중첩 backtick 이 draft 렌더링을 깬다 — spec 반영본과 무관, 조치 안 함.
- **INFO 4** S7 의 CLAUDE.md 인용이 developer 전용 예외를 쓰는 것처럼 읽힌다 → «모양이 같을 뿐 그 조항을 쓰는 것은 아니다(planner 턴)» 로 명확히 했다.
