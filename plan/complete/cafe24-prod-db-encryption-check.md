---
worktree: cafe24-prod-db-check-7c4a3b
started: 2026-05-16
completed: 2026-05-16
owner: operator (사용자) — Claude 는 인계 자료만 작성
---

# 운영: prod DB credentials 암호화 잔존 점검 (followup-backlog C-1)

> **결과 (2026-05-16)**: 1번 점검 쿼리 실행 결과 **plaintext_rows = 0** —
> 모든 `integration.credentials` 가 이미 `enc:v1:` envelope 으로 정상 저장됨.
> remediation (2번·3번 분기) 불필요. 본 plan 은 `complete/` 로 이동하고
> backlog C-1 도 완료 처리. 메모리 파일은 별도 정리.

PR #81 으로 `encryptedJsonTransformer` 가 도입돼 모든 `integration.credentials`
JSONB 가 `enc:v1:` 정확히는 `"enc:v1:..."` 프리픽스 문자열로 저장된다.
PR #81 배포 전에 INSERT 된 legacy 행은 plaintext JSON 객체로 남아있을 수
있어 보안·일관성 목적으로 점검·정리가 필요했다 — 점검 결과 0 행으로
확인되어 자연 종결.

## 출처

- 원천 메모리: `~/.claude/projects/-Volumes-project-private-clemvion/memory/project_deferred_db_check.md`
- backlog 항목: `plan/in-progress/cafe24-followup-backlog.md` C-1

## 1. 점검 SQL

prod DB 에 read-only 접속 후 실행. integration 테이블 전수 스캔이므로
peak time 회피 권장 (소규모 워크스페이스 ≤10k 행이면 무시 가능).

```sql
-- 1-1. plaintext (enc: prefix 없음) 잔존 행 수 + 분포
SELECT
  service_type,
  COUNT(*) AS plaintext_rows
FROM integration
WHERE credentials IS NOT NULL
  AND (
    jsonb_typeof(credentials) = 'object'  -- 그대로 JSONB object
    OR (jsonb_typeof(credentials) = 'string'
        AND credentials::text NOT LIKE '"enc:v1:%"')
  )
GROUP BY service_type
ORDER BY plaintext_rows DESC;
```

**해석:**
- `plaintext_rows = 0` 모든 service_type → 점검 완료. 본 plan `complete/` 로 이동.
- `plaintext_rows > 0` → 다음 단계 (2. 분류) 진행.

## 2. 분류 — 행별 메타

plaintext 잔존 행이 있다면 다음 쿼리로 분류해 remediation 경로를 결정한다.

```sql
SELECT
  id,
  workspace_id,
  service_type,
  status,
  status_reason,
  created_at,
  jsonb_typeof(credentials) AS jsonb_kind,
  -- credentials 의 키 목록만 추출. value 는 노출 금지 (DB-side 마스킹).
  ARRAY(
    SELECT key FROM jsonb_each(credentials)
  ) AS credential_keys
FROM integration
WHERE credentials IS NOT NULL
  AND (
    jsonb_typeof(credentials) = 'object'
    OR (jsonb_typeof(credentials) = 'string'
        AND credentials::text NOT LIKE '"enc:v1:%"')
  )
ORDER BY created_at ASC
LIMIT 100;
```

> **주의 (보안):** `credentials` value 를 SELECT 에 직접 넣지 않는다.
> 위 쿼리는 키 이름만 노출. value 가 필요한 remediation 은 운영자가 별
> session 에서 격리 후 수행.

## 3. Remediation 분기

### 3-A. status 가 `expired` / `error` 인 경우 — 폐기

토큰이 이미 무효한 행이면 사용자가 재인증해야 하므로 plaintext credentials
를 삭제해도 안전. SQL (운영자 확인 후 실행):

```sql
-- 단일 행 dry-run (먼저)
UPDATE integration
SET credentials = NULL
WHERE id = '<UUID>';

-- 일괄 dry-run 한 뒤 OK 면 적용
UPDATE integration
SET credentials = NULL
WHERE credentials IS NOT NULL
  AND status IN ('expired', 'error')
  AND (
    jsonb_typeof(credentials) = 'object'
    OR (jsonb_typeof(credentials) = 'string'
        AND credentials::text NOT LIKE '"enc:v1:%"')
  );
```

### 3-B. status 가 `connected` / `pending_install` — 마이그레이션

토큰이 살아있는 행은 plaintext → encrypted 전환이 필요. **자동 마이그레이션
스크립트는 별 PR 로 분리해 작성한다 (운영자가 실행 시점 결정).** 골자:

1. 별 node script 또는 admin endpoint 를 작성 — 행별로 plaintext 객체를
   읽고 `encryptJson()` 으로 envelope 화한 뒤 같은 row 에 UPDATE.
2. dry-run 모드 우선 (변경 행 수만 출력).
3. integration 테이블에 짧은 row-level lock 만 잡고 트랜잭션 단위로 N개씩
   처리 (peak time 회피).
4. 종료 후 1번 쿼리로 0 확인.

### 3-C. service_type 이 비활성 / 사용자 미가지정 — 사용자에게 통보 후 폐기

소유자가 사용하지 않는 통합이면 NULL 처리 + UI 가 재인증 요구. owner 에게
이메일 안내 후 적용.

## 4. 사후 확인

```sql
-- 다시 1-1 쿼리 실행 → 모든 service_type 의 plaintext_rows = 0 확인.
```

## 5. 메모리 정리

운영자 점검 완료 후 다음 메모리 파일 삭제 (Claude 측 후속):

- `~/.claude/projects/-Volumes-project-private-clemvion/memory/project_deferred_db_check.md`

## 진행 체크리스트

- [x] 1번 쿼리 prod 에서 실행, plaintext_rows 결과 캡처 — **0 행 확인 (2026-05-16)**
- [x] plaintext_rows = 0 이므로 본 plan 을 `plan/complete/` 로 이동 — 본 commit
- [x] 메모리 파일 삭제 — 본 commit 이후 사용자가 수동 처리 (Claude 가 ~/.claude/projects/.../memory 접근 불가)
- [~] plaintext_rows > 0 분기 (3-A/B/C, 마이그레이션 PR, 사후 확인) — **불필요 (0 행이므로 skip)**

## 비고

- 본 plan 은 운영 task — Claude 가 prod DB 에 접속할 수 없으므로 SQL +
  분기 절차만 인계.
- `encryptedJsonTransformer` 의 read-path 는 plaintext object 도 그대로
  통과 (decryptJson 의 line 113) 시키므로 잔존 행이 있어도 즉각적 장애는
  없다. 다만 보안 invariant ("DB 의 credentials 는 항상 암호화") 가 깨진
  상태이므로 보안 감사 시 빠르게 정리하는 것이 좋다.
