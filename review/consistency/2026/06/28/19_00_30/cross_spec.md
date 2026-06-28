# Cross-Spec 일관성 검토 결과

검토 모드: impl-done  
스코프: `spec/5-system/` (diff-base: origin/main)  
실제 변경 파일: `codebase/backend/src/modules/hooks/hooks.service.ts`, `public-webhook-throttle.guard.ts`, `codebase/backend/src/common/filters/http-exception.filter.ts`, `codebase/backend/src/modules/auth/utils/client-ip.spec.ts`

---

## 발견사항

### [INFO] `spec/5-system/12-webhook.md` 의 `extractClientIp` 참조 → 실제 구현은 `extractClientIpFromHeaders`

- **target 위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` L145, L257 (이번 커밋에서 변경)
- **충돌 대상**: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/5-system/12-webhook.md` §7 흐름 기술 (L358, L365) — `"sourceIp(extractClientIp 결과)"` 로 함수명을 직접 표기
- **상세**: 이번 PR 이 `hooks.service` 의 로컬 래퍼 `extractClientIp` 를 제거하고 `extractClientIpFromHeaders(...) ?? undefined` 를 직접 호출하도록 변경했다. 그러나 `12-webhook.md` §7 흐름 다이어그램(L358·L365)은 여전히 `extractClientIp` 라는 함수명을 직접 인용한다. 동작은 동일(헤더 기반 추출, `1-auth.md` Rationale 2.3.B 의도와 일치)하지만 spec 이 인용하는 식별자가 코드에 더 이상 존재하지 않아 혼동 가능.
- **제안**: `12-webhook.md` §7 흐름 기술의 `extractClientIp` 참조를 `extractClientIpFromHeaders` 로 동기화하거나, spec 이 구현 함수명을 인용하는 대신 동작 기술("헤더 기반 IP 추출 — `1-auth.md §2.3`")로 추상화. 이번 PR 과 별개 spec 묶음(plan/in-progress/webhook-hardening-cleanup.md §C 영역)으로 처리 가능.

---

### [INFO] `spec/5-system/1-auth.md` §2.3 표 vs Rationale 2.3.B 내 IP 추출 범위 기술 차이 (기존 tension, 이번 PR 로 더 선명)

- **target 위치**: `spec/5-system/1-auth.md` §2.3 표 "클라이언트 IP" 행 — "off 면 `X-Forwarded-For` 첫 IP → `req.ip`(trust proxy) → `req.socket.remoteAddress` 순"
- **충돌 대상**: 동 파일 Rationale 2.3.B — "`ip_whitelist`/rate-limit 의 IP 추출이 헤더 기반(CF-gated → XFF 첫 IP)인 것은 의도된 결정이다 — `req.ip`(Express `trust proxy 1`) 를 우선/대체로 쓰자는 안은 기각한다"
- **상세**: `1-auth.md` §2.3 표의 IP 추출 순서(`XFF → req.ip → socket.remoteAddress`)는 `extractClientIp`(full-req) 구현을 기술한다. 그런데 같은 문서 Rationale 2.3.B 는 `ip_whitelist`·rate-limit 경로에서는 `req.ip` 폴백을 **의도적으로 기각**했다고 명시한다. 이번 PR 이 `hooks.service` 를 `extractClientIpFromHeaders`(헤더 전용)로 통일함으로써 이 tension 이 더 선명해졌다 — §2.3 표는 `extractClientIp` 전체를 기술하지만 webhook/ip_whitelist 경로는 실제로는 헤더 전용이 된다.
- **제안**: `1-auth.md` §2.3 표의 "클라이언트 IP" 행 설명을 세 경로(세션·감사 IP vs webhook/rate-limit/ip_whitelist)로 분리해 기술하거나, "off 면 XFF 첫 IP → `req.ip` 순"을 "세션·감사 IP 경로만 해당; webhook/rate-limit/ip_whitelist 는 헤더 기반(`extractClientIpFromHeaders`)만 사용(Rationale 2.3.B 참조)" 로 명료화. `plan/in-progress/webhook-hardening-cleanup.md §C` 범위(spec-only 단방향 포인터)로 함께 처리 가능.

---

## 요약

이번 PR(`hooks.service` 로컬 래퍼 제거 + `PublicWebhookReqShape` 추출 + 에러 메시지 상수화 + 테스트 격리 강화)은 동작 보존 순수 리팩터링이다. 데이터 모델 충돌·API 계약 충돌·요구사항 ID 충돌·상태 전이 충돌·RBAC 충돌·계층 책임 충돌은 발견되지 않았다. 발견된 두 항목은 모두 INFO 등급의 명명 비일관성으로, `spec/5-system/12-webhook.md` §7 이 `extractClientIp` 라는 코드 식별자를 직접 인용하고 있어 제거된 래퍼 함수 이름이 스펙에 잔존하는 것, 그리고 `spec/5-system/1-auth.md` §2.3 표 기술이 Rationale 2.3.B 의 `req.ip` 기각 결정을 반영하지 않은 것이다. 둘 다 비차단이며, 기존 plan/in-progress/webhook-hardening-cleanup.md §C(spec-only 후속 묶음)로 동기화 권장한다.

## 위험도

LOW
