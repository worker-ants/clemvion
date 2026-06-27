### 발견사항

- **[INFO]** `pnpm-migration-followups.md §2` — 동일 파일(`api-wrapped.ts`) 미착수 open 항목
  - target 위치: (간접) `spec/conventions/swagger.md §2-5, §5-2` — `api-wrapped.ts` 행동 수정에 기반
  - 관련 plan: `plan/in-progress/pnpm-migration-followups.md §2` (`@nestjs/swagger` 핀 제거 + deep-import 정리, worktree: unstarted)
  - 상세: `pnpm-migration-followups.md §2` 가 `api-wrapped.ts` 의 `SchemaObject` deep-import(`@nestjs/swagger/dist/interfaces/…`) 교체를 미착수 상태로 보유. 본 fix 는 같은 파일의 `wrapPaginatedSchema` **로직**(외곽 `data` 래퍼 제거)만 변경하며, deep-import 경로와는 완전히 직교. 충돌·결정 우회는 없으나, `pnpm-migration-followups §2` 착수 시 담당자가 single-wrap 정정 사실을 인지할 수 있도록 추적 메모가 유용.
  - 제안: plan 간 충돌 없으므로 양쪽 모두 수정 불필요. `pnpm-migration-followups.md §2` 에 "본 fix 이후 `wrapPaginatedSchema` 내부 로직은 single-wrap 으로 변경됨 — deep-import 교체 시 로직 무수정 유지" 한 줄 메모 추가 권장(선택).

### 요약

`spec/conventions/swagger.md` 의 §2-5·§5-2·Rationale §5 변경은 `plan/in-progress/swagger-double-wrap-fix.md` 의 명시 범위(구현 게이트 체크리스트 전 항목 완료, 잔여 gate = 현재 fresh --impl-done)와 정합한다. 다른 in-progress plan 중 미해결 결정을 우회하는 항목은 없으며, 변경 전제로 삼는 미해소 선행 plan 도 없다. `pnpm-migration-followups.md §2` 가 같은 파일(`api-wrapped.ts`)을 참조하나 deep-import 경로 교체라는 별개 관심사로, 본 fix 와 의미·행동 충돌이 없다. 후속 plan 을 무효화하거나 신규로 추가해야 하는 필요도 발견되지 않는다.

### 위험도
NONE
