## 유지보수성 코드 리뷰

### 발견사항

---

**[INFO]** Spec 문서의 단계별 진화 정보가 문서 내에 혼재
- 위치: `6-presentation-nodes.md` — "Stage 3 전환기 호환 필드 — Phase 3 에서 제거 예정", "이전 초안의 ... 폐기"
- 상세: 스펙 문서는 "현재 상태"를 기술해야 하나, 마이그레이션 히스토리(`previousOutput` 잔존 이유, 폐기 필드 언급)가 문서 본문에 섞여 있어 향후 독자가 실제 규격인지 과도기 설명인지 구분하기 어렵다.
- 제안: 과도기 설명은 `<!-- ... -->` 주석이나 별도 "Migration Notes" 섹션으로 분리하거나 `memory/` 하위로 이동. 스펙 본문은 현재 유효한 shape만 기술.

---

**[WARNING]** `§1.2.x` 섹션 번호 비정규화
- 위치: `4-execution-engine.md` — `### 1.2.x 블로킹/재개 컨트랙트`
- 상세: `x`는 임시 플레이스홀더로 보이며, 이후 `### 1.2`가 별도로 존재한다. 두 섹션이 혼재하면 문서 내 앵커 링크나 교차 참조가 깨진다.
- 제안: 실제 번호(`1.3` 등)로 확정하거나, 기존 `1.2` 앞에 삽입(`1.2`→`1.3` 으로 밀기). 임시 `x` 는 merge 전 제거 필요.

---

**[WARNING]** `ErrorCode` 상수와 타입이 값-기반으로 중복 선언
- 위치: `error-codes.ts` 전체
- 상세: `as const` 객체 패턴으로 키와 값이 동일 문자열을 반복(`HTTP_TRANSPORT_FAILED: 'HTTP_TRANSPORT_FAILED'`). 새 코드를 추가할 때 실수로 키/값 불일치 가능성이 있으며, TypeScript enum이나 `satisfies` 패턴 대비 verbose하다.
- 제안: 
  ```ts
  // 옵션 A: 일반 enum
  export enum ErrorCode { HTTP_TRANSPORT_FAILED = 'HTTP_TRANSPORT_FAILED', ... }
  // 옵션 B: 배열→const 변환
  const CODES = ['HTTP_TRANSPORT_FAILED', 'HTTP_4XX', ...] as const;
  export const ErrorCode = Object.fromEntries(CODES.map(c => [c, c]));
  ```
  단, 기존 패턴이 코드베이스 전체 컨벤션이라면 INFO로 하향.

---

**[INFO]** `buildErrorEnvelope` 반환 타입 인라인 중복
- 위치: `error-codes.ts:30-38`
- 상세: 반환 타입 `{ code: ErrorCodeValue; message: string; details?: Record<string, unknown> }`이 함수 시그니처에 인라인으로 길게 선언. 이 shape는 여러 핸들러에서 재사용할 가능성이 높다.
- 제안: `export type NodeErrorEnvelope = { code: ErrorCodeValue; message: string; details?: Record<string, unknown> }` 로 명명 타입 추출.

---

**[INFO]** 마이그레이션 스크립트 테스트에서 `hits` 배열 타입이 인라인 반복
- 위치: `migrate-node-output-refs.spec.ts:175, 198`
- 상세: `walkAndRewrite` 호출 시마다 `Array<{ field: string; reason: string; before: string; after: string }>` 타입을 인라인으로 반복 선언. 스크립트 본체에서 이미 export된 타입이 있다면 import, 없다면 type alias 추출이 가독성을 높인다.
- 제안: `migrate-node-output-refs.ts`에서 `export type RewriteHit = { field: string; reason: string; before: string; after: string }` 추출 후 spec 파일에서 import.

---

**[INFO]** 진행 체크리스트 문서가 spec과 memory 경계를 혼합
- 위치: `memory/node-specs-improvement-progress.md`
- 상세: 구현 진행 상태(`[x]`/`[ ]`)와 "진행 노트" 같은 히스토리 정보가 한 파일에 혼합. 향후 작업자가 "현재 해야 할 것"과 "이미 한 것"을 구분하기 위해 전체를 읽어야 한다. 완료된 Stage의 체크리스트는 점점 noise가 된다.
- 제안: 완료 Stage는 접이식 `<details>` 블록 처리하거나 `archive/` 하위로 이동. 미완 항목만 상단에 유지.

---

**[INFO]** `error-handling.md` §3.2의 JSON 예제에 `config` 필드 설명 불충분
- 위치: `3-error-handling.md` — `"config": { /* 해석된 노드 config echo (credentials 제외) */ }`
- 상세: 주석만 있고 실제 예시 필드가 없어, 구현자가 어떤 필드를 포함/제외해야 하는지 코드만으로는 판단 어렵다. `4-execution-engine.md`의 민감 정보 정책과 중복 기술 가능성도 있다.
- 제안: 구체 예시 한 줄(`"method": "GET", "url": "https://api.example.com/..."`) 추가 또는 `§5.1 민감 정보 정책 참조` 링크 명시.

---

### 요약

전반적으로 변경된 스펙 문서와 코드는 일관된 네이밍 컨벤션(UPPER_SNAKE_CASE, `output.result.*`, `interaction.{type,data,receivedAt}`)을 잘 따르고 있으며, `error-codes.ts`와 마이그레이션 테스트는 각 책임이 명확히 분리되어 있다. 다만 스펙 문서에 마이그레이션 과도기 정보가 본문에 혼재되어 있어 "현재 규격"과 "폐기 예정 설명"이 뒤섞이는 점, `§1.2.x`처럼 임시 섹션 번호가 남아 있는 점이 장기 유지보수성을 저하할 수 있다. `error-codes.ts`의 값 중복 선언 패턴은 코드베이스 통일성에 따라 수용 여부를 결정하면 된다.

### 위험도

**LOW**