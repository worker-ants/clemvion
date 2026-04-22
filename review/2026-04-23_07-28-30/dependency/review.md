### 발견사항

- **[INFO]** 외부 패키지 추가 없음
  - 위치: 전체 diff
  - 상세: `npm install` 흔적 없음. 신규 `import` 문은 모두 프로젝트 내부 모듈(`./resolve-dynamic-ports`, `../../../nodes/core/...`)과 기존 내부 타입만 참조한다.
  - 제안: 해당 없음

- **[WARNING]** `resolve-dynamic-ports.ts` 가 프론트엔드 동일 파일의 수동 사본 — 동기화 부채
  - 위치: `backend/src/.../tools/resolve-dynamic-ports.ts`, JSDoc 첫 문장: *"Backend mirror of `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`"*
  - 상세: 6종 `DynamicPortsSpec` 분기 로직이 두 개의 독립 파일로 복제되어 있다. 파일 자체가 "두 사본이 lockstep을 유지해야 한다"고 명시하지만, 이를 강제할 빌드·lint 메커니즘이 없다. 프론트엔드에서 새 `kind`가 추가되거나 기존 분기가 변경될 경우, 백엔드 사본이 자동으로 감지되지 않아 `DANGLING_OUTPUT_PORTS` 가 false positive/negative를 내게 된다. 이미 `memory/workflow-assistant-self-review-and-error-hints.md` 유지보수 체크리스트에 *"resolveEffectiveOutputPorts 변경 시 frontend resolveDynamicPorts 와 동일 동작을 유지하는지 확인"* 이 수기 경고로 기재되어 있어, 사실상 사람 기억에 의존하는 구조다.
  - 제안: 두 파일의 `kind` 목록을 공통 상수로 추출하거나(공유 패키지 불가 시), CI에서 `grep -c "case '"` 등의 단순 count 비교 스크립트를 추가해 분기 수 불일치를 자동 감지한다. 최소한 `resolve-dynamic-ports.ts` 상단에 프론트엔드 파일의 `git blame` 해시를 주석으로 기록해 "마지막 동기화 커밋"을 추적 가능하게 한다.

- **[INFO]** `import type` 일관 사용 — 타입 전용 임포트 적절
  - 위치: `resolve-dynamic-ports.ts:1–5`, `review-workflow.ts` 신규 import 라인
  - 상세: `NodeDefinitionView`, `DynamicPortsSpec`, `NodePort`, `NodeComponentMetadata`, `NodePorts` 모두 `import type`으로 가져온다. 런타임 번들에 타입 정보가 포함되지 않으며, NestJS의 reflect-metadata 의존 DI와 충돌하지 않는다.
  - 제안: 해당 없음

- **[INFO]** 상대 경로 깊이 (`../../../nodes/core/...`) — 기존 프로젝트 패턴 준수
  - 위치: `resolve-dynamic-ports.ts:1–5`, `resolve-dynamic-ports.spec.ts:2–7`
  - 상세: 3단계 상위 경로 참조는 모듈 이동 시 취약하지만, 동일 백엔드 내 기존 파일들이 동일한 패턴을 이미 사용 중이므로 신규 도입 리스크는 없다. `tsconfig.paths` 앨리어스 부재가 근본 원인이나, 이는 이번 변경 범위 밖이다.
  - 제안: 해당 없음

- **[INFO]** `review-workflow.ts` → `resolve-dynamic-ports.ts` 신규 내부 의존 방향
  - 위치: `review-workflow.ts` 상단 신규 `import`
  - 상세: `resolveEffectiveOutputPorts`는 `DynamicPortsSpec` / `NodeDefinitionView` 타입만 참조하고 외부 I/O·NestJS DI를 쓰지 않는 순수 함수다. 순환 의존성 리스크 없음. `BuildReviewChecklistInput.nodeDefs`를 통해 `NodeDefinitionView[]`를 외부에서 주입받으므로, `resolve-dynamic-ports.ts`가 레지스트리 싱글턴에 직접 의존하지 않는다. 의존 방향 적절.
  - 제안: 해당 없음

---

### 요약

이번 변경에서 신규 외부 패키지는 전혀 추가되지 않았으며, 라이선스·취약점·번들 크기 관점의 위험 요소는 없다. 주요 의존성 이슈는 `resolve-dynamic-ports.ts`가 프론트엔드 동일 파일의 수동 사본이라는 구조적 결정에서 비롯된다. 이 패턴은 백엔드가 UI 코드를 임포트할 수 없는 현실적 제약 때문에 선택된 것이지만, 두 사본의 동기화를 강제하는 자동화 메커니즘 없이는 장기적으로 로직 드리프트가 누적될 수 있다. 현재는 spec 레벨 미러 테스트(16개)가 유일한 안전망이며, `kind` 열거 불일치를 빌드 타임에 잡을 수단이 없다는 점이 유일한 유의미한 경고다.

### 위험도

**LOW** — 신규 외부 의존성 없음. 유일한 위험은 내부 사본 드리프트이며, 현재 spec 미러링과 memory 유지보수 체크리스트로 부분 완화 중.