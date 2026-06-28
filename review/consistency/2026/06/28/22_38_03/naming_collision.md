# 신규 식별자 충돌 검토 결과

## 검토 범위

- diff-base: `origin/main`
- 변경 파일:
  - `codebase/backend/test/helpers/e2e-client-ip.ts` (신규)
  - `codebase/backend/test/chat-channel-discord.e2e-spec.ts`
  - `codebase/backend/test/chat-channel-slack.e2e-spec.ts`
  - `codebase/backend/test/external-interaction.e2e-spec.ts`
  - `plan/in-progress/fix-chat-channel-e2e-xff.md` (신규)
- spec 변경 없음: `spec/4-nodes/7-trigger/providers/` 는 이번 PR 에서 수정되지 않음 (consistency-check target 범위가 해당 spec 영역으로 지정됐으나 실제 diff 에 spec 변경이 없음).

---

## 발견사항

### 발견사항 1

- **[INFO]** `203.0.113.x` 대역 — 기존 고정 IP(`203.0.113.9`, `203.0.113.21`)와 카운터 범위 중첩
  - target 신규 식별자: `nextE2eClientIp()` 가 반환하는 `203.0.113.1` ~ `203.0.113.254` 순환 IP
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/.claude/worktrees/fix-chat-channel-e2e-xff-14a65e/codebase/backend/test/users-change-password.e2e-spec.ts` line 19: `const CLIENT_IP = '203.0.113.9'`
    - `/Volumes/project/private/clemvion/.claude/worktrees/fix-chat-channel-e2e-xff-14a65e/codebase/backend/test/users-email-change.e2e-spec.ts` line 24: `const CLIENT_IP = '203.0.113.21'`
  - 상세: `.9` 와 `.21` 은 각각 `change-password` / `email-change` e2e 에서 감사로그 `ip_address` 컬럼 검증에 쓰이는 고정값이다. `nextE2eClientIp()` 카운터가 1부터 순환하므로 이론상 `.9`·`.21` 도 생성된다. 그러나 jest 는 테스트 파일마다 모듈 레지스트리를 독립 생성하므로 카운터가 파일별로 리셋된다. `users-*` 파일은 `nextE2eClientIp()` 를 import 하지 않으므로 실제 충돌이 발생하지 않는다. 또한 사용 목적이 다르다 — `users-*` 의 `CLIENT_IP` 는 감사로그 IP 추적용(인증 API), `nextE2eClientIp()` 는 공개 webhook quota 버킷 분리용이라 런타임 격리도 보장된다.
  - 제안: 현재 실질적 충돌 없음. 향후 다른 테스트 파일이 `nextE2eClientIp()` 를 import 해 `users-*` 파일과 같은 jest worker 에서 병렬 실행되더라도 `CLIENT_IP` 는 고정값이라 bucket key 의미가 다르므로 충돌 불가. 다만 `e2e-client-ip.ts` JSDoc 에 "감사로그 IP 고정값과 같은 대역이나 모듈 격리로 충돌 없음" 한 줄을 추가하면 향후 독자의 혼동을 줄일 수 있다(필수 아님).

---

## 요약

이번 PR 의 신규 식별자는 `nextE2eClientIp()` 함수(파일: `test/helpers/e2e-client-ip.ts`)와 모듈 레벨 변수 `clientIpSeq` 로 제한된다. spec 영역(`spec/4-nodes/7-trigger/providers/`)은 이번 PR 에서 수정되지 않았으므로 요구사항 ID·엔티티명·API endpoint·이벤트명·환경변수 신규 도입이 없다. 파일 경로(`test/helpers/e2e-client-ip.ts`)는 기존 헬퍼 파일들(`auth.ts`, `db.ts`, `e2e-chat-channel-fixture.ts`, `webauthn.ts`)과 이름 충돌이 없다. 유일한 관찰 사항은 `203.0.113.x` IP 대역이 기존 테스트 파일의 고정 IP(`203.0.113.9`, `203.0.113.21`)와 수치상 겹치지만, jest 모듈 격리 + 사용 목적 분리로 실질적 충돌이 없다는 점이다. 전체적으로 식별자 충돌 위험이 없다.

---

## 위험도

NONE
