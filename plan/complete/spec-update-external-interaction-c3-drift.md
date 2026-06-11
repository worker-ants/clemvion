---
worktree: security-fixes-0f9165
started: 2026-06-10
owner: resolution-applier
spec_impact:
  - spec/data-flow/15-external-interaction.md
---
# Spec Update Draft — external-interaction C3 SPEC-DRIFT (§3.3 + §Rationale)

## 분류

SPEC-DRIFT (C3 코드 fix 로 구현 갭이 해소됐으나 spec 텍스트가 아직 구 갭 참조를 유지)

---

## 원본 발견사항

**SUMMARY INFO #1 (SPEC-DRIFT):**
`spec/data-flow/15-external-interaction.md` §3.3 상태 전이 마지막 줄에
`` `v2 승격·클리어` (§1.5 구현 갭 주의 포함). ``
이 잔류. C3 fix(commit 98b0b618)로 갭 해소됐으나 §3.3 텍스트 갱신 누락.

**SUMMARY INFO #2 (SPEC-DRIFT):**
`spec/data-flow/15-external-interaction.md` §Rationale "§1.5 구현 갭을 본문에 남긴 이유" 섹션이
현재 시제로 기술되어 C3 fix 후 역사 서술이 됨.
(라인 324–329: "secret 승격 경로의 secretRef 우선순위 충돌은 ... 코드 주석·시스템 spec 의 의도 ... 와
실제 코드가 갈라진 지점이다. ... 해소는 developer plan 으로 추진한다.")

---

## 제안 변경

### §3.3 Notification signing secret (라인 283)

**Before:**
```
`v2 승격·클리어` (§1.5 구현 갭 주의 포함).
```

**After:**
```
`v2 승격·클리어`.
```
(갭 주의 문구 제거 — C3 fix 로 §1.5 갭 해소됨)

---

### §Rationale "§1.5 구현 갭을 본문에 남긴 이유" (라인 324–329)

섹션 제목과 본문을 현재 시제 → 과거 완료 시제로 전환하고 해소 사실을 기록한다.

**Before:**
```markdown
### §1.5 구현 갭을 본문에 남긴 이유

secret 승격 경로의 `secretRef` 우선순위 충돌은 코드 주석·시스템 spec 의 의도("v2 → secretRef 승격")
와 실제 코드가 갈라진 지점이다. data-flow 문서는 코드를 단일 진실로 서술하되, 의도와의 불일치가
보안 운영 (회전한 secret 이 실제로 쓰이는가) 에 직접 영향하므로 본문 callout 으로 가시화했다.
해소는 developer plan 으로 추진한다.
```

**After:**
```markdown
### §1.5 구현 갭 — 해소 이력 (C3 fix, 2026-06-10)

secret 승격 경로의 `secretRef` 우선순위 충돌(코드 주석·시스템 spec 의 의도와 실제 코드가 갈라진
지점)은 `promoteRotatedNotificationSecrets` 리팩토링(commit 98b0b618)으로 해소됐다. 승격 시
평문 기록 대신 secret store 의 canonical ref 를 `secrets.rotate` 로 회전하는 방식으로 수정해
`resolveSigningSecret` 의 `secretRef` 우선 로직과 일치한다. 본문 §1.5 의 구현 갭 callout 은
이 이력의 출처 문서다.
```

## 적용 결과 (2026-06-10)

- [x] §3.3 갭 주의 문구 제거 + §Rationale 해소 이력 전환 — main 이 직접 적용. 별도 `--spec` 검증 대신 직후 `/consistency-check --impl-done spec/5-system/` 전수 검증으로 갈음 (텍스트 현행화 2건, 신규 결정 없음).
