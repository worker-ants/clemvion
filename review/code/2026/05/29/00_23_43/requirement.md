# 요구사항(Requirement) 리뷰 결과

## 리뷰 대상

- `codebase/frontend/src/app/(main)/triggers/__tests__/triggers-page.test.tsx`
- `codebase/frontend/src/app/(main)/triggers/page.tsx`
- `codebase/frontend/src/lib/i18n/dict/en/triggers.ts`
- `codebase/frontend/src/lib/i18n/dict/ko/triggers.ts`

---

## 발견사항

### [CRITICAL] 코드 주석이 잘못된 spec 참조 (R-15) 를 반복 사용
- 위치: `page.tsx` diff +542 (`{/* 인증 (AuthConfig) — Spec 2-trigger-list §2.1 + R-15 */}`), `en/triggers.ts` diff +603 (`// [Spec 2-trigger-list §2.1 + R-15] list auth column`), `ko/triggers.ts` diff +918 (`// [Spec 2-trigger-list §2.1 + R-15] 목록 인증 열`), 테스트 파일 diff +52 (`// [Spec 2-trigger-list §2.1 "인증" 요소 + R-15] 인증 열 + 무인증 webhook 경고`)
- 상세: `R-15` 는 `spec/6-brand.md` 의 워드마크 layout 개정 Rationale 번호다 (워드마크 단색·sub-copy 제거). `spec/2-navigation/2-trigger-list.md` 에는 R-15 라는 식별자 자체가 존재하지 않는다. 코드 전반에 걸쳐 잘못된 spec cross-reference 를 embed 하고 있어 코드를 읽는 사람이 spec 추적을 시도하면 브랜드 spec 으로 잘못 도달한다. spec 을 직접 수정할 권한은 reviewer 에게 없으므로 `project-planner` 위임이 필요하다.
- 제안: `project-planner` 에게 `spec/2-navigation/2-trigger-list.md §2.1` 에 Authentication 열 표시·무인증 경고 요구사항 ID(예: `NAV-TR-11`) 를 신설하고 코드 주석을 올바른 ID 로 교정하도록 위임. 단기적으로는 잘못된 `R-15` 참조를 제거하거나 정확한 spec 섹션 경로(§2.1 자체 + Rationale R-14) 만 남길 것.

### [WARNING] spec §2.1 테이블에 "인증" 열 요소가 명시되어 있지 않음 — spec gap
- 위치: `spec/2-navigation/2-trigger-list.md §2.1` 행 요소 테이블 (5행: 상태 아이콘, 트리거 이름, 유형 뱃지, 연결 워크플로우, 상세 정보, Schedule 태그, Chat Channel 칩/Health 배지, URL 복사 버튼, 더보기), `page.tsx` diff +534
- 상세: spec §2.1 의 행 요소 테이블에는 "인증" 또는 "Authentication" 열이 명시되어 있지 않다. R-14 (Rationale) 에서 `authConfigId` binding 이 v1 활성화된 것은 확인되지만, 그것은 drawer 의 `Auth Config` 카드 편집 맥락이다. 트리거 목록 테이블에 Authentication 열을 추가하고 무인증 webhook 경고를 표시하는 행위 명세는 spec 본문에 없다. 구현이 spec 보다 앞서 있는 상태다. spec gap 이므로 `project-planner` 위임이 필요하다. 현재 코드는 `page.tsx §2.1` 테이블에 4번째 `<th>` 로 "Authentication" 열을 추가했으나, spec 이 침묵하는 영역이다.
- 제안: `project-planner` 에게 `spec/2-navigation/2-trigger-list.md §2.1` 테이블에 인증 열 행 추가(열 표시 조건·무인증 경고·non-webhook 처리) 를 위임. spec 이 보강될 때까지 구현 자체가 의도한 방향으로 동작하고 있는지 확인해야 한다.

### [WARNING] authConfigId 로 조회한 AuthConfig 가 목록에 없는 경우 fallback 이 "Configured" 로 표시됨 — 의도 불명확
- 위치: `page.tsx` diff +553–561
  ```tsx
  const cfg = authConfigById.get(trigger.authConfigId);
  return (
    <span ...>
      {cfg
        ? t(AUTH_CONFIG_TYPE_LABEL_KEYS[cfg.type] ?? "authentication.typeApiKey")
        : t("triggers.authConfigured")}
    </span>
  );
  ```
- 상세: `trigger.authConfigId` 가 non-null 이지만 `useAuthConfigs()` 가 반환한 목록에서 해당 ID 를 찾지 못하는 경우(`cfg === undefined`) `"Configured"` (영) / `"설정됨"` (한) 라벨이 표시된다. 이 경우가 발생하는 시나리오는: (a) AuthConfig 가 삭제됐으나 trigger 의 `authConfigId` 가 여전히 참조하는 경우, (b) `/auth-configs` 응답이 페이지네이션·권한 범위로 일부만 반환하는 경우. "Configured" 라벨은 실제로 연결이 유효한지 알 수 없으므로 사용자에게 오해를 줄 수 있다. spec 에 이 fallback 동작이 명시되어 있지 않다.
- 제안: `cfg === undefined && trigger.authConfigId` 상태에 대해 (a) 보안 경고와 유사한 경고 표시(삭제된 AuthConfig 가능성), (b) `"Configured"` 대신 `"Unknown"` 또는 ID 앞 4자 마스킹 표시 등 명확한 UX 정책을 결정하고 spec 에 명시할 것.

### [WARNING] `authConfigId` 가 빈 문자열인 경우 webhook 으로 처리되면 경고가 표시됨 — 엣지케이스
- 위치: `page.tsx` diff +552 (`if (trigger.authConfigId) {`)
- 상세: `authConfigId` 의 타입은 `string | null | undefined` 이다. `t.authConfigId ?? null` 로 매핑할 때 API 가 빈 문자열 `""` 을 반환하면 `?? null` 을 우회해 `""` 이 전달되고, `if (trigger.authConfigId)` 체크에서 falsy 로 평가되어 무인증 경고가 표시된다. 실제 API 가 `""` 을 반환하지 않는다면 무해하지만, spec 이 이 경계값을 명시하지 않아 방어 코드가 없다.
- 제안: `if (trigger.authConfigId && trigger.authConfigId.length > 0)` 또는 매핑 시 `authConfigId: t.authConfigId || null` 로 방어처리.

### [INFO] `useAuthConfigs` 훅 오류(isError) 시 열 셀 동작 미정의
- 위치: `page.tsx` diff +524 (`const { data: authConfigs = [] } = useAuthConfigs()`)
- 상세: `useAuthConfigs()` 가 `isError=true` 일 때 `data` 는 기본값 `[]` 로 폴백되어 모든 비 null `authConfigId` 에 대해 `authConfigById.get()` 가 `undefined` 를 반환한다. 결과적으로 AuthConfig 가 연결된 트리거도 `"Configured"` 라벨로 표시되며, AuthConfig 서버 오류와 무인증 트리거가 시각적으로 구분되지 않는다. 오류 상태 표시(예: 스켈레톤·`"–"` 또는 아이콘 툴팁)가 필요할 수 있다.
- 제안: `isError` 상태 구독 후 auth 셀에서 로딩 실패를 별도 표시하거나, 최소한 `isLoading` 기간에는 스켈레톤을 렌더링하는 것을 검토.

### [INFO] `manual` 트리거 타입의 무인증 경고 미표시 테스트 누락
- 위치: `triggers-page.test.tsx` 신규 테스트 블록
- 상세: `non-webhook (schedule) without auth shows no warning` 케이스는 있지만 `manual` 타입 트리거에 대한 동일 케이스가 없다. 구현은 `trigger.type !== "webhook"` 체크로 schedule 과 manual 모두 `-` 표시하므로 동작이 동일하다. 테스트 커버리지 완전성 관점에서 `manual` 타입에 대한 명시적 케이스가 없다.
- 제안: `manual` 타입의 경우도 별도 테스트 케이스 추가 또는 `type: "schedule" | "manual"` 을 parameterized test 로 처리.

### [INFO] `authConfigured` i18n 키 ("Configured" / "설정됨") 가 spec 에 없음
- 위치: `en/triggers.ts` diff +604, `ko/triggers.ts` diff +919
- 상세: `"Configured"` 문자열은 `authConfigId` 가 있으나 `authConfigById` 에서 해당 cfg 를 찾지 못할 때만 표시되는 fallback 라벨이다. 이 상태가 spec 에 정의되어 있지 않으므로 사용자가 이 라벨을 볼 때의 의미가 모호하다. spec gap.
- 제안: `project-planner` 위임 — spec 에 이 fallback 상태를 명시하거나, fallback 자체를 다른 방식(경고/오류)으로 처리.

### [INFO] `authConfigNone` 키 재사용 — 의미 중첩 가능성
- 위치: `page.tsx` diff +576 (`{t("triggers.authConfigNone")}`)
- 상세: `authConfigNone` 은 원래 `AuthConfigSelect` 드롭다운의 "No authentication" 옵션 라벨로 사용되던 키다. 이번 변경에서 무인증 경고 셀의 텍스트로 동일 키를 재사용하고 있다. 두 컨텍스트에서 같은 문자열이 자연스러운 경우에는 문제없으나, 향후 둘 중 하나의 표시 텍스트만 바꾸려 할 때 서로 분리할 수 없다.
- 제안: 무인증 경고 셀 전용 키(`authColumnNone` 등)를 별도로 신설하는 것을 검토.

---

## 요약

변경의 핵심 목적인 트리거 목록에 Authentication 열 추가 및 무인증 Webhook 경고 표시는 기능적으로 동작하며 테스트 4케이스(헤더 렌더링, AuthConfig 타입 뱃지 표시, 무인증 경고 아이콘, non-webhook 경고 미표시)가 의도한 시나리오를 검증하고 있다. 그러나 코드와 i18n 주석이 잘못된 Rationale ID(`R-15` — 실제로는 브랜드 spec의 워드마크 번호)를 일관되게 참조하고 있으며, 더 중요하게는 spec `§2.1` 테이블에 이 "인증" 열 자체가 요소로 정의되어 있지 않아 구현이 spec 본문보다 앞서 있다. 또한 AuthConfig 조회 실패(isError)나 삭제된 AuthConfig 참조(`cfg === undefined`) 시의 UX 가 spec 상 정의되지 않은 채로 "Configured" 라벨로 조용히 폴백된다.

---

## 위험도

MEDIUM

---

## spec 결함 의심 (project-planner 위임 필요)

1. `spec/2-navigation/2-trigger-list.md §2.1` 행 요소 테이블에 Authentication 열(authConfigId 표시·무인증 경고·non-webhook 처리) 요구사항이 없음 — 구현 선행 상태.
2. `spec/2-navigation/2-trigger-list.md` 에 `R-15` ID 가 존재하지 않음에도 코드 주석 4곳이 이를 참조. 올바른 Rationale 또는 새 요구사항 ID 신설이 필요.
3. `NAV-TR-10` (`_product-overview.md`) 이 여전히 구 inline authType 필드(`authType`/`hmacHeader`/`hmacSecret`/`bearerToken`) 를 열거하고 있어 R-14 격상과 불일치. (spec gap — 별도 정정 필요)
