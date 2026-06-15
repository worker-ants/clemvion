# 성능(Performance) 리뷰 결과

**리뷰 대상**: form file validation cluster (A-2) — type:'file' 서버측 + 클라이언트 검증 + 공유 기본값
**리뷰 일시**: 2026-06-15

---

## 발견사항

### **[INFO]** `validateFilesClient` — 파일 배열을 3회 순회
- **위치**: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `validateFilesClient` 함수 (MIME 루프 → per-file size 루프 → `reduce` 합산)
- **상세**: 검증 순서(MIME → per-file size → total size → count)를 보장하기 위해 for-loop를 3개 분리 운용한다. 파일 배열이 3회 순회된다. 일반적인 폼 업로드에서 파일 수는 `maxFiles`(기본 5) 이하로 작기 때문에 절대적 비용은 무시할 수 있는 수준이다. 그러나 단일 순회로 MIME/per-file size를 동시에 체크하고 마지막에 total을 더하면 코드 의도(FIRST 오류 우선순위)를 유지하면서도 순회를 2회로 줄일 수 있다.
- **제안**: 현 규모(maxFiles ≤ 5)에서 실질 성능 영향은 없다. 변경 필요 없음. 향후 maxFiles 상한이 크게 올라가는 경우에만 단일 순회로 병합을 검토한다.

### **[INFO]** `assertFormSubmissionValid` 내 `extractFormFields` 호출 — 매 요청마다 전체 필드 재파싱
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `assertFormSubmissionValid`
- **상세**: 폼 제출 요청마다 `extractFormFields(node.config)`를 호출해 필드 정의 배열을 재구성한다. `extractFormFields`는 순수 파싱 함수이며 DB 호출 없이 메모리 내 객체를 순회한다. 노드 config 필드 수는 통상 수십 개 이하로, 파싱 비용은 사실상 무시 가능한 수준이다. 다만 동일 executionId에 대해 여러 번 form 제출이 발생하는 경우(재제출 흐름) 동일 node.config에 대한 반복 파싱이 일어난다.
- **제안**: 현재 규모에서 캐싱 필요성 없음. 향후 필드 수가 수백 개 규모가 되거나 submit_form 처리량이 극도로 높아지면 executionId 또는 nodeId 키 기반의 얕은 메모이제이션을 고려할 수 있으나 현재는 불필요하다.

### **[INFO]** `handleError` — 매 에러 클리어마다 객체 복사
- **위치**: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `handleError` 함수
- **상세**: 에러가 없는 상태에서 `null`을 전달할 때 `prev[name] === undefined` 체크로 불필요한 리렌더를 방지하는 조기 반환이 구현되어 있다. 이는 올바른 최적화다. 에러 세팅 시에는 `{ ...prev, [name]: msg }` 스프레드 복사가 발생하지만, 필드 수가 수십 개 이하인 폼에서 이 비용은 무시 가능하다.
- **제안**: 현 구현이 이미 불필요한 리렌더를 방지하는 최적화를 포함하고 있다. 추가 조치 불필요.

### **[INFO]** `DEFAULT_FILE_ALLOWED_MIME_TYPES` 상수 배열 — `includes()` 선형 탐색
- **위치**: `/codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` `validateFilesClient` 및 `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` `validateFileField`
- **상세**: MIME 허용 여부를 `allowedMime.includes(f.type)`으로 검사한다. 기본 허용 목록이 14종이고 파일당 1회 호출되며, 사용자 지정 목록도 통상 수십 개 이하다. 이 크기에서 `Array.includes()`(O(n))와 `Set.has()`(O(1))의 실질 차이는 측정 불가 수준이다.
- **제안**: 현재 규모에서 변경 불필요. MIME 허용 목록이 수백 개 이상으로 늘어나거나 파일 수가 대규모가 되면 `Set`으로 전환을 고려한다. 단, 그 경우에도 `Set` 생성 비용이 소규모 배열에서는 오히려 역효과가 날 수 있으므로 프로파일링 후 결정한다.

### **[INFO]** `validateFileField` — 서버 측 `Array.isArray` 가드 후 루프 구조
- **위치**: `/codebase/backend/src/modules/chat-channel/shared/form-mode.ts` `validateFileField`
- **상세**: 함수 시작부에서 `Array.isArray(files)` 가드로 비배열 입력을 조기 반환한다. 내부 루프는 단일 패스로 MIME→per-file size 순서대로 첫 위반에서 즉시 반환하는 FIRST 오류 구조이며, total size 계산은 루프 후 한 번의 `reduce`로 처리된다. 알고리즘적으로 O(n)(n = 파일 수)이며, 서버에서 처리하는 파일 메타데이터 배열 크기는 `maxFiles`에 의해 상한이 결정된다. 효율적인 구조다.
- **제안**: 추가 최적화 불필요.

---

## 요약

이번 변경(file MIME/크기/개수 서버측+클라이언트 검증)은 성능 관점에서 전반적으로 양호하다. 핵심 경로인 `assertFormSubmissionValid`는 메모리 내 순수 파싱+루프 구조로 DB/외부 I/O 호출이 없고, 클라이언트 `validateFilesClient`는 사용자가 업로드하는 소수 파일(기본 상한 5개)에 대한 간단한 선형 검사다. `Array.includes()`를 사용하는 MIME 허용 목록 탐색은 14종 크기에서 O(n)이지만 실질 비용은 무시 가능하고, 프론트엔드에서 파일 배열을 최대 3회 순회하는 것도 소규모 배열에서 문제가 되지 않는다. 캐싱, N+1, 블로킹 I/O, 메모리 누수 등의 성능 위험은 발견되지 않았다. 모든 발견사항은 INFO 수준이며 현재 사용 규모에서 실질적 영향이 없다.

---

## 위험도

NONE
