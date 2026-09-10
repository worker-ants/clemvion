# 정식 규약 준수 검토 — Chat Channel PATCH Token (impl-done, scope=spec/5-system, 4라운드)

## 범위와 방법

- `spec/5-system` 델타는 이번에도 0개 파일 — 순수 코드 PR (누적 5커밋, 최신
  `83d5f3f94`). 프롬프트가 예산 절단한 `spec/conventions/*.md` 는 워킹트리 절대경로로
  직접 열어 대조했다: `swagger.md`(전문) · `chat-channel-adapter.md`(§1~§3 확인) ·
  `error-codes.md`(`VALIDATION_ERROR` 관련 절) · `review-citations.md`(전문).
- 직전 3회 라운드(`21_37_56`·`22_45_26`·`23_54_09`)의 `convention_compliance.md` 가 모두
  CRITICAL/WARNING 0, 위험도 LOW/MEDIUM 이하로 수렴한 이력을 확인했고, 이번 라운드는
  그 이후 신규 커밋(`771801fca`·`83d5f3f94`)의 **증분**을 중점 대조했다 — `git diff
  origin/main...HEAD --stat` 로 전체 diff(11파일 코드 + review/plan 산출물)를 실측하고
  `git show 83d5f3f94` 로 마지막 라운드가 무엇을 바꿨는지 직접 읽었다.

## 발견사항

이번 diff 도 `spec/conventions/**` 의 명명·출력 포맷·API 문서·금지 항목 규약을 위반하는
지점을 찾지 못했다. 아래는 CRITICAL/WARNING 이 아니라 완결성 관점의 INFO 다.

- **[INFO]** `spec/5-system/15-chat-channel.md` frontmatter `code:` 가 여전히 이번 PR 의
  신규 배선 파일을 가리키지 않음 (직전 라운드 INFO 미해소, 재확인)
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` 목록 (직접 열어
    재확인 — `triggers.service.ts`·`chat-channel-config.dto.ts`·`triggers.controller.ts`
    는 있으나 `update-trigger.dto.ts`·`trigger-dto-validation.spec.ts`·
    `triggers.service.spec.ts`·`trigger-workflow-ref.e2e-spec.ts` 는 없음)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 `code:` 필드 정의 — 강제
    사항은 아니다(글로브 매치 ≥1 이면 `spec-code-paths.test.ts` 가드는 통과).
  - 상세: `23_54_09` 라운드가 이미 지적했고 이번 라운드까지 3개 커밋이 더 쌓였지만
    frontmatter 는 그대로다. 이 PR 은 `spec/` 쓰기 권한이 없는 developer 산출물이라
    직접 고칠 수 없고, 이 항목이 `spec-draft-nullable-notation-followups.md` 의 다른
    발견들처럼 planner 트래커에 등재되지도 않았다 — 다만 가드 통과에는 영향이 없는
    선택적 완결성 항목이라 CRITICAL/WARNING 격상 사유는 아니다.
  - 제안: `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 이미 등재된
    `store()`↔`rotate()` drift 항목 옆에 한 줄 병기(“`code:` 배선 갱신”)해 두면
    planner 턴에서 함께 처리 가능.

- **[INFO]** 최신 커밋(`83d5f3f94`)의 사용자 문서 정정에 사소한 이중 공백 오타
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` — "토큰
    변경은 **항상  rotate API 만** 사용해요" ("항상" 과 "rotate" 사이 공백 2칸)
  - 위반 규약: 명시적 규약 위반은 아니다(오타는 `swagger.md`/`spec/conventions/**`
    어느 항목도 다루지 않음). 다만 이 문장 자체가 `PROJECT.md` `backend-api-change`
    매트릭스가 요구한 **동반 갱신**의 결과물이라, 사용자 대상 산출물의 품질 관점에서
    적어 둔다.
  - 제안: 다음에 이 파일을 건드릴 때 공백 정리(비차단).

## 준수 확인 (근거 요약 — 신규 diff 증분 대상)

- **DTO 명명 축(`Update*Dto`)·`OmitType` 사용**: 변동 없음, 직전 라운드 판정 유지.
- **오버로드로 `mode`/DTO 타입을 컴파일 타임 결속** (`assertChatChannelInputSafe` 2-오버로드,
  `triggers.service.ts`): 신규 패턴이나 기존 TS 관용구이고 별도 명명 규약 대상 아님 —
  타입 안전성 보강이지 API 표면 변경이 아니다.
- **에러 코드**: `assertPatchCarriesNoSecrets`·`assertChatChannelAlreadySetUp` 신규
  경로 모두 `code: 'VALIDATION_ERROR'` 만 사용 — `error-codes.md` "시스템 전역 공용
  코드" 예외 범주와 일치, 신규 코드 남발 없음.
- **`details.field` 표현**: 이번 라운드의 핵심 정정(W3) — 5필드 판정을 "전부 중첩
  경로"에서 "값의 형태(빈 값 vs 비어있지 않은 값)에 따라 두 갈래"로 좁혔다. 이는
  `3-error-handling.md §2.1` (중첩/배열 경로) 규약 자체를 어기는 변경이 아니라, 그
  규약이 실제로 어떻게 구현에 나타나는지에 대한 **관찰 정밀도 개선**이다. 새 테스트
  (`trigger-dto-validation.spec.ts` `[실측]` 2건)가 네 조합(빈 문자열/문자열 값 ×
  botToken/inboundSigningPlaintext)을 모두 검증해 관찰의 완결성을 갖췄다.
  `assertPatchCarriesNoSecrets`(서비스 층, flat `field`)와 전역 파이프(중첩 `field`)가
  같은 논리적 위반을 서로 다른 레이어에서 잡는 구조 자체는 규약 위반이 아니다 — 어느
  레이어든 `code: 'VALIDATION_ERROR'` + `details.field` 형태를 지킨다.
  트래커(`spec-draft-nullable-notation-followups.md`) 인계도 표로 두 갈래를 모두
  적어 정정했다 — 직전 라운드가 지적한 "한쪽만 보고 넘기면 반대 갈래가 틀린 문서가
  된다" 위험을 스스로 해소했다.
  - **명명 규약 참고**: 이 5필드 중 `botTokenRef`·`inboundSigningRef`·`inboundSigning`
    은 이미 시스템 내부 필드명으로 `error-codes.md`/`node-output.md` 의 UPPER_SNAKE_CASE
    코드값 규약 대상이 아니라 `details.field` 의 **자유 문자열 경로 표기**이므로 별도
    명명 규약 위반 소지 없음.
- **Swagger 문서**: `triggers.controller.ts` 의 `@ApiBadRequestResponse.description`
  이 두 갈래(중첩 배열 vs flat object)를 명시적으로 설명 — `swagger.md §3` "요청 값이
  정책으로 거부될 수 있는 필드는 길어도 반드시 적는다" 지시와 일치, 오히려 이전보다
  더 정확해졌다(직전 라운드는 한 갈래만 서술한 버전을 봤다).
- **사용자 문서 동기화** (W2 대응): `triggers.mdx`/`telegram.mdx` (ko/en 4파일)의
  잘못된 필드명(`botTokenRef`)·잘못된 `details.field` 형식을 정정 — `PROJECT.md`
  `backend-api-change` 매트릭스가 요구하는 동반 갱신 의무를 충족. 정정 후 문구가
  실제 wire(`chatChannel.botToken`)와 일치함을 diff 로 직접 확인.
- **secret store 사용 패턴**: 이번 diff 는 `secrets.rotate()` 호출 패턴을 그대로
  유지(`secrets.store()` 신규 호출 0건) — `secret-store.md §2.1` 과 일치. 발견된
  spec 문면 drift(9→7곳, `store()` 표기)는 이번 커밋에서 트래커에 정식 등재됐다
  (`spec-draft-nullable-notation-followups.md` 신규 항목) — 직전 라운드 INFO #1 이
  요청한 조치가 정확히 수행됐다.
- **review-citations**: 신규 주석(`// 오버로드로 …`, `assertChatChannelInputSafe`
  JSDoc 등)의 세션 인용은 모두 `review/code/2026/09/10/23_55_23 W4` 형식(전체 경로 +
  지적 번호)으로 §2 bare 시각 금지를 지킨다. `ChatChannelUpdateConfigDto`/
  `assertPatchCarriesNoSecrets` 등 공개 OpenAPI 로 나가는 프로퍼티 JSDoc 에는 review
  세션 인용이 없다(§3 "DTO·컨트롤러 JSDoc 대상 아님" 규칙과 무관하게라도 준수).

## 요약

이번(4번째) 라운드에서 추가된 커밋(`771801fca`·`83d5f3f94`)은 이전 라운드가 확정한
CRITICAL 없음 판정을 흔들지 않았다 — 오히려 `details.field` 관찰의 정밀도를 높이고
(W3), 사용자 문서의 사전 존재 오류를 이번 PR 범위에서 동반 정정했으며(W2),
spec-drift 발견을 planner 중앙 트래커에 정식 등재해 직전 라운드의 유일한 실질 INFO를
해소했다. `spec/conventions/**` 의 명명·출력 포맷·문서 구조·API 문서·금지 항목 다섯
관점 모두에서 명시적 위반을 찾지 못했다. 남은 것은 비차단 완결성 항목 2건
(frontmatter `code:` 목록 미갱신 — 3라운드째 지속 · 사용자 문서 이중 공백 오타)뿐이다.

## 위험도

LOW
