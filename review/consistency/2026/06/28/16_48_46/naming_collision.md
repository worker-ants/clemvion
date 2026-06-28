# 신규 식별자 충돌 검토 결과

검토 모드: `--impl-prep`
대상 구현 범위: autoRefresh attention 술어 제외 구현 (frontend `needsAttention` 가드 + backend `findAll` expiring/attention 쿼리에 `supportsTokenAutoRefresh` service_type 제외) + subLabel `'next in'` 문구 spec §4.1 정합
대상 spec: `spec/2-navigation/4-integration.md` §2.3/§2.4/§4.1/§9.1/§11.4

---

## 발견사항

### [WARNING] subLabel 문구: `'in'` vs spec 정의 `'next in'`

- **target 신규 식별자**: spec §4.1 이 정의하는 보조 라벨 문구 `Auto-renews · next in <duration>`
- **기존 사용처**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` 라인 92: `` `Auto-renews · in ${humanizeUntil(...)}` ``
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` 라인 89, 121 (주석): `"Auto-renews · in <duration>"` 형식으로 기록
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/[id]/page.tsx` 라인 372 (주석): `` `Auto-renews · in <duration>` `` 로 기록
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/lib/i18n/dict/en/integrations.ts` 라인 83: `"Auto-renews · in {{duration}}"`
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/lib/i18n/dict/ko/integrations.ts` 라인 81: `"자동 갱신 · {{duration}} 후 만료"` (한국어는 별도 의미 구조)
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` 라인 158: `toMatch(/Auto-renews/i)` (느슨한 매칭)
  - 동 테스트 파일 라인 204 주석: `` `Auto-renews · in <duration>` `` 형식으로 기록
- **상세**: spec §4.1 헤더 정책은 보조 라벨을 `Auto-renews · next in <duration>` (예: `Auto-renews · next in 1h 24m`) 로 명시한다. 구현 코드는 `next` 단어가 빠진 `Auto-renews · in <duration>` 을 사용하고 있다. i18n 영문 키(`tokenExpiresAuto`)도 `"Auto-renews · in {{duration}}"` 이며, 주석·테스트 주석도 모두 `in` 만 사용한다. 구현 시 이 불일치를 수정해야 한다. 테스트는 `/Auto-renews/i` 만 검사하므로 `next in` 으로 변경해도 현재 테스트는 통과하나, 주석과 i18n 값도 함께 갱신하지 않으면 나중에 다시 불일치가 생긴다.
- **제안**:
  - `status-badge.tsx` 라인 92: `` `Auto-renews · next in ${humanizeUntil(...)}` `` 로 수정
  - `en/integrations.ts` 의 `tokenExpiresAuto` 값: `"Auto-renews · next in {{duration}}"` 로 수정
  - `status-badge.tsx` 라인 89/121 주석 및 `page.tsx` 라인 372 주석: `"next in"` 으로 일치시킴
  - 테스트 라인 204 주석도 업데이트 (기능 테스트 통과엔 영향 없음, 문서 품질)

---

### [INFO] `needsAttention` 함수 - autoRefresh 가드 미적용 (TODO 존재, 구현 대상)

- **target 신규 식별자**: spec §2.4/§11.4 가 요구하는 `autoRefresh=true` 통합의 만료 임박 분기 제외 술어
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` 라인 148-161 `needsAttention()` 함수 — 현재 `autoRefresh` 미검사; 라인 149-157 에 `// TODO(autoRefresh 가드)` 주석이 명시되어 있고 이번 PR 이 정식 처리 지점임을 선언
- **상세**: 이미 계획된 변경 대상이라 식별자 충돌이 아니다. 함수 이름 `needsAttention` 자체는 기존 코드베이스에 유일하게 정의되어 있고 구현 영역에서 다른 의미로 사용된 사례가 없다 (`integration-selector.tsx` 의 i18n 키 `nodeConfigs.integrationSelector.needsAttention` 은 별도 네임스페이스). 단, 구현 시 `needsAttention` 의 조건 변경이 `computeAttentionBreakdown` 을 사용하는 테스트(라인 299-366)에도 자동 전파되므로, autoRefresh=true + expiring 행이 기존 테스트의 fixture 에 포함되어 있으면 카운트가 달라질 수 있다. 현재 테스트 fixture 에는 `autoRefresh` 필드가 명시되지 않아 기본값(`false` 또는 `undefined → falsy`)으로 취급되므로 기존 테스트 결과에는 영향 없다.
- **제안**: 별도 식별자 충돌 없음. 구현 대상 그대로 진행.

---

### [INFO] `findAll` 백엔드 쿼리 - `expiring`/`attention` 가상 필터에 `autoRefresh` 제외 미적용 (구현 대상)

- **target 신규 식별자**: spec §9.1 이 요구하는 `expiring`/`attention` 가상 필터에서 `integration.autoRefresh=true` 행 제외 (`AND NOT integration.autoRefresh` 조건)
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/integrations.service.ts` 라인 493-513 (`findAll` 의 `status === 'expiring'` / `status === 'attention'` 분기) — 현재 `supportsTokenAutoRefresh` JOIN 또는 service_type 조건 미적용
- **상세**: 기존 `expiring` 분기(라인 493-497)와 `attention` 분기(라인 502-513)에 `NOT integration.autoRefresh` 에 해당하는 SQL 조건이 없다. 구현 시 service registry 의 `supportsTokenAutoRefresh` 정보를 SQL 로 반영하는 방법 선택이 필요하다 (service_type IN ('cafe24','google','makeshop') 하드코딩 vs subquery/join). spec §9.1 은 "백엔드 service registry 의 `ServiceDefinition.supportsTokenAutoRefresh` 에서 파생" 이라고만 명시하고 SQL 표현을 지정하지 않으므로, 구현자가 선택할 수 있다. 식별자 충돌은 없으며, 기존 `EXPIRING_SOON_INTERVAL` 상수명(`integrations.service.ts` 라인 488)과 신규 조건은 공존 가능하다.
- **제안**: 별도 식별자 충돌 없음. SQL 조건 추가 방식은 구현자 재량 (하드코딩이 가장 단순하지만 service_type 추가 시 수동 동기 필요 — spec 의 derived 필드 원칙과 일치하려면 registry 기반 IN 절 생성이 바람직).

---

### [INFO] `supportsTokenAutoRefresh` 필드명 — 기존 사용처와 일관성 확인

- **target 신규 식별자**: 구현에서 `supportsTokenAutoRefresh` 속성을 쿼리 빌더 조건으로 사용
- **기존 사용처**: `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/backend/src/modules/integrations/services/service-registry.ts` 라인 74, 387, 662, 676 — `ServiceDefinition.supportsTokenAutoRefresh?: boolean` 으로 이미 정의됨. `integrations.service.ts` 라인 1363-1364 에서 `findService(entity.serviceType)?.supportsTokenAutoRefresh` 로 참조 중. `service-registry.spec.ts` 라인 116 에서 makeshop 에 대한 값 검증도 기존 테스트에 포함됨.
- **상세**: 필드명 자체가 이미 코드베이스에 정착되어 있고 다른 의미로 사용된 사례 없음. 신규 구현에서 동일 이름을 참조하는 것은 충돌이 아니라 올바른 재사용.
- **제안**: 변경 불필요.

---

## 요약

본 구현 범위(autoRefresh attention 술어 제외 + subLabel 'next in' 정합)에서 도입되는 신규 식별자는 없다. 기존 식별자를 활용하거나 기존 코드를 수정하는 범위이며, 이름 충돌은 발견되지 않았다. 단 하나의 실질적 주의 사항은 spec §4.1 이 명시하는 `'Auto-renews · next in <duration>'` 문구와 현재 코드의 `'Auto-renews · in <duration>'` 사이의 불일치로, 이 차이가 이번 PR 의 구현 범위(subLabel 문구 정합)에 해당하므로 수정이 필요하다. i18n 키(`tokenExpiresAuto` EN 값)·코드 내 문자열 리터럴·주석 세 곳을 일괄 수정해야 한다.

## 위험도

LOW
