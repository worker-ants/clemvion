# Convention Compliance Review — spec-draft-chat-channel-error-notify.md

검토일: 2026-05-25
대상: `plan/in-progress/spec-draft-chat-channel-error-notify.md`
검토 모드: `--spec` (spec draft)

---

## 발견사항

### [WARNING] Plan frontmatter `pending_plans` 미선언 — `spec/conventions/spec-impl-evidence.md §2` 위반 가능성

- **target 위치**: frontmatter `target_specs` 리스트 (`spec-draft-chat-channel-error-notify.md` 상단)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §2.1` — `status: partial` spec 파일은 `pending_plans:` 의무. 본 draft 는 **plan** 문서이므로 직접 적용 대상은 아니지만, 변경 대상 spec 인 `spec/5-system/15-chat-channel.md` 의 frontmatter `pending_plans:` 에 본 작업(plan)이 등재되어 있지 않다. 현재 해당 spec 의 frontmatter 는 6개 `pending_plans` 만 나열하고 있으며, `chat-channel-error-notify` plan 은 포함되어 있지 않다.
- **상세**: `spec-impl-evidence.md §3.1` 전이 규칙에 따라 spec 이 `partial` 상태인 동안 자기를 책임지는 plan 이 `pending_plans:` 에 등재되어야 한다. 본 draft 가 최종 적용되면 `spec/5-system/15-chat-channel.md` 는 신규 §3.5 요구사항을 얻게 되므로, 구현이 완료될 때까지 해당 plan 이 `pending_plans:` 에 올라가야 한다.
- **제안**: spec 본 적용 시(`spec/5-system/15-chat-channel.md` 갱신), frontmatter `pending_plans:` 에 `plan/in-progress/chat-channel-error-notify.md` 항목을 추가해야 한다. 본 draft 자체를 차단하지는 않으나, 적용 단계 체크리스트에 포함 필요.

---

### [WARNING] `spec/conventions/chat-channel-adapter.md §3` 매핑 표 행 갱신 — 기존 `execution.failed` 행과 충돌

- **target 위치**: Change 2a — §3 매핑 표 `execution.failed` 행 (현 `chat-channel-adapter.md` line 240)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §3` 매핑 표 기존 행 (`| execution.failed | error.message | text 1건 — 에러 안내 (사용자에게 안전한 형태로 redact) |`)
- **상세**: 현재 Convention §3 의 `execution.failed` 행은 입력을 `error.message` 로 명시한다. draft 의 Change 2a 는 이를 `error.code + error.details.statusCode (다른 필드 사용 금지)` 로 교체한다. 이 갱신은 **Convention 자체**를 변경하는 것이므로, Convention 의 `Changelog` 행이 Change 2d 에서 제공되어 있고 Rationale R5 도 존재한다. 규약 위반이라기보다 규약 갱신 절차 (`§7 변경 관리`) 의무를 충족하는지 확인이 필요하다. §7 은 본 컨벤션 변경 시 `spec/5-system/15-chat-channel.md` + 모든 provider spec 동시 갱신을 의무화한다. draft 는 Change 1~5 에서 이 모든 파일을 커버하므로 §7 절차상 의무는 충족한다. 단 변경 관리 의무 충족을 명시적으로 선언하는 문구가 draft 의 "영향 요약" 에는 있으나, Convention §7 참조가 누락된 점은 아래 INFO 항목으로 기록.

---

### [WARNING] `spec/conventions/chat-channel-adapter.md` — §3.1 신설 섹션이 기존 §3 번호 체계를 갱신하지 않음

- **target 위치**: Change 2b — §3 끝에 신규 §3.1 신설
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §4` (Form 다단계 시퀀스 규약) 는 기존 §4 로 존재하는데, 신설 §3.1 삽입 후 §4 이하의 번호가 밀리지 않는다. 그러나 §3.1 이 §3(매핑 표) 의 하위 섹션으로 삽입되고 §4 는 그대로 유지되므로 번호 충돌은 없다.
- **상세**: 실제로는 번호 충돌 없음. 단 Convention 파일의 §4 이하 (Form 다단계 §4, Adapter Registry §5, 보안 §6, 변경 관리 §7) 는 그대로이며 §3 아래에 §3.1 이 삽입되는 구조는 마크다운 heading depth (`###`) 로 일관되게 처리된다. 이 패턴은 기존 §1.1 (`### 1.1 6함수 책임`) 과 동일하여 컨벤션 내 기존 관행과 일치한다.
- **제안**: 위반 아님. 단 `spec/conventions/chat-channel-adapter.md §7 변경 관리` 에서 "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무"로 명시된 조건에 §3.1 신설도 해당되므로, draft 의 변경 scope 가 §7 의무를 충족함을 확인 완료.

---

### [INFO] `spec/conventions/chat-channel-adapter.md §7` 변경 관리 cross-link 명시 누락

- **target 위치**: Change 2d — Changelog 한 줄 (draft 마지막 Changelog 행)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §7` — "본 인터페이스 변경은 다음 두 spec 동시 갱신 의무"
- **상세**: Changelog 행은 "6함수 인터페이스 / 기타 데이터 타입 변경 없음"을 명시하여 인터페이스 변경이 없음을 기술한다. §7 의무는 인터페이스 변경 시 적용되며, 본 draft 는 §3 매핑 표 행과 §3.1 알고리즘 신설이지 6함수 시그니처 변경이 아니다. 따라서 §7 의 엄격한 의미에서는 인터페이스 변경이 아니므로 직접 위반은 아니다. 그러나 실질적으로 렌더링 동작의 계약을 바꾸는 것이므로 §7 의 취지를 넓게 해석하면 동반 갱신 의무 대상이 된다. draft 는 모든 대상 파일을 포함하고 있어 실질적으로 충족되어 있다.
- **제안**: 위반 아님. 참고 사항으로 기록.

---

### [INFO] 문서 구조 — plan draft 의 3섹션 구조 (Overview / 본문 / Rationale) 부재

- **target 위치**: `plan/in-progress/spec-draft-chat-channel-error-notify.md` 전체 구조
- **위반 규약**: `CLAUDE.md` — "Spec 문서 3섹션 구성 (Overview / 본문 / Rationale): 각 SKILL.md 참고"
- **상세**: 본 문서는 **plan** 의 spec draft 로, spec 파일 자체가 아니라 변경 diff 를 나열하는 plan 문서다. CLAUDE.md 의 3섹션 구조 의무는 spec 파일 (`spec/<영역>/*.md`) 에 적용되는 것이지 `plan/in-progress/` 의 draft plan 에 적용되는 것이 아니다. 실제 적용될 spec 파일 변경분(Change 1~6)은 모두 해당 spec 파일에 Rationale 절을 포함하고 있다 (R-CC-15, R5). 따라서 이 항목은 위반이 아니다.
- **제안**: 위반 아님. 참고 기록.

---

### [INFO] `spec/conventions/chat-channel-adapter.md §1.2` — `EiaEvent` union 의 `execution.failed` 타입 표현과 §3.1 입력 타입 정합

- **target 위치**: Change 2b — `classifyExecutionFailure` 함수 시그니처 (`Extract<EiaEvent, { type: "execution.failed" }>`)
- **위반 규약**: `spec/conventions/chat-channel-adapter.md §1.2` — `EiaEvent` union 의 `execution.failed` 항목: `error: { code: string; message: string; nodeId: string | null; details?: unknown }`
- **상세**: §3.1 의 `classifyExecutionFailure` 는 `error.details?.statusCode` 를 접근한다. `§1.2` 의 `execution.failed` 타입 정의에서 `details` 는 `unknown` 타입이다. TypeScript 에서 `unknown` 에서 `.statusCode` 를 바로 접근하면 컴파일 에러가 발생한다. `details?.statusCode` 가 의도대로 동작하려면 `details` 가 `{ statusCode?: number } | unknown` 처럼 타입이 구체화되어야 하거나, 런타임 type-guard 가 필요하다. 현재 §1.2 의 `details: unknown` 과 §3.1 의 접근 패턴 사이에 타입 레벨 불일치가 있다.
- **제안**: §3.1 카테고리 매핑 표 주석 또는 §1.2 `execution.failed.details` 타입을 `{ statusCode?: number } & Record<string, unknown>` 처럼 구체화하는 방향으로 Convention 갱신을 검토하거나, 구현에서 type-guard (`typeof (details as any)?.statusCode === 'number'`) 사용 정책을 §3.1 에 명시. 현재 draft 는 이 불일치를 언급하지 않는다.

---

### [INFO] Rationale R-CC-15 위치 — `spec/5-system/15-chat-channel.md` 에서 현재 마지막 Rationale 번호 확인 권장

- **target 위치**: Change 1e — R-CC-15 신규 추가 (line 605 이후)
- **위반 규약**: 없음 (규약 직접 위반은 아님)
- **상세**: draft 는 "R-CC-14 다음에 추가"라고 명시한다. 실제 `spec/5-system/15-chat-channel.md` 의 마지막 Rationale ID 가 R-CC-14 인지 검토자가 직접 파일을 열어 확인해야 한다. 만약 R-CC-14 보다 높은 번호가 이미 존재한다면 번호 충돌이 발생한다. 이는 draft 작성 시점의 가정이므로 spec 본 적용 전 최신 파일과의 검증이 필요하다.
- **제안**: spec 본 적용 단계에서 현재 Rationale 최대 번호를 확인 후 순서 번호 부여. 단순 검증 사항으로 규약 위반은 아니다.

---

### [INFO] `plan/in-progress/chat-channel-dispatcher-split.md` — `pending_plans` 에 포함된 plan 의 실존 여부

- **target 위치**: `spec/5-system/15-chat-channel.md` frontmatter `pending_plans[0]`
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §4` — `spec-pending-plan-existence.test.ts` 가드: `pending_plans:` 의 모든 path 가 `plan/in-progress/` 에 실존 의무
- **상세**: 현재 `spec/5-system/15-chat-channel.md` frontmatter 의 `pending_plans` 에 `plan/in-progress/chat-channel-dispatcher-split.md` 이 포함되어 있다. `plan/in-progress/` 목록 확인 결과 해당 파일이 보이지 않는다 (목록에는 `chat-channel-discord-gateway.md`, `chat-channel-form-native-modal.md` 등만 확인됨). 이 불일치가 이미 존재하는 것이라면 본 draft 와 무관한 기존 문제이지만, 규약 가드(`spec-pending-plan-existence.test.ts`) 위반이다.
- **제안**: `chat-channel-dispatcher-split.md` 가 `plan/complete/` 로 이동했거나 삭제된 것이라면, `spec/5-system/15-chat-channel.md` frontmatter 에서 해당 항목을 제거해야 한다. 본 draft 의 spec 적용 PR 에 포함하거나 별도 수정.

---

## 요약

정식 규약 준수 관점에서 본 draft 는 전반적으로 규약 체계를 잘 따르고 있다. 명명 규약(CCH-ERR-* prefix 신설, i18n 키 명명), 문서 구조 (spec 3섹션 변경분에 Rationale 포함), Convention §7 변경 관리 의무(6개 파일 동반 갱신), Changelog 갱신 등 핵심 규약 항목을 충족한다. 주요 주의사항은 두 가지다: (1) `spec/5-system/15-chat-channel.md` frontmatter `pending_plans:` 에 본 작업 plan 이 포함되어야 하며, 이는 spec 본 적용 시 처리되어야 한다. (2) Convention §1.2 의 `execution.failed.details: unknown` 타입과 §3.1 신설 분류 함수의 `details?.statusCode` 접근 사이에 TypeScript 타입 레벨 불일치가 있어, 구현 단계에서 type-guard 처리 또는 Convention 타입 구체화가 필요하다. 기존 spec frontmatter `pending_plans` 의 stale 항목(`chat-channel-dispatcher-split.md`) 은 본 draft 와 무관한 기존 문제이나 규약 가드 위반에 해당하므로 병행 수정을 권장한다.

---

## 위험도

**LOW**

CRITICAL 또는 강한 WARNING 수준의 규약 직접 위반은 발견되지 않았다. 발견된 항목들은 모두 spec 본 적용 단계에서 처리 가능한 수준이며, 현재 draft 의 내용 자체가 다른 시스템의 invariant를 즉각적으로 깨는 패턴은 없다.
