---
worktree: migrate-dup-guard-51c9fc
started: 2026-05-16
owner: developer
---

# Flyway V번호 중복 — 빌드 시점 가드 추가

## 배경

`spec/conventions/migrations.md` §6 에 따라 V번호 중복은 다음 두 단계로 차단되고 있다:

- `backend/src/migrations.spec.ts:62-77` — 유닛테스트에서 `.sql` 파일의 V번호 중복을 매 빌드/CI 마다 검출
- `scripts/check-migration-versions.py` (`.github/workflows/migration-check.yml`) — PR CI 에서 중복 + 단조성 + 연속성 + `.conf` 페어 검사

이미 두 단계가 운영되지만, 다음과 같은 우회 시나리오가 남아 있다:

1. 유닛테스트를 건너뛰고 마이그레이션 이미지만 별도로 빌드하는 환경 (긴급 배포·hotfix 등)
2. CI 가드가 무력화된 직접 docker build (예: 로컬 운영자가 임의 시점 빌드)
3. 가드 스크립트나 spec 파일이 함께 잘못 수정되어 검사 자체가 무의미해진 경우

마이그레이션 이미지 빌드 시점에 한 번 더 차단하면 위 우회 경로 모두에서 fail-fast 가 보장된다. 빌드 자체가 실패하므로 잘못된 이미지는 운영에 도달하지 못한다.

## 변경 범위

### Phase 1 — 빌드 시점 가드 스크립트

- [x] `backend/migrations/check-duplicate-versions.sh` 신규 — POSIX shell, busybox 호환. 인자 1개: 마이그 sql 디렉토리 (기본 `/flyway/sql`). 중복 발견 시 stderr 에 위반 파일 출력 후 exit 1, 정상 시 exit 0.
- [x] `backend/migrations/Dockerfile` — `COPY V*.sql` / `COPY V*.conf` 다음에 본 스크립트 COPY + RUN. 빌드 자체가 실패하도록.

### Phase 2 — 로컬 검증

- [x] 정상 케이스: 현재 `backend/migrations/` 에 대해 스크립트가 exit 0 으로 통과.
- [x] 음성 케이스: 임시 디렉토리에 `V041__a.sql` 과 `V041__b.sql` 두 개를 두고 실행 → exit 1, 두 파일 모두 stderr 에 표시되는지 확인.
- [x] 빈 디렉토리 / `V*.sql` 0개 케이스: exit 0 (no-op).

### Phase 3 — 문서 동기화 (spec)

- [x] `spec/conventions/migrations.md` §6 (충돌 검출 / 머지 race) 에 §6.4 신설 또는 §6.1 에 한 항목 추가 — "이미지 빌드 시점 가드 (`check-duplicate-versions.sh`)" 를 명시. 위치는 정책 문서에 통합.
- [x] `backend/migrations/README.md` — 작성 가이드 끝에 빌드 시점 가드 1줄 추가. 운영자가 `docker build` 실패를 보고 즉시 원인을 찾을 수 있도록.

### Phase 4 — 통합 검증

- [x] `cd backend && npx jest src/migrations.spec.ts` 로 기존 유닛테스트 통과 확인 (regression 없음).
- [x] 빌드까지 시도해볼지는 사용자에 위임 (Docker daemon 의존). 스크립트는 동일 shell 환경에서 실행되므로 로컬 dry-run 으로 충분.

## 비변경 범위 (의도적 제외)

- 기존 유닛테스트(`backend/src/migrations.spec.ts:62-77`) 는 그대로 둔다. 이미 동일한 중복 검사를 수행하고 있어 추가 변경 불요. 본 plan 은 빌드 시점 방어선 **하나만** 추가한다.
- `scripts/check-migration-versions.py` 변경 없음.

## 완료 기준

- 빌드 시점에 중복 V번호가 존재하면 `docker build` 가 stderr 에 위반 목록과 함께 실패.
- 정상 상태에서는 빌드 출력에 noise 없이 통과.
- spec/README 가 본 방어선의 존재와 위치를 가리킴.
