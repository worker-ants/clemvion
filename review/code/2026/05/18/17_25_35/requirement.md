# 요구사항(Requirement) 리뷰 결과

## 발견사항

### [CRITICAL] spec 경로 참조 교정 방향 역전 (파일 37, 39)

- **위치**: `spec/3-workflow-editor/4-ai-assistant.md` diff 및 `spec/5-system/_product-overview.md` diff
- **상세**: 이번 PR 의 의도는 옛 flat 경로를 nested ISO 경로로 교정하는 것이다. 그러나 파일 37 (`4-ai-assistant.md`) 의 diff 를 보면 `review/code/2026/04/24/18_27_09/` → `review/2026-04-24_18-27-09/` 로 **역방향** 교정이 적용되었다. 마찬가지로 파일 39 (`_product-overview.md`) 에서도 `review/code/2026/05/05/17_24_08/voiceover-notes.md` → `review/2026-05-05_a11y/voiceover-notes.md` 로 역방향이다. plan/in-progress 의 `spec-paths-housekeeping-2026-05-16.md` (파일 35) 는 두 파일 모두 "마이그레이션 확인 완료" 로 기술하며 nested ISO 경로가 올바른 쪽임을 명시하고 있다. 즉 현행 spec 파일에 올바른 nested ISO 경로가 있었는데, 이번 diff 가 그것을 옛 flat 경로로 되돌리고 있다.
- **제안**: 두 파일 모두 diff 의 방향을 반전해야 한다. `spec/3-workflow-editor/4-ai-assistant.md` 는 `review/2026-04-24_18-27-09/` 를 `review/code/2026/04/24/18_27_09/` 로 유지(또는 복원)하고, `spec/5-system/_product-overview.md` 는 `review/2026-05-05_a11y/voiceover-notes.md` 를 `review/code/2026/05/05/17_24_08/voiceover-notes.md` 로 유지(또는 복원)해야 한다.

---

### [WARNING] `encrypt-auth-config.ts` — `skipped` 카운터 항상 0 으로 고정 (파일 32)

- **위치**: `codebase/backend/src/scripts/encrypt-auth-config.ts`, 변경 라인 `let skipped = 0` → `const skipped = 0`
- **상세**: 이 스크립트는 이미 암호화된 행을 `skipped` 로 카운트하도록 설계되어 있으며, 마지막 로그에서 `skipped=${skipped}` 를 출력한다. 그러나 변경된 코드에서 `skipped` 를 `const skipped = 0` 으로 고정하면서 실제로 skip 된 행이 있어도 카운터가 0 으로 표시된다. 전체 파일 컨텍스트를 봐도 `skipped` 를 증가시키는 코드가 없다 — 즉 이전 코드에서도 이미 `skipped` 는 항상 0 이었다(증가 로직 자체가 없었음). `const` 변경 자체는 기존 동작을 바꾸지 않으나, 의도와 코드 간 괴리(`skipped` 카운트 기능이 없는데 출력은 존재)가 잠재적 혼란을 유발한다.
- **제안**: `skipped` 증가 로직을 추가하거나(row 를 건너뛰는 조건이 실제로 존재한다면), 아니면 `skipped=${skipped}` 출력 자체를 제거해 의도와 구현을 일치시킨다. 단순 formatting 변경이라면 `const` 는 맞지만 로그 출력의 의미를 함께 정리해야 한다.

---

### [WARNING] `http-safety.spec.ts` — `lookup` mock 타입 누락으로 `.mockReset()` 안전성 저하 (파일 30)

- **위치**: `codebase/backend/src/nodes/integration/http-request/http-safety.spec.ts`, 변경 라인
  ```ts
  // 변경 전
  const { lookup } = jest.requireMock('node:dns/promises') as {
    lookup: jest.Mock;
  };
  // 변경 후
  const { lookup } = jest.requireMock('node:dns/promises');
  ```
- **상세**: `as { lookup: jest.Mock }` 타입 단언을 제거하면 `lookup` 의 타입이 `any` 로 추론된다. `beforeEach` 에서 `lookup.mockReset()` 을 호출하는데, `any` 타입에서는 TypeScript 가 `mockReset` 의 존재를 검사하지 않아 잘못된 mock 이름으로 교체되거나 실제 모듈이 주입될 경우 런타임에서만 오류를 감지할 수 있게 된다.
- **제안**: 타입 안전성을 유지하려면 `as { lookup: jest.Mock }` 단언을 유지하거나, `jest.mocked` 유틸을 사용하는 것이 권장된다.

---

### [WARNING] `integrations.service.ts` — `pending_install` 가드 위치 순서 문서와 불일치 (파일 8)

- **위치**: `codebase/backend/src/modules/integrations/integrations.service.ts`, 추가된 `pending_install` 가드 블록
- **상세**: 코드 주석은 "Backend backstop for the UI's disabled Test-connection button (§4.2)" 이라 명시한다. 그러나 추가된 가드는 `INTEGRATION_CREDENTIALS_UNREADABLE` 분기(복호화 실패) **이후** 에 위치한다. 스펙 §9.1 비고에는 "`pending_install` row 는 외부 호출 없이 즉시 거부"라 되어 있는데, 복호화를 먼저 시도한 후에 status 를 확인하면 `pending_install` row 에 대해 불필요한 복호화 시도가 선행된다. 기능적으로는 올바른 결과를 반환하지만 "token not yet issued" 라는 이유로 즉시 거부한다는 설명과 실제 코드 흐름이 일치하지 않는다.
- **제안**: `pending_install` 가드를 credentials 복호화 시도 이전으로 이동해 "토큰 미발급 상태라 외부 호출 자체가 무의미"라는 주석 의도와 코드 실행 순서를 일치시킨다.

---

### [INFO] `cafe24-install-nonce-cache.service.spec.ts` — HMAC prefix 충돌 trade-off 테스트는 있으나 prefix 길이 상수 검증 없음 (파일 5)

- **위치**: `codebase/backend/src/modules/integrations/cafe24-install-nonce-cache.service.spec.ts`, `HMAC prefix collision` 테스트
- **상세**: 테스트 주석이 "충돌 확률 64^8 = 2.8e14" 라고 명시하며 prefix 길이가 8자임을 암묵적으로 가정한다. 그러나 `Cafe24InstallNonceCache` 의 실제 prefix 길이 상수를 직접 검증하는 assertion 이 없다. 주석이 말하는 "누군가 prefix 길이를 손대거나 키 전략을 바꾸면 본 테스트가 명시적 신호를 준다"는 보장이 prefix 길이 자체의 변경에 대해서는 완전하지 않다 — `AAAA1234-payload-one` 과 `AAAA1234-payload-two-DIFFERENT` 의 첫 8자가 같다는 데이터로 충돌을 확인하므로 prefix 가 4자로 줄어도 이 테스트는 통과한다.
- **제안**: `expect(keys[0]).toContain(':AAAA1234')` 에 더해 실제 prefix 길이가 8자임을 `Cafe24InstallNonceCache` 의 내부 상수나 key 패턴으로 명시 검증하면 회귀 감지력이 높아진다.

---

### [INFO] `spec-paths-housekeeping-2026-05-16.md` — `worktree: TBD` 미기입 (파일 35)

- **위치**: `plan/in-progress/spec-paths-housekeeping-2026-05-16.md` frontmatter
- **상세**: CLAUDE.md §PLAN 문서 라이프사이클 규칙에 따르면 `plan/in-progress/` 의 frontmatter 에 `worktree` 필드를 명시해야 하며, 이는 consistency-checker 의 `plan_coherence` 가 충돌 검출에 사용한다. 현재 `worktree: TBD` 로 미기입 상태다.
- **제안**: worktree 가 결정되는 시점에 `worktree: spec-paths-housekeeping-<slug>` 형식으로 갱신한다.

---

### [INFO] `catalog-sync.spec.ts` — formatting 전용 변경 (파일 18)

- **위치**: `codebase/backend/src/nodes/integration/cafe24/metadata/catalog-sync.spec.ts`, `resolveRepoRoot` fallback
- **상세**: `join(__dirname, '..', '..', '..', '..', '..', '..', '..')` — 7단계 상위 경로를 하드코딩한다. `git rev-parse --show-toplevel` 실패 시의 fallback 이므로 기능상 문제는 없으나, 디렉터리 구조 변경 시 silent failure 가 발생한다.
- **제안**: 이번 PR 범위의 이슈는 아니지만 향후 monorepo 구조 변경 시 이 fallback 의 깊이를 함께 검토해야 한다.

---

## 요약

이번 PR 의 핵심 기능인 `pending_install` 가드 구현 (파일 7·8), 연결 테스트 endpoint `/store` → `/apps` 전환 spec 갱신 (파일 36), 그리고 대다수의 코드 formatting 변경은 요구사항 관점에서 의도와 구현이 잘 일치한다. 그러나 spec 경로 교정 관련 파일 37·39 에서 교정 방향이 완전히 역전되어 올바른 nested ISO 경로를 옛 flat 경로로 되돌리는 Critical 한 오류가 발견되었다 — 이는 plan/in-progress 문서의 의도와 정반대 동작이다. 아울러 `encrypt-auth-config.ts` 의 `skipped` 카운터 고정, `pending_install` 가드의 실행 순서와 주석 간 불일치, `http-safety.spec.ts` 의 타입 안전성 저하도 함께 수정이 권장된다.

## 위험도

HIGH
