# 신규 식별자 충돌 검토

검토 모드: impl-done (scope=spec/7-channel-web-chat/, diff-base=origin/main)

---

## 발견사항

**이번 diff 에서 신규 도입된 식별자**

| 식별자 종류 | 신규 값 | 소재 |
|---|---|---|
| 코드 함수 (exported) | `safeApiBaseFromQuery` | `codebase/channel-web-chat/src/widget/use-widget.ts:84` |
| spec 코드 참조 (신규 행) | `safeApiBaseFromQuery`, `configFromQuery` | `spec/7-channel-web-chat/4-security.md §1 보안정책표 신규 행` |
| spec 코드 참조 (정정) | `isTextInputSurface` SoT 명시 | `spec/7-channel-web-chat/1-widget-app.md §2 입력창 행` |
| spec 내부 cross-ref (정정) | `§R2` (오기 `R5` 수정) | `spec/7-channel-web-chat/5-admin-console.md §2, Rationale R1` |
| spec 서술 (정정) | `resetSession` 은 wc:command 전용 + npm 미노출 | `spec/7-channel-web-chat/2-sdk.md §1, §3` |

---

### 발견사항 1

- **[INFO]** `safeApiBaseFromQuery` — 신규 exported 함수, 동일 스코프 내 중복 없음
  - target 신규 식별자: `safeApiBaseFromQuery` (`codebase/channel-web-chat/src/widget/use-widget.ts:84`, `export function`)
  - 기존 사용처: origin/main 에 없음. `codebase/backend/`, `codebase/frontend/`, `codebase/packages/` 전역 grep 결과 0건.
  - 상세: `channel-web-chat` 패키지 내부에서만 사용되며 패키지 경계 밖으로 노출되지 않는다. 동일 이름의 타 식별자 없음.
  - 제안: 충돌 없음. 현행 유지.

### 발견사항 2

- **[INFO]** `isTextInputSurface` — spec 이 새로 SoT 참조로 명시하나 코드 식별자는 origin/main 에 이미 존재
  - target 신규 식별자: spec `1-widget-app.md §2` 에 `widget-state.isTextInputSurface` 를 판정 SoT 로 신규 명시
  - 기존 사용처: `codebase/channel-web-chat/src/lib/widget-state.ts:30` — origin/main 에 이미 `export function isTextInputSurface` 로 존재. spec 추가 전부터 코드에 있었음.
  - 상세: spec 이 코드 구현 사실을 사후 문서화한 것이므로 충돌 없음. 의미도 동일(텍스트 입력 활성 표면 판정).
  - 제안: 충돌 없음. 현행 유지.

### 발견사항 3

- **[INFO]** `GENERIC_ERROR_MESSAGE` — spec 이 코드 SoT 로 신규 참조하나 코드 식별자는 이미 존재
  - target 신규 식별자: `4-security.md §1` 보안표 "에러 메시지 노출" 행이 `GENERIC_ERROR_MESSAGE` 를 코드 SoT 로 참조
  - 기존 사용처: `codebase/channel-web-chat/src/widget/use-widget.ts:503` — origin/main 에 이미 존재 (`const GENERIC_ERROR_MESSAGE`). `backend/`·`frontend/` 에는 없음.
  - 상세: 단일 패키지 내부 `const` 로 외부 노출 없음. 충돌 없음.
  - 제안: 충돌 없음. 현행 유지.

### 발견사항 4

- **[INFO]** `configFromQuery` — spec 이 코드 SoT 로 신규 참조하나 기존 함수
  - target 신규 식별자: `4-security.md §1` 신규 행이 `configFromQuery` 를 코드 SoT 로 참조
  - 기존 사용처: origin/main `use-widget.ts` 에 이미 `function configFromQuery()` 존재.
  - 상세: 충돌 없음. spec 이 기존 함수를 사후 문서화.
  - 제안: 충돌 없음.

### 발견사항 5

- **[INFO]** `web-chat-security` spec ID — 다른 영역의 `4-security` 슬러그와 혼동 가능성(이미 인지·해소됨)
  - target 신규 식별자: `spec/7-channel-web-chat/4-security.md` frontmatter `id: web-chat-security`
  - 기존 사용처: 이번 diff 에서 변경되지 않음. 파일 자체는 이전부터 존재. frontmatter 주석에 "타 영역의 `4-security` 슬러그와 충돌 방지 (영역 prefix `web-chat-` 로 전역 유일)"라고 이미 명시되어 있음.
  - 상세: 전역 spec ID grep 결과 `web-chat-security` 는 해당 파일 1건만 존재. 다른 영역 `4-security.md` 들은 이 diff 범위가 아니며, 이번 변경으로 ID 가 새로 추가되거나 변경된 것이 아님.
  - 제안: 충돌 없음. 주석 설명이 충분함.

### 발견사항 6

- **[INFO]** `wc:command resetSession` — postMessage 이벤트명 노출 범위 변경 없음
  - target 신규 식별자: spec `2-sdk.md §1·§3` 에 `resetSession` 이 `wc:command` 전용이고 npm `ChatInstance`·`ClemvionChat` 전역 메서드에 **미노출**임을 명시 (정정)
  - 기존 사용처: `wc:command` 의 `action: resetSession` 은 origin/main 코드에 이미 존재 (`codebase/frontend/.../web-chat/page.js` 의 빌드 출력에서 `wc:command` 페이로드로 사용됨). `ClemvionChatMethod` · `ChatInstance` 에는 미포함.
  - 상세: 이번 spec 변경은 코드 현실과 spec 서술의 정렬(정정)이므로 새 충돌 없음.
  - 제안: 충돌 없음.

---

## 요약

이번 diff(`spec/7-channel-web-chat/` 4개 파일 + `codebase/` 3개 파일)는 새 식별자를 거의 도입하지 않으며, 대부분 기존 코드 식별자(`safeApiBaseFromQuery` 제외)에 대한 spec 사후 문서화 또는 오기·크로스레퍼런스 수정이다. 유일한 실질 신규 식별자 `safeApiBaseFromQuery` 는 `channel-web-chat` 패키지 내부에만 존재하며 동일 이름의 기존 사용처가 없다. 요구사항 ID 신규 부여 없음, API endpoint 변경 없음, ENV var/config 키 신규 없음, spec 파일 경로/이름 변경 없음. 신규 식별자 충돌 관점에서 차단 또는 경고 사항이 없다.

---

## 위험도

NONE
