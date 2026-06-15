# 성능(Performance) 리뷰 결과

## 발견사항

### 발견사항 1
- **[INFO]** `validateFilesClient` (frontend) — MIME 검사와 per-file 크기 검사를 별도 루프로 순회
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/form-file-validation-8d2360` 기준 `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `validateFilesClient` 함수 내 두 개의 `for (const f of files)` 루프
  - 상세: `files` 배열을 MIME 체크 한 번, per-file 크기 체크 한 번, 총 2회 순회한다. 실제 사용 맥락(파일 개수가 통상 1~5개 수준, `maxFiles` 기본값 5)에서는 완전히 무시해도 될 규모이므로 CRITICAL/WARNING 수준은 아니다. 다만 단일 루프로 MIME + per-file 크기를 함께 확인하면 코드 구조가 더 명확해진다.
  - 제안: 선택적 개선. `for (const f of files) { if (!allowedMime.includes(f.type)) return ...; if (f.size > limit) return ...; }` 단일 루프로 병합 가능. 단, 현재 코드도 FIRST 오류 순서(MIME → size)를 정확히 지키고 있어 기능상 동등하므로 강제 변경 불필요.

### 발견사항 2
- **[INFO]** `validateFilesClient` — `allowedMime.includes(f.type)` 는 배열 선형 탐색 (O(n) per file)
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `validateFilesClient` 내 `!allowedMime.includes(f.type)`
  - 상세: `allowedMime` 는 최대 14종 정도의 소규모 문자열 배열이고 파일 개수도 소수(기본 최대 5개)이므로 실질적 비용은 없다. 대규모 MIME 목록이나 파일 수가 폭증하는 시나리오에서는 `Set`으로 교체하면 O(1) 조회가 되나, 현재 도메인 제약상 오버엔지니어링이다.
  - 제안: 현 규모에서는 유지 가능. 만약 향후 allowedMimeTypes 목록이 수십 개 이상으로 확장된다면 `const mimeSet = new Set(allowedMime)` 로 교체를 고려.

### 발견사항 3
- **[INFO]** `validateFileField` (backend) — `def.allowedMimeTypes` 배열에 대한 `allowed.includes(m.type)` 선형 탐색
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateFileField` 내 `!allowed.includes(m.type)`
  - 상세: 프론트엔드와 동일한 패턴. 기본 목록 14종, 최대 파일 수 5개. 함수 호출 빈도는 폼 제출 1회에 1번으로 극히 낮고, 미수 범위가 수십 개 미만이므로 실제 성능 영향 없음.
  - 제안: 동일하게, 대규모 확장 시 Set 전환 고려. 현재는 불필요.

### 발견사항 4
- **[INFO]** `extractFormFields` — file 필드마다 `[...DEFAULT_FILE_ALLOWED_MIME_TYPES]` 스프레드로 새 배열 생성
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `field.allowedMimeTypes = mimes && mimes.length > 0 ? mimes : [...DEFAULT_FILE_ALLOWED_MIME_TYPES]`
  - 상세: 폼 설정당 file 필드 수가 통상 1~5개이고 함수 자체가 폼 제출 시점 1회 호출된다. 매 file 필드마다 14개 문자열 배열을 복사하는 비용은 무시 가능하다. `readonly` 상수를 그대로 참조 대입해도 되지만, 외부 변이를 방어하는 의도가 있다면 현 스프레드 방식이 더 안전하다.
  - 제안: 외부 변이 가능성이 없는 내부 서버측 코드 맥락이므로 `DEFAULT_FILE_ALLOWED_MIME_TYPES` 를 직접 대입해도 무방하나, 현재 패턴이 방어적으로 올바르다. 변경 권고 없음.

### 발견사항 5
- **[INFO]** `assertFormSubmissionValid` 리팩터링 — 이전 `coerceFormSubmission`(전체 맵 선생성) 제거 후 단일 루프로 전환
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertFormSubmissionValid` 내 `for (const def of fields)` 루프
  - 상세: 이전 구현은 먼저 전체 필드를 `Record<string,string>`으로 변환(O(n) 맵 생성)한 뒤 검증 루프(O(n))를 돌았다. 리팩터링 후 단일 패스(O(n))로 개선됐으며, 첫 오류 발생 시 즉시 `throw`로 이른 종료(early exit)를 유지하고 있다. 성능 관점에서 이 변경은 올바른 방향이다.
  - 제안: 없음. 성능 개선된 변경임.

### 발견사항 6
- **[INFO]** `validateScalarField` 내 `new RegExp(def.pattern)` — 폼 제출 시마다 regex 재컴파일
  - 위치: `codebase/backend/src/modules/chat-channel/shared/form-mode.ts` — `validateScalarField` 내 `re = new RegExp(def.pattern)`
  - 상세: 이 코드는 이번 변경에서 신규 도입된 것이 아니라 기존 `validateFormSubmission` 에서 이미 존재하던 패턴이다. `pattern` 값이 폼 config(서버측 고정 설정)에서 오므로 폼 제출 1건당 1회 컴파일이다. 폼 처리는 사용자 인터랙션 이벤트 단위로 발생하므로 hot path 가 아니다. 다만 동일 pattern 을 가진 동일 폼 필드로 매우 높은 빈도의 제출이 반복된다면(예: API 자동화 부하 테스트), 캐싱이 유리하다.
  - 제안: 현재 트래픽 수준에서는 무시 가능. 향후 고빈도 자동화 제출 시나리오가 생기면 `Map<string, RegExp>` 모듈 레벨 캐시(LRU 또는 단순 Map) 도입을 고려. 현재는 변경 불필요.

### 발견사항 7
- **[INFO]** `handleError` 콜백 — 에러 없을 때 `prev[name] === undefined` 조기 반환으로 불필요한 리렌더 방지
  - 위치: `codebase/frontend/src/components/editor/run-results/dynamic-form-ui.tsx` — `handleError` 함수
  - 상세: `msg === null` 이고 해당 키가 이미 없으면 `prev` 를 그대로 반환하여 상태 동일성을 유지한다. React 의 state setter 가 참조 동일 객체를 받으면 리렌더를 건너뛰므로, 이 최적화는 올바르게 적용되어 있다. 긍정적 패턴.
  - 제안: 없음. 올바른 최적화 패턴.

## 요약

이번 변경은 `type:'file'` 필드 검증 추가 및 `validateScalarField`/`validateFileField` 분리, execution-engine 단일 루프 리팩터링으로 구성된다. 성능 관점에서 중요한 문제는 발견되지 않았다. 오히려 기존 `coerceFormSubmission`(전체 맵 선생성)을 제거하고 단일 패스 루프로 전환한 것은 미미하지만 올바른 방향의 개선이다. 나머지 지적 사항(MIME 배열 선형 탐색, 중복 루프, regex 재컴파일)은 모두 파일 수(기본 최대 5개)와 MIME 목록 크기(14개), 호출 빈도(사용자 제출 이벤트 단위)를 고려하면 실질적 성능 영향이 없는 INFO 수준이다.

## 위험도

NONE

---

STATUS: SUCCESS
