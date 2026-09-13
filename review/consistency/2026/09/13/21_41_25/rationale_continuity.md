# Rationale 연속성 검토

## 조사 방법 메모

- `--impl-done` 스코프(`spec/conventions/`)의 실제 델타는 **0개 파일** — 이 브랜치는 `spec/conventions/`
  를 건드리지 않는다. prompt 번들의 `spec/conventions/**` 전량은 related-spec 컨텍스트로 첨부된 것이며
  target diff 가 아니다.
- 실제 `code_areas` diff(4개 파일)는 절대경로 워킹트리(`git -C ".../error-code-emission-axis-56c9ff" diff
  origin/main...HEAD -- codebase/`)로 직접 확인했다 — prompt 내 diff 블록은 예산 절단으로 생략돼 있었다:
  - `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx` (각 1줄, 사용자 가이드 문구 정정)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` (237줄)
  - `codebase/frontend/src/lib/docs/__tests__/guide-identifier-existence.test.ts` (451줄)
  - 그 외 `plan/in-progress/error-code-emission-axis.md`(신규 594줄) · `plan/in-progress/spec-draft-nullable-notation-followups.md`(백로그 갱신) · `CHANGELOG.md` · `PROJECT.md` — spec 아님.
- 즉 이번 배치는 **spec/conventions 어디에도 새 결정을 쓰지 않았고**, 코드 쪽도 harness 성격의 문서-검증
  가드(`guide-identifier-*`)와 사용자 가이드 문구 2줄 정정에 그친다. Rationale 연속성 관점에서 볼
  대상은 (a) 이 가드의 설계가 기존 spec Rationale 이 이미 결정한 원칙과 충돌하는가, (b) 가이드 문구
  정정이 과거 결정을 몰래 번복하는가, 두 가지로 좁힌다.

## 발견사항

검토 결과 CRITICAL·WARNING 급 충돌은 발견하지 못했다. 아래는 실측 근거와 함께 "충돌 후보였으나
기각한" 항목들이다.

- **[INFO]** `GUIDE_NON_EMITTED_VOCABULARY` 설계가 `chat-channel-adapter.md §R-CCA-9` 의
  "message 파싱 금지" 원칙과 표면적으로 닮아 있으나 층이 다르다 — 혼동 방지용으로 spec 에
  한 줄 교차각주를 남길 만하다
  - target 위치: `codebase/frontend/src/lib/docs/__tests__/guide-identifier-scan.ts` 의
    `isMessagePrefixOnly` / `collectMessagePrefixes` (§B-3 술어)
  - 과거 결정 출처: `spec/conventions/chat-channel-adapter.md` `## Rationale` §R-CCA-9
    ("기각한 대안 두 개" 표 — 어댑터가 `message` 를 `'BOT_TOKEN_INVALID:'` 접두로 시작해 호출자가
    문자열 파싱으로 분기하는 방식을 명시적으로 기각)
  - 상세: R-CCA-9 이 기각한 것은 **런타임 제어흐름이 메시지 접두 문자열을 파싱해 분기하는 패턴**이다.
    이번 가드가 쓰는 "메시지 접두로만 등장" 판별은 **정적 분석 도구가 소스 텍스트를 스캔**해 가이드
    문서의 서술 정확성(코드로 방출되는지 vs 메시지에만 나오는지)을 검증하는 것으로, 런타임 분기가
    아니다. 실제로 이 가드는 message-prefix-only 토큰을 발견하면 "이건 코드가 아니라 메시지다" 라고
    문서를 정정하게 만드는 방향이라 R-CCA-9 의 정신(코드로 선언 안 된 것을 코드처럼 취급하지 말라)과
    오히려 **정합**한다. 다만 두 문서 모두 "code" / "message prefix" 라는 같은 어휘를 쓰고 있어
    다음 사람이 "이 저장소는 message-prefix 판별 자체를 금지한다" 고 과잉 일반화할 위험이 있다.
  - 제안: 필수는 아니나, `guide-identifier-scan.ts` 상단 JSDoc 이나 후속 spec 갱신 시
    "본 판별은 런타임 제어흐름이 아니라 문서-검증 정적 분석이며 R-CCA-9 의 대상과 다르다" 는
    한 줄을 남기면 향후 혼동을 막는다. 액션 아이템 필수 아님.

- **[INFO]** `3-error-handling.md §1.4` 의 "앵커 없는 맨 문자열도 정식 카탈로그 항목" 이라는
  기존 설계를 이번 가드가 "카탈로그를 탈출구로" 라는 형태로 그대로 이어받았다 — 이미 스스로
  후속 항목으로 등재돼 있어 추가 조치 불요
  - target 위치: `plan/in-progress/spec-draft-nullable-notation-followups.md` 신규 항목
    "`3-error-handling.md §1.4` 의 «앵커 없는 코드» 7종이 실제로는 메시지 접두다"
  - 과거 결정 출처: `spec/5-system/3-error-handling.md §1.4` 머리말
    ("나머지 7종은 앵커 없는 맨 문자열이라 오탈자가 tsc 를 통과한다... 그것은 소비자·분류기 쪽
    어휘이지 엔진 발행 경로의 앵커가 아니다")
  - 상세: 이번 가드(§B-3)는 카탈로그 등재 여부를 "탈출구"(등록 불요 조건)로 쓴다 — 이는 §1.4 가
    이미 "앵커 없는 문자열도 카탈로그에 있으면 정식" 이라고 결정해 둔 것을 그대로 활용한 것이라
    **새로운 결정이 아니라 기존 결정의 재사용**이다. 다만 `CONTAINER_MISSING_EMIT`/
    `CONTAINER_MULTIPLE_EMIT` 는 같은 형태(메시지 접두, 앵커 없음)인데 카탈로그엔 없어 가드에
    개별 등록이 필요했다 — "왜 이 둘만 카탈로그 밖인가" 라는 비일관성이 생기지만, 이 PR 은
    그 비일관성을 **인지하고 별도 backlog 항목으로 등재**했을 뿐 spec 을 직접 편집하지 않았다
    (developer 권한 밖 — 올바른 처분). Rationale 자체를 뒤집거나 무시한 사례가 아니다.
  - 제안: 조치 불요 — 이미 `plan/in-progress/spec-draft-nullable-notation-followups.md` 에
    planner 대상 항목으로 등재돼 있고, "한 턴에 묶어라" 기존 합의와도 상호 링크됐다.

- **[INFO]** 가이드 문구 정정(`logic.mdx`/`logic.en.mdx`)은 과거 결정 번복이 아니라 기존 선례의
  연장
  - target 위치: `codebase/frontend/src/content/docs/02-nodes/logic.mdx` / `logic.en.mdx`
    (`CONTAINER_MISSING_EMIT`/`CONTAINER_MULTIPLE_EMIT` 서술을 "코드로 실패" → "메시지 접두, 코드
    아님" 으로 정정)
  - 과거 결정 출처: `#1330`(`ce454e046`)이 `MAKESHOP_UNRESOLVED_PATH_PARAM` 에 대해 같은 갈림
    ("(A) 문장 정정" vs "(B) 엔진이 전용 코드 방출")에서 이미 (A) 를 택한 선례
  - 상세: 이번 정정도 동일하게 (A) 를 택했고 이유(가이드는 *현재 동작*을 서술하는 문서)도 동일하게
    인용했다 — 새 Rationale 을 요구할 만큼의 결정 번복이 아니라 **같은 원칙의 두 번째 적용**이다.
    (B) 안(엔진이 전용 코드를 방출하도록 바꾸는 동작 변경)은 스스로 배제하고 별도 트래커(3404)로
    남겨 뒀다 — 무근거 번복이 아니라 명시적 스코프 분리다.
  - 제안: 조치 불요.

## 요약

이번 배치는 `spec/conventions/` 를 전혀 편집하지 않았고(`spec_impact: none`), 실질 코드 변경은
문서-검증 하네스 가드(`guide-identifier-scan.ts`/`guide-identifier-existence.test.ts`)와 사용자
가이드 문구 2곳 정정에 국한된다. 가드의 핵심 판별("메시지 접두로만 등장 + 카탈로그 미등재 →
RED")은 `chat-channel-adapter.md R-CCA-9`(런타임 message-parsing 금지)와 어휘가 겹쳐 보이지만
층이 다르며(정적 문서-검증 vs 런타임 제어흐름), 실제로는 그 원칙과 정합하는 방향으로 작동한다.
가이드 문구 정정은 `#1330` 이 이미 세운 "(A) 문장 정정" 선례를 그대로 재적용한 것이고, 코드가
발견한 spec 쪽 비일관성(6개 spec 파일이 `CONTAINER_*` 를 "코드" 로 잘못 서술하는 것,
`3-error-handling.md §1.4` 카탈로그의 앵커 정책 모호성)은 developer 권한을 넘지 않고 모두
`plan/in-progress/spec-draft-nullable-notation-followups.md` 에 planner 대상 backlog 항목으로
정확히 등재됐다. 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회 중 어느
것도 관측되지 않았다.

## 위험도
NONE
