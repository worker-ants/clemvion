# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: `codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts`

- **[INFO]** TSDoc 주석과 `@ApiProperty.description` 내용 이중화 — `last24h` 에서 이미 불일치 발생
  - 위치: `AuthConfigUsagePeriodCountsDto` 의 `last24h`, `last7d`, `last30d` 필드
  - 상세: 이번 변경에서 각 필드에 `/** 최근 24시간 롤링 윈도 호출 건수 (캘린더 일 경계 아님). */` TSDoc을 추가하면서 동시에 `description: '최근 24시간 롤링 윈도 호출 건수.'` 도 유지하고 있다. 두 곳이 같은 내용을 서술하는 이중 소스 구조이며, 이미 `last24h` 의 경우 TSDoc 에는 "(캘린더 일 경계 아님)" 보충 문구가 있으나 `description` 에는 빠져 있어 즉각적인 불일치가 존재한다. `last7d`, `last30d` 는 TSDoc 과 `description` 이 동일하므로 불일치는 없지만 이중화 자체가 미래의 동기화 실수를 유발하는 구조다.
  - 제안: (a) `description` 을 SoT 로 두고 TSDoc 주석을 제거하거나, (b) TSDoc 을 SoT 로 두고 `description` 을 TSDoc 에서 파생하도록 `@ApiProperty({ description: ... })` 를 계산식으로 통일한다. 단기 조치로는 `last24h` 의 `description` 에 "(캘린더 일 경계 아님)" 을 추가해 TSDoc 과 일치시킨다.

- **[INFO]** `@ApiProperty type` 명시가 변경 필드에만 적용되어 파일 내 일관성 미완
  - 위치: `auth-config-response.dto.ts` 파일 전체
  - 상세: `AuthConfigUsagePeriodCountsDto` 세 필드 및 `sourceIp` 에는 `type: Number` / `type: String` 이 추가됐으나, 같은 파일의 `AuthConfigDto.id`, `AuthConfigDto.name`, `AuthConfigDto.isActive`, `AuthConfigUsageDto.totalCalls` 등은 여전히 `type` 없이 TypeScript reflect-metadata 추론에 의존한다. 변경의 목적이 Swagger 스타일 정합이라면 나머지 필드도 동일 패턴을 적용해야 파일 전체 컨벤션이 일치한다.
  - 제안: 파일 전체 primitive 필드에 `type` 명시를 통일하거나, 추론 방식으로 파일 전체 컨벤션을 통일한다. 절충(변경 필드만 명시) 방식은 장기적으로 불일관을 누적시킨다.

- **[INFO]** `AuthConfigUsageCallDto.responseCode` — 인접 필드 대비 `type` 미명시
  - 위치: `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth-configs/dto/responses/auth-config-response.dto.ts` (responseCode 필드, `@ApiProperty` 블록)
  - 상세: 이번 변경에서 `sourceIp` 에 `type: String` 을 추가했으나 바로 아래에 위치한 `responseCode` 의 `@ApiProperty` 에는 `type: String` 이 여전히 없다. 같은 DTO 내에서 인접 필드 간 패턴이 달라 읽는 사람이 의도적 차이인지 실수인지 판단하기 어렵다. 아울러 `responseCode` 의 `description` 은 3줄 문자열 연결 형태로 가독성이 떨어진다.
  - 제안: `type: String` 을 추가하고 긴 `description` 을 줄 분리하거나 TSDoc 주석으로 이동해 인접 `sourceIp` 와 서술 패턴을 맞춘다.

---

### 파일 2: `review/code/2026/06/14/16_34_50/RESOLUTION.md` (신규)

- **[INFO]** RESOLUTION 문서 구조 및 내용 명확성 양호
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/spec-sync-602-followup/review/code/2026/06/14/16_34_50/RESOLUTION.md`
  - 상세: 조치 항목과 오탐/비조치 항목이 테이블로 분리되어 있고 각 근거가 명시되어 있다. 유지보수성 관점에서 특별히 지적할 구조적 문제 없음.
  - 제안: 해당 없음.

---

### 파일 3–4: `review/code/2026/06/14/16_34_50/SUMMARY.md`, `_retry_state.json`, `database.md` 외 리뷰 산출물

- **[INFO]** 리뷰 산출물 파일군 — 유지보수성 관점에서 대상 외
  - 상세: `SUMMARY.md`, `database.md`, `documentation.md`, `maintainability.md`, `requirement.md`, `scope.md`, `_retry_state.json`, `meta.json` 은 리뷰 워크플로 산출물이며 애플리케이션 코드가 아니다. 유지보수성 점검 대상 범위를 벗어나므로 별도 발견사항 없음.

---

## 요약

이번 diff 의 실질적 코드 변경은 `auth-config-response.dto.ts` 의 `@ApiProperty` 메타데이터 보강과 TSDoc 주석 추가뿐이며, 로직 변경은 없다. 함수 길이·중첩 깊이·매직 넘버·코드 복잡도 측면의 문제는 존재하지 않는다. 유지보수성 위험은 두 가지 패턴 불일관에서 비롯된다. 첫째, `last24h` 필드에서 TSDoc 과 `@ApiProperty.description` 이 미묘하게 달라 이미 불일치가 시작됐고, 이중 소스 구조가 지속되면 향후 단방향 수정 시 반드시 불일치가 반복된다. 둘째, `type` 명시가 이번 변경 필드에만 국소적으로 적용되어 파일 내 절반이 명시, 절반이 추론 방식이 돼 혼재 상태가 됐다. `responseCode` 에 `type: String` 이 빠진 것은 인접 `sourceIp` 와 즉각 비교되어 유지보수 시 혼동을 줄 수 있다. 이들 모두 INFO 수준이며 즉각적 차단 이슈는 없으나, `last24h` description 불일치는 다음 커밋에서 수정하는 것이 합리적이다.

## 위험도

LOW

STATUS=success ISSUES=3
