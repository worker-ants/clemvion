# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`  
Target 범위: `spec/2-navigation/6-config.md` (§A.3 호출 이력 구현)  
Diff base: `origin/main`

---

## 발견사항

### 1. **[WARNING]** `spec/1-data-model.md` §2.13 Execution 엔티티에 `source_ip`/`response_code` 컬럼 미반영

- target 위치: 구현 diff — `codebase/backend/migrations/V096__execution_source_ip_response_code.sql`, `execution.entity.ts`
- 충돌 대상: `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.13 Execution 필드 테이블 (줄 452–475)
- 상세: 구현이 `Execution` 테이블에 `source_ip VARCHAR(45)` · `response_code VARCHAR(10)` 두 컬럼을 추가했다(V096). 그러나 `spec/1-data-model.md` §2.13의 Execution 필드 목록에 이 두 컬럼이 없다. `resume_call_stack`(V087)까지는 기재되어 있고 그 이후 항목이 누락된 상태이다. spec 단일 진실(SoT) 원칙 상 데이터 모델의 정식 정의가 data-model.md에 있어야 한다.
- 제안: `spec/1-data-model.md` §2.13 Execution 필드 테이블에 다음 두 행을 추가하고, §2.13 아래 "AuthConfig 호출 집계 경로 SoT" callout을 함께 기재한다.
  - `source_ip | Varchar(45)? | NULL 허용 (V096). webhook/chat-channel 트리거 발화 시 extractClientIp 결과. 비-HTTP 트리거·배포 이전 row 는 NULL. config §A.3 호출 이력 소스 IP 컬럼 소스.`
  - `response_code | Varchar(10)? | NULL 허용 (V096). webhook 호출이 받는 실제 HTTP 응답 코드 문자열 (성공 경로 = '202'). 비-HTTP 트리거는 NULL → getUsage 가 status enum 으로 폴백 표시. WH-MG-05 이행.`

---

### 2. **[WARNING]** `spec/2-navigation/6-config.md` §A.3 구현 상태 표가 여전히 "미구현 / Planned"

- target 위치: 구현 완료된 기능 전체 (periodCounts, sourceIp, responseCode)
- 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` §A.3 줄 101–102
- 상세: spec §A.3의 표가 다음과 같이 현 구현 상태와 어긋난다.
  - 줄 101: `기간별 호출 수` → "🚧 미구현 (Planned)" — 구현은 `periodCounts: { last24h, last7d, last30d }` 를 완전 구현했다.
  - 줄 102: `호출 이력 테이블` → "소스 IP·응답 코드 컬럼은 미구현 / Planned" — 구현은 `sourceIp`·`responseCode`를 DTO·서비스·프런트엔드에 완전 추가했다.
  - 이 상태에서 spec을 읽는 개발자는 "Planned" 항목을 재구현할 위험이 있고, impl-done 사이클의 후속 검증도 오탐 가능하다.
- 제안: `spec/2-navigation/6-config.md` §A.3 표를 다음과 같이 갱신한다.
  - 줄 101: `기간별 호출 수 | 롤링 윈도(24h/7d/30d) 호출 건수 (캘린더 버킷 아님) | ✅ periodCounts.{last24h, last7d, last30d} — COUNT FILTER 단일 쿼리, Rolling window`
  - 줄 102: `호출 이력 테이블 | 대상 트리거명, 상태, 소스 IP, 응답 코드, 시각 (최근 20건) | ✅ recentCalls — triggerName/status/sourceIp/responseCode/startedAt. 비-HTTP 트리거는 sourceIp=null, responseCode=status enum 폴백`

---

### 3. **[INFO]** `spec/2-navigation/6-config.md` §A.3 "기간별 호출 수" 설명이 "일/주/월 기준" — 구현은 "롤링 윈도(24h/7d/30d, 캘린더 버킷 아님)"

- target 위치: 구현 — `auth-configs.service.ts` `USAGE_PERIOD_WINDOWS_MS`, DTO 주석 `"Rolling 24-hour window count (not calendar day)."`
- 충돌 대상: `/Volumes/project/private/clemvion/spec/2-navigation/6-config.md` §A.3 줄 101 — "일/주/월 기준 호출 횟수"
- 상세: spec은 "일/주/월" (캘린더 경계를 암시), 구현은 "last 24h / last 7d / last 30d" 롤링 윈도 (`now - Xms`)다. 캘린더 경계 기반과 롤링 윈도는 값이 다를 수 있어 사용자 가이드·UI 표기 결정에 영향을 준다. 현재 UI 레이블도 "Last 24h / Last 7d / Last 30d"로 롤링을 시사한다.
- 제안: spec §A.3 설명을 "롤링 윈도(24h/7d/30d) 호출 횟수 — 캘린더 경계 아님, 현재 시각 기준 moving window"로 명확화한다. 구현과 DTO 주석은 이미 정확하다.

---

### 4. **[INFO]** `spec/5-system/12-webhook.md` WH-MG-05 요구사항이 "응답 코드 확인 필수"로만 기술 — 구현 경로(Execution 컬럼) 참조 없음

- target 위치: 구현 diff — migration V096 주석, hooks.service.ts 주석에 `WH-MG-05` 참조
- 충돌 대상: `/Volumes/project/private/clemvion/spec/5-system/12-webhook.md` 줄 93 (WH-MG-05 행)
- 상세: WH-MG-05 요구사항 행에 구현 경로(`Execution.response_code`, config §A.3)에 대한 참조가 없다. 요구사항만 있고 어느 엔티티·API 에서 이행되는지 추적이 어렵다.
- 제안: `spec/5-system/12-webhook.md` WH-MG-05 행에 "이행: `Execution.response_code` (V096) → `GET /api/auth-configs/:id/usage` recentCalls.responseCode (config §A.3)" 주석을 추가한다.

---

## 요약

구현이 `spec/2-navigation/6-config.md` §A.3의 "Planned/미구현" 항목(기간별 호출 수, 소스 IP, 응답 코드)을 완전히 구현했으나, 두 개의 상위 spec(`spec/1-data-model.md` §2.13, `spec/2-navigation/6-config.md` §A.3 상태 표)이 갱신되지 않아 구현과 spec 간 의미 불일치 상태다. `spec/1-data-model.md` §2.13 Execution 테이블에 `source_ip`/`response_code` 컬럼이 없는 것이 가장 직접적인 데이터 모델 SoT 공백이며(WARNING), §A.3 상태 표가 여전히 "미구현"으로 표기된 점도 동일 등급의 동기화 문제다. 요구사항 ID 충돌, RBAC 모순, 상태 전이 충돌, 계층 책임 충돌은 발견되지 않았다.

---

## 위험도

**MEDIUM**

(구현 자체의 동작 상 충돌은 없으나, spec 단일 진실 원칙에서 두 핵심 spec 파일이 구현과 비동기 상태이며, 후속 개발자나 자동화 검증이 이 불일치를 오탐·중복 구현으로 처리할 수 있다.)
