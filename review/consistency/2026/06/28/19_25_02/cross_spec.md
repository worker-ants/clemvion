# Cross-Spec 일관성 검토 결과

검토 범위: `spec/5-system/` (diff-base: `origin/main`, 검토 모드: impl-done)

## 변경 요약

이번 diff 는 두 파일에 걸쳐 클라이언트 IP 추출 경로의 명시적 분기를 spec 에 반영한다.

1. **`spec/5-system/1-auth.md` §2.3 클라이언트 IP 행** — 기존에 단순히 "CF-Connecting-IP → XFF → req.ip → socket" 순서를 기술하던 것을, "이 4단계 순서는 세션·감사 IP 경로(`extractClientIp(req)`)에 한정된다 / webhook/rate-limit/ip_whitelist 는 헤더 기반(`extractClientIpFromHeaders`)만 적용하며 `req.ip`/`socket` 폴백 없다"로 확장.
2. **`spec/5-system/12-webhook.md` 플로우 서술 2곳** — `extractClientIp` → `extractClientIpFromHeaders` 로 함수명 정정.

---

## 발견사항

발견된 충돌 없음. 아래는 검증 과정에서 확인한 관련 영역들의 정합성 상태다.

### 정합 확인 — `spec/1-data-model.md` §2.13 `Execution.source_ip`

- `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/1-data-model.md` 479행: `source_ip` 컬럼 설명이 이미 `extractClientIpFromHeaders`(헤더 기반·`req.ip` 폴백 없음)를 명시하고 있음. 변경된 `1-auth.md` §2.3, `12-webhook.md` 와 정합.

### 정합 확인 — `spec/2-navigation/6-config.md` §A.3 소스 IP 캡처 경로

- `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/2-navigation/6-config.md` 339행: `extractClientIpFromHeaders`(헤더 기반·`req.ip` 폴백 없음)를 이미 사용. 정합.

### 정합 확인 — `spec/data-flow/1-audit.md` §1.1 감사 IP 경로

- `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/spec/data-flow/1-audit.md` 86-87행: 감사 로그 IP 추출 경로로 `extractClientIp`(`auth/utils/client-ip.ts`)를 사용한다고 명시. 변경된 `1-auth.md` 의 "세션·감사 IP 경로에 한정" 설명과 정확히 일치.

### 정합 확인 — `spec/data-flow/10-triggers.md` 시퀀스 다이어그램

- 81행에서 `clientIp`(추상 식별자)를 사용하며 특정 함수명을 박제하지 않음. 충돌 없음.

### 정합 확인 — `spec/5-system/1-auth.md` Rationale 2.3.B

- Rationale 2.3.B(656행)는 이미 "ip_whitelist/rate-limit 의 IP 추출이 헤더 기반인 것은 의도된 결정 / `req.ip` 폴백 부재를 코드 리뷰가 지적하더라도 의도된 설계"를 명문화하고 있음. 본 §2.3 표의 클라이언트 IP 행 변경은 이 Rationale 을 본문 표에도 반영한 것으로, 내부 일관성 달성.

---

## 요약

이번 변경(`spec/5-system/1-auth.md` §2.3 클라이언트 IP 행 확장 + `spec/5-system/12-webhook.md` 함수명 정정)은 기존에 Rationale 2.3.B 와 `spec/1-data-model.md`, `spec/2-navigation/6-config.md` 에서 이미 `extractClientIpFromHeaders` 로 서술하고 있던 webhook/ip_whitelist/rate-limit 경로의 IP 추출 방식을, 인증 spec §2.3 본문 표와 webhook spec 플로우 서술에도 동기화한 것이다. 충돌하는 정의·모순된 함수명·중복 요구사항 ID 는 발견되지 않았으며, 다른 영역 spec 들과의 일관성이 오히려 향상됐다.

---

## 위험도

NONE
