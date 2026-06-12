# 테스트(Testing) 리뷰 결과

리뷰 대상: `test-code-http-hardening` 그룹3 — 테스트 보강 (code.handler.spec.ts, http-request.handler.spec.ts, backend-labels.test.ts) + W14 주석 수정 + plan 체크박스

---

## 발견사항

### [INFO] `syntaxIsolate` disposed 분기 미커버 — 방어 코드로 명시, 간접 검증으로 충분
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` 신규 테스트 (라인 82–99)
- 상세: 신규 테스트가 shared isolate의 valid/invalid 교차 호출 내성을 5회 반복으로 검증하며, isolate가 재사용(재생성 없음)되는 정상 경로를 커버한다. disposed 재생성 분기(`!syntaxIsolate || syntaxIsolate.isDisposed`)는 module-private 상태이므로 단위 테스트에서 결정적으로 트리거할 수 없고, 테스트 주석에 이 한계를 명시하고 있어 허용 가능한 커버리지 갭이다.
- 제안: 없음 (방어 코드로 명시된 한계 — 현행 간접 검증으로 충분).

### [INFO] `console.warn`/`console.error` 캡처 — 비문자열 엣지 케이스 직렬화 미커버
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` 라인 61–73
- 상세: 신규 테스트가 숫자(`2`)·객체(`{ x: 1 }`) 인자 직렬화를 검증한다. `null`, `undefined`, `Error` 인스턴스, 순환참조 객체 등의 엣지 케이스는 테스트되지 않는다. 기능상 중요한 gap은 아니나 직렬화 로직 변경 시 회귀를 놓칠 수 있다.
- 제안: 낮은 우선순위. 필요 시 `console.log(null)`, `console.log(undefined)` 케이스 추가.

### [WARNING] `$vars` copy-out 실패 fallback 테스트 — 구현 세부사항 의존 및 catch 분기 실행 미검증
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` 라인 94–111
- 상세: 테스트는 `$vars.notClonable = () => 1` (함수 값)을 사용해 structured-clone 실패를 유발하고 `context.variables`가 pre-exec 스냅샷으로 복원됨을 단언한다. 이 동작은 isolated-vm의 `jail.get('$vars', { copy: true })`가 함수를 거부한다는 API 세부사항에 의존한다. 향후 isolated-vm 버전업으로 이 API 동작이 달라지면 catch 분기가 실행되지 않아도 `context.variables`가 변경 전 값으로 유지될 수 있어 테스트가 false positive로 통과할 가능성이 있다. 또한 현재 테스트는 fallback이 실제로 catch 블록을 통해 실행됐는지 직접 검증하지 않는다.
- 제안: 주석에 "catch 분기 실행 여부는 handler 구조상 spy 주입 불가 — 행동(스냅샷 복원) 기준 검증"을 명시. 장기적으로 fallback 로직을 순수 함수로 추출하면(plan W4) 직접 단위 테스트 가능.

### [INFO] SSRF 차단 테스트 — IPv6 및 percent-encoded IP 커버리지 갭
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` 라인 1034–1058
- 상세: SSRF 6-combo 매트릭스는 IPv4 IMDS(`169.254.x.x`), RFC1918(`10.x`, `192.168.x`), localhost를 커버한다. IPv6 bracket 형식(`http://[::1]/`)과 percent-encoded IP는 테스트되지 않는다. 이 케이스들은 `assertSafeOutboundUrl` 내부 로직에 따라 차단 여부가 달라질 수 있으며 SUMMARY INFO#1에서도 언급됐다.
- 제안: `http-safety.ts` 또는 `assertSafeOutboundUrl` 직접 단위 테스트로 IPv6/encoded 케이스 커버. 현 handler spec에 최소 `http://[::1]/` 1케이스 추가 권장.

### [INFO] configEcho credential strip 테스트 — `config.url`이 undefined일 때 단언 통과
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` 라인 1123–1142
- 상세: `expect(result.config.url ?? '').not.toContain('s3cr3t')` 패턴은 `config.url`이 `undefined`일 때도 통과한다(빈 문자열 폴백). credential이 실제로 strip됐는지 확인하려면 `config.url`이 존재하면서 userinfo 부분만 제거됐는지 단언해야 한다.
- 제안: `expect(result.config.url).toBeDefined()` 선행 단언 추가. 차단 경로에서 config.url이 존재하는지 구현 확인 후 적용.

### [INFO] i18n 테스트 — `HTTP_BLOCKED` 한국어 번역에 영문 "SSRF" 포함 의존
- 위치: `codebase/frontend/src/lib/i18n/__tests__/backend-labels.test.ts` 라인 341–347
- 상세: `expect(translated).toContain("SSRF")` 단언은 `ERROR_KO["HTTP_BLOCKED"]` 번역 문자열에 "SSRF"가 포함돼야 통과한다. 번역 담당자가 "사설 호스트 차단" 등 SSRF 미포함 표현으로 바꾸면 번역이 정확해도 테스트가 깨진다.
- 제안: `toContain("SSRF")`를 유지하되, `ERROR_KO["HTTP_BLOCKED"]` 값에 "SSRF"가 포함돼야 한다는 의도를 주석으로 명시. 번역 키 변경 시 테스트 동반 갱신 필요.

### [INFO] `classifyCodeNodeError` null/undefined 테스트 — null 케이스 두 테스트에서 중복 검증
- 위치: `codebase/backend/src/nodes/data/code/code.handler.spec.ts` 라인 120–135
- 상세: "should classify explicit null/undefined" 및 "does not spoof EXECUTION_MEMORY_EXCEEDED" 두 테스트 모두 `classifyCodeNodeError(null)` → `CODE_RUNTIME_ERROR`를 단언한다. "does not spoof" 테스트의 핵심 의도는 "isolate arg 없이 null err가 잘못된 분기를 타지 않음"인데 null 중복 단언이 그 의도를 희석한다.
- 제안: "does not spoof" 테스트를 `classifyCodeNodeError(null as any, undefined)` 대신 `err=null, isolate=defined-but-not-disposed` 형태로 표현하면 의도가 더 명확해진다. 현행도 동작상 문제없음.

### [INFO] dry-run SSRF skip 테스트 — `_dryRun` 및 `wouldHaveCalled.kind` 단언 추가 완료
- 위치: `codebase/backend/src/nodes/integration/http-request/http-request.handler.spec.ts` 라인 1092–1121
- 상세: 이전 세션(10_07_06) Warning 4로 지적된 `output._dryRun` 단언 누락이 RESOLUTION.md에 따라 수정 완료됐다. 현재 테스트는 `result.output._dryRun === true` 및 `result.output.wouldHaveCalled.kind === 'http_request'`를 모두 단언하여 dry-run 계약이 완전히 검증된다.
- 제안: 없음.

---

## 요약

이번 변경(그룹3)은 plan에서 예고한 테스트 항목 전체(classifyCodeNodeError null/undefined, console.warn/error 캡처, $vars copy-out 실패 fallback, syntaxIsolate reuse, SSRF 6-combo, opt-out, dry-run skip, configEcho credential strip, i18n 매핑)를 구현했고, 이전 ai-review Warning 4(dry-run `_dryRun` 단언 누락)도 수정 완료됐다. 커버리지 갭은 IPv6/encoded IP SSRF, configEcho의 url=undefined 통과 약점, i18n 영문 단어 의존, syntaxIsolate disposed 분기(module-private 특성상 허용 가능) 등 모두 INFO 수준이며 보안 기능 동작에는 영향이 없다. `$vars` copy-out fallback 테스트는 isolated-vm API 세부사항에 의존하는 구조적 약점이 있어 WARNING으로 분류하나 현재 동작 검증은 충분하다. 전반적으로 테스트 의도가 명확하게 표현되어 있고, 환경변수 복원 패턴(try/finally), 테스트 격리, 가독성 모두 양호한 수준이다.

---

## 위험도

LOW
