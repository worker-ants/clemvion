# 정식 규약 준수 검토 — impl-chat-channel-patch-token (--impl-done, scope=spec/5-system)

## 검토 방법 메모

`_prompts/convention_compliance.md` 는 컨텍스트 예산 초과로 **실제 diff 본문과
`spec/5-system/15-chat-channel.md` 전문, `spec/conventions/**` 전문이 전부 절단**돼 있었다
(플레이스홀더만 존재). 프롬프트의 자체 지시("여기 없다는 사실을 근거로 삼지 말 것")에 따라
워킹트리(`/Volumes/project/private/clemvion/.claude/worktrees/impl-chat-channel-patch-token-a17c4e`,
현재 CWD 와 일치)에서 다음을 직접 재취득해 검토했다:

- `git diff origin/main...HEAD -- codebase/backend/src/modules/triggers/** codebase/backend/test/trigger-workflow-ref.e2e-spec.ts codebase/frontend/src/content/docs/**`
- `spec/5-system/15-chat-channel.md` §5.4.1 · §5.4.1.1 · R-CC-10 · R-CC-21
- `spec/conventions/swagger.md`, `secret-store.md`, `error-codes.md`, `i18n-userguide.md`, `review-citations.md`
- `codebase/backend/src/repo-guards/__tests__/dto-jsdoc-citation-guard.ts`(+ `.spec.ts`), 실제 설치된
  `@nestjs/swagger@11.4.5` 플러그인 소스, `plan/in-progress/impl-chat-channel-patch-token.md`

## 발견사항

- **[INFO] `ChatChannelUpdateConfigDto` 클래스 JSDoc 의 내부 인용 위치 — 이미 추적 중인 미결 질문**
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:349-377` (신규 `ChatChannelUpdateConfigDto`)
  - 위반 규약: `spec/conventions/swagger.md` §3 "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를 담지 않는다"
    (표: "왜 이 값이 이 타입인지의 경위·리뷰 참조 → 바로 위 `//` 주석")
  - 상세: 클래스 바로 위에 `/** ... */` JSDoc(§5.4.1/§5.4.1.1/R-CC-21 표 비교)을 먼저 두고, "왜
    `OmitType`인가"·"왜 optional 로 두지 않는가"·"왜 `Patch`가 아니라 `Update`인가" 같은 **내부
    경위 서술**을 그 아래 `//` 블록으로 뒤에 배치했다. 기존 선례(`schedule-response.dto.ts` —
    `//` 내부 서사가 **먼저**, 소비자용 `/** */` 가 클래스 바로 위에 **나중**)와 순서가 반대다.
    다만 실측 결과 이 저장소가 설치한 `@nestjs/swagger@11.4.5` CLI 플러그인은
    `createDescriptionAndTsDocTagPropertyAssignments` 를 프로퍼티·생성자 파라미터 노드에만
    호출하고 클래스 선언에는 호출하지 않는다(`model-class.visitor.js` 직접 확인) — 즉 **현재
    설치 버전에서는 클래스 레벨 JSDoc 이 실제로 스키마 `description` 으로 나가지 않는다.**
    반면 같은 저장소의 `dto-jsdoc-citation-guard.ts` 자체 주석은 "클래스는 스키마 description"
    이라 적고 있고, 그 파일의 스펙(`dto-jsdoc-citation.spec.ts`)은 "`§3` 표가 필드/클래스를 안
    가른다는 선행 질문"을 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    등재해 뒀다 — 즉 이 모호함 자체는 이 PR 이 새로 만든 것이 아니라 기존에 추적 중인 미결
    사안이다. 또한 그 guard(`isResponseDtoFile`)는 `dto/responses/**` 파일만 스캔하므로 이
    파일(요청 DTO)은 애초에 그 가드의 스코프 밖이라 자동 검출도 없다.
    (R-CC-21/D-1 자체를 인용하는 관행은 이 파일의 기존 코드가 이미 `@ApiPropertyOptional`
    description 안에 `SS-SE-01`·`CCH-ERR-*` 같은 내부 ID를 직접 노출해 온 것과 같은 층이라,
    "내부 ID 인용" 자체는 이 파일의 기존 선례와 어긋나지 않는다 — 문제는 오직 **JSDoc/`//`
    순서가 선례와 반대**라는 점.)
  - 제안: (a) 코드 쪽 — 순서를 선례와 맞춰 `// 내부 서사` 를 먼저, `/** 소비자용 요약 */` 를
    클래스 바로 위(마지막)로 재배치하면 향후 플러그인 버전이 바뀌어도 안전하다. 다만 현재
    실측상 긴급도는 낮다. (b) 규약 쪽 — 이미 트래커에 있는 "§3 표가 필드/클래스를 안 가른다"
    질문을 이번 실측(위 플러그인 소스 확인 결과)과 함께 planner 턴에서 해소해 `swagger.md` §3
    에 "클래스 레벨 JSDoc 은 현재 버전에서 스키마 description 에 반영되지 않는다"는 각주를
    추가하거나, 반대로 낼 계획이면 규약을 그에 맞게 정정하는 것이 좋다.

- **[INFO] `swagger.md` 라인 인용 2줄 드리프트 — 사소, 비긴급**
  - target 위치: `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts:365`
    (`// (spec/conventions/swagger.md:315, 2026-09-05 규약화. ...)`)
  - 위반 규약: 해당 없음(전용 규약 없음) — `review-citations.md` 는 `review/**` 세션 인용만
    다루고 spec-내부 줄번호 인용 형식은 규정하지 않는다.
  - 상세: 실측 시점(2026-09-11) `spec/conventions/swagger.md` 의 "플러그인이 `introspectComments`
    로 JSDoc 을 `description` 에 그대로 싣는다" 문장은 315행이 아니라 **317행**이다(2줄 드리프트,
    아마 그 사이 다른 PR 이 `swagger.md` 를 편집). 인용 내용 자체(2026-09-05 규약화 사실)는
    정확하다 — 줄 번호만 낡았다.
  - 제안: 급하지 않음. 이 자리를 다음에 건드릴 때 줄 번호 대신 절 이름(`§3`)으로 바꾸면 향후
    드리프트에 면역이 된다.

## 준수 확인 (위반 아님 — 검증 과정에서 명시적으로 대조한 항목)

- **`ChatChannelUpdateConfigDto` 명명** — 저장소에 `Patch` 접두 클래스 0건(grep 확인)이라는
  diff 자체의 주장을 재확인했고, `Create`/`Update` 축(`UpdateTriggerDto`)과 일치. 이미
  `--spec 22_04_23 naming_collision` 라운드에서 검증됨(plan 기록).
- **`writeOnly: true` 의무** (`swagger.md` §1-5) — 신규 `botToken`/`inboundSigningPlaintext`
  override 필드 모두 `writeOnly: true` 동반, 준수.
- **DTO 설명 "보안·정책 캐비엇" 지시** (`swagger.md` §3) — PATCH 거부 사유 설명이 짧지 않고
  왜 400 이 되는지(24h grace·audit action 우회 방지)까지 적어 지시를 따름.
- **`rotate()` vs `store()`** (`secret-store.md` §5.4/§5.5) — 신규 코드의 3개 secret 쓰기
  전부 `secrets.rotate()` 사용, 컨벤션의 "Trigger 생성/setup 경로는 `rotate()` 권장"과 일치.
  (참고: `spec/5-system/15-chat-channel.md` 본문 9곳이 `store()`라 적는 것은 **spec 쪽의 기존
  drift**이며 developer 자신이 이미 `plan/in-progress/impl-chat-channel-patch-token.md` 에
  planner 후속 항목으로 등재해 뒀다 — 이번 diff 가 새로 만든 위반이 아니고, `spec/5-system`
  파일도 이번 PR 에서 변경되지 않았다(scope 델타 0). 별개 관점의 `cross_spec` 검토가 다룰
  사안이라 본 checker 범위에서는 재플래그하지 않는다.)
- **`details[].field` 중첩/배열 경로 유지** (`spec/5-system/3-error-handling.md` §2.1) —
  신규 테스트(`trigger-dto-validation.spec.ts` "[실측] 차단 5필드의 details.field...")가
  전역 파이프의 `chatChannel.<field>` 중첩 경로를 실측으로 고정했고, 이는 §2.1 의 "중첩/배열
  경로를 유지한다" 규약과 일치. 서비스 레이어의 `details: { field: 'botToken' }` (단일 object)
  형태도 같은 파일의 기존 스케줄 타입 검증(`details.field='type', details.disallowed=[...]`)과
  같은 레이어 관례를 따른다.
- **i18n-userguide.md Principle 5/6/6-B** — 신규 사용자 가이드 절(`triggers.mdx/.en.mdx`
  §"Bot Token 회전", `discord/slack/telegram.mdx/.en.mdx` 신규 §5.5/§6.5)이 ko/en sibling 쌍으로
  함께 갱신됐고, 해요체 통일·금지어 없음·`R-CC-21`·`spec/...`·`plan/...` 등 내부 SoT 참조가
  전혀 노출되지 않음을 확인(grep 전수 대조). 신규 절 번호(`5.5`/`6.5`)는 기존 문서가 이미 쓰는
  소수점 삽입 관례(`1.1.A`/`1.1.B` 류)와 일치.
- **`OmitType` 사용 패턴** (`swagger.md` §5) — "중복 필드는 `PickType`/`OmitType`/`PartialType`
  으로 재사용" 규정과 일치하며, 부모의 필수 데코레이터가 새 필드 선언에 그대로 상속되는
  문제를 정확히 인지하고 두 필드를 재선언한 것도 타당.
- **`@nestjs/swagger` 플러그인 설정** (`nest-cli.json` `introspectComments: true`) 전제와
  DTO JSDoc 관행이 이 diff 전반에서 정확히 적용됨(위 INFO 항목 제외).

## 요약

이번 diff(`chatChannel` PATCH 비밀 차단, `ChatChannelUpdateConfigDto` 신설)는 명명·DTO/Swagger
문서화·에러 응답 형식·secret-store 호출 패턴·사용자 가이드 i18n 동기화 등 확인 가능한 모든
축에서 `spec/conventions/**` 를 정확히 인용하며 준수하고 있다. CRITICAL/WARNING 급 위반은
발견하지 못했다. 유일하게 짚을 만한 것은 신규 DTO 클래스의 JSDoc/`//` 주석 배치 순서가 기존
선례(`schedule-response.dto.ts`)와 반대라는 점인데, 실제 설치된 플러그인 동작을 직접 추적한
결과 현재는 기능적 위험이 낮고, 이 회색지대(§3 표가 클래스/필드를 구분하는지) 자체는 이미
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 후속으로 등재돼 있어
새로 발견된 결함이 아니라 기존에 추적 중인 사안의 재확인에 가깝다. `spec/5-system` 자체는 이번
PR 에서 변경되지 않았다(scope 델타 0, 정상).

## 위험도

NONE
