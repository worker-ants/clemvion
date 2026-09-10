# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-telegram-signing-carveout.md`

## 검토 범위와 방법

target 은 `spec/5-system/15-chat-channel.md` · `spec/data-flow/14-chat-channel.md` 에 대한
변경안(A~E)을 담은 **plan draft**(`--spec` 모드)다. `spec/conventions/**` 중 이 주제와 직접
관련된 문서 — `secret-store.md`, `chat-channel-adapter.md`, `swagger.md`, `spec-impl-evidence.md`,
`error-codes.md` — 를 원본 파일(번들이 예산 초과로 잘라낸 부분 포함)에서 전문 대조했다.

## 발견사항

검사 결과 **CRITICAL/WARNING 급 정식 규약 위반은 발견되지 않았다.** 오히려 draft 가 인용하는
기술 세부(용어·필드명·흐름)는 기존 conventions 문서와 정확히 일치하며, draft 의 결정(D-A/D-B/D-C)을
독립적으로 뒷받침한다.

- **[INFO] draft 의 핵심 전제가 conventions 문서에 이미 정본으로 등재돼 있다**
  - target 위치: "실측 — 세 층에서 같은 사실이 나온다" 표, "결정" D-A/D-B
  - 관련 규약: `spec/conventions/secret-store.md §5.5`(`inboundSigningRef` 초기화 — provider 두 경로,
    server-issued vs provider-issued), `spec/conventions/chat-channel-adapter.md §2.4`
    (`SetupResult.issuedInboundSigning` JSDoc — *"caller 가 즉시 `SecretResolver.store(...)` 로
    보관 후 ref 를 set"*), 동 파일 §2.3 `ChatChannelConfig.inboundSigningRef` JSDoc 의 provider별
    표(Telegram = server-issued / Slack·Discord = provider-issued 사용자 입력)
  - 상세: draft 가 코드에서 실측했다고 주장하는 "매 `setupChannel` 마다 새 `issuedInboundSigning`
    발급 → caller 가 `rotate()` 로 저장" 흐름은 이미 두 conventions 문서에 **동일한 문장·필드명**으로
    정본화돼 있다(`SetupResult.issuedInboundSigning`, `ChatChannelConfig.inboundSigningRef`,
    `SecretResolver.rotate`). 즉 draft 의 사실관계는 conventions 와 독립적으로 재확인됐을 뿐 아니라
    **conventions 문서 자체가 그 사실을 이미 규범화하고 있었다** — carve-out 결정(D-A)이 conventions
    과 어긋나지 않고 오히려 그 규범을 spec 산문에 뒤늦게 반영하는 방향이다.
  - 제안: 조치 불요(정합 확인). 다만 변경안 A~E 실행 시 `15-chat-channel.md`/`data-flow` 쪽에
    `secret-store.md §5.5`·`chat-channel-adapter.md §2.3/§2.4` 로의 상호 참조 링크를 추가하면
    "이미 그어져 있던 경계" 라는 draft 의 주장이 spec 독자에게도 한 클릭으로 검증 가능해진다
    (선택적 개선, 필수 아님).

- **[INFO] `inboundSigningPlaintext` 필드명이 `swagger.md §1-5` 예시와 정확히 일치**
  - target 위치: "결정" D-A ("`inboundSigningPlaintext`(slack/discord 사용자 입력)")
  - 관련 규약: `spec/conventions/swagger.md §1-5`(`writeOnly`/`readOnly`) 의 코드 예시가
    `inboundSigningPlaintext?: string` 필드를 "Provider 발급 plaintext (slack signing secret /
    discord public key)" 로 그대로 예시하고 있다.
  - 상세: draft 가 "PATCH 가 막아야 하는 두 축" 중 하나로 지목한 필드명이 swagger 컨벤션의
    canonical 예시 필드명과 1:1 로 일치한다 — 명명 드리프트 없음.
  - 제안: 없음(확인 목적 기록).

- **[INFO] DTO 명명 결정(`ChatChannelPatchConfigDto`→`ChatChannelUpdateConfigDto`)은 spec/conventions
  범위 밖으로 올바르게 defer 됨**
  - target 위치: "이 턴에 하지 않는 것" 2번째 항목
  - 관련 규약: `spec/conventions/swagger.md` 전체(§1~§6)를 확인했으나 `Create`/`Update`/`Patch`
    동사 접두 DTO 명명을 규정하는 조항이 없다 — 이는 코드베이스 grep 관행(저장소 전체에 `Patch`
    접두 DTO 0건)이지 정식 규약 문서화 항목이 아니다.
  - 상세: draft 는 이 명명 결정을 "spec 사안이 아니므로 여기서 다루지 않는다" 며 developer 턴으로
    명시적으로 미뤘다. CLAUDE.md 상 `codebase/**` 명명은 `developer` 소관이고 이 draft 는
    `project-planner` 산출물이므로 스코프 경계가 맞다.
  - 제안(규약 갱신 제안, 필수 아님): 이런 질문이 반복된다면 `swagger.md §1`에 "부분 갱신
    엔드포인트의 DTO 는 `Update` 동사를 쓰고 `Patch` 는 쓰지 않는다" 한 줄을 정식 규약으로
    승격하는 것을 고려할 수 있다 — 지금은 grep 관행일 뿐이라 다음 사람이 같은 조사를 반복해야
    한다.

- **[INFO] `spec-impl-evidence.md` frontmatter 의무 대상 밖 — target 자체는 스킴 위반 아님**
  - target 위치: target 문서 frontmatter 전체
  - 관련 규약: `spec/conventions/spec-impl-evidence.md §1` "적용 대상"
  - 상세: 이 컨벤션의 frontmatter(`id`/`status`/`code`) 의무는 `spec/2-navigation/**` ~
    `spec/conventions/**` 6개 경로에만 걸리고 `plan/**` 은 대상이 아니다. target 은
    `plan/in-progress/*.md` 이므로 이 컨벤션의 스킴 검사 대상이 아니며, 실제로 쓰인
    `title/status/owner/worktree/spec_impact/created` 필드는 plan-lifecycle 스킴(별도 문서)
    소관이라 이 checker 의 판단 범위 밖이다.
  - 제안: 없음(스코프 확인 목적).

## 요약

target 은 spec 문서가 아니라 spec 변경을 제안하는 plan draft이며, `spec/conventions/**` 관점에서
분석한 결과 CRITICAL·WARNING 급 위반이 없다. 오히려 draft 가 실측했다고 주장하는 핵심 기술
사실(telegram `issuedInboundSigning` 의 매 `setupChannel` 재발급·caller 의 `SecretResolver.rotate`
저장 의무, `botTokenRef`/`inboundSigningRef`/`inboundSigningPlaintext` 필드명 체계)은
`secret-store.md §5.5`, `chat-channel-adapter.md §2.3/§2.4`, `swagger.md §1-5` 세 정식 규약
문서에 이미 동일한 어휘로 정본화돼 있어 draft 의 결정(D-A/D-B/D-C)을 강하게 뒷받침한다. 유일하게
스코프 밖으로 미뤄둔 항목(`ChatChannelPatchConfigDto` 명명)도 CLAUDE.md 의 planner/developer 쓰기
경계에 맞게 올바르게 defer 됐다. 정식 규약을 갱신해야 할 필요도, target 을 정식 규약에 맞춰 고쳐야
할 필요도 발견하지 못했다.

## 위험도
NONE
