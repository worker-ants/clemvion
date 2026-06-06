# Cross-Spec 일관성 검토 결과

대상: `spec/5-system/4-execution-engine.md` (구현 완료 후 검토, diff base: origin/main)
검토 범위: 코드 diff가 다른 spec 영역과 충돌하는지

---

## 발견사항

### [WARNING] `spec/5-system/4-execution-engine.md` 에 `driveResumeDetached` 명칭이 잔존 — 코드와 불일치

- **target 위치**: 코드 diff 전체 (`execution-engine.service.ts`, `.spec.ts`)에서 `driveResumeDetached` → `driveResumeAwaited` 로 rename 완료
- **충돌 대상**: `spec/5-system/4-execution-engine.md` 라인 128, 903, 1306, 1311 — spec 본문이 여전히 `driveResumeDetached` 를 사용
  - 라인 128: `driveResumeDetached`/`driveResumeFrame` 가 도착 continuation payload 를...
  - 라인 903: `driveResumeDetached`(top-level, awaited)/`driveCallStackResume`(중첩)가
  - 라인 1306: caller(`runExecution` / `driveResumeDetached`) 가 세그먼트 종료 여부를 판단
  - 라인 1311: 종전 `driveResumeDetached` 는 executeInline 스택을 재진입하지 않아...
- **상세**: 코드에서 private 메서드명이 `driveResumeDetached` → `driveResumeAwaited` 로 rename 됐으나, spec 이 여전히 구 명칭을 참조한다. spec 은 내부 구현 메서드명까지 기술하는 수준의 상세 규약이므로 명칭 불일치가 독자 혼란과 추후 gap 증가를 유발한다. 라인 903의 `(top-level, awaited)` 주석이 부분적으로 의미를 반영하고 있지만 메서드명 자체는 구 명칭이다.
- **제안**: `spec/5-system/4-execution-engine.md` 라인 128, 903, 1306, 1311 의 `driveResumeDetached` 를 `driveResumeAwaited` 로 교체. `project-planner` 가 spec 갱신 수행 (developer 는 spec 읽기 전용).

---

### [INFO] `spec/5-system/14-external-interaction-api.md §8.3` — 프로덕션 fail-closed 동작이 spec 에 미기술

- **target 위치**: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts` — `NODE_ENV=production` 에서 secret 미설정 시 생성자 throw (fail-closed) 신규 추가
- **충돌 대상**: `spec/5-system/14-external-interaction-api.md §8.3` (라인 651)
  - 현재 서술: "셋 다 미설정인 dev 환경은 비보안 placeholder 로 떨어지므로 프로덕션은 반드시 ... 설정해야 한다" (권고 수준)
  - 실제 구현: 프로덕션에서 secret 미설정 시 **부팅 차단(constructor throw)** — 권고가 아닌 강제
- **상세**: spec 은 "반드시 설정해야 한다"는 권고로 기술하고 있으나, 구현은 `NODE_ENV=production` + secret 미설정 조합에서 constructor 가 throw 해 서버 부팅 자체를 차단한다. `OAUTH_STUB_MODE`/`LLM_STUB_MODE` 의 프로덕션 부팅 가드 패턴과 동형이다. spec 이 "부팅 차단" 수준임을 명시하지 않아 읽는 사람이 "설정하지 않아도 비보안 fallback으로 동작한다"고 오해할 여지가 있다.
- **제안**: `spec/5-system/14-external-interaction-api.md §8.3` 에 "프로덕션(`NODE_ENV=production`)에서 `INTERACTION_JWT_SECRET`·`JWT_SECRET` 둘 다 미설정 시 서버 부팅 차단(fail-closed)" 을 명시. `spec/5-system/7-llm-client.md §7.1` 의 LLM_STUB_MODE 프로덕션 차단 서술과 동형으로 기술하면 일관성이 높아진다.

---

### [INFO] `spec/5-system/7-llm-client.md §7.1` — `LLM_STUB_MODE` 프로덕션 가드 서술과 `.env.example` 신규 항목이 일치

- **target 위치**: `.env.example` 에 `LLM_STUB_MODE=false` 신규 추가, 주석에 `spec/5-system/7-llm-client.md §7.1` 참조 명시
- **충돌 대상**: `spec/5-system/7-llm-client.md §7.1` 라인 351 — "main.ts 부팅 가드가 `NODE_ENV=production` + `LLM_STUB_MODE=true` 조합을 fail-closed 로 throw 한다" 서술 완비
- **상세**: 코드 변경(`.env.example` 항목 추가)이 spec 의 기술과 완전히 일치한다. 충돌 없음. 참조 기록.

---

### [INFO] `ProcessTurnResult` 타입 alias 도입 — spec 에 미반영이나 충돌 없음

- **target 위치**: `execution-engine.service.ts` — `type ProcessTurnResult = void | ParkSignal` 도입, 처리기 반환형을 `void | ParkSignal` 인라인에서 `ProcessTurnResult` alias 로 통일
- **충돌 대상**: `spec/5-system/4-execution-engine.md` — 처리기 반환형에 대한 별도 기술 없음
- **상세**: 순수 내부 TypeScript alias 변경으로 외부 계약·API shape·상태 머신에 영향 없다. spec 충돌 없음. spec 이 반환형까지 기술하지 않으므로 동기화 불요.

---

## 요약

이번 diff 의 핵심은 `driveResumeDetached` → `driveResumeAwaited` rename, `ProcessTurnResult` alias 도입, `InteractionTokenService` 프로덕션 fail-closed 강화, `.env.example` `LLM_STUB_MODE` 항목 추가다. API 계약·상태 머신·RBAC·요구사항 ID 영역에서 직접 충돌은 발견되지 않는다. 주요 gap 은 두 가지다: (1) `spec/5-system/4-execution-engine.md` 4곳이 구 메서드명 `driveResumeDetached` 를 참조해 코드와 명칭 불일치가 발생했으며, (2) `spec/5-system/14-external-interaction-api.md §8.3` 이 프로덕션 fail-closed 동작을 "권고" 수준으로 기술해 실제 구현(부팅 차단)보다 약하다. 전자는 spec 명칭 갱신으로, 후자는 §8.3 문구 강화로 해소 가능하며 둘 다 `project-planner` 범주의 spec 갱신이다.

## 위험도

LOW
