## Rationale Continuity Check — 결과

검토 대상 `plan/in-progress/spec-draft-cafe24-pending-polish.md` 를 기존 spec Rationale 섹션들과 대조했습니다.

---

### 발견사항

**[INFO] `credentials_unreadable` 의 원 결정 출처 불명시**
- **target 위치**: DRAFT 1C (`spec/1-data-model.md` status_reason 행), DRAFT 3B (`data-flow §3.2`)
- **과거 결정 출처**: 미참조 — "pre-existing 분기(`integrations.service.ts:845`)" 코드 경로만 언급
- **상세**: `credentials_unreadable` 을 `error` status_reason 공식 후보값으로 처음 열거했으나, 이 값이 언제·왜 도입됐는지 spec 어디에도 Rationale 가 없음. 코드 참조만으로는 후속 유지보수 시 해당 분기 변경 여부를 판단하는 근거가 사라짐
- **제안**: DRAFT 2I 또는 data-flow §3.2 에 "2026-05-XX 코드 분기에서 파생, 본 개정에서 첫 공식 열거" 1줄 추가

---

**[INFO] callback 팝업 auto-close 지연(3~5초) Rationale 부재**
- **target 위치**: DRAFT 2G §10.4 표 (코드 교환 실패 행), DRAFT 2G §10.2 step 6
- **과거 결정 출처**: 해당 없음 (신규 명세)
- **상세**: "auto-close 3~5초 지연 — 사용자가 메시지 읽도록" 이 처음 spec 에 등장했으나, 기존 callback 성공 케이스(즉시 close)와의 비대칭 근거, 3~5초 구체적 수치 선택 이유가 DRAFT 2I Rationale 에 없음
- **제안**: DRAFT 2I 에 "실패 popup은 3~5초 지연 — 에러 코드·메시지 독해 시간 확보, 성공은 즉시 close" 1줄 추가

---

**[INFO] `install_token` UNIQUE 제약 결정 defer → 후속 추적 항목 누락**
- **target 위치**: DRAFT 1D 인덱스 전략 주석 ("운영 시점에 결정")
- **과거 결정 출처**: 해당 없음 (신규 결정)
- **상세**: "32바이트 랜덤 충돌 무시 가능 수준이라 UNIQUE 생략" 하되 운영 데이터 확인 후 결정하겠다고 defer했으나, 후속 plan 문서에 명시적 follow-up 항목이 보이지 않음. V042 merge 이후 결정 근거가 추적 불가해질 위험
- **제안**: 구현 plan(`cafe24-pending-polish.md`)에 "install_token UNIQUE 제약 — 운영 데이터 기준으로 V042 이후 결정" 후속 항목 추가

---

### 요약

draft 는 기존 spec 의 모든 주요 번복(install timeout → `expired` 전이, HMAC 에러 코드 단일화 → 분리, App URL path에 `install_token` 도입, in-memory 스캔 폐기)을 명시적으로 선언하고 각각 Rationale를 첨부했다. 제공된 기존 Rationale 섹션(ExecutionNodeLog, 공유 워크플로, 사용자 프로필, AI Assistant)과 도메인 교차가 없어 관련 invariant 위반도 없다. 세 건 모두 INFO 수준의 추적 단서 보완 요청이며, 결정 연속성 자체의 Critical/Warning 위반은 없다.

### 위험도

**LOW**