# 정식 규약 준수 검토 — convention_compliance

- target: `spec/conventions/node-cancellation.md` (커밋 `babaf0030` — chat-channel 범주 오류 제거 + commerce 2행 상태 갱신, §1·§6)
- diff-base: `origin/main`
- 검토 모드: --impl-done (scope=spec/conventions/)

## 확인 대상 diff 요약

```
@@ §1
- (노드 열거에서) HTTP / DB / AI / Email / chat-channel / 이커머스 통합 Cafe24·MakeShop
+ (노드 열거에서) HTTP / DB / AI / Email / 이커머스 통합 Cafe24·MakeShop   ← chat-channel 제거

@@ §6 범례 (123행)
- ✓ = 구현됨, 🚧 = 부분 구현(...), — = 미구현(Planned, ...)
+ ✓ = 구현됨, 🚧 = 부분 구현(...), — = 미구현(Planned, ...), N/A = 범주 오류로 대상에서 철회(애초에 노드가 아님)   ← N/A 항목 신설

@@ §6 표
- | chat-channel 노드 signal 전파 | — | 미구현 (Planned) |
+ | ~~chat-channel 노드 signal 전파~~ | N/A | **범주 오류로 철회** — ... |
- | MakeShop 노드 signal 전파 | — | 미구현 (Planned) — ... |
+ | MakeShop 노드 signal 전파 | ✓ | ... |
- | Cafe24 노드 signal 전파 | — | 미구현 (Planned) — ... |
+ | Cafe24 노드 signal 전파 | ✓ | ... |
```

## 범례-값 정합 확인 (지시된 핵심 점검)

§6 범례(123행)가 정의하는 심볼은 4개: `✓`, `🚧`, `—`, `N/A`. 표(125~141행) 15개 행의 상태 컬럼 실값을 전수 대조:

| 값 | 등장 행 | 범례 정의 여부 |
|---|---|---|
| `✓` | 127~135, 138~140행 (10행) | 정의됨 |
| `🚧` | 136행 (Email 노드) | 정의됨 |
| `N/A` | 137행 (chat-channel, 신설) | 정의됨 (이번 diff 에서 함께 추가) |
| `—` | 141행 (Workflow 단위 timeout/graceful shutdown 의 노드 abort) | 정의됨 |

표에 나타나는 4가지 값 모두 범례에 1:1 대응하며, 범례에 정의된 4개 심볼 모두 표에서 최소 1회 이상 실사용된다(정의만 되고 미사용인 심볼 없음, 정의 없이 쓰인 값 없음). **범례-값 정합 위반 없음.**

부가 확인:
- 신설된 `N/A` 값은 문서 전체에서 정확히 2회만 등장(범례 1회 + 표 1회) — 다른 곳에 고아 참조·중복 정의 없음 (`grep -n "N/A" spec/conventions/node-cancellation.md` 로 확인).
- §1 노드 열거에서 `chat-channel` 을 제거해 §6 의 "범주 오류 철회" 판단과 본문이 서로 모순 없이 정합 — 표 137행 외에는 `chat-channel` 잔여 참조 없음.
- 137행이 인용하는 두 앵커 — [`../1-data-model.md#28-trigger`](../../../../spec/1-data-model.md) `### 2.8 Trigger`, [`../5-system/15-chat-channel.md`](../../../../spec/5-system/15-chat-channel.md) 의 `CCH-AD-05` 행 및 `### R1. 새 트리거 유형 신설하지 않음` — 둘 다 실존 확인(`spec-link-integrity.test.ts` 가 강제하는 in-repo 링크·앵커 무결성 규약과 정합).
- `pending_plans:` 대상 `plan/in-progress/node-cancellation-residual-signal-propagation.md` 도 동일 커밋 계열로 chat-channel(won't-do)·MakeShop/Cafe24(완료) 체크박스가 이미 갱신돼 spec 표와 plan 상태가 어긋나지 않음 (`spec-impl-evidence.md` §2.1 `pending_plans:` 의무와 정합).

## 발견사항

- **[INFO]** 범례 심볼 표기 형태 불일치 (단일 glyph vs 영숫자 약어)
  - target 위치: `spec/conventions/node-cancellation.md` §6, 123행 범례 · 137행 표 셀
  - 위반 규약: 명시적 규약 없음 — `spec/conventions/` 어디에도 상태 컬럼 심볼 표기법을 규정한 문서가 없다 (참고 확인: `spec-impl-evidence.md`, `error-codes.md`, `execution-context.md`, `node-output.md` 에 관련 규약 부재)
  - 상세: 기존 3개 값(`✓`/`🚧`/`—`)은 모두 단일 glyph 인 반면 신설 `N/A` 는 2글자 영숫자 약어라 컬럼 내 시각적 일관성이 다소 깨진다. 다만 이는 codebase 전반에서 이미 흔히 쓰이는 표기(`spec/2-navigation/2-trigger-list.md` 등)와 궤를 같이하고, 범례가 즉시 옆에서 뜻을 밝히므로 가독성 저해는 미미하다.
  - 제안: 선택 사항. 굳이 통일하려면 `⊘`/`✗` 류 단일 glyph 로 바꾸는 안이 있으나, `N/A` 텍스트가 "범주 오류로 대상 자체가 아님"이라는 의미를 더 명확히 전달하므로 **현행 유지가 오히려 적절**하다고 판단됨 — 규약 신설도, target 수정도 불요.

- **[INFO]** 문서 최상단 섹션이 CLAUDE.md 의 "Overview 권장" 표제와 불일치 (diff 범위 밖, 기존 구조)
  - target 위치: `spec/conventions/node-cancellation.md` §1 (`## 1. 목적`)
  - 위반 규약: CLAUDE.md "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale)" 권장
  - 상세: 문서가 `## Overview` 대신 `## 1. 목적` 으로 시작한다. 다만 이는 이번 diff 가 건드리지 않은 **기존 구조**이며(§1 은 열거 문구 일부 단어만 수정됨), `spec/conventions/audit-actions.md`·`spec-impl-evidence.md` 등 동일 디렉토리 내 다른 문서도 `## Overview` 대신 자유 제목(`## Overview (제품 정의)` 또는 번호 섹션)을 혼용하고 있어 디렉토리 관행상 강제되는 규칙은 아닌 것으로 보인다.
  - 제안: 이번 커밋 스코프와 무관하므로 target 수정 불요. 전 conventions 문서에 일괄 `## Overview` 표제를 강제하고 싶다면 별도 정리 작업(`project-planner`)으로 분리 권장.

CRITICAL/WARNING 등급 발견사항 없음.

## 요약

이번 커밋은 `node-cancellation.md` §6 표에 `N/A`(범주 오류로 철회) 상태값을 신설하면서 123행 범례에도 정의를 동시 추가했고, 표에 등장하는 4가지 상태값(`✓`/`🚧`/`—`/`N/A`)이 범례와 1:1 정합함을 확인했다 — 정의되지 않은 값이 쓰이거나 정의만 되고 미사용인 심볼은 없다. `chat-channel` 을 §1 노드 열거에서도 함께 제거해 본문-표 간 모순이 남지 않았고, 표 137행이 인용하는 spec 앵커(`1-data-model.md#28-trigger`, `15-chat-channel.md` CCH-AD-05·R1)는 모두 실존해 `spec-link-integrity` 링크 무결성 규약과도 정합한다. `pending_plans:` 로 연결된 plan 문서 역시 동일한 판정(chat-channel won't-do, MakeShop/Cafe24 완료)으로 이미 갱신돼 spec-impl-evidence 컨벤션의 역방향 추적 요구도 충족한다. 발견된 사항은 표기 스타일에 대한 INFO 2건뿐이며 둘 다 target 수정을 요하지 않는다.

## 위험도

NONE
