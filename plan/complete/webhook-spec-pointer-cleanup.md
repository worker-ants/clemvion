---
worktree: webhook-spec-pointer-cleanup-215f48
started: 2026-06-28
owner: project-planner
branch: claude/webhook-spec-pointer-cleanup-215f48
spec_impact:
  - spec/5-system/2-api-convention.md
  - spec/7-channel-web-chat/4-security.md
  - spec/5-system/1-auth.md
  - spec/5-system/3-error-handling.md
---

# webhook 하드닝 후속 — C 잔여: spec-only 단방향 포인터 정리

PR #762·#763·#765 머지 후 ai-review/impl-done 가 남긴 **비차단 INFO** 중
spec 문서 정합 항목(C). **코드 변경 없음** — 단방향 포인터·역참조·결손 절 보강만.

상위 plan `webhook-hardening-cleanup.md` §범위 밖에서 "잔여(api-convention §5.3
echo 금지 포인터·web-chat §4 fail-open 언급)는 별도 spec 묶음" 으로 분리 예고된 작업이다.

## 범위 (spec 본문 — SoT 신설 아님, 기존 SoT 로의 포인터)

### 필수
- [x] **P-1** `spec/5-system/2-api-convention.md §5.3 에러 응답`: `message` 가 내부 구현
  원문(라이브러리 예외·스택·경로)을 echo 하지 않음 — 정보 노출(CWE-209) 방지 단방향
  포인터 추가. 세부 SoT: [error-handling §1.3](../../spec/5-system/3-error-handling.md).
- [x] **P-2** `spec/7-channel-web-chat/4-security.md §4 + R3`: 공개 webhook fail-open 이
  Redis 미가용뿐 아니라 **Guard 의 trigger DB 조회 실패** 시에도 동일하게 적용되며
  `error` 레벨 로깅으로 모니터링한다는 언급 추가. SoT 는 [12-webhook §6](../../spec/5-system/12-webhook.md#6-구현-파일-구조).

### 선택 (이번 PR 포함)
- [x] **P-3** `spec/5-system/1-auth.md Rationale 2.3.B (m-3)`: webhook rate-limit·
  `ip_whitelist` 경로의 IP 추출 함수명 `extractClientIpFromHeaders`
  (`auth/utils/client-ip.ts`) 를 명시. `12-webhook.md §7e·§8b` 의 `extractClientIpFromHeaders`
  언급에 `1-auth Rationale 2.3.B m-3` 역참조 링크 추가 (config §A.3·audit 와 동일 패턴 —
  fragment 앵커 없는 파일 레벨 링크).
- [x] **P-4** `spec/5-system/3-error-handling.md`: pre-existing 결손인 `## Overview` 절
  추가 (3섹션 구성 Overview/본문/Rationale 정합).

## 워크플로 (project-planner)
- [x] `/consistency-check --spec` (spec write 직전 의무) — `review/consistency/2026/06/28/19_49_50` **BLOCK:NO** (LOW, Critical 0)
- [x] spec 4개 파일 반영
- [x] side-effect 점검 (역참조 anchor·상호링크)
- [x] commit `docs(spec): webhook 하드닝 C 잔여 — 단방향 포인터/역참조/Overview 결손 보강`
- [x] push + PR — PR #766 (`8983c1fcb`) merged

## 후속 연동 메모 (consistency WARNING 2 / INFO 8)
- **P-2 재검토 트리거**: 단위 2 `webhook-public-ip-failopen-hardening.md` 의 IP 미식별
  fail-open 보안 결정이 확정되면, 본 P-2 결과물(`4-security.md §4+R3` 의 fail-open 기술)을
  그 결정과 정합하게 재검토해야 한다. 현재는 현행 SoT(`12-webhook §6`) 반영이라 충돌 없음.
- **P-3 ↔ 단위 2 중첩**: P-3 가 `1-auth Rationale 2.3.B m-3` 에 함수명을 추가했고, 단위 2 는
  `1-auth §2.3` 세션 정책 행을 갱신할 수 있다. 같은 행 덮어쓰기가 아니라 merge-time 충돌
  위험은 낮음. 단위 2 plan §후속에 추적 메모 기록(아래 INFO 8).

## 범위 밖 (별도 PR)
- 단위 2 D-12(공개 webhook IP 미식별 fail-open 강화) — `webhook-public-ip-failopen-hardening.md` (보안 결정 선행)
- 단위 3 코드 유지보수 백로그 (developer) — client-ip 반환형 통일·filter 테스트 갭·guard.spec 단언
