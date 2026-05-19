# 정식 규약 준수 검토 — Convention Compliance

검토 모드: `--impl-prep`
검토 범위: Cafe24 background refresh cron 주기 단축 (24h → 6h) + cutoff 마진 격상 (REFRESH_PROACTIVE_THRESHOLD_DAYS 10일 → 7일)
대상 파일:
- `codebase/backend/src/modules/integrations/cafe24-token-refresh.constants.ts`
- `codebase/backend/src/modules/integrations/integration-expiry-scanner.service.ts`
- `plan/in-progress/cafe24-bg-refresh-tuning.md`

---

## 발견사항

### [INFO] JSDoc 마진 수치가 현재 값(N=10)과 괴리 — 구현 전 갱신 대상 확인

- target 위치: `cafe24-token-refresh.constants.ts` 라인 28–35 (`REFRESH_PROACTIVE_THRESHOLD_DAYS` JSDoc)
- 위반 규약: CLAUDE.md §정보 저장 위치 "기술 명세" 항목 — 기술 명세 본문은 현행 값을 정확히 반영해야 한다 (단일 진실 원칙)
- 상세: 현재 JSDoc 은 `N=10 → 4일 마진` 이라고 적혀 있다. plan 문서(§1)도 동일하게 "갱신 필요" 로 체크리스트에 포함되어 있으므로 개발자가 인지하고 있음. 구현 착수 전 점검으로, 실제 변경 시 `N=7 → 7일 마진` 으로 갱신하는 것을 누락하지 않아야 한다. 서비스 파일 라인 171–172 의 인라인 코멘트 (`14일 마감 전 4일의 안전 마진 확보`) 도 동일하게 7일로 갱신이 필요하다 (현재 미완료 상태).
- 제안: 구현 시 다음 두 곳을 함께 갱신한다.
  1. `cafe24-token-refresh.constants.ts` 라인 31–35: `N=7 → 7 일 마진` 으로 수치 및 설명 교체.
  2. `integration-expiry-scanner.service.ts` 라인 171–172: `(기본 10일). 14일 마감 전 4일의 안전 마진 확보.` → `(기본 7일). 14일 마감 전 7일의 안전 마진 확보.`

---

### [INFO] scheduler ID 보존 결정과 코드 코멘트 불일치 — 구현 시 명시 필요

- target 위치: `integration-expiry-scanner.service.ts` 라인 119–127 (`upsertJobScheduler('cafe24-background-refresh-daily', repeat, ...)`)
- 위반 규약: CLAUDE.md §정보 저장 위치 — 결정의 배경·근거는 해당 spec 문서 끝의 `## Rationale` 또는 코드 내 코멘트로 명시. plan 문서(§2 §"scheduler ID 변경하지 않음" + §결정사항) 에는 이유가 명시되어 있으나, 현재 코드에는 `'cafe24-background-refresh-daily'` 문자열만 있고 "ID 는 orphan 회피를 위해 historical 로 유지, 실제 주기는 6h" 라는 설명이 없다.
- 상세: plan 이 명시한 대로 "이름은 historical 로 두고 코멘트로 실제 주기 명시"를 구현 시 코드에 반영하지 않으면, 추후 유지보수자가 ID 와 실제 repeat 패턴 불일치를 혼동할 수 있다.
- 제안: 구현 시 해당 `upsertJobScheduler` 호출 위에 인라인 코멘트 추가.
  예시:
  ```ts
  // ID 는 'cafe24-background-refresh-daily' 로 보존 — BullMQ upsertJobScheduler
  // 는 same ID 를 갱신하므로, ID 변경 시 옛 daily entry 가 Redis 에 orphan 으로
  // 남아 계속 fire 된다. 이름은 historical. 실제 주기는 6h (아래 repeat 참조).
  await this.queue.upsertJobScheduler(
    'cafe24-background-refresh-daily',
    { pattern: '0 */6 * * *', tz: 'UTC' },
    ...
  );
  ```

---

### [INFO] plan 체크리스트 — spec 갱신이 "후속 별도 PR" 로 위임되어 있음

- target 위치: `plan/in-progress/cafe24-bg-refresh-tuning.md` §후속 (별도 PR — 본 plan 범위 외)
- 위반 규약: CLAUDE.md §정보 저장 위치 "제품 정의·요구사항" + §개발 방법론 SDD
- 상세: `spec/2-navigation/4-integration.md` 및 `spec/data-flow/integration.md` 에 cafe24 background refresh 주기 / cutoff 마진이 명시되어 있다면, 본 구현이 완료된 이후 spec 이 stale 상태로 남을 수 있다. plan 이 "후속 별도 PR — project-planner 위임" 으로 명기하고 있으므로 의도적 분리임을 확인. 단일 진실 원칙 위반은 아니지만, 위임 후 미이행 시 spec 과 코드 간 drift 가 발생한다.
- 제안: 본 PR 머지 후 별도 project-planner 태스크(`spec/2-navigation/4-integration.md` §10.5, `spec/data-flow/integration.md` §1.4 갱신)를 plan/in-progress 에 생성하고 worktree 를 지정한다. 본 plan 에 링크로 참조를 남기면 추적성이 높아진다.

---

## 규약 적합성 확인 사항 (이상 없음)

다음 항목은 관련 규약과 대조하여 위반 없음을 확인하였다.

1. **명명 규약**
   - 상수명 `REFRESH_PROACTIVE_THRESHOLD_DAYS`, `CAFE24_REFRESH_QUEUE`, `CAFE24_REFRESH_JOB` 등: 모두 UPPER_SNAKE_CASE. 규약 위반 없음.
   - BullMQ scheduler ID `'cafe24-background-refresh-daily'`: 기존 ID 보존이 plan 에 명시된 의도이며 orphan 회피를 위한 결정. 규약 위반 없음 (historical 보존 이유 있음).
   - `JOB_CAFE24_BACKGROUND_REFRESH`, `JOB_CONNECTED_EXPIRY` 등 job 이름 상수: 일관된 상수 선언 패턴. 규약 위반 없음.

2. **출력 포맷 규약**
   - 변경 대상은 상수 값과 BullMQ repeat 객체 패턴이며, API 응답·이벤트 페이로드·에러 코드 형식에 영향 없음.
   - `Cafe24RefreshJobData` 인터페이스 변경 없음. `source: 'proactive' | 'background' | 'reactive_401'` 유지.

3. **API 문서 규약 (Swagger)**
   - 변경 대상 파일은 상수·서비스 파일이며 Controller/DTO 가 아님. Swagger 데코레이터 패턴 (`spec/conventions/swagger.md`) 적용 대상 외.

4. **마이그레이션 규약**
   - 변경 대상에 스키마 변경 없음. `spec/conventions/migrations.md` 적용 대상 외.

5. **Cafe24 API Catalog 동기 규약**
   - 신규 endpoint 추가 없음. `spec/conventions/cafe24-api-catalog/_overview.md` §4·§6 의 카탈로그 동기 갱신 의무 없음.

6. **plan 문서 구조**
   - `plan/in-progress/cafe24-bg-refresh-tuning.md` 에 frontmatter (`worktree`, `started`, `owner`) 존재. CLAUDE.md §정보 저장 위치 준수.

7. **금지 항목**
   - `subprocess.run(["claude", ...])` 또는 Anthropic SDK 직접 호출: 대상 파일에 없음.
   - spec/ 직접 수정 (developer 역할 금지): plan 은 후속 project-planner 위임으로 명시. 규약 준수.

---

## 요약

본 변경(cron 주기 24h → 6h, cutoff 10일 → 7일)은 신규 spec / 식별자 / API endpoint / DTO / 마이그레이션을 추가하지 않으므로, 대부분의 정식 규약 적용 범위 외에 해당한다. 발견된 사항은 모두 INFO 등급으로, CRITICAL·WARNING 위반은 없다. 주요 주의 사항은 두 가지다: (1) 구현 시 JSDoc 및 인라인 코멘트의 마진 수치(4일 → 7일)를 코드 두 곳에서 빠짐없이 갱신해야 단일 진실 원칙이 유지된다. (2) BullMQ scheduler ID 보존 이유(orphan 회피)를 코드 인라인 코멘트로 명시해야 유지보수 혼동을 예방할 수 있다. plan 이 이 두 사항을 이미 체크리스트에 포함하고 있어 개발자가 인지하고 있음을 확인하였다.

---

## 위험도

LOW
