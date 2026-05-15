## 아키텍처 코드 리뷰 — F-2 buttons[*].id 자동 부여

---

### 발견사항

- **[WARNING]** `BUTTON_NODE_TYPES` Set 이 두 파일에 독립 정의됨
  - 위치: `button-slug.util.ts:163`, `migrate-button-ids.ts:42`
  - 상세: 마이그레이션 스크립트가 `isButtonNodeType`을 import하지 않고 동일한 `new Set(['carousel', 'chart', 'table', 'template'])`을 재선언한다. 향후 노드 타입이 추가될 때 두 곳을 동시에 수정해야 하며 한쪽이 누락될 위험이 있다.
  - 제안: 마이그레이션 스크립트가 `backend/src/nodes/core/button-slug.util`의 `isButtonNodeType`을 import하거나, 또는 `BUTTON_NODE_TYPES`를 export해서 공유.

- **[WARNING]** `isValidExistingId` · `PORT_ID_SLUG_REGEX` · 3개 interface 중복 정의
  - 위치: `button-slug.util.ts:38–43`, `migrate-button-ids.ts:44–50` 및 `ButtonLike` / `NodeConfigLike` / `CarouselItemLike`
  - 상세: 마이그레이션 스크립트는 실행 환경의 독립성을 위해 의도적으로 분리한 것으로 보이나, slug 유효성 판단 로직이 두 벌 존재하면 regex 변경 시 한쪽만 반영되는 drift가 발생할 수 있다. 특히 `PORT_ID_SLUG_REGEX` 범위 차이(스크립트: inline, util: `port-id.util` import)는 이미 미묘한 불일치 지점이다.
  - 제안: 마이그레이션이 일회성 스크립트임을 감안하더라도 최소한 `PORT_ID_SLUG_REGEX`와 `isValidExistingId`는 공유 util에서 import. 인터페이스는 스크립트 내부 전용으로 유지 허용.

- **[WARNING]** 마이그레이션 backfill과 프로덕션 정규화의 시맨틱 분기
  - 위치: `migrate-button-ids.ts:backfillButtonIds`, `button-slug.util.ts:normalizeNodeButtonIds`
  - 상세: 마이그레이션은 순수 index fallback(`btn_0`)만 부여하고, 프로덕션은 label-slug 우선 → fallback 순이다. 이 차이는 의도적(기존 edge 보호)이지만 코드에 명시적 주석이 있음에도 "같은 이름의 다른 동작"이 두 벌 존재하는 구조는 향후 기여자에게 혼란을 준다. 마이그레이션의 `backfillButtonIds`가 `normalizeNodeButtonIds`를 내부적으로 호출하지 않는 이유가 도메인 계약으로 문서화되어야 한다.
  - 제안: `migrate-button-ids.ts` 상단 주석에 "label-slug가 아닌 index fallback을 사용하는 이유 — 기존 resolver 패턴(`btn_0`)과 일치시켜 live edge를 보존해야 하기 때문" 을 명시. (현재 주석은 배경을 설명하지만 이 동작 차이 자체는 빠져 있음)

- **[INFO]** 테스트 파일 경로 불일치
  - 위치: 스크립트 `backend/scripts/migrate-button-ids.ts`, 테스트 `backend/src/scripts/migrate-button-ids.spec.ts`
  - 상세: 소스는 `src/` 바깥의 `scripts/`에 있고 테스트는 `src/scripts/` 안에 있다. 상대 경로(`../../scripts/...`) import가 현재는 동작하나, Jest `rootDir` / `tsconfig paths` 설정 변경 시 깨질 수 있다. 테스트가 `src/` 안에 있으면 `tsconfig.json`의 include 범위에 스크립트 자체도 포함돼야 한다는 암묵적 전제가 생긴다.
  - 제안: 테스트를 `backend/scripts/migrate-button-ids.spec.ts`로 이동해 소스-테스트 위치를 일치시킴.

- **[INFO]** `backfillButtonIds`의 mutable accumulator 파라미터 패턴
  - 위치: `migrate-button-ids.ts:83`
  - 상세: `hits: BackfillHit[]`를 외부에서 주입받아 push하는 패턴은 C 스타일의 출력 파라미터로, TypeScript에서는 `{ config, hits }` 반환이 더 관용적이다. 현재 구조는 `main()`에서 단일 hits 배열을 누적하기 위한 것으로 이해되나, 순수 함수임을 단위 테스트로 검증하는 spec(파일6)과 조합할 때 호출자가 항상 빈 배열을 준비해야 하는 인지 부담이 있다.
  - 제안: 마이그레이션 스크립트 범위 안에서는 허용 가능한 선택. 단, 미래에 재사용 범위가 늘어나면 반환값 방식으로 리팩터링 권장.

- **[INFO]** `shadow-workflow.ts`의 정규화 책임 추가
  - 위치: `shadow-workflow.ts:403–408`, `549–555`
  - 상세: ShadowWorkflow는 원래 in-memory 상태 관리 + 검증 레이어였다. `normalizeNodeButtonIds` 호출 추가로 "config 변환" 책임이 함께 들어왔다. 현재는 위임(delegation)으로 처리되어 결합도는 낮지만, 향후 정규화 규칙이 다양해지면(e.g. 다른 필드 자동 보완) ShadowWorkflow가 점진적으로 비대해질 수 있다.
  - 제안: 허용 가능한 수준. 단, 변환 훅을 `(type, config) => config` 형태의 주입 가능한 pipeline으로 추상화하면 테스트 격리와 확장성이 개선된다. 현재 규모에서는 오버엔지니어링이므로 메모로만 남김.

---

### 요약

전체적인 아키텍처는 양호하다. `button-slug.util.ts`는 순수 함수 모듈로 응집도가 높고 `shadow-workflow.ts`와의 통합도 최소한의 호출 지점(add_node / update_node 각 1개)으로 깔끔하게 연결되어 있다. 주요 위험은 **마이그레이션 스크립트와 프로덕션 유틸 사이의 `BUTTON_NODE_TYPES` · `isValidExistingId` 이중 정의**이며, 두 벌의 판단 로직이 독립적으로 유지되다 일치가 깨질 경우 마이그레이션 재실행 시나리오나 타입 확장 시 조용한 버그를 낳을 수 있다. 이 부분을 제외하면 레이어 분리(util → shadow → spec), 불변성 패턴(ensureCopy), 테스트 커버리지 모두 설계 의도에 부합한다.

### 위험도

**LOW**