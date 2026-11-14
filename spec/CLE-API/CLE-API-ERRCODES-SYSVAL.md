---
id: "CLE-API-ERRCODES-SYSVAL"
title: "에러 코드 카탈로그 — 시스템 · 유효성 검증"
type: "convention"
version: 3
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-API-ERRCODES"
ancestors: ["CLE-VISION", "CLE-API", "CLE-API-ERRCODES"]
area: "CLE-API"
content_hash: "8158765bd0700b4c4acd77d8fc82c71f116d16606d53952a05bad8d8cfba515a"
read_as: "approved_fallback"
task: "CLE-T-GWC9M3"
source_paths: []
mirror_sha256: "c161c33b1626b610764f00c0c63bbfd2be0da49131ee0555387895cdaf5d600d"
etag: "sha256-d8c44a83ed45a8f55730bf4e44761b7f49b8441c1c9204e1479641f866c93e1f"
---
## 개요

이 문서는 [에러 코드 규약과 카탈로그](CLE-API-ERRCODES.md) 의 하위 문서로 카탈로그 가운데 시스템 공용 코드(§6.1), 유효성 검증 코드(§6.4), 지식 저장소 코드(§6.11)를 정한다. 표의 열 구성과 등재 원칙은 부모 문서 「6. 카탈로그」 절이 정한다.

## 6.1 시스템

| 코드 | 이름 | 설명 | 사용자 메시지 | 정의 문서 |
|------|------|------|--------------|-----------|
| `INTERNAL_ERROR` | 내부 서버 에러 | 예상하지 못한 서버 에러. 5xx 기본 코드. 클라이언트가 분기할 수 없는 예상된 내부 거부도 이 코드로 보낸다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 25 · 27) | "서버 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `SERVICE_UNAVAILABLE` | 서비스 불가 | 의존 서비스에 접근할 수 없음. 로그인 2단계 Passkey 인증 검증(`POST /api/auth/2fa/webauthn/authenticate/verify`)에서 Passkey 인증 챌린지를 기록하지 못할 때 낸다. 기록하지 못하는 조건은 [가입과 로그인 「Passkey 등록·인증 흐름」](../CLE-ACCT/CLE-ACCT-SIGNIN.md#passkey-등록인증-흐름) 이 정한다 | "서비스를 일시적으로 사용할 수 없습니다." | [HTTP API 규약](CLE-API-CONV.md) 의 「6. HTTP 상태 코드」, [가입과 로그인](../CLE-ACCT/CLE-ACCT-SIGNIN.md) |
| `DATABASE_ERROR` | DB 에러 | 데이터베이스 연결·쿼리 실패. 발행처는 [미결 사항](CLE-API-ERRCODES.md#미결-사항) 참조 | "데이터 처리 중 오류가 발생했습니다." | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `RATE_LIMITED` | 요청 빈도 제한 | 요청 빈도 제한 초과. 429 기본 코드 | "요청이 너무 많습니다. {retry_after}초 후 다시 시도해 주세요." | [HTTP API 규약](CLE-API-CONV.md) |

## 6.4 유효성 검증

| 코드 | 설명 | HTTP | 정의 문서 |
|------|------|------|-----------|
| `VALIDATION_ERROR` | 요청 데이터 유효성 실패. 400 기본 코드. 발행 지점이 정해진 경우(`X-Workspace-Id` 형식 에러)는 아래 별도 행이다. 요청 본문의 참조 id 가 요청자의 워크스페이스나 같은 워크플로우 밖을 가리킬 때도 이 코드와 `details[].code='INVALID_FIELD'` 배열(아래 `INVALID_FIELD` 행)을 싣는다. 노드 생성 · 수정과 캔버스 저장에서 노드 `config` 의 통합 참조 자리에 쓸 수 없는 값(문자열이 아닌 값, 없는 통합, 이 워크플로우에서 쓸 수 없는 개인 통합)이 와도 같은 코드와 배열로 거절한다(`node-integration-ref-check.ts`) | 400 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md), [데이터 모델 개요 §참조의 소속](../CLE-PLAT/CLE-PLAT-DATA.md#참조의-소속), [통합 관리](../CLE-INT/CLE-INT-MANAGE.md) |
| `PAYLOAD_TOO_LARGE` (요청 본문) | 요청 본문이 body-parser 한도를 넘음. 전역 기본 100KB, `/api/hooks/*` 인증 웹훅과 채팅 채널 트리거 1MB(`createHooksBodyParsers`). 채팅 채널 트리거는 `auth_config_id` 가 없어도 공개 웹훅의 32KB 추가 제한을 받지 않는다([웹훅 「요청 제한과 남용 방어」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#요청-제한과-남용-방어)). `GlobalExceptionFilter` 가 body-parser 의 413 을 표준 봉투로 바꾼다. `message` 는 내부 원문(`"request entity too large"` 등)을 싣지 않고 고정 문구 `"Request payload too large."` 만 돌려준다. 공개 웹훅의 32KB 추가 제한은 별도 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(§6.10) | 413 | [HTTP API 규약](CLE-API-CONV.md) 의 「6. HTTP 상태 코드」, [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `PAYLOAD_TOO_LARGE` (multipart 업로드) | 업로드 파일이 `FileInterceptor` 의 `limits.fileSize` 를 넘음(아바타 2MB, 지식 저장소 문서 50MB). Nest 가 multer 의 `LIMIT_FILE_SIZE` 를 `PayloadTooLargeException` 으로 바꾸고 `GlobalExceptionFilter` 가 상태 코드로 이 코드를 채운다. `message` 는 multer 원문(`"File too large"`)을 싣지 않고 요청 본문 행과 같은 고정 문구 `"Request payload too large."` 를 돌려준다([에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 의 「`message` 에 내부 원문을 싣지 않는다」) | 413 | [내 프로필 「아바타」](../CLE-ACCT/CLE-ACCT-PROFILE.md#아바타), [HTTP API 규약](CLE-API-CONV.md) 의 「9. 파일 업로드」 |
| `FILE_REQUIRED` | 업로드 요청에 파일이 없거나 내용이 비어 있음(`file?.buffer?.length` 가 0). 확장자 불허(`INVALID_FILE_TYPE`)와 다른 코드다. 클라이언트가 취할 행동이 다르기 때문이다("파일을 고르세요" 와 "다른 형식으로 바꾸세요"). 메시지 문자열 파싱이 금지돼 있으므로 코드로 갈라야 분기할 수 있다. 현재 발행처는 아바타 업로드다 | 400 | [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) |
| `INVALID_FILE_TYPE` | 확장자가 허용 목록에 없음. 지식 저장소 문서 업로드와 아바타 업로드가 함께 쓰고 허용 목록은 도메인마다 정한다(지식 저장소 `txt`·`md`·`pdf`·`csv`, 아바타 `png`·`jpg`·`jpeg`·`webp`·`gif`, SVG 제외) | 400 | [파일 저장소 「지식 저장소 문서」](../CLE-PLAT/CLE-PLAT-STORAGE.md#지식-저장소-문서), [파일 저장소 「아바타」](../CLE-PLAT/CLE-PLAT-STORAGE.md#아바타), [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md) |
| `WORKSPACE_ID_REQUIRED` | 워크스페이스 컨텍스트가 **없음**. `X-Workspace-Id` 헤더도 JWT `activeWorkspaceId` 클레임(옛 `workspaceId`)도 없다(`workspace.decorator.ts` 발행). 헤더가 있으나 형식이 깨진 경우는 아래 `VALIDATION_ERROR` 행이며 다른 경우다. 경로로 워크스페이스를 받지 않는 `@Roles()` 라우트(예: 채팅 채널 `rotate-bot-token`)는 가드가 먼저 돌아 이 코드 대신 403 `FORBIDDEN` 을 낸다([§6.15](CLE-API-ERRCODES-TRIGGER.md#615-채팅-채널-봇-토큰-재발급-도메인-문서-참조)) | 400 | [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) |
| `VALIDATION_ERROR` | **`X-Workspace-Id` 형식 에러**. 헤더가 있으나 canonical UUID 형태(8-4-4-4-12 hex)가 아니면 일찍 거부한다. `RolesGuard` 와 `@WorkspaceId()` 가 함께 쓰는 헬퍼(`resolveRequestWorkspaceContext`) 한 곳에서 throw 한다(반환 플래그로 두면 두 경로의 응답이 갈라진다). 일찍 거부하지 않으면 그 값이 멤버십 조회까지 흘러가 `QueryFailedError`(SQLSTATE 22P02)가 되고 500 `INTERNAL_ERROR` 로 가려진다. **JWT 클레임은 검증하지 않는다.** 서버가 서명한 값이라 거기서 400 을 내면 서버 버그를 클라이언트 에러로 보고하게 된다. 검증을 경로 파라미터보다 느슨하게 하는 근거는 [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-헤더는-경로-파라미터보다-느슨하게-검사한다) 의 「`X-Workspace-Id` 헤더는 경로 파라미터보다 느슨하게 검사한다」 Rationale | 400 | [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) |
| `INVALID_TRIGGER_PARAMETERS` | 수동 트리거 parameters 스키마 검증 실패. **세 엔드포인트가 함께 쓴다**: 주 실행(`POST /workflows/:id/execute`), 저장(`POST /workflows/:id/save`, `validateManualTrigger`), 재실행의 `inputOverride`(`POST /executions/:id/re-run`). 셋 다 `resolveTriggerParameters` 가 던지는 같은 검증 실패를 감싸므로 같은 코드를 낸다. 필드별 사유는 `details[]`(§4.2, §6.10). 경로별로 `RERUN_` prefix 를 붙이지 않는 것은 의도다. 세 경로를 하나로 모으는 것이 이 코드가 있는 이유다. 최상위는 이 특화 코드이고 `details[].code` 에는 필드별 사유를 싣는다. [에러 응답과 클라이언트 처리 「2.6 top-level 이 이미 특화 코드일 때」](CLE-API-ERROR.md#26-top-level-이-이미-특화-코드일-때-2026-09-11) 의 판별 기준은 사유의 중복이다. 최상위는 "파라미터 검증 실패" 라는 묶음 사유이고 필드별 사유와 겹치지 않아 이 기준에 걸리지 않는다. 규칙 6 도 지킨다. 새 검증 사유가 생기면 최상위 코드는 그대로 두고 §4.2 에 새 항목 코드를 더한다 | 400 | [수동 트리거 노드](../CLE-NODE-TRIG/CLE-NODE-MANUAL.md), [재실행](../CLE-EXEC/CLE-EXEC-RERUN.md) |
| `MODEL_CONFIG_INVALID` | 모델 설정 입력 검증 실패. 알 수 없는 `kind`, 필수 프로바이더의 apiKey 누락, 사설망·loopback baseUrl(사설망 차단, tei·local 제외) 등. `model-config.service.ts`, `model-config.controller.ts`, `llm-preview.service.ts`(preview-models) 발행 | 400 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md), [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md) |
| `RESOURCE_NOT_FOUND` | 리소스 없음. 404 기본 코드 | 404 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `ALERT_RULE_NOT_FOUND` | 알림 규칙 없음. 워크스페이스 범위 안에서 규칙 id 를 찾지 못함. `alerts.service.ts` 가 `where: { id, workspaceId }` 로 조회하므로 다른 워크스페이스 규칙에 접근해도 같은 404 다(존재 누설 방지, `MODEL_CONFIG_NOT_FOUND` 의 종류 간 차단과 같은 형태) | 404 | [알림](../CLE-OBS/CLE-OBS-NOTIFY.md) |
| `MODEL_CONFIG_NOT_FOUND` | 지정한 id 의 모델 설정이 없거나 다른 종류(kind)에 접근해 차단됨(존재 누설 방지). id 지정 경로와 `resolveEmbedding` 의 워크스페이스 기본값 부재(지식 저장소 임베딩 설정 부재 = 리소스 부재)에 쓴다. `RESOURCE_NOT_FOUND` 의 모델 설정 특화 코드(`model-config.service.ts` 발행) | 404 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md), [LLM 클라이언트](../CLE-AI/CLE-AI-LLM.md), [문서 임베딩 「임베딩 모델 해석」](../CLE-KB/CLE-KB-EMBED.md#임베딩-모델-해석) |
| `MODEL_CONFIG_DEFAULT_MISSING` | id 를 지정하지 않았는데 워크스페이스 기본 설정이 없음(설정 안내용). `resolveConfig` 의 chat/LLM 기본값 경로 전용이다. `resolveEmbedding` 의 기본값 부재는 `MODEL_CONFIG_NOT_FOUND`(404)를 쓴다(사용자 결정 2026-06-12) | 400 | [모델 설정](../CLE-AI/CLE-AI-MODELS.md). 이 코드는 도메인 문서에 적혀 있지 않다. [지식 저장소 관리](../CLE-KB/CLE-KB-MANAGE.md) 는 임베딩 기본값 부재(404)와 구분할 때만 이름을 든다 |
| `USER_NOT_FOUND` | 대상 사용자가 없음. `RESOURCE_NOT_FOUND` 의 사용자 특화 코드다. 사용자 API(`users.service.ts`, `users.controller.ts`), 알림 설정(`notifications.service.ts`), TOTP · Passkey(`totp.service.ts`, `webauthn.service.ts`), 멤버 직접 추가의 가입하지 않은 이메일(`workspaces.service.ts`)이 발행한다. 초대 모듈의 소문자 `user_not_found`(§3)와 별개 코드다. 로그인 감사값 `failure_reason='USER_NOT_FOUND'` 와는 문자열만 같다(§6.3) | 404 | [내 프로필](../CLE-ACCT/CLE-ACCT-PROFILE.md), [세션과 토큰](../CLE-ACCT/CLE-ACCT-SESSION.md), [워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md) |
| `WORKSPACE_NOT_FOUND` | 멤버 · 관리자 · 소유자 검사를 통과한 뒤 대상 워크스페이스 행이 없음(`workspaces.service.ts`). 사실상 동시 삭제 경합에서만 난다. `RESOURCE_NOT_FOUND` 의 워크스페이스 특화 코드다. 초대 모듈의 소문자 `workspace_not_found`(§3)와 별개 코드다 | 404 | [워크스페이스와 멤버 「워크스페이스를 찾지 못할 때」](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스를-찾지-못할-때) |
| `NO_WORKSPACE_AVAILABLE` | 액세스 토큰은 유효한데 사용자가 쓸 워크스페이스가 하나도 없음(`jwt.strategy.ts`). 토큰 클레임의 워크스페이스 멤버십, 개인 워크스페이스, 첫 멤버십이 모두 없을 때다. 관리 경로의 404 `WORKSPACE_NOT_FOUND` 와 별개 코드다 | 401 | [워크스페이스와 멤버 「워크스페이스를 찾지 못할 때」](../CLE-ACCT/CLE-ACCT-WS.md#워크스페이스를-찾지-못할-때) |
| `RESOURCE_CONFLICT` | 리소스 충돌(이름 중복 등). 409 기본 코드 | 409 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) |
| `DUPLICATE_NODE_LABEL` | 노드 라벨 중복. `RESOURCE_CONFLICT` 의 노드 라벨 특화 코드(`nodes.service.ts` 와 캔버스 일괄 저장 · 버전 복원 경로의 `workflows.service.ts` 발행). 버전 복원은 캔버스 저장과 같은 쓰기를 거친다 | 409 | [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md), [버전 기록](../CLE-WF/CLE-WF-VERSION.md) |
| `DUPLICATE_NAME` | 테스트 데이터셋 이름 중복. 같은 사용자가 같은 워크플로우에 같은 이름의 데이터셋을 저장 · 수정 · 복제하면 난다(`(workflow_id, owner_id, name)` UNIQUE, `workflow-test-datasets.service.ts` 의 `saveUnique` 발행). `RESOURCE_CONFLICT` 의 테스트 데이터셋 특화 코드다. 프런트엔드는 이 코드로 분기하지 않고 저장 · 복제 실패 토스트를 보인다 | 409 | [에디터 실행과 디버깅](../CLE-EXEC/CLE-EXEC-RUN.md), [실행 시작 · 중지와 캔버스 표시 「테스트 데이터셋」](../CLE-EXEC/CLE-EXEC-RUN-START.md#테스트-데이터셋) |
| `RESERVED_VARIABLE_NAME` | 변수 선언·변수 수정 노드의 변수 이름이 시스템 예약 `__` prefix 로 시작함(`variables.__*` 는 엔진 시스템 네임스페이스). **이 행은 저장 시점(L0)만 다룬다.** `saveCanvas`·`importWorkflow` 가 `details.offenders[]` 와 함께 HTTP 400 을 낸다(`restoreVersion` 은 옛 데이터 탈출구라 면제). 저장을 우회한 리터럴은 엔진 사전 검증(L1)에서 `INVALID_NODE_CONFIG` 가 된다(§6.5 표 아래). 표현식이 예약 이름으로 평가되는 런타임(L2)은 HTTP 와 무관하다. 핸들러가 `RESERVED_VARIABLE_NAME:` 메시지 prefix 로 throw 해 노드 실패로 기록되지만 구조화 `error.code` 는 없다 | 400 (저장) / 없음 (런타임) | [실행 컨텍스트](../CLE-EXEC/CLE-EXEC-CONTEXT.md), [변수 선언 노드](../CLE-NODE-LOGIC/CLE-NODE-VARDECL.md), [변수 수정 노드](../CLE-NODE-LOGIC/CLE-NODE-VARSET.md) |
| `WORKFLOW_VERSION_CONFLICT` | 캔버스 저장이나 버전 복원이 같은 워크플로우에 동시에 버전을 만드는 경합. 버전 복원도 캔버스 저장과 같은 쓰기를 거쳐 버전을 만든다. 같은 워크플로우 버전 번호 unique 위반을 감지해 재시도 권고와 함께 돌려준다(`workflow-versions.service.ts` 발행) | 409 | [버전 기록](../CLE-WF/CLE-WF-VERSION.md) |
| `INVALID_VERSION_SNAPSHOT` | 버전 복원 때 버전 스냅샷 형식이 잘못됐다(`nodes` · `edges` 가 배열이 아니거나 `name` 이 있는데 문자열이 아니다). `workflows.service.ts` 의 `restoreVersion` 발행. 상태 코드는 등재 전부터 내던 400 을 그대로 적었다. 요청이 아니라 저장된 버전 스냅샷의 결함이라 [HTTP API 규약](CLE-API-CONV.md) 「6. HTTP 상태 코드」 의 422 · 500 과 결이 다르다. 상태 코드를 바꾸면 API 계약이 바뀌므로 등재와 함께 바꾸지 않았다 | 400 | [버전 기록](../CLE-WF/CLE-WF-VERSION.md) |
| `GRAPH_VALIDATION_FAILED` | 캔버스 저장(`POST /workflows/:id/save`)이나 버전 복원(`POST /workflows/:id/versions/:versionId/restore`)에서 심각도 `error` 인 그래프 경고 규칙이 하나 이상 걸림. 노드 · 연결선을 쓴 트랜잭션 안에서 평가하고 이 코드를 던져 저장을 되돌린다(`workflows.service.ts` 발행). 버전 복원은 옛 데이터 호환 게이트(수동 트리거 parameters 스키마, 예약 변수 이름)를 건너뛰지만 이 평가는 건너뛰지 않는다. `message` 는 `Graph validation failed: ` 뒤에 걸린 첫 규칙의 메시지를 싣고 `details.errors` 는 그 평가에서 심각도 `error` 인 결과를 모두 싣는다. AI 에이전트 노드의 도구 payload 예산 규칙은 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 일 때만 `error` 로 올라 이 코드로 막힌다 | 400 | [그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md), [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md), [AI 에이전트 노드](../CLE-NODE-AI/CLE-NODE-AGENT.md) |
| `INVALID_STATE` | 상태 전이 불가(이미 실행 중인 워크플로우 삭제 등). 422 기본 코드. 표면별 같은 뜻 코드는 §6 머리말. 로그인 OAuth 콜백의 소문자 URL 값 `invalid_state`(§3, state 불일치)와 별개 코드다 | 422 | [에러 응답과 클라이언트 처리](CLE-API-ERROR.md), [큐 워커와 동시 실행 제한 「발행 전 사전 검증」](../CLE-EXEC/CLE-EXEC-WORKER.md#발행-전-사전-검증), [실행 데이터와 흐름 「입력으로 재개」](../CLE-EXEC/CLE-EXEC-DATA.md#입력으로-재개) |
| `INVALID_FIELD` | 응답의 최상위 코드가 아니다. 400 응답의 `details` 안에서 문제 필드를 가리키는 필드 단위 표시다. `details` 가 배열이면 원소마다, 객체이면 그 객체에 `field` 와 `code: 'INVALID_FIELD'` 를 싣는다. 최상위 코드는 `VALIDATION_ERROR` 이고 트리거 인증 설정 연결만 `AUTH_CONFIG_NOT_FOUND`(§6.14)다. 클라이언트는 최상위 코드로 분기한다 | 없음 (400 응답 `details` 안의 `code`) | [에러 응답과 클라이언트 처리 「2.4 `details` 의 형태」](CLE-API-ERROR.md#24-details-의-형태), [에러 응답과 클라이언트 처리 「2.5 `field` 를 실으면 `code` 도 싣는다」](CLE-API-ERROR.md#25-field-를-실으면-code-도-싣는다-2026-09-11) |
| `INVALID_NOTIFICATION_URL` | 트리거 생성(`POST /api/triggers`)이나 수정(`PATCH /api/triggers/:id`) 본문의 `notification.url` 이 알림 URL 안전 검사를 통과하지 못함. `message` 에 거절 사유를 싣는다. 보내기 직전 검사에 걸린 알림은 이 코드를 내지 않는다. 보내지 않고 발송 건강도를 `degraded` 로 둔다 | 400 | [EIA 알림 웹훅 「SSRF 방지」](../CLE-IX/CLE-EIA-NOTIFY.md#ssrf-방지) |

**`X-Workspace-Id` 세 갈래**: 같은 헤더 하나가 세 갈래로 갈린다.

1. 헤더와 클레임이 **둘 다 없음**: `WORKSPACE_ID_REQUIRED`(400)
2. 헤더가 **있으나 형식이 깨짐**: `VALIDATION_ERROR`(400)
3. 헤더 **형식은 맞으나 비멤버**: `RolesGuard` 의 `NOT_A_MEMBER`(403)

(2)와 (3)의 경계가 곧 UUID 검증 강도 비대칭이다([워크스페이스와 멤버](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-헤더는-경로-파라미터보다-느슨하게-검사한다) 의 「`X-Workspace-Id` 헤더는 경로 파라미터보다 느슨하게 검사한다」 Rationale). **적용 범위**: (1)과 (2)는 `@Roles()` 나 `@WorkspaceId()` 를 쓰는 인증 라우트에서만 생긴다. 둘 다 없는 워크스페이스 무관 전역 라우트는 `RolesGuard` 가 헤더를 읽기 전에 통과시키므로(`handlerConsumesWorkspaceId` 단축) 형식이 깨진 헤더가 실려도 400 이 아니라 무시된다. 프론트엔드 `apiClient` 가 모든 요청에 이 헤더를 습관처럼 붙이기 때문에 필요한 예외다. 단서가 둘 있다. 경로 파라미터로 워크스페이스를 받는 라우트(`@WorkspaceParam(...)`)는 `@WorkspaceId()` 를 함께 쓸 때만 헤더를 본다. 경로로 받는 워크스페이스가 없는 `@Roles()` 라우트에서 헤더와 클레임이 모두 없으면 (1)이 아니라 가드의 코드 없는 403(기본 코드 `FORBIDDEN`)이 된다. 라우트별 범위의 정본은 [워크스페이스와 멤버 「`X-Workspace-Id` 형식 검사」](../CLE-ACCT/CLE-ACCT-WS.md#x-workspace-id-형식-검사) 다.

## 6.11 지식 저장소·Graph RAG (도메인 문서 참조)

| 코드 | HTTP | 설명 | 정의 문서 |
|------|--------|------|-----------|
| `KB_REEXTRACT_IN_PROGRESS` | 409 | 지식 저장소 전체 재추출(`re-extract`)의 동시 호출을 `reextract_status` 컬럼 원자 compare-and-swap 으로 막음(재임베딩 잠금과 같은 형태) | [Graph RAG](../CLE-KB/CLE-KB-GRAPH.md) |
| `KB_REEMBED_IN_PROGRESS` | 409 | 지식 저장소 전체 재임베딩(`re-embed`)의 동시 호출을 `reembed_status` 컬럼 원자 compare-and-swap 으로 막음(`embedding_dimension` 도 NULL 로 초기화) | [문서 임베딩](../CLE-KB/CLE-KB-EMBED.md) |

## Rationale

### `ALERT_RULE_NOT_FOUND` 를 직접 등재한 이유 (2026-08-31)

`alerts.service.ts` 가 발행하는데 카탈로그에 0건이었고 문서화는 기능 문서에만 있었다. 도메인 참조 절이 아니라 §6.4 에 직접 등재했다. 같은 절 `MODEL_CONFIG_NOT_FOUND` 의 직접 등재 선례를 따른 것이다.

### 413 `PAYLOAD_TOO_LARGE`(전역)와 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`(도메인)를 함께 두는 이유

둘 다 413 이지만 발행 층과 한도가 다르다. `PAYLOAD_TOO_LARGE` 는 413 의 전역 코드로 모든 라우트에 공통이다. body-parser 의 본문 한도와 multipart 업로드의 파일 크기 한도(`FileInterceptor`)가 이 코드로 나간다. `PUBLIC_WEBHOOK_BODY_TOO_LARGE` 는 공개 웹훅 전용 가드가 파싱 뒤 32KB 보수 한도로 추가 제한할 때만 낸다. 일반 신규 코드는 전역 코드를 쓰고 도메인 특화 한도가 있을 때만 별도 코드를 만든다([웹훅 「본문 크기」](../CLE-TRIG/CLE-TRIG-WEBHOOK.md#본문-크기)).

### multipart 업로드 413 의 `message` 를 고정 문구로 바꿨다 (2026-11-06)

NERV Task `CLE-T-8MQMGQ` 이다. 이전 판은 multipart 업로드 413 의 `message` 를 multer 원문 `"File too large"` 로 적었다. 전역 예외 필터가 http-errors 미들웨어(body-parser)의 4xx 만 고정 문구로 바꾸고, Nest 가 multer `LIMIT_FILE_SIZE` 를 바꾼 `PayloadTooLargeException` 은 `HttpException` 이라 원문이 그대로 나갔기 때문이다. 필터가 `code` 를 지정하지 않은 `HttpException` 413 도 `"Request payload too large."` 로 바꾸게 되어 행을 고쳤다.

- 같은 코드의 두 행이 서로 다른 `message` 규칙을 갖지 않게 했다. 클라이언트는 `code` 로 분기하지만 `message` 를 그대로 보여 주는 화면도 있어서, 한도를 넘은 원인에 따라 문구가 달라질 이유가 없다.
- 라이브러리 원문을 응답에 싣지 않는 규칙과 그 범위는 [에러 응답과 클라이언트 처리](CLE-API-ERROR.md) 가 정한다. 이 문서는 카탈로그 행만 그 규칙에 맞춘다.
- `code` 를 지정한 413(공개 웹훅 `PUBLIC_WEBHOOK_BODY_TOO_LARGE`)은 그 코드와 문구를 그대로 둔다.
- 같은 날 더한 「설치 엔드포인트의 예상 밖 예외를 500 으로 가리고 `requestId` 를 싣는다」 절은 코드가 없는 `HttpException` 의 문구를 「전역 필터처럼 그대로 싣는다」고 적었다. 이 변경 뒤 전역 필터는 코드가 없는 413 의 문구를 고정 문구로 바꾸므로 그 비교는 413 을 뺀 상태에만 맞다. 설치 엔드포인트는 전역 필터를 거치지 않아 이 변경의 영향을 받지 않는다.

### `GRAPH_VALIDATION_FAILED` 를 §6.4 에 직접 등재했다 (2026-11-12)

`workflows.service.ts` 가 캔버스 저장과 버전 복원에서 400 으로 내고 프론트엔드도 이 코드의 안내 문구를 두는데(`backend-labels.ts`) 카탈로그에 없어 규칙 8 을 어겼다. 도메인 참조 절을 새로 만들지 않고 §6.4 에 직접 등재했다. `ALERT_RULE_NOT_FOUND` 의 직접 등재 선례를 따랐다. 정의 문서는 규칙과 심각도를 정하는 [그래프 경고 규칙](../CLE-WF/CLE-WF-WARN.md)과 저장 흐름을 정하는 [워크플로우 데이터와 저장 흐름](../CLE-WF/CLE-WF-DATA.md)이다.

- **새 코드가 아니다.** 이미 내던 코드를 등재만 했다. 이름 · 상태 코드 · `details.errors` 형태는 그대로다.
- **`VALIDATION_ERROR` 로 합치지 않는다.** 요청 본문 형식이 틀린 경우가 아니라 저장하려는 그래프가 규칙에 걸린 경우다. 클라이언트는 이 코드로 캔버스의 오류 배지를 보라는 안내를 고른다.
- **도구 payload 예산 규칙도 이 코드를 쓴다.** 그래프 규칙 평가를 통과한 뒤 따로 평가하고 `AI_AGENT_TOOL_BUDGET_STRICT_SAVE=true` 일 때만 저장을 막는다. 막는 이유가 같아(저장할 그래프의 규칙 위반) 코드를 나누지 않았다.

### 토큰 검증의 401 을 `NO_WORKSPACE_AVAILABLE` 로 옮겼다 (2026-11-14)

2026-11-12 결정을 NERV Task `CLE-T-ZPPWK4` 가 구현하면서 행을 바꿨다. 조건과 메시지(`No workspace found for user`)는 그대로다. 행이 하나만 남아 관리 경로 행의 「(관리 경로)」 구분도 지웠다. 결정 근거는 [웹훅 · 트리거 · 채팅 채널](CLE-API-ERRCODES-TRIGGER.md#404-가-아닌-_not_found-세-코드를-정리했다-2026-11-12) 에 있다.

### 테스트 데이터셋 이름 중복 `DUPLICATE_NAME` 을 등재했다 (2026-11-14)

NERV Task `CLE-T-KCZGP6` 에서 행만 더했다. 백엔드가 409 로 내는데 §6.4 에 없어 규칙 8 을 어겼다. 이름과 상태 코드는 그대로다. 노드 라벨 중복의 `DUPLICATE_NODE_LABEL` 처럼 `RESOURCE_CONFLICT` 의 특화 코드로 적었다. 이름에 도메인 범주(`<DOMAIN>_`)가 없지만 규칙 3 은 권장이라 §3 예외 등록부에 올리지 않고, 규칙 5 에 따라 이름을 그대로 둔다(NERV Task `CLE-T-GWC9M3`).
