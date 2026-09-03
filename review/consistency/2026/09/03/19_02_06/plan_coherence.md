# Plan 정합성 검토 — target: `spec/5-system/`

## 범위 확인

- `spec/5-system` scope 델타: **0 파일** (이 브랜치 `claude/entity-nullable-batch3`, HEAD `2b1d4db6a`) — 이번 diff 는 spec 을 건드리지 않았다. 실제 구현 diff 는 `codebase/backend` 엔티티·DTO 10파일(엔티티 `nullable: true` 컬럼의 TS 타입을 `| null` 로 정합화, `AuthConfigDto.ipWhitelist` Swagger 계약 정정) + `CHANGELOG.md`.
- 이 diff 를 관장하는 plan 은 `plan/in-progress/entity-nullable-column-type-mismatch.md` (배치 3, `worktree: plan-in-progress-items-b0c80b`).
- `spec_impact` frontmatter: `spec/1-data-model.md` · `spec/data-flow/10-triggers.md` · `spec/5-system/2-api-convention.md` — 코드 전용 배치인데도 `none` 이 아닌 이유가 plan 본문에 명시돼 있고(Gate C 우회 방지), 그 세 파일 각각에 대응하는 "후속(planner 턴)" 미해결 항목이 `## 할 일`에 실제로 존재함을 확인했다(정합).

## 발견사항

### INFO — DTO↔엔티티 nullable 불일치 축(48건/26파일)이 체크리스트 항목이 아니라 서술로만 존재
- target 위치: `spec/5-system/2-api-convention.md §5.4` (부재 표현 규칙 — 이번 diff 가 인용한 근거)
- 관련 plan: `plan/in-progress/entity-nullable-column-type-mismatch.md` §"새로 드러난 축" (`AuthConfigDto.ipWhitelist` 문단 및 "48건 / 26파일" 실측)
- 상세: `AuthConfigDto.ipWhitelist` 1건은 이번 diff(`af1651264`)에서 §5.4 근거로 정정됐고, plan 본문도 review 2R(`2b1d4db6a`)에서 "49건(12파일)"→"48건/26파일"로 재측정·정정돼 있어 **plan 자체의 자기서술 정합성은 이미 확보**됐다. 다만 잔여 48건은 `## 할 일` 체크박스가 아니라 `## 배치 3` 절 안의 산문("⚠️ 이 48 은 아직 작업 항목이 아니다", "이 축에는 가드가 없다")으로만 존재한다. 이 plan 이 (다른 3건의 열린 후속 항목 해소 후) `complete/` 로 이동하면, 체크박스가 아닌 절 내부 서술은 후속 세션이 놓치기 쉽다.
- 제안: 코드 변경 불필요. `## 할 일`에 "DTO↔엔티티 nullable 대조 가드 신설 + 48건 귀속 정리" 를 명시적 체크박스(미해결)로 승격하거나, 별도 `plan/in-progress/*.md` 로 분리해 이 plan 종결과 독립적으로 추적할 것을 권고.

### 확인됨 — 미해결 결정과의 충돌 없음
- `2-api-convention.md §5.4`(null vs 키 생략, `@ApiPropertyOptional({nullable:true})` + `field?: T | null` 규약)는 이번 diff 의 `AuthConfigDto.ipWhitelist` 변경과 line-level 로 일치한다. CHANGELOG 인용도 정확하다. plan 이 "결정 필요"로 남겨둔 항목을 우회한 곳은 없다.
- plan 의 두 "후속(planner 턴)" 항목 — `spec/1-data-model.md §2.9 next_run_at`(`Timestamp` vs 인접 `last_run_at`의 `Timestamp?`) 및 `2-api-convention.md §2.2` `/api/auth/*` 액션 네임스페이스 예외 — 을 HEAD 기준으로 직접 재확인했다. 둘 다 여전히 미반영 상태이며(`1-data-model.md:260-261`, `2-api-convention.md §2.2` 표에 auth 예외 없음), plan 이 "완료 처리하지 말 것"으로 정확히 차단해 두고 있어 target·plan 이 서로 어긋나지 않는다(선행 plan 미해소가 아니라, 미해소 상태 그 자체를 target·plan 양쪽이 동일하게 반영).

### 확인됨 — 후속 항목 누락 없음
- 이번 diff 는 `spec/5-system/` 어떤 절도 변경하지 않았으므로, 그로 인해 다른 in-progress plan(`ws-token-expired-socket-lifetime-impl.md`, `eia-terminal-payload.md`, `spec-draft-eia-62-waiting-payload.md`, `spec-sync-external-interaction-api-gaps.md`, `auth-guard-reflection-hardening.md` 등 — `2-api-convention.md` 를 참조하는 plan 목록)의 후속 항목을 무효화할 여지가 없다.
- `entity-nullable-column-type-mismatch.md` 가 건드린 엔티티(`AuditLog`·`AuthConfig`·`Edge`·`Folder`·`WorkflowVersion`·`WorkspaceMember`)를 참조하는 다른 in-progress plan(`spec-sync-auth-gaps.md` 등)을 grep 했으나 이번 nullable 타입 변경과 충돌하는 서술은 없다.

## 요약
이번 검토 대상(`spec/5-system/`)은 이번 브랜치에서 0줄 변경됐고, 실제 코드 diff(엔티티 nullable 타입 정합화 배치 3 + `AuthConfigDto.ipWhitelist` 정정)는 `entity-nullable-column-type-mismatch.md` 가 관장하며 `spec/5-system/2-api-convention.md §5.4` 규약과 line-level 로 일치한다. plan 이 "결정 필요"로 남겨둔 두 후속 항목(`§2.9 next_run_at`, `§2.2 auth 네임스페이스 예외`)은 HEAD 기준으로도 여전히 미반영 상태이며, plan 이 그 상태를 정확히 반영해 `complete/` 이동을 스스로 차단하고 있어 target·plan 간 충돌이 없다. 유일하게 남는 것은 잔여 48건 DTO 불일치 축이 체크박스가 아닌 산문으로만 추적되고 있다는 경미한 위생 이슈(INFO)뿐이다.

## 위험도
NONE
