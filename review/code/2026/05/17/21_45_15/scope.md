# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: cafe24-api.client.spec.ts

- **[INFO]** 기존 단일 `it.each([401, 403])` 테스트 삭제 후 분리된 개별 케이스로 교체 — 의도 내
  - 위치: diff hunk `@@ -375,29 +375,195 @@`
  - 상세: 기존 `it.each([401, 403])` 테스트는 401과 403을 동일 분기로 처리하던 구버전 정책을 반영했다. 401에 refresh+재시도 패턴이 도입되면서 두 케이스를 분리하는 것은 구조적으로 필연적이다. 새로운 케이스 T-1~T-4(403 즉시 격하, 401 refresh 성공, 401 retry 후 격하, 401 refresh 자체 실패)는 모두 plan §테스트 T-1~T-5에 대응하며 의도된 범위 안이다.
  - 제안: 이슈 없음.

- **[INFO]** `wireRefreshTransaction`, `setRefreshClientEnv`, `clearRefreshClientEnv` helper 함수 신규 추가
  - 위치: diff 추가 라인 `function wireRefreshTransaction`, `function setRefreshClientEnv`, `function clearRefreshClientEnv`
  - 상세: 세 helper 모두 `auth failure` describe 블록 내 로컬 함수로 선언되어 401 재시도 테스트 설정을 위해 필요하다. 코드 외부에 노출되지 않으며, 동일 블록 안의 여러 it 케이스가 재사용한다. 테스트 보조 코드이므로 "불필요한 리팩토링"이나 "기능 확장"에 해당하지 않는다.
  - 제안: 이슈 없음.

- **[INFO]** 기존 `'surfaces OAuth-shape error/error_description fields'` 테스트 본문 확장 (403 → 401 3-step 흐름으로 변경)
  - 위치: diff hunk `@@ -423,7 +589,29 @@`
  - 상세: 이 테스트는 에러 메시지 surface를 검증하는 케이스인데, 401 reactive refresh 도입으로 fetch mock 순서가 바뀌었다. 기존 단일 fetch → 3-step(401, refresh 200, 401)으로 변경하고 `clearRefreshClientEnv()` 추가는 새 동작 경로를 반영하기 위한 필수 수정이다. 제목에 "after refresh+retry exhausted" 문구를 추가한 것도 새 의미를 반영한 적절한 수정이다.
  - 제안: 이슈 없음.

- **[INFO]** `'on 403 + INSUFFICIENT_SCOPE signal'` 테스트에 `expect(fetchMock).toHaveBeenCalledTimes(1)` assertion 추가
  - 위치: diff hunk `@@ -483,6 +672,8 @@`
  - 상세: 403 케이스가 refresh 시도 없이 1회 fetch로 종료됨을 명시적으로 검증한다. "단일 fetch" 검증은 403 즉시 격하 정책의 회귀 보호이며 의도 범위 안이다.
  - 제안: 이슈 없음.

- **[INFO]** `'on 401 — always auth_failed'` 테스트가 INSUFFICIENT_SCOPE 시그널 포함 401로 확장 (fetch mock 3-step)
  - 위치: diff hunk `@@ -508,6 +716,8 @@`
  - 상세: 기존 단일 fetch 검증에서 refresh+재시도를 포함한 3-step으로 확장하는 것은 401이 refresh 경로를 거쳐도 `auth_failed`(not `insufficient_scope`)를 반환함을 검증하기 위한 필수 변경이다.
  - 제안: 이슈 없음.

---

### 파일 2: cafe24-api.client.ts

- **[INFO]** `executeWithRateLimit` 시그니처에 `triedAuthRetry: boolean = false` 파라미터 추가
  - 위치: diff hunk `@@ -992,6 +992,14 @@`
  - 상세: 무한 재귀 방지를 위한 1회 재시도 flag. plan에 명시된 설계(`triedAuthRetry` boolean 인자 또는 별도 wrapper)와 정확히 일치한다. JSDoc 주석이 함께 추가되어 향후 유지보수에 도움이 된다. 불필요한 파라미터 추가가 아니다.
  - 제안: 이슈 없음.

- **[INFO]** 401 분기 처리 블록 (refresh + 1회 재시도 로직) 추가
  - 위치: diff hunk `@@ -1100,6 +1108,41 @@`
  - 상세: plan §코드의 "401 시 refreshViaQueue/refreshAccessToken 1회 → 새 토큰으로 1회 재시도 → 그래도 401이면 markAuthFailed"를 정확히 구현했다. 403 분기는 기존 코드 그대로이고, 추가된 코드는 401 전용 조건(`if (response.status === 401 && !triedAuthRetry)`)으로 격리되어 있다. 코드 블록 크기(41줄)는 분기 로직, refresh 경로 선택(BullMQ queue 있으면 `refreshViaQueue`, 없으면 `refreshAccessToken`), 재시도 호출로 구성되어 과도하지 않다.
  - 제안: 이슈 없음.

- **[INFO]** 401/403 공통 격하 코드 앞에 설명 주석 추가
  - 위치: `// 403 또는 401-after-retry — 격하 확정.` 및 이전 블록 주석들
  - 상세: 추가된 주석은 모두 401 자가 회복 로직의 동작 경계를 설명하며, 기존 주석 스타일(`// REQ-C3`)과 일치한다. 불필요한 주석 변경이 아니다.
  - 제안: 이슈 없음.

---

### 파일 3: catalog-sync.spec.ts

- **[WARNING]** `execSync('git rev-parse --show-toplevel')` 도입 — 작업 범위 외 파일이나 worktree 버그 수정 목적으로 정당화됨
  - 위치: diff hunk `@@ -1,3 +1,4 @@` 및 `@@ -30,14 +31,16 @@`
  - 상세: 이 파일(`catalog-sync.spec.ts`)은 본 PR의 핵심 작업인 `cafe24-api.client.ts` 401 retry와 직접적인 기능 관계가 없다. 그러나 변경 이유가 분명하다 — `__dirname` 기반의 hardcoded 상대 경로(`../../../../../../spec/conventions/cafe24-api-catalog`)가 git worktree 환경(`.claude/worktrees/<name>/`)에서 한 레벨 부족해 ENOENT로 실패하는 버그를 수정한 것이다. 이 버그는 cafe24-401-refresh-a3f2c1 worktree에서 테스트를 실행할 때 발생하는 문제이므로, 동일 worktree 안에서 수정한 것은 실질적 필요에 따른 조치다. 다만 별도 PR로 분리하거나 적어도 명시적 언급이 있었다면 더 명확했을 것이다.
  - 제안: 허용 가능. PR 설명이나 커밋 메시지에 "worktree 환경에서 catalog-sync.spec.ts 경로 해결 버그 수정" 명시 권장.

---

### 파일 4: plan/in-progress/cafe24-call-401-retry.md (신규)

- **[INFO]** 신규 plan 파일 — 작업 추적용, 의도 내
  - 위치: 파일 전체
  - 상세: frontmatter에 `worktree: cafe24-401-refresh-a3f2c1`, `started: 2026-05-17`, `owner: developer`가 정확히 설정되어 있고, CLAUDE.md §PLAN 문서 라이프사이클의 필수 3필드를 충족한다. 체크리스트 항목이 현재 구현 상태를 정확히 반영한다.
  - 제안: 이슈 없음.

---

### 파일 5~30: review/consistency/2026/05/17/{20_52_23,21_06_13,21_19_47}/ 산출물들

- **[INFO]** consistency-check 세션 3개의 산출물 파일들 (`_retry_state.json`, `meta.json`, `*.md`)
  - 위치: 파일 5~30 전체
  - 상세: CLAUDE.md `§정보 저장 위치`에 따르면 일관성 검토 산출물은 `review/consistency/<YYYY>/<MM>/<DD>/<hh>_<mm>_<ss>/` 경로에 보관한다. 세 세션(20_52_23 impl-prep, 21_06_13 spec-draft, 21_19_47 impl-prep-after-spec)은 모두 plan `plan/in-progress/cafe24-call-401-retry.md` §문서·플랜에서 `[x]` 완료로 체크된 항목과 일치한다. 이 파일들은 작업 프로세스 자체의 증거 파일이며, PR에 포함되는 것이 이 프로젝트의 정책이다.
  - 제안: 이슈 없음.

---

## 요약

이번 변경의 핵심 목적은 `Cafe24ApiClient.executeWithRateLimit()`의 401 응답 시 refresh + 1회 재시도 패턴을 이식하는 것으로, plan `cafe24-call-401-retry.md`에 명시된 범위와 정확히 일치한다. 코드 파일 2개(`cafe24-api.client.ts`, `cafe24-api.client.spec.ts`)의 변경은 모두 의도된 기능 구현 범위 안이다. `catalog-sync.spec.ts`는 403 retry와 직접 관련 없는 파일이나 worktree 실행 환경에서 발생하는 경로 버그를 수정한 것으로, 범위 이탈이긴 하지만 테스트 실행 가능성을 확보하기 위한 실용적 수정이다. review/consistency 산출물들은 프로젝트 프로세스에서 요구하는 사전 검토 증거로서 정당하게 포함된다. 불필요한 리팩토링, 무관한 기능 확장, 의미 없는 포맷팅 변경, 불필요한 임포트 정리는 발견되지 않았다.

## 위험도

LOW
