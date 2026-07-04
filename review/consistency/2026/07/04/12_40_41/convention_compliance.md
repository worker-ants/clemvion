# 정식 규약 준수 검토 — spec-update-execution-engine-pr4.md

- 검토 모드: spec draft 검토 (`--spec`)
- target: `plan/in-progress/spec-update-execution-engine-pr4.md`
- 반영 대상 spec: `spec/5-system/4-execution-engine.md`
- 참조 conventions: `spec/conventions/error-codes.md`, `spec/conventions/spec-impl-evidence.md`

## 발견사항

- **[WARNING] `error-codes.md` §3 `WORKER_HEARTBEAT_TIMEOUT` 레지스트리 갱신이 편집 목록에 누락**
  - target 위치: target 문서 "편집 목록 (before → after)" E7 (`### E7. §2.13 WORKER_HEARTBEAT_TIMEOUT`)
  - 위반 규약: `spec/conventions/error-codes.md` §3 "Historical-artifact 예외 레지스트리" — `WORKER_HEARTBEAT_TIMEOUT` 행이 코드 의미·발동 시점의 SoT 서술을 명시적으로 소유
  - 상세: `error-codes.md` §3 의 `WORKER_HEARTBEAT_TIMEOUT` 행은 현재 "(PR4 target) BullMQ stalled-job 재배달 attempts 소진 시 발동" 이라고 **미래형(target)** 으로 적혀 있다. target draft 는 spec 본문(`4-execution-engine.md`)의 "PR4 target/Planned" 마커를 전부 "PR4 구현 완료" 로 flip 하겠다고 하면서도, 이 conventions 문서의 동일 서술("(PR4 target)", "PR3 기간 발동하지 않는다 … PR4 target 발동") 을 갱신 대상 목록(E1~E8)에 포함하지 않았다. E7 은 "§2.13 동기화" 만 언급하고 conventions 파일은 언급하지 않는다. spec 본문만 갱신하고 conventions 문서를 그대로 두면, 정식 규약(SoT 성격의 카탈로그)과 spec 본문 사이에 "PR4 target" vs "PR4 구현 완료" 의 시제 불일치가 생긴다.
  - 제안: 편집 목록에 `spec/conventions/error-codes.md §3` 의 `WORKER_HEARTBEAT_TIMEOUT` 행을 "(PR4 target) …" → "(PR4 구현, 2026-07-04) …" 로 갱신하는 항목을 추가한다(예: "E9" 로 신설). 최소한 draft 의 "확정 사실"/"검증" 절에 이 conventions 문서도 정합화 대상임을 명시해 `/consistency-check --spec` 통과 후 실제 반영 시 누락되지 않도록 한다.

- **[INFO] draft 자체는 정식 spec 문서가 아니므로 frontmatter 스키마(`spec-impl-evidence.md`) 대상 아님 — 확인만**
  - target 위치: target 문서 전체 frontmatter (`worktree`, `spec_impact`)
  - 위반 규약: 해당 없음 — `spec/conventions/spec-impl-evidence.md` §1 은 `spec/**.md` 대상이고 `plan/in-progress/**.md` 는 별도로 `plan-lifecycle.md`/`plan-frontmatter.test.ts` 가 규율한다.
  - 상세: target 의 frontmatter 는 `worktree: exec-intake-pr4-stalled` 와 `spec_impact:` 리스트만 있고 `started`/`owner` 필드가 안 보인다. `spec-impl-evidence.md §4.2` 표에 따르면 `plan-frontmatter.test.ts` 가 `worktree`/`started`(ISO)/`owner` 를 top-level `plan/in-progress/*.md` 에 의무화한다(단 `worktree` 는 sentinel `(unstarted)` 허용). 본 파일은 payload 발췌본이라 전체 frontmatter 가 잘렸을 수 있어 CRITICAL 로 단정하지 않지만, 실제 파일에 `started`/`owner` 가 없다면 build 가드(`plan-frontmatter.test.ts`) 위반이다.
  - 제안: 실제 `plan/in-progress/spec-update-execution-engine-pr4.md` 파일의 frontmatter 에 `started`(ISO 8601)와 `owner` 필드가 존재하는지 재확인. (본 검토는 payload 에 제공된 발췌 기준이라 실물 파일 직접 확인을 권장.)

- **[INFO] `spec_impact` 리스트 형식은 규약 준수**
  - target 위치: frontmatter `spec_impact:`
  - 위반 규약: 없음 — 오히려 준수 사례
  - 상세: `spec_impact` 가 YAML 리스트(`- spec/5-system/4-execution-engine.md`)로 선언되어 있어 Gate C(`spec-plan-completion.test.ts`, bare string 금지) 요건에 부합한다. (참고: 이 항목은 draft 가 아니라 완료 시점 plan 에 적용되는 가드이므로 지금 단계에선 문제 없음 — 향후 이 plan 이 `complete/` 로 이동할 때 동일 형식 유지만 확인하면 된다.)

- **[INFO] PR 넘버링·날짜 표기 스타일은 기존 spec 관례와 일치**
  - target 위치: 편집 목록 전반 ("PR4 구현 완료(2026-07-04)" 표기)
  - 위반 규약: 없음
  - 상세: `4-execution-engine.md` 는 이미 "PR3 구현, 2026-07-04", "PR1 구현 완료" 식으로 PR 번호 + 날짜 병기 스타일을 쓰고 있어(§7.1 banner, §7.4 Recovery, Rationale 1470행 등), target draft 가 제안하는 "PR4 구현 완료(2026-07-04)" 표기는 기존 문서 관례와 일관된다.

## 요약

target 문서는 `spec/5-system/4-execution-engine.md` 본문의 "PR4 Planned/target" 마커를 구현 완료로 뒤집는 spec-update draft이며, 명명·구조·표기 스타일은 기존 spec 관례(PR 번호+날짜 병기, `maxStalledCount`/`WORKER_HEARTBEAT_TIMEOUT` 등 기존 식별자 재사용, 에러 코드 rename 금지 원칙 준수 — 신규 코드 신설이 아니라 기존 `WORKER_HEARTBEAT_TIMEOUT` 의 "재정의"로 처리)과 잘 정합한다. 다만 `spec/conventions/error-codes.md` §3 이 `WORKER_HEARTBEAT_TIMEOUT` 의 발동 시점·의미를 "(PR4 target)" 미래형으로 명시적으로 서술하고 있는데, draft 의 편집 목록(E1~E8)이 이 conventions 파일 갱신을 누락하고 있어 spec 본문만 반영될 경우 정식 규약 문서와 본문 사이에 시제 불일치(conventions 는 여전히 "PR4 target", spec 본문은 "PR4 구현 완료")가 남을 위험이 있다. 이는 CRITICAL 급 invariant 붕괴는 아니지만(둘 다 같은 사실을 가리키며 단순 표기 지연), 정식 규약 문서가 spec 본문과 별도로 그 코드의 "진실"을 서술하는 SoT 성격을 가지므로 WARNING으로 분류한다. 그 외 frontmatter 필드(started/owner) 실물 확인은 INFO 레벨 확인 사항이다.

## 위험도

LOW
