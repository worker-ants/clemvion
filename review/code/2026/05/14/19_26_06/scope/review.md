## Scope Code Review

### 발견사항

---

**[WARNING] `status-badge.tsx:46-52` — `expired` + `install_timeout` UI 코드가 변경 0 범위 초과**

- **위치**: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` lines 46–52
- **상세**: 추가된 `expired` 분기는 `statusReason === "install_timeout"` 조건으로 "Install timed out — delete and re-register" 메시지를 표시한다. `install_timeout` statusReason은 변경 4(pending_install TTL 24h 정리 → expired 전이)에서 생성되는 값으로, 해당 BE 로직이 이번 PR에 포함되지 않는다. 이 코드는 현재 dead code이며, 변경 4 구현 전까지 실제 도달하지 않는다. 변경 0 커밋에 변경 4의 FE 처리가 섞이면 향후 변경 4 PR에서 충돌 또는 이중 처리 혼란이 발생할 수 있다.
- **제안**: `expired` 분기 추가를 변경 4 PR로 이동하거나, 현재 diff에서 제거.

---

**[INFO] `integration.entity.ts:58-62` — `@Column` 포맷팅 전용 변경**

- **위치**: `backend/src/modules/integrations/entities/integration.entity.ts` lines 58–62
- **상세**: `installToken` 컬럼의 `@Column` 데코레이터를 단일 객체 인라인에서 멀티라인으로 재포맷. 기능 변경 없는 스타일 전용 수정이며 변경 0과 직접 관련 없다. diff 노이즈를 증가시켜 리뷰 범위를 흐림.
- **제안**: 스타일 변경은 별도 chore 커밋 또는 포함하지 않는 것을 권장.

---

**[INFO] `status-badge.tsx:20-28` — `pending_install` + `statusReason` FE 노출이 변경 1 영역과 겹침**

- **위치**: `frontend/src/app/(main)/integrations/_shared/status-badge.tsx` lines 20–28
- **상세**: `pending_install` 상태에서 `statusReason`이 있을 때 `err` tone과 "Last error: ..." 메시지를 표시하는 변경. 엄밀히는 plan의 변경 1(FE pending step 정비) 범주이나, 변경 0의 BE observability와 직접 대응하는 최소 FE 보완으로 기능상 필요하다. 단, plan에 변경 1 항목으로 체크되지 않아 추적 상태와 실제 구현 상태가 불일치할 수 있다.
- **제안**: `plan/in-progress/cafe24-pending-polish.md` 변경 1에 해당 FE 항목을 완료로 체크하거나, 변경 0 설명 노트에 "FE badge 표시 포함" 명시.

---

### 요약

변경 0(callback 실패 관측성)의 핵심 구현 — `lastError` DTO 필드, `markIntegrationCallbackError` 컨트롤러 호출, `callbackContextOf` export, popup auto-close 지연 — 은 의도된 범위 안에 집중되어 있다. 주요 초과 범위는 `status-badge.tsx`의 `expired + install_timeout` 분기로, 이는 변경 4(TTL 정리)에 속하는 dead code가 변경 0 커밋에 포함된 케이스다. `integration.entity.ts`의 포맷팅 변경은 기능적 영향은 없으나 diff를 오염시킨다. review/consistency 산출물과 plan 문서 변경은 모두 적절하다.

### 위험도

**LOW**