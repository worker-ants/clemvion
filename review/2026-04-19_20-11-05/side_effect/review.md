## 부작용 분석 결과

---

### 발견사항

- **[CRITICAL]** 에러 Envelope 파괴적 필드 제거
  - 위치: `spec/5-system/3-error-handling.md` §3.2
  - 상세: 기존 `output.error`에 있던 `nodeId`, `nodeType`, `timestamp`, `originalInput` 필드가 새 규격에서 제거됨. `details`로 일부 이동 가능하지만, 이를 직접 참조하는 다운스트림 표현식(`$node["X"].output.error.originalInput`, `.nodeId` 등)은 마이그레이션 스크립트에 해당 매핑이 **없어** 무음 파손됨.
  - 제안: `migrate-node-output-refs.ts`에 `output.error.originalInput` → `output.error.details.originalInput`, `output.error.nodeId` / `.nodeType` 감지 → 경고 로그 패스를 추가해야 함

- **[WARNING]** `interaction.type === 'button_click'` 패턴 충돌 위험
  - 위치: `backend/src/scripts/migrate-node-output-refs.spec.ts` — `status literal unification` suite
  - 상세: Pass 5는 `$node["X"].status === "button_click"` → `"resumed"`로 치환하는데, 새 spec에서 `output.interaction.type`의 유효값도 `"button_click"`임. 마이그레이션 스크립트가 패턴을 status 비교에만 한정하는지, 아니면 `interaction.type === "button_click"` 비교까지 오염시키는지 확인 필요.
  - 제안: 테스트에 `$node["C"].output.interaction.type === "button_click"` 케이스를 추가해 보존됨을 검증해야 함

- **[WARNING]** `previousOutput` 필드 — 제거 계획 없는 레거시 누출
  - 위치: `spec/4-nodes/6-presentation-nodes.md` §1.3 Resumed 출력 형식
  - 상세: Carousel resumed 출력에 `"previousOutput": { /* Stage 3 전환기 호환 필드 — Phase 3 에서 제거 예정 */ }`가 추가됨. 명시적 제거 조건(Stage 7 선행 조건 목록, migration script 매핑)이 어디에도 없어 기술 부채로 고착될 위험이 있음.
  - 제안: `memory/node-specs-improvement-progress.md` Stage 7 선행 조건에 `previousOutput` 제거를 명시적으로 추가해야 함

- **[WARNING]** Chart 출력 형식에 `rendered` 필드 누락
  - 위치: `spec/4-nodes/6-presentation-nodes.md` §3.3 출력 형식
  - 상세: Table은 `output.rendered`, Template은 `output.rendered`를 명시하지만, Chart의 새 출력 형식 예시에는 `output.data`만 있고 `output.rendered`(SVG)가 누락됨. 구현 핸들러가 이미 SVG를 생성하고 있다면 spec-impl 불일치가 발생하며, 다운스트림이 Chart SVG를 `$node["C"].output.rendered`로 참조할 때 undefined가 됨.
  - 제안: Chart 출력 예시에 `"rendered": "<svg>…</svg>"` 필드를 명시적으로 추가해야 함

- **[INFO]** `buildErrorEnvelope` 반환 타입이 `details` 유무에 따라 다름
  - 위치: `backend/src/nodes/core/error-codes.ts` L40–50
  - 상세: `details === undefined`이면 `{ code, message }`, 아니면 `{ code, message, details }` — TypeScript 유니온 타입으로 처리되지만, JSON 역직렬화 후 런타임에서 `'details' in error`로 분기해야 하는 소비자가 놓칠 수 있음.
  - 제안: 명확성을 위해 `details: undefined`인 경우에도 `details` 키 자체를 포함하거나(`details?: Record<...>`를 항상 전달), 소비자 측 체크 패턴을 spec에 명시해야 함

- **[INFO]** 마이그레이션 테스트의 import 경로
  - 위치: `migrate-node-output-refs.spec.ts` L8–14
  - 상세: `from '../../scripts/migrate-node-output-refs'`에서 `RELOCATED_FIELDS`, `META_FIELDS`, `RESULT_FIELDS`, `RENAMED_OUTPUT_FIELDS`를 named export로 가져옴. 실제 스크립트 파일에서 이 심볼들이 export되어야 테스트가 동작함. 현재 diff로는 스크립트 파일 내 export 여부를 확인할 수 없음.
  - 제안: `migrate-node-output-refs.ts`에서 해당 constants가 `export const`로 선언되어 있는지 확인 필요

---

### 요약

이번 변경의 핵심 부작용 위험은 두 가지다. 첫째, 에러 Envelope에서 `nodeId`·`originalInput`·`timestamp`가 제거되는데 마이그레이션 스크립트에 해당 매핑이 없어 이를 참조하는 기존 워크플로우 표현식이 무음 파손된다. 둘째, Chart 출력 spec에서 `rendered`(SVG) 필드가 누락되어 spec-구현 불일치를 유발할 수 있다. Migration script의 status 리터럴 치환이 `interaction.type` 비교를 오염시킬 가능성도 테스트 보강으로 확인이 필요하다. 나머지 변경(error-codes 신설, execution-engine spec 추가)은 순수 추가적이며 직접적인 파괴적 부작용이 없다.

### 위험도

**MEDIUM**