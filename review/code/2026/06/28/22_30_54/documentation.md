# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `extractClientIp` 반환형 불일치 — JSDoc vs 구현
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/auth/utils/client-ip.ts`, `extractClientIp` 함수 (line 610)
- 상세: `extractClientIpFromHeaders` 의 JSDoc 은 `null → undefined` 변경 이유와 소비처 통일을 정확히 설명하고 있으나, 같은 파일의 `extractClientIp` 함수는 여전히 `string | null` 을 반환하며 JSDoc 에 해당 비대칭이 명시되지 않았다. `extractClientIpFromHeaders` 는 `undefined`, `extractClientIp` 는 `null` — 두 함수의 반환형 불일치가 문서에 드러나지 않아 소비처가 혼동할 수 있다.
- 제안: `extractClientIp` 의 JSDoc `@returns` 절에 `null` 반환(헤더도 req.ip도 socket도 없을 때)을 명시하고, `extractClientIpFromHeaders` 와 반환형이 의도적으로 다름을 한 줄로 설명한다.

### [INFO] 테스트 mock 주석의 숫자 고착 위험
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/hooks/hooks.service.spec.ts`, `ExecutionsService` mock 블록 (line 1616)
- 상세: 주석에 "23개 테스트 사이트 변경 없이"라는 구체적 숫자가 하드코딩되어 있다. 테스트가 추가/제거될 경우 이 숫자가 stale 해지며, 주석이 코드 이해를 돕기보다 오해를 줄 수 있다.
- 제안: 숫자를 제거하고 의도("기존 테스트 사이트를 변경하지 않고 동작을 보존")만 서술한다.

### [INFO] `getStatusById` — `@throws` 절 부재
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/executions/executions.service.ts`, `getStatusById` (line 690–701)
- 상세: JSDoc 이 작성되어 있으나 예외 처리 정책(`catch(() => null)` — DB 오류를 null 로 흡수)만 본문에서 설명하고 `@throws` 가 없다. 의도적으로 절대 throw 하지 않는 설계이므로 그 사실을 `@throws` 절 없음이 아니라 명시적인 문장("절대 throw 하지 않음 — 조회 실패는 null 로 흡수")으로 적으면 소비처가 try/catch 를 생략해도 안전함을 즉시 알 수 있다.
- 제안: JSDoc 에 `@remarks 조회 실패는 항상 null 로 흡수하며 throw 하지 않는다.` 한 줄 추가.

### [INFO] `hooks.service.ts` 인라인 주석 번호 충돌
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/hooks/hooks.service.ts`, line 2739
- 상세: 코드 내에서 "// 3. Authenticate" 주석이 두 번 등장한다(line 2724의 "// 3. Check active status" 와 line 2739의 "// 3. Authenticate"). 단계 번호가 중복되어 순서를 이해하는 데 혼란을 줄 수 있다. 이 번호는 기존 코드에 있던 것이 이번 변경으로 인해 정리되지 않은 채 잔류한 것으로 보인다.
- 제안: "// 3. Authenticate" → "// 4. Authenticate" 로 단계 번호를 정정하여 기존 주석 흐름과 일치시킨다.

### [INFO] `client-ip.spec.ts` — `extractClientIp` 마지막 케이스의 `null` 반환 테스트명과 본문 불일치 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/webhook-maint-backlog-f14768/codebase/backend/src/modules/auth/utils/client-ip.spec.ts`, line 517
- 상세: `extractClientIp` 테스트의 마지막 케이스 `'모든 소스가 비어 있으면 null 을 반환한다'` 는 `.toBeNull()` 을 단언한다. 이번 변경에서 `extractClientIpFromHeaders` 만 `undefined` 로 통일되었고 `extractClientIp` 는 `null` 유지가 의도적이다. 테스트 자체는 정확하나, 주석 "반환형 통일: 헤더 식별 불가 시 undefined (과거 null)" 이 같은 파일 내 `extractClientIp` 의 `null` 반환 테스트와 병존하여 독자가 `extractClientIp` 도 `undefined` 로 바꿨는지 혼동할 수 있다.
- 제안: `extractClientIp` describe 블록 상단이나 해당 케이스 주석에 `extractClientIp` 는 `null` 반환을 유지하며 `extractClientIpFromHeaders` 와 다름을 한 줄 명시한다.

## 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. JSDoc이 변경 이유와 소비처 영향을 충분히 설명하고, 인라인 주석이 복잡한 분기(CCH-CV-03, CWE-209 sanitize, private 브래킷 접근 제거 등)를 명확히 서술하고 있다. 단, `extractClientIpFromHeaders(undefined)` 와 `extractClientIp(null)` 의 의도적 반환형 불일치가 문서에 명시되지 않아 소비처 오독 위험이 있고, `hooks.service.ts` 의 단계 번호 중복(`// 3. Check active status` / `// 3. Authenticate`)이 순서 이해를 저해한다. 테스트 mock 주석의 하드코딩 숫자(23개)는 향후 stale 해질 수 있다. 새 환경변수(`TRUST_CF_CONNECTING_IP`)는 `shouldTrustCfConnectingIp` JSDoc 에 이미 설명되어 있으며, README나 CHANGELOG 업데이트는 이 변경의 범위(내부 리팩터링·테스트 보강)를 고려할 때 현 시점에서 필수 수준은 아니다.

## 위험도

LOW
