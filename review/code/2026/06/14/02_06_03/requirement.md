# Requirement Review

## 발견사항

### [SPEC-DRIFT] [WARNING] `data-flow/12-workspace.md` §1.7 — `timezone` 을 `settings` 엔드포인트 대상으로 명시하지 않음
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `updateWorkspaceSettings`, `getWorkspaceSettings`; `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- **상세**: `spec/data-flow/12-workspace.md` §1.7 은 "현 단계 `settings` 부분 키는 `interactionAllowedOrigins` 만(`timezone` 등은 본 엔드포인트 비대상)" 이라고 명시한다. 또한 Mermaid 시퀀스 다이어그램 request body 에도 `{ interactionAllowedOrigins }` 만 표기돼 있다. `spec/2-navigation/9-user-profile.md` §6.1(§4.3) 표도 동일하게 body `{ interactionAllowedOrigins: string[] }` 만 정의한다. 이번 PR 은 `UpdateWorkspaceSettingsDto` 에 `timezone?: string` 를 추가하고, `updateWorkspaceSettings` 에 IANA 검증+병합 로직을, `getWorkspaceSettings` 반환 타입에 `timezone?: string` 을 추가했다. 이 변경은 spec 에 반영되지 않은 의도적 기능 확장이며 구현 자체는 논리적으로 타당하다(§2.2 fallback 을 위한 필수 전제). 단 spec 문서 3곳(`data-flow/12-workspace.md §1.7 시퀀스·본문`, `9-user-profile.md §6.1 API 표 2행`, `3-schedule.md §2.2 업데이트된 설명` 중 data-flow·user-profile 두 곳)이 낡았다.
- **제안**: 코드 유지 + spec 갱신. 갱신 대상: `spec/data-flow/12-workspace.md §1.7` 시퀀스 다이어그램 request body 에 `{ interactionAllowedOrigins, timezone? }` 추가, 본문 "비대상" 설명 수정. `spec/2-navigation/9-user-profile.md §6.1` PATCH/GET 표 양 행의 body·응답 타입에 `timezone?: string` 추가. (`spec/2-navigation/3-schedule.md §2.2` 타임존 행은 이번 PR 에서 이미 업데이트됨.)

---

### [WARNING] `resolveTimezone` 하드코딩 기본값 `'Asia/Seoul'` vs. 데이터 모델 spec 기본값 불일치
- **위치**: `codebase/backend/src/modules/schedules/schedules.service.ts` — `resolveTimezone` (line 483); `spec/1-data-model.md §2.2`
- **상세**: `spec/1-data-model.md §2.2` workspace settings `timezone` 항목은 "미설정 시 서버 default `process.env.TZ` → `UTC`" 를 명시한다. `resolveTimezone` 는 workspace.settings.timezone 도 없을 때의 최종 fallback 으로 `'Asia/Seoul'` 을 하드코딩 반환한다. 즉 스케줄 타임존 fallback 체인은 `명시값 > workspace.settings.timezone > 'Asia/Seoul'` 이고, 데이터 모델이 정의한 workspace 미설정 시 서버 default 체인(`process.env.TZ → UTC`)을 무시한다. 이는 코드 실수인지 의도적 KST 제품 기본값인지 판단이 모호하다. 만약 비-KST 서버 환경에서도 항상 `'Asia/Seoul'` 로 스케줄이 생성되기를 의도한 것이라면 spec에서 Schedule 전용 최종 fallback 을 명시해야 하며, 그렇지 않다면 spec 과 일치시켜 `process.env.TZ ?? 'UTC'` 로 수정해야 한다. 회색지대로 판단해 SPEC-DRIFT 가 아닌 WARNING 으로 남긴다.
- **제안**: 의도 확인 필요. (a) KST 제품 기본값이면 `spec/2-navigation/3-schedule.md §2.2` 및 `spec/1-data-model.md §2.2` Schedule 전용 fallback 로 `'Asia/Seoul'` 명시. (b) 서버 환경 기반이면 `return process.env.TZ || 'UTC'` 로 변경.

---

### [WARNING] `UpdateWorkspaceSettingsDto.timezone` DTO 유효성 검증 — IANA 검증 누락
- **위치**: `codebase/backend/src/modules/workspaces/dto/update-workspace-settings.dto.ts`
- **상세**: DTO 주석은 "IANA 유효성은 서비스 계층이 `Intl.DateTimeFormat` 으로 검증" 이라 명시한다. class-validator 에는 `@IsString()`, `@MaxLength(64)` 만 있고 IANA 형식 사전 거부(예: `/^[A-Za-z]+\/[A-Za-z_+\-]+$/` Regex) 나 커스텀 데코레이터가 없다. 따라서 임의의 긴 문자열이 DTO 통과 후 서비스 계층까지 전달돼 `isValidIanaTimezone` 에서 거부된다. 이 설계는 의도적(서비스 계층 단일 검증 지점)이라 허용될 수 있으나, DTO 수준의 형식 가드(`@Matches`)를 두지 않으면 향후 다른 경로에서 서비스를 호출할 때 우회 가능성이 있다. MaxLength(64)는 `America/Indiana/Indianapolis` (29자) 같은 합법적 긴 IANA 이름 수용에는 충분하다.
- **제안**: 서비스 계층 검증이 분명히 존재하므로 CRITICAL 은 아니나, DTO 에 `@Matches(/^[A-Za-z][A-Za-z0-9_+\-.\/]*$/)` 같은 IANA 형식 사전 필터를 추가해 방어 레이어를 강화하는 것을 고려한다.

---

### [INFO] `update` 메서드에서 타임존 변경 시 workspace fallback 미적용
- **위치**: `codebase/backend/src/modules/schedules/schedules.service.ts` — `update` (약 line 588-636)
- **상세**: `create` 는 `resolveTimezone` 로 workspace fallback 을 수행하지만, `update` 에서 `dto.timezone` 를 처리하는 부분(`if (dto.timezone) schedule.timezone = dto.timezone;`)은 빈 문자열/null 을 timezone 해제 시 기존 스케줄 값을 그대로 유지하는 방식이다. 이는 `update` 에서 타임존 `null` 전달로 workspace fallback 재적용을 할 수 없음을 의미한다. spec §2.2 는 "미지정 시 fallback" 을 create 시나리오로만 설명하고 update 에서의 재-fallback 은 정의하지 않으므로 기능 누락이 아닌 설계 범위 한정으로 볼 수 있다. 문서화 의도와 부합한다.
- **제안**: spec §2.2 가 update 시 재-fallback 을 요구하지 않으므로 현 상태 유지 가능. 향후 명확화 필요 시 spec 에 명시.

---

### [INFO] `getWorkspaceSettings` 반환 타입 — spec §6.1 응답 타입 vs. 구현
- **위치**: `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `getWorkspaceSettings` 반환 타입; `spec/2-navigation/9-user-profile.md §6.1`
- **상세**: spec §6.1 `GET /api/workspaces/:id/settings` 응답은 `{ interactionAllowedOrigins: string[] }` 만 정의한다. 구현은 `{ interactionAllowedOrigins: string[]; timezone?: string }` 를 반환한다. SPEC-DRIFT 항목(첫 번째 발견사항)과 같은 근거이며, spec 갱신이 필요한 위치를 재확인하는 INFO.

---

### [INFO] `spec/2-navigation/3-schedule.md §2.2` — 업데이트된 설명이 구현과 일치
- **위치**: `spec/2-navigation/3-schedule.md` 파일 8
- **상세**: 이번 PR 에서 spec §2.2 타임존 행이 `resolveTimezone` 체인(`명시값 > workspace settings.timezone > 'Asia/Seoul'`)을 정확히 설명하도록 업데이트됐다. 또한 frontend 잔여(workspace 설정 폼 timezone 입력 UI)를 Planned 로 명확히 분리했다. spec 내용과 구현이 일치한다.

---

## 요약

이번 변경은 §2.2 스케줄 타임존 워크스페이스 기반 fallback의 backend 핵심 기능을 올바르게 구현했다. `resolveTimezone` 로직(명시값 우선, workspace.settings.timezone 조회, 'Asia/Seoul' 최종 fallback), IANA 유효성 검증(`isValidIanaTimezone`), `UpdateWorkspaceSettingsDto.timezone` 추가, `getWorkspaceSettings` 확장이 모두 정합적으로 구현돼 있고, 테스트 6건(schedules 3건, workspaces 3건)이 핵심 경로를 커버한다. 주요 미결 사항은 두 가지다: (1) `data-flow/12-workspace.md §1.7` 과 `9-user-profile.md §6.1` 이 `timezone` 를 설정 엔드포인트 대상에서 제외하는 낡은 서술을 유지하고 있어 spec 갱신이 필요하다 (SPEC-DRIFT); (2) `resolveTimezone` 의 최종 fallback `'Asia/Seoul'` 이 `spec/1-data-model.md §2.2` 의 `process.env.TZ → UTC` 체인과 다르며, 의도적 한국 제품 기본값인지 spec 불일치인지 확인이 필요하다 (WARNING).

## 위험도

**LOW** — 기능 자체는 올바르게 동작하며 테스트로 검증됐다. spec 불일치는 문서 갱신 누락(SPEC-DRIFT)이 주를 이루고, 'Asia/Seoul' fallback 불일치는 한국 제품 맥락에서 수용 가능한 설계 선택으로 추정된다. 다만 비-KST 배포 환경 지원이 향후 요구된다면 fallback 값 재검토가 필요하다.
