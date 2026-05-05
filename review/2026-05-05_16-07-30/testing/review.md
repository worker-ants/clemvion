### 발견사항

---

**[WARNING] `uniqueSlug` 절단 로직이 충돌을 생산할 수 있음**
- 위치: `button-slug.util.ts:38-41`, 대응 테스트 `button-slug.util.spec.ts:46-49`
- 상세: `base`가 정확히 64자일 때, `result = base + '-2'` (67자) → `result.slice(0, 64) === base` → `base`는 이미 `taken`에 있으므로 중복 id 반환. 테스트는 `result.length <= 64`만 검증하고 결과가 `taken`에 없는지는 검증하지 않음. `labelToSlug`가 최대 64자 보장이므로 실제로 도달 가능한 코드 경로.
  ```typescript
  // 재현: base='a'.repeat(64), taken=Set{'a'.repeat(64)}
  // result.slice(0,64) === base === 이미 taken에 있는 값
  ```
- 제안: 테스트에 `expect(new Set([long]).has(result)).toBe(false)` 추가. 구현 수정 시 suffix 길이를 고려해 base를 미리 절단: `base.slice(0, 64 - suffix.length) + suffix`.

---

**[WARNING] `migrate-button-ids.ts`의 `main()` 전체 경로가 자동화 테스트 없음**
- 위치: `migrate-button-ids.ts:167-280`
- 상세: DB 연결·SQL 쿼리·트랜잭션·audit_log 삽입·dry-run 분기·에러 처리 코드가 자동화 테스트로 검증되지 않음. 마이그레이션은 비가역적 DB 변경이므로, "수동 staging dry-run" 만으로는 `!CLI_WORKSPACE_ID || !CLI_USER_ID` throw 조건, `DRY_RUN` 기본값 로직(`!process.argv.includes('--apply')`), DataSource 초기화 실패 케이스 등이 배포 전 자동 검증되지 않음.
- 제안: 최소한 `DRY_RUN` 로직과 `CLI` 플래그 파싱을 별도 함수로 추출해 단위 테스트 추가. `main()` 내부 DB 호출은 `DataSource`를 파라미터로 주입받는 함수로 분리하면 모킹 없이 인터페이스 계약을 검증 가능.

---

**[INFO] `isValidExistingId` 구현이 `migrate-button-ids.ts`와 `button-slug.util.ts`에 중복, 두 구현의 일치를 검증하는 테스트 없음**
- 위치: `migrate-button-ids.ts:~86`, `button-slug.util.ts:~44`
- 상세: 동일 로직(`PORT_ID_SLUG_REGEX` + trim + 길이 체크)이 두 곳에 복사돼 있음. `button-slug.util.ts`는 `PORT_ID_SLUG_REGEX`를 import하지만 `migrate-button-ids.ts`는 같은 정규식을 로컬 상수로 재선언함. 두 구현이 silent하게 분기될 수 있음.
- 제안: `migrate-button-ids.ts`에서 `isValidExistingId`를 `button-slug.util.ts`의 내부 함수를 export해 임포트하거나, 적어도 동일 정규식 상수를 공유.

---

**[INFO] F-2 shadow-workflow 통합 테스트가 `carousel` 타입만 검증, `chart`/`table`/`template` 미검증**
- 위치: `shadow-workflow.spec.ts` (F-2 describe 블록 전체)
- 상세: `isButtonNodeType`은 4개 타입 모두 `button-slug.util.spec.ts`에서 단위 테스트되지만, `ShadowWorkflow.addNode` + `updateNode` 내 `if (isButtonNodeType(type))` 분기는 `carousel`로만 커버됨. `chart`/`table`/`template`이 `knownNodeTypes`에 등록됐을 때의 통합 경로 미검증.
- 제안: `chart` 또는 `template` 타입으로 `add_node` → buttons 자동 부여 확인하는 테스트 1건 추가.

---

**[INFO] `update_node`의 `itemButtons`·`items[*].buttons` 패치 경로가 shadow-workflow 레벨에서 미검증**
- 위치: `shadow-workflow.spec.ts` F-2 블록, `shadow-workflow.ts:549-558`
- 상세: `add_node` 경로에서는 `carousel` + `itemButtons` + `items[*].buttons` 동시 정규화 테스트 존재. 하지만 `update_node`로 `patch.config.itemButtons`나 `patch.config.items[*].buttons`를 수정했을 때의 정규화는 shadow 레벨에서 테스트되지 않음.
- 제안: `update_node` 로 `itemButtons`에 새 entry 추가 후 id 부여 확인하는 케이스 추가.

---

**[INFO] `items` 배열에 `null` 요소 포함 시 동작 미검증**
- 위치: `button-slug.util.spec.ts`, `button-slug.util.ts:120`
- 상세: 구현은 `!item || typeof item !== 'object'` 로 방어하지만, `items: [null, { buttons: [{ label: 'X' }] }]` 케이스에 대한 테스트가 없음. `normalizeNodeButtonIds`가 `null` 요소가 포함된 배열에서 reference equality를 올바르게 처리하는지 미검증.
- 제안: `items: [null, { buttons: [{ label: 'X' }] }]` 케이스 추가해 `null` item은 그대로, 다음 item의 buttons는 slug 부여됨을 검증.

---

### 요약

전체적으로 테스트 설계가 체계적이다. `button-slug.util.spec.ts`는 핵심 pure function들을 폭넓게 커버하고, `migrate-button-ids.spec.ts`는 idempotency까지 명시적으로 검증하며, shadow-workflow F-2 테스트는 LLM 시나리오(id 보존, 충돌 해소, fallback)를 실사용 관점에서 잘 포착한다. 주요 리스크는 `uniqueSlug` 64자 경계에서 생산되는 충돌(테스트가 길이만 검증하고 uniqueness를 검증하지 않음)과, 비가역적 DB 변경을 수행하는 `main()` 함수가 자동화 테스트 밖에 있다는 점이다. 나머지 항목들은 커버리지 완성도의 문제로 치명적이지는 않다.

### 위험도

**MEDIUM** — `uniqueSlug` 64자 충돌 버그와 migration `main()` 미검증이 동시에 존재하나, 현실 시나리오(64자 slug 중복 라벨)는 드물고 migration은 staging 검증 절차가 명시적으로 기술됨.