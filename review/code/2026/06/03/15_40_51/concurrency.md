# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] updateWorkspaceSettings — read-modify-write 경쟁 조건
- **위치**: `/codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateWorkspaceSettings` 메서드 (diff +359~+382 구간)
- **상세**: `assertAdmin` → `findOne` → `settings` 객체 변경 → `save` 의 비원자적 순서로 실행된다. 두 Admin 사용자가 동시에 `PATCH /:id/settings`를 호출하면, 둘 다 동일한 workspace 스냅샷을 읽은 후 각자 `settings` 객체를 덮어쓰게 되어 나중에 `save`한 쪽의 값만 남는다. 특히 `settings` 컬럼은 JSONB 부분 머지(`{ ...workspace.settings, interactionAllowedOrigins: ... }`) 방식이므로, 동시 요청 시 한 쪽의 머지가 손실될 수 있다.
- **제안**: TypeORM의 낙관적 잠금(`@Version` 컬럼 + `save()` 충돌 감지)을 적용하거나, 단일 원자 쿼리(`UPDATE workspace SET settings = settings || $1::jsonb WHERE id = $2`)로 교체하여 DB 레벨에서 원자성을 보장한다. 현재 트래픽 수준에서 동시 Admin 편집 빈도가 낮더라도, settings 컬럼이 여러 키를 보유하는 JSONB인 만큼 향후 확장 시 충돌 범위가 넓어질 수 있다.

### [INFO] EmbedOriginsEditor — 저장 중 중복 제출 방어 부분적
- **위치**: `/codebase/frontend/src/app/(main)/workspace/settings/page.tsx` — `EmbedOriginsEditor` 컴포넌트 (diff +729~+733 구간)
- **상세**: 저장 버튼에 `disabled={saveMutation.isPending}` 가드가 있어 사용자의 중복 클릭은 방지된다. 그러나 `addOrigin` / `removeOrigin` 로컬 상태 변경은 mutation 진행 중에도 허용된다. 즉, 저장 요청이 진행되는 동안 사용자가 목록을 수정하면, 서버 응답 후 invalidateQueries로 인한 리패치 시점에 로컬 상태와 서버 상태가 충돌하게 된다. key-remount 전략(`${workspaceId}:${isSuccess ? "loaded" : "pending"}`)이 이를 완화하나, 진행 중 수정→저장 완료→key 변경→remount 사이의 짧은 간극에서 UI가 사용자의 미저장 변경을 조용히 버릴 수 있다.
- **제안**: mutation `isPending` 동안 `addOrigin`/`removeOrigin` 인터랙션도 비활성화(`disabled` 또는 `pointer-events-none`)하거나, 완료 시점에 서버 응답 값으로 로컬 상태를 명시적으로 동기화한다. 기능 결함 수준은 아니나 UX 불일치 위험이 있다.

---

## 요약

변경 코드에서 동시성 관련 이슈는 두 가지이다. 백엔드 `updateWorkspaceSettings`의 read-modify-write 패턴은 다수의 Admin이 동시 편집하는 경우 settings 일부 키를 손실할 수 있는 경쟁 조건(WARNING)을 내포한다. 이는 TypeORM 낙관적 잠금 또는 DB 레벨 원자 JSONB 갱신으로 해소 가능하다. 프론트엔드 `EmbedOriginsEditor`는 저장 진행 중 로컬 상태 변경이 허용되어 리패치 시 미저장 변경이 무음으로 폐기될 수 있는 약한 경합이 있다(INFO). 전반적으로 데드락·스레드 세이프티·async/await 누락·이벤트 루프 블로킹 등의 심각한 문제는 발견되지 않는다.

## 위험도

MEDIUM

---
