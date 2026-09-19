# 정식 규약 준수 검토 — spec/2-navigation/

## 검토 범위·방법

- 모드: `--impl-done`, scope=`spec/2-navigation/`, diff-base=`origin/main`. 이 브랜치(`entity-column-drift-b83f15`)는 `spec/2-navigation/` 을 변경하지 **않았다** (델타 0개 파일 — 실제 코드 diff 는 backend 엔티티 컬럼 선언 9개 파일 + `plan/in-progress/spec-draft-nullable-notation-followups.md` 로, navigation 영역과 무관함을 `git diff origin/main...HEAD --stat` 로 직접 확인). 델타 0 자체는 CRITICAL 근거로 쓰지 않았다.
- 델타가 없으므로 본 검토는 `spec/2-navigation/**` 현재 상태에 대한 **standing 준수 점검**으로 수행했다. 프롬프트 번들이 컨텍스트 예산으로 다수의 `spec/conventions/*.md` 본문을 절단했기 때문에, 해당 규약 원문은 워크트리 절대경로(`/Volumes/project/private/clemvion/.claude/worktrees/entity-column-drift-b83f15/spec/conventions/*.md`)에서 직접 재조회해 대조했다.
- 집중 대조: `spec/conventions/spec-impl-evidence.md`(frontmatter 스키마) · `secret-store.md`(secret ref 노출 금지) · `swagger.md`(DTO/decorator 명명) · `error-codes.md`(에러 코드 명명·details 페어링) · `audit-actions.md`(감사 액션 명명) · `redis-keys.md`(advisory lock 키 소유권) · `chat-channel-adapter.md`(uiMapping enum) · `frontend-layering.md`. 대상 문서는 `spec/2-navigation/2-trigger-list.md`(본문 전문) · `3-schedule.md`(본문 전문) · 나머지 `spec/2-navigation/*.md` 는 frontmatter 전수 스팟체크.

## 발견사항

검토 범위 안에서 **CRITICAL/WARNING 위반을 발견하지 못했다.** 아래는 확인한 준수 근거와 INFO 수준 관찰이다.

- **[INFO]** `frontmatter` 스키마 준수 확인
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter, `3-schedule.md` frontmatter, `spec/2-navigation/*.md` 전수
  - 대조 규약: `spec/conventions/spec-impl-evidence.md` §2~§3
  - 상세: `2-trigger-list.md` 는 `status: partial` + `pending_plans:`(`spec-draft-nullable-notation-followups.md`) 를 갖춰 §3 의무를 충족한다. `code:` 리스트 중간의 `#` 주석 라인들도 2026-09-06 파서 수정(빈 줄·`#` skip) 이후 상태라 entry 유실 위험이 없다. `9-user-profile.md`(partial, pending_plans 보유) · `8-marketplace.md`(backlog, id `marketplace` 가 `spec/0-overview.md` 본문에 등장) 등 나머지 파일도 §3 라이프사이클 규칙과 일치한다. `id:` 는 파일 basename 의 숫자 prefix 를 제거한 형태(`2-trigger-list.md` → `trigger-list`)를 쓰는 저장소 관행과 일치한다.
  - 제안: 없음 (준수 확인용 기록).

- **[INFO]** secret ref 비노출 규약 준수 확인
  - target 위치: `2-trigger-list.md` §2.3.1 "내부 ref (`botTokenRef`, `inboundSigningRef`) 는 사용자에게 노출하지 않음" 행 및 하단 요약 문단
  - 대조 규약: `spec/conventions/secret-store.md` §1.1 "비대상 필드도 응답 바디에는 나가지 않는다"
  - 상세: target 은 `botTokenRef`/`inboundSigningRef` 를 UI·응답 어디에도 노출하지 않고 `hasBotToken: boolean` 파생값만 노출한다고 명시해 secret-store.md §1.1 및 swagger.md §1-5(`writeOnly`/`readOnly` 패턴)와 정확히 정합한다. `secret://triggers/<id>/…` ref 서술도 §1 URI scheme(`secret://<scope>/<resourceId>/<name>`)과 일치한다.
  - 제안: 없음.

- **[INFO]** Swagger DTO 명명·패턴 준수 확인
  - target 위치: `2-trigger-list.md` §3 "SoT: `update-trigger.dto.ts`", §2.3.1 `botToken`/`inboundSigningPlaintext` write-only 서술
  - 대조 규약: `spec/conventions/swagger.md` §1-5, §1-7
  - 상세: PATCH 바디 DTO 는 `UpdateTriggerDto`(top-level 요청 바디) 패턴을 따르는 것으로 서술되어 §1-7 의 `Update<Entity>Dto` 규칙과 맞는다. `botToken`/`inboundSigningPlaintext` 는 "응답에 실리지 않는 입력 전용" 으로 서술되어 §1-5 `writeOnly` 의무와 일치한다.
  - 제안: 없음.

- **[INFO]** 감사 액션·advisory lock 키 명명 준수 확인
  - target 위치: `2-trigger-list.md` §3 API 표의 `trigger.chat_channel_bot_token_rotated` / `trigger.notification_secret_rotated` / `trigger.interaction_token_revoked`, §3 "동시 쓰기 직렬화" 의 `trigger-config:<triggerId>`
  - 대조 규약: `spec/conventions/audit-actions.md` §3 도메인별 분류 레지스트리, `spec/conventions/redis-keys.md` §4
  - 상세: 세 감사 액션명은 레지스트리 표(trigger 행, "구현 (2026-08-11)")와 문자 그대로 일치한다. `trigger-config:<triggerId>` advisory lock 키는 redis-keys.md §4 인접 네임스페이스 표에 정확히 이 문서(`2-trigger-list.md §3`)를 SoT 로 지목하고 있어 순환 참조가 착지한다.
  - 제안: 없음.

- **[INFO]** chat-channel `uiMapping` enum 값 정합 확인
  - target 위치: `2-trigger-list.md` §2.3.1 `uiMapping.formMode`/`visualNode`/`buttonLayout` 행
  - 대조 규약: `spec/conventions/chat-channel-adapter.md` §2.3
  - 상세: `formMode`(`multi_step`/`native_modal`/`auto`), `visualNode`(`text`/`photo`/`auto`), `buttonLayout`(`auto`/`vertical`/`horizontal`) 세 enum 모두 convention 원문과 토큰 단위로 일치한다.
  - 제안: 없음.

- **[INFO]** (경미 — 확증 아님) `languageHints` 필드의 map 개방성 표기
  - target 위치: `2-trigger-list.md` §2.3.1 "Chat Channel | `languageHints`" 행 — `Record<string, string>` — `groupChatRefusal`/`executionStarted`/`executionCompleted`/`executionStillRunning`/`help` **등**
  - 대조 규약: `spec/conventions/swagger.md` §1-4 "열린/동적 map… **'타입을 특정하기 번거롭다'는 사유로 쓰지 않는다**"
  - 상세: 나열된 5개 키가 이미 알려진 고정 vocabulary 처럼 보여, 실제로 key 공간이 열려 있는지("등" 이 진짜 확장 가능성을 뜻하는지) spec 문면만으로는 판별이 안 된다. §1-4 는 "variant 집합이 코드로 확정되면" 닫힌 union 이어야 한다고 규정하므로, 실제 DTO 코드(`chat-channel-config.dto.ts`)에서 이 키 집합이 닫혀 있다면 표기를 어긋나게 읽을 여지가 있다. 다만 이는 코드 미대조 상태의 추정이라 CRITICAL/WARNING 으로 올리지 않는다.
  - 제안: 코드 대조가 가능한 세션에서 `chat-channel-config.dto.ts` 의 `languageHints` 선언이 실제로 열린 map 인지(예: 어댑터별 추가 키 허용) 1회 확인 권장. 열려 있다면 현재 표기는 문제 없음.

## 미검토/예산 절단 영역

- `spec/2-navigation/4-integration.md`(161K자) · `6-config.md` · `9-user-profile.md` 본문 · `_layout.md` 는 번들 예산 절단으로 본문을 전량 대조하지 못했다(frontmatter 만 확인). 이 영역들의 규약 준수는 이번 검토로 보증되지 않는다 — 필요 시 별도 세션에서 절대경로 직접 Read 로 재검토 권장.
- `spec/conventions/error-codes.md` §4.2 의 `details[].code` 표(`MISSING_REQUIRED_FIELD` 등)와 target 이 쓰는 `INVALID_FIELD`/`TRIGGER_ENDPOINT_PATH_CONFLICT` 는 서로 다른 레이어(trigger 파라미터 검증 vs PATCH 필드 검증)임을 확인했고, 두 값 모두 `spec/5-system/2-api-convention.md` §5.3 에 등록된 값이라 위반이 아니다.

## 요약

`spec/2-navigation/` 은 이번 PR 에서 변경되지 않았으며(델타 0), standing 점검 결과 frontmatter 스키마(`spec-impl-evidence.md`)·secret ref 비노출(`secret-store.md`)·Swagger DTO 명명(`swagger.md`)·감사 액션 명명(`audit-actions.md`)·advisory lock 키 소유권(`redis-keys.md`)·chat-channel enum(`chat-channel-adapter.md`) 등 대조 가능한 모든 축에서 `spec/conventions/**` 와 정합했다. `2-trigger-list.md`·`3-schedule.md` 는 특히 secret 노출·에러 코드 페어링·응답 부재 표현 등 세부 규약을 정확히 인용하며 서술이 규약 원문과 토큰 단위로 일치한다. 컨텍스트 예산으로 `4-integration.md`/`6-config.md`/`9-user-profile.md` 본문은 전량 대조하지 못했으므로 그 부분은 이번 판정에서 제외한다. CRITICAL/WARNING 은 발견하지 않았다.

## 위험도

NONE
