# 신규 식별자 충돌 검토 — `spec/conventions/error-codes.md`

## 검토 범위 확인

- scope(`spec/conventions/`) 델타: **`spec/conventions/error-codes.md`** 1개 파일만 변경.
  실측(`git diff origin/main...HEAD -- spec/conventions/error-codes.md`): `## Overview` 절에
  "대표 surface 는 둘이다" 단락 추가 — 같은 파일(`nodes/core/error-codes.ts`)에 `ErrorCode` 와
  **자매 const** `EngineErrorCode` 가 있다는 서술을 명문화. 그 외 §1~§5·Rationale 은 무변경.
- 구현 diff(4파일/327줄)는 `spec/conventions/error-codes.md` 와 직접 연관된 코드 변경이 아니라,
  같은 배치에 실린 별도 작업(doc-link 스캐너 개선 + 신규 `stray-tool-tags.test.ts` 가드)이다.
  참고로 함께 검토했다.

## 발견사항

### [INFO] `EngineErrorCode` 는 코드에 이미 존재 — spec 문서가 "신규 도입"하는 식별자가 아니다

- target 신규 식별자(주장 대상): `EngineErrorCode` (spec 서술상 새로 강조된 이름)
- 기존 사용처: `codebase/backend/src/nodes/core/error-codes.ts:153` (`export const EngineErrorCode = {...}`),
  `error-codes.spec.ts`, `execution-engine.service.ts`, `shutdown-state.service.ts`,
  `repo-guards/__tests__/engine-error-code-anchor*.ts` — 모두 diff 이전부터 존재(이번 diff 는
  `error-codes.ts` 상단 **주석**만 바꿨다).
- 상세: 이번 PR 이 `EngineErrorCode` 라는 이름을 새로 만든 것이 아니라, 기존에 이미 있던 자매
  const 를 spec 문서(`error-codes.md`)에 처음으로 명시적으로 등재한 것이다. `spec/` 전체를 grep
  해도 `EngineErrorCode` 를 언급하는 문서는 이 파일 하나뿐이라 다른 의미로 겹쳐 쓰인 곳이 없다.
  충돌 없음 — "신규 식별자 도입" 이 아니라 "기존 식별자의 문서 SoT 등재" 이므로 참고로만 기록.
- 제안: 조치 불필요.

### [INFO] `SCAN_ROOTS` 상수명이 다른 테스트 파일에서 다른 의미로 재사용됨(비-blocking)

- target 신규 식별자: `SCAN_ROOTS` (`codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts:52`,
  `const SCAN_ROOTS = ["plan", "spec"] as const;` — 도구 아티팩트 태그 스캔 대상 루트)
- 기존 사용처: `codebase/frontend/src/lib/i18n/__tests__/hardcoded-korean-ratchet.test.ts:37`,
  `const SCAN_ROOTS = ["components", "app", "lib"];` — 하드코딩 한글 ratchet 가드의 스캔 대상
  소스 디렉터리.
- 상세: 두 상수 모두 파일-로컬(`const`, export 없음)이라 TypeScript 컴파일·모듈 해석 수준의
  충돌은 없다. 다만 같은 monorepo 안에 "스캔 루트를 정의하는 가드성 테스트" 패턴이 반복되고
  있고, 이름이 완전히 동일한데 가리키는 대상(문서 트리 `plan/`·`spec/` vs 프론트 소스 트리
  `components/`·`app/`·`lib/`)이 서로 다르다 — grep 으로 두 파일을 동시에 열어보는 사람에게
  혼동을 줄 수 있는 정도의 약한 유사성.
- 제안: 강제 조치 불필요(파일 스코프 분리로 실질 충돌 없음). 가독성 차원에서 원하면
  `stray-tool-tags.test.ts` 쪽을 `STRAY_TAG_SCAN_ROOTS` 등으로 세분화할 수 있으나 이번 PR 을
  막을 사유는 아니다.

### 그 외 관점 — 충돌 없음

- **요구사항 ID**: 이번 diff 가 새로 부여한 요구사항/규칙 ID 없음(`SS-SE-*`, `CCH-SE-*` 등은
  `secret-store.md`/`chat-channel-adapter.md` 소속으로 이번 변경과 무관, 재사용 없음).
- **엔티티/DTO/인터페이스명**: `stray-tool-tags.test.ts` 가 새로 선언하는 `StrayHit`, `TOOL_TAGS`,
  `MIN_EXPECTED_MD_FILES`, `STRAY_TAG_LINE`, `collectScanTargets`, `findStrayTags` 는 저장소
  전체에서 이 파일 밖에 동일 이름 사용처가 없음(grep 확인) — 충돌 없음.
- **API endpoint**: 이번 diff 는 endpoint 를 신설하지 않음.
- **이벤트/메시지명**: webhook·queue·SSE 이벤트 신설 없음.
- **환경변수·설정키**: 신규 ENV var·config key 없음(`error-codes.md` 가 언급하는
  `CODE_NODE_MEMORY_LIMIT_MB` 는 기존 §4.1 표의 기존 서술이며 이번 diff 범위 밖).
- **파일 경로**: 신규 파일 `codebase/frontend/src/lib/docs/__tests__/stray-tool-tags.test.ts` 는
  같은 디렉터리의 기존 명명 컨벤션(`kebab-case.test.ts`)을 그대로 따르고, 동일 경로에 기존
  파일과의 이름 충돌도 없음.

## 요약

이번 PR 이 `spec/conventions/` 스코프에서 실제로 바꾸는 것은 `error-codes.md` 의 짧은 주석성
단락 하나이며, 여기서 언급되는 `EngineErrorCode` 는 코드에 이미 존재하던 식별자를 처음
문서화한 것이라 "신규 식별자" 자체가 아니다 — 다른 의미로 이미 쓰이고 있는 충돌 사례도 없다.
동봉된 구현 diff(문서-링크 스캐너 + 신규 `stray-tool-tags.test.ts` 가드)에서도 요구사항 ID·
엔티티명·API endpoint·이벤트명·환경변수·파일 경로 어느 축에서도 CRITICAL/WARNING 급 충돌은
발견되지 않았다. 유일한 관찰은 파일-로컬 상수명 `SCAN_ROOTS` 가 다른 테스트 파일에서 이미
다른 의미로 쓰이고 있다는 INFO 수준의 명명 유사성뿐이며, 스코프 분리로 실질 충돌은 없다.

## 위험도

NONE
