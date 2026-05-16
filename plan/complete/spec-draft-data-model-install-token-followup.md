---
worktree: cafe24-app-url-detail-a7c3f4
started: 2026-05-16
owner: project-planner
spec_files:
  - spec/1-data-model.md
---

# Spec Draft — `spec/1-data-model.md §2.10` install_token drift 정정 (follow-up)

## 컨텍스트

직전 commit (`spec/2-navigation/4-integration.md` + `spec/data-flow/integration.md` 정정) 후 `/consistency-check --impl-prep` 재실행 (`review/consistency/2026/05/16/12_17_43/`) 에서 INFO #1 검출 — `spec/1-data-model.md §2.10` line 253-254 가 옛 NULL 처리 표기를 잔존시켜 구현자가 DB 처리를 잘못 작성할 위험.

## 변경

### 변경 1 — `spec/1-data-model.md` Integration.install_token 컬럼 설명 정정

**옛 (line 253 중 핵심부)**:
> ... `oauth/begin (app_type=private)` 시 ... 발급, callback 성공 또는 TTL 만료 시 NULL. ...

**새**:
> ... `oauth/begin (app_type=private)` 시 ... 발급. 통합 lifetime 동안 **보존** (post-install navigation 의 식별 키) — callback 성공 시 보존, `pending_install → expired (install_timeout)` 24h TTL 만료 또는 통합 삭제 시에만 NULL/소거. ...

### 변경 2 — `spec/1-data-model.md` Integration.install_token_issued_at 컬럼 설명 정정

**옛 (line 254 중 핵심부)**:
> ... 재사용/새 발급 시 갱신, callback 성공 시 NULL. ...

**새**:
> ... 재사용/새 발급 시 갱신, **callback 성공 시 보존** (`install_token` 과 동행 — `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h" 참조). TTL 만료 / 통합 삭제 경로에서만 NULL 처리. ...

## 정합성

본 변경은 이미 머지된 (직전 commit) 두 spec 의 정책과 완전 일치:
- `spec/2-navigation/4-integration.md` Rationale "install_token TTL 24h (2026-05-15 갱신, 2026-05-16 보강)"
- `spec/data-flow/integration.md §1.2.1` line 90

drift 정정만 수행하며 새 정책 도입 없음.

## 검토 호출 자체 평가

`/consistency-check --spec` 는 의무지만 본 follow-up 은 직전 머지된 정책의 미반영 행 정정뿐이라 새 cross-spec 리스크는 없다. 단, 절차 준수를 위해 호출은 수행한다.
