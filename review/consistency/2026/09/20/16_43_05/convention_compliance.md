# 정식 규약 준수 검토 — `plan/in-progress/spec-draft-rotate-conflict.md`

## 발견사항

- **[CRITICAL] 새 미구현 약속을 `status: implemented` spec 에 얹으면서 `pending_plans`/`status` 전이를 다루지 않음**
  - target 위치: `## 변경안 — spec/2-navigation/4-integration.md 세 자리 + Rationale` (L38) 및 하위 ①~⑤ (L40-81), `## 체크리스트` (L90-95)
  - 위반 규약: `spec/conventions/spec-impl-evidence.md` §3 `status` 라이프사이클 전이 규칙("`spec-only` → `partial`: 최초 코드 머지 시점에 승격" 의 역방향 — 즉 이미 `implemented` 인 문서에 **미구현 새 약속**을 추가할 때는 `partial` 로 내려야 함) + R-5("`status: partial` 의 `pending_plans:` 의무화 — spec 이 자기를 책임지는 plan 을 가리킴") + R-11 선례(`secret-store.md` — "트리거 삭제 자원 정리 **하나** 때문에 `partial` 로 내려갔다가 그 구현이 머지된 뒤 승격")
  - 상세: 이 draft 는 `spec/2-navigation/4-integration.md` (frontmatter `status: implemented`, `pending_plans` 필드 자체가 없음) 에 **새 에러 코드(`INTEGRATION_ROTATE_CONFLICT`, 409) + 새 API 동작(§9.2 rotate 행) + 새 UI 안내(§3 표)** 를 추가하도록 제안하면서, 본문에서 스스로 "이 PR 은 **계약만** 정하고, 구현은 후속 developer PR 이 한다"(L16-17) 라고 명시한다. 즉 이 spec PR 이 머지된 시점부터 후속 developer PR 이 머지되기 전까지, `4-integration.md` 는 `status: implemented` 를 유지한 채로 **아직 코드에 없는 동작(409 거부·아무것도 바꾸지 않음·재시도 안내)을 약속**하게 된다. 이것이 정확히 `spec-impl-evidence.md` Overview 가 "본 컨벤션이 막으려는" 사례로 든 "spec 약속 vs 구현 부재 갭"(텔레그램 chat-channel 영구 누락) 의 형태다. R-11 이 명시하듯 이 저장소의 선례는 "**항목 하나**만 미구현이어도" `partial` 로 내리는 쪽이다 — 이번 추가분(에러코드 3자리 반영)은 그 선례보다 작지 않다. `spec-code-paths.test.ts` 가 이 특정 gap 을 build 에서 잡아내지는 못하지만(§R-1 이 명시한 known limitation — glob 매치는 여전히 유효하므로), 그것이 규약 위반이 아니라는 뜻은 아니다. 이 draft 의 체크리스트(L90-95)는 "트래커: 이 항목을 «계약 확정 · 구현 후속» 으로 갱신"(L93) 만 요구할 뿐, **`4-integration.md` 자신의 frontmatter** 를 `partial` + `pending_plans: [<구현 후속 plan 경로>]` 로 낮추는 항목이 없다.
  - 제안: ⑤ Rationale 삽입안과 함께 `4-integration.md` frontmatter 변경을 draft 에 명시한다 — `status: implemented` → `status: partial`, `pending_plans:` 에 구현을 담당할 후속 developer plan 경로(체크리스트 L93 이 말하는 "재서술된 developer 항목"이 실제로 어느 `plan/in-progress/*.md` 에 있을지)를 추가. 체크리스트에도 "`4-integration.md` frontmatter `status`/`pending_plans` 갱신" 항목을 추가한다. 그 후속 developer PR 이 구현을 머지하는 시점에 R-11 방식으로 재승격한다.

- **[INFO] §9.4 삽입안의 `>` 인용 블록 표기가 대상 절의 실제 리스트 형식과 다름**
  - target 위치: `### ① §9.4 공통 응답 포맷에 코드 한 줄` (L40-45), `### ② …` (L47-51)
  - 위반 규약: 문서 구조 자체를 규정하는 개별 conventions 파일은 없으나, `spec/2-navigation/4-integration.md` §9.4 의 기성 포맷(`- \`CODE\` (status) — 설명` 형태의 평서 bullet list, 예: L866-877 실측)과 draft 가 제시하는 blockquote(`>`) 형식이 형태적으로 다르다.
  - 상세: draft 본문 전체가 제안 문구를 `>` 로 감싸는 것은 "이 문장을 그대로 삽입하라"는 인용 표시로 읽히도록 관례적으로 쓰인 것으로 보이나, 실제 §9.4 는 각 코드가 독립된 `- ` bullet 이다. 그대로 복사하면 §9.4 안에 이질적인 blockquote 항목 하나가 섞여 리스트 포맷 일관성이 깨진다. ②는 "①의 바로 아래 하위 항목"이라고 밝혀 두었지만 실제로는 중첩 bullet(`  - `)이 아니라 별도 top-level quote 로 적혀 있어, 최종 반영 시 들여쓰기 레벨이 모호하다.
  - 제안: 후속 반영(체크리스트 L92) 시 `>` 블록을 걷어내고 §9.4 의 기존 bullet 형식(`- `)으로, ②는 ①의 하위 bullet(`  - `)로 정정해서 적용하라고 draft 에 한 줄 명시하면 반영 담당자의 착오를 줄일 수 있다.

## 요약

핵심 명명(`INTEGRATION_ROTATE_CONFLICT` — 도메인 prefix `INTEGRATION_` + 의미 기반 condition, `error-codes.md` §1 부합, 신규 식별자 grep 0건 확인도 draft 안에 실측으로 남아 있음)과 HTTP 상태(409, 기존 `INTEGRATION_IN_USE`/`CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 선례 및 swagger.md §2-4 "중복/충돌은 409" 와 정합), 응답 포맷(§9.4 `{code, message, details?}` 봉투 유지), 문서 구조(제안이 삽입되는 `4-integration.md` 자체가 이미 Overview/본문/`## Rationale` 3섹션을 갖추고 있고 draft ⑤가 그 Rationale 에 자연스럽게 편입되는 형태)는 모두 conventions 를 준수한다. `@VersionColumn` 낙관적 잠금을 기각하고 기존 컬럼 조건부 update 로 미루는 판단도 migrations.md 의 append-only/신규 V번호 원칙과 충돌하지 않는다. 다만 이 draft 가 "계약만 정하고 구현은 후속 PR" 이라는 2단계 머지를 명시적으로 선언하면서도, 그 사이 window 에서 `4-integration.md` 가 `status: implemented` 를 유지한 채 미구현 동작을 약속하게 되는 상황을 `spec-impl-evidence.md` 의 `partial`/`pending_plans` 전이 절차로 처리하지 않은 점이 이 검토의 핵심 결함이다 — 이는 그 컨벤션이 명시적으로 예방 대상으로 삼는 패턴(빈 약속의 영구 누락)과 형태가 같다.

## 위험도

HIGH
