### 발견사항

---

**[WARNING]** 프로덕션 코드 및 테스트에 태스크 추적 마커 잔류
- 위치:
  - `integration-oauth.service.ts`: `// Duplicate-prevention scan (변경 3)`, `(W3 from review/2026-05-14_16-48-25)`
  - `integration-expiry-scanner.service.spec.ts`: `describe('...expirePendingInstalls (변경 4)', ...)`
  - `integration-oauth.service.cafe24.spec.ts`: `describe('begin — private app duplicate prevention (변경 3)', ...)`, `describe('handleInstall — ... (변경 2)', ...)`
  - `status-badge.test.tsx`: `it("surfaces install_timeout hint ... (변경 4)", ...)`
- 상세: CLAUDE.md 규약 — "현재 태스크·Fix·호출자를 참조하지 않는다." `변경 N` 마커와 review 아티팩트 경로(`review/2026-05-14_16-48-25`)는 PR 머지 후 의미를 잃고, 미래 독자가 존재하지 않는 리뷰 세션을 추적하도록 유도할 수 있다.
- 제안: `(변경 N)` 제거. review 경로 인라인 참조 → 커밋 메시지 또는 PR description 으로 이동.

---

**[WARNING]** 프로덕션 JSDoc 안에 plan 파일 경로 하드코딩
- 위치: `integrations.controller.ts`, `cafe24InstallLegacy` JSDoc 마지막 줄
  ```
  * Permanent retirement tracked in plan/in-progress/cafe24-pending-polish.md as a follow-up.
  ```
- 상세: 이 plan이 `complete/`로 `git mv`되면 경로가 깨진다. CLAUDE.md의 "살아있는 문서" 원칙과 충돌하며, 프로덕션 코드에 일회성 추적 문서 경로를 박는 것은 코드 수명보다 짧다.
- 제안: 해당 문장 제거. 레거시 경로 폐기 시점은 PR description 또는 별도 issue 에 남긴다.

---

**[WARNING]** 불확실한 spec 경로 참조
- 위치: `integration-expiry-scanner.service.ts:72`
  ```ts
  // spec/data-flow/integration.md §1.4. variant 4: pending_install TTL.
  ```
- 상세: 동일 PR 내 다른 코멘트들은 `spec/2-navigation/4-integration.md`, `spec/4-nodes/4-integration/4-cafe24.md` 를 참조한다. `spec/data-flow/integration.md` 경로는 프로젝트 spec 트리에 존재하지 않거나 다른 경로일 가능성이 있다. 미래 독자가 빈 파일로 이동하게 될 수 있다.
- 제안: `spec/` 실제 트리 확인 후 올바른 경로로 교정. 존재하지 않으면 가장 가까운 문서(`spec/2-navigation/4-integration.md`)로 대체.

---

**[INFO]** `IntegrationMeta` JSDoc 이중화 — 두 문서가 미묘하게 다름
- 위치: `integration-response.dto.ts` (DTO JSDoc) vs `integrations.service.ts` (interface JSDoc)
- 상세: 두 곳 모두 같은 의도를 설명하지만 표현이 다르다. DTO: *"only `meta.appType` is populated today"*, service: *"Only Cafe24 currently emits anything here."* 동작이 바뀔 경우 한 쪽이 누락될 위험.
- 제안: service interface를 canonical source로 삼고 DTO JSDoc에서 중복 설명 제거 또는 단순 `@see IntegrationMeta` 로 위임.

---

**[INFO]** 폴링 상수 근거 미문서화
- 위치: `new/page.tsx`
  ```ts
  const PRIVATE_PENDING_POLL_MS = 3000;
  const PRIVATE_PENDING_TIMEOUT_MS = 10 * 60 * 1000;
  ```
- 상세: 이름은 의도를 충분히 전달하지만, 3초와 10분이 선택된 이유(Cafe24 "테스트 실행" 완료 예상 소요 시간 등)가 비명시적이다. 유사 UX 결정과 연결이 없어 미래에 임의로 조정될 수 있다.
- 제안: 각 상수 위에 한 줄 why 주석. 예: `// Cafe24 테스트 실행 완료 최대 예상 시간 10분 — spec §6 TTL 기준`.

---

**[INFO]** `lastError` 유니온 타입 설명 부재
- 위치: `frontend/src/lib/api/integrations.ts:37`
  ```ts
  lastError: { code?: string; message?: string; at?: string } | Record<string, unknown> | null;
  ```
- 상세: `Record<string, unknown>`은 앞의 구체 타입을 이미 포함하므로 유니온의 의미가 불명확하다. 기존 응답과의 하위 호환성 때문인지, 미래 확장 여지인지 알 수 없다.
- 제안: 인라인 주석으로 의도 명시. 예: `// 구체 타입은 신규 응답, Record<string, unknown>는 기존 응답 형태와의 호환`.

---

**[INFO]** 코멘트 언어 혼용
- 위치: `integration-oauth.service.ts` — `handleInstall` JSDoc(영문) 바로 아래 인라인 주석(한국어)
- 상세: 파일 내 영어/한국어 코멘트가 혼재해 있다. 프로젝트 내 다른 파일들도 혼용하므로 규약 위반은 아니나, Cafe24-전용 경로에만 한국어가 등장하는 패턴이 다소 일관성이 없다.
- 제안: 언급만. 프로젝트 전체 코멘트 언어 규약 결정 시 일괄 정리 권장.

---

### 요약

SQL 마이그레이션의 상세 배경 설명, 서비스 메서드의 spec 섹션 교차 참조, i18n 문자열의 한/영 완비 등 전반적인 문서화 품질은 높다. 주요 위험 요소는 프로덕션 코드와 테스트 명칭에 남아 있는 `변경 N` 마커·review 아티팩트 경로·plan 파일 경로로, 이것들은 PR 머지 후 빠르게 썩어 미래 독자를 오도할 수 있다. `spec/data-flow/integration.md` 경로는 실제 존재 여부를 확인해 교정이 필요하다.

### 위험도

**LOW** (기능 동작에는 영향 없음. 대부분 post-merge 코멘트 정리 항목)