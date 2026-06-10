## 발견사항

### [WARNING] Schedule spec(§2.2) 의 타임존 기본값이 data-model spec 과 불일치

- **target 위치**: `spec/2-navigation/3-schedule.md §2.2` — "미지정 시 서버가 `'Asia/Seoul'` 로 하드코딩 fallback … 워크스페이스 설정 기반 기본값은 미구현/Planned (워크스페이스에 timezone 설정 자체가 아직 없음)"
- **충돌 대상**: `spec/1-data-model.md §2.2 Workspace.settings` — `timezone: string?` (IANA, NAV-SC-06) 가 이미 정의됨: "미설정 시 서버 default `process.env.TZ` → `UTC`. … Schedule 의 default timezone 이 본 값을 참조"
- **상세**: data-model 은 워크스페이스 `settings.timezone` 이 구현 완료(NAV-SC-06 ✅)되어 있고 Schedule 의 default timezone 이 이를 참조한다고 명시한다. 반면 schedule spec 은 이 필드가 아직 없다("워크스페이스에 timezone 설정 자체가 없음")며 `'Asia/Seoul'` 하드코딩 fallback 을 현행으로 기술한다. 또한 fallback 값도 다르다: data-model 은 `UTC`, schedule spec 은 `'Asia/Seoul'`.
- **제안**: schedule spec §2.2 를 data-model 정의와 동기화한다. 두 가지 확인 사항: (a) `SchedulesService.create` 가 실제로 workspace.settings.timezone 을 읽는지 또는 여전히 `'Asia/Seoul'` 하드코딩인지 코드 확인, (b) 확인 결과에 따라 schedule spec 의 "미구현/Planned" 표기를 갱신하거나 data-model 의 "참조" 표현을 "미구현" 으로 정정. 이 불일치는 `plan/in-progress/spec-sync-schedule-gaps.md` 의 미체크 항목 "타임존 미지정 시 워크스페이스 설정 기반 기본값 (§2.2)" 으로 이미 추적 중이다.

---

### [INFO] Schedule spec 에 `parameter_values` 필드 미노출

- **target 위치**: `spec/2-navigation/3-schedule.md §2.2` 스케줄 생성/수정 다이얼로그 — 필드 목록에 `parameter_values` 없음
- **충돌 대상**: `spec/1-data-model.md §2.9 Schedule` — `parameter_values JSONB` 필드가 정의되어 있음(워크플로우 Manual Trigger 노드 스키마 대응 파라미터 값 맵). `spec/5-system/4-execution-engine.md §6.1.1` 및 `spec/data-flow/10-triggers.md §1.4` 에서 cron 자동 발화 시 `schedule.parameterValues` 를 사용하는 것으로 기술
- **상세**: schedule spec 의 생성/수정 다이얼로그 필드 목록에 `parameter_values` 가 없다. 데이터 모델 및 실행 엔진 spec 은 이 필드가 스케줄 생성 시 저장되고 실행 시 파라미터로 주입된다고 명시한다. UI 에 파라미터 입력 폼이 없다면 spec 에 미구현(Planned) 표기가 필요하고, 있다면 spec §2.2 에 누락된 필드다.
- **제안**: schedule spec §2.2 에 `parameter_values` 필드와 현재 구현 상태(UI 제공 여부)를 명시. 미구현이라면 "Planned" 표기 추가.

---

### [INFO] `spec/2-navigation/3-schedule.md` 의 연결된 워크플로우 링크 미구현 표기 — 관련 영역 동기화 필요

- **target 위치**: `spec/2-navigation/3-schedule.md §2.1` — "연결된 워크플로우 이름 표기 (현재 단순 텍스트. 에디터로 이동하는 링크는 미구현/Planned)"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §2.1` — "연결된 워크플로우: '→ 워크플로우 이름' 형태로 표시. 클릭 시 해당 에디터로 이동"
- **상세**: 트리거 목록 화면은 같은 워크플로우 연결 표시에서 에디터 이동 링크가 구현 완료다. 스케줄 목록 화면은 동일 UI 패턴에서 링크가 미구현으로 남아 있다. 두 화면 간 동일 기능의 구현 상태가 다를 수 있으나, schedule spec 에 미구현 표기가 명시되어 있으므로 실제 모순은 아니다. 다만 `plan/in-progress/spec-sync-schedule-gaps.md` 에서 미체크 항목으로 추적 중이다 — 향후 구현 완료 시 양 spec 을 함께 동기화할 것을 권장.
- **제안**: 스케줄 화면에서 워크플로우 링크가 구현되면 schedule spec §2.1 과 plan 파일의 체크박스를 함께 갱신.

---

### [INFO] 현재 작업(trigger-schedule-reverse-sync)의 spec 갱신 4곳 중 1곳(2-trigger-list §4.3)의 명시적 확인

- **target 위치**: `plan/in-progress/spec-update-trigger-schedule-sync.md §3 연관 spec 파일` — "`spec/2-navigation/2-trigger-list.md §4.3` — 해당 섹션 검토 후 필요 시 추가 수정"
- **충돌 대상**: `spec/2-navigation/2-trigger-list.md §4.3` cascade 동작 + §4.4
- **상세**: 현재 `trigger-list.md §4.3 / §4.4` 는 이미 `removeJob` 호출과 양방향 동기화 완료를 정확히 기술하고 있다 (`data-flow §1.4` 참조 포함). plan 파일이 "검토 후 필요 시 추가 수정" 으로 남겨 놓은 이 항목은 현행 spec 내용으로 볼 때 추가 수정이 불필요한 상태다.
- **제안**: plan 파일의 해당 항목을 "검토 완료 — trigger-list §4.3/§4.4 은 이미 역방향 동기화 완료를 정확히 반영 중, 추가 수정 불필요"로 닫는다.

---

## 요약

`spec/2-navigation/` 영역의 Cross-Spec 일관성 관점에서 직접 모순(CRITICAL) 은 없다. 가장 주의를 요하는 항목은 **WARNING 등급의 타임존 기본값 불일치**로, schedule spec §2.2 가 `'Asia/Seoul'` 하드코딩 + "워크스페이스 timezone 미존재" 로 기술하는 반면 data-model §2.2 는 워크스페이스 `settings.timezone` 이 이미 구현(NAV-SC-06 ✅)되어 있고 Schedule 이 이 값을 참조한다고 명시한다. fallback 값도 spec 간 `'Asia/Seoul'` vs `UTC` 로 다르다. 이 불일치는 plan 파일에서 추적 중이나 아직 미해소 상태로 spec 에 남아 있어 구현자와 리뷰어 모두 혼란을 줄 수 있다. INFO 항목들(parameter_values 누락, 워크플로우 링크 미구현 표기, trigger-list §4.3 확인 완료)은 현행 기능 gap 표기로 모순은 아니지만 동기화 권장 대상이다.

## 위험도

LOW
