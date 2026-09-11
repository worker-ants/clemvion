# 정식 규약 준수 검토 — `spec/5-system/` (impl-done)

검토 기준 워킹트리: `/Volumes/project/private/clemvion/.claude/worktrees/impl-details-code-c8f31a`
diff-base: `origin/main` (codebase 델타 10파일/829줄, chatChannel PATCH `details[].code` 배선 + `password.util.ts` 동일 규약 적용)
spec 델타(`spec/5-system/`): 0파일 — 이번 PR 은 spec 을 건드리지 않는다.

## 발견사항

- **[WARNING] `15-chat-channel.md` §5.4.1.2 닫는 문단이 이번 diff 로 실측상 거짓이 됐다**
  - target 위치: `spec/5-system/15-chat-channel.md` §5.4.1.2 「`chatChannel` 필드 존재성 · `provider` 불변성」 절의 `details[].code` 단락 (표 바로 아래, "top-level code 는 기존 VALIDATION_ERROR 재사용" 문단의 다음 문단)
  - 위반 규약: `spec/5-system/2-api-convention.md` §5.3 「`field` 를 실으면 `code` 도 싣는다 — 형태와 무관 (2026-09-11 규약화)」 — 및 그 규약을 인용하며 스스로 "계약값 vs 관측값"을 구분한 위 문단 자신의 서술 규율
  - 상세: 해당 문단은 *"`details[].code` 는 **현재** 두 항목(`chatChannel` 사후 부착 차단·`provider` 불변) 모두 서비스 가드 갈래라 싣지 않는다 … **그 PR 이 머지되기 전까지 이 문단은 "아직 안 실린다"를 서술할 뿐 "싣지 않기로 했다"가 아니다**"* 라고 적는다. 그런데 이번 diff 의 `codebase/backend/src/modules/triggers/triggers.service.ts` 가 정확히 그 두 자리에 `code` 를 배선했다 —
    ```diff
    -        details: { field: 'chatChannel' },
    +        details: { field: 'chatChannel', code: ErrorCode.INVALID_FIELD },
    ...
    -      response: { code: 'VALIDATION_ERROR', details: { field: 'provider' } },
    +      response: {
    +        code: 'VALIDATION_ERROR',
    +        details: { field: 'provider', code: ErrorCode.INVALID_FIELD },
    +      },
    ```
    즉 이 diff 가 바로 그 문단이 예고한 "뒤따르는 developer PR" 이다. spec 은 여전히 "아직 안 실린다"(시한부 서술)를 현재형으로 두고 있어, 이 워킹트리 HEAD 기준으로는 **명백히 부정확**하다. §5.4.1 「토큰 변경 (rotation)」·§5.4.1.1 「회전 (rotation)」 두 행의 "위 「code 없음」은 배선 전 관측값이다" 라벨도 같은 배선 완료로 낡아 보인다(다만 이쪽은 "관측값 vs 계약값"으로 이미 헤지돼 있어 거짓까지는 아니다 — 정도 차이).
  - 참고: 이 정확한 드리프트는 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 의 미해결(unchecked) 항목 *"`15-chat-channel.md` 의 「배선 전 관측값」 서술 3곳이 배선 완료로 stale 해졌다"* 로 등재돼 있고, 술어 ①(라벨, 거짓 아님)/②(§5.4.1.2 닫는 문단, 명백히 거짓) 로 이미 정확히 구분돼 있다. 새로 발견한 문제가 아니라 **현재 HEAD 시점에도 미해소 상태임을 확인**한 것이다 — `--impl-done` 게이트 관점에서는 이 PR 이 머지되는 시점에 함께 반영돼야 한다.
  - 제안: 위 plan 트래커의 해당 항목을 이 PR 의 스코프에 포함해 §5.4.1.2 닫는 문단을 "배선 완료" 시제로 정정한다(developer 는 `spec/` 쓰기 권한이 없으므로 planner 턴 필요 — 자기-반증형 소정정 요건도 불성립: 그 문장은 이전 planner 턴이 썼다).

- **[INFO] `AUTH_CONFIG_NOT_FOUND` 자리의 `details.code` 병기 — 이미 자체 추적 중인 §5.3 미해결 판정**
  - target 위치: `codebase/backend/src/modules/triggers/triggers.service.ts` `assertAuthConfigInWorkspace` (diff 신규 라인) — 참고용 코드 위치, spec 쪽 대응은 `spec/5-system/2-api-convention.md` §5.3 「도메인 세부 사유를 어디에 싣는가」 표
  - 위반 규약(잠재): `2-api-convention.md` §5.3 "둘을 겹쳐 쓰지 않는다 — top-level 을 특화 코드로 바꾸면서 같은 사유를 `details[].code` 에도 넣으면 소비자가 어느 쪽으로 분기할지 갈린다"
  - 상세: 이번 diff 가 top-level `AUTH_CONFIG_NOT_FOUND`(도메인 특화 코드)를 유지한 채 `details.code: 'INVALID_FIELD'`(generic) 를 새로 병기했다. §5.3 표면 문구만 보면 "겹쳐 쓰지 않는다" 원칙에 저촉되는 것처럼 보이나, 코드 주석과 테스트 주석이 이를 **"판정 미해결"** 로 명시적으로 anchoring 하고 있고(같은 diff 안에 "이 자리만 top-level 이 도메인 특화 코드다 — §5.3 판정 미해결" 주석), `plan/in-progress/spec-draft-nullable-notation-followups.md` 가 동일 사안을 planner 결정 대기 항목으로 등재해 뒀다(제거 근거·유지 근거 양쪽 명시).
  - 제안: 규약 위반으로 단정하지 않는다 — 이미 정확하게 self-flag 됐고 처리 경로(§5.3 carve-out 문구 정정 + `AUTH_CONFIG_NOT_FOUND` 카탈로그 등재, 둘 다 pre-existing 갭 포함)가 plan 에 명시돼 있다. 독립 검증으로 그 판정이 타당함을 확인했다는 점만 기록한다.

- **[INFO] 신규 파일 `chat-channel-rejection-messages.const.ts` 가 `15-chat-channel.md` frontmatter `code:` 목록에 없다**
  - target 위치: `spec/5-system/15-chat-channel.md` frontmatter `code:` 리스트
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §2 (`code:` 필드 — "본 spec 이 약속한 surface 의 구현 경로")
  - 상세: 같은 frontmatter 가 이미 `codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts`·`triggers.service.ts` 를 명시 파일로 열거하는데, 그 둘이 새로 import 하는 `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` 는 어떤 glob 에도 걸리지 않는다(`triggers/**` glob 없음, `triggers/dto/*` 도 아님). 다만 `spec-impl-evidence.md` 자신이 이 갭 클래스(글로브/개별 파일 나열이 완전성을 보장 못 함)를 이미 알려진 약점으로 문서화하고 `/spec-coverage` standing audit 로 보완한다고 적어 뒀다 — build 가드가 강제하는 위반은 아니다.
  - 제안: 완전성을 위해 신규 경로를 `code:` 리스트에 추가하는 편이 낫다(비차단 제안).

- **[INFO] 차단 5필드 거부 메시지의 문체 혼재 — 범위 밖 가능성이 커 비차단으로만 기록**
  - target 위치: `codebase/backend/src/modules/triggers/chat-channel-rejection-messages.const.ts` `CHAT_CHANNEL_BLOCKED_FIELD_MESSAGES`
  - 관련 규약: `spec/conventions/i18n-userguide.md` Principle 6 "사용자 가이드 본문과 **UI 사용자 가시 한국어 문자열**은 … 해요체로 통일(`~합니다`, `~한다` 금지)"
  - 상세: 이 맵의 `botTokenRef`/`inboundSigningRef`/`inboundSigning` 메시지는 "~내부 필드입니다"/"~사용하세요"(합니다체)이고 `botToken`/`inboundSigningPlaintext` 는 "~없어요"/"~주세요"(해요체)로 **한 파일 안에서 문체가 갈린다**. 다만 이 diff 는 기존 리터럴 문구를 **그대로** 상수로 옮긴 것뿐이라 문체 혼재 자체는 이번 PR 이 만든 것이 아니고(선존), `3-error-handling.md §5.1` 이 예시로 드는 일반 토스트 문구들(`"권한이 없습니다"`·`"리소스를 찾을 수 없습니다"` 등)도 전부 합니다체라 — Principle 6 가 실제로 **백엔드 API 에러 메시지**까지 스코프에 넣는지 자체가 이 저장소 안에서 이미 불명확하다.
  - 제안: 새 판단을 요구하지 않는다 — 스코프 확정(Principle 6 이 API `error.message` 를 포함하는지)이 먼저 필요한 사안이라 planner 결정 항목 후보로만 남긴다.

## 요약

이번 PR 의 핵심 변경(`2-api-convention.md §5.3` "field 를 실으면 code 도 싣는다" 규약의 chatChannel PATCH/POST 경로 배선, `password.util.ts` 의 동일 규약 소급 적용)은 **§5.3 이 요구하는 출력 포맷을 정확히 따른다** — `details[]` 배열/객체 두 형태 모두 `{field, code}` 를 갖추고, 기본값 `INVALID_FIELD` 사용·기존 카탈로그 재사용·`ErrorCode` 상수 재사용도 규약과 일치한다. 명명·JSDoc/`//` 배치(swagger.md)·리뷰 인용 형식(review-citations.md)도 모두 규칙을 지킨다. 다만 이 배선이 **spec 문서(`15-chat-channel.md` §5.4.1.2)가 스스로 예고한 "이 PR 이 머지되면 아래 문단이 거짓이 된다"는 지점을 실제로 건드렸는데, spec 쪽 정정이 이 diff 에 포함되지 않아** 그 문단이 현재 HEAD 기준으로 부정확한 상태로 남는다 — 이는 이미 in-progress plan 트래커가 정확히 예견·등재해 둔 항목이라 새로 발견된 결함은 아니지만, `--impl-done` 게이트가 다루는 "spec 이 코드를 정확히 서술하는가" 축에서 여전히 미해소다. 그 외 `AUTH_CONFIG_NOT_FOUND` 의 §5.3 판정 미해결·frontmatter 완전성·메시지 문체 혼재는 전부 이미 self-flag 됐거나 스코프 자체가 불명확한 낮은 리스크 항목이다.

## 위험도

LOW
