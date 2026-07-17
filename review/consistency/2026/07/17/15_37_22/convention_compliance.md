# 정식 규약 준수 검토 — spec/7-channel-web-chat/

## 검토 방법

target(`spec/7-channel-web-chat/0-architecture.md` · `1-widget-app.md` · `2-sdk.md` · `3-auth-session.md` ·
`4-security.md` · `5-admin-console.md` · `_product-overview.md`) 전체를 읽고, `spec/conventions/**` 24개 문서 중
target 이 실제로 참조하거나 적용 대상인 항목을 골라 대조했다. 특히 diff-base(`origin/main`) 대비 신규 변경분
(`1-widget-app.md` 의 `execution.replay_unavailable` 소비 분기 갱신, `spec/conventions/conversation-thread.md` ·
`interaction-type-registry.md` 의 `rag` source 제거)을 워킹트리 절대경로 기준으로 재확인했다.

대조한 conventions: `spec-impl-evidence.md`(frontmatter 스키마) · `swagger.md`(DTO/wrapping) ·
`error-codes.md`(에러 코드 명명) · `conversation-thread.md` · `interaction-type-registry.md` ·
`i18n-userguide.md`(적용범위 §) · `secret-store.md` · `data-hydration-surfaces.md` · `node-cancellation.md` ·
`chat-channel-adapter.md`(적용 여부만 확인, 대부분 비대상으로 판정). CLAUDE.md 의 `_product-overview.md`·`0-` prefix
명명 컨벤션도 함께 확인.

## 발견사항

- **[INFO]** Rationale 항목(`### R<n>.`) 번호가 문서마다 1부터 시작하지 않고 서로 중복
  - target 위치: `1-widget-app.md`(R4~R10, R1~R3 없음) · `2-sdk.md`(R2~R6, R1 없음) · `3-auth-session.md`(R3~R6, R1~R2 없음). 반면 `0-architecture.md`(R1~R5) · `4-security.md`(R1~R6) · `5-admin-console.md`(R1~R7) 는 1부터 연속.
  - 위반 규약: 없음 — `spec/conventions/**` 에는 Rationale 항목 번호 체계(연속성·전역 유일성)를 규정한 문서가 없다. CLAUDE.md·`project-planner/SKILL.md` 도 "3섹션(Overview/본문/Rationale)" 구성만 요구할 뿐 번호 규칙은 명시하지 않는다.
  - 상세: 같은 `R4` 라는 라벨이 `0-architecture.md`(런처/패널 iframe 구조) · `1-widget-app.md`(Next.js CSR 전용) · `2-sdk.md`(show/hide vs open/close) 세 문서에서 서로 다른 내용으로 존재하고, `R5` 는 네 문서에 걸쳐 존재한다. 모든 상호 참조가 `[<파일> §R<n>]` 형태로 파일명을 항상 동반하므로(예: `1-widget-app.md` R5 → `[2-sdk §R4]`) 실제 링크 오귀속은 없었다 — 기능적 결함은 아니고 가독성 측면의 사소한 비일관성이다.
  - 제안: 문서별 로컬 번호를 유지할 경우 각 문서 Rationale 섹션 서두에 "번호는 문서 로컬"이라는 한 줄을 남기거나, 굳이 정합이 필요하면 각 문서를 R1부터 재번호. 규약 자체를 신설할 실익은 낮음(정식 규약화 불필요, 스타일 취향 수준).

## 정식 규약별 확인 결과 (양성 소견)

- **frontmatter 스키마 (`spec-impl-evidence.md`)**: 6개 파일 모두 `id`(kebab-case, `web-chat-` prefix 로 전역 유일 — 실제 `grep -rn "^id: "` 로 충돌 없음 확인) · `status: implemented` · `code:` 글로브를 갖췄고, 모든 `code:` 경로가 워킹트리에 실존함을 직접 확인(`test -e`)했다. `4-security.md` 의 `id: web-chat-security  # basename 과 의도적으로 다름…` 인라인 주석은 `spec-impl-evidence.md` 자신의 스키마 예시(`id: chat-channel  # kebab-case…`)와 동일한 패턴이라 오히려 모범 사례.
- **문서 구조(Overview/본문/Rationale, `_product-overview.md`)**: 6개 파일 모두 `## Overview` + 번호 본문 + `## Rationale` 3단 구성을 지킨다. `_product-overview.md` 는 리터럴 `## Overview` 헤딩 없이 "## 1. 개요/문제"로 시작하는데, 이는 `spec/2-navigation` · `spec/3-workflow-editor` · `spec/4-nodes` · `spec/5-system` 의 기존 `_product-overview.md` 들과 동일한 레포 전역 패턴(문서 전체가 Overview 역할)이라 위반 아님.
- **출력 포맷 규약(swagger.md 응답 wrapping, DTO 명명)**: `4-security.md` 가 인용하는 `swagger.md#2-5-응답-wrapping` 앵커가 실존하고 내용도 일치. 신규 엔드포인트 `GET /api/hooks/:endpointPath/embed-config` 의 실제 컨트롤러 코드(`hooks.controller.ts`)를 확인한 결과 `@Public()` · `@ApiOperation` · `@ApiParam` · `@ApiOkWrappedResponse(EmbedConfigDto, …)` 로 swagger.md §2-5·§5-2 헬퍼 패턴을 정확히 따른다. DTO 파일 위치도 `codebase/backend/src/modules/hooks/dto/responses/embed-config-response.dto.ts` 로 §5-1 규약(`dto/responses/*-response.dto.ts`)과 일치, 클래스명 `EmbedConfigDto`(Response 접미사 없음)도 `FolderDto`/`NodeDto`/`TriggerDto`/`InteractAckDto` 등 기존 코드베이스 관례와 부합. `InteractAckDto` 필드(`{executionId, accepted, currentStatus}`) 인용도 실제 코드와 일치.
- **에러 코드 명명(error-codes.md)**: `WEBCHAT_IDLE_TIMEOUT`(`webchat-idle-reaper.service.ts`) · `STATE_MISMATCH`(`interaction.service.ts`) 모두 실제 코드에 UPPER_SNAKE_CASE 로 존재하며, EIA spec 의 Rationale(R19)이 "`CHANNEL_` 이 아닌 `WEBCHAT_` prefix 채택 근거(Chat Channel 모듈과의 네이밍 혼동 회피)"까지 명시해 §1 의미 기반 명명 원칙을 그대로 따른다. `GENERIC_ERROR_MESSAGE` 는 서버 `error.code` 가 아니라 위젯 로컬 상수명(`use-widget.ts`)이라 error-codes.md 적용 대상이 아님(오분류 아님).
- **conversation-thread.md / interaction-type-registry.md**: target 이 인용하는 "backend 5값"(§1.1), "EIA 외부 3값 매핑"(§1.2), "`source: 'ai_assistant'` 한정 영속"(§2.1), "`message` 필드(not `text`)" 등은 모두 최신 conventions 본문과 1:1 일치. 특히 이번 diff 로 conventions 쪽에서 `rag` source 가 제거됐는데(`interaction-type-registry.md`/`conversation-thread.md`), target 문서 전체를 grep 한 결과 `rag`/`RAG` 참조가 전혀 없어 drift 가 발생하지 않았다. `conversation-thread.md §2.1` 은 오히려 "[웹채팅 위젯 §2](../7-channel-web-chat/1-widget-app.md)" 로 target 을 역참조하고 있어 상호 정합이 이미 명시적으로 맞물려 있다.
- **i18n-userguide.md**: target 의 위젯 chrome i18n 설계(위젯 로컬 catalog, ko/en parity, 메인 앱 dict 미적용, 문체 Principle 6 공유)는 i18n-userguide.md `## 적용 범위 (Scope)` 절 및 `### 왜 channel-web-chat 위젯은 메인 앱 dict 밖에서 자체 chrome i18n 을 쓰는가` Rationale 항목과 문구 수준까지 일치한다. `{{name}}` 이중 중괄호 보간 표기도 메인 앱 dict(`frontend/src/lib/i18n/dict/ko/auth.ts` 등)와 동일 패턴임을 확인. ko/en catalog(`codebase/channel-web-chat/src/lib/i18n/catalog.ts`) 는 leaf key parity 가 실제로 맞는다(육안 대조, 각 30키).
- **금지 항목**: swagger.md §6 레거시 패턴(빈 껍데기 `@ApiOkResponse` 스키마, `{data:{items,...}}` 오형상), error-codes.md §2 rename 정책, i18n-userguide Principle 3-C 금지(backend 한국어 직접 발행) 등 명시적 금지 패턴에 해당하는 사례를 target 에서 찾지 못했다.
- **네이밍(npm scope 등)**: `2-sdk.md` 가 "npm scope 확정: `@workflow/web-chat`" 라 서술한 부분은 실제 `codebase/packages/web-chat-sdk/package.json` 의 `"name": "@workflow/web-chat"` 및 그 옆 `"//name"` 코멘트(spec 역참조)와 정확히 일치.

## 요약

`spec/7-channel-web-chat/` 는 `spec/conventions/**` 정식 규약을 매우 높은 정밀도로 준수하고 있다. frontmatter 스키마·문서 3단 구조·swagger DTO/wrapping 패턴·에러 코드 명명·conversation-thread/interaction-type-registry 의 wire 필드·i18n 적용범위까지 실제 코드(`hooks.controller.ts`·`embed-config-response.dto.ts`·`interact-ack-response.dto.ts`·`catalog.ts`·`use-widget.ts` 등)와 교차 검증한 결과 실질적 불일치를 찾지 못했다. 특히 이번 리뷰의 핵심 diff(`1-widget-app.md` 의 `execution.replay_unavailable` 소비 완료 서술)는 EIA spec 의 `R-replay-unavailable` Rationale 및 실제 `use-widget.ts` `handleEiaEvent`/`seedWaitingFromStatus` 구현과 정확히 부합했고, 같은 커밋에서 `spec/conventions/conversation-thread.md`·`interaction-type-registry.md` 에서 제거된 `rag` source 가 target 에 잔존 참조를 남기지도 않았다. 유일한 지적 사항은 Rationale 항목 번호가 문서마다 1부터 시작하지 않는 스타일 상 사소한 비일관성이며, 이는 어떤 정식 규약도 규정하지 않는 항목이라 위반이 아니다.

## 위험도

LOW
