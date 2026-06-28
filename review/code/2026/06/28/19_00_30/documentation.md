# Documentation Review

## 발견사항

### 파일 1: http-exception.filter.spec.ts

- **[INFO]** 인라인 주석 정확성 양호
  - 위치: 라인 35, 47, 54
  - 상세: `afterEach(jest.restoreAllMocks)` 도입 이유(B-5)와 `requestId` 단언 추가 이유(B-6)가 주석으로 명확히 설명되어 있다. 제거된 `warn.mockRestore()` 대신 남긴 `// spy 복원은 afterEach(jest.restoreAllMocks) 가 담당.` 주석은 코드와 정확히 일치한다.
  - 제안: 추가 문서화 불필요.

---

### 파일 2: http-exception.filter.ts

- **[INFO]** 새로 추가된 named 상수 JSDoc 양호
  - 위치: 라인 211-222 (diff 기준)
  - 상세: `UNKNOWN_ERROR_MESSAGE`와 `UNHANDLED_ERROR_MESSAGE` 두 상수 모두 JSDoc이 붙어 있고, 두 값이 **의도적으로 다름**을 명시하고 있다. CWE-209 참조도 포함돼 있어 보안 의도가 문서화됐다.
  - 제안: 추가 문서화 불필요.

---

### 파일 3: client-ip.spec.ts

- **[INFO]** env 격리 패턴 변경 주석 충분
  - 위치: 라인 432-433, 450-451 (diff 기준)
  - 상세: `beforeEach`/`afterEach` 스냅샷 복원 패턴으로 교체하면서 변경 이유(B-4, 누설 방지)가 주석으로 명시됐다. 이전 패턴(`const orig`, 수동 `delete`/재할당)에 비해 의도가 더 명확하다.
  - 제안: 추가 문서화 불필요.

---

### 파일 4: hooks.service.ts

- **[WARNING]** 로컬 래퍼 함수 제거 후 호출부 주석이 길어져 가독성 저하
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/hooks.service.ts` 라인 868-873
  - 상세: 삭제된 `extractClientIp` 래퍼 함수에 있던 JSDoc(CF-Connecting-IP 신뢰, req.ip 폴백 후속 이유 등)이 이제 인라인 블록 주석 4줄로 호출부에 직접 들어가 있다. 같은 주석이 두 호출부(`:152`, `:260`)에 동일하게 반복되지 않고 한 곳에만 있어 완전 중복은 아니나, 두 번째 호출부(`:260` → `handleChatChannelWebhook`)의 주석은 `// §A.3 소스 IP — handleWebhook 의 const clientIp 패턴과 통일 (W-9).` 한 줄뿐이라 req.ip 폴백 후속 컨텍스트가 없다. 두 호출부 간 설명 수준이 불균형하다.
  - 제안: 첫 번째 호출부(:152)의 req.ip 폴백 후속 링크(`plan/in-progress/webhook-public-ip-failopen-hardening.md`)를 두 번째 호출부(:260)에도 단 한 줄 포인터로 추가하거나, 혹은 `extractClientIpFromHeaders` 자체의 JSDoc(auth/utils/client-ip.ts)에 req.ip 폴백 후속에 대한 설명을 추가하고 호출부 주석을 단순화하는 것을 권장한다.

- **[INFO]** 삭제된 JSDoc 내용이 호출부 주석으로 보존됨
  - 위치: diff 마이너스 700-712행 (삭제된 `extractClientIp` JSDoc)
  - 상세: 제거된 래퍼 함수의 JSDoc 내용(CF-Connecting-IP 신뢰 조건, req.ip 폴백 사유, 단일 구현 통합)은 첫 번째 호출부 인라인 주석으로 실질적으로 보존됐다. 정보 손실 없음.
  - 제안: 추가 작업 불필요.

---

### 파일 5: public-webhook-throttle.guard.spec.ts

- **[INFO]** `ReqShape` 타입 교체 주석 명확
  - 위치: 라인 1776-1777 (diff 기준)
  - 상세: `export interface ReqShape`(로컬 정의)를 `type ReqShape = PublicWebhookReqShape`(import 재사용)로 교체하면서 `// 필드 동기화 중복 제거(A-3)` 주석이 이유를 충분히 설명한다.
  - 제안: 추가 문서화 불필요.

- **[INFO]** `afterEach` 블록 주석 충분
  - 위치: 라인 1785-1787 (diff 기준)
  - 상세: `B-5/B-7` 번호와 env·spy 격리 이유가 한 줄 주석으로 명시됐다.
  - 제안: 추가 문서화 불필요.

---

### 파일 6: public-webhook-throttle.guard.ts

- **[INFO]** `PublicWebhookReqShape` interface JSDoc 양호
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/competent-mirzakhani-34a96a/codebase/backend/src/modules/hooks/public-webhook-throttle.guard.ts` 라인 2402-2406
  - 상세: 새로 추가된 exported interface에 왜 존재하는지(테스트 공유, 필드 동기화 단일 지점), 소비자가 누구인지(`public-webhook-throttle.guard.spec.ts`)가 JSDoc에 명시됐다.
  - 제안: 추가 문서화 불필요.

---

### 파일 7: plan/in-progress/webhook-hardening-cleanup.md

- **[INFO]** 계획 문서 구조 적절
  - 위치: 전체 파일
  - 상세: frontmatter(worktree, started, owner, branch), 범위(A/B 묶음), 체크박스 상태, 워크플로, 범위 밖 항목이 모두 기록됐다. 참조 라인 번호 링크(`:152`, `:260`)도 포함돼 있다.
  - 제안: 추가 문서화 불필요.

- **[INFO]** `branch` 필드가 실제 브랜치명과 일치하는지 확인 권장
  - 위치: frontmatter `branch: claude/webhook-extractip-consolidation`
  - 상세: 현재 작업 브랜치(`claude/competent-mirzakhani-34a96a`)와 plan의 `branch` 필드가 다르다. 작업이 별도 브랜치에서 수행되고 있다면 문제없으나, plan 관례상 실제 작업 브랜치를 기록해야 일관성이 유지된다.
  - 제안: `branch` 필드를 실제 커밋이 올라가는 브랜치명으로 업데이트하거나, plan 규약이 "목표 브랜치"를 기록하는 경우라면 현행 유지.

---

### 파일 8: plan/in-progress/webhook-public-ip-failopen-hardening.md

- **[INFO]** 미착수 plan 문서 구조 적절
  - 위치: 전체 파일
  - 상세: `worktree: (unstarted)` 표기, 배경·결정 필요 항목·후속 섹션이 명확히 분리됐다. guard 소스 라인 직접 링크(`[guard:108]`)도 포함돼 있어 추후 작업자가 컨텍스트를 빠르게 파악할 수 있다.
  - 제안: 추가 문서화 불필요.

- **[WARNING]** spec 참조(`12-webhook.md §6·WH-SC-05`)가 현재 존재하는 섹션/ID인지 확인 필요
  - 위치: 파일 마지막 "후속" 섹션
  - 상세: `결정 확정 후 spec(12-webhook.md §6·WH-SC-05·Rationale) 반영`이라고 기록돼 있으나 WH-SC-05 식별자가 현재 spec에 정의되어 있는지 이 리뷰에서 확인할 수 없다. 존재하지 않는 ID라면 후속 작업자에게 혼란을 줄 수 있다.
  - 제안: spec 파일(`spec/5-system/12-webhook.md`)에서 WH-SC-05 존재 여부 확인 후, 미존재 시 `(신규 추가 예정)` 등 표기 추가.

---

## 요약

이번 변경셋은 코드 정리(로컬 래퍼 제거, named 상수화, 인터페이스 추출)와 테스트 격리 개선(env 스냅샷, `afterEach` 통일)이 주된 내용이다. 새로 추가된 모든 공개 인터페이스(`PublicWebhookReqShape`, 두 상수)에 JSDoc이 적절히 붙어 있고, 변경 이유가 인라인 주석(B-4~B-7, A-1~A-3 참조 번호)으로 추적 가능하다. 가장 눈에 띄는 문서화 갭은 `hooks.service.ts` 두 호출부 간 req.ip 폴백 후속 컨텍스트의 불균형한 설명이며, 이는 WARNING 수준이다. plan 문서 두 건 모두 구조가 프로젝트 규약에 부합하나, `webhook-public-ip-failopen-hardening.md`의 WH-SC-05 참조 유효성 확인이 소규모 후속으로 권장된다.

## 위험도

LOW
