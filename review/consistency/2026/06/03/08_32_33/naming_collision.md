# 신규 식별자 충돌 검토 결과

대상: `plan/in-progress/spec-draft-system-status-recent-failed.md`

---

## 발견사항

### 요구사항 ID 충돌 — 없음

target 이 신규 도입하는 `NAV-SS-07`, `NAV-SS-08` 은 기존 표에 존재하지 않는다.
기존 표는 `NAV-SS-01` ~ `NAV-SS-06` 까지 연속 부여되어 있으며(`spec/2-navigation/_product-overview.md` §3.9), `NAV-SS-07`/`08` 은 충돌 없이 이어진다.

### 엔티티/타입명 충돌 — 없음

- `totalRecentFailed`, `recentFailed`, `failedWindowMinutes` — 기존 `SystemStatusOverviewDto` / `QueueStatusDto` 에 없는 신규 필드. 충돌 없음 (`codebase/backend/src/modules/system-status/dto/system-status-response.dto.ts`).
- `QueueStatusDto`, `SystemStatusOverviewDto` 명칭 자체는 additive 변경이므로 기존 이름과 충돌 없음.

### **[WARNING]** Rationale 번호 — R-5(API) 가 기존 이 파일 내 R-4 다음으로 추가되므로 문서 내 순번 충돌은 없으나, target 의 `15-system-status.md §B` 에 "Rationale R-3 (UI spec, 신규 정식 항목)" 을 추가한다고 명시한다.

- target 신규 식별자: `### R-3` (`spec/2-navigation/15-system-status.md` Rationale 절에 신규 추가)
- 기존 사용처: `spec/2-navigation/15-system-status.md` 현재 Rationale 절에는 `### R-1` 과 `### R-2` 만 존재하며 `R-3` 은 없다. 따라서 동일 파일 내 충돌은 없음.
- `R-3` 레이블 자체는 `spec/2-navigation/2-trigger-list.md:212` 의 `### R-3. 삭제 confirmation 텍스트를 type 별로 분기한 이유` 에서 이미 사용 중이고, `spec/5-system/16-system-status-api.md:92` 의 `### R-3. 워커 미가동 판정의 한계` 에서도 사용 중이다. 하지만 Rationale 번호는 문서 내 로컬 앵커로만 쓰이므로 **크로스-파일 의미 충돌은 없다**. WARNING 등급으로 기록하지만 차단 사유는 아님.
- 제안: 특이사항 없음. 동일 문서 내에서 중복되지 않으면 충분하다.

### **[WARNING]** Rationale R-5 — API spec 내부 번호 충돌 없음, 타 파일 동명 존재

- target 신규 식별자: `### R-5` (`spec/5-system/16-system-status-api.md` Rationale 절 신규 추가)
- 기존 사용처: `spec/5-system/16-system-status-api.md` 현재 Rationale 절은 `R-1` ~ `R-4` 까지만 있으므로 동일 파일 내 충돌 없음. 단, `spec/2-navigation/2-trigger-list.md:232` 와 `spec/conventions/spec-impl-evidence.md:193`, `spec/conventions/user-guide-evidence.md:181` 에 각각 `### R-5` 레이블이 존재한다. 이들은 각기 다른 맥락 문서이므로 실질 충돌은 없다.
- 제안: 이 역시 문서 로컬 앵커이므로 현행 패턴과 일치. 무시해도 무방.

### API endpoint 충돌 — 없음

target 은 `GET /api/system-status/overview` 에 기존 DTO 필드를 additive 추가하는 것이며, 새로운 endpoint 경로·메서드를 신설하지 않는다. 충돌 없음.

### **[INFO]** 환경변수 신규 도입 — 기존 키와 충돌 없음, 명명 체계 일관

- target 신규 ENV vars: `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, `SYSTEM_STATUS_FAILED_SCAN_CAP`
- 기존 사용처: `codebase/backend/.env.example` 에 `SYSTEM_STATUS_FAILED_THRESHOLD=1`, `SYSTEM_STATUS_DELAYED_THRESHOLD=50` 이 있으며, 두 신규 키는 이 파일에 존재하지 않는다. 이름 패턴(`SYSTEM_STATUS_` prefix)도 동일하게 유지된다. 충돌 없음.
- 제안: 명명 일관성 유지됨. spec `§2 구현 노트` 에 기본값(`60`, `1000`)을 명확히 기록해 두는 현재 방식이 적절하다.

### **[INFO]** i18n 키 신규 도입 — 기존 키와 충돌 없음

- target 신규 i18n 키(예시): `systemStatus.counts.recentFailed`, `systemStatus.counts.retainedFailed`, `systemStatus.totalRecentFailed`, `systemStatus.failedWindow`
- 기존 사용처: `codebase/frontend/src/lib/i18n/dict/ko/systemStatus.ts` 와 `en/systemStatus.ts` 에 `systemStatus.counts.failed`, `systemStatus.totalFailed` 가 있으며, 신규 키는 없다. 충돌 없음.
- 제안: 기존 `systemStatus.counts.failed` 키는 "보관 중 누적" 의미로 의미가 바뀌므로, i18n 값 변경(`"실패"` → `"실패(누적 보관)"` 등)도 spec §B §3 변경안에 포함되었는지 확인 권장. spec `§B §2.3` 에 "주 수치 / 부 수치" 로 분리한다고 기술하고 있어 키 추가는 명시적이나, **기존 `systemStatus.counts.failed` 키의 라벨 값 변경**은 target 에서 명시적으로 언급하지 않는다. 구현 시 누락 가능성이 있으므로 developer plan 에 명시 권장.

### 파일 경로 충돌 — 없음

target 이 변경하는 파일은 `spec/5-system/16-system-status-api.md`, `spec/2-navigation/15-system-status.md`, `spec/2-navigation/_product-overview.md` 로, 기존에 존재하는 파일의 본문 변경이다. 신규 파일을 생성하지 않으므로 경로 충돌 없음.

### 코드 상수 충돌 — 없음

- target 의 `FAILED_DEGRADED_THRESHOLD`, `DELAYED_DEGRADED_THRESHOLD` 는 이미 `codebase/backend/src/modules/system-status/system-status.constants.ts:84,86` 에 선언되어 있고, target 은 이 상수의 **의미를 재정의**하는 것이 아니라 spec 에 명시적으로 env ↔ 상수 매핑을 기술하는 것이다. 기존 코드 상수와 충돌 없음.

---

## 요약

target 이 도입하는 신규 식별자(NAV-SS-07/08, `totalRecentFailed`, `recentFailed`, `failedWindowMinutes`, `SYSTEM_STATUS_FAILED_WINDOW_MINUTES`, `SYSTEM_STATUS_FAILED_SCAN_CAP`, i18n 키 4종)는 기존 spec·코드베이스에서 동일 이름으로 다른 의미로 사용되는 사례가 없다. Rationale 번호 R-3/R-5 는 다른 spec 문서에도 존재하지만 문서 내 로컬 앵커로 크로스-파일 충돌이 아니다. 기존 `systemStatus.counts.failed` i18n 라벨 값이 의미 변경 대상임에도 spec 변경안에 명시적으로 기술되지 않은 점은 INFO 수준 보완 제안으로 기록한다.

---

## 위험도

LOW
