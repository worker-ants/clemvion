### 발견사항

---

**[WARNING] `private publisher!: Redis` 타입 선언이 새 가드와 모순됨**
- 위치: `continuation-bus.service.ts` — `private publisher!: Redis;` 선언부
- 상세: `!` (definite assignment assertion) 는 TypeScript 에게 "이 필드는 사용 전에 반드시 초기화된다"고 선언하는 것이다. 그런데 새 가드 코드는 정확히 초기화되지 않은 경우(`if (!this.publisher)`)를 방어한다. 타입 어노테이션과 런타임 방어 로직이 서로 모순된다.
- 제안: `private publisher?: Redis;` 로 변경하면 TypeScript 가 미초기화 상태를 타입 레벨에서 인식해, 가드 없는 직접 접근(`this.publisher.set(...)`)에 컴파일 에러를 발생시킨다. 의도치 않은 접근을 컴파일 타임에 차단할 수 있다.

---

**[WARNING] `acquireLock` JSDoc `@returns` 가 새 반환 경로를 누락**
- 위치: `continuation-bus.service.ts:170` 근방 — `acquireLock` JSDoc
- 상세: `@returns 획득 성공 시 true, 다른 인스턴스가 이미 보유 시 false.` 라고만 기술되어 있으나, 이번 변경으로 세 번째 반환 경로(publisher 미초기화 → `false`)가 추가됐다. 호출자가 `false` 를 받았을 때 "내가 lock 경쟁에서 졌다"로만 해석할 수 있다.
- 제안: `@returns 획득 성공 시 true. 다른 인스턴스가 이미 보유하거나 publisher 가 미초기화 상태이면 false.` 로 보완.

---

**[WARNING] Plan 문서의 체크박스 상태가 구현과 불일치**
- 위치: `plan/in-progress/fix-continuation-bus-bootstrap-race.md` — 작업 항목 1~2절
- 상세: 모든 구현 항목이 `[ ]` (미완료) 상태이나 해당 코드 변경이 이미 커밋되어 있다. CLAUDE.md 의 Plan 라이프사이클 규약 ("작업 단계가 끝날 때마다 plan 문서를 갱신")을 위반한다. 이 상태로 두면 나중에 어떤 작업이 실제로 남아있는지 판단하기 어렵다.
- 제안: 완료된 항목을 `[x]` 로 갱신하고, 미완료 항목(TEST WORKFLOW, REVIEW WORKFLOW, 마무리)만 `[ ]` 로 유지한다.

---

**[WARNING] Plan 문서가 머신 종속 절대경로를 참조**
- 위치: `plan/in-progress/fix-continuation-bus-bootstrap-race.md:3` — `[sorted-shimmying-wirth.md](../../sorted-shimmying-wirth.md)` 링크
- 상세: 경로가 `/Users/gehrig/.claude/plans/...` 라는 개인 머신의 절대경로를 상대경로로 가리키고 있어, 다른 팀원이나 CI 에서 링크가 깨진다. 또한 해당 파일이 git 에 추적되지 않아 히스토리 보존도 안 된다.
- 제안: 참조 문서의 핵심 내용을 이 plan 의 "배경" 절에 직접 통합하거나, 파일을 `plan/` 하위로 이동 후 상대경로로 교정한다.

---

**[INFO] `publish` JSDoc 이 미초기화 조기 반환을 언급하지 않음**
- 위치: `continuation-bus.service.ts` — `publish` 메서드 JSDoc
- 상세: JSDoc 본문은 "catch + 로깅으로 Redis 장애를 운영 로그로 인지할 수 있다"고 기술하는데, 이제 publisher 미초기화 상태에서도 `null` 을 반환하는 경로가 추가됐다. 두 경우 모두 `null` 을 반환하지만 원인이 다르다.
- 제안: "publisher 미초기화 상태에서도 `null` 을 반환하며, 해당 경우 `logger.error` 로 명시적으로 기록된다"는 내용 한 줄 추가.

---

**[INFO] `releaseLock` 미초기화 가드가 `warn` 을 쓰는 이유가 문서화되지 않음**
- 위치: `continuation-bus.service.ts` — `releaseLock` 의 `if (!this.publisher)` 블록
- 상세: `publish` 와 `acquireLock` 의 미초기화 가드는 `logger.error` 를 사용하는데 `releaseLock` 만 `logger.warn` 을 사용한다. 의도적인 심각도 구분이라면 그 이유가 독자에게 명확하지 않다.
- 제안: 주석 한 줄로 이유를 명시한다. 예: `// lock 미보유 상태의 해제 시도는 이미 error 를 찍은 acquireLock 실패의 후속이므로 warn 으로 충분.`

---

**[INFO] `releaseLock` JSDoc 에 `@returns` 가 없음 (기존 + 신규 경로 모두 미문서화)**
- 위치: `continuation-bus.service.ts` — `releaseLock` JSDoc
- 상세: 기존에도 반환값 문서가 없었고, 이번 변경으로 "publisher 미초기화 → false" 경로가 추가됐다. 호출자는 반환값의 의미를 코드를 직접 읽어야 알 수 있다.
- 제안: `@returns owner 일치 시 true, 불일치·Redis 오류·publisher 미초기화 시 false.` 추가.

---

**[INFO] Plan 문서 내 라인 번호 참조가 이미 구식**
- 위치: `plan/in-progress/fix-continuation-bus-bootstrap-race.md` — 작업 항목 2절
- 상세: `acquireLock(line 163)`, `releaseLock(line 188)`, `publish(line 125)` 등 라인 번호가 언급되어 있는데, 코드 변경 후 실제 라인 번호와 다르다. Plan 문서에서 라인 번호는 빠르게 outdated 되는 휘발성 정보이다.
- 제안: 라인 번호 대신 메서드 이름·시그니처 단위로 참조하거나, 이미 완료된 항목이므로 체크 후 그대로 둔다.

---

### 요약

이번 변경의 문서화 품질은 전반적으로 양호하다. `onApplicationBootstrap` 신설 이유를 설명하는 JSDoc, 각 가드 블록의 인라인 한국어 주석, 회귀 방지 테스트의 명확한 이름과 설명 등은 잘 작성되어 있다. 다만 타입 선언(`publisher!`)과 새 런타임 가드 사이의 모순, `acquireLock` `@returns` 의 신규 경로 누락, plan 문서의 체크박스 미갱신·절대경로 참조 문제가 실무에서 혼란을 야기할 수 있다. 특히 `publisher!: Redis` 타입 선언은 TypeScript 안전성 관점에서 오해를 부르는 거짓 약속이므로 수정을 권장한다.

### 위험도

**LOW**