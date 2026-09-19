# 신규 식별자 충돌 검토 — spec/4-nodes/4-integration/ (--impl-done)

## 검토 범위 확인

- spec 델타: `spec/4-nodes/4-integration/` 0개 파일 (이 PR 은 spec 을 바꾸지 않음 — 정상, CRITICAL 근거 아님).
- 구현 diff: 14개 파일 / 696줄. 워크트리(`/Volumes/project/private/clemvion/.claude/worktrees/smtp-ssrf-cgnat-8d41b2`)를 절대경로로 직접 읽고 `git grep` 으로 전체 코드베이스 대조함.
- 변경 내용 요약: SMTP(Send Email) 의 SSRF 가드를 `common/utils/smtp-host-guard.ts`(구현)에서 `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts`(신규 위치, 동일 함수명 `isSmtpHostBlocked` 유지)로 이동하고, 내부 구현을 HTTP/DB 노드가 쓰는 공용 `http-safety.ts` 로 위임. `http-safety.ts` 에 CGNAT(`100.64.0.0/10`)·IPv4-mapped IPv6(`::ffff:a.b.c.d`) 판정을 위한 `canonicalIPv6` / `mappedIPv4` / `isBlockedIPv6` 헬퍼 추가.

## 발견사항

### 1. 요구사항 ID 충돌
해당 없음 — 이 PR 은 새 요구사항 ID 를 부여하지 않는다.

### 2. 엔티티/타입명 충돌
해당 없음 — 새 엔티티/DTO/인터페이스 도입 없음. 신규 클래스는 `SsrfBlockedError`(신규) 뿐이며 `git grep` 결과 코드베이스 전체에서 이 이름의 기존 사용처 없음(신규 도입 확인, 충돌 없음).

### 3. API endpoint 충돌
해당 없음 — 새 endpoint 없음. `test/integration-connection-test.e2e-spec.ts` 에 추가된 테스트 케이스(B2)는 기존 connection-test endpoint 를 재사용한다.

### 4. 이벤트/메시지명 충돌
해당 없음 — webhook/queue/sse 이벤트 신설 없음.

### 5. 환경변수·설정키 충돌
새 ENV var 없음 — 오히려 SMTP 전용으로 존재했을 수 있는 별도 플래그(`SMTP_BLOCK_PRIVATE_HOSTS`, 주석상 opt-in 안이 검토됐으나 채택되지 않음)를 신설하지 않고 기존 `ALLOW_PRIVATE_HOST_TARGETS`(HTTP Request/DB Query 가 이미 사용 중) 를 그대로 재사용하도록 통일했다. `.env.example` 도 세 노드 공용으로 주석만 갱신, 키 자체는 변경 없음. `git grep`으로 `SMTP_BLOCK_PRIVATE_HOSTS` 를 확인한 결과 활성 코드에는 없고 plan 문서의 역사적 언급(폐기된 안)에만 남아 있어 충돌 없음.

### 6. 파일 경로 충돌
- **[INFO] `smtp-host-guard.ts` 위치 이동**
  - target 신규 식별자: `codebase/backend/src/nodes/integration/send-email/smtp-host-guard.ts` (+ `.spec.ts`)
  - 기존 사용처: 이전 위치 `codebase/backend/src/common/utils/smtp-host-guard.ts`(+`.spec.ts`) — diff 상 완전히 삭제됨(`git diff --stat` 에 `-33`/`-37` 라인으로 확인), 잔존 파일 없음(`find` 결과 0건).
  - 상세: 파일명이 동일(`smtp-host-guard.ts`)하고 함수 시그니처(`isSmtpHostBlocked`)도 동일하게 유지된 채 폴더만 `common/utils/` → `nodes/integration/send-email/` 로 이동했다. 노드별 폴더 구조 컨벤션(`http-safety.ts` 가 `http-request/` 에 위치하고 다른 노드가 import 해 쓰는 것과 동일 패턴)과 부합하며, import 경로 갱신도 diff 에 함께 반영되어(`integrations.service.ts`, `send-email.handler.ts`) 이전 경로를 참조하는 잔존 코드는 없다. 실질적 충돌 없음 — 이동이 깨끗하게 완료됐다.
  - 제안: 없음 (정상적인 리팩터링, 조치 불필요).

## 참고 — 진짜 충돌은 아니지만 인접 관찰

코드베이스에는 이번 diff 와 무관하게 SSRF 판정 구현이 세 벌 존재한다: (a) `nodes/integration/http-request/http-safety.ts`(`assertSafeOutboundUrl`/`assertSafeOutboundHostResolved`/`isBlockedHostname`, 이번 PR 대상 — HTTP/DB/Email 노드), (b) `common/utils/ssrf.util.ts`(`isPrivateHost`/`resolvesToPrivate`, LLM 프로바이더용), (c) `common/utils/ssrf-safe-url.util.ts`(`isLiteralIpv4`/`isPrivateIpv4`/`isPrivateIpv6`/`checkSsrfSafeUrl`/`checkResolvedHostIp`, S3/webhook/model-config 등에서 사용). 함수명 자체는 서로 겹치지 않아(각각 다른 이름) 본 checker 관점(식별자 충돌)의 CRITICAL/WARNING 대상은 아니다 — 다만 세 구현이 병존한다는 사실 자체는 별도 관점(중복 로직 통합)의 리뷰 대상일 수 있으며, 이번 PR 의 스코프(SMTP 를 (a) 로 통일)에는 포함되지 않는다. 참고로 target 코드 자체가 이 배경을 주석("종전에는 LLM 프로바이더용 `common/utils/ssrf.util` 을 썼다")으로 명시하고 있어, 은폐된 결정이 아니라 알려진 트레이드오프다.

## 요약

이번 diff(SMTP SSRF 가드를 HTTP/DB 노드 공용 `http-safety.ts` 로 통일 + CGNAT/IPv4-mapped IPv6 판정 추가)가 도입하는 식별자(`SsrfBlockedError`, `canonicalIPv6`, `mappedIPv4`, `isBlockedIPv6`, 이동된 `smtp-host-guard.ts`)는 전수 `git grep` 대조 결과 기존 사용처와 이름·의미가 겹치지 않는다. 신설 예정이었던 opt-in 플래그(`SMTP_BLOCK_PRIVATE_HOSTS`)도 실제로는 신설되지 않고 기존 `ALLOW_PRIVATE_HOST_TARGETS` 로 통일해 오히려 잠재적 충돌(노드별로 다른 SSRF 플래그가 병존하는 혼란)을 제거했다. 파일 이동(`common/utils/` → `nodes/integration/send-email/`)도 이전 경로 잔존 없이 깨끗하게 완료됐다. spec 델타가 0인 것은 이 PR 이 코드 전용(SSRF 가드 통합) 변경이기 때문으로, 검토 전제 무효가 아니다.

## 위험도

NONE
