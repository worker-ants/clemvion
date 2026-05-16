# 유지보수성(Maintainability) 리뷰

## 발견사항

---

### 파일 1: `backend/src/modules/integrations/dto/integration.dto.ts`

- **[INFO]** 상수 블록 위 주석이 가상 필터값의 의미를 충분히 설명하고 있어 가독성이 우수함
  - 위치: +35~+41 (6줄 블록 주석)
  - 상세: `expiring` 과 `attention` 두 값의 "DB enum 에 없음"이라는 점, 스펙 참조, 합집합 의미까지 한 곳에 명시되어 있다. 신규 기여자가 `INTEGRATION_STATUSES` 만 봐도 맥락을 파악할 수 있다.
  - 제안: 현행 유지.

- **[INFO]** Swagger `description` 문자열이 과도하게 길어졌으나 허용 가능한 수준
  - 위치: +55 (`description` 속성 한 줄)
  - 상세: API 문서 소비자에게 정보를 주는 목적이므로 길이 자체는 문제가 없으나, 문장이 한 줄에 몰려 있어 diff 가독성이 떨어진다. 멀티라인 템플릿 리터럴로 분리하면 `git blame` 추적이 쉬워진다.
  - 제안:
    ```ts
    description: [
      '통합 상태 필터.',
      'connected=정상, expiring=만료 임박(가상), expired=만료, error=오류,',
      'attention=주의 필요(가상 — expired ∪ expiring ∪ error).',
      'expiring/attention 은 DB Enum 에 없는 가상 필터값으로',
      '서버에서 합집합 WHERE 절로 변환된다 (spec §9.1).',
    ].join(' '),
    ```

---

### 파일 2: `backend/src/modules/integrations/integrations.service.spec.ts`

- **[INFO]** 세 개의 `status=attention` 테스트가 동일한 `qb` 셋업 보일러플레이트를 반복
  - 위치: +82~+115 (`it` 블록 3개의 첫 3줄씩)
  - 상세: `makeQueryBuilder({ count: 0, many: [] })` / `integrationRepo.createQueryBuilder.mockReturnValue(qb)` / `await service.findAll('ws-1', { status: 'attention' })` 세 줄이 세 테스트에서 그대로 반복된다. 현재는 양이 많지 않아 무방하지만, 향후 attention 관련 테스트가 추가될 때 일관성 유지가 어려워질 수 있다.
  - 제안: `describe` 레벨의 `beforeEach` 나 헬퍼 함수 `setupAttentionQb()` 로 추출하면 중복 제거 가능. 단, 명확성(각 테스트가 자기 셋업을 갖는 것)을 선호하는 팀 컨벤션이 있다면 현행 유지도 합리적.

- **[INFO]** 테스트 설명 문자열이 충분히 구체적이고 스펙 참조를 포함해 의도가 명확함
  - 위치: +86, +99, +107
  - 상세: 각 `it` 설명이 "어떤 조건에서 어떤 SQL 구조가 나와야 하는가"를 명확히 기술하고 있으며, 블록 주석이 스펙 섹션까지 연결한다. 좋은 패턴.
  - 제안: 현행 유지.

---

### 파일 3: `backend/src/modules/integrations/integrations.service.ts`

- **[WARNING]** SQL 인라인 리터럴에 7일 매직 넘버가 하드코딩됨
  - 위치: +148 (`INTERVAL '7 days'`)
  - 상세: `7 days` 는 "만료 임박" 기준값으로, 프론트엔드 `status-badge.tsx` 의 `needsAttention` 함수와도 공유되는 도메인 상수다. 현재 백엔드 SQL과 프론트엔드 계산이 각각 독립적으로 하드코딩되어 있어, 향후 임박 기준을 변경할 때 두 곳을 동시에 수정해야 하는 숨겨진 결합이 존재한다. 백엔드에서만이라도 상수화하면 리뷰어가 값의 의미를 즉시 파악할 수 있다.
  - 제안:
    ```ts
    // integrations.service.ts 상단 또는 상수 파일로 추출
    const EXPIRING_SOON_DAYS = 7; // spec §2.3 "만료 임박" 기준

    // 사용 시
    `... AND i.token_expires_at <= NOW() + INTERVAL '${EXPIRING_SOON_DAYS} days'`
    ```
    단, TypeORM QueryBuilder 에서 파라미터 바인딩이 더 안전하다면 그 방식 우선.

- **[INFO]** `else if` 체인으로 단순하게 구성되어 있어 가독성 양호
  - 위치: +138~+150
  - 상세: 분기 구조 자체는 직관적이며 중첩이 얕다. `attention` 분기 내 SQL 자체가 복합 조건이지만 블록 주석이 의미를 보충한다.
  - 제안: 현행 유지.

---

### 파일 4: `frontend/src/app/(main)/integrations/__tests__/integrations-page.test.tsx`

- **[WARNING]** `attentionRow` 팩토리 함수 내 매직 넘버 및 날짜 계산식이 노출됨
  - 위치: +217~+219
  - 상세: `2 * 24 * 60 * 60 * 1000` 은 "2일 후" 를 의미하는데, 이 패턴이 `status-badge.test.tsx`(+348)에서도 `inDays` 헬퍼로 한 번 더 독립적으로 구현된다. 두 테스트 파일이 동일한 날짜 오프셋 계산을 각자 가지고 있다.
  - 제안: 공유 테스트 유틸 파일(예: `__tests__/helpers/date.ts`)에 `addDays(n: number): string` 을 두고 양쪽에서 참조하면 변경 시 단일 수정으로 해결된다.

- **[INFO]** `attentionRow` 팩토리 함수의 기본값이 충분히 명확함
  - 위치: +183~+205
  - 상세: 각 필드가 무엇인지 쉽게 추론할 수 있고, `overrides` 패턴으로 확장성도 갖추고 있다.
  - 제안: 현행 유지.

- **[INFO]** `lastPush ?? lastReplace ?? ""` 방어 패턴이 다소 불명확
  - 위치: +269
  - 상세: 단일 행 테스트에서 `push` 와 `replace` 중 어느 것이 호출되는지를 코드 주석(+265~+267)으로 설명하고 있으나, 두 fallback 체인은 "어느 것이 호출되어도 된다"는 의도를 암시한다. 실제로는 `push` 를 기대한다고 명시하는 게 테스트 의도에 더 충실하다.
  - 제안: `push` 를 명시적으로 assert 하고 `replace` 는 별도 확인하는 방식으로 분리. 단, 구현이 이미 어느 쪽이든 동작하게 되어 있다면 현행도 수용 가능.

---

### 파일 5: `frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx`

- **[INFO]** `inDays` 헬퍼가 테스트 파일 내부에 인라인 정의됨 (중복 관련 — 파일 4 항목 참조)
  - 위치: +348~+349
  - 상세: 파일 4 의 page test 에서도 동일 계산을 반복 구현. 중복 코드 이슈.
  - 제안: 파일 4 항목의 제안과 동일.

- **[INFO]** `"agrees with needsAttention's single-row predicate"` 테스트가 두 함수 간 계약을 검증하는 통합성이 좋은 테스트임
  - 위치: +395~+403
  - 상세: `computeAttentionBreakdown` 과 `needsAttention` 이 일관된 결과를 내는지를 직접 비교하는 방식으로 단일 진실 원칙 준수를 보장한다.
  - 제안: 현행 유지.

---

### 파일 6: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx`

- **[INFO]** `rank` 값(1, 2, 3)이 매직 넘버로 사용됨
  - 위치: +456, +460, +463
  - 상세: `rank = 3` / `rank = 2` / `rank = 1` 의 의미("우선순위: error > expired > expiring")가 변수 자체에서 드러나지 않는다. 현재는 인라인 주석이 없고, JSDoc 의 `mostUrgentId` 설명에만 우선순위 순서가 언급된다.
  - 제안:
    ```ts
    const ATTENTION_RANK = { error: 3, expired: 2, expiring: 1 } as const;
    // 사용 시
    rank = ATTENTION_RANK.error;
    ```
    이렇게 하면 나중에 우선순위 순서 변경 시 한 곳만 수정하면 된다.

- **[INFO]** `computeAttentionBreakdown` 함수가 단일 책임을 잘 유지하고 있으며 길이도 적절함
  - 위치: +445~+480
  - 상세: 카운팅, 우선순위 추적, 반환 객체 조립의 세 단계가 단일 루프에 깔끔하게 통합되어 있다. `needsAttention()` 재사용으로 단일 진실 원칙도 지킨다.
  - 제안: 현행 유지.

- **[INFO]** `AttentionBreakdown` 인터페이스의 JSDoc 가 `mostUrgentId` 의 "total === 1 이 아닐 때도 값이 있다"는 미묘한 의미를 잘 문서화함
  - 위치: +429~+437
  - 상세: 필드의 비직관적 동작(단일 행이 아닐 때도 null 이 아님)을 JSDoc 에서 명시하고 있어 혼동 가능성을 줄인다.
  - 제안: 현행 유지.

---

### 파일 7: `frontend/src/app/(main)/integrations/page.tsx`

- **[WARNING]** `AttentionBanner` 컴포넌트 내 Tailwind 클래스 문자열이 두 곳에서 중복 반복됨
  - 위치: +597~+608 (`className` 의 `hasError` 분기)
  - 상세: `border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200` 와 amber 대응 문자열이 버튼과 아이콘 두 곳에서 거의 동일한 패턴으로 반복된다. 색상 토큰을 하나의 객체로 추출하면 "error 색상 팔레트"를 수정할 때 한 곳만 변경하면 된다.
  - 제안:
    ```ts
    const tone = hasError
      ? {
          banner: "border-red-300 bg-red-50 text-red-900 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
          icon: "text-red-600 dark:text-red-400",
        }
      : {
          banner: "border-yellow-300 bg-yellow-50 text-yellow-900 hover:bg-yellow-100 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
          icon: "text-yellow-600 dark:text-yellow-400",
        };
    ```

- **[INFO]** `AttentionBanner` 를 `page.tsx` 파일 내부 함수로 정의한 것이 적절함
  - 위치: +574~+636
  - 상세: 이 컴포넌트는 `IntegrationsPage` 전용이며, 별도 파일로 분리하면 오히려 맥락 파악이 어려워진다. 파일 하단 위치도 페이지 컴포넌트가 먼저 읽히고 보조 컴포넌트는 뒤에 오는 자연스러운 순서다.
  - 제안: 현행 유지.

- **[INFO]** `onActivate` 콜백의 분기 로직이 호출부(`page.tsx`)에 있어 컴포넌트의 순수성을 잘 유지함
  - 위치: +552~+560
  - 상세: 스펙 주석 `// spec §2.4 — single row jumps to detail, multi-row applies the attention virtual filter.` 가 이 위치에 있는 이유를 설명한다. 컴포넌트가 라우팅 정책을 모르는 구조.
  - 제안: 현행 유지.

---

### 파일 8: `frontend/src/lib/api/integrations.ts`

- **[INFO]** 가상 필터값 주석의 위치가 타입 정의 바로 위에 있어 발견성이 좋음
  - 위치: +661~+664
  - 상세: `ListStatusFilter` 타입을 확인하는 개발자가 자연스럽게 주석을 마주친다.
  - 제안: 현행 유지.

---

### 파일 9 & 10: i18n dict (`en/integrations.ts`, `ko/integrations.ts`)

- **[WARNING]** `attentionBreakdownExpired`, `attentionBreakdownExpiring`, `attentionBreakdownError` 세 키가 플랫 구조에 반복적인 prefix 를 가짐
  - 위치: en +695~+697, ko +735~+737
  - 상세: 세 키가 `attentionBreakdown` + 상태명 패턴으로 3개가 병렬인데, `AttentionBreakdown.expired/expiring/error` 의 세 필드와 1:1 대응된다. 현재 i18n 구조 상 중첩 키를 지원하는지 여부에 따라 `attentionBreakdown.expired` 형태로 네임스페이스화 할 수도 있다. 단, 현재 flat dict 구조가 프로젝트 표준이라면 현행 유지.
  - 제안: 프로젝트 i18n 라이브러리가 nested key 를 지원한다면 `attentionBreakdown: { expired, expiring, error }` 로 구조화. 지원하지 않는다면 현행 유지.

- **[INFO]** 영/한 키 세트가 완전히 대칭을 이루고 있어 누락 위험이 없음
  - 위치: en +692~+699, ko +732~+739
  - 상세: 신규 키 6개와 삭제 키 3개가 양쪽 파일에서 동일하게 처리되어 있다.
  - 제안: 현행 유지.

---

### 파일 11: `plan/in-progress/integration-attention-filter.md`

- **[INFO]** plan 문서가 프론트매터 + 배경 + 설계안 + 체크리스트 + follow-up 섹션으로 잘 구조화되어 있음
  - 위치: 전체
  - 상세: 체크리스트의 각 항목에 담당 역할(`developer`, `developer in-skill`)이 명시되고, follow-up 항목은 범위 밖임을 명확히 표시한다. 문서 유지보수성이 높다.
  - 제안: 현행 유지.

---

## 요약

이번 변경은 `attention` 가상 필터값을 백엔드 DTO/서비스, 프론트엔드 타입/컴포넌트/i18n, 테스트까지 일관되게 도입하고 있으며 전반적인 코드 품질이 양호하다. 가장 중요한 유지보수성 위험은 두 가지다. 첫째, "만료 임박 7일" 기준이 백엔드 SQL과 프론트엔드 `needsAttention` 양쪽에 독립적으로 하드코딩되어 있어, 기준 변경 시 누락 가능성이 있다. 둘째, `AttentionBanner` 내 Tailwind 색상 클래스가 버튼과 아이콘 두 곳에서 반복된다. 그 외 중복 코드(`inDays` 날짜 헬퍼, `makeQueryBuilder` 보일러플레이트)와 매직 넘버(`rank` 상수)는 작은 개선 포인트이나 기능적 리스크는 낮다. 네이밍, 함수 길이, 중첩 깊이, 코드 복잡도는 모두 양호하며 기존 코드베이스 패턴도 잘 준수되고 있다.

## 위험도

LOW