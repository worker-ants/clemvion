# 유저 가이드 동반 갱신(User Guide Sync) Review

## 분석 대상 파일

1. `codebase/backend/src/common/decorators/workspace.decorator.spec.ts` (테스트 전용 변경)
2. `codebase/frontend/src/lib/i18n/backend-labels.ts` (ERROR_KO 매핑 추가)
3. `plan/in-progress/chat-channel-followups-batch.md` (plan 추적 문서)
4. `plan/in-progress/spec-sync-chat-channel-gaps.md` (plan 비고 추가)
5. `spec/5-system/1-auth.md` (§1.1 인증 메일 재발송 24h 유효 명시)

(HEAD~2 commit `46bbd295` 의 `triggers.mdx` / `triggers.en.mdx` 변경은 이미 이전 PR 에 포함 — 본 review 대상 commit 은 HEAD `70ea50ac` + HEAD~1 `f45e856c`.)

---

## 매트릭스 트리거 매칭 분석

### 파일 1: `workspace.decorator.spec.ts`
- 위치: `codebase/backend/src/common/decorators/` — `nodes/**` 패턴 비매칭
- `modules/auth/**` 패턴 비매칭 (`common/decorators` 경로)
- 테스트 파일만 변경; 새 warningRule / ErrorCode enum 변경 없음
- **매트릭스 트리거 없음**

### 파일 2: `codebase/frontend/src/lib/i18n/backend-labels.ts`
- `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 신규 등록
- `WORKSPACE_ID_REQUIRED` 는 `error-codes.ts` enum 이 아닌 `workspace.decorator.ts` 에 inline throw 코드 — 매트릭스 `new-error-code` 트리거(`codebase/backend/src/nodes/core/error-codes.ts` glob)에 형식상 매칭되지 않음
- 그러나 이 파일 변경 자체가 `new-error-code` 행의 target(동반 갱신 대상)이다 — 이전 commit(#566)에서 `workspace.decorator.ts` 가 신규 에러 코드를 발행했고, 본 commit 이 그 ko 매핑을 추가함
- **이 파일 자체는 동반 갱신 target 이지, 새로운 동반 갱신을 유발하는 trigger 가 아니다**

### 파일 3-4: `plan/` 문서
- plan 관리 문서(추적 체크박스·비고 추가) — 매트릭스 어떤 트리거에도 매칭되지 않음

### 파일 5: `spec/5-system/1-auth.md`
- `spec/5-system/**` 경로 — 매트릭스 `spec-major-change` 트리거 (`spec/5-*/**`) 매칭
- 변경 내용: §1.1 "인증 메일 재발송" 행에 "발급되는 인증 토큰은 24h 유효 (§5 동일)" 문구 추가 (단순 사실 명시 보완)
- `spec-major-change` 의 target: `frontmatter code: / status: / pending_plans: 정합 갱신` — spec 파일의 frontmatter 가 이미 `status: partial` + `pending_plans:` 가 존재하며, 본 변경은 prose 1행 추가(기존 구현 사실 기재)이므로 status/code/pending_plans 변경 불요
- auth-session-flow-change 트리거(`codebase/backend/src/modules/auth/**`) — spec 문서 경로라 코드 파일 트리거에 해당하지 않음
- **user-guide (07-workspace-and-team/) 동반 갱신 대상이 아님** — §1.1 행은 기존 구현 사실을 spec 에 명기한 것이고, auth 흐름 자체의 변경이 아님

---

## 발견사항

특이 사항 1건 — INFO 수준:

- **[INFO]** `triggers.mdx` / `triggers.en.mdx` 의 "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" 주석 정확도
  - 변경 파일: `codebase/frontend/src/lib/i18n/backend-labels.ts`
  - 맥락: `ERROR_KO["WORKSPACE_ID_REQUIRED"]` 가 추가되면서 해당 코드는 이제 한국어로 표시됨. triggers callout 에 열거된 6개 코드 중 `WORKSPACE_ID_REQUIRED` 만 ko 매핑 존재. 나머지 5개(`INVALID_BOT_TOKEN`, `TRIGGER_NOT_FOUND`, `CHAT_CHANNEL_NOT_CONFIGURED`, `CHAT_CHANNEL_PROVIDER_UNKNOWN`, `CHAT_CHANNEL_ENDPOINT_REQUIRED`)는 여전히 `ERROR_KO` 미등록
  - 현재 callout 의 "일부 코드는 현재 영문 메시지 그대로 화면에 노출될 수 있어요" 는 나머지 5개 코드에 대해 여전히 사실 — 설명이 틀리지는 않음
  - 제안(선택): 현 시점에서 triggers.mdx 를 수정해 `WORKSPACE_ID_REQUIRED` 를 "이미 한국어 지원됨" 으로 표시하거나 나머지 5개 코드를 별도로 명시하면 더 정확해짐 — 그러나 현 설명이 거짓이 아니므로 강제 갱신 요구 수준은 아님

---

## 요약

매트릭스 총 18개 트리거 중 현 변경 set 에 매칭되는 트리거는 사실상 없다. `backend-labels.ts` 의 `ERROR_KO` 추가는 새로운 트리거가 아니라 이전 PR(#566)에서 발행된 에러코드(`WORKSPACE_ID_REQUIRED`)의 ko 매핑 동반 갱신 target 이다. `workspace.decorator.spec.ts` 는 테스트 파일 단독 변경으로 어떤 docs/i18n 동반 갱신도 요구하지 않는다. `spec/5-system/1-auth.md` 변경은 prose 1행 사실 명시 보완으로 user-guide 갱신을 유발하지 않는다. INFO 1건(triggers.mdx callout 정확도)은 기존 설명이 여전히 사실이므로 차단 수준 아님. 누락된 동반 갱신: 0건.

## 위험도

NONE

STATUS=success ISSUES=0
