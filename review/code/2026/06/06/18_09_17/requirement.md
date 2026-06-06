# 요구사항(Requirement) Review — exec-park-polish

## 발견사항

---

### [WARNING] [SPEC-DRIFT] `driveResumeDetached` → `driveResumeAwaited` 메서드 rename 이 spec 본문 4곳에 미반영

- **위치**: `spec/5-system/4-execution-engine.md` L128, L903, L1306, L1311
- **상세**: 파일 3(`execution-engine.service.ts`)과 파일 2(spec)의 diff 를 보면 코드에서는 `driveResumeDetached` → `driveResumeAwaited` rename 이 완전히 반영됐다. 그러나 spec 의 변경(파일 8)은 frontmatter `code:` glob 추가만이고, spec 본문 4곳은 여전히 구 이름 `driveResumeDetached` 를 참조한다:
  - L128: "→ `driveResumeDetached`/`driveResumeFrame` 가 도착 continuation payload 를 `processAiResumeTurn`…"
  - L903: "├─ `driveResumeDetached`(top-level, awaited)/`driveCallStackResume`(중첩)가"
  - L1306: "caller(`runExecution` / `driveResumeDetached`) 가 세그먼트 종료 여부를 판단한다"
  - L1311: "종전 `driveResumeDetached` 는 executeInline 스택을 재진입하지 않아…"
  - L1306 · L1311 은 이미 `SPEC-DRIFT` 라고 spec 내에 마킹되어 있으나 rename 자체가 반영되지 않았다. L128 · L903 은 비-SPEC-DRIFT 맥락의 서술적 참조다.
  - 코드 rename 은 plan A1 에서 명시적으로 의도된 변경이고, 동작 모델도 올바르다(awaited — 옛 detach 모델 폐기). 코드가 옳고 spec 본문이 낡은 이름을 그대로 갖고 있는 것이다.
- **제안**: 코드 유지 + spec 갱신. `spec/5-system/4-execution-engine.md` L128, L903, L1306, L1311 의 `driveResumeDetached` → `driveResumeAwaited` 교체. project-planner 또는 다음 spec 갱신 시 반영.

---

### [INFO] `InteractionTokenService` prod fail-closed 가드 — spec §8.3 명시 언급 없음

- **위치**: `spec/5-system/14-external-interaction-api.md` §8.3; `interaction-token.service.ts` L98-103
- **상세**: spec §8.3 은 "프로덕션은 반드시 `INTERACTION_JWT_SECRET` 또는 `JWT_SECRET` 를 설정해야 한다" 고 명시하나, 미설정 시 `NODE_ENV=production` 에서 생성자가 throw 해 부팅을 막는다는 명시적 fail-closed 계약은 spec 본문에 없다. OAUTH_STUB_MODE / LLM_STUB_MODE 패턴(각각 `main.ts` 부팅 가드 형태)과 달리, 본 가드는 서비스 생성자에서 throw 하는 구조다. 이 차이는 의도적일 수 있으나(NestJS 모듈 초기화 시점 가드), spec 에는 반영되지 않았다. 코드 동작 자체는 올바르고 의도에 부합한다. spec 위반이 아닌 spec 누락에 가깝다.
- **제안**: INFO 수준. spec §8.3 에 "NODE_ENV=production 에서 비밀 미설정 시 생성자 throw (fail-closed)" 계약을 추가하면 완전해진다. 코드는 그대로 유지.

---

### [INFO] `LLM_STUB_MODE` 기본값 설정 방식 차이 — OAUTH_STUB_MODE 와 대칭성

- **위치**: `.env.example` L266-270 (파일 1)
- **상세**: `OAUTH_STUB_MODE=false` 는 주석 해제된 활성 설정으로 등재되어 있고, 신규 추가된 `LLM_STUB_MODE=false` 도 동일하게 주석 해제된 활성 설정으로 등재됐다. spec/5-system/7-llm-client.md §7.1 에 "부팅 가드가 NODE_ENV=production + LLM_STUB_MODE=true 조합을 fail-closed 로 throw" 라고 명시되어 있어 기본값 `false` 가 스펙과 일치한다. 기능적으로 완전하다.
- **제안**: 문제 없음. 현황 확인용 INFO.

---

### [INFO] `ProcessTurnResult` 타입 alias — spec 언급 없음

- **위치**: `execution-engine.service.ts` (파일 3); spec/5-system/4-execution-engine.md 에 미언급
- **상세**: `ProcessTurnResult = void | ParkSignal` 는 plan C1 에 명시된 의도적 내부 타입 alias 개선으로, spec 에 함수 시그니처 레벨로 명시된 사항이 아니다. spec 위반이 아니며 코드 품질 개선이다.
- **제안**: INFO 수준. 코드 유지.

---

## 요약

이번 변경(exec-park-polish plan A1/A2/A3/B1/B2/C1)은 의도한 기능을 거의 완전히 구현했다. 핵심 rename(`driveResumeDetached` → `driveResumeAwaited`), env 변수 등재(B1), prod fail-closed 가드(B2), 타입 alias 신설(C1), spec frontmatter 갱신(A2/A3), AI agent spec 단발 재진입 표현 정정(A3) 모두 plan 에 기술된 목표와 일치한다. 유일한 미완성 갭은 spec 본문 4곳에 구 메서드명 `driveResumeDetached` 가 잔존하는 것(SPEC-DRIFT)으로, 코드가 옳고 spec 이 낡은 이름을 보유하는 방향이다. `InteractionTokenService` prod fail-closed 가드는 구현 동작이 spec §8.3 요구("프로덕션은 반드시 설정")에 부합하나 가드 세부 계약(생성자 throw)이 spec 에 명시되지 않았다(INFO). 비즈니스 로직·에러 경로·반환값·엣지 케이스 처리 모두 적절하며, TODO/FIXME 잔여물 없다.

## 위험도

LOW
