# 의존성(Dependency) 리뷰

**리뷰 대상**: cafe24-hmac-raw-fix-b8e2d1 브랜치
**분석 범위**: 변경된 파일 전체 (spec 문서, review/consistency 산출물, plan 문서)

---

### 발견사항

- **[INFO]** 새 외부 패키지/라이브러리 추가 없음
  - 위치: 전체 변경 파일
  - 상세: 이번 PR 의 변경 파일은 `spec/`, `review/consistency/`, `plan/in-progress/` 하위의 markdown 문서와 JSON 메타 파일에 한정된다. `package.json`, `package-lock.json` 변경이 없으며 새 외부 의존성이 추가되지 않았다.
  - 제안: 없음.

- **[INFO]** 버전 고정 점검 대상 없음
  - 위치: 전체 변경 파일
  - 상세: 의존성 매니페스트(`package.json`, `pyproject.toml` 등) 변경이 없으므로 버전 고정 점검 항목이 없다.
  - 제안: 없음.

- **[INFO]** 라이선스 점검 대상 없음
  - 위치: 전체 변경 파일
  - 상세: 신규 외부 라이브러리가 없어 라이선스 호환성 점검 항목이 없다.
  - 제안: 없음.

- **[INFO]** 알려진 취약점이 있는 의존성 도입 없음
  - 위치: 전체 변경 파일
  - 상세: 의존성 변경이 없으므로 취약점 도입 위험이 없다.
  - 제안: 없음.

- **[INFO]** HMAC 알고리즘 변경 — Node.js 내장 모듈 `crypto`만 사용 (표준 라이브러리 적합)
  - 위치: `spec/2-navigation/4-integration.md` Rationale "HMAC 검증 알고리즘 — raw URL-encoded 값 보존 (2026-05-16 재정정)", `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 변경 1 코드 예시
  - 상세: 변경된 `buildHmacMessage` / `verifyHmac` 코드 예시는 `createHmac`, `timingSafeEqual`, `Buffer` 등 Node.js 내장 `crypto` 모듈만 사용한다. 새 외부 암호화 라이브러리를 도입하지 않는다. 기존 코드 패턴과 동일한 표준 라이브러리 의존 구조를 유지한다. 함수 시그니처 `buildHmacMessage(rawQuery: string): string` 을 그대로 유지해 호출자(`handleInstall`, `tryRecoverByMallId`)의 import 경로나 의존 관계가 변하지 않는다.
  - 제안: 없음.

- **[INFO]** `URLSearchParams` 의존성 제거 — 내장 Web API 에서 순수 문자열 연산으로 전환
  - 위치: `spec/2-navigation/4-integration.md` Rationale, `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 변경 1
  - 상세: 옛 알고리즘은 `URLSearchParams(rawQuery)` 로 query string 을 파싱해 값을 URL-decode 했다. 신규 알고리즘은 `rawQuery.split('&')` / `part.indexOf('=')` 의 순수 문자열 연산만 사용한다. 이는 외부 의존성이나 내장 Web API 에서 더욱 간단한 연산으로의 전환으로, 번들 크기나 런타임 의존성에 부정적 영향이 없다.
  - 제안: 없음.

- **[INFO]** 내부 모듈 의존 관계 — `buildHmacMessage` 시그니처 유지로 호출자 변경 불필요
  - 위치: `spec/2-navigation/4-integration.md` Rationale, `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 정합성 self-check
  - 상세: `buildHmacMessage` 의 인자(`rawQuery: string`)와 반환 타입(`string`)이 동일하게 유지되므로, 이를 호출하는 `handleInstall` 과 `tryRecoverByMallId` 의 코드 변경이 불필요하다. 내부 모듈 의존 관계의 depth 또는 방향이 변하지 않는다. `formUrlEncode` 헬퍼가 제거되는데, spec self-check 에서 이 헬퍼가 `spec` 본문 외에 다른 인용 없음을 확인했다. 단, 실제 backend 코드에서의 잔류 참조는 구현 단계에서 별도 grep 으로 재확인이 필요하다 (spec draft 범위에서는 파악 불가).
  - 제안: 구현 단계에서 `backend/` 전체에 `formUrlEncode` 호출 grep 수행 후 제거 누락 여부를 확인한다.

- **[INFO]** review/consistency 산출물과 spec 문서 간 내부 참조 — 링크 유효성
  - 위치: `review/consistency/2026/05/16/14_06_49/convention_compliance/review.md` 및 각 review 문서
  - 상세: review 문서들이 `spec/4-nodes/4-integration/4-cafe24.md`, `spec/2-navigation/4-integration.md`, `plan/in-progress/` 하위 파일을 내부 참조(상대 경로 링크)로 가리키고 있다. convention_compliance 리뷰에서 지적했듯 `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 의 상대 경로 링크 `../../2-navigation/4-integration.md#rationale` 는 `plan/in-progress/` 기준으로 루트까지 두 단계 이동 후 `spec/` 경로가 아니라 `2-navigation/` 을 직접 참조한다. 이는 경로 오류일 가능성이 있다(`plan/in-progress/../../` = 루트, 그러나 `spec/2-navigation/4-integration.md` 이므로 링크가 작동하려면 `../../spec/2-navigation/4-integration.md` 이어야 한다). 실제 상대 경로가 렌더러에 따라 동작 여부가 달라질 수 있다.
  - 제안: `plan/in-progress/spec-draft-cafe24-hmac-raw-fix.md` 의 상대 경로 링크 `../../2-navigation/4-integration.md` 가 올바른지 실제 파일 트리 기준으로 검증하고, 필요하면 `../../spec/2-navigation/4-integration.md` 로 수정하거나 절대 경로로 변경한다.

---

### 요약

이번 PR 의 변경 파일은 spec 문서, review/consistency 산출물, plan draft 문서로 구성되며 `package.json` 등 의존성 매니페스트 변경이 전혀 없다. 신규 외부 패키지 도입, 버전 고정 위반, 라이선스 불일치, 알려진 취약점 포함 라이브러리 등 의존성 관점의 직접 위험 요소가 없다. HMAC 알고리즘 재정정의 핵심 변화는 `URLSearchParams` Web API 호출을 순수 문자열 연산으로 교체하고 `formUrlEncode` 헬퍼를 제거하는 것으로, 이는 의존성 축소에 해당하여 번들 크기나 빌드 시간에 긍정적(또는 중립)이다. `buildHmacMessage` 시그니처 유지로 내부 모듈 의존 관계(호출자-피호출자 관계)가 변하지 않는다. 유일한 관찰사항은 `plan/in-progress/` 내 상대 경로 링크의 유효성으로, 이는 문서 렌더링 편의 수준의 INFO 이슈이다.

### 위험도

NONE
