# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### 파일 1: `codebase/backend/src/common/cors/web-chat-cors.spec.ts`

- **[WARNING]** 새 테스트 블록의 `defaultOptions` 가 실제 프로덕션 `defaultOptions` 와 연결되지 않는 독립 인라인 객체다.
  - 위치: 라인 247–252 (추가된 `describe` 블록 내부 `it`)
  - 상세: 기존 `createWebChatCorsDelegate` describe 블록(라인 151–154)에는 `defaultOptions` 헬퍼가 이미 정의돼 있다. 새 `describe` 블록은 그 헬퍼를 재사용하지 않고, 동일한 형태의 객체 리터럴을 `defaultOptions` 라는 이름으로 **다시 인라인 정의하고 자가 호출**한다. 결과적으로 테스트는 "실제 CORS 설정에서 exposedHeaders 가 노출되는지"가 아니라 "방금 만든 로컬 상수에서 내가 넣은 값이 나오는지"를 검증한다. 회귀 방지 효과가 없다. 실제 `defaultOptions` 팩토리(프로덕션 코드 또는 모듈 수준 공유 팩토리)를 import 해서 검증해야 한다.
  - 제안: 프로덕션 `defaultOptions`(실제 앱 부트스트랩 팩토리)를 export 하거나, 최소한 상위 describe 의 `defaultOptions` 헬퍼를 모듈 수준으로 끌어올려 두 describe 블록이 공유하도록 리팩토링한다. 그러면 실제 팩토리에서 `exposedHeaders` 를 제거했을 때 테스트가 실패하는 회귀 방지 목적을 달성할 수 있다.

- **[INFO]** 새 describe 블록 이름과 기존 describe 블록 이름의 언어 혼용(한국어 설명 + 영어 코드명).
  - 위치: 라인 239 `describe('CORS exposedHeaders 스냅샷 (AGM-13 회귀 방지)', ...)`
  - 상세: 기존 describe 블록(`extractExternalExecutionId`, `isExternalOriginAllowed`, `parseWidgetOrigins`, `createWebChatCorsDelegate`)은 모두 영어 함수명만 사용한다. 새 describe 블록은 한국어 설명을 포함한 혼합 형식이다. 스타일 불일치이나 가독성에 해가 되지는 않는다.
  - 제안: 일관성을 위해 `'exposedHeaders snapshot (AGM-13 regression guard)'` 형식으로 통일하거나, 프로젝트가 한국어 describe 명을 허용한다면 기존 블록도 동일 패턴으로 정렬한다.

- **[INFO]** `it` 블록 내 `defaultOptions` 변수 선언이 불필요한 함수 래퍼 형태를 취하고 있어 의도 파악에 추가 인지 부담이 있다.
  - 위치: 라인 247–253
  - 상세: `const defaultOptions = (): CorsOptionsLike => ({ ... }); const opts = defaultOptions();` 패턴은 "함수를 호출해 옵션을 얻는다"는 프로덕션 팩토리 패턴을 모방하려는 의도로 보이지만, 실제 프로덕션 팩토리를 사용하지 않으므로 지역 상수 `const opts: CorsOptionsLike = { ... }` 로 단순화하는 것이 더 읽기 쉽다.
  - 제안: 만약 WARNING 항목(실제 팩토리 연결)을 수정한다면 이 패턴도 자연히 해소된다. 그렇지 않더라도 함수 래퍼를 제거하고 객체 리터럴로 직접 할당하면 코드 의도가 더 명확해진다.

---

### 파일 2: `spec/5-system/17-agent-memory.md`

- **[INFO]** AGM-13 요구사항 ID 한 줄이 길어져 파싱 부담이 생겼다.
  - 위치: 라인 301 (`> 요구사항 AGM-13 — ...` blockquote)
  - 상세: 원래 한 문장이었던 AGM-13 요구사항 ID 라인에 `X-Deleted-Count` 상세 + CORS exposedHeaders 필수 요건이 모두 합산돼 단일 문장이 매우 길다. spec 본문의 bullet(`삭제 건수 echo`) 및 Rationale 섹션에 동일 내용이 이미 기술돼 있으므로, 요구사항 ID 라인은 "단건 삭제·scope 전체 삭제·editor+ 권한·hard delete·X-Deleted-Count 헤더 echo·CORS exposedHeaders 포함" 정도의 키워드 수준으로 압축하고 상세를 아래 bullet 으로 위임하면 단일 진실 원칙이 더 명확해진다.
  - 제안: AGM-13 요구사항 줄을 키워드 수준으로 유지하고 `(상세 → 아래 bullet)` 패턴을 동일하게 적용한다(테이블 셀 처리와 일관).

- **[INFO]** Rationale 신규 섹션 제목(`### scope 전체 삭제 — X-Deleted-Count 커스텀 응답 헤더 채택 (AGM-13)`)이 단락 구성 면에서 표준 3섹션(문제/결정/근거) 패턴을 잘 따르고 있다. 내용 중복은 없으며 의도 파악이 용이하다.
  - 위치: 추가된 Rationale 섹션 전체
  - 상세: "장기" 문단이 있어 미래 작업 예고를 인라인으로 포함하는데, 이 정보는 이미 `plan/` 이나 pending 트랙에 있어야 하는 내용이다. spec Rationale 에 TO-DO 형 장기 계획이 포함되면 spec 이 현재 사실의 SoT 역할을 하지 못하고 태스크 트래커처럼 기능하게 된다.
  - 제안: "장기: `spec/5-system/2-api-convention.md` 에 … 이관한다" 문장을 Rationale 에서 제거하고 plan 문서에만 기록한다. spec 은 현재 확정 사실만 담는다.

---

## 요약

이번 변경은 AGM-13 `X-Deleted-Count` 헤더 요건을 spec 에 보강하고 CORS 회귀 방지 테스트를 추가하는 소규모 픽스다. 유지보수성 관점에서 가장 주목할 문제는 신규 테스트가 실제 프로덕션 `defaultOptions` 팩토리와 연결되지 않아 회귀 방지 효과가 없다는 점(WARNING)이다. 테스트가 인라인으로 생성한 로컬 상수를 자기 자신이 검증하는 동어반복 구조이므로, 실제 팩토리를 import 하거나 기존 describe 의 헬퍼와 공유하도록 수정해야 테스트 목적이 달성된다. spec 쪽 변경은 내용 충실도와 구조는 양호하나, Rationale 에 미래 작업 예고를 포함시킨 부분과 AGM-13 요구사항 ID 줄의 과도한 인라인 중복은 단기적으로 문서 일관성을 낮출 수 있다.

## 위험도

MEDIUM
