# 요구사항(Requirement) 리뷰 결과

리뷰 대상: `test-code-http-hardening` 그룹3 (C-2/C-3 후속)
변경 유형: 테스트 보강 + W14 주석 오프셋 수정 + plan 체크박스 갱신 + spec/review 산출물

---

## 발견사항

### [INFO] W14 오프셋 수정 (+4 → +3) — spec §4 step2 와 일치
- 위치: `codebase/backend/src/nodes/data/code/code.handler.ts` `wrapUserCode` 함수 JSDoc
- 상세: 이전 주석이 "4-line header / offset +4 / subtract 4" 였으나 실제 래퍼 구조는 외곽 async IIFE + "use strict" + 내부 async arrow 3줄만 사용자 코드 앞에 선행됨. 수정 후 "+3" 이 맞으며 `spec/4-nodes/5-data/2-code.md §4 step2` 명시("+3")와 일치한다. 코드에 실제 라인 보정 로직은 없으므로 문서/주석 수준 수정이며 기능 회귀 없음.
- 제안: 없음. 정합.

### [INFO] `code.handler.spec.ts` 추가 테스트 완전성
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` (신규 4건)
- 상세: plan `code-node-isolated-vm-followups.md` 테스트 항목(`classifyCodeNodeError null/undefined`, console.warn/error prefix, syntaxIsolate reuse, $vars copy-out 실패 fallback)에 정확히 대응. `syntaxIsolate` disposed 재생성은 module-private 라 결정적 트리거 불가하므로 공유 isolate reuse 내성으로 대체했으며 주석에 명시.
- 제안: 없음. 기능 완전성 충족.

### [INFO] `http-request.handler.spec.ts` SSRF 테스트 범위
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` (신규 4그룹)
- 상세: plan `http-ssrf-all-auth-followups.md` 테스트 항목 전체 커버. `test.each` none/custom × {IMDS, RFC1918, localhost} 6-콤보, opt-out, dry-run skip, configEcho credential strip. `spec/4-nodes/4-integration/1-http-request.md §4 step8` 명세 동작과 대응.
- 제안: 없음.

### [INFO] `backend-labels.test.ts` SSRF 코드 i18n 커버리지
- 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts`
- 상세: LOCALIZED_ERROR_CODES에 HTTP_BLOCKED·DB_HOST_BLOCKED 추가, translateBackendError (5)/(6) 테스트 추가. plan 테스트 항목 "backend-labels HTTP_BLOCKED i18n 매핑 테스트"에 대응. DB_HOST_BLOCKED 한국어 단언이 fallback과 다름을 확인.
- 제안: 없음.

### [WARNING] dry-run 테스트 — `output._dryRun` 단언 누락
- 위치: `http-request.handler.spec.ts` line 1092-1117 (신규 `dry-run skips SSRF guard for authentication=%s`)
- 상세: 기존 dry-run 테스트(`skips SSRF host checks in dry-run`)는 `result.output._dryRun === true`를 단언해 dry-run mock 계약(spec §7.2)을 검증한다. 신규 테스트는 `port === 'success'`, `fetchSpy.not.toHaveBeenCalled()`, `output not.toBeUndefined()` 만 확인하며 `output._dryRun` 를 검증하지 않는다. 이는 dry-run mock 계약 검증이 불완전하다.
- 제안: `expect((result.output as { _dryRun?: boolean })._dryRun).toBe(true)` 단언 추가. `fetchSpy not.toHaveBeenCalled()` 이 실제 fetch 차단을 보증하므로 현재 기능적 위험은 LOW이나 계약 명시 차원에서 보완 권장.

---

## 요약

이 PR은 C-2/C-3 후속 그룹3으로, plan에 명시된 테스트 항목 전체(code 노드 classifyCodeNodeError null/undefined·console prefix·isolate reuse·$vars copy-out, HTTP SSRF 6-콤보·opt-out·dry-run·configEcho·i18n)를 구현했다. W14 주석 오프셋 off-by-one 버그도 spec §4 step2(+3)에 맞게 수정됐다. 기능 완전성·에러 시나리오·비즈니스 로직 모두 spec과 일치하며, TODO/FIXME 등 미완성 마커는 없다. spec fidelity 관점에서 변경된 codebase 코드(code.handler.ts W14 주석)는 spec/4-nodes/5-data/2-code.md §4 step2와 line-level로 일치한다. WARNING 1건은 신규 dry-run 테스트에서 dry-run mock 계약(`output._dryRun`) 단언이 생략된 점으로, 기능적 위험은 낮으나 기존 dry-run 테스트와 일관성을 위해 보완이 권장된다.

---

## 위험도

LOW

STATUS: SUCCESS
