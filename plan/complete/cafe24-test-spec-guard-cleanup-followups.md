---
worktree: TBD
started: 2026-05-18
owner: developer
---

# Backend cleanup follow-ups — cafe24-test-spec-guard ai-review 분리분

## 배경

본 plan 은 PR `cafe24-test-spec-guard` (commits `615000a7..5dca2a2c`) 의
`/ai-review` 세션에서 발견된 항목 중 본 PR 의 핵심 변경 (spec §5.8/§9.1 +
`pending_install` 가드) 과 무관한 **사전 결함** 그룹을 별도 cleanup
plan 으로 분리한 것이다. 본 PR 의 commit C (`chore(lint): npm run lint
--fix 부수 재포맷 + unused import cleanup`) 가 누적된 prettier line-wrap
drift 를 일괄 정리하면서 그 과정에서 reviewer 가 인접 코드의 사전
결함을 함께 surface 했다.

산출 위치: `review/code/2026/05/18/17_25_35/SUMMARY.md`.

본 plan 의 항목들은 각각 독립적이고 의존성이 약해 **여러 작은 PR 로
점진 처리** 하거나 한 PR 안에서 일괄 처리해도 무방하다. 분량이 큰 항목
은 별도 worktree 로 분리 권장.

## 처리 대상 (개별 체크박스)

각 항목은 ai-review SUMMARY 의 WARNING/INFO 번호와 위치를 그대로 보존한다.

### W-1 — `encrypt-auth-config.ts` skipped 카운터 고정

- [x] (2026-05-28) skip 분기가 실제로 존재하지 않아 카운터 의미 없음 →
  `const skipped = 0` 선언과 로그 출력의 `skipped=...` 항목을 함께 제거.
- 검증: eslint (type-aware) 통과로 syntax·타입 유효 확인.

### W-2 / W-10 — `http-safety.spec.ts` 타입 단언 복원

- [x] (2026-05-28) `jest.mocked()` 패턴으로 교체. `import { lookup } from
  'node:dns/promises'` + `const mockedLookup = jest.mocked(lookup)` 로
  타입 안전한 mock 핸들 확보, 모든 `lookup.*` 호출을 `mockedLookup.*` 로 치환.
- 회귀 검증: `jest http-safety.spec` 16개 통과.

### W-4 — `ExecutionEventEmitter` 유닛 테스트 신규 작성

- [x] (2026-05-28) `execution-event-emitter.service.spec.ts` 신규 작성.
  `emitExecution` / `emitNode` / `registerExecutionRouting` /
  `releaseExecutionRouting` 4개 위임 메서드가 mock `WebsocketService` 로
  인자 그대로 전달하는지 검증 (4 tests).

### W-5 — `WebsocketGateway` 구독 상한 분기 테스트 보강

- [x] (2026-05-28) 이미 충족 — `websocket.gateway.spec.ts` 에 'should reject
  when max subscriptions reached' + 'enforces MAX_SUBSCRIPTIONS across
  concurrent subscribe with deferred authorize (TOCTOU race)' 테스트가
  존재해 초과 분기를 커버. (plan 의 라인 926~933 은 stale — 현재 파일 642줄)
  추가 작업 불필요.

### W-6 — `cors-origins.spec.ts` 테스트 격리 통일

- [x] (2026-05-28) 이미 충족 — `cors-origins.spec.ts` 의 `beforeEach` 가 매
  테스트 전 CORS_ORIGINS / FRONTEND_URL / NODE_ENV 3개 키를 명시 delete 하여
  케이스 간 격리를 이미 보장하고, `afterAll` 이 suite 종료 시 원본 env 복원.
  테스트가 손대는 키가 이 3개뿐이라 누수 없음. 불필요한 churn 회피 위해
  현 패턴 유지 (CLAUDE.md "변경은 작업이 요구하는 범위로 한정").

### W-7 — `websocket.service.spec.ts` magic number 상수화

- [x] (2026-05-28) `websocket.service.ts` 의 `MAX_SANITIZE_DEPTH` 를 `export`
  하고, spec 에서 import 해 매직 넘버 `12` 를 `MAX_SANITIZE_DEPTH + 2` 로 치환.
  상수 변경 시 테스트가 자동 추종.

### W-8 — `translation.ts` 경로 불일치 TODO 추적

- [x] (2026-05-28) **완전 해소 — 실제 불일치 없음으로 판명.** SoT 카탈로그
  `spec/conventions/cafe24-api-catalog/translation.md` 와 코드(`translation.ts`)
  모두 단수 `translation/` 경로를 사용해 이미 일치한다. 원래 우려한
  "translations 복수" 는 Cafe24 docs 의 anchor slug(`#...-product-translations`,
  리소스 개념 표기)일 뿐 URL path 가 아니었다. 즉 spec 결정·정정 불필요.
- 처리: 오해를 부르던 코드 주석을 "단수 `translation/` 이 SoT 와 일치하며
  복수 anchor 는 path 아님" 으로 정정 (translation.ts L23~26). spec 변경 없음.

### INFO 그룹 — 검토 및 분류

- [x] INFO-5: (2026-05-28) nonce key 의 hmac 세그먼트가 정확히 8자임을
  직접 검증하는 'prefix length invariant' 테스트 추가 — prefix 길이를 8 이외로
  바꾸면 세그먼트가 달라져 회귀 노출. (충돌 테스트만으론 길이 자체 미고정이었음)
- [x] INFO-6: (2026-05-28) **코드 + spec 모두 완료.** 코드: prefix 8자 설계가
  `cafe24-install-nonce-cache.service.ts` 의 클래스 docstring + `buildKey`
  inline 주석에 명시 (충돌 확률 64^8 산식 포함). spec: project-planner 로
  `spec/4-nodes/4-integration/4-cafe24.md §9.8` Nonce cache 보호 note 에 키
  구성(hmac 앞 8자 prefix + 충돌 시 보안 무영향 + install_token/HMAC strength
  독립성) 추가 + 관련 코드 상수 표에 prefix 길이 행 추가 + 변경 이력 행 추가.
  consistency-check `review/consistency/2026/05/28/22_13_50/` (BLOCK: NO).
- [x] INFO-7: (2026-05-28) 이미 충족 — graceful degradation 의 보안 수준이
  service docstring(L24~27) + `isReplay` 반환 주석(L80) + catch 분기
  warn 로그(L100~104)에 "보안 강화 0, 기존 timestamp 윈도우 정책으로
  fallback" 으로 명시됨.
- [x] INFO-8: (2026-05-28) 이미 충족 — `assertCorsOriginsConfigured()` 가
  `main.ts:141` bootstrap 에서 호출되고 `cors-origins.spec.ts` 에 throw/
  non-throw 케이스 테스트 존재.
- [x] INFO-10: (2026-05-28) `websocket.service.spec.ts` 에 password/passwd/pwd/
  apiKey/secret/token/accessToken/refresh_token/privateKey/client_secret/
  authorization/cookie 전 패턴 마스킹 회귀 테스트 추가 (api_key 단일 → 전체).
- [x] INFO-11: (2026-05-28) `Cafe24InstallNonceCache.close()` 가 Redis
  미설정 시 throw 없이 no-op 으로 resolve 하는 테스트 추가.
- [x] INFO-12: (2026-05-28) **의도적 보류** — `Record<string, Mock> + as never`
  는 본 저장소 spec 전반의 일관된 mock 관용구 (Redis/Repo 처럼 메서드가 많은
  의존성에 `jest.Mocked<T>` 풀 mock 은 비현실적). 일부만 바꾸면 오히려
  suite 내 불일치를 유발하므로 현 패턴 유지. (plan 라인 471/678 도 stale)
- [x] INFO-16: (2026-05-28) 이미 해소됨 — `catalog-sync.spec.ts:46` 의
  `resolveRepoRoot` 가 `git rev-parse --show-toplevel` 우선 + 7단계
  fallback 으로 이미 견고화됨 (linked worktree ENOENT 회귀 주석 포함).

## 처리 후

본 노트의 모든 체크박스가 `[x]` 가 되고 follow-up 추가 항목이 없으면
`plan/complete/` 로 `git mv`.

### 진행 상태 (2026-05-28) — 전 항목 완료

모든 체크박스 `[x]`. 잔여 follow-up 없음.

- developer 범위 코드 항목 (W-1, W-2/10, W-4, W-7, INFO-5/10/11): 처리 완료.
  검증: 영향받은 4개 스위트 (`http-safety.spec` / `cafe24-install-nonce-cache`
  / `websocket.service.spec` / `execution-event-emitter`) 50개 테스트 통과 +
  변경 파일 eslint 통과.
- 이미 충족돼 있던 항목 (W-5, W-8 일부, INFO-6 코드, INFO-7/8/16): 확인 후 기록.
- 보류 결정 (INFO-12): 저장소 mock 관용구 일관성 유지를 위해 의도적 미변경.
- project-planner 영역 잔여였던 두 건 모두 해소:
  - **INFO-6 spec**: `spec/4-nodes/4-integration/4-cafe24.md §9.8` 에 nonce
    키 구성 명문화 (consistency-check `review/consistency/2026/05/28/22_13_50/`,
    BLOCK: NO).
  - **W-8**: SoT 카탈로그·코드가 이미 단수 `translation/` 으로 일치 — 실제
    불일치 없음으로 판명, spec 변경 불필요. 오해 주석만 정정.

→ 본 plan 은 `plan/complete/` 로 이동 (draft `spec-draft-cafe24-nonce-key-design.md`
포함, INFO-6 반영 완료).

## 분리 근거

- 본 PR (`cafe24-test-spec-guard`) 의 핵심 의도는 **spec §5.8 갱신 +
  `pending_install` 가드 도입** 두 가지. 위 항목들은 그 코드 경로와
  무관한 사전 결함이라 scope 분리.
- 사용자 결정 (2026-05-18): lint --fix 부수 변경은 본 PR 에 동봉
  유지하되, reviewer 가 발견한 인접 사전 결함은 별도 plan 으로 추적.
- `review/code/2026/05/18/17_25_35/SUMMARY.md` 의 "후속 plan 으로 분리
  권장" 섹션 참고.

## 우선순위 가이드

| 그룹 | 권장 처리 시점 | 분리 가능성 |
|-----|---------------|------------|
| W-1, W-2/10 | 빠르게 (작고 안전) | 한 PR 가능 |
| W-6, W-7 | 빠르게 (작고 안전) | 위 PR 에 동봉 |
| W-4, W-5 | 중간 (테스트 신규 작성) | 별 worktree 권장 |
| W-8 | spec 결정 선행 | project-planner 위임 후 |
| INFO 그룹 | 보안·문서화 정리 시점 | 묶음 PR 또는 점진 |
