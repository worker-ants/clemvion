## 발견사항

### [WARNING] `RESUME_INCOMPATIBLE_STATE` 트리거 조건 — 3-error-handling.md 미동기

- target 위치: `spec/5-system/4-execution-engine.md` §7.5 "Rehydration 실패 케이스" 표 · `spec/5-system/6-websocket-protocol.md` line 298 (이번 브랜치에서 동기 갱신 완료)
- 충돌 대상: `spec/5-system/3-error-handling.md` line 94
- 상세: `4-execution-engine.md` §7.5 와 `6-websocket-protocol.md` §4.2 에서 `RESUME_INCOMPATIBLE_STATE` 의 트리거 조건이 "부재·손상·**미래 버전**(`schemaVersion` 이 현재 코드 `CHECKPOINT_SCHEMA_VERSION` 초과)" 3가지로 확장됐다. 그러나 `3-error-handling.md` §1.3 에러 코드 카탈로그의 동일 행은 여전히 "부재(기능 배포 이전 진입한 waiting row) 또는 손상(schema drift 로 재구성 실패)" 2가지만 기술해 새 미래 버전 케이스가 누락된 상태다. 동일 에러 코드에 대한 두 spec 의 트리거 설명이 불일치한다.
- 제안: `spec/5-system/3-error-handling.md` line 94 의 `RESUME_INCOMPATIBLE_STATE` 설명을 "부재(기능 배포 이전 진입한 waiting row)·손상(schema drift 로 재구성 실패)·미래 버전(`schemaVersion` 이 현재 코드 지원 버전 초과 — 롤링 배포 중 구 인스턴스가 신 포맷 pickup)" 으로 갱신해 `6-websocket-protocol.md` · `4-execution-engine.md` §7.5 와 동기화한다.

---

### [INFO] `forbidden` / `rate_limited` historical-artifact 등재 — 표기 모호성

- target 위치: `spec/conventions/error-codes.md` §3 Historical-artifact 레지스트리 신규 행 · `spec/5-system/1-auth.md` §1.5.4 historical-artifact 주석
- 충돌 대상: `spec/5-system/2-api-convention.md` line 160
- 상세: `2-api-convention.md` §5.3 은 `FORBIDDEN` (403 기본값) 과 `RATE_LIMITED` (429 기본값) 를 `UPPER_SNAKE_CASE` 표준 코드로 정의한다. 이번 변경으로 `error-codes.md §3` 레지스트리에 `forbidden` · `rate_limited` (소문자) 를 초대 흐름 한정 historical-artifact 로 등재했다. 코드명이 대소문자만 다르고 HTTP 상태코드도 동일해, 레지스트리가 두 코드를 명시적으로 "소문자판 = 초대 흐름 전용, 대문자판 = 범용 기본값" 으로 구분하지 않으면 독자가 두 코드의 관계를 오해할 수 있다. 현재 레지스트리 컬럼("이름이 부정확한 이유")은 `lower_snake_case` 위반만 기술하며 표준 대문자 코드와의 차이는 언급하지 않는다.
- 제안(sync 권장): `error-codes.md §3` 레지스트리의 `forbidden` · `rate_limited` 행 설명에 "(대문자판 `FORBIDDEN`/`RATE_LIMITED` 는 `2-api-convention.md §5.3` 의 범용 기본값과 별개 — 초대 API 한정)" 구별 메모를 추가해 혼동 방지를 권장한다.

---

### [INFO] `telegram.md` — 재개 실패 케이스 열거 미갱신

- target 위치: `spec/5-system/4-execution-engine.md` §1.3 `schemaVersion` 추가 (이번 A2a 변경)
- 충돌 대상: `spec/4-nodes/7-trigger/providers/telegram.md` line 192
- 상세: telegram.md §5.7 는 graceful 세션 만료 안내가 표시되는 조건을 "배포 이전 진입한 waiting row / `information_extractor` / 손상 케이스에서만 표시된다" 고 기술한다. 이번 A2a 로 `_resumeCheckpoint` 의 미래 버전(`schemaVersion > CHECKPOINT_SCHEMA_VERSION`) 도 `RESUME_INCOMPATIBLE_STATE` 를 유발해 동일 graceful 안내를 표시하는 케이스로 추가됐지만, telegram.md 의 해당 설명은 갱신되지 않았다. 정의 문서가 아닌 설명 주석이라 운영 오류를 유발하지 않으나, 케이스 열거가 불완전하다.
- 제안(sync 권장): `spec/4-nodes/7-trigger/providers/telegram.md` line 192 에 "미래 버전 checkpoint(`schemaVersion` > 현재 지원 버전 — 롤링 배포 중)" 케이스를 추가한다.

---

## 요약

이번 브랜치(A2a — `_resumeCheckpoint` 견고화)가 도입한 `schemaVersion`/`CHECKPOINT_SCHEMA_VERSION` 버전 스탬프와 `RESUME_INCOMPATIBLE_STATE` 트리거 3원화는 핵심 4개 문서(`4-execution-engine.md` · `6-websocket-protocol.md` · `1-ai-agent.md` · `node-output.md`)에는 일관되게 반영됐다. 앞선 검토(`11_03_00`)에서 지적된 WARNING 3건도 이 브랜치에서 해소됐다. 잔여 불일치는 `3-error-handling.md` §1.3 에러 코드 카탈로그(동일 에러 코드 트리거 설명 미갱신 — WARNING) 와 `telegram.md` §5.7 설명 주석의 케이스 열거 미완(INFO) 두 건이다. `forbidden`/`rate_limited` historical-artifact 등재는 대/소문자 표준 코드와의 관계를 명시하지 않아 독자 혼동 여지가 있으나(INFO), 도메인 SoT(`1-auth.md §1.5.4`)가 범위를 초대 흐름으로 제한하므로 실제 계약 충돌은 없다.

## 위험도

LOW
