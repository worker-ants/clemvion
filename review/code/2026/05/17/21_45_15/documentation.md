# 문서화(Documentation) 리뷰 결과

## 발견사항

### 1. 독스트링/JSDoc

- **[WARNING]** `executeWithRateLimit` 메서드 시그니처에 추가된 `triedAuthRetry` 파라미터 JSDoc은 인라인으로 적절히 작성되어 있으나, 메서드 레벨 JSDoc이 해당 파라미터를 반영하여 갱신되었는지 확인 필요
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` diff 내 `+    triedAuthRetry: boolean = false,` 삽입 위치 (line 383)
  - 상세: 추가된 boolean 파라미터에는 바로 위 JSDoc 블록(/** ... */)으로 401 자가 회복 의미를 잘 설명하고 있다. 다만 메서드 전체 JSDoc에서 해당 파라미터가 `@param triedAuthRetry` 항목으로도 명시되어 있는지 확인이 필요하다. diff 만으로는 기존 메서드 레벨 JSDoc 갱신 여부를 판단할 수 없다.
  - 제안: `executeWithRateLimit` 의 기존 JSDoc에 `@param triedAuthRetry - 401 자가 회복 1회 재시도 flag. true 진입 시 재귀 방지.` 항목을 추가한다.

- **[INFO]** 테스트 헬퍼 함수 `wireRefreshTransaction`, `setRefreshClientEnv`, `clearRefreshClientEnv`에 JSDoc/주석 없음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` diff, lines 46-81 (신규 추가 helper 함수들)
  - 상세: 세 함수는 각각 DataSource mock 설정, 환경 변수 주입, 환경 변수 정리를 담당한다. `wireRefreshTransaction` 위에는 블록 주석으로 목적이 충분히 기술되어 있어 양호하다. `setRefreshClientEnv`와 `clearRefreshClientEnv`는 한 줄짜리 함수로 이름에서 의도가 자명하지만, 테스트 컨텍스트(왜 환경변수가 필요한지)를 간략히 명시하면 미래 기여자에게 도움이 된다.
  - 제안: `// CAFE24_CLIENT_ID/SECRET 은 refreshAccessToken() 내부에서 OAuth 요청 시 필요` 형태의 한 줄 주석 추가.

### 2. README 업데이트

- **[INFO]** 이번 변경은 내부 동작(401 수신 시 자동 refresh + 재시도) 변경이며 사용자·운영자가 직접 접하는 설정 변경이 없어 README 갱신은 불필요하다.
  - 위치: 해당 없음
  - 상세: 신규 환경 변수, 실행 방법, 사용법이 변경되지 않았으므로 README 업데이트 항목은 해당 없음.
  - 제안: 조치 불필요.

### 3. API 문서

- **[INFO]** `executeWithRateLimit`는 내부(private/protected) 메서드로 외부 API 계약에 해당하지 않는다. Swagger/OpenAPI 문서 업데이트 대상이 아니다.
  - 위치: 해당 없음
  - 상세: `triedAuthRetry` 파라미터 추가는 클래스 내부 구현 세부이며 공개 API 엔드포인트 변경이 아님.
  - 제안: 조치 불필요.

### 4. 주석 정확성 (기존 주석과 변경 코드의 일치)

- **[WARNING]** `cafe24-api.client.ts` diff에서 기존 `// REQ-C3` 주석 바로 앞에 새 401 자가 회복 블록이 삽입되었으나, REQ-C3 주석이 기존 위치보다 한 블록 아래로 이동되어 읽기 흐름이 의도와 일치하는지 확인 필요
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` diff line 426: `// REQ-C3: 403 + scope 시그널 시 status_reason='insufficient_scope'`
  - 상세: diff 의 새 블록 구조는 (1) 401 자가 회복 분기, (2) `// 403 또는 401-after-retry — 격하 확정.`, (3) `// REQ-C3: ...` 순서다. 403 또는 401 재시도 격하 확정 주석은 REQ-C3 와 연결되며 맥락이 자연스럽다. 그러나 "403 또는 401-after-retry — 격하 확정." 주석은 단독으로 구분선 역할을 하면서 바로 아래 REQ-C3 의 설명과 중복되는 면이 있다. 두 주석이 각각의 역할을 명확히 갖는지 재검토가 필요하다.
  - 제안: `// 403 또는 401-after-retry — 격하 확정.` 주석을 REQ-C3 주석 위에 두는 현재 구조는 유지하되, REQ-C3 주석이 "403 분기 세부 처리" 에 한정된다는 점을 `// REQ-C3 (403 분기): ...` 처럼 명시적으로 범위를 표현하면 가독성이 높아진다.

- **[INFO]** `catalog-sync.spec.ts` 의 신규 주석은 `REPO_ROOT` 변수 도입 이유를 정확하게 설명하고 있어 문제 없음
  - 위치: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts` diff lines 453-457
  - 상세: "Worktree-aware repo root resolution" 주석이 기존 `__dirname` 방식의 한계와 `git rev-parse --show-toplevel` 선택 이유를 명확히 기술하고 있다.
  - 제안: 조치 불필요.

### 5. 인라인 주석 (복잡한 로직 설명)

- **[WARNING]** `cafe24-api.client.ts` 의 401 자가 회복 블록(~lines 392-423) 에서 `refreshViaQueue` 경로와 `refreshAccessToken` 경로 분기 이유가 주석에 부분적으로만 설명됨
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.ts` diff lines 405-423
  - 상세: 상단 블록 주석(lines 392-403)은 전체 정책을 잘 설명하지만, `if (this.refreshQueue && this.refreshQueueEvents)` 분기의 fallback 이유("테스트 환경 fallback" 이라는 맥락)가 주석 없이 코드만 존재한다. 이후 `refreshedToken` 계산 라인도 `integration.credentials` 가 null 일 수 있어 `?? accessToken` fallback을 쓰는 이유가 명시되지 않았다.
  - 제안: `} else {` 분기에 `// 테스트 환경 또는 BullMQ queue 미바인딩 시 in-process fallback` 주석을 추가하고, `refreshedToken` 계산 라인 옆에 `// credentials 가 아직 갱신 전이면 기존 token 유지 (방어적 fallback)` 을 추가한다.

- **[INFO]** 테스트 케이스 T-1~T-3 에 한국어 주석으로 spec 절 참조(`spec §6.1`)가 명확히 기재되어 있어 테스트 의도 파악이 용이하다
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` diff lines 107-244
  - 상세: 각 테스트 케이스 앞에 `// T-1 (spec §6.1 ...)`, `// T-2 (spec §6.1 ...)`, `// T-3 (spec §6.1 ...)` 형태로 스펙 연결이 명시되어 있다. fetch mock 순서 설명도 `// (1) ...`, `// (2) ...`, `// (3) ...` 로 단계별로 기술되어 있어 우수하다.
  - 제안: 조치 불필요.

### 6. 변경 이력 (CHANGELOG)

- **[INFO]** 변경 내용의 규모를 고려하면 CHANGELOG 업데이트 여부를 검토할 필요가 있다
  - 위치: 프로젝트 루트 또는 해당 패키지의 CHANGELOG 파일
  - 상세: plan 파일(`plan/in-progress/cafe24-call-401-retry.md`) 내 `spec/4-nodes/4-integration/4-cafe24.md §6.1` CHANGELOG 갱신이 체크리스트에 기록되어 있으며(`[x]`로 완료 표기), spec 문서 레벨의 변경 이력은 처리된 것으로 보인다. 그러나 코드 레벨 CHANGELOG(예: `CHANGELOG.md` 또는 릴리스 노트)가 별도로 존재한다면 "401 auto-refresh retry on expired token" 기능 추가를 반영해야 할 수 있다. diff 범위에는 해당 파일이 포함되어 있지 않다.
  - 제안: 프로젝트에 코드 레벨 CHANGELOG가 있다면 "feat: Cafe24 call() 401 수신 시 자동 refresh + 1회 재시도" 항목 추가를 검토한다.

### 7. 설정 문서 (새 환경변수·설정 옵션)

- **[INFO]** 테스트 코드에서 `CAFE24_CLIENT_ID`/`CAFE24_CLIENT_SECRET` 환경변수를 직접 조작하나, 이는 기존에 존재하던 환경 변수이며 신규 추가가 아니다
  - 위치: `codebase/backend/src/nodes/integration/cafe24/cafe24-api.client.spec.ts` diff lines 63-81 (setRefreshClientEnv/clearRefreshClientEnv)
  - 상세: `CAFE24_CLIENT_ID`, `CAFE24_CLIENT_SECRET` 은 기존 코드에서 이미 사용되던 환경 변수이므로 신규 문서화 대상이 아니다. 신규 환경 변수나 설정 키가 도입되지 않았음은 consistency-check의 naming_collision checker도 확인하였다.
  - 제안: 조치 불필요.

### 8. 예제 코드 (사용법 예제)

- **[INFO]** 공개 API 변경이 없으므로 별도 예제 코드 추가는 불필요하다
  - 위치: 해당 없음
  - 상세: `triedAuthRetry` 파라미터는 내부 재귀 차단용으로 외부 호출자가 직접 사용하지 않는다. 이미 존재하는 `client.call()` 퍼블릭 API는 변경 없으므로 예제 업데이트 대상이 아니다.
  - 제안: 조치 불필요.

---

## 요약

문서화 관점에서 이번 변경은 전반적으로 양호하다. 핵심 구현 파일(`cafe24-api.client.ts`)의 401 자가 회복 블록에는 정책 설명이 충분한 블록 주석으로 뒷받침되어 있고, 테스트 케이스는 spec 절 참조(§6.1)와 fetch mock 순서 설명이 체계적으로 작성되어 있다. 다만 두 가지 WARNING이 존재한다. 첫째, `executeWithRateLimit` 메서드 레벨 JSDoc에 `triedAuthRetry` 파라미터 항목이 포함되었는지 diff만으로 확인되지 않아 누락 가능성이 있다. 둘째, 401 자가 회복 블록 내 `else` 분기(BullMQ 미바인딩 시 in-process fallback)와 `refreshedToken` 방어 계산에 주석이 없어 복잡한 경로의 의도를 인라인에서 바로 파악하기 어렵다. `REQ-C3` 주석의 범위 명시도 소폭 개선하면 혼동을 줄일 수 있다. 신규 환경 변수나 공개 API 변경이 없으므로 README, API 문서, 설정 문서는 갱신이 불필요하다.

## 위험도

LOW
