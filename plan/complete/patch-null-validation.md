---
title: "PATCH 의 NOT NULL 필드에 null 을 보내면 500 — 입구(DTO) 검증으로 400"
status: complete
owner: developer
worktree: patch-null-validation
spec_impact: none
started: 2026-09-27
completed: 2026-09-27
---

# PATCH 의 NOT NULL 필드에 null → 500

트래커 `plan/in-progress/spec-draft-nullable-notation-followups.md` 항목 «PATCH 의 NOT NULL 필드에 `null` 을 보내면 500 이다 —
`@IsOptional()` 이 null 을 통과시킨다»(`plan/complete/patch-body-followups.md` 가 등재)를 닫는다.

## 출발점 — 이미 잰 것 (`_test_logs/e2e-20260927-151214.log`, `patch-body-followups` 임시 프로브)

폴더 `name` · 워크플로 `name` · `tags` · `isActive` · 노드 `config` · 인증 설정 `name` · `isActive` — **7개 모두 500**. 노드 `label: null` 은
라벨 중복 검사가 null 로 다른 노드를 찾아 엉뚱한 409. 원인: `@IsOptional()` 은 `undefined` **또는 `null`** 이면 다른 검증기를 전부
건너뛴다 → null 이 엔티티에 병합 → 저장 때 23502 → 전역 필터가 500.

## 처방 — 입구 검증 (필터 매핑 아님)

`plan/in-progress/keyset-cursor-uuid-validation.md` §A 가 «필터에 SQLSTATE 매핑» 을 이미 기각했다 — 필터는 값의 출처를 모르고, 500 은
«어느 입구가 검증을 빠뜨렸다» 는 알람이며, 저장소 전략은 입구마다 조기 거부다. 그래서:

- 공용 데코레이터 `IsOptionalNonNull()`(`src/common/utils/optional-non-null.ts`) — `ValidateIf(v !== undefined)` + `IsDefined(«null 은
  안 된다 — 생략하면 값이 유지된다»)`. 키 생략(= 값 불변)은 그대로 통과하고 null 만 400 `VALIDATION_ERROR` 로 거부한다.
- NOT NULL 컬럼에 대응하는 PATCH 필드의 `@IsOptional()` 을 그것으로 바꾼다. nullable 컬럼(null = 값을 지움)은 건드리지 않는다.
- **null 을 «기본값으로 초기화» 로 해석하지 않는다** — API 규약 §5.4 의 tri-state(«`null` = 초기화»)는 null 을 받는 필드의 계약이고,
  이 필드들은 OpenAPI 가 이미 nullable 이 아니라고 광고한다(선언은 맞고 런타임이 느슨했다). `name` 처럼 기본값이 없는 필드도 있다.

## 전수 (2026-09-27, origin/main `e76ef570e` — 읽기 전용 조사 에이전트, 라우트 21개 = `@Patch(` grep 21줄)

각 PATCH 라우트의 `@Body()` DTO 필드마다 «null 이 오면 검증이 막는가 · 서비스가 어디에 쓰는가 · 그 컬럼이 nullable 인가» 를 따라갔다.
전역 파이프는 `whitelist + forbidNonWhitelisted` 뿐이라 `@IsOptional` 필드의 null 은 전부 통과한다. 필드별 `!== undefined` 가드를 쓰는
서비스도 null 은 거르지 않는다.

### (A) NOT NULL 컬럼에 null → 500 예측 — 38필드 · 13라우트 (★ = 이미 측정)

| 라우트 | 필드 |
|---|---|
| `PATCH /test-datasets/:id` | `name` · `input` · `visibility` |
| `PATCH /nodes/:id` | `positionX` · `positionY` · `config`★ · `isDisabled` |
| `PATCH /triggers/:id` | `name` · `isActive` |
| `PATCH /workflows/:id` | `name`★ · `isActive`★ · `tags`★ |
| `PATCH /schedules/:id` | `isActive`(트리거 행 update 에서 먼저 실패) · `parameterValues` |
| `PATCH /alerts/:id` | `window` · `channel` · `enabled` |
| `PATCH /integrations/:id` | `name` |
| `PATCH /workflow-assistant/sessions/:id` | `status` |
| `PATCH /model-configs/:id` | `provider` · `name` · `defaultModel` · `defaultParams`(kind=chat) |
| `PATCH /knowledge-bases/:id` | `name` · `chunkSize` · `chunkOverlap` · `maxHops` · `vectorSeedTopK` · `expandedChunkLimit` · `rerankMode` · `rerankCandidateK` |
| `PATCH /auth-configs/:id` | `name`★ · `isActive`★ |
| `PATCH /users/me` | `name` · `locale` · `theme` |
| `PATCH /folders/:id` | `name`★ · `sortOrder` |

### (D) 다른 오동작 — 6필드

1. `nodes.label` — 라벨 중복 검사가 `label: null` 로 다른 노드를 잡아 엉뚱한 409(★), 노드가 하나뿐이면 저장까지 가 500.
2. `triggers.endpointPath` — 컬럼이 nullable 이라 200 이지만 **웹훅 수신 경로가 조용히 사라진다**. DTO · spec(`2-trigger-list.md` §3 註 — null 허용은
   `authConfigId` 에만 적혀 있다) 어디도 null 을 계약하지 않는다.
3. `workspaces/:id/settings.interactionAllowedOrigins` — `null.map` TypeError → 500.
4. `workspaces/:id/settings.timezone` — `null.trim()` TypeError → 500. (지우기는 빈 문자열로 한다 — 서비스가 그 경우 키를 뗀다.)
5. `alerts.threshold` — `String(null)` = `"null"` 이 numeric 캐스트에 실패(22P02) → 500.
6. `triggers.chatChannel.languageHints` — PATCH 는 200, 이후 실행 실패 메시지 렌더에서 TypeError 예측(실행 안 해 봄).

### 이미 막히는 곳 · 무해한 곳 (변경 없음)

- `@IsOptional` 이 없어 400: webauthn `deviceName` · workspaces `name` · members `role` · integrations `scope` · trigger `notification.url`·`events` ·
  `chatChannel.provider`. 서비스가 400: chatChannel 차단 필드 5개 · schedule 타입 트리거의 제한 필드.
- no-op: schedules `name`·`cronExpression`·`timezone`(truthy 검사) · model-config `apiKey`·`isDefault` · auth-config `type`·`config` · trigger
  `config`·`chatChannel` · workflow `settings`(`!= null`, #1416).

### (B) nullable 컬럼인데 요청 DTO 가 nullable 을 선언하지 않음 — 8필드 (이 PR 의 축 아님)

assistant `title` · model-configs `baseUrl`·`dimension`(embedding) · knowledge-bases `description`·`rerankConfigId`·`rerankScoreThreshold`·
`rerankLlmConfigId` · users/me `avatarUrl`. #1417 이 워크플로 · 노드 · 인증 설정에서 닫은 것과 같은 형태다.

## 범위

- **이 PR**: (A) 38필드 + (D) 1~5 = **43필드**의 `@IsOptional()` → `@IsOptionalNonNull()`. null 이 400 `VALIDATION_ERROR` 로 거부된다.
- **넘긴다**(트래커): (D) 6 `languageHints`(중첩 JSONB · 미측정 · `15-chat-channel.md` 소관) · (B) 8필드 선언 누락 · JSONB 안에 null 이 저장돼
  «사실상 제거 · 기본값 복귀» 로 동작하는데 선언이 없는 필드(trigger `notification`·`interaction` · 두 `settings.maxConcurrentExecutions` ·
  notifications settings 3개) · (E) trigger `interaction.appearance` 하위 7개(백엔드 소비자 없음 · 프런트 영향 미확인).
- **범위 밖 관찰(미검증 · 보안 성격)** — 조사가 곁눈으로 본 것: `workflows.folderId` · `nodes.containerId`·`toolOwnerId` · assistant `llmConfigId`
  는 update 경로에서 **같은 워크스페이스 소속인지 검사하지 않는** 것으로 보인다. 확인되면 교차 워크스페이스 참조다 — 트래커에 «미검증» 으로 등재.
- **프런트 소비처**: 43필드 중 프런트가 null 을 보내는 곳 0(grep — 직접 `: null` · 동적 `?? null`/`|| null` 모두). 걸린 것은
  `rerankScoreThreshold`(nullable, 변경 없음) 하나.

## 테스트 설계

- **단위(전수)** — 43필드 표를 그대로 테스트 표로: 각 (DTO, 필드)에 `{ [field]: null }` → `isDefined` 위반. 새 필드가 생기면 이 표에 없으니
  자동 포착은 아니다(한계로 적는다).
- **e2e(대표)** — 픽스처가 가벼운 라우트: 폴더 · 워크플로 · 노드 · 인증 설정 · 트리거(webhook) · 알림 규칙 · 테스트 데이터셋 · 워크스페이스
  설정 · users/me · 스케줄 · 모델 설정 · 어시스턴트 세션. 각 null → 400 `VALIDATION_ERROR` + `details[].field`. **고치기 전 코드로 먼저 돌려**
  현재 동작(500 · 409 · 200)을 RED 로 기록한다. 통합 · 지식 베이스는 픽스처가 무거워 단위로만.

## 실측 — 고치기 전 코드로 돌린 새 e2e (`_test_logs/e2e-20260927-172450.log`, 33 failed / 458)

`test/patch-null-rejection.e2e-spec.ts`(12라우트 33케이스 — 각 null → 400 `VALIDATION_ERROR` + `details[].field` 를 기대)를 DTO 를
고치기 **전**에 돌렸다. 33케이스 전부 RED 였고 받은 것은:

- **500 `INTERNAL_ERROR` 31건** — 폴더 `name`·`sortOrder` · 워크플로 `name`·`tags`·`isActive` · 노드 `config`·`positionX`·`isDisabled` · 인증 설정
  `name`·`isActive` · 트리거 `name`·`isActive` · 알림 규칙 `threshold`·`window`·`channel`·`enabled` · 테스트 데이터셋 `name`·`input`·`visibility` ·
  워크스페이스 설정 `timezone`·`interactionAllowedOrigins` · 내 프로필 `name`·`locale`·`theme` · 스케줄 `isActive`·`parameterValues` · 모델 설정
  `provider`·`name`·`defaultModel`·`defaultParams` · 어시스턴트 세션 `status`.
- **409 `DUPLICATE_NODE_LABEL`** — 노드 `label`.
- **200** — 트리거 `endpointPath`(웹훅 경로가 지워졌다).

전수의 (A) · (D) 예측이 e2e 가 닿은 33필드에서 전부 맞았다. 통합 `name` · 지식 베이스 8필드는 e2e 가 닿지 않는다 — 단위 표만 본다.

## 뮤턴트 — 예측 / 실측

`jest` 데코레이터 스펙 + 43필드 표(baseline 91 GREEN, `fc997ae56`). 제자리 치환 → `shutil.copy` 복원.

| # | 뮤턴트 | 예측 | 실측 · 죽인 테스트 |
|---|---|---|---|
| M1 | 데코레이터가 null 도 건너뜀(`v !== undefined && v !== null` = `@IsOptional` 과 같은 동작) | 표 43행 + 데코레이터 RED | KILLED 45 — 표 «null 이면 isDefined 위반» 43행 · 데코레이터 «null 이면 거부» · «거부 메시지» |
| M2 | `IsDefined` 를 뺌(null 은 타입 검증기만 잡는다 — 런타임은 여전히 400) | 표 43행 RED(메시지 칸) | KILLED 45 — 같은 43행 + 데코레이터 둘. 400 자체는 유지되므로 이 뮤턴트가 죽이는 것은 «원인이 보이는 메시지» 다 |
| M3 | 트리거 `endpointPath` 한 필드만 `@IsOptional()` 로 되돌림 | 그 행만 RED | KILLED 1 — `UpdateTriggerDto 의 endpointPath` 행 |
| M4 | 워크스페이스 설정 `timezone` 한 필드만 되돌림 | 그 행만 RED | KILLED 1 — `UpdateWorkspaceSettingsDto 의 timezone` 행 |

## `--impl-prep` 처분 (`review/consistency/2026/09/27/17_14_44` BLOCK: NO)

- **W1** (plan_coherence) 새 헬퍼 `optional-non-null.ts` 도 `omit-undefined.ts` 처럼 어느 spec `code:` 에도 없다 → 트래커 planner 항목 (6)
  에 모집단으로 더했다(결정은 planner).
- **W2** (cross_spec) §5.4 의 PATCH tri-state «`null` = 초기화» 가 nullable 선언 필드에만 적용된다는 문장이 없어, 글자 그대로는 이 PR 의
  null 거부와 부딪혀 보인다 → 같은 planner 항목에 (10) 으로 등재(§5.4 블록쿼트에 «미선언 필드의 null 은 400» 한 문장).
- INFO 1(`9-user-profile.md` §6.1 `interactionAllowedOrigins` 표기에 `?`) → (10) 에 함께. INFO 2 · 4 · 5 조치 불요, INFO 3 은 검토 범위 고지.

## 체크리스트

- [x] 전수 — 21라우트, (A) 38 · (D) 6 · (B) 8
- [x] `--impl-prep` — `review/consistency/2026/09/27/17_14_44` BLOCK: NO(W1 · W2 → 트래커)
- [x] 데코레이터 · DTO · e2e · 단위 · CHANGELOG · 트래커
- [x] 뮤턴트 표 실측 — M1~M4 전부 KILLED
- [x] TEST WORKFLOW (lint · unit · build · e2e) — 전부 PASS, e2e 458 (`_test_logs/e2e-20260927-174241.log`, `feac5ef37`). 첫 unit 에서 `update-me.dto.spec.ts` 가 «theme=null 통과» 를 고정하고 있어 RED — 결함을 고정하던 테스트라 기대값을 바꾸고 lint 부터 재실행
- [x] `/ai-review` — 1R `review/code/2026/09/27/17_47_49` Critical 0 · Warning 2(모델 설정 PATCH 유효 값 e2e 부재 · `endpointPath` 문서) →
  `e5de5226c` 로 조치, TEST WORKFLOW 재통과(e2e 459). 2R `18_13_53` Critical 0 · Warning 0 · codebase 수정 0 — 수렴. SPEC-DRIFT(§5.4
  tri-state 범위)는 두 라운드 모두 트래커 planner 항목 (10)
- [x] `--impl-done` — `review/consistency/2026/09/27/18_23_40` BLOCK: NO(판정 HEAD `15a094c6a`). W1(§5.4) · W2(`maxConcurrentExecutions`
  — spec «hard-fail» 서술과 어긋남) → 트래커 «PATCH null 후속» 보강, W3 · W4 · INFO 2(`2-trigger-list.md` `endpointPath` 행 · §5.4 검증
  층 표) → planner 항목 (10) 범위 보강, W5 · INFO 4(응답 계약 어휘와의 층 구분) → `optional-non-null.ts` JSDoc. 그 파일은 spec `code:`
  연결이 아니라(`review_guard._spec_linked_changes`) 이 산출물은 유효하고, 코드 리뷰 게이트만 다시 무장된다 → 3R
- [x] 3R `/ai-review` — `review/code/2026/09/27/18_48_42` Critical 0 · Warning 0 · codebase 수정 0 수렴(TEST WORKFLOW 재통과, e2e 459 —
  `_test_logs/e2e-20260927-184407.log`). SPEC-DRIFT 2건(§5.4 · `2-trigger-list.md` `endpointPath`)은 트래커 planner 항목 (10) 범위 안
