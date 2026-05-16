# Review Resolution — 2026-05-16

세션: `review/code/2026/05/16/08_35_36`
대응 brance: `claude/user-guide-sync-4af69c`

## 즉시 조치

### W1 — registry 단위 테스트에 spec/code 경로 실존 검증 추가

**문제** spec/2-navigation/13-user-guide.md §11 이 명시한 "registry.ts 단위 테스트에서 모든 spec:/code: 경로 존재 확인" 이 실제로는 구현되지 않은 상태였다.

**조치** `frontend/src/lib/docs/__tests__/registry.test.ts` 끝에 `real docs frontmatter spec/code paths` describe 블록 추가. 실제 `frontend/src/content/docs` 인덱스를 로드한 뒤 각 페이지의 `spec` / `code` frontmatter 경로를 worktree 루트 기준 `fs.existsSync` 로 검증한다. 부재 시 `missing` 배열에 모아 한 번에 보고하므로 dangling 참조가 CI 단계에서 노출된다.

`content/docs` 디렉토리가 존재할 때만 실행되도록 `it.runIf(hasRealDocs)` 가드를 둠 (단위 테스트 격리 환경 대비).

**검증** `npx vitest run src/lib/docs/__tests__/registry.test.ts` → 25/25 pass.

### W2 + I3 — `$thread.text` 메모이제이션 정합화

**문제** 한/영 `variables-and-context` 의 `$thread.text` description 은 "Memoized on first access" 라고 안내하면서 같은 페이지의 Callout 은 "호출할 때마다 전체 thread 를 렌더" 로 상충 표현. backend `expression-resolver.service.ts L130~145` 는 closure 안 `cached` 변수로 실제 memoize 한다.

**조치** Callout 본문을 "단일 노드 실행 컨텍스트 안에서 첫 접근 시 1회만 렌더, 같은 노드 안 반복 호출은 캐시. ForEach/Loop 는 iteration 마다 새 컨텍스트라 매 iteration 별로 한 번씩 렌더" 로 바꿔 description 과 일치시키고 사용자에게 메모이제이션 경계를 명확히 했다.

### W5 — `integrations.mdx` 도입부 "세 종류" 갱신

**문제** Cafe24 노드 추가 후에도 한/영 모두 도입부에 "세 종류"/"three" 표현이 남아 실제 노드 수(4종)와 불일치.

**조치** 한국어판 "통합 노드 네 종류(HTTP Request, Database Query, Send Email, Cafe24)" / 영문판 "four integration nodes ... (HTTP Request, Database Query, Send Email, and Cafe24)" 로 갱신.

### I10 — Cafe24 예시 제목과 `start_date` 표현식 mismatch

**문제** 예시 제목 "어제 미발송 주문 가져오기" 와 `start_date: "{{ formatDate($now, \"YYYY-MM-DD\") }}"` (오늘 날짜) 가 의미 불일치. `formatDate` 만 사용해서는 "어제" 시점을 표현할 수 없음.

**조치** `packages/expression-engine/src/functions/date.ts` 의 `addTime(date, amount, unit)` 함수를 활용해 `start_date: "{{ formatDate(addTime($now, -1, \"day\"), \"YYYY-MM-DD\") }}"` 로 정정. 제목도 "어제부터 오늘까지의 미발송 주문" 으로 의미 합치. `end_date` 도 추가해 명시적 범위로 표현. 한/영 모두 동일하게 반영.

## Info — 추적

다음 항목은 본 사이클에서 처리하지 않음. 사유 / 후속 처리 위치를 명시.

- **I1 (security)** `contextScope: thread` 사용 시 외부 LLM 데이터 전송 안내 — spec/conventions/conversation-thread.md 가 일차 소스. spec 보강은 `project-planner` 위임.
- **I2 (security)** `integrationId` 민감 식별자 안내 — 일반 보안 가이드라인 분리.
- **I4, I5 (performance)** context window/cost 경고 강화 — 다음 문서 사이클.
- **I6, I7 (requirement)** contextScopeN 기본값/cap 명시 — 본문에 이미 "default: 20" 표시, cap 상수는 spec 측 미확정.
- **I8 (requirement)** UI 경로 안내 — settings-panel 그룹명 변경 가능성 있어 미확정.
- **I9, I16, I17 (integrations cafe24)** pagination 기본값, cursor 방식, rate-limit 재시도 — Cafe24 풀 가이드 `06-integrations-and-config/cafe24` 가 일차 소스. 본 페이지는 deep-link 만 유지.
- **I11 (requirement)** 빈 thread 방어 — `?.` 옵셔널 체이닝은 이미 다른 페이지에서 다룸.
- **I12 (maintainability)** plan 후속 위임 항목 체크박스화 — plan 본문 형식 컨벤션 일반 이슈.
- **I13~I15 (documentation)** `$thread.turns.source` 열거 값 등 상세 — 다음 사이클.
- **I18, I19, I20** — 컨벤션·사소한 주석 등 비즉시 항목.

## Warning — 미조치 사유

- **W3 (Anthropic system role 비호환)** — `contextInjectionMode: messages` 는 user/assistant role 만 사용. spec `conversation-thread.md §5.1` 도 본 모드에 system role 제약을 명시하지 않음. 잘못된 발견으로 판단해 미조치.
- **W4 (overview Integration 카테고리 열거 방식)** — 통합 종류 총 4가지로 사용자가 어떤 통합이 있는지 즉시 파악하는 가치가 추상화 가치보다 큼. 의도된 trade-off 로 미조치.
- **W6 (한/영 drift)** — 본 작업에서 한/영 페어를 모두 갱신함. 단일 데이터 소스화는 별도 컨벤션 이슈.

## TEST WORKFLOW 재실행 결과

- **frontend lint** ✅ PASS
- **frontend unit (vitest)** ✅ 1366/1366 PASS (119 files). 새로 추가한 `real docs frontmatter spec/code paths` 테스트 1건 포함.
- **frontend build (next)** ✅ PASS
- **backend e2e (`make e2e-test`)** ❌ **사전 결함** — `backend/test/background-monitoring.e2e-spec.ts` 의 두 테스트가 실패. 2회 연속 같은 위치에서 reproducible.

### e2e 실패 분류 — 사전 결함

본 worktree 의 변경 내역(`git diff main..HEAD --name-only` 기준)을 검토한 결과 **backend 코드 0 줄 변경**. 변경 파일은 다음으로 한정:

- `frontend/src/content/docs/**/*.mdx` × 8
- `frontend/src/lib/docs/__tests__/registry.test.ts` (W1 fix)
- `plan/in-progress/user-guide-sync-2026-05-16.md`
- `review/{consistency,code}/2026/05/16/...` 산출물

e2e 가 실패한 `backend/test/background-monitoring.e2e-spec.ts` 는 `/api/executions/{id}/background-runs/{id}` 라우트 동작을 검증하며, 본 worktree base(`61b16c76`) 의 backend 코드에 의존한다. 실패 메시지:

```
ownOk failed { status: 404, body: { error: { code: 'RESOURCE_NOT_FOUND', message: 'Cannot GET /api/executions/.../background-runs/...' } } }
Expected: 200, Received: 404
```

본 작업의 어떤 변경도 해당 라우트나 인증·워크스페이스 컨텍스트·BackgroundRun 도메인을 건드리지 않았으므로 **사전 결함**으로 분류한다. SKILL.md 단계 8 "안전 가드 — 직전 수정과 무관한 사전 결함" 에 따라 자동 진행을 중단하고 사용자에게 보고한다.

### 사용자 결정 필요

- 본 worktree 의 변경(docs + test-only)은 e2e 회귀 위험이 없으므로 PR 생성 가능.
- `background-monitoring.e2e-spec.ts` 사전 결함은 별도 hotfix worktree 에서 처리 권고 (cafe24-oauth · notifications 후속과 함께 분석 필요).
