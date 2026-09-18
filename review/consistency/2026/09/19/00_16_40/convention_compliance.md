# 정식 규약 준수 검토 — spec/2-navigation/ (--impl-prep)

검토 대상: `spec/2-navigation/2-trigger-list.md` 를 중심으로 한 "Webhook `endpoint_path` 전역
유일" 변경(관련 diff: `spec/1-data-model.md` · `spec/5-system/12-webhook.md` ·
`spec/5-system/2-api-convention.md` · `spec/5-system/3-error-handling.md` ·
`spec/data-flow/10-triggers.md` · `spec/7-channel-web-chat/5-admin-console.md`). 함께 로드된
`spec/2-navigation/1-workflow-list.md` · `spec/2-navigation/3-schedule.md` 도 구조 대조용으로
확인했다. 나머지 `spec/2-navigation/**` 15개 파일은 프롬프트 예산 초과로 본문이 생략돼 있어,
프런트매터·목차만 실측 가능한 범위에서 확인했다(전수 대조 불가는 아래 위험도에 반영).

## 확인한 범위와 방법

- `spec/conventions/error-codes.md` · `swagger.md` · `secret-store.md` · `audit-actions.md` ·
  `chat-channel-adapter.md` · `egress-masking.md` · `migrations.md` · `spec-impl-evidence.md` 를
  직접 `Read` 로 열어(번들이 대부분 "컨텍스트 예산 초과"로 절단돼 있었으므로) 대조했다.
- `2-trigger-list.md` 가 인용하는 모든 `details.field`/`details.code`/에러 코드/감사 액션/
  ChatChannelConfig enum 값을 각 SoT 규약 문서의 실제 절과 1:1 대조했다.
- frontmatter `code:`/`pending_plans:` 의 경로·글롭이 실제로 존재하는지 `ls`/`find` 로 표본
  검증했다(전부 매치).
- `spec/` 전체에서 "워크스페이스 단위" + `endpoint_path` 잔존 참조를 grep 해 이번 전역화 변경이
  다른 문서에 stale 문구를 남기지 않았는지 확인했다.

## 발견사항

- **[INFO]** `2-trigger-list.md` frontmatter 의 `pending_plans:` / `code:` 순서가 형제 문서와 다르다
  - target 위치: `spec/2-navigation/2-trigger-list.md` frontmatter (파일 상단, `id: trigger-list` 직후)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2 "Frontmatter 스키마" 예시 순서
    (`id → status → code → pending_plans → user_guide`)
  - 상세: `2-trigger-list.md` 는 `pending_plans:` 를 `code:` **앞**에 적어 스키마 예시·형제 파일
    (`1-workflow-list.md` 는 `code:` 가 `pending_plans:` 보다 먼저)과 순서가 다르다. YAML 파서는
    키 순서에 의존하지 않고 `spec-code-paths.test.ts`/`spec-pending-plan-existence.test.ts` 등
    가드도 순서를 검사하지 않으므로 기능적 영향은 없다 — 문서 간 일관성 차원의 사소한 제안이다.
  - 제안: 다음에 이 frontmatter 를 편집할 때 `code:` 를 `pending_plans:` 앞으로 옮겨 형제 문서·
    규약 예시와 순서를 맞춘다. 지금 당장 별도 커밋으로 고칠 실익은 낮다.

## 강한 준수(negative-check 통과) 근거 — 별도 조치 불요, 기록용

아래는 "위반이 없음을 실측으로 확인"한 항목이다. 규약 표류 소지가 있어 보였으나 각 규약의
실제 SoT 절과 대조해 **의도된 형태와 일치**함을 확인했다.

- `details.field='endpoint_path'` 가 요청 바디의 camelCase `endpointPath` 와 달라 보이지만,
  `spec/5-system/2-api-convention.md` §5.3 "details 의 형태" 표가 정확히 이 사례를
  `TRIGGER_ENDPOINT_PATH_CONFLICT` (`{ field: 'endpoint_path', code: … }`) 로 명시 채택하고 있다 —
  DB 컬럼명 표기가 이 코드의 확립된 형태이고 이번 diff 가 새로 만든 것도 아니다.
- 에러 코드 `TRIGGER_ENDPOINT_PATH_CONFLICT` 는 uniqueness 범위가 워크스페이스 단위 → 전역으로
  바뀌었는데도 **rename 되지 않았다** — `error-codes.md` §1/§2(의미 기반 명명 + rename=breaking
  change 회피)를 정확히 지키는 선택이다. 코드가 뜻하는 "동일 endpointPath 충돌" 의미는 범위가
  넓어져도 거짓이 되지 않는다.
- 감사 액션 `trigger.chat_channel_bot_token_rotated` / `trigger.notification_secret_rotated` /
  `trigger.interaction_token_revoked` / `trigger.deleted` / `trigger.updated` 전부
  `audit-actions.md` §3 레지스트리와 정확히 일치(`<resource>.<verb>`, 과거분사, 언더스코어 토큰).
- `uiMapping.formMode`/`visualNode`/`buttonLayout` enum 값·default 가 `chat-channel-adapter.md`
  §2.3 `ChatChannelConfig` 타입 선언과 정확히 일치.
- `botToken`/`inboundSigningPlaintext` 의 write-only·마스킹 미차용 서술이 `secret-store.md` §1.1
  및 `egress-masking.md` 의 "비대상 — `AuthConfig.config` 필드 마스킹"(SoT 는 데이터 모델
  §2.17.2) 경계와 정확히 일치 — 서로 다른 두 "마스킹" 개념을 혼동하지 않고 올바른 SoT 를 인용.
  (자체적으로도 "***<last4> 마스킹 규약은 Reveal 가능한 자격증명용이라 write-only 필드에
  차용하지 않는다"고 명시해 두 정책의 경계를 스스로 설명한다.)
  `secret://` URI scheme (`secret-store.md`) 은 이 필드들의 대상이 아니라 `botTokenRef`/
  `inboundSigningRef` 라는 **ref** 필드가 대상이며, 그 구분도 문서 안에서 일관되다.
  ChatChannelConfig 는 이 컨벤션의 §2.3 정의를 참조로만 가리키고 재선언하지 않아 SoT 이중화도
  피했다.
- `PATCH /api/triggers/:id` 의 `details.field`/`details.code` 조합(`INVALID_FIELD`, 값에 따라
  flat vs nested)이 `api-convention.md` §5.3 "field 를 실으면 code 도 싣는다" 규칙과
  `swagger.md` 의 `writeOnly`/`readOnly` 필드 정책 어디에도 위반이 없다.
- frontmatter `code:`/`pending_plans:` 의 모든 경로·글롭 표본이 실제 파일에 매치하고
  (`endpoint-path-conflict-wrap*.ts`, `trigger-workflow-ref*.ts`, `trigger-config-lock.ts` 등),
  `pending_plans` 의 `plan/in-progress/spec-draft-nullable-notation-followups.md` 도 실존한다 —
  `spec-impl-evidence.md` §4 가드가 요구하는 조건을 충족.
- V131/V132 마이그레이션 번호는 현재 저장소 max(V130) + 1, +2 로 `migrations.md` §2 단조
  증가·gap 금지 규칙과 정합한다(아직 코드로 구현되지 않은 것은 --impl-prep 단계이므로 정상).
- `endpoint_path` 전역화 서술은 `1-data-model.md`·`5-system/12-webhook.md`·
  `5-system/2-api-convention.md`·`5-system/3-error-handling.md`·`data-flow/10-triggers.md`·
  `7-channel-web-chat/5-admin-console.md` 전체에서 취소선 처리(`~~...~~`) 또는 "2026-09-18 이전"
  캐비엇으로 일관되게 동기화되어 있다 — "워크스페이스 단위" 잔존 stale 문구를 spec 전체에서
  찾지 못했다(위 6개 파일 밖으로는 이 필드를 언급하는 곳이 없다).
- 문서 3섹션 구성(Overview/본문/Rationale) 은 `project-planner/SKILL.md` §"Spec 문서 구조"의
  "다중 spec 파일을 가진 영역은 `_product-overview.md` 별도 파일" 규칙에 따라 `2-trigger-list.md`
  가 자체 `## Overview` 없이 `_product-overview.md` 로 링크만 거는 것이 정상 패턴이며 위반이
  아니다.

## 검증하지 못한 영역

`spec/2-navigation/` 의 15개 파일(`4-integration.md`·`6-config.md`·`_layout.md` 등)은 프롬프트
번들이 "컨텍스트 예산 초과로 생략"됐고 이번 리뷰에서 개별 `Read` 로 전수 열람하지 못했다. 이
diff 가 그 파일들의 내용에 직접 손대지 않았고 grep 상 `endpoint_path` 워크스페이스-단위 언급이
없음을 확인했으므로 이번 변경 범위에서 리스크는 낮다고 판단하지만, "내용이 없다"는 근거로
쓰지 않는다 — 별도 라운드에서 전수 확인이 필요하면 그 파일들을 직접 `Read` 할 것을 권장한다.

## 요약

이번 변경의 실질 target 인 `spec/2-navigation/2-trigger-list.md` 는 `spec/conventions/**` 의
명명(에러 코드 UPPER_SNAKE_CASE·감사 액션 dot-prefix·Update DTO 접두)·출력 포맷
(`details.field`/`details.code` 형태 선택)·API 문서(Swagger DTO·writeOnly/readOnly)·금지 항목
어느 축에서도 위반을 찾지 못했다. 오히려 endpoint_path 유일성 범위 변경처럼 여러 문서에 걸친
수정임에도 각 문서가 SoT 를 정확히 인용하고 stale 문구 없이 동기화된 점, 그리고 의미가 넓어진
에러 코드를 규약대로 rename 하지 않은 점이 규약을 의도대로 적용한 사례로 확인된다. 유일한
지적은 frontmatter 키 순서의 사소한 불일치(INFO)뿐이다.

## 위험도

NONE
