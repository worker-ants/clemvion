# RESOLUTION — reaper/engine DRY 리팩터 (refactor-reaper-dry)

리뷰 SUMMARY: risk **LOW**, Critical **0**, Warning **3** (+ INFO 12). CRITICAL 없음.
Warning 3건 전부 조치 + 저비용 INFO 2건 opportunistic 조치. 나머지 INFO 는 "조치 불요"(사유 하단).

## 조치 항목

| # | 카테고리 | 발견 | 조치 | fix commit |
|---|---|---|---|---|
| W1 | Scope | `interaction-token.service.ts verifyPerExecution` 의 redundant `as {sub?;aud?;jti?}` 캐스트가 스코프 밖에서 제거됨(미문서화) | `eslint --fix`(no-unnecessary-type-assertion)의 incidental 결과 — `payload` 가 이미 동일 타입 `let` 선언이라 tsc-clean·런타임 무영향. 되돌리면 린터가 재-플래그하므로 **유지 + plan §스코프 참고에 명시**해 추적성 확보(리뷰가 제시한 "문서화" 옵션 채택) | (문서) |
| W2 | Requirement/Scope | plan frontmatter `spec_impact: - none` 이 실제 5개 spec 문서 변경과 불일치 | frontmatter `spec_impact` 를 실제 touch 한 5파일 리스트로 갱신 + plan §스코프 참고에 "naming sync(식별자 대소문자 미러)뿐, 규범적 내용 무변경" 명시 | (본 커밋) |
| W3 | Testing | `emitCancellationEvent` 의 "error 있을 때만 방출" 계약이 `cancelParkedExecution`(error 없는 유일 분기)에서 `objectContaining({status})` 로만 약하게 검증 | 해당 테스트에 engine emitter spy 추가 → **정확 payload 매칭**(`{status:'cancelled', result:{cancelledBy:'user'}}`) + `expect(payload).not.toHaveProperty('error')` 로 error-생략 분기 고정 | (본 커밋) |
| INFO 6 | Requirement | `process-in-batches.spec.ts` "0/음수" 테스트가 0만 검증 | `it.each([0,-1,-100,2.7])` 로 음수·소수 파라미터화 | (본 커밋) |
| INFO 9 | Testing | 동기 throw 하는 non-async worker 는 `chunk.map` 자체가 throw 해 fail-open 이 깨질 수 있음 | 유틸을 `chunk.map(async (item) => worker(item))` 로 감싸 sync-throw 를 rejected 로 격리 + 시그니처 `Promise<R>|R` 확장 + JSDoc 명시 + 회귀 테스트 신설 | (본 커밋) |

### 조치 불요 INFO (사유)
- INFO 1(barrier 동시성)·INFO 8(warn 발화 타이밍): 리팩터 이전부터 있던 패턴을 그대로 추출 — 회귀 아님, JSDoc/plan 에 트레이드오프 문서화됨.
- INFO 2(god-service)·INFO 3(sweep 오케스트레이션 비대칭): 기존 백로그(M-3 계열) 스코프, 본 diff 는 긍정적 방향.
- INFO 4(집계 후처리 잔여 유사)·INFO 5(logContext 수동 동기화): 현 스코프 수용, 세 번째 호출처/drift 시 재검토(plan 문서화).
- INFO 7(로그 워딩 미세 변경): 테스트가 부분문자열만 검증 — 회귀 없음.
- INFO 10(소수 concurrency): INFO 6 파라미터화(2.7)로 커버됨.
- INFO 11·12(CHANGELOG/구 plan 의 구식별자 표기): 우선순위 낮음 — 해당 문서가 아직 미머지/완료-이동 대기라 본 PR 스코프 밖. 별건.

## TEST 결과

fix 후 TEST WORKFLOW 전체 재수행 (behavior-preserving 리팩터라 회귀 방지 핵심):

- **lint**: 통과 (`stage=lint status=PASS`)
- **unit**: 통과 (`stage=unit status=PASS`; 타겟 util+engine spec 410 tests, full suite PASS)
- **build**: 통과 (`stage=build status=PASS`)
- **e2e**: 통과 (`stage=e2e status=PASS duration=176s tests=253 passed`) — `webchat-idle-reaper.e2e-spec.ts` 가 `processInBatches`·`markWebChatIdleTimeout`(→`emitCancellationEvent`) 핫패스를 실 docker 로 재검증

## 보류·후속 항목

- **engine cancel 4메서드 full 통합**(`conditionallyCancelExecution`): marginal/위험으로 defer — plan §기각 + 백로그 chip(task_282bb04c). cancel 메서드 증가·트랜잭션화 확산 시 재검토.
- **`MinuteRepeatableSweepWorker` 추상클래스**: DI 복잡도 대비 2-워커 한정 효용 marginal — defer(plan §기각). 워커 수 증가 시 재검토.
