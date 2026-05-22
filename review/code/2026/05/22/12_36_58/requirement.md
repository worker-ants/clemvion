# 요구사항(Requirement) 리뷰 결과

리뷰 대상 커밋: `b3820314` — `feat(triggers): row ⋮ dropdown + type-specific delete confirmation (Plan A)`
참조 Spec: `spec/2-navigation/2-trigger-list.md §2.1, §4`
Plan: `plan/in-progress/trigger-list-row-actions.md`

---

## 발견사항

### [WARNING] spec §4.2 — schedule 확인 다이얼로그 interp 변수 불일치 (`{scheduleId}` → `{cron}`)

- 위치: `spec/2-navigation/2-trigger-list.md §4.2` L146 vs `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L152-159 및 `codebase/frontend/src/lib/i18n/dict/en/triggers.ts` L570-572
- 상세: spec §4.2 는 schedule 타입 확인 다이얼로그 본문의 interpolation 변수를 `{scheduleId}` 와 `{nextRunAt}` 으로 정의한다 ("연결된 스케줄도 함께 삭제됩니다 (스케줄 ID `{scheduleId}`). 다음 실행 예정 시각: `{nextRunAt}`."). 그러나 코드는 `{scheduleId}` 대신 `{cron}` (= `cronExpression`) 을 사용한다. i18n EN 키도 `triggers.delete.confirm.schedule = "... (cron {{cron}}). Next run was scheduled at {{nextRunAt}}."` 로 구현되어 있다. scheduleId 를 표시하는 것과 cron 표현식을 표시하는 것은 UX 정보량 측면에서 차이가 있으며, spec 이 요구한 필드와 다르다.
- 제안: spec §4.2 의 `{scheduleId}` 를 `{cron}` 으로 정정하거나 (spec 결함 — `project-planner` 위임), 또는 코드가 spec 에 맞게 `scheduleId` 를 `TriggerDeleteTarget` 에 추가하여 노출해야 한다. 단, cron 표현식이 scheduleId 보다 사용자에게 더 직관적이므로 spec 정정이 합리적이다.

---

### [WARNING] 메뉴 항목 2-4개 개수 불일치 — spec §2.1 "수정" 항목 미구현

- 위치: `spec/2-navigation/2-trigger-list.md §2.1` L45 vs `codebase/frontend/src/app/(main)/triggers/page.tsx` L502-561
- 상세: spec §2.1 더보기(⋮) 항목은 "수정, 활성/비활성 토글, 호출 이력, 삭제" 4가지로 정의한다. 현재 코드에서 구현된 메뉴 항목은 "상세 보기(viewDetails), 호출 이력(viewHistory), 스케줄 편집 딥링크(schedule only), 활성/비활성 토글, 삭제" 이다. spec 의 "수정(edit)" 항목은 구현되어 있지 않다. 반면 "상세 보기(viewDetails)" 는 spec 에 없는 항목이다.
- 제안: Plan A 범위가 의도적으로 "수정" 항목을 제외했다면 (Plan B `trigger-detail-edit-meta.md` 에서 처리 예정), plan 에 이 분리를 명시해야 한다. 현재 plan 파일에는 이 gap 이 명시적으로 언급되어 있지 않다. 단, plan `§2. Frontend` 체크리스트 항목 1번이 "상세 보기 → setSelectedTriggerId(id)" 로 기술되어 있어 이것이 "수정" 을 포함하는 일반 상세/편집 진입점으로 해석될 수도 있다. spec 과 plan 의 용어를 정렬해야 한다.

---

### [WARNING] "호출 이력(viewHistory)" 항목 — "상세 보기" 와 동일 동작으로 구현됨

- 위치: `codebase/frontend/src/app/(main)/triggers/page.tsx` L503-512
- 상세: spec §2.1 은 "호출 이력" 항목을 독립 기능으로 정의한다. 코드에서 "상세 보기" (`viewDetails`)와 "호출 이력" (`viewHistory`) 모두 동일하게 `setSelectedTriggerId(trigger.id)` 를 호출한다 — 두 메뉴 항목이 동일한 동작(트리거 상세 드로어 열기)을 수행한다. plan `§2.3` 주석에 "(v1 은 anchor 스크롤 미구현 — Recent Calls 가 항상 드로어 하단에 존재)" 라고 기술되어 있어 의식적 단순화임을 알 수 있으나, 사용자 관점에서는 두 메뉴 항목이 동일하게 동작하여 혼란을 줄 수 있다.
- 제안: viewHistory 클릭 시 최소한 드로어를 열면서 "최근 호출 이력" 섹션으로 스크롤하는 앵커를 전달하거나, 단기적으로는 두 항목을 하나로 통합하는 것이 UX 정합도를 높인다. 현 상태는 기능 결함은 아니나 중복 항목으로 UX 품질 저하.

---

### [INFO] spec §4.4 — "클라이언트는 목록·상세 query 를 invalidate" — 상세(detail) query invalidate 누락

- 위치: `spec/2-navigation/2-trigger-list.md §4.4` L163 vs `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L131-135
- 상세: spec §4.4 는 삭제 성공 시 "클라이언트는 목록·상세 query 를 invalidate" 를 요구한다. 코드의 `onSuccess` 핸들러는 `queryClient.invalidateQueries({ queryKey: ["triggers"] })` 만 수행하고, 상세(trigger detail) query 에 대한 별도 invalidation 은 없다. `["triggers"]` prefix 매칭이 `["triggers", id]` 같은 상세 query key 도 커버하는지는 queryKey 구조 설계에 달려 있어 불확실하다.
- 제안: spec 의 "목록·상세 쿼리 모두 invalidate" 의도를 명시적으로 충족하려면 `queryClient.invalidateQueries({ queryKey: ["triggers"] })` 가 prefix 매칭으로 상세 캐시를 함께 무효화하는지 확인하고, 그렇지 않다면 `queryClient.invalidateQueries({ queryKey: ["trigger", deletedId] })` 를 추가해야 한다.

---

### [INFO] 404 silent invalidate — 동시 삭제 처리 onError에서 onClose 호출 전 state 미초기화

- 위치: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L136-143
- 상세: 404 에러 시 `onClose()` 를 호출하지만 다이얼로그 내 `confirmText` state 는 `DialogInner` 내부 local state 이므로 컴포넌트 unmount 시 자연히 소멸한다. 다이얼로그가 닫힌 후 즉시 다시 열리는 시나리오에서는 key prop (`trigger.id`) 이 바뀌면서 state 가 초기화되므로 실질적 문제는 없다. INFO 등급.

---

### [INFO] 이름 confirm 검증 — 공백 trim 처리

- 위치: `codebase/frontend/src/components/triggers/trigger-delete-dialog.tsx` L166 — `confirmText.trim() === trigger.name`
- 상세: spec §4.2 는 "트리거 이름을 정확히 타이핑해야" 라고 기술하며 공백 처리 여부를 명시하지 않는다 (spec 침묵 영역). 코드는 `confirmText.trim()` 으로 앞뒤 공백을 제거한 후 비교한다. 이는 사용자 친화적 선택이나 spec 에서 명시되지 않았으므로 ambiguity 존재.
- 제안: 현재 구현이 더 나은 UX 를 제공하므로 문제 없음. spec `project-planner` 에 "trim 후 비교" 를 명시하면 drift 방지 가능 (INFO).

---

### [INFO] plan `trigger-list-row-actions.md` — spec §2.1 interp `{scheduleId}` 를 `{cron}` 으로 이행한 근거 미문서화

- 위치: `plan/in-progress/trigger-list-row-actions.md` §3 i18n 섹션
- 상세: plan 의 i18n 신규 키 목록에서 `triggers.delete.confirm.schedule` 의 interpolation 변수가 spec §4.2 의 `{scheduleId}` 가 아닌 `{cron}` 으로 구현되었다. 이 변경에 대한 명시적 근거나 주석이 plan 에 없다.
- 제안: plan 에 "(spec §4.2 `{scheduleId}` 를 `{cron}` 으로 대체 — cron 표현식이 사용자에게 더 직관적, spec 정비 필요)" 와 같은 주석을 추가하거나 `project-planner` 에 spec 정비 위임.

---

### [INFO] package-lock.json 변경 — 기능 요구사항과 무관, 의존성 트리 정상화

- 위치: `codebase/backend/package-lock.json`, `codebase/frontend/package-lock.json`
- 상세: backend 에 `@nestjs-modules/mailer` 하위 `chokidar` 3.6.0, `glob-parent` 5.1.2, `readdirp` 3.6.0 추가 및 `uglify-js` dev 플래그 추가. frontend 에 `fsevents` dev 플래그 추가. 이는 `@radix-ui/react-dropdown-menu` 설치 과정에서 발생한 lockfile 재생성 부수 효과이며 기능 요구사항과 직접 관련 없다. INFO 등급.

---

## 요약

Plan A 의 핵심 기능 — ⋮ 드롭다운 메뉴 신설, type별 삭제 확인 다이얼로그, RBAC 게이트, 404 동시 삭제 silent invalidate, 이름 confirm gate — 은 전반적으로 spec `§2.1` 과 `§4` 를 충실히 구현하고 있다. 다만 spec §4.2 가 schedule 삭제 다이얼로그 본문에 `{scheduleId}` interpolation 을 요구하는 반면 코드는 `{cron}` 을 사용하여 spec 과 구현 간 필드 불일치가 존재한다. 또한 spec §2.1 의 더보기 메뉴 4개 항목("수정·토글·호출이력·삭제") 중 "수정" 이 Plan A 에서 구현되지 않았고, "상세 보기" 와 "호출 이력" 이 동일한 동작을 수행하는 중복 항목으로 남아 있다. `{scheduleId}` vs `{cron}` 불일치는 spec 결함(cron 이 사용자에게 더 유용)으로 보이므로 `project-planner` 에 spec 정비를 위임하는 것이 적절하다.

## 위험도

LOW
