# 부작용(Side Effect) 리뷰

## 발견사항

### **[WARNING]** `update()` 에서 `Object.assign(config, rest)` 가 `rest` 에 `config` 키가 없을 때 `config.config` 를 덮어쓸 수 있음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-auth-edit-form-7a5631/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1102-1103
- 상세: `const { config: configPatch, ...rest } = data;` 로 `rest` 에는 `config` 키가 제거된다. 그러나 `rest` 에는 `workspaceId`, `id`, `type`, `isActive` 등 엔티티의 모든 top-level 필드가 그대로 포함될 수 있다. `Object.assign(config, rest)` 는 caller 가 `data` 에 `workspaceId`, `id`, `type` 을 담아 보내면 기존 엔티티의 해당 필드를 덮어쓴다. DTO 레이어(`UpdateAuthConfigDto`)가 `type`, `workspaceId`, `id` 를 허용 필드로 노출하지 않아 일반 HTTP 경로에서는 안전하지만, 서비스가 직접 호출되는 경로(테스트·내부 호출)에서는 `type` 변경 차단 의도가 서비스 계층에서 강제되지 않는다. 편집 폼이 `type` 변경을 차단한다는 프론트엔드·spec 의도와 어긋날 수 있다.
- 제안: `Object.assign` 의 대상에서 `id`, `workspaceId`, `type` 을 명시적으로 제외하거나, `rest` 를 허용 필드 집합으로 pick 한 후 assign 한다.

```ts
// 권장
const { config: configPatch, id: _id, workspaceId: _ws, type: _type, ...rest } = data;
Object.assign(config, rest);
```

---

### **[WARNING]** `update()` 반환은 `toMasked(saved)` 인데 `save()` 가 in-memory mock 에서는 참조를 그대로 반환하므로 테스트·실서비스 간 동작 차이 가능

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-auth-edit-form-7a5631/codebase/backend/src/modules/auth-configs/auth-configs.service.ts` L1112 / L1120
- 상세: 서비스는 `repo.save(config)` 후 반환된 `saved` 에 `toMasked` 를 적용해 반환한다. 그러나 테스트의 in-memory mock 은 `save: jest.fn(async (ac) => { store.set(ac.id, ac); return ac; })` 로 **같은 객체 참조**를 반환한다. 서비스 내부에서 `config.config = merged` 로 config 를 교체하면 store 에 저장된 객체와 `saved` 가 동일 참조이므로, 이후 `toMasked(saved)` 가 `spread` 복제를 수행하기 전까지 `store` 도 `merged` 로 갱신된 상태다. 이는 의도한 동작이지만, 만약 `toMasked` 가 원본 객체를 **변이(mutate)**하는 방향으로 바뀌면 store 가 마스킹된 값으로 오염된다. 현재 구현에서는 `toMasked` 가 spread 로 복제하므로 실질적 버그는 없으나, 공유 참조 패턴은 잠재적 부작용 위험 요소다.
- 제안: mock 의 `save` 가 `structuredClone(ac)` 을 저장하도록 수정하거나, 서비스의 `toMasked` 가 항상 deep clone 임을 주석으로 보장한다.

---

### **[INFO]** `updateMutation` 의 `mutationFn` 이 `editTargetId` 클로저를 캡처

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-auth-edit-form-7a5631/codebase/frontend/src/app/(main)/authentication/page.tsx` — `updateMutation` 정의 구간 (diff L171-183)
- 상세: `mutationFn` 안에서 `editTargetId` state 를 직접 읽는다. React의 closure stale 특성상, mutation 이 실행되는 시점과 `editTargetId` 가 설정된 시점 사이에 state 변경(예: 사용자가 빠르게 다른 편집 버튼 클릭)이 발생하면 잘못된 ID 로 PATCH 가 나갈 수 있다. 현재 폼이 모달로 동기 제어되어 현실적 위험은 낮지만, `useMutation` 의 `variables` 패턴으로 ID 를 넘기는 것이 더 안전하다.
- 제안:
```ts
const updateMutation = useMutation({
  mutationFn: async ({ targetId }: { targetId: string }) => {
    const payload = buildAuthConfigUpdatePayload(collectFormState());
    await apiClient.patch(`/auth-configs/${targetId}`, payload);
  },
  ...
});
// 호출 시:
updateMutation.mutate({ targetId: editTargetId! });
```

---

### **[INFO]** `formStateFromAuthConfig` 의 `hmacAlgorithm` 화이트리스트가 `sha256`/`sha512` 두 값만 지원

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-auth-edit-form-7a5631/codebase/frontend/src/app/(main)/authentication/auth-config-form.ts` L2481-2482
- 상세: `cfg.algorithm === "sha512" ? "sha512" : AUTH_CONFIG_DEFAULTS.hmacAlgorithm` 으로 백엔드에서 다른 값(예: 잘못 저장된 `md5`)이 오면 기본값 `sha256` 으로 silently 덮어씌운다. 사용자가 저장한 값과 다른 값으로 폼이 초기화되어 저장 시 원치 않는 덮어쓰기가 발생할 수 있다.
- 제안: `AUTH_CONFIG_HMAC_ALGORITHMS` 상수(집합)로 허용 목록을 정의하고 거기에 없는 경우 경고 토스트를 띄우거나 명시적으로 처리한다.

---

### **[INFO]** `toggleMutation` 과 `updateMutation` 이 같은 `PATCH /auth-configs/:id` 엔드포인트를 사용하면서 서로 다른 경로로 cache invalidate

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-auth-edit-form-7a5631/codebase/frontend/src/app/(main)/authentication/page.tsx`
- 상세: `toggleMutation` 과 `updateMutation` 모두 `queryClient.invalidateQueries({ queryKey: ["auth-configs"] })` 를 호출해 동일 캐시를 무효화하므로 중복 리렌더링이 발생할 수 있다. 이는 성능 부작용이지만 데이터 정합성에는 영향 없다. 별도 `queryKey` 분리가 되어 있지 않아 usage 쿼리 등과의 연쇄 무효화도 발생할 수 있다.
- 제안: 현재 구조에서는 기능적 문제가 없으므로 INFO 수준. 향후 성능 최적화 시 mutation response 로 캐시를 직접 업데이트하는 방식 고려.

---

### **[INFO]** `handleEditClick` 이 `showDialog` 를 `true` 로 설정하기 전 여러 state setter 를 순차 호출 — React 18 automatic batching 으로 단일 렌더링이 보장되나 이전 버전과 차이 있음

- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/config-auth-edit-form-7a5631/codebase/frontend/src/app/(main)/authentication/page.tsx` — `handleEditClick` 함수
- 상세: `setFormName`, `setFormType`, `setFormApiKeyHeader` 등 여러 개의 state setter 를 개별 호출한 후 마지막에 `setShowDialog(true)` 를 호출한다. React 18 의 automatic batching 덕분에 단일 렌더링으로 처리되나, 이전 React 버전이나 이벤트 핸들러 외부에서 호출되는 경우 중간 상태에서 렌더링이 발생할 수 있다. 현재 환경에서는 기능적 문제 없음.
- 제안: 가독성과 안전성을 위해 단일 `useReducer` 또는 객체 상태로 통합 고려.

---

## 요약

이번 변경의 핵심은 백엔드 `update()` 의 config shallow-merge 개선과 프론트엔드 편집 폼 신설이다. 부작용 관점에서 가장 주목할 사항은 `Object.assign(config, rest)` 가 서비스 계층에서 `type`·`workspaceId` 변경을 막지 않는다는 점이다 — DTO 필터가 HTTP 레이어에서 차단하므로 실 운영에서는 문제 없으나, 서비스 직접 호출 경로에서는 타입 변경 의도가 강제되지 않는다. in-memory mock 의 참조 공유 패턴도 잠재적 부작용 위험이지만 현재 `toMasked` 구현이 spread 복제를 사용해 실질적 버그는 없다. 프론트엔드의 `editTargetId` 클로저 캡처는 stale closure 의 고전적 위험이나 모달 UX 흐름에서 현실적 발생 가능성은 낮다. 전반적으로 비밀값 보호 의도(SECRET_CONFIG_KEYS 필터링, 마스킹 역류 차단)는 백엔드·프론트엔드 양쪽에서 일관되게 구현되어 있으며, 네트워크·파일시스템·환경변수·전역 변수 관련 의도치 않은 부작용은 없다.

## 위험도

LOW
