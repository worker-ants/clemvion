# 요구사항(Requirement) Review — AGM-13 X-Deleted-Count spec 보강 + CORS 단위 테스트

## 발견사항

### **[WARNING]** 테스트가 실제 프로덕션 `defaultOptions`가 아닌 자체 fixture를 검증함
- **위치**: `codebase/backend/src/common/cors/web-chat-cors.spec.ts` lines 173–181 (신규 describe 블록)
- **상세**: 새로 추가된 `'CORS exposedHeaders 스냅샷 (AGM-13 회귀 방지)'` 테스트는 `exposedHeaders: ['X-Deleted-Count']`를 포함한 `defaultOptions`를 **테스트 내부에서 직접 생성**한다. 이 함수는 `main.ts`의 실제 `defaultOptions` 인라인 람다(line 185–192)와 별개의 독립 fixture다. 결과적으로:
  - 누군가 `main.ts`의 `exposedHeaders: ['X-Deleted-Count']`를 제거해도 이 테스트는 계속 통과한다.
  - 테스트는 "회귀 방지" 목적을 표방하지만(주석: "defaultOptions 에서 exposedHeaders 를 제거하거나 헤더 이름을 변경할 때 회귀를 잡아낸다"), 실제로 잡을 수 있는 회귀는 오직 이 테스트 파일 자체의 fixture를 수정하는 경우에만 한정된다.
  - 기존 `describe('createWebChatCorsDelegate')` 블록(line 78)에서 정의된 `defaultOptions`도 `exposedHeaders` 없이 정의되어 있어, 기존 테스트 suite와 새 snippet 간 불일치가 존재한다.
- **제안**: 진정한 회귀 방지를 위해 두 가지 접근이 가능하다:
  1. `main.ts`의 `defaultOptions` 람다를 named export 함수로 추출하여 spec 파일에서 직접 import 후 검증.
  2. 기존 `describe('createWebChatCorsDelegate')` 의 `defaultOptions` fixture에 `exposedHeaders: ['X-Deleted-Count']`를 추가하고, "비-웹채팅 경로"(line 154) 케이스에서 `opts.exposedHeaders`를 함께 assertion — 이렇게 하면 `createWebChatCorsDelegate`가 `defaultOptions`를 그대로 통과시키는 경로에서 exposedHeaders 전파도 검증된다.

### **[INFO]** spec AGM-13 요구사항 ID 보강 — 구현과 일치
- **위치**: `spec/5-system/17-agent-memory.md` AGM-13 요구사항 블록 (line 302)
- **상세**: AGM-13에 `X-Deleted-Count: <n>` echo 및 `CORS exposedHeaders: ['X-Deleted-Count']` 포함 필수 요건이 추가되었다. `main.ts` line 191, `agent-memory.controller.ts` line 184의 실제 구현과 일치한다. spec fidelity 충족.

### **[INFO]** spec §6 API 표 테이블 셀 간소화 — 상세 bullet과 중복 제거
- **위치**: `spec/5-system/17-agent-memory.md` §6 API 테이블 `DELETE /agent-memories?scopeKey=` 행
- **상세**: 기존 표 셀에 있던 장문 상세(echo 동작·0 가능·멱등)를 간결 요약으로 줄이고 "상세 → 아래 bullet"으로 위임했다. bullet(line 454)에 완전한 명세가 남아 있어 정보 유실 없음. 가독성 개선.

### **[INFO]** Rationale 섹션 신설 — "X-Deleted-Count 커스텀 응답 헤더 채택"
- **위치**: `spec/5-system/17-agent-memory.md` Rationale 하단 신규 subsection (line 311–319)
- **상세**: 204 body 금지 이유, 헤더 채택 근거, 단건 vs scope 전체 비대칭 이유, CORS exposedHeaders 필수성, 장기 api-convention 공식 등재 계획 등이 기록되었다. 결정 배경 문서화 완료. CLAUDE.md 규약("결정의 배경·근거 → Rationale 섹션")에 부합.

### **[INFO]** `CorsOptionsLike` 인터페이스에 `exposedHeaders` 필드 추가
- **위치**: `codebase/backend/src/common/cors/web-chat-cors.ts` line 29
- **상세**: `exposedHeaders?: string[]`가 인터페이스에 추가되어 타입 안전성 확보. 정의와 사용처(`main.ts`, 신규 테스트 fixture) 일치.

## 요약

이번 변경은 AGM-13 spec에 `X-Deleted-Count` 헤더 요건과 CORS exposedHeaders 필수 조건을 명시적으로 기록하고, 관련 Rationale을 추가하며, 단위 테스트를 추가하는 작업이다. spec 본문과 실제 구현(`main.ts`, `agent-memory.controller.ts`) 간 일치 여부는 충족된다. 단, 신규 추가된 `'CORS exposedHeaders 스냅샷'` 테스트는 회귀 방지 목적을 표방하지만, 자체 생성한 fixture만 검증하므로 `main.ts` 실제 코드 변경에 의한 회귀는 감지할 수 없다. 이 구조적 한계로 인해 테스트의 보호 가치가 제한적이며, 위 제안 중 하나로 실질적인 회귀 방지 커버리지를 확보할 것을 권장한다.

## 위험도

LOW
