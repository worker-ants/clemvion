## 유지보수성 코드 리뷰

### 발견사항

---

**[WARNING] `isValidExistingId` · `PORT_ID_SLUG_REGEX` 이중 정의**
- 위치: `migrate-button-ids.ts:62` + `button-slug.util.ts:42~48`
- 상세: 마이그레이션 스크립트가 `PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/`와 `isValidExistingId` 함수를 독립적으로 정의하고 있다. `button-slug.util.ts`는 `port-id.util`에서 import해서 쓰는데 스크립트는 직접 리터럴로 복사했다. 추후 검증 조건(예: 길이 상한 변경)이 생기면 두 곳을 동시에 수정해야 한다.
- 제안: 마이그레이션 스크립트도 `button-slug.util.ts`에서 `isValidExistingId`를 export하거나, 공용 `port-id.util`에서 직접 import하도록 통일.

---

**[WARNING] `backfillButtonIds`의 `changed` 플래그 이중 용도**
- 위치: `migrate-button-ids.ts:104~162`
- 상세: `buttons` 섹션에서는 `changed` (외부 공유 변수)를 map 클로저 내부에서 직접 설정하고, 바로 아래 `if (changed) ensureCopy().buttons = newButtons`에서 읽는다. 반면 `itemButtons`는 `itemBtnChanged`라는 별도 플래그를, `items`는 `itemsChanged`를 각각 쓴 뒤 마지막에 `changed = true`로 합산한다. `changed`가 "buttons 섹션 변경 여부"와 "전체 변경 여부" 두 의미를 동시에 가지게 되어 초기값·초기화 순서를 잘못 이해하면 버그로 이어진다.
- 제안: `buttons` 섹션에도 `buttonsSectionChanged` 같은 지역 플래그를 분리하고, 최종적으로 `changed = true`로 합산하는 패턴을 세 섹션 모두에 통일.

---

**[WARNING] 3-위치 버튼 순회 로직 이중 구현**
- 위치: `migrate-button-ids.ts:backfillButtonIds` / `button-slug.util.ts:normalizeNodeButtonIds`
- 상세: 두 함수 모두 `config.buttons`, `config.itemButtons`, `config.items[*].buttons` 세 위치를 순회하며 copy-on-write 패턴을 적용한다. 핵심 차이는 fallback ID 생성 전략뿐(`btn_${i}` vs label-slug)인데, 나머지 구조가 거의 동일하다. 새 버튼 위치(예: `config.footerButtons`)가 추가될 때 두 곳을 동시에 수정해야 하며, 한 곳만 반영될 위험이 있다.
- 제안: 공통 순회 로직을 별도 헬퍼(예: `forEachButtonLocation`)로 추출하고, 두 함수가 ID 결정 전략만 콜백으로 주입하도록 리팩토링 고려. 단, 마이그레이션 스크립트가 외부 의존성을 최소화하는 정책이라면 현 구조 유지 후 주석으로 동기화 의무를 명시하는 것도 대안.

---

**[WARNING] `uniqueSlug` 64자 경계 시 중복 가능**
- 위치: `button-slug.util.ts:37~41`
- 상세: `base`가 정확히 64자일 때 `"${base}-2"`는 67자이고, `.slice(0, 64)`하면 접미사가 완전히 잘려 `base`와 동일한 문자열이 반환된다. `taken`에 이미 있는 값이 다시 반환되는 셈이다. 현재 테스트(`충돌 후 길이가 64자 넘으면 절단`)는 길이만 검증하고 uniqueness는 검증하지 않는다.
- 제안: 접미사 추가 전에 base를 미리 잘라 여유 공간 확보: `const trimmedBase = base.slice(0, 64 - String(n).length - 1)`. 또는 64자 도달 시 fallback UUID fragment 사용. 테스트에 `expect(result).not.toBe(long)` 검증 추가 필요.

---

**[INFO] 마이그레이션 스크립트의 익명 블록(anonymous block)**
- 위치: `migrate-button-ids.ts:37~44`
- 상세: `{ const envPath = ...; dotenv.config(...); }` 형태의 익명 블록은 스코프를 격리하지만 JS/TS에서 관용적인 패턴이 아니다. 처음 보는 개발자는 용도를 한 번 더 생각해야 한다.
- 제안: `loadEnv()` 같은 이름의 함수로 추출하거나, 단순히 변수 선언 없이 `dotenv.config({ path: ... })` 한 줄로 줄이고 오류를 인라인으로 처리.

---

**[INFO] 테스트의 반복적인 타입 캐스팅**
- 위치: `shadow-workflow.spec.ts` F-2 describe 블록 전체
- 상세: `(added?.config as { buttons: Array<{ id: string }> }).buttons.map((b) => b.id)` 패턴이 8개 테스트에 걸쳐 반복된다. 가독성보다는 양이 많아 노이즈처럼 보이고, 타입 형태가 바뀌면 여러 곳을 수정해야 한다.
- 제안: 테스트 파일 상단에 `function getButtonIds(node: ShadowNode | undefined): string[]` 헬퍼 추가.

---

### 요약

전반적으로 구조 분리(util / shadow / 마이그레이션 스크립트)와 copy-on-write 불변성 보장이 잘 되어 있으며, 테스트 커버리지도 충실하다. 주된 유지보수 부담은 `isValidExistingId`·`PORT_ID_SLUG_REGEX`의 이중 정의와 3-위치 순회 로직의 중복으로, 향후 정책 변경 시 두 파일을 동기화해야 한다는 점이다. `uniqueSlug`의 64자 경계 버그는 실제 발생 가능성은 낮지만 테스트가 그것을 잡지 못하고 있어 잠재 위험으로 남는다. `changed` 플래그의 이중 용도는 독립된 섹션 패턴으로 통일하면 쉽게 해소된다.

### 위험도

**LOW**