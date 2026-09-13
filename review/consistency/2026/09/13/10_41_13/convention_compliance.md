# 정식 규약 준수 검토 — `spec/5-system/` (`--impl-done`, 라운드 2)

## 검토 범위와 방법

`spec/5-system/` 델타는 이번 라운드도 0파일이다(정상 — developer 는 spec 쓰기 권한이 없고,
필요한 spec 변경은 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner
백로그로 등재돼 있다). 라운드 1(이전 `--impl-done` `10_12_54`, `/ai-review` `10_12_19`) 지적
처분 커밋 `a68457936`(17파일 신규 diff 중 `codebase/**` 3파일 + 문서 2파일 + 하네스 산출물)이
**이번 라운드의 실제 검토 대상**이다. `git show a68457936` 로 워킹트리(HEAD)를 절대경로 기준
직접 확인했고, `spec/conventions/swagger.md`·`spec/conventions/user-guide-evidence.md` 전문을
`Read` 로 대조했다.

## 발견사항

- **[WARNING] `TestConnectionResultDto.code` 의 JSDoc 이 내부 서사를 담아 `swagger.md §3` 를 위반한다 — 같은 커밋의 인접 필드가 정반대로 올바르게 처리한 것과 자기모순**
  - target 위치: `codebase/backend/src/modules/integrations/dto/responses/integration-response.dto.ts:464-477`
    (`code?: string` 필드 선언 직전 JSDoc 블록, 커밋 `a68457936` 신규 추가)
  - 위반 규약: `spec/conventions/swagger.md §3` "JSDoc 은 공개 OpenAPI 로 나간다 — 내부 서사를
    담지 않는다" (2026-09-05 규약화). 표: "소비자가 이 필드를 쓰려면 알아야 하는 것 → JSDoc
    `/** */`" vs "왜 이 값이 이 타입인지의 경위, 리뷰·PR 참조 → 바로 위 `//` 주석".
  - 상세: `@nestjs/swagger` CLI 플러그인이 `introspectComments: true` 로 `.dto.ts` 파일의
    JSDoc 을 그대로 OpenAPI `description` 에 싣는다(`nest-cli.json` 확인). `code` 필드의
    JSDoc 은 앞 두 문장("실패 분류 코드 … 성공 시 부재")까지는 소비자용이지만, 이어지는
    두 문단이 순수 내부 서사다 — "**이 선언은 `latencyMs` 의 정반대 방향 결함을 닫는다** —
    그쪽은 선언만 있고 생산자가 0건이었고 …" 는 "왜 이 값이 이 타입인지의 경위"를 그대로
    설명하고, "같은 인터페이스의 MCP 전용 필드 … 그쪽은 타입이 무거워 별도 등재했다 —
    `plan/in-progress/spec-draft-nullable-notation-followups.md`" 는 **내부 plan 파일 경로를
    공개 API 문서(Swagger UI)에 노출**한다. 두 문단 모두 규약이 명시적으로 `//` 로 지정한
    내용이다.
    바로 아래 `meta` 필드 제거 설명(`integration-response.dto.ts:484-490`)은 **같은 커밋의
    같은 파일**에서 동일 성격의 서사(발견 경위·트래커 참조)를 정확히 `//` 로 처리했다 —
    즉 이 커밋이 규약을 올바르게 적용한 사례와 위반한 사례를 동시에 갖고 있다. 직전 라운드
    보고서(`review/consistency/2026/09/13/10_12_54`)가 "`//` vs JSDoc 분리 정확히 적용"을
    통과 항목으로 칭찬한 바로 그 파일에서, 이번 라운드가 새로 추가한 필드가 그 분리를
    깼다.
  - 제안: JSDoc 을 "실패 분류 코드(`MCP_*`·`EMAIL_CONNECT_FAILED`·`INTEGRATION_INCOMPLETE`
    등). 성공 시 부재." 한 문단으로 줄이고, `latencyMs` 정반대 방향 결함·MCP 전용 필드
    별도 등재 경위는 그 위 `//` 주석으로 옮긴다(위 `meta` 필드 처리와 동일 패턴). `spec/`
    변경이 아니라 `codebase/**` 수정이므로 developer 권한 내에서 바로 고칠 수 있다.

- **[WARNING] `user-guide-evidence.md` 등재 백로그가 이번 라운드에 새로 생긴 두 번째 가드를 놓쳤다 — 등재 범위가 diff 보다 좁다**
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 의
    "`user-guide-evidence.md §2.1` 관계표에 새 가드가 빠져 있다" 항목(2026-09-13 등재).
    실제 신규 가드 파일: `codebase/frontend/src/lib/docs/__tests__/guide-sanitized-message-parity.test.ts`
    (커밋 `a68457936` 신규, 73줄)
  - 위반 규약: `spec/conventions/user-guide-evidence.md §2`("Build-time 가드")·§2.1 관계표 —
    "가이드가 거짓을 말하지 않는가" 축의 가드 인벤토리가 SoT 여야 하는데, 그 인벤토리를
    갱신해 달라고 developer 가 등재한 backlog 항목 자체가 지금 diff 상태를 반영하지 못한다.
  - 상세: 라운드 1 이전에 등재된 백로그 항목은 `guide-error-code-existence.test.ts` 하나만
    "가드 가족에 합류해야 한다"고 적는다. 그런데 라운드 1 커밋이 **같은 라운드에** `guide-
    sanitized-message-parity.test.ts` 를 신설했다 — 이 파일도 정확히 같은 축(가이드 문면이
    SoT 와 어긋나지 않는지 build-time 으로 강제)이고 같은 디렉토리
    (`codebase/frontend/src/lib/docs/__tests__/`)에 산다. developer 자신의 plan 문서
    (`guide-error-code-truth.md` §G)는 이 신설을 정확히 기록했지만, **planner 에게 넘길
    등재 문구(`spec-draft-nullable-notation-followups.md`)는 갱신되지 않았다** — planner 가
    그 항목만 보고 처리하면 `guide-sanitized-message-parity.test.ts` 는 §2/§2.1 에서 계속
    누락된 채로 남는다. 이는 새 식별자·라벨을 등재할 때 "diff 시점의 최신 집합"이 아니라
    "등재 당시 스냅샷"으로 좁게 등재하는 패턴이다.
  - 제안: `spec-draft-nullable-notation-followups.md` 의 해당 항목에 `guide-sanitized-
    message-parity.test.ts` 를 병기해 두 가드가 함께 §2(가드 4→5건)·§2.1 관계표에 오르게
    한다. `plan/**` 갱신은 developer 쓰기 범위 내이므로 이번 라운드에서 바로 고칠 수 있다
    (spec 자체는 여전히 planner 소관).

## 기존 격차 — 변화 없음 (참고, 신규 조치 불요)

라운드 1 이전(`10_12_54`)에 WARNING 으로 등재된 세 항목은 이번 diff 로 상태가 바뀌지 않았다
— 모두 여전히 planner 백로그에 정확히 등재된 채 열려 있다(governance 경계 준수, 위반 아님):

1. `3-error-handling.md §1` 카탈로그가 `CAFE24_*`/`MAKESHOP_*`/`OAUTH_*`/LLM 도메인 코드
   누락 (등재 유지, planner 처분 대기)
2. `7-llm-client.md` 에 `testConnection` 실패 shape (`{ success:false, message }`) 미문서
   (등재 유지)
3. 위 발견사항 2 가 지목한 백로그 항목 자체(`user-guide-evidence.md §2.1` 관계표 공백) —
   이번 라운드에 **항목은 그대로 있으나 대상 범위가 좁아졌음**을 위에서 별도 WARNING 으로
   올렸다.

## 명명·API 문서 규약 관련 — 문제 없음으로 확인된 항목 (참고)

- **로케일 쌍 동반 갱신**: `run-results{,.en}.mdx` 의 `nodeName`→`nodeLabel` 정정과
  `LLM_RATE_LIMIT` 중복 행 제거가 두 로케일 파일에 동일하게 반영됐다 — `i18n-userguide.md`
  로케일 쌍 컨벤션 위반 없음.
- **`nodeLabel` 정정이 spec §2.2 와 일치**: `3-error-handling.md`/`4-execution-engine.md`
  류가 참조하는 노드 필드명은 `nodeLabel`(2026-08-17 정정)이고, 실측(backend emit
  `nodeName` 0건·`nodeLabel` 57건)과 일치한다.
- **`LlmService.testConnection` 의 JSDoc 이동은 swagger.md §3 대상이 아니다**: 이 파일은
  `.dto.ts`/`.controller.ts` 가 아니므로 `nest-cli.json` 의 `introspectComments` 스캔
  대상이 아니다 — 서비스 메서드 JSDoc 에 내부 서사(정정 경위)를 담아도 OpenAPI 에 노출되지
  않는다. 즉 여기서는 JSDoc/`//` 분리 규약이 적용되지 않으며 위반도 아니다.
- **`ModelTestConnectionResultDto` 에 `code` 를 잘못 추가하지 않았다**: 형제 `TestConnection
  ResultDto`(`/api/integrations/:id/test`)에는 `code` 를 추가했지만, `/api/model-configs/:id/
  test` 용 `ModelTestConnectionResultDto` 에는 추가하지 않았다 — 실측대로 후자는 `code` 를
  발행하지 않으므로 정확한 구분이다.
- **가드 신설 파일명·구조**: `guide-sanitized-message-parity.test.ts` 는 같은 디렉토리의
  기존 가드(`impl-anchor-existence.test.ts`·`*-coverage.test.ts`)와 동일한 `kebab-case
  + .test.ts` 명명·`readFileSync` 텍스트 기반 검증 관례를 따른다 — 등재 누락(위 발견사항
  2)과 별개로 코드 자체의 명명·구조는 규약과 일치.

## 요약

이번 라운드(커밋 `a68457936`, 라운드 1 지적 처분)는 대부분 규약을 정확히 지켰으나 —
로케일 쌍 갱신, `nodeLabel` 정정, DTO `meta`/`latencyMs` 유령 필드 제거의 `//` 처리 등 —
**새로 추가한 `TestConnectionResultDto.code` 필드가 바로 그 규약(JSDoc/`//` 분리)을
같은 커밋 안에서 위반**했고, **새로 추가한 가드 파일(`guide-sanitized-message-parity.
test.ts`) 하나가 이미 작성해 둔 planner 등재 문구에 반영되지 못해 등재 범위가 diff 보다
좁아졌다.** 둘 다 CRITICAL 급 invariant 파괴는 아니다 — 전자는 Swagger UI 가 기본
non-production 에서만 노출되고 값 자체는 정확하며 설명 내용만 과다 노출이고, 후자는
아직 planner 턴이 오지 않아 실질적 문서 drift 로 굳지 않았다. 다만 둘 다 방치하면 다음
사람에게 그대로 전이되는 종류의 결함이라 WARNING 으로 기록한다. 기존에 열려 있던 세
항목(에러 코드 카탈로그 공백·`testConnection` shape 미문서)은 변화 없이 planner 백로그에
정확히 등재된 상태를 유지한다.

## 위험도

LOW
