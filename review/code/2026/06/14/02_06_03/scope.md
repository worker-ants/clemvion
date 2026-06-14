# 변경 범위(Scope) 리뷰

## 발견사항

### 파일 1: schedules.module.ts

- **[INFO]** `Workspace` 엔티티를 `TypeOrmModule.forFeature`에 추가
  - 위치: diff +1 (import), +1 (forFeature array)
  - 상세: `schedules.service.ts`의 `resolveTimezone`이 `workspaceRepository`를 주입받으므로 모듈 등록은 필수 변경. 범위 내.
  - 제안: 없음.

---

### 파일 2: schedules.service.spec.ts

- **[INFO]** `triggerRepo`·`workspaceRepo` 변수 선언 및 provider 추가 (diff +2 let, +4 provider lines)
  - 위치: 33-40번 줄 diff
  - 상세: 새로운 `create — timezone fallback (§2.2)` describe 블록이 두 repo 모두 참조하므로 beforeEach 초기화가 필요. 범위 내.

- **[INFO]** `create — timezone fallback (§2.2)` describe 블록 47행 추가
  - 위치: diff +47 lines (143번 줄 이후)
  - 상세: §2.2 타임존 fallback 기능의 단위 테스트 3케이스. 기능 구현과 1:1 대응.

- **[INFO]** 기존 `describe('SchedulesService.runNow', ...)` 블록 상단에서 `triggerRepo`는 이미 provider로 등록되어 있었으나 변수로 노출되지 않았음 — 이번 변경에서 `triggerRepo` 변수를 추가하고 beforeEach에서 할당. 기존 테스트 케이스 수정 없음.
  - 위치: diff +2 (beforeEach 57-58 줄)
  - 상세: `triggerRepo`는 `create` 테스트에서 mock setup에 사용되므로 정당.

---

### 파일 3: schedules.service.ts

- **[INFO]** `Workspace` 임포트 + `workspaceRepository` 주입 + `resolveTimezone` private 메서드 추가
  - 위치: diff +1 import, +2 constructor lines, +18 method lines
  - 상세: §2.2 스펙 요구사항(`명시값 > workspace settings.timezone > 'Asia/Seoul'` fallback)의 핵심 구현. `create` 메서드의 `dto.timezone ?? 'Asia/Seoul'` 1줄을 `await this.resolveTimezone(...)` 호출로 교체. 범위 정확히 일치.

- **[INFO]** `resolveTimezone` 메서드에 JSDoc 주석 추가 (`§2.2 — ...`)
  - 위치: diff +4 lines (405-408)
  - 상세: 스펙 섹션 참조 주석으로 새 로직의 목적을 설명. 정보성·적절.

---

### 파일 4: update-workspace-settings.dto.ts

- **[INFO]** `ApiPropertyOptional`, `IsOptional` 임포트 추가 + `timezone` 필드 추가
  - 위치: diff +1 import (ApiPropertyOptional), +1 import (IsOptional), +15 field lines
  - 상세: 워크스페이스 설정 DTO에 `timezone?` 필드 추가. `workspaces.service.ts`의 `dto.timezone` 분기 로직이 이 필드를 소비하므로 범위 내. `ApiPropertyOptional`은 신규 optional 필드에 올바른 데코레이터.

---

### 파일 5: workspaces.service.spec.ts

- **[INFO]** `updateWorkspaceSettings` describe 블록에 테스트 3건 추가 (§2.2 timezone 검증)
  - 위치: diff +50 lines (837-886)
  - 상세: IANA 검증, 빈 문자열 해제, 정상 병합 케이스. 구현과 1:1 대응.

- **[WARNING]** 기존 `getWorkspaceSettings` 테스트 케이스 제목 및 기대값 변경
  - 위치: diff -1/+1 (라인 894-895: 테스트 이름 변경), diff -3/+6 (라인 903-908: expect 내용 변경)
  - 상세: 기존 테스트 `'returns empty array when key absent'`의 제목을 `'returns empty array when origins key absent (timezone 설정은 함께 반환)'`으로 변경하고, 기대값을 `{ interactionAllowedOrigins: [] }`에서 `{ interactionAllowedOrigins: [], timezone: 'Asia/Seoul' }`로 수정. 이 변경은 `getWorkspaceSettings` 반환 타입이 `timezone?` 필드를 포함하도록 확장되어 기존 동작이 달라졌음을 반영하는 것으로, `getWorkspaceSettings` 서비스 코드 변경(`const tz = workspace.settings?.timezone; return { ..., ...(tz ? {timezone: tz} : {}) }`)에 대응한다. 기존 기대값이 틀려졌으므로 테스트 수정은 필수. 범위 내.
  - 제안: 없음. 단 리뷰어는 해당 `getWorkspaceSettings` 서비스 변경이 기존 `getWorkspaceSettings`의 API contract 변경(응답에 `timezone` 필드 추가)임을 인지할 것. 이는 `§2.2` 범위 내 결정으로 `workspaces.service.ts` diff에서 확인됨.

- **[INFO]** 첫 번째 `updateWorkspaceSettings` 테스트(`'merges interactionAllowedOrigins, preserves other keys...'`)는 수정 없이 그대로 유지. 단 이 테스트의 `mockWorkspace` 초기 `settings`는 `{ timezone: 'Asia/Seoul' }`를 포함하도록 설정되어 있어 `nextSettings` 스프레드가 timezone 키를 보존하는지 검증하는 형태가 됨. 이 테스트 케이스는 diff에 포함되지 않았으므로 기존 케이스임 — 범위 초과 아님.

---

### 파일 6: workspaces.service.ts

- **[INFO]** `isValidIanaTimezone` 유틸 함수 추가 (export, 파일 최상단)
  - 위치: diff +10 lines (22-31)
  - 상세: `Intl.DateTimeFormat` 기반 IANA 유효성 검증. `updateWorkspaceSettings`에서 직접 사용. 단일 책임 분리를 위한 추출. `export`로 선언되어 테스트에서 직접 단위 테스트 가능. 범위 내.

- **[INFO]** `updateWorkspaceSettings`에서 `workspace.settings` 할당 로직 확장
  - 위치: diff -3/+20 lines (314-344 구간)
  - 상세: `interactionAllowedOrigins`만 덮어쓰던 기존 로직을 `nextSettings` 변수로 리팩토링하고 `timezone` 분기(없으면 그대로, 빈 문자열이면 key 제거, 유효 IANA면 병합, 무효면 BadRequest) 추가. 기존 `interactionAllowedOrigins` 동작은 유지됨.

- **[INFO]** `getWorkspaceSettings` 반환 타입 확장 + `timezone` 조건부 반환
  - 위치: diff -1/+1 (return type), +2 lines (tz 추출 및 spread)
  - 상세: 기존 `{ interactionAllowedOrigins: string[] }`에서 `{ interactionAllowedOrigins: string[]; timezone?: string }`으로 확장. `settings.timezone`이 존재할 때만 포함. 범위 내.

- **[INFO]** `updateWorkspaceSettings` 메서드 JSDoc의 첫 줄 설명("현재는 `interactionAllowedOrigins` 만 갱신한다") 문구가 서비스 파일 전체 컨텍스트에 그대로 유지됨(diff에 변경 없음). 이제 `timezone`도 처리하므로 기술적으로 stale.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-schedule-gaps-181fe8/codebase/backend/src/modules/workspaces/workspaces.service.ts` 2181번 줄 (전체 파일 컨텍스트 기준)
  - 상세: JSDoc 본문 "현재는 `interactionAllowedOrigins` 만 갱신한다" 문구가 `timezone` 처리 추가 후 부정확해졌다. 범위를 벗어난 stale 주석이 아니라 이번 변경으로 인한 stale이므로 동반 수정이 적절했을 것.
  - 제안: JSDoc을 `"interactionAllowedOrigins` 및 `timezone` 을 갱신한다`" 로 수정 권장.

---

### 파일 7: plan/in-progress/spec-sync-schedule-gaps.md

- **[INFO]** §2.2 항목을 `[x]` 완료로 변경 + 진척 노트 블록 추가 + 체크박스 텍스트 상세화
  - 위치: diff 전체
  - 상세: 구현 완료 항목을 체크하고, 남은 frontend 작업을 명시. plan 파일 갱신은 developer SKILL 요구사항에 따른 정상 동반 변경.

---

### 파일 8: spec/2-navigation/3-schedule.md

- **[INFO]** §2.2 타임존 셀 설명 업데이트
  - 위치: diff -1/+1 (70번 줄 근방)
  - 상세: "하드코딩 fallback/미구현" 문구를 구현된 fallback 체인과 남은 frontend 작업으로 현행화. spec 동기화는 범위 내 정당 변경. developer SKILL은 일반적으로 spec 쓰기를 금지하나, 이 경우 spec 문서의 "현 상태(미구현)" 표기를 구현 완료에 맞게 동기화하는 것은 계획 항목(`spec-sync-schedule-gaps`)의 목적 자체임.

---

## 요약

8개 파일 모두 §2.2 스케줄 타임존 워크스페이스 fallback 구현이라는 단일 목적에 집중되어 있다. 각 변경은 (1) 워크스페이스 설정에 `timezone` 필드 추가, (2) `schedules.service`에서 workspace timezone을 fallback으로 사용하는 `resolveTimezone`, (3) 대응 단위 테스트, (4) 플랜·스펙 문서 동기화로 구성되며 요청 범위를 벗어난 무관한 수정이나 over-engineering은 없다. 유일한 소견은 `workspaces.service.ts`의 `updateWorkspaceSettings` JSDoc 첫 줄이 timezone 처리를 언급하지 않아 stale해진 것으로, 이번 변경이 초래한 누락이므로 동반 수정이 바람직했다.

## 위험도

LOW
