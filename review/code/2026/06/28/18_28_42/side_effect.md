# 부작용(Side Effect) 리뷰 결과

리뷰 대상: autoRefresh attention 술어 구현 (4개 코드 파일 + 문서 2개)
Diff base: origin/main

---

## 발견사항

### [INFO] `SERVICE_REGISTRY` 모듈-레벨 상수 — 읽기 전용 참조, 부작용 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L499–L501
- 상세: `SERVICE_REGISTRY`는 모듈-레벨에서 export된 상수 배열이다. `findAll` 메서드 내부에서 `.filter().map()` 체이닝으로 읽기만 하며, 배열 자체를 변경하지 않는다. 지역 변수 `autoRefreshServiceTypes`에 새 배열로 파생하므로 원본 상태에 영향 없다. 전역 상태 변경 없음.
- 제안: 없음.

### [INFO] `excludeAutoRefresh` 클로저 — 의도된 캡처, 누출 없음
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L515–L519
- 상세: `excludeAutoRefresh`는 외부 스코프의 `hasAutoRefreshTypes`, `AUTO_REFRESH_NOT_IN`, `autoRefreshParams`를 캡처하는 지역 클로저다. `findAll` 호출 단위로 생성·소멸되고, `qb`(TypeORM QueryBuilder) 인스턴스에 `andWhere`를 추가하는 것이 유일한 부작용이다. 이는 `qb`가 당 요청 범위 내 임시 객체이므로 공유 상태 변경이 아니다. 클로저가 모듈/서비스 클래스 수준 상태를 변경하지 않는다.
- 제안: 없음.

### [INFO] `autoRefreshParams` 객체 공유 — 불변 사용 확인
- 위치: `codebase/backend/src/modules/integrations/integrations.service.ts` L508, L517, L550
- 상세: `autoRefreshParams` 객체가 `excludeAutoRefresh` 헬퍼(expiring 분기)와 attention 인라인 경로(L550) 양쪽에서 동일 참조로 전달된다. TypeORM `andWhere`는 파라미터 객체를 내부적으로 읽기만 하고 수정하지 않으므로 공유에 따른 부작용은 없다. `status` 값에 따라 두 경로 중 하나만 실행되므로 동시 변경 충돌도 없다.
- 제안: 없음.

### [INFO] `needsAttention` 함수 시그니처 — 변경 없음, 동작만 변경
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/status-badge.tsx` L376–L398
- 상세: 함수 시그니처 `(integration: IntegrationDto): boolean`은 그대로다. 내부 구현이 `isExpiringSoon(tokenExpiresAt)` 단독 조건에서 `isExpiringSoon(tokenExpiresAt) && !integration.autoRefresh` 복합 조건으로 변경됐다. 기존 `connected` 분기 호출자는 `autoRefresh=true`인 경우에만 `false`를 새로 반환받는다 — 이전에는 `true`를 반환했던 경우다. 이 의미 변화는 의도된 스펙 구현(TODO 주석 해소)이며 기존 호출자(사이드바 카운트 등)에게 전파된다. 시그니처 자체는 unchanged이므로 컴파일 오류는 없으나, 동작 변경을 인지해야 한다.
- 제안: 없음 — 의도된 동작 변경이고 관련 테스트가 신규 추가됐다.

### [INFO] `computeAttentionBreakdown` 테스트 픽스처 — `autoRefresh: false` 명시 추가
- 위치: `codebase/frontend/src/app/(main)/integrations/_shared/__tests__/status-badge.test.tsx` (기존 테스트 케이스 수정)
- 상세: 기존 테스트 케이스의 `row()` 호출에 `autoRefresh: false`가 명시적으로 추가됐다. 이는 테스트 상태 변경이 아니라 테스트 픽스처 명확화다. `row()` 헬퍼가 기본값으로 `autoRefresh: undefined` 또는 `false`를 반환했다면 기존 동작과 동일하다. 테스트 격리에 영향 없음.
- 제안: 없음.

### [INFO] 문서 파일(`.mdx`) 수정 — 런타임 부작용 없음
- 위치:
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.en.mdx`
  - `/Volumes/project/private/clemvion/.claude/worktrees/autorefresh-attention-65b750/codebase/frontend/src/content/docs/06-integrations-and-config/integration-management.mdx`
- 상세: Callout 텍스트 수정이며, 런타임 상태/API/컴포넌트 동작에 아무 영향 없다. 정적 콘텐츠 파일 변경이다.
- 제안: 없음.

### [INFO] 이전 리뷰 세션 산출물(`review/code/2026/06/28/17_04_07/`) — 파일시스템 추가, 기존 파일 미수정
- 위치: `review/code/2026/06/28/17_04_07/` 하위 다수 파일
- 상세: 모두 새 파일(new file mode)이며 기존 파일을 덮어쓰거나 삭제하지 않는다. CLAUDE.md 규약(`review/code/<YYYY>/<MM>/<DD>/...`)에 따른 의도된 산출물 저장이다.
- 제안: 없음.

---

## 요약

이번 변경의 핵심 코드 부분(파일 1–4)은 부작용 관점에서 전반적으로 안전하다. `SERVICE_REGISTRY`는 읽기 전용으로만 접근되고, `autoRefreshServiceTypes`·`autoRefreshParams`·`excludeAutoRefresh`는 모두 요청-스코프 지역 변수/클로저로 전역 상태를 변경하지 않는다. `needsAttention` 함수의 시그니처는 변경되지 않았으나 동작이 변경되어(`autoRefresh=true`인 connected 행이 false 반환) 기존 호출자에게 의미 변화가 전파되는 것은 의도된 스펙 구현이다. 환경 변수 읽기/쓰기, 네트워크 호출, 이벤트/콜백 변경은 이번 diff에 존재하지 않는다. 파일시스템 부작용은 `review/` 디렉토리에 새 파일을 추가하는 것뿐이며 규약에 따른 의도된 변경이다.

---

## 위험도

NONE
