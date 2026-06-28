# Documentation Review

## 발견사항

### 파일 1: http-exception.filter.spec.ts

- **[INFO]** 인라인 주석 정확성 양호
  - 위치: 라인 35, 47, 54
  - 상세: `afterEach(jest.restoreAllMocks)` 도입 이유(B-5)와 `requestId` 단언 추가 이유(B-6)가 주석으로 명확히 설명됐다. 제거된 `warn.mockRestore()` 대신 남긴 `// spy 복원은 afterEach(jest.restoreAllMocks) 가 담당.` 주석은 변경된 코드와 정확히 일치한다. 비-Error throw 경로를 검증하는 신규 테스트 케이스에도 분기 동작이 한국어 주석으로 충분히 설명돼 있다.
  - 제안: 추가 문서화 불필요.

---

### 파일 2: http-exception.filter.ts

- **[INFO]** 새로 추가된 named 상수 JSDoc 양호
  - 위치: 라인 94–105 (diff 기준 — `UNKNOWN_ERROR_MESSAGE`, `UNHANDLED_ERROR_MESSAGE`)
  - 상세: 두 상수 모두 JSDoc이 붙었고, "의도적으로 다름"을 명시하며 각각의 적용 조건(비-Error throw vs 매핑 없는 Error)을 구분해 설명한다. 이전 리뷰(19_00_30)에서 지적한 상수명 유사성 혼동 위험은 JSDoc 수준에서 완화됐다. CWE-209 참조도 filter 내 다른 주석과 일관성이 있다.
  - 제안: 추가 문서화 불필요. 이름 자체 구분력 개선(예: `NON_ERROR_THROW_MESSAGE`)은 여전히 nice-to-have이나 문서화 관점에서는 현행 JSDoc으로 충분히 보완됨.

---

### 파일 3: client-ip.spec.ts

- **[INFO]** env 격리 패턴 변경 주석 충분
  - 위치: 두 describe 블록의 `beforeEach`/`afterEach` 추가 부분
  - 상세: `// env 스냅샷/복원으로 테스트 격리 — TRUST_CF_CONNECTING_IP 변이 누설 방지(B-4)` 주석이 패턴 변경 이유를 명확히 설명한다. 이전 `const orig` + 수동 조건 복원 패턴보다 의도가 더 명시적이다.
  - 제안: 추가 문서화 불필요.

---

### 파일 4: hooks.service.ts

- **[INFO]** 두 호출부 주석 균형 개선 확인 (이전 WARNING → 해소)
  - 위치: `handleWebhook` 내 첫 번째 호출부(라인 ~152), `handleChatChannelWebhook` 내 두 번째 호출부(라인 ~260)
  - 상세: 이전 리뷰(19_00_30) W2로 지적됐던 두 번째 호출부 설명 불균형이 RESOLUTION에서 FIXED 처리됐다. 두 번째 호출부에 `1-auth §2.3·Rationale 2.3.B + plan 링크` 주석이 추가돼 첫 번째 호출부와 설명 수준이 맞춰졌다. 삭제된 로컬 `extractClientIp` 래퍼의 JSDoc 내용은 이제 두 호출부 인라인 주석에 분산 보존된 상태로, 정보 손실 없음.
  - 제안: 추가 문서화 불필요.

- **[INFO]** `PublicWebhookReqShape.headers` vs `WebhookInput.headers` 타입 이원화 미문서
  - 위치: `hooks.service.ts` 내 `extractClientIpFromHeaders` 호출부, `public-webhook-throttle.guard.ts` `PublicWebhookReqShape` 정의
  - 상세: `PublicWebhookReqShape.headers`는 `Record<string, unknown>`이고 `WebhookInput.headers`는 `Record<string, string>`으로 타입이 다르다. 이 이원화는 의도된 분리(Express Request 반영 vs 좁은 계약)이나 어느 쪽 정의에도 차이 이유를 설명하는 주석이 없다. 유지보수자가 동기화 필요성을 오판할 수 있다.
  - 제안: `PublicWebhookReqShape` JSDoc 또는 `WebhookInput` 타입 정의 인근에 "Express Request의 headers는 unknown, 내부 계약은 string으로 좁힘" 한 줄 주석 추가.

---

### 파일 5: public-webhook-throttle.guard.spec.ts

- **[INFO]** `ReqShape` 타입 교체 주석 명확
  - 위치: `type ReqShape = PublicWebhookReqShape` 교체 라인
  - 상세: `// 필드 동기화 중복 제거(A-3)` 주석이 변경 이유를 충분히 설명한다. 삭제된 `export interface ReqShape`의 `/** Exported for shared use ... */` JSDoc은 이제 guard.ts의 `PublicWebhookReqShape` JSDoc으로 통합됐다.
  - 제안: 추가 문서화 불필요.

- **[INFO]** `afterEach` 블록 주석 충분
  - 위치: `describe('PublicWebhookThrottleGuard')` 내 신규 `beforeEach`/`afterEach`
  - 상세: `// env·spy 복원을 afterEach 로 통일(B-5/B-7)` 주석이 패턴 의도를 명확히 설명한다. CF 테스트에서 제거된 `try/finally` 블록 내 복원 로직이 주석으로 위임 안내(복원은 afterEach)가 붙어 명확히 대체됐다.
  - 제안: 추가 문서화 불필요.

---

### 파일 6: public-webhook-throttle.guard.ts

- **[INFO]** `PublicWebhookReqShape` interface JSDoc 양호
  - 위치: 파일 말미 신규 export interface
  - 상세: "Guard가 `getRequest`로 읽는 공개 webhook 요청의 최소 형태", "테스트가 import 해 필드 동기화 단일 지점 갱신"이라는 존재 이유와 소비자가 JSDoc에 명시됐다. `extends PublicWebhookReqExtension`으로 `__publicWebhookTrigger` 필드를 상속한다는 구조도 타입 정의로 자명하다.
  - 제안: 추가 문서화 불필요. 단 앞서 언급한 `headers` 타입 이원화(unknown vs string)에 대한 주석은 이 인터페이스 JSDoc에 한 줄 추가하면 가장 효과적인 위치가 된다.

---

### 파일 7: plan/in-progress/webhook-hardening-cleanup.md

- **[INFO]** 계획 문서 구조 적절
  - 위치: 전체 파일
  - 상세: frontmatter(worktree, started, owner, branch), A/B 범위 체크박스, 워크플로 상태, 범위 밖 항목이 모두 기록됐다. 참조 라인 번호 링크(`:152`, `:260`)도 포함돼 탐색 편의성이 높다.
  - 제안: 추가 문서화 불필요.

- **[INFO]** `branch` 필드 실제 브랜치명과 불일치
  - 위치: frontmatter `branch: claude/webhook-extractip-consolidation`
  - 상세: 현재 작업 워크트리 브랜치(`claude/competent-mirzakhani-34a96a`)와 plan 기록 브랜치가 다르다. 이전 리뷰(19_00_30) RESOLUTION I13에서 "실제 작업 브랜치 = `claude/webhook-extractip-consolidation`(plan frontmatter와 일치)"로 리뷰어 오판으로 처리됐으므로, plan의 `branch` 필드 자체는 의도적 기록임. 현재 리뷰 대상이 worktree `competent-mirzakhani-34a96a`에서 수행 중이므로 plan frontmatter가 실제 커밋 브랜치와 다를 수 있다.
  - 제안: 이전 RESOLUTION 판단 유지 — 조치 불요. 다만 PR 생성 시 실제 push 브랜치와 plan `branch` 필드 일치 여부를 확인하는 것을 권장.

---

### 파일 8: plan/in-progress/webhook-public-ip-failopen-hardening.md

- **[INFO]** 미착수 plan 문서 구조 적절
  - 위치: 전체 파일
  - 상세: `worktree: (unstarted)` 표기, 배경·결정 필요 항목·후속 섹션이 명확히 분리됐다. guard 소스 라인 직접 링크(`[guard:108]`)도 포함돼 추후 작업자 컨텍스트 파악이 용이하다.
  - 제안: 추가 문서화 불필요.

- **[INFO]** spec 참조 WH-SC-05 유효성 확인 완료
  - 위치: "후속" 섹션 `spec(12-webhook.md §6·WH-SC-05·Rationale)` 참조
  - 상세: 이전 리뷰(19_00_30) W3에서 WARNING으로 지적됐으나 RESOLUTION에서 `grep "WH-SC-05" spec/5-system/12-webhook.md` 확인 결과 L69에 존재(Rate limiting 요구사항)함이 검증됐다. 참조 유효 — 추가 조치 불요.
  - 제안: 추가 문서화 불필요.

---

### 파일 9-14: review 메타 파일들

- **[INFO]** RESOLUTION.md 구조 적절
  - 위치: `/review/code/2026/06/28/19_00_30/RESOLUTION.md`
  - 상세: 원 SUMMARY 위험도 기록, 조치 항목 표(출처·카테고리·발견·조치), 보류 후속 항목(비차단 INFO), TEST 결과가 모두 포함됐다. 각 항목별 FIXED/확인 완료 처리 근거도 명시됐다. 특히 보안/아키텍처 reviewer 출력 미기록 문제를 "fresh `/ai-review --route=all`" 재실행으로 대응하도록 후속 지침이 포함된 것도 적절하다.
  - 제안: 추가 문서화 불필요.

---

## 요약

이번 변경셋(fresh review 19_15_39 대상)은 이전 리뷰(19_00_30) RESOLUTION 적용 후의 상태를 재검토하는 것이다. 이전 WARNING 2건(W2 hooks.service 두 호출부 불균형, W3 WH-SC-05 참조 유효성)은 모두 해소됐으며, 새로 추가된 코드 변경들(named 상수 JSDoc, `PublicWebhookReqShape` JSDoc, 테스트 패턴 변경 주석)은 문서화 수준이 전반적으로 양호하다. 유일하게 신규로 지적할 만한 항목은 `PublicWebhookReqShape.headers`(Record<string, unknown>)와 `WebhookInput.headers`(Record<string, string>)의 타입 이원화에 대한 설명이 어느 정의부에도 없다는 점이나, 이는 INFO 수준이다. plan 문서 두 건 모두 프로젝트 규약에 부합하는 구조를 갖추고 있고, RESOLUTION에서 검증된 내용들이 반영된 상태다. 전체적으로 문서화 관점에서 이전 대비 개선됐으며 차단 사항 없음.

## 위험도

LOW

STATUS: SUCCESS
