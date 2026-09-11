# Rationale 연속성 검토 — spec-draft-chat-channel-binder-drift

## 발견사항

- **[INFO]** 신규 glob 결정 Rationale 에 상위 Convention 의 기존 R-1 을 cross-ref 하지 않음
  - target 위치: target 문서 `## Rationale (spec 본문에 실을 근거)` 절 (target line 184-192)
  - 과거 결정 출처: `spec/conventions/spec-impl-evidence.md` `## Rationale` → `### R-1. code: 글로브 허용 vs 명시 파일만` (실제 파일 199-203행) — "글로브 허용을 채택. 영역 단위 책임 … 을 자연스럽게 표현하고 마이그레이션 부담을 낮춤."
  - 상세: target 이 `15-chat-channel.md` 에 새로 쓰려는 R-CC-* 항목("`code:` 를 glob 으로 바꾸는 결정의 근거는 세 번 연속 재발 + 정본 매처 실측이다")은 spec-impl-evidence.md R-1 이 이미 일반 원칙으로 glob 을 승인해 둔 것의 **개별 적용 사례**다. 두 문서가 같은 결론(glob 허용)에 서로 다른 근거(R-1=영역 단위 책임 표현·마이그레이션 부담, 신규 항목=3회 재발+정본 매처)로 도달한 것 자체는 모순이 아니지만, 신규 항목이 R-1 을 인용하지 않으면 다음 사람이 "이 spec 만 예외적으로 glob 을 쓰는 것"으로 오독할 위험이 있다(target 스스로도 "다른 spec 은 대부분 명시 경로다" 라고 적어 그 인상을 강화한다).
  - 제안: 신규 R-CC-* 항목에 `[spec-impl-evidence.md §R-1]` 형태로 상위 원칙을 cross-ref 해, "일반 원칙(R-1, glob 허용) 아래에서 이 spec 이 왜 지금 그 옵션을 행사하는가"라는 관계를 명시한다.

- **[INFO]** 신규 Rationale ID 번호가 draft 안에 확정돼 있지 않음
  - target 위치: target 문서 `## Rationale (spec 본문에 실을 근거)` 절 · 체크리스트 "`## Rationale` 에 glob 결정 근거"
  - 과거 결정 출처: `spec/5-system/15-chat-channel.md` `### Rationale ID 컨벤션` (실제 파일 기준 최신 항목은 `### R-CC-21`)
  - 상세: 기존 컨벤션은 신규 로컬 Rationale 에 `R-CC-N` prefix 순번을 요구한다. target 은 이 규약을 따르겠다는 의도만 밝히고 구체 번호(`R-CC-22`)를 못박지 않았다 — 이 자체는 결함이 아니나, 동시 진행 중인 다른 세션이 같은 파일에 `R-CC-22` 를 먼저 써넣으면 번호 충돌이 날 수 있다(병렬 세션 머지 충돌 클래스).
  - 제안: spec 반영 직전 `grep '^### R-CC-' spec/5-system/15-chat-channel.md` 로 최신 번호를 재확인 후 번호를 확정한다(이미 실측 습관이 있는 팀 관례와 일치).

## 요약

target 초안(①`code:` 명시 경로→좁은 glob 3개 전환, ②§7 5파일 누락 보강 + 주석 정정, ③`setupChatChannel` 귀속 표기 3곳 정정)은 신규 설계 결정을 도입하는 것이 아니라 **developer 턴에서 이미 완료된 코드 이동(`#1319`/`#1320`, 실제 저장소에서 `git log`·소스로 검증됨)을 SoT 에 뒤늦게 반영**하는 성격이다. 검증 결과 — (1) `15-chat-channel.md`·`chat-channel-adapter.md`·`secret-store.md`·`data-flow/14-chat-channel.md` 의 기존 `## Rationale`(R1~R21, R-CC-10~21, R-K 등) 어디에도 "`setupChatChannel` 은 반드시 `TriggersService` 소유여야 한다"거나 "`code:` 는 명시 경로만 허용한다" 같은 원칙이 존재하지 않아 번복·위반 대상이 없다. (2) 오히려 `spec/conventions/spec-impl-evidence.md` R-1 이 이미 "glob 허용, 영역 단위 책임 표현"을 일반 원칙으로 승인해 두었고, target 의 glob 전환은 그 원칙과 정합한다. (3) target 은 이 glob 전환에 대해 스스로 `## Rationale` 갱신을 명시적으로 계획하고 있어 "결정의 무근거 번복" 문제도 발생하지 않는다. (4) `setupChatChannel`/`teardownChatChannel` 이동은 실제 코드(`chat-channel-binder.service.ts`)로 확인됐고, 관련 spec 서술(secret-store.md §2.1, chat-channel-adapter.md §2.4 JSDoc, data-flow/14-chat-channel.md §0)의 현재 텍스트와 target 의 편집 대상 verbatim 인용이 정확히 일치해 사실관계 오류도 없다. R-CC-10/R-CC-21(비밀-쓰기 금지·rotate 단일 경로)처럼 최근 확정된 인접 결정에는 target 이 손대지 않으며, "안 하는 것" 절에서 스코프를 명시적으로 좁혀 두어 무단 확장 위험도 낮다. 발견된 두 항목은 모두 정합성 보완 제안(INFO) 수준이며 target 을 막을 사유가 아니다.

## 위험도

NONE
