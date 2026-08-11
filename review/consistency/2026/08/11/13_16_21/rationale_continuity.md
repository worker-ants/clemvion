# Rationale 연속성 검토 — trigger 시크릿/토큰 회전 3종 감사 (`conventions/audit-actions.md §3`)

## 조사 방법

- `spec/conventions/audit-actions.md` 전문(§1~§3, `## Rationale`)을 직접 Read.
- 대상 PR 의 실제 diff(`git show d71a53127`, `git log --oneline origin/main..HEAD`)로 이번 PR 이 무엇을 추가했는지 확정.
- `integration.rotated`(`data-flow/1-audit.md`, `2-navigation/4-integration.md`, `1-data-model.md §2.10`)의 결합(단일 액션) 선례 이력을 추적.
- `audit-actions.md` 최초 도입 커밋(`b1b0fa3bd`, 2026-06-14)을 확인해 "분리 vs 결합" 축에 대한 과거 명시적 결정(기각/채택)이 존재했는지 검사.
- 직전 라운드 사전 게이트 리뷰(`review/consistency/2026/08/11/11_48_48/rationale_continuity.md`)와 대조해 그때 제기된 WARNING/INFO 가 이번 target 에서 어떻게 처리됐는지 추적.
- `triggers.service.ts` 의 `rotateNotificationSecret`/`revokePerTriggerToken` 실제 구현을 Read 해 Rationale 이 인용하는 "실측" 주장(부재 grace 컬럼, `auth_config` 미접촉)을 코드로 검증.

## 발견사항

Critical 은 없다. 아래는 WARNING 1건 + INFO 1건 (모두 경미).

- **[INFO]** "3분리 vs 단일액션+details" 결정의 정당성 — 근거는 실사(real history)에 기반, 기각 없음
  - target 위치: `spec/conventions/audit-actions.md §3` 하단 블록쿼트 "트리거 시크릿/토큰 회전을 셋으로 가른 이유 (2026-08-11)"
  - 과거 결정 출처: 동일 파일 §3 레지스트리 `integration`(결합, `rotated`) 행과 `user`(분리, `password_changed`/`email_changed`/`2fa_enabled`/`2fa_disabled`) 행. 두 선례 모두 이 PR 이전부터 이미 "구현" 상태로 존재(`integration` 행은 2026-06-14 최초 도입, `user` 행도 동일).
  - 상세: 최초 도입 커밋(`b1b0fa3bd`)을 확인한 결과, `audit-actions.md` 는 "한 리소스의 여러 서브-자격증명을 하나의 액션+`details` 로 묶을지, 대상별로 분리할지"를 규정한 적이 **없다** — §1/§2 는 오직 verb 시제(과거분사/현재형/도메인동사) 분류만 다룬다. 즉 target 이 인용하는 "규약은 어느 쪽도 강제하지 않는다"는 문장은 사실과 부합하며, 지어낸 전제가 아니다. target 은 두 선례(`integration.rotated` 결합·`user.*` 분리)를 **둘 다 명시적으로 인용**한 뒤 "폭발 반경(blast radius)"이라는 신규 축으로 선택 근거를 남겼다 — 이는 "선례를 몰라서 다르게 한 것"이 아니라 선례를 알고도 다른 축(무효화 범위)이 우선한다고 판단한 **의식적 선택**이다.
  - `interaction_token_revoked` 만 `revoked`(회전 아님)로 쓴 이유("grace 컬럼 없음 — 즉시 무효화")도 실측 검증됨: `triggers.service.ts` 의 `revokePerTriggerToken()` 은 `Trigger.config.interaction.triggerToken` 을 직접 덮어쓸 뿐 별도 v2/grace 컬럼이 없다(반면 `rotateNotificationSecret`/`rotateBotToken` 은 `notificationSecretV2`/`chatChannelTokenV2` + `*RotatedAt` 24h grace 컬럼을 사용). 코드가 주장을 뒷받침한다.
  - "반증된 우려"(커밋 메시지: `auth_config.regenerate` 와 이중 기록 우려 → 실측으로 기각)도 코드로 재검증했다 — `rotateNotificationSecret` 은 `auth_config` 테이블/서비스를 전혀 참조하지 않고 `Trigger.notificationSecretV2` 만 갱신한다. 직전 라운드(11:48:48)가 제기한 WARNING("웹훅 HMAC 회전과 물리적으로 동일 행위일 위험")이 이번 target 에서 실측으로 해소된 채 반영됐다 — 연속성 관점에서 이전 라운드의 우려에 대한 응답이 존재한다.
  - 제안: 없음 (참고용 기록). 굳이 보강한다면, 이 "실측으로 auth_config 중복 아님을 확인했다"는 근거 한 문장을 `audit-actions.md §3` 블록쿼트 또는 `1-auth.md §4.1` 트리거 행에도 명문화해두면, 향후 재질문(직전 라운드처럼 동일 우려가 다시 제기될 가능성)을 사전 차단할 수 있다. 필수는 아니다.

- **[WARNING]** 신규 Rationale 배치가 `## Rationale` 섹션이 아니라 §3 본문 블록쿼트에 있음 — 문서 자체의 관례상 정합하나, 검토자 입장에서 "새 Rationale 미기재"로 오판되기 쉬운 지점
  - target 위치: `spec/conventions/audit-actions.md` §3 (L72-80, `## Rationale` 헤딩 L84 이전)
  - 과거 결정 출처: 동일 문서 `## Rationale` → `### 기각된 대안`(L92-94)은 `workspace.transfer_ownership`·"시제 규약 위치" 2건만 형식을 갖춘 불릿으로 담고 있고, 도메인-레지스트리 수준의 개별 결정(`workflow.executed` 유예, `workspace.deleted` 구조적 제외, 짝 리소스 규칙)은 전부 §3 본문 블록쿼트에 있다.
  - 상세: 이번 target 도 그 기존 패턴(§3 본문 블록쿼트 = 레지스트리-국소 결정, `## Rationale` = taxonomy 설계 자체의 메타 근거)을 그대로 따랐다. 형식상 위반은 아니지만, "PR 이 §3 Rationale 에 새 결정 근거를 썼다"는 프레이밍과 달리 실제로는 `## Rationale` 헤딩 아래가 아니라 §3 표 직후 블록쿼트에 있어 — grep 이나 헤딩 기준 스캐너가 "## Rationale 에 새 항목 없음"으로 오판할 여지가 있다.
  - 제안: 이미 기존 관례와 일치하므로 강제 수정은 불필요. 다만 문서 전체에서 "레지스트리-국소 결정은 §3 블록쿼트에 쓴다"는 규칙이 암묵적이므로, Overview 의 "본 문서가 유일하게 소유하는 것 ①②③" 서술 옆에 이 배치 관례를 한 줄 명문화하면 향후 유사 리뷰의 오탐을 줄일 수 있다 (선택적 개선, 이번 PR 범위 밖으로 봐도 무방).

## 4.1.A(시제 도메인별 일관)와의 정합성

`1-auth.md §Rationale 4.1.A`는 dot-prefix 필수·과거분사 기본·Planned 액션 정규화를 다룬다. 신규 3액션(`trigger.notification_secret_rotated`/`trigger.chat_channel_bot_token_rotated`/`trigger.interaction_token_revoked`)은 모두 `trigger.` dot-prefix + 과거분사(§2.1, 합성 과거분사 포함)이며, 기존 `trigger.created/updated/deleted`(동일 §2.1)와 같은 패턴을 유지한다 — "같은 resource 안에서 CRUD 생애주기 verb 는 §2.1/§2.2 중 하나로 일관 표기"(§2 규칙)도 위반하지 않는다(회전/폐기는 CRUD 생애주기가 아니라 §2.1 합성 과거분사로 별도 취급되며 §2.3 과 혼용도 아니다). 모순 없음.

## 기각된 대안 서술의 사실관계 검증

메모리에 기록된 과거 사례("Rationale 기각된 대안은 실제 이력 필수 — 지어내면 checker 가 잡는다")를 기준으로 확인한 결과, 이번 target 의 "3분리 대신 `trigger.rotated`+`details.kind` 로 묶는 대안이 규약상 동등하게 가능했다"는 서술은:
1. 같은 PR 의 실제 커밋 메시지(`d71a53127`)에 동일 문구로 기록돼 있어 사후 윤색이 아니라 개발 과정에서 실제로 검토된 대안이고,
2. 인용하는 두 선례(`integration.rotated` 결합·`user.*` 분리)가 실제로 레지스트리에 존재하며 시점상 이 PR 이전부터 "구현" 상태였다.

날조된 이력이 아니다.

## 요약

target(`spec/conventions/audit-actions.md §3` + `1-auth.md §4.1`)이 트리거 시크릿/토큰 회전 감사 액션을 3개로 분리한 결정은, 기존 Rationale 에서 명시적으로 기각된 대안을 무근거로 재도입한 것이 아니다 — 오히려 결합(`integration.rotated`)·분리(`user.*`) 양쪽 선례를 모두 인용한 뒤 "폭발 반경(무효화 대상 범위)"이라는 새 축으로 분리를 택하고 그 근거를 남겼으며, 이 축은 코드 실측(grace 컬럼 유무, `auth_config` 비접촉)으로 뒷받침된다. `1-auth.md §Rationale 4.1.A`(dot-prefix·시제 일관)와도 충돌하지 않는다. 직전 사전 게이트 라운드(11:48:48)가 제기한 WARNING(웹훅 HMAC 회전과의 중복 우려)은 이번 target 에서 실측으로 해소돼 반영됐다. 유일하게 짚을 점은 새 Rationale 서술이 `## Rationale` 헤딩이 아니라 §3 본문 블록쿼트에 있다는 것인데, 이는 문서 자체의 기존 관례(레지스트리-국소 결정은 §3 블록쿼트, taxonomy 메타 근거만 `## Rationale`)와 일치하므로 문제로 보지 않는다.

## 위험도

NONE
STATUS: OK
