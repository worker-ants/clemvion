# 정식 규약 준수 검토 — Channel Web Chat (webchat-session-generations)

## 검토 범위 메모

- 검토 모드: `--impl-done`, scope=`spec/7-channel-web-chat/`, diff-base=`origin/main`
- 이번 세션의 실제 diff 는 spec 변경 없이 **코드만** 변경됐다 — `use-widget.ts`(1100줄) 안에 있던 boot/world/unmount
  staleness 판정 로직(`worldGenRef`/`bootGenRef`/`unmountedRef`/`isStale`/`beginBootAttempt`/`cannotApplyConfig`/
  `isAttemptStale`)을 신규 파일 `codebase/channel-web-chat/src/widget/use-session-generations.ts` (+ 짝 테스트)로
  추출한 리팩터. API/DTO/이벤트 페이로드/에러코드 변경 없음.
- `spec/conventions/**` 중 `conversation-thread.md`·`interaction-type-registry.md`·`error-codes.md`·`node-output.md`·
  `swagger.md`·`frontend-layering.md`·`chat-channel-adapter.md`·`data-hydration-surfaces.md` 는 프롬프트 예산 초과로
  본문이 실리지 않아 실제 리포지토리 파일을 직접 열어 대조했다.

## 발견사항

- **[WARNING]** `spec-impl-evidence` frontmatter 의 명시적 SoT 증거 파일 지정이 리팩터 후 stale — `2-sdk.md`
  - target 위치: `spec/7-channel-web-chat/2-sdk.md` frontmatter (repo 파일 1~10행)
    ```yaml
    code:
      - codebase/packages/web-chat-sdk/**
      # §3(재전송) `wc:boot` 재전송 계약("위젯은 **마지막** wc:boot 의 config 를 적용")의 **위젯 측** 구현.
      # 이 문서가 그 계약의 SoT 이므로 여기 증거를 건다 — 1-widget-app.md 는 재전송을 서술하지 않는다.
      - codebase/channel-web-chat/src/widget/host-bridge.ts
      - codebase/channel-web-chat/src/widget/use-widget.ts
    ```
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2.1 (`code:` = "본 spec 이 약속한 surface 의 구현 경로"),
    R-1 (`code:` 글로브의 알려진 약점 — "없어진 파일을 가리키는 stale 참조는 가드만으로 검출 불가, 사람이/휴리스틱
    감사가 보완").
  - 상세: 이 frontmatter 주석은 §3(재전송) 계약 — 부팅 시도가 세계를 대체하는 world/boot 세대 판정 — 의 **정본
    구현이 `use-widget.ts` 에 있다**고 명시적으로 못박는다. 그런데 이번 diff 로 그 정본 로직
    (`beginBootAttempt`/`cannotApplyConfig`/`isAttemptStale` 및 그 근거 JSDoc 전체)이 신규 파일
    `codebase/channel-web-chat/src/widget/use-session-generations.ts` 로 옮겨갔다(diff 확인: `use-widget.ts` 에서
    해당 함수 정의·JSDoc 블록이 통째로 삭제되고 `useSessionGenerations()` 훅 호출로 대체됨). `use-widget.ts` 는
    이제 그 판정자들을 **import 해 소비**할 뿐 정의하지 않는다(`grep`으로 확인: `use-widget.ts` 915행의
    `isAttemptStale(attempt)` 는 호출부일 뿐 정의는 `use-session-generations.ts`).
    `spec-code-paths.test.ts` 가드는 "`code:` 배열 중 ≥1 개가 실재 파일에 매치"만 확인하므로(R-1 이 자인하는
    한계), `use-widget.ts` 가 여전히 존재해 빌드는 계속 통과한다 — 즉 이 drift 는 CI 로 검출되지 않는다.
    같은 파일 160행의 인라인 주석("`bootGenRef` JSDoc, spec 2-sdk §3(재전송)")도 이제 다른 파일에 있는 JSDoc 을
    가리켜, spec → 코드 내비게이션이 한 단계 어긋난다.
  - 제안: `2-sdk.md` frontmatter `code:` 에 `codebase/channel-web-chat/src/widget/use-session-generations.ts` 를
    추가하고, 인라인 주석을 "이 문서가 그 계약의 SoT — 정본 구현은 `use-session-generations.ts`(`use-widget.ts` 가
    이를 소비)" 식으로 갱신. 코드 쪽 `use-widget.ts` 160행 주석도 정본 위치를 갱신하면 spec↔code 상호 참조가
    다시 맞는다.

- **[INFO]** 같은 drift 가 `3-auth-session.md` frontmatter 에도 잠재
  - target 위치: `spec/7-channel-web-chat/3-auth-session.md` frontmatter (repo 파일 1~10행), `code:` 배열의
    `codebase/channel-web-chat/src/widget/use-widget.ts` 항목.
  - 위반 규약: 상동 (`spec/conventions/spec-impl-evidence.md` §2.1/R-1) — 다만 이 문서는 2-sdk.md 와 달리 왜
    `use-widget.ts` 를 SoT 로 지목하는지 인라인 주석이 없어 "명시적 서술 위반"까지는 아니고 잠재적 drift.
  - 상세: §3.1 "재로드 복원 시퀀스"가 의존하는 "옛 세션으로 스트림을 열지 않는다"(stale 복원 방지) 판정이 바로
    `isAttemptStale`이며, 이 함수의 정본도 이제 `use-session-generations.ts`에 있다. `use-widget.ts` 는 여전히
    §3.1 로직의 다른 부분(세션 storage 조회·`GET .../:id` 분기 등)을 담고 있어 완전히 무관해진 것은 아니라
    CRITICAL 로 올리지 않음.
  - 제안: 2-sdk.md 수정과 동일한 기회에 `code:` 에 `use-session-generations.ts` 를 함께 추가해 두 문서의 evidence
    가 실제 코드 위치와 재정렬되게 한다(2건 동시 처리가 재작업 비용을 줄인다).

## 그 외 확인 — 위반 없음

- **문서 구조 규약**: `spec/7-channel-web-chat/{0-architecture,1-widget-app,2-sdk,3-auth-session,4-security,
  5-admin-console}.md` 모두 frontmatter(`id`/`status`/`code`) + `## Overview` + 번호 매김 본문 + `## Rationale`
  3섹션 구성을 유지 — 이번 diff 로 이 구조가 변경되지 않았다.
- **`_product-overview.md` 관례**: `spec/7-channel-web-chat/_product-overview.md` 는 frontmatter 가 없는데, 이는
  위반이 아니라 리포지토리 전역 관례와 일치한다 — `spec/{2-navigation,3-workflow-editor,4-nodes,5-system,
  4-nodes/4-integration,4-nodes/3-ai}/_product-overview.md` 전부 frontmatter 없이 `# PRD: ...` 로 바로 시작하며,
  `spec-impl-evidence.md` §1 도 `_*.md`(밑줄 prefix)를 frontmatter 의무 대상에서 명시적으로 제외한다.
- **명명 규약(코드)**: 신규 파일 `use-session-generations.ts`(+ `.test.ts` 짝 테스트) 는 기존 `use-widget.ts`/
  `use-token-refresh.ts`/`use-pending-message-queue.ts`/`use-widget-commands.ts` 와 동일한 kebab-case
  `use-*.ts` 파일명 + `use*` camelCase 훅 이름 패턴을 그대로 따른다. `frontend-layering.md` 계층 규약은
  scope 가 `codebase/frontend/src/**` 로 명시 한정되어 `codebase/channel-web-chat` 에는 적용되지 않는다(위반
  판정 대상 아님).
- **출력 포맷 규약 / API 문서 규약**: 이번 diff 는 API 응답·이벤트 페이로드·에러 코드·DTO·Swagger 데코레이터를
  전혀 건드리지 않는다(순수 프론트엔드 훅 내부 상태 리팩터) — 해당 관점에서 점검할 표면이 없다.
  `swagger.md`/`error-codes.md`/`node-output.md`/`interaction-type-registry.md`/`conversation-thread.md` 를
  직접 열어 대조한 결과도 이번 diff 범위와 겹치는 규정을 찾지 못했다.
- **금지 항목**: `spec/conventions/**` 에서 명시적으로 금지한 패턴(blacklist sanitize, `req.ip`/`req.socket.
  remoteAddress` 폴백, 신규 web-chat 엔티티 등)에 해당하는 코드가 이번 diff 에 없다.

## 요약

이번 세션의 diff 는 `spec/7-channel-web-chat/` 문서 자체를 변경하지 않고 `channel-web-chat` 위젯의 내부 세션
staleness 판정 로직을 별도 훅 파일로 추출하는 순수 리팩터다. 문서 구조(Overview/본문/Rationale)·`_product-overview.md`
무-frontmatter 관례·코드 명명 패턴은 기존 관례와 일치해 위반이 없다. 다만 `spec-impl-evidence.md` 가 규정하는
frontmatter `code:` 증거 배열 중 `2-sdk.md`(명시적 인라인 주석으로 SoT 를 못박은 케이스)와 `3-auth-session.md` 가
이번 리팩터로 실제 정본 구현 위치(`use-session-generations.ts`)를 반영하지 못해 evidence 가 stale 해졌다 — 빌드
가드(`spec-code-paths.test.ts`)는 "≥1 매치"만 확인해 이 drift 를 검출하지 못하므로(R-1 이 자인하는 한계), 이번
검토가 아니면 조용히 누적될 사안이다. CRITICAL 로 볼 만한 명명/출력포맷/API문서/금지패턴 위반은 발견되지 않았다.

## 위험도

LOW
