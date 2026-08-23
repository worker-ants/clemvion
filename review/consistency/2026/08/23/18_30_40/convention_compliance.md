# 정식 규약 준수 검토 — `spec/5-system/14-external-interaction-api.md`

## 검토 범위 및 방법

`--impl-prep` 모드, target 영역 `spec/5-system/`. 번들(`_prompts/convention_compliance.md`)의
`spec/conventions/**` 섹션은 대부분 컨텍스트 예산 초과로 절단되어 있었으므로, 실제 worktree
파일시스템에서 target 문서(`spec/5-system/14-external-interaction-api.md`, 1794줄) 전문과
target이 명시적으로 인용하는 정식 규약 — `node-output.md`, `egress-masking.md`,
`error-codes.md`, `swagger.md`, `interaction-type-registry.md`, `audit-actions.md`,
`secret-store.md`(발췌), `redis-keys.md`(발췌) — 를 직접 읽어 대조했다. 아울러 이 worktree에
uncommitted 상태로 존재하는 코드 변경(`strip-external-only-fields.ts`의
`NODE_OUTPUT_ALLOWED_KEYS`/`allowlistNodeOutputKeys`, `interaction.service.ts` 배선)과
`plan/in-progress/nodeoutput-allowlist.md`를 대조해 target 문서가 그 변경을 아직 반영하지
않은 상태(= 계획대로 spec 갱신은 별도 planner 턴으로 유예됨)임을 확인했다.

## 발견사항

- **[INFO]** `EIA-NF-05`의 동시성 lock 절 cross-reference가 실제 절 번호와 어긋남
  - target 위치: §3.5 비기능 요구사항, `EIA-NF-05` 행 — "동일 노드에 대한 race 는 **§5.3** 의
    lock 전략으로 직렬화"
  - 위반 규약: 특정 `spec/conventions/*` 항목 위반은 아니며, CLAUDE.md의 "문서 구조 규약"
    (spec 본문의 내부 참조 정확성)에 인접한 일반 문서 정확성 이슈로 분류
  - 상세: 실제 lock/직렬화 내용은 §5.3(단발 상태 조회, `GET /api/external/executions/:id`)이
    아니라 §5.6 "동시성 / Lock (EIA-NF-05)"에 있다(§5.6 본문: "같은 execution의 같은 노드에
    대한 두 inbound 명령이 동시에 들어오면 second-arrival은 `409 STATE_MISMATCH`… 이는 race가
    아니라 명시적 직렬화"). §5.3에는 lock 관련 서술이 없다. 이 문서 안에서 섹션이 여러 차례
    번호를 옮겨 다닌 흔적(R16/R17 등의 "종전 이 문장은…" 정정 이력)이 있어, 과거 리넘버링 때
    plain-text 참조(하이퍼링크가 아니어서 `spec-link-integrity` 류 가드가 못 잡는 형태)가
    갱신되지 않은 것으로 보인다.
  - 제안: `§5.3` → `§5.6`으로 정정. hyperlink가 아닌 산문 섹션 번호 인용이라 자동 가드
    대상 밖이므로 사람이 직접 고쳐야 한다.

- **[INFO]** R17 "`nodeOutput` 일반 키 allowlist" 잔여 서술이 이번 작업 완료 시 즉시 stale화될
  예정 — 착수 시점 인지용 기록
  - target 위치: §R17 "표면 제약(보안)" 불릿 목록 마지막 항목 — "**`nodeOutput` 일반 키
    allowlist (미구현·잔여)**: … 여전히 후속 하드닝 항목이다."
  - 위반 규약: 현재 상태로는 위반 아님. `spec-impl-evidence.md` §2가 요구하는
    `status: partial` + `pending_plans:`(→
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md`, 파일 존재 확인함) frontmatter
    조합과 정확히 정합하며, "미구현" 자기 서술도 현재 코드 상태(이 worktree의 uncommitted
    diff 이전 기준)와 일치한다.
  - 상세: 이 worktree는 이미 `NODE_OUTPUT_ALLOWED_KEYS`(`config`/`output`/`meta`/`port`/`status`
    + wire 전용 `formConfig`/`conversationConfig`/`buttonConfig`/`interactionType`)와
    `allowlistNodeOutputKeys()`를 구현해 `interaction.service.ts`의 `getStatus()`에 배선했다
    (`plan/in-progress/nodeoutput-allowlist.md`의 "작업" 체크리스트 중 코드 항목). 같은 plan은
    "(planner 턴) EIA §R17 잔여 문구 flip + allowlist 를 spec 에 정의"를 **아직 미완료**
    항목으로 명시하고 있고, `developer` 역할은 `spec/`을 쓸 권한이 없어(SKILL 체계) 의도적으로
    분리되어 있다. 따라서 이 지적은 "지금 위반"이 아니라, 이 planner 턴이 실행되면
    ①R17 해당 불릿의 "미구현·잔여" 표기를 실제 구현으로 갱신하고 ②`node-output.md`
    Principle 0(5필드 invariant + `_resumeState`/`_resumeCheckpoint`/`_retryState` 예외
    레지스트리)에도 `formConfig`/`conversationConfig`/`buttonConfig`/`interactionType`이 EIA
    wire 레이어에서 어떤 지위를 갖는지(NodeHandlerOutput 계약의 일부가 아니라 EIA 조립부가
    합성하는 wire-only 필드라는 점)를 함께 손봐야 정합이 유지된다는 점을 남긴다.
  - 제안: 이번 리뷰(--impl-prep) 자체는 target 문서(spec)가 아직 미변경 상태이므로 조치 불요.
    다만 이 항목을 처리하는 planner 턴에서 R17 갱신과 `node-output.md`의 exception 레지스트리
    갱신을 함께 검토 대상에 넣을 것을 권고(별도 conventions 문서까지 걸치므로 spec-sync 트래커
    쪽에 흔적을 남기는 편이 안전 — `feedback_stale_plan_claims_and_checklist_sync` 교훈과 동일
    축).

## 조사했으나 위반 없음 확인 (positive findings)

아래는 위반 가능성이 높아 보였으나 실제로는 conventions와 정합함을 확인한 항목들이다
(오탐 방지를 위해 기록):

- **명명 규약**: 에러 코드(`VALIDATION_ERROR`/`TOKEN_*`/`MASKED_VALUE_RESUBMITTED` 등)는
  `error-codes.md` §1의 `UPPER_SNAKE_CASE` + 의미기반 명명·prefix 정책과 일치. 특히
  `MASKED_VALUE_RESUBMITTED`는 `error-codes.md` §4.2가 "정의 SoT"로 EIA §R17을 정확히
  지목하고, target도 그 값을 그대로 사용해 순환 참조가 아니라 대칭적 SoT 분리로 성립한다.
- **감사 액션 명명**: `trigger.notification_secret_rotated` / `trigger.chat_channel_bot_token_rotated`
  / `trigger.interaction_token_revoked`가 `audit-actions.md` §3 레지스트리("구현
  (2026-08-11)")와 정확히 일치.
- **Swagger/DTO 규약**: §10.1이 `swagger.md` §2-1(대체 Bearer scheme 등록)·§5(응답 DTO 규약)·
  §5-1~§5-5를 정확한 절 번호로 인용하며 내용도 실제 swagger.md 서술과 일치. `discriminator`
  미사용·`oneOf` 사용 판단(§5.3 `context` union)도 swagger.md의 "discriminator는 판별자가
  sound할 때만" Rationale과 정확히 대응(같은 반례를 공유).
- **Egress 마스킹 좌표계 경계**: §R17 도입부가 "구현 좌표계는 별도 규약이 소유한다"며
  `egress-masking.md`로 위임하고, 마커 값 좌표계(깊이 상한·비교 연산자)를 R17 안에서
  재선언하지 않는다 — `egress-masking.md` 자신이 명시한 "EIA §R17을 확장하지 않는다"는
  기각 대안과 정합하는 경계 설정이다. R17이 마커 리터럴(`[REDACTED]`/`***`/`[REDACTED_DEPTH]`)을
  인용하는 것도 egress-masking.md가 명시적으로 허용한 예외("wire 계약 서술 레이어는 정상")에
  해당.
- **Secret 저장 정책**: §7.1이 `interaction.triggerToken`(`itk_*`)을 `Trigger.config` JSONB에
  평문 보관한다고 서술하며 `secret-store.md §1`을 "명시적 비대상 예외"로 정확히 인용 — 실제
  `secret-store.md`에 그 예외(결정 2026-08-16, 동일 근거)가 존재함을 확인.
- **문서 구조 규약**: `## Overview (제품 정의)` → 본문(§1~§12) → `## Rationale`의 3섹션 구성이
  CLAUDE.md/SKILL.md가 권장하는 구조와 일치. frontmatter(`id`/`status: partial`/`code:`/
  `pending_plans:`)도 `spec-impl-evidence.md` §2 스키마와 일치하며 `pending_plans` 대상 파일도
  실존.
- **redis-keys.md 포인터 원칙 인용**: §6 도입부가 "선례: `conventions/redis-keys.md`의 포인터
  원칙"이라 인용한 것은 날조가 아니라 실제로 `redis-keys.md`에 "본 문서는 포인터만 갖는다"는
  동형 원칙이 존재함을 확인(§왜 인벤토리가 포인터만 갖나).
- **interaction-type-registry.md와의 정합**: EIA 외부 표면 3값(`form`/`buttons`/
  `ai_conversation`)이 내부 4값(`WaitingInteractionType`, `ai_form_render` 포함)의 축소
  매핑이라는 target 서술이 `interaction-type-registry.md` §1.1의 "내부 4값 ↔ EIA 외부 3값
  매핑" 서술과 정확히 대응.

## 요약

target 문서(`spec/5-system/14-external-interaction-api.md`)는 정식 규약(`spec/conventions/**`)
준수 관점에서 매우 높은 수준의 정합성을 보인다. 에러 코드 명명, 감사 액션 명명, Swagger/DTO
규약, egress 마스킹 좌표계와의 책임 경계, secret 저장 예외, 문서 3섹션 구조/frontmatter 스키마
등 검증 가능한 항목 전부에서 실제 정식 규약 원문과 정확히 대응하는 절 번호·근거를 인용하고
있어 CRITICAL/WARNING급 위반은 발견되지 않았다. 유일하게 실측으로 확인한 결함은 §3.5
`EIA-NF-05`의 plain-text 섹션 참조 오류(`§5.3` → `§5.6`이어야 함)이며, 이는 자동 링크
무결성 가드의 사각지대(하이퍼링크가 아닌 산문 인용)에 있는 사소한 정확성 이슈다. 추가로,
이 worktree에서 진행 중인 `nodeOutput` allowlist 구현이 완료되면 R17의 "미구현·잔여" 표기와
`node-output.md`의 5필드 예외 레지스트리를 함께 갱신해야 한다는 점을 인지용으로 남긴다 —
다만 이는 현재 시점의 위반이 아니라 계획된 후속 planner 턴의 범위이며, developer가 spec
쓰기 권한이 없어 의도적으로 분리된 정상 흐름이다.

## 위험도

LOW
