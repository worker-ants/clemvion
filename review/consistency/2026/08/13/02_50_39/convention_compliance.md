# 정식 규약 준수 검토 — spec/5-system/ (CCH-SE-02 update dedup)

## 검토 범위

`--impl-done`, diff-base `origin/main`, target `spec/5-system/`. 프롬프트에 번들된 diff 자체는
예산 초과로 절단돼 있어, 워크트리에서 직접 `git diff origin/main...HEAD` 를 재현해 실제 변경
범위를 확정했다:

- `spec/5-system/15-chat-channel.md` — CCH-SE-02 요구사항 행 1줄 재작성 (update dedup 메커니즘
  서술을 "EIA Idempotency-Key 자동 발급" → `ChatChannelDedupService` 기반 Redis dedup 으로 정정)
- `spec/4-nodes/7-trigger/providers/telegram.md` — §8 비기능의 "미구현 (Planned)" → "구현됨" 전환
- `codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts` (신규) + `.spec.ts`
- `codebase/backend/src/modules/chat-channel/chat-channel.module.ts` (provider 등록)
- `codebase/backend/src/modules/hooks/hooks.service.ts` / `.spec.ts` (배선)
- `CHANGELOG.md`

실제 target 문서 diff 는 1개 파일 1줄로 매우 좁다. 관련 정식 규약
(`spec/conventions/chat-channel-adapter.md`, `spec/conventions/spec-impl-evidence.md`) 을
정독하고 아래 관점으로 대조했다.

## 발견사항

없음 — CRITICAL/WARNING 급 위반을 발견하지 못했다.

### 확인한 항목 (위반 아님, 근거 기록)

- **명명 규약**: `ChatChannelDedupService` (PascalCase + `Service` suffix), 파일
  `chat-channel-dedup.service.ts` (kebab-case), 테스트 `chat-channel-dedup.service.spec.ts`
  (`.spec.ts` — 같은 모듈의 `chat-channel-rate-limiter.service.spec.ts` 등 형제 파일과 동일 패턴).
  Redis 키 `cc:dedup:<triggerId>:<idempotencyKey>` 는 형제 서비스
  `ChatChannelRateLimiterService` 의 `cc:rl:<triggerId>:<conversationKey>` 키 패턴과 동일 프리픽스
  체계(`cc:<짧은코드>:<triggerId>:...`)를 따른다. DI 토큰 `CHAT_CHANNEL_DEDUP_REDIS` 도
  `CHAT_CHANNEL_RATE_LIMIT_REDIS` 와 동일 명명 패턴. — 위반 없음.
- **출력 포맷 규약**: 이번 변경은 신규 API 응답·이벤트 페이로드·에러 코드를 추가하지 않는다
  (기존 `202 Accepted` + `{ executionId: 'ignored' }` 응답 형태를 CCH-NF-03 과 동일하게 재사용).
  `spec/conventions/error-codes.md`·`swagger.md` 대상 표면 변경 없음. — 해당 없음.
- **문서 구조 규약**: `spec/5-system/15-chat-channel.md` 는 Overview(§Overview 제품 정의) / 본문
  (§3~§8) / `## Rationale` 3섹션 구조를 그대로 유지하며, 이번 PR 은 §3.4 표 내부 셀 1개만
  수정해 구조를 건드리지 않는다. frontmatter (`id`/`status: partial`/`code:`/`pending_plans:`)도
  변경 없이 기존 `code:` glob (`codebase/backend/src/modules/chat-channel/**`) 이 신규
  `chat-channel-dedup.service.ts` 를 자동으로 커버해 `spec-impl-evidence.md` §4
  (`spec-code-paths.test.ts`) 요건을 그대로 만족한다. `telegram.md` 도 frontmatter 불변,
  `status: implemented` 유지(신규 파일이 provider-agnostic 공유 서비스라 telegram 전용
  `code:` 목록에 넣을 필요는 없다 — provider-specific 목록의 성격과 정합).
  — 위반 없음.
- **API 문서 규약**: 신규/변경 controller 엔드포인트·DTO 없음 (기존 `POST /api/hooks/:endpointPath`
  내부 분기 추가일 뿐). `swagger.md` 데코레이터 규약 대상 아님. — 해당 없음.
- **금지 항목**: `secret-store.md`(평문 저장 금지), `audit-actions.md`(특권 작업 감사 의무) 등
  명시적 금지 패턴에 저촉되는 신규 표면 없음. dedup 서비스는 secret 을 다루지 않고, 신규
  audit 대상 특권 작업도 아니다. — 해당 없음.
- **EIA-AU-08 / in-process trusted caller 서술 정합성**: 신규 코드 주석·CHANGELOG 가 주장하는
  "chat-channel inbound 는 `scope: 'in_process_trusted'` 로 HTTP `IdempotencyInterceptor` 를
  우회한다" 는 `spec/5-system/14-external-interaction-api.md` EIA-IN-06/EIA-AU-08/§3.3.1 의
  기존 서술과 정확히 일치한다(직접 확인). 종전 CCH-SE-02 원문("EIA `Idempotency-Key` 를
  어댑터가 자동 발급")은 이 우회 경로와 모순되는 오도적 서술이었고, 이번 수정이 그 불일치를
  해소했다 — 규약 위반이 아니라 규약과의 정합성을 개선한 변경이다.

### INFO — 표 행 서술 스타일의 국소적 비일관성 (강제 규약 아님)

- target 위치: `spec/5-system/15-chat-channel.md` §3.4 표, CCH-SE-02 행
- 위반 규약: 없음 (형식을 강제하는 `spec/conventions/**` 항목 없음 — 참고용 INFO)
- 상세: 같은 표의 형제 행 CCH-CV-03·CCH-NF-03 은 요구사항 문장 뒤에 `<br>구현: ...`
  서브라인을 두고 실제 구현 파일을 `[`file.ts`](path)` 마크다운 링크로 명시한다. 이번에 고친
  CCH-SE-02 행은 `ChatChannelDedupService`/Redis 키 포맷을 본문 문장 안에 inline 텍스트로만
  녹여 넣었고, `chat-channel-dedup.service.ts` 로의 명시적 링크가 없다.
- 제안: 문서 자체가 이미 확립한 "구현:" 서브라인 패턴과 맞추려면
  `<br>구현: [`chat-channel-dedup.service.ts`](../../codebase/backend/src/modules/chat-channel/chat-channel-dedup.service.ts)`
  형태의 링크를 추가하는 편이 표 내 일관성 면에서 낫다. 다만 이는 강제 규약 위반이 아니라
  가독성 제안이므로 별도 조치 없이 넘어가도 무방하다.

## 요약

이번 PR 의 target(`spec/5-system/`) 변경분은 `spec/5-system/15-chat-channel.md` 표 셀 1줄
재작성(및 자매 문서 `telegram.md` 각주 갱신)으로 범위가 매우 좁다. 명명(서비스/파일/Redis 키),
frontmatter·문서 3섹션 구조, API 문서 표면, 금지 패턴 등 모든 점검 관점에서 `spec/conventions/**`
위반을 발견하지 못했다 — 새 서비스의 명명·Redis 키 포맷은 형제 서비스
(`ChatChannelRateLimiterService`)의 기존 패턴을 그대로 따르고, frontmatter `code:` glob 은
신규 파일을 자동 커버하며, 이번 수정 자체가 EIA-AU-08 서술과의 기존 불일치를 해소하는 방향이다.
유일한 지적은 표 행 서술 스타일의 국소적 비일관성(INFO, 강제 규약 아님)뿐이다.

## 위험도

NONE
